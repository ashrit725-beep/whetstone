'use client'

/**
 * CopyButton: puts a string on the clipboard and says so.
 *
 * Keyboard contract: a real <button>. Tab reaches it, Enter and Space activate
 * it. The result is announced through a polite live region rather than a toast,
 * because the effect is invisible and off-screen toasts for a local action are
 * noise (§5.4 success, §8.4.46).
 *
 * States: default, hover, focus-visible (the global ring), active, disabled
 * with a stated reason, in-flight (`aria-busy`), error (the clipboard can be
 * blocked by permissions, so that path is real), and success.
 */

import { useEffect, useRef, useState } from 'react'
import { Check, Copy, CircleAlert } from 'lucide-react'
import { cn, slugify } from '@/lib/utils'

type CopyState = 'idle' | 'copying' | 'copied' | 'error'

export interface CopyButtonProps {
  /** The exact text to copy. */
  value: string
  /** Names what is being copied, e.g. "the embed URL". */
  what: string
  /** Icon-only keeps the label off screen but never off the accessibility tree. */
  iconOnly?: boolean
  disabled?: boolean
  disabledReason?: string
  className?: string
}

export function CopyButton({
  value,
  what,
  iconOnly = false,
  disabled = false,
  disabledReason,
  className,
}: CopyButtonProps) {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current)
    },
    [],
  )

  async function copy() {
    if (disabled || state === 'copying') return
    setState('copying')
    try {
      await navigator.clipboard.writeText(value)
      setState('copied')
    } catch {
      setState('error')
    }
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      setState('idle')
    }, 2400)
  }

  const reasonId = `copy-${slugify(what)}-reason`
  const Icon = state === 'copied' ? Check : state === 'error' ? CircleAlert : Copy
  const word = state === 'copied' ? 'Copied' : state === 'error' ? 'Copy blocked' : 'Copy'

  return (
    <span className={cn('inline-flex items-center gap-2xs', className)}>
      <button
        type="button"
        onClick={() => {
          void copy()
        }}
        aria-disabled={disabled || undefined}
        aria-busy={state === 'copying' || undefined}
        aria-label={iconOnly ? `Copy ${what}` : undefined}
        aria-describedby={disabled && disabledReason ? reasonId : undefined}
        className={cn(
          'inline-flex min-h-2xl items-center gap-2xs rounded-sm border px-sm text-sm transition-[background-color,border-color,color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
          state === 'error'
            ? 'border-critical bg-surface-2 text-critical'
            : 'border-border-control bg-surface-2 text-text-2',
          disabled
            ? 'cursor-not-allowed border-border-hair text-text-disabled'
            : 'hover:border-border-strong hover:bg-surface-3 hover:text-text-1 active:translate-y-px',
        )}
      >
        <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
        {iconOnly ? null : <span>{word}</span>}
      </button>

      {/* Announced, not shown twice. */}
      <span role="status" aria-live="polite" className="sr-only">
        {state === 'copied' ? `${what} copied to the clipboard.` : null}
        {state === 'error'
          ? `The clipboard is blocked in this browser, so ${what} was not copied. Select the text and copy it yourself.`
          : null}
      </span>

      {state === 'error' && !iconOnly ? (
        <span className="measure-ui text-xs text-critical">
          The clipboard is blocked in this browser. Select the text and copy it yourself.
        </span>
      ) : null}

      {disabled && disabledReason ? (
        <span id={reasonId} className="text-xs text-text-3">
          {disabledReason}
        </span>
      ) : null}
    </span>
  )
}
