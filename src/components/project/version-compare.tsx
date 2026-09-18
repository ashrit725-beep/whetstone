/**
 * Two builds, side by side.
 *
 * The question this answers is the one a returning reviewer actually has: I
 * reviewed the last build, what is different in this one. So the two sides are
 * labelled with the creator's own build names, never "before" and "after", and
 * each panel carries the facts that decide whether it is worth looking again:
 * what the creator said changed, how many people have reported against it, and
 * how many of those were blockers.
 *
 * Two columns, not a wipe. A wipe slider is for two pictures of the same frame;
 * over two panels of reflowing text it clipped the current build's changelog
 * out of view and, on a phone, stitched one build's note count to the other's
 * blockers in a single row. Each build's facts stay in that build's panel.
 * Below 60rem the panels stack, earlier above current.
 *
 * Server-safe. Nothing here is interactive.
 */

import { Prose } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { VersionTimelineEntry } from '@/server/queries/project-surface'

export interface VersionCompareProps {
  previous: VersionTimelineEntry
  current: VersionTimelineEntry
}

export function VersionCompare({ previous, current }: VersionCompareProps) {
  return (
    <section aria-labelledby="compare-heading" className="flex flex-col gap-6">
      <div>
        <p className="eyebrow text-ink-3">What changed</p>
        <h2 id="compare-heading" className="mt-3 text-lg text-ink">
          {`${previous.label} against ${current.label}`}
        </h2>
        <p className="voice mt-3 text-voice">
          {`If you reviewed ${previous.label}, this is what moved.`}
        </p>
      </div>

      <div className="grid border-[1.5px] border-ink md:grid-cols-2">
        <Panel entry={previous} className="bg-paper-sub" />
        <Panel entry={current} className="border-t border-rule bg-paper-hi md:border-t-0 md:border-l" />
      </div>
    </section>
  )
}

function Panel({ entry, className }: { entry: VersionTimelineEntry; className: string }) {
  const changed = entry.changelogMd?.trim() ?? ''
  return (
    <div className={cn('flex min-w-0 flex-col gap-6 p-6', className)}>
      <div>
        <p className="eyebrow text-ink-3">{entry.isCurrent ? 'Current build' : 'Earlier build'}</p>
        <p className="mt-2 text-md font-bold text-ink">{entry.label}</p>
      </div>

      <div className="track-safe flex-1 text-sm">
        {changed.length > 0 ? (
          <Prose content={changed} allow="comment" />
        ) : (
          <p className="text-ink-3">The creator did not write a changelog for this build.</p>
        )}
      </div>

      <dl className="m-0 grid grid-cols-3 gap-4 border-t border-rule pt-4">
        <Fact label="Notes" value={entry.feedbackCount} />
        <Fact label="Reviewers" value={entry.reviewerCount} />
        <Fact label="Blockers" value={entry.blockerCount} />
      </dl>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0">
      <dt className="eyebrow text-ink-3">{label}</dt>
      <dd className="tnum m-0 mt-1 text-md font-bold text-ink">{value}</dd>
    </div>
  )
}

export default VersionCompare
