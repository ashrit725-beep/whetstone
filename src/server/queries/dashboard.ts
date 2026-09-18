/**
 * Reads the creator dashboard needs that the repository layer does not already
 * expose, plus the two AI-backed rollups.
 *
 * Nothing here writes. The SQL below is week-over-week arithmetic the repos do
 * not carry (design/REPOS.md §13 lists it as a gap); every other figure comes
 * from `src/server/repos/*`.
 *
 * One clustering, two views. The inbox groups reviews by theme and the rollup
 * draws the same themes as bars, so a creator never sees two disagreeing
 * groupings of one project. `themeBoard` is wrapped in React's `cache`, so both
 * panes on one page share a single run.
 */

import { cache } from 'react'
import { after } from 'next/server'
import { aiAvailability } from '@/lib/env'
import { FEATURE_POLICY } from '@/server/ai/config'
import { all } from '@/server/db/client'
import { digest as digestFeature, themes as themesFeature } from '@/server/ai'
import type { AiResult, FeedbackInput, ReviewerTier } from '@/server/ai'
import { METRIC_LABEL, type Digest, type DigestTheme, type MetricKey } from '@/server/ai/digest'
import type { Theme, ThemeReport } from '@/server/ai/schemas'
import { isProjectType } from '@/server/ai/taxonomy'
import { categoriesFor } from '@/lib/taxonomy'
import { listInboxFeedback } from '@/server/repos/feedback'
import { listMyProjects } from '@/server/repos/projects'
import { getSuggestionCounts, listSuggestions } from '@/server/repos/suggestions'
import type {
  FeedbackView,
  Millis,
  ProjectOwnerRow,
  ReputationTierKey,
  SeverityKey,
  SuggestionView,
  UserCard,
} from '@/lib/types'

/* -------------------------------------------------------------------------- *
 * Scope: which project the creator is looking at
 * -------------------------------------------------------------------------- */

export interface OwnedProject extends ProjectOwnerRow {
  /** The taxonomy slug, which `ProjectOwnerRow` does not carry. */
  readonly typeSlug: string
}

export interface CreatorScope {
  readonly userId: string
  readonly projects: readonly OwnedProject[]
  /** Null when the creator picked “All projects”, or owns none. */
  readonly project: OwnedProject | null
  /** True when the creator asked for every project at once. */
  readonly allProjects: boolean
}

const typeSlugs = cache((): ReadonlyMap<string, string> => {
  const rows = all<{ id: string; type_slug: string }>(
    `SELECT p.id AS id, pt.slug AS type_slug
       FROM projects p JOIN project_types pt ON pt.id = p.project_type_id`,
  )
  return new Map(rows.map((r) => [r.id, r.type_slug]))
})

/** When the latest note on each of a creator's projects was submitted. */
const latestNoteAt = cache((userId: string): ReadonlyMap<string, number> => {
  const rows = all<{ project_id: string; at: number }>(
    `SELECT f.project_id AS project_id, MAX(f.submitted_at) AS at
       FROM feedback f JOIN projects p ON p.id = f.project_id
      WHERE p.owner_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
      GROUP BY f.project_id`,
    [userId],
  )
  return new Map(rows.map((r) => [r.project_id, r.at]))
})

/**
 * Resolves `?project=`. An unknown id falls back to the default project rather
 * than erroring: a stale bookmark should still land somewhere useful.
 *
 * The default is the project a note last arrived on, because every page here
 * opens on this week. It used to be the one with the most unread notes, which
 * picked a project last reviewed seven months ago over one reviewed yesterday,
 * so the week strip read zero across the board beside a register of new notes.
 */
export const creatorScope = cache((userId: string, param: string | undefined): CreatorScope => {
  const slugs = typeSlugs()
  const projects = listMyProjects(userId, { limit: 50 }).map(
    (p): OwnedProject => ({ ...p, typeSlug: slugs.get(p.id) ?? 'game' }),
  )
  if (projects.length === 0) return { userId, projects, project: null, allProjects: false }
  if (param === 'all') return { userId, projects, project: null, allProjects: true }
  const picked = param ? projects.find((p) => p.id === param) : undefined
  const latest = latestNoteAt(userId)
  const recent = [...projects].sort(
    (a, b) =>
      (latest.get(b.id) ?? 0) - (latest.get(a.id) ?? 0) ||
      b.counts.unread - a.counts.unread ||
      b.updatedAt - a.updatedAt,
  )[0]
  return { userId, projects, project: picked ?? recent ?? null, allProjects: false }
})

/**
 * Suggestions in the tracker's Open column (open and under review), per
 * project, for the rail. The same statuses and the same filter as
 * `getSuggestionCounts`, grouped once rather than queried per project.
 */
export function openSuggestionsByProject(userId: string): ReadonlyMap<string, number> {
  const rows = all<{ project_id: string; n: number }>(
    `SELECT s.project_id AS project_id, COUNT(*) AS n
       FROM suggestions s JOIN projects p ON p.id = s.project_id
      WHERE p.owner_id = ? AND p.deleted_at IS NULL AND s.status IN ('open', 'under_review')
      GROUP BY s.project_id`,
    [userId],
  )
  return new Map(rows.map((r) => [r.project_id, r.n]))
}

/* -------------------------------------------------------------------------- *
 * The theme board: one clustering, shared by the inbox and the rollup
 * -------------------------------------------------------------------------- */

export type ThemeTone = 'praise' | 'problem' | 'request' | 'mixed'

export interface BoardTheme {
  readonly id: string
  readonly label: string
  readonly summary: string
  readonly categoryKey: string
  readonly categoryLabel: string
  readonly sentiment: ThemeTone
  readonly impact: number
  readonly reviewers: number
  readonly meanSeverity: SeverityKey
  readonly reason: string
  readonly confidence: 'low' | 'medium' | 'high'
  /** Severity split of the points in this theme, for the stacked bar. */
  readonly counts: { readonly praise: number; readonly minor: number; readonly serious: number }
  readonly pointCount: number
  /**
   * When the oldest unresolved point in this theme was submitted, or null when
   * every point is resolved. What makes a theme open, as of any moment.
   */
  readonly openSince: Millis | null
  readonly pointIds: readonly string[]
  /** A verbatim quote, who wrote it, and the note it came from. */
  readonly quote: { readonly text: string; readonly reviewer: string; readonly noteId: string } | null
}

export interface Provenance {
  readonly source: 'ai' | 'cached' | 'heuristic'
  /** What actually produced this, said plainly. */
  readonly label: string
  readonly detail: string
  readonly model: string | undefined
  readonly generatedAt: string
}

export interface ThemeBoard {
  readonly themes: readonly BoardTheme[]
  /** Notes read. A note is one review; it carries one or more points. */
  readonly noteCount: number
  /** Points clustered, which is not the number of notes: one note carries several. */
  readonly pointCount: number
  readonly ungrouped: number
  /**
   * False below `THEME_FLOOR` notes, where nothing is grouped at all. Every
   * surface reads this one flag, so the overview can no longer rank groups
   * over four notes while Insights says there are too few to find any.
   */
  readonly enoughNotes: boolean
  readonly provenance: Provenance
  /** point id → theme id, so the inbox can group the same way. */
  readonly themeOfPoint: ReadonlyMap<string, string>
}

/** Below this many notes a clustering is noise dressed as insight. */
export const THEME_FLOOR = 5

/**
 * The one definition of an open theme, shared by the week strip, the brief and
 * the board: something to fix, with at least one point on it still unresolved.
 * Pass `at` to ask what was open at the end of an earlier window.
 */
export function themeIsOpen(theme: BoardTheme, at: Millis = Number.POSITIVE_INFINITY): boolean {
  return theme.sentiment !== 'praise' && theme.openSince !== null && theme.openSince <= at
}

/** A background brief gets three times this before it is abandoned. */
const DIGEST_DEADLINE_MS = 20_000

function tierOf(card: UserCard): ReviewerTier {
  if (card.isExpert) return 'expert'
  const map: Record<ReputationTierKey, ReviewerTier> = {
    new: 'new',
    contributor: 'established',
    trusted: 'trusted',
    signal: 'trusted',
    sharpener: 'expert',
  }
  return map[card.tier]
}

/** Every point of every submitted review, as the AI layer sees it. */
function toItems(rows: readonly FeedbackView[]): readonly FeedbackInput[] {
  const items: FeedbackInput[] = []
  for (const row of rows) {
    for (const point of row.points) {
      items.push({
        id: point.id,
        reviewerId: row.reviewer.id,
        reviewerTier: tierOf(row.reviewer),
        categoryKey: point.categoryKey,
        text: point.bodyMd,
        severity: point.severity,
        createdAt: point.createdAt,
      })
    }
  }
  return items
}

const SEVERITY_BUCKET: Record<SeverityKey, 'praise' | 'minor' | 'serious'> = {
  praise: 'praise',
  nit: 'minor',
  minor: 'minor',
  major: 'serious',
  blocker: 'serious',
}

function provenanceOf(result: AiResult<unknown>, pending = false): Provenance {
  if (result.source === 'heuristic') {
    return {
      source: 'heuristic',
      label: 'Clustered locally',
      detail: pending
        ? 'Grouped on this server by term overlap for now. A model is grouping the same points; reload in a minute or two for its version.'
        : 'Grouped on this server by term overlap inside each category, with no model involved.',
      model: undefined,
      generatedAt: result.generatedAt,
    }
  }
  return {
    source: result.source,
    // The provider chain is Anthropic, then OpenAI, then Kimi, and any of them
    // may be the one that answered. FEATURE_POLICY carries the vendor-neutral
    // wording; naming a model the product cannot prove wrote it is a claim.
    label: result.source === 'cached'
      ? `${FEATURE_POLICY.themes.aiLabel}, reused`
      : FEATURE_POLICY.themes.aiLabel,
    detail:
      result.source === 'cached'
        ? result.stale
          ? pending
            ? `From the last model run. ${String(result.stale.newItemsSince)} newer ${result.stale.newItemsSince === 1 ? 'point is' : 'points are'} being grouped now; reload in a minute or two to see where they land.`
            : `From the last model run. ${String(result.stale.newItemsSince)} newer ${result.stale.newItemsSince === 1 ? 'point is' : 'points are'} not in it yet.`
          : 'Reused from the last run over these points. Nothing has changed since.'
        : 'Grouped by a model, then checked against the points it quoted.',
    model: result.model,
    generatedAt: result.generatedAt,
  }
}

/** What the board needs to know about each point beyond what the AI layer sees. */
interface PointFacts {
  readonly reviewer: string
  /** The note the point sits in. */
  readonly noteId: string
  /** When the note carrying the point was submitted. */
  readonly submittedAt: Millis
  readonly resolved: boolean
}

function buildBoard(
  report: ThemeReport,
  items: readonly FeedbackInput[],
  noteCount: number,
  labelOf: (key: string) => string,
  facts: ReadonlyMap<string, PointFacts>,
  provenance: Provenance,
): ThemeBoard {
  const byId = new Map(items.map((item) => [item.id, item]))
  const themeOfPoint = new Map<string, string>()
  const themes: BoardTheme[] = []

  for (const theme of report.themes) {
    const members = theme.memberFeedbackIds
      .map((id) => byId.get(id))
      .filter((item): item is FeedbackInput => item !== undefined)
    if (members.length === 0) continue
    const counts = { praise: 0, minor: 0, serious: 0 }
    let openSince: Millis | null = null
    for (const member of members) {
      themeOfPoint.set(member.id, theme.id)
      counts[SEVERITY_BUCKET[member.severity]] += 1
      const fact = facts.get(member.id)
      if (fact && !fact.resolved && (openSince === null || fact.submittedAt < openSince)) {
        openSince = fact.submittedAt
      }
    }
    themes.push({
      id: theme.id,
      label: theme.label,
      summary: wholeSentences(theme.summary),
      categoryKey: theme.categoryKey,
      categoryLabel: labelOf(theme.categoryKey),
      sentiment: theme.sentiment,
      impact: theme.impact.score,
      reviewers: theme.impact.distinctReviewers,
      meanSeverity: theme.impact.meanSeverity,
      reason: theme.impact.reason,
      // Measured here as well as in `themes.ts`, so a board stored before the
      // model's own grade was replaced cannot print "High, five or more points
      // from three or more people" over two points.
      confidence: themesFeature.confidenceFor(members),
      counts,
      pointCount: members.length,
      openSince,
      pointIds: members.map((m) => m.id),
      quote: quoteOf(theme, facts),
    })
  }

  themes.sort((a, b) => b.impact - a.impact || (a.id < b.id ? -1 : 1))
  return {
    themes,
    noteCount,
    pointCount: items.length,
    ungrouped: items.length - themeOfPoint.size,
    enoughNotes: noteCount >= THEME_FLOOR,
    provenance,
    themeOfPoint,
  }
}

/**
 * A summary that stops on a sentence. Providers that enforce the schema's
 * length while generating stop wherever the limit falls, so a stored summary
 * could end "…clarify numeral," mid-clause. It is cut back to its last whole
 * sentence when that keeps most of it, and otherwise marked as cut.
 */
function wholeSentences(text: string): string {
  const t = text.trim()
  if (t.length === 0 || /[.!?…"”')]$/u.test(t)) return t
  const end = Math.max(t.lastIndexOf('. '), t.lastIndexOf('? '), t.lastIndexOf('! '))
  if (end >= t.length * 0.5) return t.slice(0, end + 1)
  return `${t.replace(/[\s,;:–—-]+$/u, '')}…`
}

function quoteOf(theme: Theme, facts: ReadonlyMap<string, PointFacts>): BoardTheme['quote'] {
  const first = theme.quotes[0]
  const fact = first ? facts.get(first.feedbackId) : undefined
  if (!first || !fact) return null
  return { text: first.text, reviewer: fact.reviewer, noteId: fact.noteId }
}

/**
 * The clustering: the stored model board for these points, the last model
 * board with a count of what arrived since, or the deterministic clusterer,
 * which is real output rather than a placeholder. The path taken is reported,
 * never hidden. One call per project per request, whichever panel asks first.
 */
export const themeBoard = cache(
  async (projectId: string, userId: string): Promise<ThemeBoard> => {
    const page = listInboxFeedback(userId, { projectId, limit: 100 })
    const items = toItems(page.items)
    const facts = new Map<string, PointFacts>()
    for (const row of page.items) {
      for (const point of row.points) {
        facts.set(point.id, {
          reviewer: row.reviewer.displayName,
          noteId: row.id,
          submittedAt: row.submittedAt ?? point.createdAt,
          resolved: point.isResolved,
        })
      }
    }

    const first = page.items[0]
    const typeSlug = first?.typeSlug ?? typeSlugs().get(projectId) ?? 'game'
    const categories = categoriesFor(typeSlug).map((c) => ({ key: c.key, label: c.label }))
    const labelOf = (key: string): string =>
      categories.find((c) => c.key === key)?.label ?? key.replace(/[_-]+/g, ' ')

    const input = {
      projectId,
      ...(isProjectType(typeSlug) ? { projectType: typeSlug } : {}),
      categories,
      items,
    }

    // Below the floor nothing is grouped, by a model or locally, and nothing
    // is paid for. It is counted in notes, as Insights counts it: counted in
    // points, a project with four notes and eleven points had its local groups
    // ranked on the overview, and a model run started for it, while Insights
    // said four notes were too few to group.
    if (page.items.length < THEME_FLOOR) {
      const empty: ThemeReport = { themes: [], unclustered: items.map((item) => item.id) }
      return buildBoard(empty, items, page.items.length, labelOf, facts, {
        source: 'heuristic',
        label: 'Not grouped yet',
        detail: `Themes start at ${String(THEME_FLOOR)} notes. Until then every note is listed on its own.`,
        model: undefined,
        generatedAt: new Date().toISOString(),
      })
    }

    // A render never waits on a model. Clustering a project's notes takes a
    // model thirty seconds or more; this used to start that call with a three-
    // or eight-second deadline, abort it, pay for the tokens so far and show
    // the local board, on every visit, so the model board never arrived at all.
    // Now the render answers from what is known and the model run happens
    // after the response, with its full deadline. The next visit shows it.
    const result = await themesFeature.generate(input, { skipModel: true, userId })
    const settled = result.source === 'ai' || (result.source === 'cached' && !result.stale && !result.degraded)
    const pending = !settled && aiAvailability().any && scheduleThemeRun(input, userId)
    return buildBoard(result.data, items, page.items.length, labelOf, facts, provenanceOf(result, pending))
  },
)

/**
 * Background model runs this server has in flight, and when each last started.
 *
 * Kept on `globalThis`, not in module scope. A server can hold more than one
 * copy of this module (the dev server loads a fresh one on every edit, and can
 * bundle it per route), and each copy had its own empty set: `ai_run` shows
 * four paid clustering runs over one project inside ten seconds where the
 * guard allowed one. One registry per process is what it always assumed.
 */
interface RunRegistry {
  readonly inFlight: Set<string>
  readonly startedAt: Map<string, number>
}

const RUNS = Symbol.for('whetstone.dashboard.background-runs')

function runRegistry(): RunRegistry {
  const host = globalThis as typeof globalThis & { [RUNS]?: RunRegistry }
  host[RUNS] ??= { inFlight: new Set(), startedAt: new Map() }
  return host[RUNS]
}

/**
 * Starts `work` after the response unless a run under `key` is in flight or
 * started within `cooldownMs`. True when a run is in flight once this returns,
 * which is what lets a panel say its fuller version is on the way.
 */
function startBackgroundRun(key: string, cooldownMs: number, work: () => Promise<unknown>): boolean {
  const { inFlight, startedAt } = runRegistry()
  if (inFlight.has(key)) return true
  if (Date.now() - (startedAt.get(key) ?? 0) < cooldownMs) return false
  inFlight.add(key)
  startedAt.set(key, Date.now())
  after(async () => {
    try {
      await work()
    } catch (error) {
      console.warn(`[ai] background run ${key} failed: ${String(error)}`)
    } finally {
      inFlight.delete(key)
    }
  })
  return true
}

/** One background attempt per project per ten minutes, whatever the outcome. */
const THEME_RUN_COOLDOWN_MS = 10 * 60_000

function scheduleThemeRun(input: Parameters<typeof themesFeature.generate>[0], userId: string): boolean {
  return startBackgroundRun(`themes:${input.projectId}`, THEME_RUN_COOLDOWN_MS, () =>
    themesFeature.generate(input, {
      userId,
      signal: AbortSignal.timeout(FEATURE_POLICY.themes.timeoutMs * 2),
    }),
  )
}

/* -------------------------------------------------------------------------- *
 * The inbox, grouped by the same themes
 * -------------------------------------------------------------------------- */

export interface InboxGroup {
  readonly id: string
  readonly label: string
  /** Distinct reviewers among the rows in this group. Never the note count. */
  readonly reviewers: number
  readonly impact: number | null
  readonly rows: readonly FeedbackView[]
}

/**
 * Reviews land under the theme most of their points belong to, ties broken by
 * impact. One review, one row: a creator counting rows is counting people.
 */
export function groupByTheme(
  rows: readonly FeedbackView[],
  board: ThemeBoard,
): readonly InboxGroup[] {
  const rank = new Map(board.themes.map((t, i) => [t.id, i]))
  const buckets = new Map<string, FeedbackView[]>()
  const loose: FeedbackView[] = []

  for (const row of rows) {
    const tally = new Map<string, number>()
    for (const point of row.points) {
      const themeId = board.themeOfPoint.get(point.id)
      if (themeId) tally.set(themeId, (tally.get(themeId) ?? 0) + 1)
    }
    let best: string | null = null
    let bestCount = 0
    for (const [themeId, count] of tally) {
      const better =
        count > bestCount ||
        (count === bestCount &&
          best !== null &&
          (rank.get(themeId) ?? 99) < (rank.get(best) ?? 99))
      if (better) {
        best = themeId
        bestCount = count
      }
    }
    if (best === null) {
      loose.push(row)
      continue
    }
    const list = buckets.get(best)
    if (list) list.push(row)
    else buckets.set(best, [row])
  }

  const groups: InboxGroup[] = []
  for (const theme of board.themes) {
    const list = buckets.get(theme.id)
    if (!list || list.length === 0) continue
    groups.push({
      id: theme.id,
      label: theme.label,
      reviewers: new Set(list.map((r) => r.reviewer.id)).size,
      impact: theme.impact,
      rows: list,
    })
  }
  if (loose.length > 0) {
    groups.push({
      id: 'ungrouped',
      label: 'Not yet grouped',
      reviewers: new Set(loose.map((r) => r.reviewer.id)).size,
      impact: null,
      rows: loose,
    })
  }
  return groups
}

/* -------------------------------------------------------------------------- *
 * Week over week
 * -------------------------------------------------------------------------- */

export interface WeekMetric {
  readonly key: MetricKey
  readonly label: string
  readonly value: number
  readonly previous: number
  /** Pre-formatted for the page, so the figure and the delta agree. */
  readonly display: string
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function scopeSql(projectId: string | null): { clause: string; params: unknown[] } {
  return projectId
    ? { clause: 'f.project_id = ?', params: [projectId] }
    : { clause: 'p.owner_id = ?', params: [] }
}

/**
 * Real counts over two adjacent seven-day windows. Nothing is modelled and
 * nothing is extrapolated: an empty window reports zero and says so.
 *
 * Open themes are counted on `board`, the same grouping the page draws. They
 * used to be counted on a separate table of stored themes, so Insights could
 * say "Open themes 3" above a board of a different three, or of none. With no
 * board in view (every project at once, or too few notes to group) the figure
 * is left out rather than counted on something the reader cannot see. A point
 * carries no resolution date, so last week's figure uses today's resolution
 * state, which can only undercount it.
 */
export function weekMetrics(
  userId: string,
  projectId: string | null,
  drawn: ThemeBoard | null,
  at: Millis = Date.now(),
): readonly WeekMetric[] {
  const board = drawn?.enoughNotes ? drawn : null
  const scope = scopeSql(projectId)
  const owner = projectId ? [] : [userId]
  const windows: Array<[number, number]> = [
    [at - WEEK_MS, at],
    [at - 2 * WEEK_MS, at - WEEK_MS],
  ]

  const counted = windows.map(([from, to]) => {
    const row = all<{ notes: number; reviewers: number; rating: number | null }>(
      `SELECT COUNT(DISTINCT f.id)          AS notes,
              COUNT(DISTINCT f.reviewer_id) AS reviewers,
              AVG(CAST(r.rating_value AS REAL)) AS rating
         FROM feedback f
         JOIN projects p ON p.id = f.project_id
         LEFT JOIN feedback_ratings r ON r.feedback_id = f.id
        WHERE ${scope.clause} AND f.status = 'submitted' AND f.deleted_at IS NULL
          AND f.submitted_at > ? AND f.submitted_at <= ?`,
      [...owner, ...scope.params, from, to],
    )[0]
    return {
      feedback_count: row?.notes ?? 0,
      reviewers: row?.reviewers ?? 0,
      avg_rating: row?.rating === null || row?.rating === undefined ? 0 : round2(row.rating),
      open_themes: board ? board.themes.filter((theme) => themeIsOpen(theme, to)).length : 0,
      resolved: shippedBetween(userId, projectId, from, to).length,
    }
  })

  const current = counted[0]
  const previous = counted[1]
  const keys: readonly MetricKey[] = board
    ? ['feedback_count', 'reviewers', 'avg_rating', 'open_themes', 'resolved']
    : ['feedback_count', 'reviewers', 'avg_rating', 'resolved']
  return keys.map((key) => {
    const value = current?.[key] ?? 0
    const was = previous?.[key] ?? 0
    return {
      key,
      label: METRIC_LABEL[key],
      value,
      previous: was,
      display: key === 'avg_rating' ? (value === 0 ? '–' : value.toFixed(2)) : String(value),
    }
  })
}

/**
 * Suggestions that moved to shipped in `(from, to]`. The week strip counts
 * these and the brief lists them, from this one query, so the brief can no
 * longer celebrate two fixes above a figure that says none shipped.
 */
function shippedBetween(
  userId: string,
  projectId: string | null,
  from: Millis,
  to: Millis,
): ReadonlyArray<{ id: string; title: string }> {
  return all<{ id: string; title: string }>(
    `SELECT s.id AS id, s.title AS title
       FROM suggestions s JOIN projects p ON p.id = s.project_id
      WHERE ${projectId ? 's.project_id = ?' : 'p.owner_id = ?'}
        AND s.status = 'shipped' AND s.status_changed_at > ? AND s.status_changed_at <= ?
      ORDER BY s.status_changed_at DESC`,
    [projectId ?? userId, from, to],
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/* -------------------------------------------------------------------------- *
 * The weekly brief
 * -------------------------------------------------------------------------- */

export interface Brief {
  readonly digest: Digest
  readonly provenance: Provenance
  readonly metrics: readonly WeekMetric[]
  readonly board: ThemeBoard
}

function isoWeekOf(at: number): string {
  const date = new Date(at)
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = target.getUTCDay() === 0 ? 7 : target.getUTCDay()
  target.setUTCDate(target.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((target.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${String(target.getUTCFullYear())}-W${String(week).padStart(2, '0')}`
}

function digestProvenance(result: AiResult<Digest>, pending = false): Provenance {
  if (result.source === 'heuristic') {
    return {
      source: 'heuristic',
      label: 'Computed from your week',
      detail:
        result.degraded === 'gated'
          ? 'Counted from your rows. There was not enough movement this week to write about.'
          : pending
            ? 'Ranked on this server from the counts above. A model is writing a fuller brief; reload in a minute to read it.'
            : 'Ranked on this server from the counts above, with no model involved.',
      model: undefined,
      generatedAt: result.generatedAt,
    }
  }
  return {
    source: result.source,
    label: result.source === 'cached'
      ? `${FEATURE_POLICY.digest.aiLabel}, reused`
      : FEATURE_POLICY.digest.aiLabel,
    detail:
      'Written by a model from this week’s counts and the theme board. A claim it could not tie to either was dropped.',
    model: result.model,
    generatedAt: result.generatedAt,
  }
}

/** The insights page. One clustering run, one digest run, both bounded. */
export async function weeklyBrief(userId: string, projectId: string): Promise<Brief> {
  const at = Date.now()
  const board = await themeBoard(projectId, userId)
  const metrics = weekMetrics(userId, projectId, board, at)
  const themes: DigestTheme[] = board.themes.map((theme) => ({
    id: theme.id,
    label: theme.label,
    summary: theme.summary,
    impact: theme.impact,
    sentiment: theme.sentiment,
    reporterCount: theme.reviewers,
    status: themeIsOpen(theme) ? 'open' : 'resolved',
    ...(theme.quote ? { quote: theme.quote.text } : {}),
  }))

  const input = {
    creatorId: userId,
    projectId,
    isoWeek: isoWeekOf(at),
    metrics: metrics.map((m) => ({ key: m.key, value: m.value, previous: m.previous })),
    themes,
    // The same window the "Suggestions shipped" figure counts.
    shipped: shippedBetween(userId, projectId, at - WEEK_MS, at),
  }
  // Same rule as the theme board: the render never waits on a model. A written
  // brief took twelve seconds on the reason tier, all of it spent before the
  // page could paint. It is drafted after the response instead, and only once
  // the board it cites is a model's: a brief written over the local grouping
  // would be thrown away the moment the model board lands.
  const result = await digestFeature.generate(input, { skipModel: true })
  const boardSettled = board.provenance.source !== 'heuristic'
  const pending =
    result.source === 'heuristic' && !result.degraded && boardSettled && aiAvailability().any &&
    scheduleDigestRun(input)

  return { digest: result.data, provenance: digestProvenance(result, pending), metrics, board }
}

const DIGEST_RUN_COOLDOWN_MS = 5 * 60_000

function scheduleDigestRun(input: Parameters<typeof digestFeature.generate>[0]): boolean {
  // Per project: keyed on the creator alone, opening a second project while
  // the first one's brief was being written reported a draft that did not exist.
  return startBackgroundRun(
    `digest:${input.creatorId}:${input.projectId}:${input.isoWeek}`,
    DIGEST_RUN_COOLDOWN_MS,
    () => digestFeature.generate(input, { signal: AbortSignal.timeout(DIGEST_DEADLINE_MS * 3) }),
  )
}

/* -------------------------------------------------------------------------- *
 * The tracker
 * -------------------------------------------------------------------------- */

export const TRACKER_COLUMNS = [
  { id: 'open', label: 'Open', statuses: ['open', 'under_review'] },
  { id: 'planned', label: 'Planned', statuses: ['planned'] },
  { id: 'in_progress', label: 'In progress', statuses: ['in_progress'] },
  { id: 'shipped', label: 'Shipped', statuses: ['shipped'] },
  { id: 'declined', label: 'Declined', statuses: ['declined', 'wont_fix', 'duplicate'] },
] as const

export type TrackerColumnId = (typeof TRACKER_COLUMNS)[number]['id']

export function columnOf(status: SuggestionView['status']): TrackerColumnId {
  for (const column of TRACKER_COLUMNS) {
    if ((column.statuses as readonly string[]).includes(status)) return column.id
  }
  return 'open'
}

export interface VersionRow {
  readonly id: string
  readonly label: string
}

/** The project’s real builds, so “shipped in” points at a row and not a string. */
export const projectVersions = cache((projectId: string): readonly VersionRow[] =>
  all<{ id: string; version_label: string }>(
    `SELECT id, version_label FROM project_versions
      WHERE project_id = ? ORDER BY created_at DESC LIMIT 20`,
    [projectId],
  ).map((r) => ({ id: r.id, label: r.version_label })),
)

export function trackerBoard(userId: string, projectId: string | null) {
  const page = listSuggestions({
    ownerId: userId,
    ...(projectId ? { projectId } : {}),
    sort: 'top',
    limit: 100,
    viewerId: userId,
  })
  const counts = getSuggestionCounts({ ownerId: userId, ...(projectId ? { projectId } : {}) })
  return { items: page.items, counts }
}
