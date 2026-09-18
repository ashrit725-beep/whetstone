'use client'

/**
 * DropdownMenu: a real `role="menu"`, hand-built on the platform.
 *
 * Keyboard contract (APG menu button):
 *   Enter / Space / ArrowDown  on the trigger open the menu at the first item.
 *   ArrowUp                    on the trigger opens it at the last item.
 *   ArrowDown / ArrowUp        move between items and wrap at the ends.
 *   Home / End                 jump to the first or last item.
 *   a–z, 0–9                   typeahead: jumps to the next item starting with
 *                              what you typed. The buffer clears after a pause.
 *   ArrowRight / Enter         on a submenu item opens it at its first item.
 *   ArrowLeft / Escape         close the submenu and return focus to its item.
 *   Escape                     closes the menu and returns focus to the trigger.
 *   Tab                        closes the menu and lets focus move on from the
 *                              trigger; Shift+Tab closes it onto the trigger.
 *
 * A disabled item keeps its place in the sequence: it is focusable, it is
 * announced as disabled, and it says why. Skipping it would hide the fact that
 * the action exists at all.
 *
 * An item whose `onSelect` returns a promise shows a spinner in place of its
 * icon and holds the menu open until the work settles, so the result is not
 * announced into an empty screen.
 *
 * Motion: the panel uses the shared anchored animation, 180ms in / 120ms out,
 * opacity plus a 4px lift, and nothing under `prefers-reduced-motion: reduce`.
 */

import {
  cloneElement,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronRight, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOverlayPortal } from './dialog'
import {
  AnchoredStyles,
  UNPLACED_STYLE,
  focusAfter,
  useAnchoredPosition,
  useExitPhase,
  type Placement,
} from './popover'
import { Spinner } from './spinner'
import { MIN_TAP } from './banner'

/* --------------------------------------------------------------- context -- */

interface MenuContextValue {
  /** Closes every open level and returns focus to the root trigger. */
  closeAll: () => void
}

const MenuContext = createContext<MenuContextValue | null>(null)

interface RadioGroupContextValue {
  value: string
  onValueChange: (value: string) => void
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null)

/* ------------------------------------------------------------- keyboard --- */

const TYPEAHEAD_RESET = 500

function itemsOf(panel: HTMLElement | null): HTMLElement[] {
  if (!panel) return []
  return Array.from(panel.querySelectorAll<HTMLElement>('[data-menu-item]')).filter(
    (el) => el.closest('[data-menu-panel]') === panel,
  )
}

interface MenuKeyboardOptions {
  panelRef: RefObject<HTMLElement | null>
  /** Closes this level and restores focus to whatever opened it. */
  onDismiss: () => void
  /** Root menus let Tab through; submenus close on ArrowLeft. */
  isSubmenu: boolean
}

function useMenuKeyboard({ panelRef, onDismiss, isSubmenu }: MenuKeyboardOptions) {
  const buffer = useRef('')
  const bufferTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (bufferTimer.current) clearTimeout(bufferTimer.current)
    },
    [],
  )

  const focusAt = useCallback(
    (index: number) => {
      const items = itemsOf(panelRef.current)
      if (items.length === 0) return
      const wrapped = ((index % items.length) + items.length) % items.length
      items[wrapped]?.focus()
    },
    [panelRef],
  )

  return useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      const items = itemsOf(panelRef.current)
      const active = document.activeElement
      const current = items.findIndex((el) => el === active)

      /* Every key this menu handles stops here: a submenu panel is a React
         child of its parent menu, so an unhandled key would move focus in both. */
      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault()
          event.stopPropagation()
          focusAt(current + 1)
          return
        case 'ArrowUp':
          event.preventDefault()
          event.stopPropagation()
          focusAt(current - 1)
          return
        case 'Home':
          event.preventDefault()
          event.stopPropagation()
          focusAt(0)
          return
        case 'End':
          event.preventDefault()
          event.stopPropagation()
          focusAt(items.length - 1)
          return
        case 'Escape':
          event.preventDefault()
          event.stopPropagation()
          onDismiss()
          return
        case 'ArrowLeft':
          if (isSubmenu) {
            event.preventDefault()
            event.stopPropagation()
            onDismiss()
          }
          return
        default:
          break
      }

      /* Typeahead. One printable character, no modifiers. */
      if (event.key.length !== 1 || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === ' ' && buffer.current === '') return

      event.preventDefault()
      event.stopPropagation()
      buffer.current += event.key.toLowerCase()
      if (bufferTimer.current) clearTimeout(bufferTimer.current)
      bufferTimer.current = setTimeout(() => {
        buffer.current = ''
      }, TYPEAHEAD_RESET)

      const start = current + (buffer.current.length > 1 ? 0 : 1)
      for (let i = 0; i < items.length; i++) {
        const index = (start + i) % items.length
        const label = (items[index]?.textContent ?? '').trim().toLowerCase()
        if (label.startsWith(buffer.current)) {
          items[index]?.focus()
          return
        }
      }
    },
    [panelRef, focusAt, onDismiss, isSubmenu],
  )
}

/* ----------------------------------------------------------------- root --- */

const PANEL_CLASS = 'whetstone-anchored flex min-w-0 flex-col gap-3xs p-2xs'

type TriggerElement = ReactElement<Record<string, unknown>>

export interface DropdownMenuProps {
  /** The control that opens the menu. Must render a real `<button>`. */
  trigger: TriggerElement
  /** Accessible name for the menu itself, e.g. “Project actions”. */
  label: string
  children: ReactNode
  placement?: Placement
  offset?: number
  open?: boolean
  onOpenChange?: (open: boolean) => void
  className?: string
}

export function DropdownMenu({
  trigger,
  label,
  children,
  placement = 'bottom-start',
  offset = 8,
  open: controlledOpen,
  onOpenChange,
  className,
}: DropdownMenuProps) {
  const host = useOverlayPortal()
  const menuId = useId()
  const triggerRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [uncontrolled, setUncontrolled] = useState(false)
  const [entry, setEntry] = useState<'first' | 'last'>('first')
  const open = controlledOpen ?? uncontrolled
  const phase = useExitPhase(open, 120)

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolled(next)
      onOpenChange?.(next)
    },
    [controlledOpen, onOpenChange],
  )

  const closeAll = useCallback(
    (returnFocus = true) => {
      setOpen(false)
      if (returnFocus) triggerRef.current?.focus({ preventScroll: true })
    },
    [setOpen],
  )

  const { style } = useAnchoredPosition({
    anchorRef: triggerRef,
    floatingRef: panelRef,
    active: phase !== 'closed',
    placement,
    offset,
  })

  const menuKeys = useMenuKeyboard({ panelRef, onDismiss: () => closeAll(true), isSubmenu: false })

  /* Tab from any item, at any depth, closes every level. Items are not tab
     stops and the panel is portalled to the end of <body>, so the browser's own
     Tab dropped focus on <body> and left the menu open; it continues from the
     trigger instead, which is where the menu sits for the reader. */
  const onKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') {
      menuKeys(event)
      return
    }
    event.preventDefault()
    if (event.shiftKey) {
      closeAll(true)
    } else {
      closeAll(false)
      focusAfter(triggerRef.current)
    }
  }

  /* Entry focus: first item, or last when opened with ArrowUp. */
  useEffect(() => {
    if (phase !== 'open') return
    const items = itemsOf(panelRef.current)
    const target = entry === 'last' ? items[items.length - 1] : items[0]
    ;(target ?? panelRef.current)?.focus({ preventScroll: true })
  }, [phase, entry])

  /* A pointer press outside, or focus leaving the menu, closes it. */
  useEffect(() => {
    if (phase !== 'open') return
    function outside(event: Event) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return
      /* A submenu lives in its own portal node, so ask the DOM, not the tree. */
      if (target instanceof Element && target.closest('[data-menu-panel]')) return
      closeAll(false)
    }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [phase, closeAll])

  const triggerClick = trigger.props['onClick']
  const triggerKeyDown = trigger.props['onKeyDown']

  const anchor = cloneElement(trigger, {
    ref: (node: HTMLElement | null) => {
      triggerRef.current = node
    },
    'aria-haspopup': 'menu',
    'aria-expanded': open,
    'aria-controls': phase === 'closed' ? undefined : menuId,
    onClick: (event: ReactMouseEvent<HTMLElement>) => {
      if (typeof triggerClick === 'function') (triggerClick as (e: ReactMouseEvent<HTMLElement>) => void)(event)
      setEntry('first')
      setOpen(!open)
    },
    onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
      if (typeof triggerKeyDown === 'function') (triggerKeyDown as (e: ReactKeyboardEvent<HTMLElement>) => void)(event)
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        setEntry(event.key === 'ArrowUp' ? 'last' : 'first')
        setOpen(true)
      } else if (event.key === 'Escape' && open) {
        event.preventDefault()
        closeAll(true)
      }
    },
  })

  return (
    <MenuContext.Provider value={{ closeAll: () => closeAll(true) }}>
      {anchor}
      {host && phase !== 'closed'
        ? createPortal(
            <div
              ref={panelRef}
              id={menuId}
              role="menu"
              aria-label={label}
              aria-orientation="vertical"
              data-menu-panel
              data-state={phase}
              tabIndex={-1}
              style={style}
              className={cn(PANEL_CLASS, className)}
              onKeyDown={onKeyDown}
            >
              <AnchoredStyles />
              {children}
            </div>,
            host,
          )
        : null}
    </MenuContext.Provider>
  )
}

/* ---------------------------------------------------------------- items --- */

const ITEM_BASE =
  'flex w-full items-center gap-sm rounded-xs px-sm text-left text-sm ' +
  'transition-colors duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] ' +
  'focus:bg-surface-4 hover:bg-surface-4'

const ITEM_TONE = {
  normal: 'text-text-1',
  destructive: 'text-critical',
  disabled: 'text-text-disabled cursor-not-allowed hover:bg-transparent focus:bg-transparent',
} as const

function ItemShell({
  icon: Icon,
  busy,
  children,
  hint,
  trailing,
}: {
  icon?: LucideIcon
  busy?: boolean
  children: ReactNode
  hint?: string
  trailing?: ReactNode
}) {
  return (
    <>
      {busy ? (
        <Spinner size={16} />
      ) : Icon ? (
        <Icon size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
      ) : null}
      <span className="track-safe flex min-w-0 grow flex-col">
        <span className="truncate">{children}</span>
        {hint ? <span className="text-xs text-text-3">{hint}</span> : null}
      </span>
      {trailing}
    </>
  )
}

export interface DropdownMenuItemProps {
  children: ReactNode
  /** Return a promise to keep the menu open and show a spinner until it settles. */
  onSelect?: () => void | Promise<void>
  icon?: LucideIcon
  /** Styles the item with the critical hue. Pair with a verb that names the loss. */
  destructive?: boolean
  disabled?: boolean
  /** Required when `disabled`: the visible reason it cannot be chosen now. */
  disabledReason?: string
  /** A keyboard hint, rendered in the mono face. */
  shortcut?: string
  /** Set false for an item that opens something in place. */
  closeOnSelect?: boolean
}

export function DropdownMenuItem({
  children,
  onSelect,
  icon,
  destructive = false,
  disabled = false,
  disabledReason,
  shortcut,
  closeOnSelect = true,
}: DropdownMenuItemProps) {
  const menu = useContext(MenuContext)
  const [busy, setBusy] = useState(false)

  async function activate() {
    if (disabled || busy) return
    const result = onSelect?.()
    if (result instanceof Promise) {
      setBusy(true)
      try {
        await result
      } finally {
        setBusy(false)
      }
      if (closeOnSelect) menu?.closeAll()
      return
    }
    if (closeOnSelect) menu?.closeAll()
  }

  return (
    <button
      type="button"
      role="menuitem"
      data-menu-item
      tabIndex={-1}
      aria-disabled={disabled || busy || undefined}
      style={MIN_TAP}
      className={cn(ITEM_BASE, disabled ? ITEM_TONE.disabled : destructive ? ITEM_TONE.destructive : ITEM_TONE.normal)}
      onClick={() => {
        void activate()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          void activate()
        }
      }}
    >
      <ItemShell
        icon={icon}
        busy={busy}
        hint={disabled ? disabledReason : undefined}
        trailing={
          shortcut ? (
            <kbd className="shrink-0 rounded-xs border border-border-hair bg-surface-0 px-2xs text-xs text-text-3">
              {shortcut}
            </kbd>
          ) : null
        }
      >
        {children}
      </ItemShell>
    </button>
  )
}

export interface DropdownMenuCheckboxItemProps {
  children: ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  disabledReason?: string
}

export function DropdownMenuCheckboxItem({
  children,
  checked,
  onCheckedChange,
  disabled = false,
  disabledReason,
}: DropdownMenuCheckboxItemProps) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      data-menu-item
      tabIndex={-1}
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      style={MIN_TAP}
      className={cn(ITEM_BASE, disabled ? ITEM_TONE.disabled : ITEM_TONE.normal)}
      onClick={() => {
        if (!disabled) onCheckedChange(!checked)
      }}
    >
      <span aria-hidden="true" className="flex w-md shrink-0 justify-center">
        {checked ? <Check size={16} strokeWidth={1.5} className="text-accent" /> : null}
      </span>
      <span className="track-safe flex min-w-0 grow flex-col">
        <span className="truncate">{children}</span>
        {disabled && disabledReason ? <span className="text-xs text-text-3">{disabledReason}</span> : null}
      </span>
    </button>
  )
}

export interface DropdownMenuRadioGroupProps {
  value: string
  onValueChange: (value: string) => void
  /** Names the group for assistive technology, e.g. “Sort by”. */
  label: string
  children: ReactNode
}

export function DropdownMenuRadioGroup({ value, onValueChange, label, children }: DropdownMenuRadioGroupProps) {
  return (
    <RadioGroupContext.Provider value={{ value, onValueChange }}>
      <div role="group" aria-label={label} className="flex flex-col gap-3xs">
        <span className="px-sm pt-2xs text-2xs text-text-3" aria-hidden="true">
          {label}
        </span>
        {children}
      </div>
    </RadioGroupContext.Provider>
  )
}

export interface DropdownMenuRadioItemProps {
  children: ReactNode
  value: string
  disabled?: boolean
  disabledReason?: string
}

export function DropdownMenuRadioItem({ children, value, disabled = false, disabledReason }: DropdownMenuRadioItemProps) {
  const group = useContext(RadioGroupContext)
  const checked = group?.value === value

  return (
    <button
      type="button"
      role="menuitemradio"
      data-menu-item
      tabIndex={-1}
      aria-checked={checked ?? false}
      aria-disabled={disabled || undefined}
      style={MIN_TAP}
      className={cn(ITEM_BASE, disabled ? ITEM_TONE.disabled : ITEM_TONE.normal)}
      onClick={() => {
        if (!disabled) group?.onValueChange(value)
      }}
    >
      <span aria-hidden="true" className="flex w-md shrink-0 justify-center">
        {checked ? <Check size={16} strokeWidth={1.5} className="text-accent" /> : null}
      </span>
      <span className="track-safe flex min-w-0 grow flex-col">
        <span className="truncate">{children}</span>
        {disabled && disabledReason ? <span className="text-xs text-text-3">{disabledReason}</span> : null}
      </span>
    </button>
  )
}

export function DropdownMenuSeparator() {
  return <hr role="separator" className="my-2xs border-border-hair" />
}

export interface DropdownMenuLabelProps {
  children: ReactNode
}

/** A heading inside the menu. Decorative to assistive tech: group your items instead. */
export function DropdownMenuLabel({ children }: DropdownMenuLabelProps) {
  return (
    <span className="px-sm pt-2xs text-2xs text-text-3" aria-hidden="true">
      {children}
    </span>
  )
}

/* -------------------------------------------------------------- submenu --- */

export interface DropdownMenuSubProps {
  /** The label on the parent item. */
  label: string
  children: ReactNode
  icon?: LucideIcon
  disabled?: boolean
  disabledReason?: string
}

export function DropdownMenuSub({ label, children, icon, disabled = false, disabledReason }: DropdownMenuSubProps) {
  const host = useOverlayPortal()
  const subId = useId()
  const itemRef = useRef<HTMLButtonElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const phase = useExitPhase(open, 120)
  const [style, setStyle] = useState<CSSProperties>(UNPLACED_STYLE)

  const dismiss = useCallback(() => {
    setOpen(false)
    itemRef.current?.focus({ preventScroll: true })
  }, [])

  const onKeyDown = useMenuKeyboard({ panelRef, onDismiss: dismiss, isSubmenu: true })

  /* Anchored to the side of its parent item, flipping when the edge is close. */
  useEffect(() => {
    if (phase === 'closed') return
    function place() {
      const item = itemRef.current
      const panel = panelRef.current
      if (!item || !panel) return
      const a = item.getBoundingClientRect()
      const p = panel.getBoundingClientRect()
      const gap = 4
      const spaceRight = window.innerWidth - a.right
      const left = spaceRight >= p.width + gap ? a.right + gap : Math.max(8, a.left - p.width - gap)
      const top = Math.min(Math.max(8, a.top - 4), Math.max(8, window.innerHeight - p.height - 8))
      setStyle({
        position: 'fixed',
        insetBlockStart: Math.round(top),
        insetInlineStart: Math.round(left),
        maxBlockSize: 'calc(100dvh - 16px)',
      })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'open') return
    const first = itemsOf(panelRef.current)[0]
    ;(first ?? panelRef.current)?.focus({ preventScroll: true })
  }, [phase])

  const Icon = icon

  return (
    <>
      <button
        ref={itemRef}
        type="button"
        role="menuitem"
        data-menu-item
        tabIndex={-1}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={phase === 'closed' ? undefined : subId}
        aria-disabled={disabled || undefined}
        style={MIN_TAP}
        className={cn(ITEM_BASE, disabled ? ITEM_TONE.disabled : ITEM_TONE.normal)}
        onClick={() => {
          if (!disabled) setOpen((o) => !o)
        }}
        onKeyDown={(event) => {
          if (disabled) return
          if (event.key === 'ArrowRight' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            event.stopPropagation()
            setOpen(true)
          }
        }}
      >
        {Icon ? <Icon size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" /> : null}
        <span className="track-safe flex min-w-0 grow flex-col">
          <span className="truncate">{label}</span>
          {disabled && disabledReason ? <span className="text-xs text-text-3">{disabledReason}</span> : null}
        </span>
        <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-text-3" />
      </button>

      {host && phase !== 'closed'
        ? createPortal(
            <div
              ref={panelRef}
              id={subId}
              role="menu"
              aria-label={label}
              aria-orientation="vertical"
              data-menu-panel
              data-state={phase}
              tabIndex={-1}
              style={style}
              className={PANEL_CLASS}
              onKeyDown={onKeyDown}
            >
              <AnchoredStyles />
              {children}
            </div>,
            host,
          )
        : null}
    </>
  )
}

export default DropdownMenu
