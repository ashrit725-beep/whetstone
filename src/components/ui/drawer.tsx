'use client'

/**
 * Drawer: an edge-anchored modal sheet. Same contract as Dialog, plus a side.
 *
 * Use `left` for the Discover filter rail below 60rem, `right` for a detail
 * inspector, `bottom` for a phone-height sheet.
 *
 * Keyboard contract:
 *   Escape          closes a dismissible drawer and returns focus to the invoker.
 *   Tab / Shift+Tab cycle inside the sheet; the page behind is inert.
 *   Enter / Space   activate the focused control.
 * The bottom sheet can also be swiped down to dismiss, and it always carries a
 * visible close button, because a drag must never be the only way out
 * (SC 2.5.7). The grab handle is decorative: it is not a tab stop, and it does
 * nothing a pointer-less reader cannot do with the close button.
 *
 * Motion: `translate` from the anchored edge over 240ms in, 160ms out. Nothing
 * animates under `prefers-reduced-motion: reduce`, including the swipe
 * spring-back.
 */

import { useCallback, useId, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Banner } from './banner'
import {
  OverlayStyles,
  prefersReducedMotion,
  useModalDialog,
  useOverlayPortal,
  type DialogErrorSpec,
} from './dialog'

const DRAWER_CSS = `
.whetstone-drawer { display: flex; flex-direction: column; }
.whetstone-drawer[data-side="left"] {
  inset-block: 0; inset-inline-start: 0; inset-inline-end: auto;
  block-size: 100dvh; max-block-size: 100dvh;
  border-start-end-radius: var(--radius-lg);
  border-end-end-radius: var(--radius-lg);
}
.whetstone-drawer[data-side="right"] {
  inset-block: 0; inset-inline-end: 0; inset-inline-start: auto;
  block-size: 100dvh; max-block-size: 100dvh;
  border-start-start-radius: var(--radius-lg);
  border-end-start-radius: var(--radius-lg);
}
.whetstone-drawer[data-side="bottom"] {
  inset-inline: 0; inset-block-end: 0; inset-block-start: auto;
  inline-size: 100%;
  border-start-start-radius: var(--radius-lg);
  border-start-end-radius: var(--radius-lg);
}

@keyframes whetstone-drawer-in-left   { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes whetstone-drawer-out-left  { from { transform: translateX(0); } to { transform: translateX(-100%); } }
@keyframes whetstone-drawer-in-right  { from { transform: translateX(100%); } to { transform: translateX(0); } }
@keyframes whetstone-drawer-out-right { from { transform: translateX(0); } to { transform: translateX(100%); } }
@keyframes whetstone-drawer-in-bottom { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes whetstone-drawer-out-bottom{ from { transform: translateY(0); } to { transform: translateY(100%); } }

@media (prefers-reduced-motion: no-preference) {
  .whetstone-drawer[data-side="left"][data-state="open"]     { animation: whetstone-drawer-in-left 240ms cubic-bezier(0.16, 1, 0.3, 1); }
  .whetstone-drawer[data-side="left"][data-state="closing"]  { animation: whetstone-drawer-out-left 160ms cubic-bezier(0.4, 0, 1, 1) forwards; }
  .whetstone-drawer[data-side="right"][data-state="open"]    { animation: whetstone-drawer-in-right 240ms cubic-bezier(0.16, 1, 0.3, 1); }
  .whetstone-drawer[data-side="right"][data-state="closing"] { animation: whetstone-drawer-out-right 160ms cubic-bezier(0.4, 0, 1, 1) forwards; }
  .whetstone-drawer[data-side="bottom"][data-state="open"]   { animation: whetstone-drawer-in-bottom 240ms cubic-bezier(0.16, 1, 0.3, 1); }
  .whetstone-drawer[data-side="bottom"][data-state="closing"]{ animation: whetstone-drawer-out-bottom 160ms cubic-bezier(0.4, 0, 1, 1) forwards; }
  .whetstone-drawer[data-dragging="false"] { transition-property: transform; transition-duration: 180ms; transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1); }
}
/* A sheet mid-drag follows the finger exactly: no animation, no transition. */
.whetstone-drawer[data-dragging="true"] { animation: none; transition-property: none; }
@media (prefers-reduced-motion: reduce) {
  .whetstone-drawer { animation: none; transition-property: none; }
}
.whetstone-drawer-handle { touch-action: none; }
`

export type DrawerSide = 'left' | 'right' | 'bottom'
export type DrawerSize = 'sm' | 'md' | 'lg'

const INLINE_SIZE: Record<DrawerSize, string> = {
  sm: 'min(calc(100vw - 3rem), 20rem)',
  md: 'min(calc(100vw - 3rem), 24rem)',
  lg: 'min(calc(100vw - 3rem), 32rem)',
}

export interface DrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Required. It is the sheet’s accessible name. */
  title: string
  description?: string
  side?: DrawerSide
  /** Width for `left` and `right`. A bottom sheet is always full width. */
  size?: DrawerSize
  dismissible?: boolean
  initialFocus?: RefObject<HTMLElement | null>
  footer?: ReactNode
  loading?: boolean
  error?: DialogErrorSpec | null
  children?: ReactNode
  className?: string
}

export function Drawer({
  open,
  onOpenChange,
  title,
  description,
  side = 'right',
  size = 'md',
  dismissible = true,
  initialFocus,
  footer,
  loading = false,
  error = null,
  children,
  className,
}: DrawerProps) {
  const host = useOverlayPortal()
  const titleId = useId()
  const descId = useId()
  const canDismiss = dismissible && !loading

  const { phase, requestClose, dialogProps } = useModalDialog({
    open,
    onOpenChange,
    dismissible: canDismiss,
    initialFocus,
    exitMs: 160,
    host,
  })

  /* ---- swipe-to-dismiss, bottom sheet only ---- */
  const dragStart = useRef<number | null>(null)
  const [dragY, setDragY] = useState(0)
  const [dragging, setDragging] = useState(false)
  const swipeable = side === 'bottom' && canDismiss

  const onHandleDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!swipeable) return
      dragStart.current = event.clientY
      setDragging(true)
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [swipeable],
  )

  const onHandleMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragStart.current === null) return
    /* Downward only. Dragging up must not detach the sheet from its edge. */
    setDragY(Math.max(0, event.clientY - dragStart.current))
  }, [])

  const endDrag = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (dragStart.current === null) return
      const travelled = Math.max(0, event.clientY - dragStart.current)
      const height = event.currentTarget.closest('dialog')?.getBoundingClientRect().height ?? 0
      dragStart.current = null
      setDragging(false)
      setDragY(0)
      if (height > 0 && travelled > height * 0.28) requestClose()
    },
    [requestClose],
  )

  if (!host || phase === 'closed') return null

  const style =
    side === 'bottom'
      ? { maxBlockSize: 'min(85dvh, 42rem)', transform: dragY > 0 ? `translateY(${dragY}px)` : undefined }
      : { inlineSize: INLINE_SIZE[size] }

  return createPortal(
    <dialog
      {...dialogProps}
      data-side={side}
      data-dragging={dragging ? 'true' : 'false'}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      aria-busy={loading || undefined}
      className={cn('whetstone-overlay whetstone-drawer', className)}
      style={style}
    >
      <OverlayStyles />
      <style href="whetstone-drawer" precedence="medium">
        {DRAWER_CSS}
      </style>

      {side === 'bottom' ? (
        <div
          className="whetstone-drawer-handle flex shrink-0 cursor-grab items-center justify-center pt-xs pb-3xs active:cursor-grabbing"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          aria-hidden="true"
        >
          <span className="block rounded-xs bg-border-control" style={{ inlineSize: '2.5rem', blockSize: '0.25rem' }} />
        </div>
      ) : null}

      <header className="flex shrink-0 items-start gap-sm border-b border-border-hair p-md">
        <div className="track-safe flex min-w-0 grow flex-col gap-3xs">
          <h2 id={titleId} className="text-md text-text-1" style={{ fontVariationSettings: '"wdth" 100, "wght" 600' }}>
            {title}
          </h2>
          {description ? (
            <p id={descId} className="measure-ui text-xs text-text-2">
              {description}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={canDismiss ? requestClose : undefined}
          aria-disabled={canDismiss ? undefined : true}
          aria-label={canDismiss ? `Close ${title}` : `Close ${title}, unavailable while this is saving`}
          className={cn(
            'tap-44 -m-3xs shrink-0 rounded-sm p-3xs transition-colors duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
            canDismiss ? 'text-text-3 hover:text-text-1' : 'cursor-not-allowed text-text-disabled',
          )}
        >
          <X size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </header>

      <div className="min-h-0 grow overflow-y-auto p-md" data-scroll-region>
        {children}
      </div>

      {error || footer ? (
        <div className="flex shrink-0 flex-col gap-sm border-t border-border-hair p-md">
          {error ? (
            <Banner variant="danger" title={error.title}>
              {error.body}
            </Banner>
          ) : null}
          {footer ? <div className="flex flex-wrap items-center justify-end gap-md">{footer}</div> : null}
        </div>
      ) : null}
    </dialog>,
    host,
  )
}

/* `prefersReducedMotion` is re-exported so a caller that builds its own sheet
   behaviour on top of Drawer reads the same signal the sheet does. */
export { prefersReducedMotion }

export default Drawer
