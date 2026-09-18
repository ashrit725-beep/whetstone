'use client'

/**
 * Dialog: native `<dialog>` + `showModal()`, with a hand-built fallback.
 *
 * Keyboard contract:
 *   Escape          closes, but only when `dismissible` is true and nothing is
 *                   in flight. A destructive confirm sets `dismissible={false}`
 *                   so Escape cannot be mistaken for “no, leave it”.
 *   Tab / Shift+Tab cycle inside the dialog. The browser does this for us when
 *                   `showModal()` is available; when it is not, the keydown
 *                   handler below wraps focus at the ends and the rest of the
 *                   page is marked `inert`.
 *   Enter / Space   activate the focused control, as normal.
 * On open, focus moves to `initialFocus`, or the first focusable control, or
 * the panel itself. On close, focus returns to whatever opened the dialog.
 *
 * Scroll is locked on the document while the dialog is up. The page never
 * shifts, because `scrollbar-gutter: stable` is already set globally.
 *
 * Motion: opacity plus `scale(0.98 → 1)` over 240ms on the way in, 160ms on the
 * way out, and nothing at all under `prefers-reduced-motion: reduce`.
 *
 * This file also exports the overlay plumbing that Drawer reuses, so the two
 * cannot drift: `useOverlayPortal`, `useModalDialog`, `getFocusable`,
 * `prefersReducedMotion`, `OVERLAY_CSS`.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Banner } from './banner'

/* ------------------------------------------------------------- plumbing --- */

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

/** Every focusable descendant, in document order, that is actually rendered. */
export function getFocusable(root: HTMLElement | null): HTMLElement[] {
  if (!root) return []
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.offsetParent !== null || el.getClientRects().length > 0,
  )
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/** A portal host on `document.body`, created once the component has mounted. */
export function useOverlayPortal(): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null)
  useEffect(() => {
    const el = document.createElement('div')
    el.setAttribute('data-whetstone-overlay', '')
    document.body.appendChild(el)
    setHost(el)
    return () => {
      el.remove()
    }
  }, [])
  return host
}

function lockScroll(): () => void {
  const previous = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  return () => {
    document.body.style.overflow = previous
  }
}

function inertBackground(except: HTMLElement | null): () => void {
  if (!except) return () => {}
  const touched: HTMLElement[] = []
  for (const child of Array.from(document.body.children)) {
    if (child === except || !(child instanceof HTMLElement)) continue
    if (child.hasAttribute('inert')) continue
    child.setAttribute('inert', '')
    touched.push(child)
  }
  return () => {
    for (const el of touched) el.removeAttribute('inert')
  }
}

export type OverlayPhase = 'closed' | 'open' | 'closing'

export interface UseModalDialogOptions {
  open: boolean
  onOpenChange: (open: boolean) => void
  dismissible: boolean
  initialFocus?: RefObject<HTMLElement | null>
  /** Exit duration in ms. Kept in step with the exit animation. */
  exitMs: number
  host: HTMLElement | null
}

export interface ModalDialogApi {
  dialogRef: RefObject<HTMLDialogElement | null>
  phase: OverlayPhase
  /** Ask to close. Runs the exit animation, then closes and restores focus. */
  requestClose: () => void
  /** Spread onto the `<dialog>` element. */
  dialogProps: {
    ref: RefObject<HTMLDialogElement | null>
    'data-state': OverlayPhase
    'data-native': 'true' | 'false'
    onCancel: (event: SyntheticEvent<HTMLDialogElement>) => void
    onClick: (event: ReactMouseEvent<HTMLDialogElement>) => void
    onKeyDown: (event: ReactKeyboardEvent<HTMLDialogElement>) => void
  }
}

/**
 * Drives a native modal `<dialog>`: opening, the exit animation, the focus
 * trap fallback, focus restoration, scroll lock, and background inerting.
 */
export function useModalDialog({
  open,
  onOpenChange,
  dismissible,
  initialFocus,
  exitMs,
  host,
}: UseModalDialogOptions): ModalDialogApi {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const invokerRef = useRef<HTMLElement | null>(null)
  const nativeRef = useRef(true)
  const [native, setNative] = useState(true)
  const [phase, setPhase] = useState<OverlayPhase>('closed')

  /* Remember the invoker before the dialog takes focus. */
  useEffect(() => {
    if (open && phase === 'closed') {
      const active = document.activeElement
      invokerRef.current = active instanceof HTMLElement ? active : null
      setPhase('open')
    }
  }, [open, phase])

  /* Show it, then place focus. */
  useEffect(() => {
    if (phase !== 'open') return
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return

    if (typeof dialog.showModal === 'function') {
      try {
        dialog.showModal()
        nativeRef.current = true
      } catch {
        dialog.setAttribute('open', '')
        nativeRef.current = false
        setNative(false)
      }
    } else {
      dialog.setAttribute('open', '')
      nativeRef.current = false
      setNative(false)
    }

    const target = initialFocus?.current ?? getFocusable(dialog)[0] ?? dialog
    target.focus({ preventScroll: true })
  }, [phase, initialFocus])

  /* Scroll lock and background inerting live as long as the dialog is up. */
  useEffect(() => {
    if (phase === 'closed') return
    const releaseScroll = lockScroll()
    const releaseInert = native ? () => {} : inertBackground(host)
    return () => {
      releaseScroll()
      releaseInert()
    }
  }, [phase, host, native])

  const finishClose = useCallback(() => {
    const dialog = dialogRef.current
    if (dialog) {
      if (dialog.open && typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
    setPhase('closed')
    const invoker = invokerRef.current
    invokerRef.current = null
    if (invoker && document.contains(invoker)) invoker.focus({ preventScroll: true })
  }, [])

  /*
   * Consumer flipped `open` to false: enter the exit, then close for real.
   *
   * These are two effects for a reason. As one, the body called `setPhase`
   * while `phase` was in its own dependency array: the state change re-ran the
   * effect, React ran the cleanup first, `clearTimeout` killed the timer that
   * had just been scheduled, and the re-run hit the `phase !== 'open'` guard
   * and scheduled nothing. `finishClose` never fired, so `dialog.close()` was
   * never called, the scroll lock was re-applied instead of released, and focus
   * never returned to the invoker: every dialog and drawer stayed open with the
   * page locked behind it. `useExitPhase` in popover.tsx splits it the same way.
   */
  useEffect(() => {
    if (open || phase !== 'open') return
    setPhase('closing')
  }, [open, phase])

  useEffect(() => {
    if (phase !== 'closing') return
    const ms = prefersReducedMotion() ? 0 : exitMs
    const timer = setTimeout(finishClose, ms)
    return () => clearTimeout(timer)
  }, [phase, exitMs, finishClose])

  const requestClose = useCallback(() => {
    if (!open) return
    onOpenChange(false)
  }, [open, onOpenChange])

  const onCancel = useCallback(
    (event: SyntheticEvent<HTMLDialogElement>) => {
      /* Always take over: the browser would close instantly and skip the exit. */
      event.preventDefault()
      if (dismissible) requestClose()
    },
    [dismissible, requestClose],
  )

  const onClick = useCallback(
    (event: ReactMouseEvent<HTMLDialogElement>) => {
      if (!dismissible) return
      /* A click that lands on the dialog box itself is a click on the backdrop:
         every piece of content sits inside the panel element. */
      if (event.target === event.currentTarget) requestClose()
    },
    [dismissible, requestClose],
  )

  const onKeyDown = useCallback((event: ReactKeyboardEvent<HTMLDialogElement>) => {
    if (nativeRef.current || event.key !== 'Tab') return
    const items = getFocusable(event.currentTarget)
    if (items.length === 0) return
    const first = items[0]
    const last = items[items.length - 1]
    if (!first || !last) return
    const active = document.activeElement
    if (event.shiftKey && active === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && active === last) {
      event.preventDefault()
      first.focus()
    }
  }, [])

  return {
    dialogRef,
    phase,
    requestClose,
    dialogProps: {
      ref: dialogRef,
      'data-state': phase,
      'data-native': native ? 'true' : 'false',
      onCancel,
      onClick,
      onKeyDown,
    },
  }
}

/* ------------------------------------------------------------------ css --- */

export const OVERLAY_CSS = `
.whetstone-overlay {
  position: fixed;
  padding: 0;
  border: 1px solid var(--color-border-control);
  background-color: var(--color-surface-4);
  color: var(--color-text-1);
  box-shadow: var(--shadow-overlay);
  overflow: visible;
  z-index: var(--z-modal);
}
.whetstone-overlay::backdrop { background-color: var(--color-scrim); }
/* Fallback path only: no top layer, so the scrim is drawn by the panel. */
.whetstone-overlay[data-native="false"]::before {
  content: "";
  position: fixed;
  inset: 0;
  z-index: -1;
  background-color: var(--color-scrim);
}

.whetstone-dialog {
  inset: 0;
  margin: auto;
  block-size: fit-content;
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
}

@keyframes whetstone-dialog-in {
  from { opacity: 0; transform: scale(0.98); }
  to   { opacity: 1; transform: scale(1); }
}
@keyframes whetstone-dialog-out {
  from { opacity: 1; transform: scale(1); }
  to   { opacity: 0; transform: scale(0.98); }
}
@keyframes whetstone-scrim-in  { from { opacity: 0; } to { opacity: 1; } }
@keyframes whetstone-scrim-out { from { opacity: 1; } to { opacity: 0; } }

@media (prefers-reduced-motion: no-preference) {
  .whetstone-dialog[data-state="open"] {
    animation: whetstone-dialog-in 240ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .whetstone-dialog[data-state="closing"] {
    animation: whetstone-dialog-out 160ms cubic-bezier(0.4, 0, 1, 1) forwards;
  }
  .whetstone-overlay[data-state="open"]::backdrop {
    animation: whetstone-scrim-in 240ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .whetstone-overlay[data-state="closing"]::backdrop {
    animation: whetstone-scrim-out 160ms cubic-bezier(0.4, 0, 1, 1) forwards;
  }
}
@media (prefers-reduced-motion: reduce) {
  .whetstone-overlay, .whetstone-overlay::backdrop { animation: none; }
}
`

export function OverlayStyles() {
  return (
    <style href="whetstone-overlay" precedence="medium">
      {OVERLAY_CSS}
    </style>
  )
}

/* --------------------------------------------------------------- dialog --- */

export type DialogSize = 'sm' | 'md' | 'lg' | 'full'

const SIZE: Record<DialogSize, { inlineSize: string; maxBlockSize: string }> = {
  sm: { inlineSize: 'min(calc(100vw - 2rem), 24rem)', maxBlockSize: 'min(85dvh, 32rem)' },
  md: { inlineSize: 'min(calc(100vw - 2rem), 32rem)', maxBlockSize: 'min(85dvh, 40rem)' },
  lg: { inlineSize: 'min(calc(100vw - 2rem), 48rem)', maxBlockSize: 'min(85dvh, 48rem)' },
  full: { inlineSize: 'calc(100vw - 2rem)', maxBlockSize: 'calc(100dvh - 2rem)' },
}

export interface DialogErrorSpec {
  /** What broke. Sentence case, no exclamation mark. */
  title: string
  /** Why it matters and what to do next. */
  body?: string
}

export interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Required. Every dialog names itself, and the name is the accessible name. */
  title: string
  /** One line under the title, wired to `aria-describedby`. */
  description?: string
  size?: DialogSize
  /**
   * Escape, the backdrop and the close button all close a dismissible dialog.
   * Set false for a destructive confirm, so leaving needs a named choice.
   */
  dismissible?: boolean
  initialFocus?: RefObject<HTMLElement | null>
  /** Footer controls, in reading order: the affirmative action goes last. */
  footer?: ReactNode
  /** Work is in flight: the dialog is busy and cannot be dismissed. */
  loading?: boolean
  /** Shown as an inline banner above the footer. The dialog stays open. */
  error?: DialogErrorSpec | null
  children?: ReactNode
  className?: string
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  size = 'md',
  dismissible = true,
  initialFocus,
  footer,
  loading = false,
  error = null,
  children,
  className,
}: DialogProps) {
  const host = useOverlayPortal()
  const titleId = useId()
  const descId = useId()
  /* Nothing dismisses a dialog whose work is still in flight. */
  const canDismiss = dismissible && !loading

  const { phase, requestClose, dialogProps } = useModalDialog({
    open,
    onOpenChange,
    dismissible: canDismiss,
    initialFocus,
    exitMs: 160,
    host,
  })

  if (!host || phase === 'closed') return null

  const dims = SIZE[size]

  return createPortal(
    <dialog
      {...dialogProps}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      aria-busy={loading || undefined}
      className={cn('whetstone-overlay whetstone-dialog', className)}
      style={dims}
    >
      <OverlayStyles />

      <div className="flex min-h-0 grow flex-col">
        <header className="flex items-start gap-sm border-b border-border-hair p-md">
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

          {dismissible ? (
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
          ) : null}
        </header>

        <div className="min-h-0 grow overflow-y-auto p-md" data-scroll-region>
          {children}
        </div>

        {error || footer ? (
          <div className="flex flex-col gap-sm border-t border-border-hair p-md">
            {error ? (
              <Banner variant="danger" title={error.title}>
                {error.body}
              </Banner>
            ) : null}
            {footer ? <div className="flex flex-wrap items-center justify-end gap-md">{footer}</div> : null}
          </div>
        ) : null}
      </div>
    </dialog>,
    host,
  )
}

export default Dialog
