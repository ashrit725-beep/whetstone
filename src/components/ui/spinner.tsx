'use client'

/**
 * Spinner: the last-resort loading indicator.
 *
 * Prefer a geometry-matched skeleton. Reach for this only where the shape of
 * the result is unknowable (a button in flight, an async menu item).
 *
 * Keyboard contract: none. The spinner is not focusable. It is `aria-hidden`
 * unless you pass `label`, which you must do when it is the only thing on
 * screen saying that work is in flight.
 *
 * Timing: `useDelayedLoading` holds the spinner back 150ms so fast responses
 * never flash one, then keeps it up for at least 300ms so it never strobes
 * (contract §5.4).
 *
 * Recorded deviation (contract §6.1, the 400ms ceiling): one revolution takes
 * 640ms, and 1200ms under reduced motion. §6.4 keeps functional loading motion
 * running; a sub-400ms revolution reads as a flicker rather than as progress.
 */

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const SPINNER_CSS = `
@keyframes whetstone-spinner-turn { to { transform: rotate(360deg); } }
.whetstone-spinner-track { color: var(--color-border-control); }
.whetstone-spinner-head { color: currentColor; transform-origin: 50% 50%; }
@media (prefers-reduced-motion: no-preference) {
  .whetstone-spinner-head { animation: whetstone-spinner-turn 640ms linear infinite; }
}
@media (prefers-reduced-motion: reduce) {
  /* The global reset collapses every duration to 0.01ms. A loading indicator is
     functional motion (§6.4), so it keeps turning, slower. */
  .whetstone-spinner-head {
    animation: whetstone-spinner-turn 1200ms linear infinite;
    animation-duration: 1200ms !important;
  }
}
`

const SIZES = { 16: 16, 20: 20, 24: 24 } as const

export interface SpinnerProps {
  size?: keyof typeof SIZES
  /**
   * Announce the spinner. Set this when the spinner is the only loading signal
   * on screen; leave it off when a skeleton or a label already says so.
   */
  label?: string
  className?: string
}

export function Spinner({ size = 16, label, className }: SpinnerProps) {
  const px = SIZES[size]
  const r = px / 2 - 1.5
  const c = 2 * Math.PI * r

  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
      {...(label ? { role: 'status', 'aria-live': 'polite' } : { 'aria-hidden': 'true' })}
    >
      <style href="whetstone-spinner" precedence="medium">
        {SPINNER_CSS}
      </style>
      <svg width={px} height={px} viewBox={`0 0 ${px} ${px}`} fill="none" aria-hidden="true" focusable="false">
        <circle
          className="whetstone-spinner-track"
          cx={px / 2}
          cy={px / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={1.5}
        />
        <circle
          className="whetstone-spinner-head"
          cx={px / 2}
          cy={px / 2}
          r={r}
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={`${(c * 0.28).toFixed(2)} ${(c * 0.72).toFixed(2)}`}
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  )
}

export interface DelayedLoadingOptions {
  /** Hold the indicator back this long so quick work never flashes one. */
  delayMs?: number
  /** Once shown, keep it up at least this long. */
  minVisibleMs?: number
}

/**
 * Returns whether a loading indicator should be on screen right now.
 *
 *   const busy = useDelayedLoading(isPending)
 *   {busy ? <Spinner label="Posting feedback…" /> : null}
 */
export function useDelayedLoading(active: boolean, options: DelayedLoadingOptions = {}): boolean {
  const { delayMs = 150, minVisibleMs = 300 } = options
  const [visible, setVisible] = useState(false)
  const shownAt = useRef<number | null>(null)

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | undefined
    let hideTimer: ReturnType<typeof setTimeout> | undefined

    if (active) {
      showTimer = setTimeout(() => {
        shownAt.current = Date.now()
        setVisible(true)
      }, delayMs)
    } else if (shownAt.current !== null) {
      const elapsed = Date.now() - shownAt.current
      const remaining = Math.max(0, minVisibleMs - elapsed)
      hideTimer = setTimeout(() => {
        shownAt.current = null
        setVisible(false)
      }, remaining)
    } else {
      setVisible(false)
    }

    return () => {
      if (showTimer) clearTimeout(showTimer)
      if (hideTimer) clearTimeout(hideTimer)
    }
  }, [active, delayMs, minVisibleMs])

  return visible
}

export default Spinner
