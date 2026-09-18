/**
 * The foot of the page: other projects of the same kind, as feed rows.
 *
 * The row is the same object the feed is made of — title, who made it, the ask
 * in the human face, the grit reading and the counts — because a reader who has
 * just learned to read one of these rows should not have to learn a second
 * shape three sections later.
 *
 * Server-safe. Every number is a column on the card, read at render time.
 */

import Link from 'next/link'
import type { ProjectCard } from '@/lib/types'
import { GritReading, plural } from './paper'

export interface RelatedProjectsProps {
  projects: readonly ProjectCard[]
  typeLabel: string
  /** What the creator of each row is asking, keyed by project id. */
  asks: ReadonlyMap<string, string>
  headingId?: string
}

export function RelatedProjects({
  projects,
  typeLabel,
  asks,
  headingId = 'related-heading',
}: RelatedProjectsProps) {
  if (projects.length === 0) return null

  return (
    <section aria-labelledby={headingId}>
      <div className="grid gap-x-16 gap-y-4 pb-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
        <h2 id={headingId} className="text-lg lg:text-xl">
          {`Other ${typeLabel.toLowerCase()} work open for notes.`}
        </h2>
        <p className="voice text-base">
          Reviewing someone else&rsquo;s project is how you get read faster, and these are the ones
          asking the same kind of question.
        </p>
      </div>

      <ul className="m-0 flex list-none flex-col border-t-[1.5px] border-ink p-0">
        {projects.map((card) => {
          const ask = asks.get(card.id)
          return (
            <li key={card.id} className="border-b border-rule">
              <Link href={`/p/${card.slug}`} className="ws-rowlink px-1 py-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2">
                  <span className="text-md font-bold text-ink">{card.title}</span>
                  <GritReading grit={card.grit} />
                </div>
                <p className="mt-1 text-xs text-ink-3">
                  by {card.owner.displayName} · {card.typeLabel}
                </p>
                {ask ? <p className="voice mt-3 text-base italic">{ask}</p> : null}
                <p className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-ink-3">
                  <span className="tnum">
                    {card.counts.reviewers} {plural(card.counts.reviewers, 'reviewer', 'reviewers')}
                  </span>
                  <span className="tnum">
                    {card.counts.feedback} {plural(card.counts.feedback, 'note', 'notes')}
                  </span>
                  {card.counts.shipped > 0 ? (
                    <span className="tnum">
                      {card.counts.shipped} shipped from a note
                    </span>
                  ) : null}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default RelatedProjects
