/**
 * Timeline — the version history of a project, and the progress ladder.
 *
 * Server-rendered: it is content, not an interaction, so it ships no JS. The
 * rail is drawn once as a 1px rule and each entry's marker sits on it. The
 * current entry is marked by ink weight and a filled node, never by colour
 * alone, so it survives greyscale.
 */

import { cn } from '@/lib/utils'

export interface TimelineEntry {
  id: string
  /** "v4", "3000", "Shipped" — the short marker on the rail. */
  marker: string
  title: string
  /** Absolute date; the caller formats it. */
  when: string
  body?: React.ReactNode
  state?: 'done' | 'current' | 'open'
}

export interface TimelineProps {
  entries: readonly TimelineEntry[]
  label: string
  className?: string
}

export function Timeline({ entries, label, className }: TimelineProps) {
  return (
    <ol aria-label={label} className={cn('relative flex flex-col', className)}>
      {/* The rail. Decorative: the list semantics already carry the order. */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 start-[11px] w-px bg-rule"
      />
      {entries.map((e) => {
        const state = e.state ?? 'done'
        return (
          <li key={e.id} className="relative flex gap-4 pb-8 last:pb-0">
            <span
              aria-hidden="true"
              className={cn(
                'relative z-[1] mt-1 grid h-8 w-8 flex-none place-items-center rounded-full border-[1.5px] bg-paper',
                state === 'current' ? 'border-ink' : 'border-rule-2',
              )}
            >
              <span
                className={cn(
                  'block h-2 w-2 rounded-full',
                  state === 'done' && 'bg-ink-2',
                  state === 'current' && 'bg-mark',
                  state === 'open' && 'bg-transparent outline outline-1 outline-rule-2',
                )}
              />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="chip tnum">{e.marker}</span>
                <h3 className={cn('text-md', state === 'current' ? 'text-ink' : 'text-ink-2')}>
                  {e.title}
                </h3>
                <span className="text-xs text-ink-3">{e.when}</span>
                {state === 'current' && <span className="sr-only">Current version.</span>}
                {state === 'open' && <span className="sr-only">Not started.</span>}
              </div>
              {e.body ? <div className="voice mt-2">{e.body}</div> : null}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
