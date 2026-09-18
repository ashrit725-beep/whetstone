'use client'

/**
 * Toast + Toaster: for a result the reader cannot see happen.
 *
 * A toast is the wrong tool when the effect is already on screen: a posted
 * comment, a moved row and a saved field say so themselves (contract §5.4,
 * success). Reach for a toast when the work landed somewhere else, or failed.
 *
 * Two live regions, not one: `role="status"` carries info, success and warning
 * politely, and `role="alert"` carries danger assertively. Both exist in the
 * DOM from first paint so a later insertion is actually announced.
 *
 * Keyboard contract:
 *   Tab            reaches the action, then the dismiss button of each toast.
 *   Enter / Space  activate the focused control.
 *   Escape         dismisses the toast that contains focus.
 * The auto-dismiss timer pauses while a pointer is over the stack or focus is
 * inside it, and a toast carrying an action never auto-dismisses at all, so an
 * offered action cannot vanish before it is taken (SC 2.2.1).
 *
 * At most three are stacked. Anything beyond that collapses into one line that
 * says how many are waiting and expands on demand.
 *
 * Motion: opacity plus `translateY(8px → 0)` over 180ms in, 120ms out, and
 * nothing under `prefers-reduced-motion: reduce`.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert, X, type LucideIcon } from 'lucide-react'
import { cn, uid } from '@/lib/utils'
import { Button } from './button'

/* ----------------------------------------------------------------- store -- */

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger'

export interface ToastAction {
  /** A verb phrase. A toast carrying one never auto-dismisses. */
  label: string
  onClick: () => void
}

export interface ToastOptions {
  /** One line. What happened, in the same verb the button used. */
  title: string
  /** Optional second line: the consequence, or what to do next. */
  description?: string
  variant?: ToastVariant
  action?: ToastAction
  /** Milliseconds, or `'persist'` to stay until dismissed. */
  duration?: number | 'persist'
}

interface ToastRecord extends ToastOptions {
  id: string
  variant: ToastVariant
  duration: number | 'persist'
  closing: boolean
}

const DEFAULT_DURATION = 6000
const EXIT_MS = 120

let records: ToastRecord[] = []
const listeners = new Set<() => void>()

function emit() {
  records = [...records]
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getSnapshot(): ToastRecord[] {
  return records
}

const EMPTY: ToastRecord[] = []
function getServerSnapshot(): ToastRecord[] {
  return EMPTY
}

/** Raises a toast. Returns its id, so a long task can dismiss its own notice. */
export function toast(options: ToastOptions): string {
  const id = uid()
  const hasAction = Boolean(options.action)
  records = [
    ...records,
    {
      ...options,
      id,
      variant: options.variant ?? 'info',
      /* An offered action must still be there when the reader reaches for it. */
      duration: hasAction ? 'persist' : (options.duration ?? DEFAULT_DURATION),
      closing: false,
    },
  ]
  emit()
  return id
}

/** Runs the exit animation, then removes the toast. */
export function dismissToast(id: string): void {
  records = records.map((r) => (r.id === id ? { ...r, closing: true } : r))
  emit()
  setTimeout(() => {
    records = records.filter((r) => r.id !== id)
    emit()
  }, EXIT_MS)
}

export function dismissAllToasts(): void {
  for (const record of records) dismissToast(record.id)
}

/* ------------------------------------------------------------------ css --- */

const TOAST_CSS = `
.whetstone-toast-stack {
  position: fixed;
  inset-block-end: 1rem;
  inset-inline-end: 1rem;
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.5rem;
  inline-size: min(calc(100vw - 2rem), 22rem);
  pointer-events: none;
}
.whetstone-toast-stack > * { pointer-events: auto; }
@keyframes whetstone-toast-in  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes whetstone-toast-out { from { opacity: 1; transform: translateY(0); } to { opacity: 0; transform: translateY(8px); } }
@media (prefers-reduced-motion: no-preference) {
  .whetstone-toast[data-state="open"]    { animation: whetstone-toast-in 180ms cubic-bezier(0.16, 1, 0.3, 1); }
  .whetstone-toast[data-state="closing"] { animation: whetstone-toast-out 120ms cubic-bezier(0.4, 0, 1, 1) forwards; }
}
@media (prefers-reduced-motion: reduce) {
  .whetstone-toast { animation: none; }
}
`

const VARIANT: Record<ToastVariant, { icon: LucideIcon; ink: string; edge: string }> = {
  info: { icon: Info, ink: 'text-info', edge: 'border-border-control' },
  success: { icon: CircleCheck, ink: 'text-positive', edge: 'border-positive' },
  warning: { icon: TriangleAlert, ink: 'text-warn', edge: 'border-warn' },
  danger: { icon: CircleAlert, ink: 'text-critical', edge: 'border-critical' },
}

/* ----------------------------------------------------------------- item --- */

function useAutoDismiss(id: string, duration: number | 'persist', paused: boolean) {
  const remaining = useRef(typeof duration === 'number' ? duration : 0)

  useEffect(() => {
    if (duration === 'persist' || paused || remaining.current <= 0) return
    const startedAt = Date.now()
    const timer = setTimeout(() => dismissToast(id), remaining.current)
    return () => {
      clearTimeout(timer)
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt))
    }
  }, [id, duration, paused])
}

function ToastItem({ record, paused }: { record: ToastRecord; paused: boolean }) {
  useAutoDismiss(record.id, record.duration, paused)
  const { icon: Icon, ink, edge } = VARIANT[record.variant]

  return (
    <div
      className={cn(
        'whetstone-toast flex items-start gap-sm rounded-md border bg-surface-4 p-sm shadow-overlay',
        edge,
      )}
      data-state={record.closing ? 'closing' : 'open'}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation()
          dismissToast(record.id)
        }
      }}
    >
      <Icon size={20} strokeWidth={1.5} aria-hidden="true" className={cn('mt-3xs shrink-0', ink)} />

      <div className="track-safe flex min-w-0 grow flex-col gap-2xs">
        <p className="text-sm text-text-1" style={{ fontVariationSettings: '"wdth" 100, "wght" 600' }}>
          {record.title}
        </p>
        {record.description ? <p className="measure-ui text-xs text-text-2">{record.description}</p> : null}
        {record.action ? (
          <span className="mt-2xs inline-flex">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                record.action?.onClick()
                dismissToast(record.id)
              }}
            >
              {record.action.label}
            </Button>
          </span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => dismissToast(record.id)}
        aria-label={`Dismiss the message “${record.title}”`}
        className="tap-44 -m-3xs shrink-0 rounded-sm p-3xs text-text-3 transition-colors duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] hover:text-text-1"
      >
        <X size={16} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}

/* -------------------------------------------------------------- toaster --- */

export interface ToasterProps {
  /** How many toasts stack before the rest collapse into one line. */
  max?: number
}

/**
 * Mount once, near the end of the app shell. Both live regions render even
 * when empty, which is what makes a later insertion announce.
 */
export function Toaster({ max = 3 }: ToasterProps) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [paused, setPaused] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const pause = useCallback(() => setPaused(true), [])
  const resume = useCallback(() => setPaused(false), [])

  /* Newest first: the thing that just happened sits nearest the reader. */
  const ordered = [...items].reverse()
  const limit = expanded ? ordered.length : max
  const shown = ordered.slice(0, limit)
  const hidden = ordered.length - shown.length

  const polite = shown.filter((r) => r.variant !== 'danger')
  const assertive = shown.filter((r) => r.variant === 'danger')

  useEffect(() => {
    if (hidden === 0 && expanded) setExpanded(false)
  }, [hidden, expanded])

  return (
    <div
      className="whetstone-toast-stack"
      onPointerEnter={pause}
      onPointerLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
    >
      <style href="whetstone-toast" precedence="medium">
        {TOAST_CSS}
      </style>

      {hidden > 0 ? (
        <span className="inline-flex self-end">
          <Button size="sm" variant="secondary" aria-expanded={expanded} onClick={() => setExpanded(true)} className="tnum">
            {`+${hidden} more`}
          </Button>
        </span>
      ) : null}

      <div role="alert" aria-live="assertive" className="flex flex-col gap-xs">
        {assertive.map((record) => (
          <ToastItem key={record.id} record={record} paused={paused} />
        ))}
      </div>

      <div role="status" aria-live="polite" className="flex flex-col gap-xs">
        {polite.map((record) => (
          <ToastItem key={record.id} record={record} paused={paused} />
        ))}
      </div>
    </div>
  )
}

export default Toaster
