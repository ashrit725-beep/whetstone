/**
 * Reads for the four marketing surfaces.
 *
 * Nothing on these pages is allowed to be a number somebody typed. Every figure
 * below is a count taken at render time, and every name, ask and axis label is
 * a row somebody on Whetstone actually wrote. Where a query finds nothing, the caller
 * gets an empty array and says so in words rather than printing a zero.
 *
 * The one genuinely new read here is the disagreement ranking. Whetstone's
 * rating axes are five-step scales, which is the same five steps as the grit
 * scale, so "these seven reviewers landed four steps apart" is a fact the
 * database already holds and nobody has ever shown. It is the homepage's
 * strongest section, so it is a first-class query rather than a derived count.
 */

import { all, get } from '@/server/db/client'
import { GRIT_STAGES, UNIVERSAL_CATEGORIES } from '@/lib/taxonomy'

type Row = Record<string, unknown>

function str(row: Row | undefined, key: string, fallback = ''): string {
  const value = row?.[key]
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

function num(row: Row | undefined, key: string, fallback = 0): number {
  const value = row?.[key]
  if (typeof value === 'number') return value
  const coerced = Number(value ?? fallback)
  return Number.isFinite(coerced) ? coerced : fallback
}

function gritFor(stageKey: string): number {
  return GRIT_STAGES.find((stage) => stage.key === stageKey)?.grit ?? 120
}

function stageLabelFor(stageKey: string): string {
  return GRIT_STAGES.find((stage) => stage.key === stageKey)?.label ?? 'Concept'
}

/** Only published, public, non-flagged projects are ever quoted on marketing. */
const PUBLIC_PROJECT = `
  p.status = 'published' AND p.visibility = 'public'
  AND p.deleted_at IS NULL AND p.is_nsfw = 0
`

/* ------------------------------------------------------------------------- *
 * 1. The counts the hero states in one line
 * ------------------------------------------------------------------------- */

export interface SiteCounts {
  readonly openProjects: number
  readonly publishedProjects: number
  readonly reviews: number
  readonly reviewers: number
  readonly points: number
  readonly shipped: number
  readonly projectTypes: number
}

export function siteCounts(): SiteCounts {
  const row = get<Row>(
    `SELECT
       (SELECT COUNT(*) FROM projects p
         WHERE ${PUBLIC_PROJECT} AND p.feedback_state = 'open')            AS open_projects,
       (SELECT COUNT(*) FROM projects p WHERE ${PUBLIC_PROJECT})           AS published_projects,
       (SELECT COUNT(*) FROM feedback
         WHERE status = 'submitted' AND deleted_at IS NULL)                AS reviews,
       (SELECT COUNT(DISTINCT reviewer_id) FROM feedback
         WHERE status = 'submitted' AND deleted_at IS NULL)                AS reviewers,
       (SELECT COUNT(*) FROM feedback_points fp
          JOIN feedback f ON f.id = fp.feedback_id
         WHERE f.status = 'submitted' AND f.deleted_at IS NULL)            AS points,
       (SELECT COUNT(*) FROM suggestions WHERE status = 'shipped')         AS shipped,
       (SELECT COUNT(*) FROM project_types)                                AS project_types`,
  )

  return {
    openProjects: num(row, 'open_projects'),
    publishedProjects: num(row, 'published_projects'),
    reviews: num(row, 'reviews'),
    reviewers: num(row, 'reviewers'),
    points: num(row, 'points'),
    shipped: num(row, 'shipped'),
    projectTypes: num(row, 'project_types'),
  }
}

/* ------------------------------------------------------------------------- *
 * 2. The disagreement ranking
 * ------------------------------------------------------------------------- */

export interface SpreadRow {
  readonly slug: string
  readonly title: string
  readonly ownerName: string
  readonly ownerHandle: string
  readonly typeLabel: string
  readonly grit: number
  readonly stageLabel: string
  /** The axis those reviewers disagreed on most. */
  readonly axisLabel: string
  readonly axisId: string
  /** How many reviewers rated that axis. */
  readonly raters: number
  /** Steps between the lowest and highest rating: 0 is unanimous, 4 is the width of the scale. */
  readonly spread: number
  readonly low: number
  readonly high: number
}

/**
 * One row per project: the axis its reviewers disagreed on most, and by how
 * much. Sorted by that spread rather than by score, which is the whole point:
 * an average of 3.2 hides four people who said 5 and three who said 1.
 *
 * Three raters is the floor. Two people one step apart is noise, not a split.
 * Only projects taking feedback are ranked, since the section invites people
 * to go and review them; `slugs` narrows it to particular projects.
 */
export function spreadRanking(limit = 5, slugs: readonly string[] | null = null): readonly SpreadRow[] {
  const only = slugs === null ? '' : `AND p.slug IN (${slugs.map(() => '?').join(', ')})`
  return all<Row>(
    `WITH rated AS (
       SELECT p.id       AS pid,
              p.slug     AS slug,
              p.title    AS title,
              p.stage_key AS stage_key,
              pt.label   AS type_label,
              pr.display_name AS owner_name,
              u.handle   AS owner_handle,
              ra.id      AS axis_id,
              ra.label   AS axis_label,
              fr.rating_value AS v
         FROM feedback_ratings fr
         JOIN feedback f       ON f.id = fr.feedback_id
                              AND f.status = 'submitted' AND f.deleted_at IS NULL
         JOIN projects p       ON p.id = f.project_id
         JOIN project_types pt ON pt.id = p.project_type_id
         JOIN rating_axes ra   ON ra.id = fr.axis_id
         JOIN users u          ON u.id = p.owner_id
         JOIN profiles pr      ON pr.user_id = u.id
        WHERE ${PUBLIC_PROJECT} AND p.feedback_state = 'open' ${only}
     ),
     per_axis AS (
       SELECT pid, slug, title, stage_key, type_label, owner_name, owner_handle,
              axis_id, axis_label,
              COUNT(*) AS raters, MIN(v) AS lo, MAX(v) AS hi, MAX(v) - MIN(v) AS spread
         FROM rated
        GROUP BY pid, axis_id
       HAVING raters >= 3
     ),
     ranked AS (
       SELECT *, ROW_NUMBER() OVER (
                   PARTITION BY pid ORDER BY spread DESC, raters DESC, axis_label
                 ) AS rn
         FROM per_axis
     )
     SELECT * FROM ranked
      WHERE rn = 1
      ORDER BY spread DESC, raters DESC, title
      LIMIT ?`,
    [...(slugs ?? []), limit],
  ).map((row) => {
    const stageKey = str(row, 'stage_key', 'concept')
    return {
      slug: str(row, 'slug'),
      title: str(row, 'title'),
      ownerName: str(row, 'owner_name'),
      ownerHandle: str(row, 'owner_handle'),
      typeLabel: str(row, 'type_label'),
      grit: gritFor(stageKey),
      stageLabel: stageLabelFor(stageKey),
      axisLabel: str(row, 'axis_label'),
      axisId: str(row, 'axis_id'),
      raters: num(row, 'raters'),
      spread: num(row, 'spread'),
      low: num(row, 'lo'),
      high: num(row, 'hi'),
    }
  })
}

export interface SpreadPlotVote {
  readonly name: string
  readonly handle: string
  /** 1 to 5, the step this reviewer put the project on for this axis. */
  readonly step: number
}

export interface SpreadPlot {
  readonly project: SpreadRow
  readonly votes: readonly SpreadPlotVote[]
  /** Reviewers per step, index 0 is step 1. */
  readonly columns: readonly number[]
  readonly median: number
  readonly lowLabel: string | null
  readonly highLabel: string | null
}

/**
 * Every reviewer's own reading of one axis, by name. This is the dot plot: the
 * columns are the five steps, and the names are stacked in the column each
 * reviewer chose. No average is drawn, because the average is the thing that
 * was hiding the disagreement in the first place.
 */
export function spreadPlot(project: SpreadRow): SpreadPlot {
  const rows = all<Row>(
    `SELECT pr.display_name AS name, u.handle AS handle, fr.rating_value AS v
       FROM feedback_ratings fr
       JOIN feedback f  ON f.id = fr.feedback_id
                       AND f.status = 'submitted' AND f.deleted_at IS NULL
       JOIN projects p  ON p.id = f.project_id
       JOIN users u     ON u.id = f.reviewer_id
       JOIN profiles pr ON pr.user_id = u.id
      WHERE p.slug = ? AND fr.axis_id = ?
      ORDER BY fr.rating_value, pr.display_name`,
    [project.slug, project.axisId],
  )

  const votes: SpreadPlotVote[] = rows.map((row) => ({
    name: str(row, 'name'),
    handle: str(row, 'handle'),
    step: num(row, 'v', 1),
  }))

  const columns = [1, 2, 3, 4, 5].map(
    (step) => votes.filter((vote) => vote.step === step).length,
  )

  const sorted = votes.map((vote) => vote.step).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length === 0
      ? 0
      : sorted.length % 2 === 1
        ? (sorted[mid] ?? 0)
        : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)

  const axis = get<Row>(`SELECT low_label, high_label FROM rating_axes WHERE id = ?`, [
    project.axisId,
  ])

  return {
    project,
    votes,
    columns,
    median,
    lowLabel: str(axis, 'low_label') || null,
    highLabel: str(axis, 'high_label') || null,
  }
}

/* ------------------------------------------------------------------------- *
 * 3. The live proof panel
 * ------------------------------------------------------------------------- */

export interface ProofRow {
  readonly slug: string
  readonly title: string
  readonly ownerName: string
  readonly typeLabel: string
  readonly grit: number
  readonly stageLabel: string
  /** The creator's own question. The first thing a reviewer reads. */
  readonly ask: string
  readonly reviews: number
  /** Null when too few reviewers rated it for a split to mean anything. */
  readonly spread: number | null
}

/**
 * The projects the panel shows are the ones taking feedback with the most
 * reviews on them: a live reading of Discover, ordered the way Discover orders
 * it, not a curated three.
 */
export function proofRows(limit = 3): readonly ProofRow[] {
  const rows = all<Row>(
    `SELECT p.slug, p.title, p.stage_key, pt.label AS type_label,
            pr.display_name AS owner_name,
            COALESCE(
              (SELECT a.prompt FROM project_asks a
                WHERE a.project_id = p.id
                ORDER BY a.is_required DESC, a.sort_order LIMIT 1),
              p.tagline, '') AS ask,
            (SELECT COUNT(*) FROM feedback f
              WHERE f.project_id = p.id AND f.status = 'submitted'
                AND f.deleted_at IS NULL) AS reviews
       FROM projects p
       JOIN project_types pt ON pt.id = p.project_type_id
       JOIN users u          ON u.id = p.owner_id
       JOIN profiles pr      ON pr.user_id = u.id
      WHERE ${PUBLIC_PROJECT} AND p.feedback_state = 'open'
      ORDER BY reviews DESC, p.published_at DESC
      LIMIT ?`,
    [limit],
  )

  // The split for exactly these projects, however far down the full ranking they sit.
  const slugs = rows.map((row) => str(row, 'slug'))
  const spreads = new Map(spreadRanking(slugs.length, slugs).map((row) => [row.slug, row.spread]))

  return rows.map((row) => {
    const stageKey = str(row, 'stage_key', 'concept')
    const slug = str(row, 'slug')
    return {
      slug,
      title: str(row, 'title'),
      ownerName: str(row, 'owner_name'),
      typeLabel: str(row, 'type_label'),
      grit: gritFor(stageKey),
      stageLabel: stageLabelFor(stageKey),
      ask: str(row, 'ask'),
      reviews: num(row, 'reviews'),
      spread: spreads.get(slug) ?? null,
    }
  })
}

/* ------------------------------------------------------------------------- *
 * 4. The scale, with what is standing on each step
 * ------------------------------------------------------------------------- */

export interface ScaleStep {
  readonly stageKey: string
  readonly grit: number
  readonly label: string
  readonly definition: string
  /** Published projects sitting on this step right now. */
  readonly count: number
  readonly exampleTitle: string | null
  readonly exampleSlug: string | null
}

export function scaleSteps(): readonly ScaleStep[] {
  const rows = all<Row>(
    `SELECT p.stage_key, p.slug, p.title,
            (SELECT COUNT(*) FROM feedback f
              WHERE f.project_id = p.id AND f.status = 'submitted'
                AND f.deleted_at IS NULL) AS reviews
       FROM projects p
      WHERE ${PUBLIC_PROJECT}
      ORDER BY reviews DESC, p.title`,
  )

  return GRIT_STAGES.map((stage) => {
    const here = rows.filter((row) => str(row, 'stage_key') === stage.key)
    const top = here[0]
    return {
      stageKey: stage.key,
      grit: stage.grit,
      label: stage.label,
      definition: stage.definition,
      count: here.length,
      exampleTitle: top ? str(top, 'title') : null,
      exampleSlug: top ? str(top, 'slug') : null,
    }
  })
}

/* ------------------------------------------------------------------------- *
 * 5. The category taxonomy, with real filings
 * ------------------------------------------------------------------------- */

export interface CategoryRow {
  readonly key: string
  readonly label: string
  readonly description: string
  readonly count: number
}

export interface CategoryTaxonomy {
  readonly universal: readonly CategoryRow[]
  /** Categories a project type adds on top of the universal set. */
  readonly typeSpecific: number
  readonly filed: number
  readonly severityCounts: readonly { readonly key: string; readonly count: number }[]
}

/**
 * The nine categories every project type carries, each with the number of
 * points actually filed under it. The per-type extras are counted rather than
 * listed: a reader does not need ten more lists, they need to know the spine is
 * the same everywhere and the vocabulary is not.
 */
export function categoryTaxonomy(): CategoryTaxonomy {
  const counts = new Map(
    all<Row>(
      `SELECT fc.category_key AS k, COUNT(*) AS n
         FROM feedback_points fp
         JOIN feedback_categories fc ON fc.id = fp.category_id
         JOIN feedback f ON f.id = fp.feedback_id
        WHERE f.status = 'submitted' AND f.deleted_at IS NULL
        GROUP BY fc.category_key`,
    ).map((row) => [str(row, 'k'), num(row, 'n')] as const),
  )

  const universalKeys = new Set(UNIVERSAL_CATEGORIES.map((category) => category.key as string))

  const typeSpecific = num(
    get<Row>(
      `SELECT COUNT(DISTINCT category_key) AS n FROM feedback_categories WHERE is_active = 1`,
    ),
    'n',
  )

  const severityCounts = all<Row>(
    `SELECT fp.severity AS k, COUNT(*) AS n
       FROM feedback_points fp
       JOIN feedback f ON f.id = fp.feedback_id
      WHERE f.status = 'submitted' AND f.deleted_at IS NULL
      GROUP BY fp.severity`,
  ).map((row) => ({ key: str(row, 'k'), count: num(row, 'n') }))

  const universal = UNIVERSAL_CATEGORIES.map((category) => ({
    key: category.key as string,
    label: category.label as string,
    description: category.description as string,
    count: counts.get(category.key as string) ?? 0,
  }))

  let filed = 0
  for (const [key, count] of counts) {
    if (universalKeys.has(key)) filed += count
  }

  return {
    universal: [...universal].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    typeSpecific: Math.max(0, typeSpecific - universalKeys.size),
    filed,
    severityCounts,
  }
}

/* ------------------------------------------------------------------------- *
 * 6. Open asks, for the reviewer page
 * ------------------------------------------------------------------------- */

export interface OpenAskRow {
  readonly slug: string
  readonly projectTitle: string
  readonly ownerName: string
  readonly typeLabel: string
  readonly grit: number
  readonly stageLabel: string
  readonly prompt: string
  readonly answers: number
  readonly needs: readonly string[]
  /** When the project went up, which is when the ask started waiting. */
  readonly askedAt: number | null
}

/**
 * The reviewer board: required asks on open projects, fewest answers first and
 * then the longest-waiting, so the top of the board is the question that has
 * gone unanswered longest. One ask per project, the least-answered of its
 * required ones, so five rows are five different pieces of work.
 */
export function openAskRows(limit = 5): readonly OpenAskRow[] {
  return all<Row>(
    `WITH asks AS (
       SELECT p.id AS pid, p.slug, p.title, p.stage_key, p.published_at,
              pt.label AS type_label, pr.display_name AS owner_name,
              a.prompt, a.answer_count,
              ROW_NUMBER() OVER (
                PARTITION BY p.id ORDER BY a.answer_count, a.sort_order
              ) AS rn
         FROM projects p
         JOIN project_types pt ON pt.id = p.project_type_id
         JOIN project_asks a  ON a.project_id = p.id
         JOIN users u         ON u.id = p.owner_id
         JOIN profiles pr     ON pr.user_id = u.id
        WHERE ${PUBLIC_PROJECT} AND p.feedback_state = 'open' AND a.is_required = 1
     )
     SELECT asks.*,
            (SELECT GROUP_CONCAT(nk.label, '|')
               FROM project_needs pn
               JOIN need_kinds nk ON nk.need_key = pn.need_key
              WHERE pn.project_id = asks.pid) AS needs
       FROM asks
      WHERE rn = 1
      ORDER BY answer_count ASC, published_at ASC
      LIMIT ?`,
    [limit],
  ).map((row) => {
    const stageKey = str(row, 'stage_key', 'concept')
    const needs = str(row, 'needs')
    return {
      slug: str(row, 'slug'),
      projectTitle: str(row, 'title'),
      ownerName: str(row, 'owner_name'),
      typeLabel: str(row, 'type_label'),
      grit: gritFor(stageKey),
      stageLabel: stageLabelFor(stageKey),
      prompt: str(row, 'prompt'),
      answers: num(row, 'answer_count'),
      needs: needs ? needs.split('|').filter((need) => need.length > 0) : [],
      askedAt: typeof row['published_at'] === 'number' ? row['published_at'] : null,
    }
  })
}

/* ------------------------------------------------------------------------- *
 * 7. Money. It appears on exactly two things: expert reviews and bounties.
 * ------------------------------------------------------------------------- */

export interface BountyFacts {
  readonly openCount: number
  readonly settledCount: number
  readonly lowestOpenCents: number | null
  readonly highestOpenCents: number | null
  readonly currency: string
}

export function bountyFactsNow(): BountyFacts {
  // "Open" is what the public bounty list shows: a direct request to one
  // reviewer is never listed to anyone else, so it is not counted here either.
  const row = get<Row>(
    `SELECT
       SUM(CASE WHEN status = 'open' AND visibility = 'public' THEN 1 ELSE 0 END) AS open_count,
       SUM(CASE WHEN status IN ('awarded','in_progress','delivered','closed')
                THEN 1 ELSE 0 END)                                              AS settled_count,
       MIN(CASE WHEN status = 'open' AND visibility = 'public' THEN amount_cents END) AS lo,
       MAX(CASE WHEN status = 'open' AND visibility = 'public' THEN amount_cents END) AS hi,
       MIN(currency)                                                            AS currency
     FROM bounties`,
  )
  const lo = row?.['lo']
  const hi = row?.['hi']
  return {
    openCount: num(row, 'open_count'),
    settledCount: num(row, 'settled_count'),
    lowestOpenCents: typeof lo === 'number' ? lo : null,
    highestOpenCents: typeof hi === 'number' ? hi : null,
    currency: str(row, 'currency', 'USD'),
  }
}

/** Reviews written by people listed for paid work, so the page can say how much of the site is paid. */
export function paidReviewShare(): { readonly bountyReviews: number; readonly total: number } {
  const row = get<Row>(
    `SELECT
       (SELECT COUNT(*) FROM feedback
         WHERE status = 'submitted' AND deleted_at IS NULL AND bounty_id IS NOT NULL) AS paid,
       (SELECT COUNT(*) FROM feedback
         WHERE status = 'submitted' AND deleted_at IS NULL)                           AS total`,
  )
  return { bountyReviews: num(row, 'paid'), total: num(row, 'total') }
}

export interface ArrivalDay {
  /** The UTC midnight that opens the day, in milliseconds. */
  readonly start: number
  /** "Sep 3", read in UTC so the caption names the same day the bucket counts. */
  readonly label: string
  readonly count: number
}

export interface ArrivalSeries {
  /** One entry per day, oldest first. The last is today, which is still filling. */
  readonly days: readonly ArrivalDay[]
  /** Every review in the window, today's included. */
  readonly total: number
  /**
   * The median of the finished days. A median rather than a mean, because one
   * heavy day would drag a mean above almost every bar it is meant to describe.
   * Today is left out because it is partial.
   */
  readonly medianDay: number
  /** The day with the most reviews, or null when nothing arrived in the window. */
  readonly busiest: ArrivalDay | null
}

const DAY_MS = 86_400_000

/**
 * How many reviews were submitted each day over the last `days` days, ending
 * today. It counts the same rows as `siteCounts().reviews`: submitted and not
 * deleted, dated by when they were submitted rather than when the draft began.
 *
 * The window is anchored on the clock, not on the newest row. Anchoring on the
 * data made a quiet week invisible, because the chart simply ended wherever
 * the last review happened to be. Days are UTC days. Days with no activity are
 * kept rather than dropped: a gap in the record is information, and collapsing
 * it would make the run look busier than it was.
 */
export function arrivalSeries(days = 28, nowMs = Date.now()): ArrivalSeries {
  const today = Math.floor(nowMs / DAY_MS) * DAY_MS
  const start = today - (days - 1) * DAY_MS

  // The day width is written as a literal and wrapped in CAST: a bound
  // parameter arrives as a REAL, which turns the division floating and gives
  // every row its own bucket instead of grouping them by day.
  const rows = all<{ bucket: number; n: number }>(
    `SELECT CAST(submitted_at / 86400000 AS INTEGER) * 86400000 AS bucket, COUNT(*) AS n
       FROM feedback
      WHERE status = 'submitted' AND deleted_at IS NULL
        AND submitted_at >= ? AND submitted_at < ?
      GROUP BY bucket`,
    [start, today + DAY_MS],
  )

  const byBucket = new Map(rows.map((row) => [row.bucket, row.n]))
  const format = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' })

  const series: ArrivalDay[] = Array.from({ length: days }, (_, index) => {
    const dayStart = start + index * DAY_MS
    return { start: dayStart, label: format.format(dayStart), count: byBucket.get(dayStart) ?? 0 }
  })

  const finished = series
    .slice(0, -1)
    .map((day) => day.count)
    .sort((a, b) => a - b)
  const middle = Math.floor(finished.length / 2)
  const busiest = series.reduce<ArrivalDay | null>(
    (most, day) => (day.count > (most?.count ?? 0) ? day : most),
    null,
  )

  return {
    days: series,
    total: series.reduce((sum, day) => sum + day.count, 0),
    medianDay:
      finished.length === 0
        ? 0
        : finished.length % 2 === 1
          ? (finished[middle] ?? 0)
          : Math.round(((finished[middle - 1] ?? 0) + (finished[middle] ?? 0)) / 2),
    busiest,
  }
}
