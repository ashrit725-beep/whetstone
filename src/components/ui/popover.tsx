'use client'

/**
 * Popover: a non-modal panel anchored to the control that opened it.
 *
 * Non-modal on purpose: the page behind stays live and readable. Reach for
 * Dialog when the answer must be given before anything else can happen.
 *
 * Keyboard contract:
 *   Enter / Space   on the trigger toggles the popover.
 *   Escape          closes it and returns focus to the trigger, from anywhere
 *                   inside the panel.
 *   Tab             moves through the panel’s own controls and then out of it,
 *                   which also closes it: forwards to the control after the
 *                   trigger, backwards to the trigger. Focus is never trapped.
 * A pointer press anywhere outside the trigger or the panel closes it. Focus
 * always returns to the trigger, whatever closed it.
 *
 * Motion: opacity plus `translateY(4px → 0)` over 180ms in, 120ms out, and
 * nothing under `prefers-reduced-motion: reduce`.
 *
 * This file also exports `useAnchoredPosition`, `useExitPhase`, `focusAfter`
 * and `AnchoredStyles`, which DropdownMenu and Tooltip reuse so that everything
 * anchored in Whetstone flips, clamps, animates and hands focus back identically.
 */

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { getFocusable, prefersReducedMotion, useOverlayPortal } from './dialog'

/* `useLayoutEffect` has nothing to do on the server, and React says so loudly. */
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

/* ------------------------------------------------------------ anchoring --- */

export type Placement = 'bottom-start' | 'bottom-end' | 'bottom' | 'top-start' | 'top-end' | 'top'

/** Keeps an anchored panel this far from the viewport edge. */
const VIEWPORT_MARGIN = 8

/**
 * Where a panel sits before its first measurement: unseen and inert to the
 * pointer, but not `visibility: hidden`. Entry focus runs in the same flush as
 * the first measurement and before its result is committed, and `focus()` on a
 * hidden element does nothing, so the keyboard stayed on the trigger of every
 * menu and popover. Transparent content still takes focus.
 */
export const UNPLACED_STYLE: CSSProperties = {
  position: 'fixed',
  insetBlockStart: 0,
  insetInlineStart: 0,
  opacity: 0,
  pointerEvents: 'none',
}

export interface AnchoredPositionOptions {
  anchorRef: RefObject<HTMLElement | null>
  floatingRef: RefObject<HTMLElement | null>
  active: boolean
  placement: Placement
  /** Gap between the anchor and the panel, in px. */
  offset: number
  matchWidth?: boolean
}

export interface AnchoredPosition {
  style: CSSProperties
  /** The placement actually used, after flipping. */
  resolved: Placement
}

/**
 * Fixed-position anchoring with vertical flip and horizontal clamping.
 * Recomputes on scroll, resize and content change; never animates position.
 */
export function useAnchoredPosition({
  anchorRef,
  floatingRef,
  active,
  placement,
  offset,
  matchWidth = false,
}: AnchoredPositionOptions): AnchoredPosition {
  const [position, setPosition] = useState<AnchoredPosition>({
    style: UNPLACED_STYLE,
    resolved: placement,
  })

  const compute = useCallback(() => {
    const anchor = anchorRef.current
    const floating = floatingRef.current
    if (!anchor || !floating) return

    const a = anchor.getBoundingClientRect()
    const f = floating.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    const wantsTop = placement.startsWith('top')
    const spaceBelow = vh - a.bottom - offset
    const spaceAbove = a.top - offset
    const flip = wantsTop ? spaceAbove < f.height && spaceBelow > spaceAbove : spaceBelow < f.height && spaceAbove > spaceBelow
    const onTop = wantsTop ? !flip : flip

    const top = onTop ? a.top - f.height - offset : a.bottom + offset

    let left: number
    if (placement.endsWith('-end')) left = a.right - f.width
    else if (placement.endsWith('-start')) left = a.left
    else left = a.left + a.width / 2 - f.width / 2

    const maxLeft = Math.max(VIEWPORT_MARGIN, vw - f.width - VIEWPORT_MARGIN)
    left = Math.min(Math.max(VIEWPORT_MARGIN, left), maxLeft)

    const base: Placement = onTop
      ? placement.endsWith('-end')
        ? 'top-end'
        : placement.endsWith('-start')
          ? 'top-start'
          : 'top'
      : placement.endsWith('-end')
        ? 'bottom-end'
        : placement.endsWith('-start')
          ? 'bottom-start'
          : 'bottom'

    setPosition({
      style: {
        position: 'fixed',
        insetBlockStart: Math.round(top),
        insetInlineStart: Math.round(left),
        ...(matchWidth ? { inlineSize: Math.round(a.width) } : { maxInlineSize: `calc(100vw - ${VIEWPORT_MARGIN * 2}px)` }),
        maxBlockSize: `calc(100dvh - ${VIEWPORT_MARGIN * 2}px)`,
      },
      resolved: base,
    })
  }, [anchorRef, floatingRef, placement, offset, matchWidth])

  useIsomorphicLayoutEffect(() => {
    if (!active) return
    compute()
  }, [active, compute])

  useEffect(() => {
    if (!active) return
    const onChange = () => compute()
    window.addEventListener('scroll', onChange, true)
    window.addEventListener('resize', onChange)
    const floating = floatingRef.current
    const observer = floating && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onChange) : null
    if (observer && floating) observer.observe(floating)
    return () => {
      window.removeEventListener('scroll', onChange, true)
      window.removeEventListener('resize', onChange)
      observer?.disconnect()
    }
  }, [active, compute, floatingRef])

  return position
}

/**
 * Moves focus to whatever follows `anchor` in the page's tab order.
 *
 * Anchored panels are portalled to the end of <body>, so the browser's own Tab
 * from their last control has nowhere to go: focus fell to <body> and the
 * panel stayed open. Leaving a panel forwards continues from its trigger
 * instead, which is where the panel sits for the reader.
 */
export function focusAfter(anchor: HTMLElement | null) {
  if (!anchor) return
  const next = getFocusable(document.body).find(
    (el) =>
      el.tabIndex >= 0 &&
      !anchor.contains(el) &&
      !el.closest('[data-whetstone-overlay], [inert]') &&
      (anchor.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
  )
  ;(next ?? anchor).focus({ preventScroll: next === undefined })
}

export type ExitPhase = 'closed' | 'open' | 'closing'

/** Keeps a panel mounted for its exit animation, then unmounts it. */
export function useExitPhase(open: boolean, exitMs: number): ExitPhase {
  const [phase, setPhase] = useState<ExitPhase>('closed')

  useEffect(() => {
    if (open) {
      setPhase('open')
      return
    }
    setPhase((p) => (p === 'open' ? 'closing' : p))
  }, [open])

  useEffect(() => {
    if (phase !== 'closing') return
    const ms = prefersReducedMotion() ? 0 : exitMs
    const timer = setTimeout(() => setPhase('closed'), ms)
    return () => clearTimeout(timer)
  }, [phase, exitMs])

  return phase
}

const ANCHORED_CSS = `
.whetstone-anchored {
  z-index: var(--z-dropdown);
  background-color: var(--color-surface-3);
  color: var(--color-text-1);
  border: 1px solid var(--color-border-control);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-overlay);
  overflow: auto;
  overscroll-behavior: contain;
}
@keyframes whetstone-anchored-in  { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
@keyframes whetstone-anchored-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(4px); } }
@media (prefers-reduced-motion: no-preference) {
  .whetstone-anchored[data-state="open"]    { animation: whetstone-anchored-in 180ms cubic-bezier(0.16, 1, 0.3, 1); }
  .whetstone-anchored[data-state="closing"] { animation: whetstone-anchored-out 120ms cubic-bezier(0.4, 0, 1, 1) forwards; }
}
@media (prefers-reduced-motion: reduce) {
  .whetstone-anchored { animation: none; }
}
`

export function AnchoredStyles() {
  return (
    <style href="whetstone-anchored" precedence="medium">
      {ANCHORED_CSS}
    </style>
  )
}

/* -------------------------------------------------------------- popover --- */

type TriggerElement = ReactElement<Record<string, unknown>>

export interface PopoverProps {
  /** The control that opens the panel. Must render a real `<button>`. */
  trigger: TriggerElement
  children: ReactNode | ((api: { close: () => void }) => ReactNode)
  placement?: Placement
  /** Gap between trigger and panel, in px. */
  offset?: number
  /** Makes the panel exactly as wide as its trigger, for select-like menus. */
  matchTriggerWidth?: boolean
  /** Controlled mode. Omit both to let the popover own its state. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Accessible name for the panel. */
  label: string
  className?: string
}

export function Popover({
  trigger,
  children,
  placement = 'bottom-start',
  offset = 8,
  matchTriggerWidth = false,
  open: controlledOpen,
  onOpenChange,
  label,
  className,
}: PopoverProps) {
  const host = useOverlayPortal()
  const panelId = useId()
  const anchorRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [uncontrolled, setUncontrolled] = useState(false)
  const open = controlledOpen ?? uncontrolled
  const phase = useExitPhase(open, 120)

  const setOpen = useCallback(
    (next: boolean) => {
      if (controlledOpen === undefined) setUncontrolled(next)
      onOpenChange?.(next)
    },
    [controlledOpen, onOpenChange],
  )

  const close = useCallback(
    (returnFocus = true) => {
      setOpen(false)
      if (returnFocus) anchorRef.current?.focus({ preventScroll: true })
    },
    [setOpen],
  )

  const { style } = useAnchoredPosition({
    anchorRef,
    floatingRef: panelRef,
    active: phase !== 'closed',
    placement,
    offset,
    matchWidth: matchTriggerWidth,
  })

  /* Move focus into the panel so the keyboard follows the eye. */
  useEffect(() => {
    if (phase !== 'open') return
    const panel = panelRef.current
    if (!panel) return
    const target = getFocusable(panel)[0] ?? panel
    target.focus({ preventScroll: true })
  }, [phase])

  /* Escape anywhere, and a pointer press outside, both close. */
  useEffect(() => {
    if (phase !== 'open') return

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close()
        return
      }
      /* Tab off either end of the panel leaves it for the page: backwards to
         the trigger, forwards to what follows the trigger (see focusAfter). */
      const panel = panelRef.current
      if (event.key !== 'Tab' || !panel?.contains(document.activeElement)) return
      const controls = getFocusable(panel)
      const at = document.activeElement
      const leaving = event.shiftKey
        ? at === panel || at === controls[0]
        : at === controls[controls.length - 1] || (at === panel && controls.length === 0)
      if (!leaving) return
      event.preventDefault()
      if (event.shiftKey) {
        close()
      } else {
        close(false)
        focusAfter(anchorRef.current)
      }
    }
    function onPointerDown(event: PointerEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      close(false)
    }
    function onFocusIn(event: FocusEvent) {
      const target = event.target
      if (!(target instanceof Node)) return
      if (panelRef.current?.contains(target)) return
      if (anchorRef.current?.contains(target)) return
      close(false)
    }

    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('focusin', onFocusIn, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('focusin', onFocusIn, true)
    }
  }, [phase, close])

  const triggerClick = trigger.props['onClick']
  const anchor = cloneElement(trigger, {
    ref: (node: HTMLElement | null) => {
      anchorRef.current = node
    },
    'aria-expanded': open,
    'aria-haspopup': 'dialog',
    'aria-controls': phase === 'closed' ? undefined : panelId,
    onClick: (event: ReactMouseEvent<HTMLElement>) => {
      if (typeof triggerClick === 'function') (triggerClick as (e: ReactMouseEvent<HTMLElement>) => void)(event)
      setOpen(!open)
    },
  })

  return (
    <>
      {anchor}
      {host && phase !== 'closed'
        ? createPortal(
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-label={label}
              aria-modal="false"
              data-state={phase}
              tabIndex={-1}
              style={style}
              className={cn('whetstone-anchored p-md', className)}
            >
              <AnchoredStyles />
              {typeof children === 'function' ? children({ close }) : children}
            </div>,
            host,
          )
        : null}
    </>
  )
}

export default Popover
