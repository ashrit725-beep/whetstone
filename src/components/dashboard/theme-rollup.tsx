/**
 * The theme rollup: this surface’s one bold element (§1, “where boldness is
 * spent”, surface 5).
 *
 * Horizontal stacked bars, one per theme, drawn by the `SentimentBar` primitive
 * so every segment carries its own percentage numeral and the legend beneath
 * repeats the word. Desaturate a screenshot and nothing is lost: the split is
 * readable from numerals and words alone (§2.4.8, gate line 32).
 *
 * The bars are grouped by severity, not by tone-of-voice: praise, minor
 * (nit and minor), serious (major and blocker). A creator scanning this is
 * deciding what to fix, and “43% serious” answers that question where “43%
 * negative” does not.
 *
 * Themes come from `src/server/ai/themes.ts`, which clusters with a model when
 * one is configured and with term overlap when none is. Which path ran is
 * printed above the bars, never inferred and never hidden.
 */

import { Quote, Users } from 'lucide-react'
import { Link as UiLink, SentimentBar } from '@/components/ui'
import { themeBoard, type BoardTheme } from '@/server/queries/dashboard'
import { PromoteTheme } from './promote-theme'
import { Provenance } from './provenance'

const WORDS = { positive: 'Praise', neutral: 'Minor', critical: 'Serious' } as const

export interface ThemeRollupProps {
  themes: readonly BoardTheme[]
  projectId: string
  /** Shows the “track this” control. Off on the read-only overview. */
  actionable?: boolean
  /** Cap the list on the overview; the insights page shows everything. */
  limit?: number
}

export function ThemeRollup({
  themes,
  projectId,
  actionable = true,
  limit,
}: ThemeRollupProps) {
  const shown = typeof limit === 'number' ? themes.slice(0, limit) : themes

  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {shown.map((theme) => (
        <li
          key={theme.id}
          className="flex flex-col gap-sm border-t border-border-hair py-lg first:border-t-0 first:pt-0"
        >
          <div className="flex flex-wrap items-start justify-between gap-sm">
            <div className="flex min-w-0 flex-col gap-2xs">
              <h3 className="text-md text-text-1">{theme.label}</h3>
              <p className="measure-ui text-xs text-text-3">{theme.summary}</p>
            </div>
            {actionable ? (
              <PromoteTheme
                projectId={projectId}
                themeLabel={theme.label}
                summary={theme.summary}
                pointIds={theme.pointIds}
                pointCount={theme.pointCount}
                reviewers={theme.reviewers}
              />
            ) : null}
          </div>

          {/* The bar names what it is splitting, not the category: the summary
              line above already says “4 points in UI and HUD, from 4 reviewers”,
              and printing the category twice made the two lines look like the
              same fact stated badly. */}
          <SentimentBar
            label="Severity of these points"
            positive={theme.counts.praise}
            neutral={theme.counts.minor}
            critical={theme.counts.serious}
            unit="points"
            words={WORDS}
          />

          <dl className="m-0 flex flex-wrap items-baseline gap-x-lg gap-y-2xs">
            <div className="flex items-baseline gap-2xs">
              <dt className="text-xs text-text-3">Reviewers</dt>
              <dd className="tnum m-0 flex items-center gap-2xs text-sm text-text-1">
                <Users size={16} strokeWidth={1.5} aria-hidden="true" className="text-text-3" />
                {theme.reviewers.toLocaleString('en')}
              </dd>
            </div>
            <div className="flex items-baseline gap-2xs">
              <dt className="text-xs text-text-3">Impact</dt>
              <dd className="tnum m-0 text-sm text-text-1">
                {theme.impact}
                <span className="text-text-3"> of 100</span>
              </dd>
            </div>
            <div className="flex items-baseline gap-2xs">
              {/* The mean of the points' severities, rounded to the nearest
                  rung. It used to be labelled "worst", which it is not. */}
              <dt className="text-xs text-text-3">Typical severity</dt>
              <dd className="m-0 text-sm text-text-1">{SEVERITY_WORD[theme.meanSeverity]}</dd>
            </div>
            <div className="flex items-baseline gap-2xs">
              <dt className="text-xs text-text-3">Confidence</dt>
              <dd className="m-0 text-sm text-text-1">{CONFIDENCE_WORD[theme.confidence]}</dd>
            </div>
          </dl>

          {theme.quote ? (
            <figure className="m-0 flex flex-col gap-2xs border-s-2 border-border-hair ps-md">
              <Quote size={16} strokeWidth={1.5} aria-hidden="true" className="text-text-3" />
              <blockquote className="m-0">
                <p className="prose-human text-sm">{theme.quote.text}</p>
              </blockquote>
              {/* The attribution opens the whole note in the inbox, so a quote
                  that lands can be read in context and answered. */}
              <figcaption>
                <UiLink
                  variant="quiet"
                  href={`/dashboard/inbox?project=${encodeURIComponent(projectId)}&note=${encodeURIComponent(theme.quote.noteId)}#open-note`}
                  className="text-xs"
                >
                  {`${theme.quote.reviewer}’s note`}
                </UiLink>
              </figcaption>
            </figure>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/**
 * The streaming wrapper. The clustering is awaited here rather than in the page
 * body, which is what lets the page paint its own counts first and the bars
 * arrive into a reserved box (PLAYBOOK, Next.js patterns 6.4).
 */
export async function RollupPane({
  projectId,
  userId,
}: {
  projectId: string
  userId: string
}) {
  const board = await themeBoard(projectId, userId)

  if (board.themes.length === 0) {
    // A model reply with no themes is not allowed to stand for a board unless
    // the local pass agrees, so an empty board means the points do not overlap.
    return (
      <div className="flex flex-col gap-lg">
        <Provenance value={board.provenance} />
        <p className="measure-ui text-sm text-text-2">
          {`None of the ${board.pointCount.toLocaleString('en')} points overlap enough to group yet. They are all in the inbox with their notes, and the first thing two reviewers share will be drawn here.`}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-lg">
      <Provenance value={board.provenance} />
      <ThemeRollup themes={board.themes} projectId={projectId} />
      {board.ungrouped > 0 ? (
        <p className="measure-ui text-xs text-text-3">
          <span className="tnum">{board.ungrouped.toLocaleString('en')}</span>
          <span>
            {board.ungrouped === 1
              ? ' point did not sit with any group, and is in the inbox with its note.'
              : ' points did not sit with any group, and are in the inbox with their notes.'}
          </span>
        </p>
      ) : null}
    </div>
  )
}

const SEVERITY_WORD: Record<BoardTheme['meanSeverity'], string> = {
  blocker: 'Blocker',
  major: 'Major',
  minor: 'Minor',
  nit: 'Nit',
  praise: 'Praise',
}

const CONFIDENCE_WORD: Record<BoardTheme['confidence'], string> = {
  high: 'High, five or more points from three or more people',
  medium: 'Medium, three or more points from two or more people',
  low: 'Low, too few points to be sure',
}

export default ThemeRollup
