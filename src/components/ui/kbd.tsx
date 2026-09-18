/**
 * Kbd: a rendered key cap.
 *
 * Keyboard contract: none. A key cap is a label for a shortcut, never a button.
 * If pressing it should do something, ship a real <button> and put the Kbd
 * inside it.
 *
 * Contract note (§3.1): mono type is legal here. `<kbd>` is one of the three
 * places it is allowed to appear.
 */

import { cn } from '@/lib/utils'

export interface KbdProps {
  children: React.ReactNode
  className?: string
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        'inline-flex min-w-md items-center justify-center rounded-xs border border-border-control bg-surface-2 px-2xs py-3xs text-2xs text-text-2',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

export interface KbdSequenceProps {
  /** Keys pressed together, in order, e.g. ['Ctrl', 'K']. */
  keys: readonly string[]
  /** Joiner shown between caps. Defaults to "then" for sequences. */
  chord?: boolean
  className?: string
  /** Accessible sentence. Defaults to a plain reading of the keys. */
  label?: string
}

export function KbdSequence({ keys, chord = true, className, label }: KbdSequenceProps) {
  const spoken = label ?? `${keys.join(chord ? ' plus ' : ' then ')}`
  return (
    <span className={cn('inline-flex items-center gap-2xs', className)}>
      <span className="sr-only">{spoken}</span>
      <span aria-hidden="true" className="inline-flex items-center gap-2xs">
        {keys.map((k, i) => (
          <span key={`${k}-${String(i)}`} className="inline-flex items-center gap-2xs">
            {i > 0 ? (
              <span className="text-2xs text-text-3">{chord ? '+' : 'then'}</span>
            ) : null}
            <Kbd>{k}</Kbd>
          </span>
        ))}
      </span>
    </span>
  )
}
