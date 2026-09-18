/**
 * The dashboard’s only layout chrome: a heading, an optional sentence, and an
 * optional trailing slot, with no border and no fill.
 *
 * This exists so the panes can keep exactly one containment level (§5.2). The
 * table, the empty state and the tracker column each draw their own edge; a
 * bordered wrapper around them would be a box inside a box, which is an
 * auto-fail. Grouping here is done with spacing and a hairline, not a card.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SectionProps {
  title: string
  /** One sentence. Says what the pane is for, not what it is called. */
  lede?: ReactNode
  /** Sits opposite the title: a filter, a count, a provenance line. */
  aside?: ReactNode
  /** Keeps the document outline sequential. */
  level?: 1 | 2 | 3
  id?: string
  children: ReactNode
  className?: string
}

export function Section({
  title,
  lede,
  aside,
  level = 2,
  id,
  children,
  className,
}: SectionProps) {
  const Heading = `h${String(level)}` as 'h1' | 'h2' | 'h3'
  const headingId = id ? `${id}-heading` : undefined

  return (
    <section aria-labelledby={headingId} id={id} className={cn('flex flex-col gap-md', className)}>
      <div className="flex flex-wrap items-end justify-between gap-sm">
        <div className="flex min-w-0 flex-col gap-2xs">
          <Heading id={headingId}>{title}</Heading>
          {lede ? <p className="measure-ui text-sm text-text-2">{lede}</p> : null}
        </div>
        {aside ? <div className="flex shrink-0 items-center gap-xs">{aside}</div> : null}
      </div>
      {children}
    </section>
  )
}

/** The page title block. One h1 per route, with the lede under it. */
export function PageHeader({
  title,
  lede,
  aside,
}: {
  title: string
  lede?: ReactNode
  aside?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-sm border-b border-border-hair pb-md">
      <div className="flex min-w-0 flex-col gap-2xs">
        <h1>{title}</h1>
        {lede ? <p className="measure-ui text-sm text-text-2">{lede}</p> : null}
      </div>
      {aside ? <div className="flex shrink-0 flex-wrap items-center gap-xs">{aside}</div> : null}
    </header>
  )
}

export default Section
