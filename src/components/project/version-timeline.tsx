/**
 * The build history, and the one thing a returning reviewer needs from it:
 * what changed since the build they reviewed.
 *
 * Server-safe. Rows, not cards: one hairline between builds, the current one
 * carrying the grind-mark on its leading edge and `aria-current`.
 */

import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { Prose, Timestamp } from '@/components/ui'
import { cn, safeHref } from '@/lib/utils'
import type { ReviewStamp, VersionTimelineEntry } from '@/server/queries/project-surface'

export interface VersionTimelineProps {
  versions: readonly VersionTimelineEntry[]
  stamp: ReviewStamp | undefined
  slug: string
}

export function VersionTimeline({ versions, stamp, slug }: VersionTimelineProps) {
  const reviewedIndex = stamp?.versionId ? versions.findIndex((v) => v.id === stamp.versionId) : -1
  const since = reviewedIndex > 0 ? versions.slice(0, reviewedIndex) : []

  return (
    <div className="flex flex-col gap-8">
      {stamp && since.length > 0 ? (
        <section aria-labelledby="since-heading" className="flex flex-col gap-3">
          <h2 id="since-heading" className="text-lg">
            What changed since your review
          </h2>
          <p className="measure-ui text-sm text-ink-2">
            You reviewed {stamp.versionLabel ?? 'an earlier build'}. There{' '}
            {since.length === 1 ? 'has been one build' : `have been ${since.length} builds`} since, and this is what
            the creator says moved. Re-reviewing from here costs a fraction of the first pass.
          </p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {since.map((version) => (
              <li key={version.id} className="flex flex-col gap-1 border-l-2 border-rule pl-3">
                <p className="text-sm text-ink">{version.label}</p>
                {version.changelogMd ? (
                  <Prose content={version.changelogMd} allow="comment" />
                ) : (
                  <p className="text-xs text-ink-3">No changelog on this build.</p>
                )}
              </li>
            ))}
          </ul>
          <a className="ws-scaffold w-fit text-sm" href={`/p/${slug}/feedback`}>
            Review the current build
          </a>
        </section>
      ) : null}

      <section aria-labelledby="builds-heading" className="flex flex-col gap-8">
        <div className="grid gap-x-16 gap-y-4 lg:grid-cols-[1.1fr_1fr] lg:items-end">
          <h2 id="builds-heading" className="max-w-[18ch] text-lg lg:text-xl">
            {versions.length === 1
              ? 'One build, and what it was reviewed against.'
              : `${String(versions.length)} builds, newest first.`}
          </h2>
          <p className="voice text-base">
            A note is written against a build and stays attached to it after the next one ships, so
            an old objection never quietly becomes a current one.
          </p>
        </div>

        <ul className="m-0 flex list-none flex-col p-0">
          {versions.map((version, index) => {
            const reviewedThis = stamp?.versionId === version.id
            return (
              <li
                key={version.id}
                aria-current={version.isCurrent ? 'true' : undefined}
                // Every row carries the 2px leading border and only its colour
                // changes (§5.2), so the grind-mark costs no indent and the
                // column of build titles shares one left edge. The utility form
                // pairs the mark with padding, which pushed the current build
                // 16px right of every other build in the same list.
                className={cn(
                  'relative flex flex-col gap-3 border-l-2 py-6 pl-3',
                  // Per-edge colours, never the shorthand: `border-rule`
                  // would repaint the leading edge too and eat the mark.
                  index > 0 && 'border-t border-t-rule',
                  version.isCurrent ? 'border-l-ink' : 'border-l-transparent',
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="text-md">{version.label}</h3>
                  {version.isCurrent ? <span className="chip" data-solid="true">Current build</span> : null}
                  {reviewedThis ? <span className="chip">You reviewed this one</span> : null}
                  <span className="grow" />
                  <span className="text-xs text-ink-3">
                    <Timestamp ts={version.releasedAt ?? version.createdAt} prefix="Posted" />
                  </span>
                </div>

                {/* Prose keeps its own measure on the left; the counts stack into
                    the gutter the wide viewport hands us instead of leaving it
                    empty and running the changelog out to 100 characters. */}
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-x-6">
                  <div className="track-safe flex flex-col gap-3">
                    {version.changelogMd ? <Prose content={version.changelogMd} allow="comment" /> : null}

                    {version.updates.length > 0 ? (
                      <ul className="m-0 flex list-none flex-col gap-3 border-l-2 border-rule p-0 pl-3">
                        {version.updates.map((update) => (
                          <li key={update.id} className="flex flex-col gap-1">
                            <p className="text-sm text-ink">{update.title}</p>
                            <Prose content={update.bodyMd} allow="comment" />
                            <p className="text-xs text-ink-3">
                              {update.authorName}
                              {update.publishedAt ? (
                                <>
                                  {', '}
                                  <Timestamp ts={update.publishedAt} />
                                </>
                              ) : null}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>

                  <div className="track-safe flex flex-col gap-3">
                    <dl className="m-0 flex flex-wrap gap-x-6 gap-y-1 lg:flex-col lg:gap-y-2">
                      <Pair label="Notes" value={version.feedbackCount} />
                      <Pair label="Reviewers" value={version.reviewerCount} />
                      <Pair label="Blockers" value={version.blockerCount} />
                      {version.platforms.length > 0 ? (
                        <div className="flex items-baseline gap-1">
                          <dt className="text-2xs text-ink-3">Platforms</dt>
                          <dd className="m-0 text-sm text-ink-2">{version.platforms.join(', ')}</dd>
                        </div>
                      ) : null}
                    </dl>

                    {/* The link narrows the thread to this build; a build nobody
                        has written against gets a sentence, not a link to an
                        empty list. */}
                    {version.feedbackCount === 0 ? (
                      <p className="text-xs text-ink-3">No notes against this build yet</p>
                    ) : (
                      // `.link` and `tap-44`, not `ws-area-link`: that class is
                      // the sort strip's, where its 44px box *is* the row and
                      // the inset shadow is a tab rule. In a `w-fit` metadata
                      // stack the two come apart and the rule orphans 12px
                      // below the text, as wide as the label.
                      <Link
                        className="link tap-44 w-fit text-sm"
                        href={`/p/${slug}?sort=newest&build=${encodeURIComponent(version.id)}#thread`}
                      >
                        {`Read the ${String(version.feedbackCount)} ${version.feedbackCount === 1 ? 'note' : 'notes'} against it`}
                      </Link>
                    )}

                    {safeHref(version.buildUrl) ? (
                      <a
                        className="ws-scaffold w-fit gap-1 text-sm"
                        href={safeHref(version.buildUrl) ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink size={16} strokeWidth={1.5} aria-hidden="true" />
                        Open {version.label}
                        <span className="sr-only">(opens in a new tab)</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}

function Pair({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <dt className="text-2xs text-ink-3">{label}</dt>
      <dd className="tnum m-0 text-sm text-ink">{value}</dd>
    </div>
  )
}

export default VersionTimeline
