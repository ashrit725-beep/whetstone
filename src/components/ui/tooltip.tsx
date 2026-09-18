'use client'

/**
 * Tooltip: a short label for a control that already has a name.
 *
 * Rules of use, not suggestions:
 *   · Never the only place a piece of information lives. A tooltip is a
 *     reminder, never the sentence that explains the feature.
 *   · Never on a disabled native control. A `disabled` element fires no pointer
 *     events, so the tooltip would be unreachable. Use `aria-disabled` with a
 *     visible reason instead (contract §5.4).
 *   · Never interactive content. Links and buttons belong in a Popover.
 *
 * Keyboard contract (WCAG 1.4.13):
 *   Focus     shows the tooltip immediately, with no delay.
 *   Escape    dismisses it while the trigger keeps focus, and it stays
 *             dismissed until focus or the pointer leaves and comes back.
 *   Blur      hides it.
 * The pointer opens it after a short delay, and it stays open while the pointer
 * travels from the trigger onto the tooltip itself, so the text can be read.
 *
 * Motion: the shared anchored animation, 180ms in / 120ms out, opacity plus a
 * 4px lift, and nothing under `prefers-reduced-motion: reduce`.
 */

import {
  cloneElement,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { useOverlayPortal } from './dialog'
import { AnchoredStyles, useAnchoredPosition, useExitPhase, type Placement } from './popover'

const TOOLTIP_CSS = `
.whetstone-tooltip {
  z-index: var(--z-tooltip);
  background-color: var(--color-surface-4);
  color: var(--color-text-1);
  border: 1px solid var(--color-border-control);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-overlay);
}
@media (prefers-reduced-motion: no-preference) {
  .whetstone-tooltip[data-state="open"]    { animation: whetstone-anchored-in 180ms cubic-bezier(0.16, 1, 0.3, 1); }
  .whetstone-tooltip[data-state="closing"] { animation: whetstone-anchored-out 120ms cubic-bezier(0.4, 0, 1, 1) forwards; }
}
@media (prefers-reduced-motion: reduce) {
  .whetstone-tooltip { animation: none; }
}
`

/** Pointer open delay. Focus is deliberately instant: the two must not match. */
const POINTER_DELAY = 280
/** Grace period for the pointer to travel from the trigger onto the tooltip. */
const LEAVE_GRACE = 120

type TriggerElement = ReactElement<Record<string, unknown>>

export interface TooltipProps {
  /** A few words. Never a paragraph, never the only copy of this information. */
  content: ReactNode
  /** The control being labelled. Must be focusable and must not be `disabled`. */
  children: TriggerElement
  placement?: Placement
  offset?: number
  className?: string
}

export function Tooltip({ content, children, placement = 'top', offset = 8, className }: TooltipProps) {
  const host = useOverlayPortal()
  const tipId = useId()
  const anchorRef = useRef<HTMLElement | null>(null)
  const tipRef = useRef<HTMLDivElement | null>(null)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [open, setOpen] = useState(false)
  /* Escape dismissed it; do not reopen until the pointer or focus leaves. */
  const suppressed = useRef(false)
  const phase = useExitPhase(open, 120)

  const clearTimers = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current)
    if (closeTimer.current) clearTimeout(closeTimer.current)
    openTimer.current = null
    closeTimer.current = null
  }, [])

  useEffect(() => clearTimers, [clearTimers])

  const show = useCallback(
    (immediate: boolean) => {
      if (suppressed.current) return
      clearTimers()
      if (immediate) {
        setOpen(true)
        return
      }
      openTimer.current = setTimeout(() => setOpen(true), POINTER_DELAY)
    },
    [clearTimers],
  )

  const hide = useCallback(
    (immediate: boolean) => {
      clearTimers()
      if (immediate) {
        setOpen(false)
        return
      }
      closeTimer.current = setTimeout(() => setOpen(false), LEAVE_GRACE)
    },
    [clearTimers],
  )

  const { style } = useAnchoredPosition({
    anchorRef,
    floatingRef: tipRef,
    active: phase !== 'closed',
    placement,
    offset,
  })

  /* Escape dismisses without moving focus (SC 1.4.13). */
  useEffect(() => {
    if (phase !== 'open') return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      suppressed.current = true
      hide(true)
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [phase, hide])

  const childPointerEnter = children.props['onPointerEnter']
  const childPointerLeave = children.props['onPointerLeave']
  const childFocus = children.props['onFocus']
  const childBlur = children.props['onBlur']

  const trigger = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      anchorRef.current = node
    },
    'aria-describedby': phase === 'closed' ? children.props['aria-describedby'] : tipId,
    onPointerEnter: (event: ReactPointerEvent<HTMLElement>) => {
      if (typeof childPointerEnter === 'function') (childPointerEnter as (e: ReactPointerEvent<HTMLElement>) => void)(event)
      /* Touch taps should activate the control, not reveal a label. */
      if (event.pointerType === 'touch') return
      show(false)
    },
    onPointerLeave: (event: ReactPointerEvent<HTMLElement>) => {
      if (typeof childPointerLeave === 'function') (childPointerLeave as (e: ReactPointerEvent<HTMLElement>) => void)(event)
      suppressed.current = false
      hide(false)
    },
    onFocus: (event: ReactFocusEvent<HTMLElement>) => {
      if (typeof childFocus === 'function') (childFocus as (e: ReactFocusEvent<HTMLElement>) => void)(event)
      show(true)
    },
    onBlur: (event: ReactFocusEvent<HTMLElement>) => {
      if (typeof childBlur === 'function') (childBlur as (e: ReactFocusEvent<HTMLElement>) => void)(event)
      suppressed.current = false
      hide(true)
    },
  })

  return (
    <>
      {trigger}
      {host && phase !== 'closed'
        ? createPortal(
            <div
              ref={tipRef}
              id={tipId}
              role="tooltip"
              data-state={phase}
              style={style}
              className={cn('whetstone-tooltip measure-ui px-xs py-2xs text-xs', className)}
              onPointerEnter={() => show(true)}
              onPointerLeave={() => hide(false)}
            >
              <AnchoredStyles />
              <style href="whetstone-tooltip" precedence="medium">
                {TOOLTIP_CSS}
              </style>
              {content}
            </div>,
            host,
          )
        : null}
    </>
  )
}

export default Tooltip
