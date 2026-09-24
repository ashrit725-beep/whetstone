/**
 * Reads for the four marketing surfaces.
 *
 * Nothing on these pages is allowed to be a number somebody typed. Every figure
 * below is a count taken from the database, and every name, ask and axis label
 * is a row somebody on Whetstone actually wrote. Where a query finds nothing,
 * the caller gets an empty array and says so in words rather than printing a
 * zero.
 *
 * Caching. The public pages are read by strangers, most of whom arrive once, so
 * the work behind them is done for one reader and reused for the rest: every
 * read in this file runs inside `unstable_cache` under the `marketing` tag with
 * a five-minute life. Two things made that necessary rather than nice. The
 * disagreement pass groups a hundred and fifty thousand ratings and took about
 * a second; and it used to run twice per render, once for the featured project
 * and once for the proof panel's splits. Each page now takes its whole reading
 * from one cached function, so the ranking is computed once and shared.
 *
 * Nothing here depends on who is reading. The marketing nav resolves the reader
 * in the browser, so signing in or out must not rebuild any of this; the
 * session actions no longer revalidate these paths.
 */

import { unstable_cache } from 'next/cache'
import { all, get } from '@/server/db/client'
import { GRIT_STAGES, SEVERITY_LEVELS, UNIVERSAL_CATEGORIES } from '@/lib/taxonomy'
import { getBountyFeeSchedule, type FeeSchedule } from '@/server/repos/bounties'
import { getFeaturedExperts } from '@/server/repos/profiles'

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

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

/* ------------------------------------------------------------------------- *
 * 1. The counts every page states
 * ------------------------------------------------------------------------- */

export interface SiteCounts {
  readonly openProjects: number
  readonly publishedProjects: number
  readonly reviews: number
  readonly reviewers: number
  readonly points: number
  readonly shipped: number
  readonly projectTypes: number
  /** Points filed at the top severity, across every submitted review. */
  readonly blockers: number
  /**
   * Half of all projects wait less than this for their first review. A median
   * rather than a mean: one project that sat for a year drags a mean past
   * almost every project it claims to describe.
   */
  readonly firstReviewHours: number | null
}

function readSiteCounts(): SiteCounts {
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
       (SELECT COUNT(*) FROM feedback_points fp
          JOIN feedback f ON f.id = fp.feedback_id
         WHERE f.status = 'submitted' AND f.deleted_at IS NULL
           AND fp.severity = 'blocker')                                    AS blockers,
       (SELECT COUNT(*) FROM suggestions WHERE status = 'shipped')         AS shipped,
       (SELECT COUNT(*) FROM project_types)                                AS project_types`,
  )

  // The wait is measured per project: the first review anybody submitted, less
  // the moment the project went up. A review dated before its own project is a
  // seeded row with an impossible timestamp and is left out rather than
  // clamped, which would pull the median toward zero.
  const wait = get<Row>(
    `WITH waits AS (
       SELECT MIN(f.submitted_at) - p.published_at AS ms
         FROM projects p
         JOIN feedback f ON f.project_id = p.id
                        AND f.status = 'submitted' AND f.deleted_at IS NULL
        WHERE ${PUBLIC_PROJECT} AND p.published_at IS NOT NULL
        GROUP BY p.id
       HAVING ms >= 0
     )
     SELECT (SELECT COUNT(*) FROM waits) AS n,
            (SELECT ms FROM waits ORDER BY ms
              LIMIT 1 OFFSET (SELECT (COUNT(*) - 1) / 2 FROM waits)) AS median_ms`,
  )

  const measured = num(wait, 'n')
  const medianMs = wait?.['median_ms']

  return {
    openProjects: num(row, 'open_projects'),
    publishedProjects: num(row, 'published_projects'),
    reviews: num(row, 'reviews'),
    reviewers: num(row, 'reviewers'),
    points: num(row, 'points'),
    shipped: num(row, 'shipped'),
    projectTypes: num(row, 'project_types'),
    blockers: num(row, 'blockers'),
    firstReviewHours:
      measured >= 20 && typeof medianMs === 'number'
        ? Math.max(1, Math.round(medianMs / HOUR_MS))
        : null,
  }
}

/** The ten kinds of work, in the order the composer offers them. */
function readProjectTypeLabels(): readonly string[] {
  return all<Row>(`SELECT label FROM project_types ORDER BY sort_order, label`).map((row) =>
    str(row, 'label'),
  )
}

/* ------------------------------------------------------------------------- *
 * 2. Disagreement
 * ------------------------------------------------------------------------- */

export interface SplitVote {
  readonly name: string
  readonly handle: string
  /** 1 to 5, the step this reviewer put the project on for this axis. */
  readonly step: number
}

export interface SplitPlot {
  readonly slug: string
  readonly title: string
  readonly ownerName: string
  readonly typeLabel: string
  readonly grit: number
  readonly stageLabel: string
  readonly axisLabel: string
  readonly lowLabel: string
  readonly highLabel: string
  readonly raters: number
  /** Reviewers per step, index 0 is step 1. */
  readonly columns: readonly number[]
  readonly votes: readonly SplitVote[]
  readonly low: number
  readonly high: number
  /** How far apart the ratings sit, on the scale's own steps. */
  readonly stdDev: number
  readonly median: number
}

/**
 * The one axis, anywhere on the site, whose reviewers are furthest apart.
 *
 * Spread used to be ranked by range, max minus min, and range saturates: 251
 * project-axes in the database run the full 1 to 5, so a ranking by range ranks
 * nothing. Standard deviation is the reading that separates a genuine split
 * (eight people at 1 or 2, four at 4 or 5) from a bell curve with two outliers,
 * and ten raters is the floor at which it means anything.
 *
 * The variance is computed in SQL because SQLite has no standard deviation, and
 * ordering by variance is ordering by its square root. It is rounded before it
 * is ordered: two axes genuinely tied at 1.44 came back as 1.4400000000000004
 * and 1.4399999999999986, and the floating-point noise, not the reviewer count,
 * decided which project the homepage led with.
 */
function readSplitLeader(): SplitPlot | null {
  const leader = get<Row>(
    `WITH open_p AS (
       SELECT p.id AS pid FROM projects p
        WHERE ${PUBLIC_PROJECT} AND p.feedback_state = 'open'
          AND (SELECT COUNT(*) FROM feedback f
                WHERE f.project_id = p.id
                  AND f.status = 'submitted' AND f.deleted_at IS NULL) >= 10
     ),
     rated AS (
       SELECT f.project_id AS pid, fr.axis_id AS axis_id, fr.rating_value AS v
         FROM open_p
         JOIN feedback f ON f.project_id = open_p.pid
                        AND f.status = 'submitted' AND f.deleted_at IS NULL
         JOIN feedback_ratings fr ON fr.feedback_id = f.id
     ),
     per_axis AS (
       SELECT pid, axis_id, COUNT(*) AS raters, MIN(v) AS lo, MAX(v) AS hi,
              AVG(v * v) - AVG(v) * AVG(v) AS variance
         FROM rated
        GROUP BY pid, axis_id
       HAVING raters >= 10
     )
     SELECT pa.raters, pa.lo, pa.hi, pa.variance, pa.axis_id,
            p.slug, p.title, p.stage_key,
            pt.label AS type_label, pr.display_name AS owner_name,
            ra.label AS axis_label, ra.low_label, ra.high_label
       FROM per_axis pa
       JOIN projects p       ON p.id = pa.pid
       JOIN project_types pt ON pt.id = p.project_type_id
       JOIN users u          ON u.id = p.owner_id
       JOIN profiles pr      ON pr.user_id = u.id
       JOIN rating_axes ra   ON ra.id = pa.axis_id
      ORDER BY ROUND(pa.variance, 4) DESC, pa.raters DESC, p.title
      LIMIT 1`,
  )

  if (!leader) return null

  const votes: SplitVote[] = all<Row>(
    `SELECT pr.display_name AS name, u.handle AS handle, fr.rating_value AS v
       FROM feedback_ratings fr
       JOIN feedback f  ON f.id = fr.feedback_id
                       AND f.status = 'submitted' AND f.deleted_at IS NULL
       JOIN projects p  ON p.id = f.project_id
       JOIN users u     ON u.id = f.reviewer_id
       JOIN profiles pr ON pr.user_id = u.id
      WHERE p.slug = ? AND fr.axis_id = ?
      ORDER BY fr.rating_value, pr.display_name`,
    [str(leader, 'slug'), str(leader, 'axis_id')],
  ).map((row) => ({
    name: str(row, 'name'),
    handle: str(row, 'handle'),
    step: num(row, 'v', 1),
  }))

  if (votes.length === 0) return null

  const columns = [1, 2, 3, 4, 5].map((step) => votes.filter((vote) => vote.step === step).length)
  const sorted = votes.map((vote) => vote.step).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median =
    sorted.length % 2 === 1
      ? (sorted[mid] ?? 0)
      : Math.round(((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2)

  const stageKey = str(leader, 'stage_key', 'concept')

  return {
    slug: str(leader, 'slug'),
    title: str(leader, 'title'),
    ownerName: str(leader, 'owner_name'),
    typeLabel: str(leader, 'type_label'),
    grit: gritFor(stageKey),
    stageLabel: stageLabelFor(stageKey),
    axisLabel: str(leader, 'axis_label'),
    lowLabel: str(leader, 'low_label'),
    highLabel: str(leader, 'high_label'),
    raters: votes.length,
    columns,
    votes,
    low: num(leader, 'lo', 1),
    high: num(leader, 'hi', 5),
    stdDev: Math.round(Math.sqrt(Math.max(0, num(leader, 'variance'))) * 100) / 100,
    median,
  }
}

/** Open projects carrying at least one axis where the ratings run 3 steps or more. */
function readSplitProjectCount(): number {
  return num(
    get<Row>(
      `WITH open_p AS (
         SELECT p.id AS pid FROM projects p
          WHERE ${PUBLIC_PROJECT} AND p.feedback_state = 'open'
            AND (SELECT COUNT(*) FROM feedback f
                  WHERE f.project_id = p.id
                    AND f.status = 'submitted' AND f.deleted_at IS NULL) >= 3
       ),
       rated AS (
         SELECT f.project_id AS pid, fr.axis_id AS axis_id, fr.rating_value AS v
           FROM open_p
           JOIN feedback f ON f.project_id = open_p.pid
                          AND f.status = 'submitted' AND f.deleted_at IS NULL
           JOIN feedback_ratings fr ON fr.feedback_id = f.id
       ),
       per_axis AS (
         SELECT pid, COUNT(*) AS raters, MAX(v) - MIN(v) AS spread
           FROM rated
          GROUP BY pid, axis_id
         HAVING raters >= 3
       )
       SELECT COUNT(DISTINCT pid) AS n FROM per_axis WHERE spread >= 3`,
    ),
    'n',
  )
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
  /** Lowest and highest rating on the axis its reviewers split hardest on. */
  readonly low: number | null
  readonly high: number | null
}

/**
 * The projects the panel shows are the ones taking feedback with the most
 * reviews on them: a live reading of Discover, ordered the way Discover orders
 * it, not a curated three.
 */
function readProofRows(limit: number): readonly ProofRow[] {
  const rows = all<Row>(
    `SELECT p.id, p.slug, p.title, p.stage_key, pt.label AS type_label,
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

  if (rows.length === 0) return []

  // The widest split on each of exactly these projects, in one pass keyed by
  // their ids rather than by re-running the whole site's ranking.
  const ids = rows.map((row) => str(row, 'id'))
  const spread = new Map(
    all<Row>(
      `SELECT f.project_id AS pid, MIN(fr.rating_value) AS lo, MAX(fr.rating_value) AS hi,
              COUNT(*) AS raters, MAX(fr.rating_value) - MIN(fr.rating_value) AS spread
         FROM feedback_ratings fr
         JOIN feedback f ON f.id = fr.feedback_id
                        AND f.status = 'submitted' AND f.deleted_at IS NULL
        WHERE f.project_id IN (${ids.map(() => '?').join(', ')})
        GROUP BY f.project_id, fr.axis_id
       HAVING raters >= 3
        ORDER BY spread DESC`,
      ids,
    ).map((row) => [str(row, 'pid'), { low: num(row, 'lo'), high: num(row, 'hi') }] as const),
  )

  return rows.map((row) => {
    const stageKey = str(row, 'stage_key', 'concept')
    const widest = spread.get(str(row, 'id')) ?? null
    return {
      slug: str(row, 'slug'),
      title: str(row, 'title'),
      ownerName: str(row, 'owner_name'),
      typeLabel: str(row, 'type_label'),
      grit: gritFor(stageKey),
      stageLabel: stageLabelFor(stageKey),
      ask: str(row, 'ask'),
      reviews: num(row, 'reviews'),
      low: widest?.low ?? null,
      high: widest?.high ?? null,
    }
  })
}

/* ------------------------------------------------------------------------- *
 * 4. One real review, whole
 * ------------------------------------------------------------------------- */

export interface SpecimenPoint {
  readonly id: string
  readonly categoryLabel: string
  readonly severityKey: string
  readonly severityLabel: string
  readonly anchorLabel: string | null
  readonly actionabilityLabel: string
  /** Set when this point answers one of the creator's own questions. */
  readonly answersAsk: string | null
  readonly body: string
  readonly seconded: number
}

export interface SpecimenReview {
  readonly id: string
  readonly slug: string
  readonly projectTitle: string
  readonly typeLabel: string
  readonly grit: number
  readonly stageLabel: string
  readonly reviewerName: string
  readonly reviewerHandle: string
  readonly versionLabel: string
  readonly minutes: number | null
  readonly headline: string
  readonly submittedAt: number | null
  readonly helpful: number
  readonly ask: string | null
  readonly points: readonly SpecimenPoint[]
  readonly pointCount: number
}

const SEVERITY_LABELS = new Map(SEVERITY_LEVELS.map((level) => [level.key as string, level.label as string]))

const ANCHOR_WORD: Readonly<Record<string, string>> = {
  timecode: 'At',
  route: 'On',
  screen: 'On',
  level: 'In',
  selector: 'At',
}

/**
 * One whole review, shown as the reader would receive it.
 *
 * The landing page used to describe what comes back and never show it. This is
 * the real thing: a submitted, public review on a project taking feedback, with
 * a build named, at least three points, at least one of them anchored, and at
 * least one answering a question the creator wrote. Among those it takes the
 * one other members found most useful, so the choice is the site's judgement
 * rather than an editor's.
 */
function readSpecimen(): SpecimenReview | null {
  const row = get<Row>(
    `SELECT f.id, f.headline, f.point_count, f.helpful_count, f.submitted_at,
            f.time_spent_minutes,
            p.slug, p.title AS project_title, p.stage_key,
            pt.label AS type_label,
            pr.display_name AS reviewer_name, u.handle AS reviewer_handle,
            v.version_label
       FROM feedback f
       JOIN projects p          ON p.id = f.project_id
       JOIN project_types pt    ON pt.id = p.project_type_id
       JOIN project_versions v  ON v.id = f.version_id
       JOIN users u             ON u.id = f.reviewer_id
       JOIN profiles pr         ON pr.user_id = u.id
      WHERE ${PUBLIC_PROJECT} AND p.feedback_state = 'open'
        AND f.status = 'submitted' AND f.visibility = 'public' AND f.deleted_at IS NULL
        AND f.point_count >= 3
        AND EXISTS (SELECT 1 FROM feedback_points fp
                     WHERE fp.feedback_id = f.id AND fp.anchor_kind IS NOT NULL)
        AND EXISTS (SELECT 1 FROM feedback_points fp
                     WHERE fp.feedback_id = f.id AND fp.ask_id IS NOT NULL)
      ORDER BY f.helpful_count DESC, f.submitted_at DESC
      LIMIT 1`,
  )

  if (!row) return null

  const id = str(row, 'id')
  const points = all<Row>(
    `SELECT fp.id, fp.body_md, fp.severity, fp.actionability,
            fp.anchor_kind, fp.anchor_value, fp.upvote_count,
            fc.label AS category_label, a.prompt AS ask_prompt
       FROM feedback_points fp
       JOIN feedback_categories fc ON fc.id = fp.category_id
       LEFT JOIN project_asks a    ON a.id = fp.ask_id
      WHERE fp.feedback_id = ?
      ORDER BY fp.ordinal
      LIMIT 2`,
    [id],
  ).map((point) => {
    const kind = str(point, 'anchor_kind')
    const value = str(point, 'anchor_value')
    const severityKey = str(point, 'severity', 'minor')
    return {
      id: str(point, 'id'),
      categoryLabel: str(point, 'category_label'),
      severityKey,
      severityLabel: SEVERITY_LABELS.get(severityKey) ?? severityKey,
      anchorLabel: kind && value ? `${ANCHOR_WORD[kind] ?? 'At'} ${value}` : null,
      actionabilityLabel: str(point, 'actionability', 'observation'),
      answersAsk: str(point, 'ask_prompt') || null,
      body: str(point, 'body_md'),
      seconded: num(point, 'upvote_count'),
    }
  })

  if (points.length === 0) return null

  const minutes = row['time_spent_minutes']
  const submitted = row['submitted_at']
  const stageKey = str(row, 'stage_key', 'concept')

  return {
    id,
    slug: str(row, 'slug'),
    projectTitle: str(row, 'project_title'),
    typeLabel: str(row, 'type_label'),
    grit: gritFor(stageKey),
    stageLabel: stageLabelFor(stageKey),
    reviewerName: str(row, 'reviewer_name'),
    reviewerHandle: str(row, 'reviewer_handle'),
    versionLabel: str(row, 'version_label'),
    minutes: typeof minutes === 'number' ? minutes : null,
    headline: str(row, 'headline'),
    submittedAt: typeof submitted === 'number' ? submitted : null,
    helpful: num(row, 'helpful_count'),
    ask: points.find((point) => point.answersAsk !== null)?.answersAsk ?? null,
    points,
    pointCount: num(row, 'point_count'),
  }
}

/* ------------------------------------------------------------------------- *
 * 5. The scale, with what is standing on each step
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

function readScaleSteps(): readonly ScaleStep[] {
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
 * 6. The category taxonomy, with real filings
 * ------------------------------------------------------------------------- */

export interface CategoryRow {
  readonly key: string
  readonly label: string
  readonly description: string
  readonly count: number
}

export interface SeverityRow {
  readonly key: string
  readonly label: string
  readonly count: number
}

export interface CategoryTaxonomy {
  readonly universal: readonly CategoryRow[]
  /** Categories a project type adds on top of the universal set. */
  readonly typeSpecific: number
  /** Those extras divided across the kinds of work, for a sentence. */
  readonly typeSpecificPerType: number
  readonly filed: number
  /** Blocker first, keep-this last: the order the product grades in. */
  readonly severities: readonly SeverityRow[]
}

/**
 * The nine categories every project type carries, each with the number of
 * points actually filed under it, and the five severities every point carries.
 */
function readCategoryTaxonomy(): CategoryTaxonomy {
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

  const distinct = num(
    get<Row>(
      `SELECT COUNT(DISTINCT category_key) AS n FROM feedback_categories WHERE is_active = 1`,
    ),
    'n',
  )
  const types = num(get<Row>(`SELECT COUNT(*) AS n FROM project_types`), 'n')

  const severityCounts = new Map(
    all<Row>(
      `SELECT fp.severity AS k, COUNT(*) AS n
         FROM feedback_points fp
         JOIN feedback f ON f.id = fp.feedback_id
        WHERE f.status = 'submitted' AND f.deleted_at IS NULL
        GROUP BY fp.severity`,
    ).map((row) => [str(row, 'k'), num(row, 'n')] as const),
  )

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

  const typeSpecific = Math.max(0, distinct - universalKeys.size)

  return {
    universal: [...universal].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    typeSpecific,
    typeSpecificPerType: types > 0 ? Math.round(typeSpecific / types) : 0,
    filed,
    severities: SEVERITY_LEVELS.map((level) => ({
      key: level.key as string,
      label: level.label as string,
      count: severityCounts.get(level.key as string) ?? 0,
    })),
  }
}

/* ------------------------------------------------------------------------- *
 * 7. Open asks, for the reviewer page
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

export interface OpenAskBoard {
  readonly rows: readonly OpenAskRow[]
  /** How far back the board had to reach to fill itself. */
  readonly windowDays: number
  /** Required asks on open projects that nobody has answered at all. */
  readonly unansweredTotal: number
}

/**
 * The reviewer board: required asks on projects posted recently, fewest answers
 * first and then newest.
 *
 * It used to order by fewest answers and then oldest, over every open project
 * ever posted, and 751 required asks have no answer at all — so every row read
 * "no answers yet, asked 16 months ago" and the site looked abandoned. A
 * reviewer cannot help a question from last year the way they can help one from
 * this week. The window starts at a fortnight and widens only if a fortnight
 * cannot fill the board.
 */
function readOpenAskBoard(limit: number, nowMs: number): OpenAskBoard {
  const board = (days: number): readonly OpenAskRow[] =>
    all<Row>(
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
            AND p.published_at >= ?
       )
       SELECT asks.*,
              (SELECT GROUP_CONCAT(nk.label, '|')
                 FROM project_needs pn
                 JOIN need_kinds nk ON nk.need_key = pn.need_key
                WHERE pn.project_id = asks.pid) AS needs
         FROM asks
        WHERE rn = 1
        ORDER BY answer_count ASC, published_at DESC
        LIMIT ?`,
      [nowMs - days * DAY_MS, limit],
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

  let windowDays = 14
  let rows = board(windowDays)
  for (const wider of [30, 90, 3650]) {
    if (rows.length >= limit) break
    windowDays = wider
    rows = board(windowDays)
  }

  const unansweredTotal = num(
    get<Row>(
      `SELECT COUNT(*) AS n
         FROM projects p
         JOIN project_asks a ON a.project_id = p.id
        WHERE ${PUBLIC_PROJECT} AND p.feedback_state = 'open'
          AND a.is_required = 1 AND a.answer_count = 0`,
    ),
    'n',
  )

  return { rows, windowDays, unansweredTotal }
}

/* ------------------------------------------------------------------------- *
 * 8. Money. It appears on exactly two things: expert reviews and bounties.
 * ------------------------------------------------------------------------- */

export interface BountyFacts {
  readonly openCount: number
  readonly settledCount: number
  readonly lowestOpenCents: number | null
  readonly highestOpenCents: number | null
  /** The middle open bounty, which is what a worked example should use. */
  readonly medianOpenCents: number | null
  readonly currency: string
}

function readBountyFacts(): BountyFacts {
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

  const median = get<Row>(
    `WITH open_b AS (
       SELECT amount_cents FROM bounties WHERE status = 'open' AND visibility = 'public'
     )
     SELECT (SELECT amount_cents FROM open_b ORDER BY amount_cents
              LIMIT 1 OFFSET (SELECT (COUNT(*) - 1) / 2 FROM open_b)) AS mid`,
  )

  const lo = row?.['lo']
  const hi = row?.['hi']
  const mid = median?.['mid']
  return {
    openCount: num(row, 'open_count'),
    settledCount: num(row, 'settled_count'),
    lowestOpenCents: typeof lo === 'number' ? lo : null,
    highestOpenCents: typeof hi === 'number' ? hi : null,
    medianOpenCents: typeof mid === 'number' ? mid : null,
    currency: str(row, 'currency', 'USD'),
  }
}

export interface ExpertRow {
  readonly handle: string
  readonly displayName: string
  readonly headline: string
  readonly minBountyCents: number | null
  readonly turnaroundHours: number | null
  readonly currency: string
}

function readFeaturedExperts(limit: number): readonly ExpertRow[] {
  return getFeaturedExperts(limit).map((expert) => ({
    handle: expert.user.handle,
    displayName: expert.user.displayName,
    headline: expert.headline,
    minBountyCents: expert.minBountyCents,
    turnaroundHours: expert.turnaroundHours,
    currency: expert.currency,
  }))
}

/* ------------------------------------------------------------------------- *
 * 9. Reviews per day
 * ------------------------------------------------------------------------- */

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

/**
 * How many reviews were submitted each day over the last `days` days, ending
 * today. It counts the same rows as the site's review total: submitted and not
 * deleted, dated by when they were submitted rather than when the draft began.
 *
 * The window is anchored on the clock, not on the newest row. Anchoring on the
 * data made a quiet week invisible, because the chart simply ended wherever
 * the last review happened to be. Days are UTC days. Days with no activity are
 * kept rather than dropped: a gap in the record is information, and collapsing
 * it would make the run look busier than it was.
 */
function readArrivalSeries(days: number, nowMs: number): ArrivalSeries {
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

/* ------------------------------------------------------------------------- *
 * 10. One cached reading per page
 * ------------------------------------------------------------------------- *
 * Every public page takes its whole reading from one of these. They carry the
 * `marketing` tag so a future write path can retire them deliberately, and a
 * five-minute life so a number on the homepage is never more than five minutes
 * behind the database while a burst of visitors costs one read between them.
 *
 * The cache key has to include the day for anything dated: `unstable_cache`
 * keys on the arguments it is given, and a function that silently read
 * `Date.now()` inside would serve yesterday's chart with today's label.
 */

const CACHE_LIFE = { revalidate: 300, tags: ['marketing'] }

function today(): number {
  return Math.floor(Date.now() / DAY_MS) * DAY_MS
}

export interface LandingData {
  readonly counts: SiteCounts
  readonly typeLabels: readonly string[]
  readonly proof: readonly ProofRow[]
  readonly split: SplitPlot | null
  readonly splitProjects: number
  readonly specimen: SpecimenReview | null
  readonly arrivals: ArrivalSeries
  readonly taxonomy: CategoryTaxonomy
  readonly steps: readonly ScaleStep[]
  readonly bounties: BountyFacts
}

const readLanding = unstable_cache(
  (dayStart: number): Promise<LandingData> =>
    Promise.resolve({
      counts: readSiteCounts(),
      typeLabels: readProjectTypeLabels(),
      proof: readProofRows(3),
      split: readSplitLeader(),
      splitProjects: readSplitProjectCount(),
      specimen: readSpecimen(),
      arrivals: readArrivalSeries(28, dayStart + DAY_MS - 1),
      taxonomy: readCategoryTaxonomy(),
      steps: readScaleSteps(),
      bounties: readBountyFacts(),
    }),
  ['marketing', 'landing'],
  CACHE_LIFE,
)

export function landingData(): Promise<LandingData> {
  return readLanding(today())
}

export interface HowItWorksData {
  readonly counts: SiteCounts
  readonly taxonomy: CategoryTaxonomy
  readonly steps: readonly ScaleStep[]
}

const readHowItWorks = unstable_cache(
  (): Promise<HowItWorksData> =>
    Promise.resolve({
      counts: readSiteCounts(),
      taxonomy: readCategoryTaxonomy(),
      steps: readScaleSteps(),
    }),
  ['marketing', 'how-it-works'],
  CACHE_LIFE,
)

export function howItWorksData(): Promise<HowItWorksData> {
  return readHowItWorks()
}

export interface ReviewerData {
  readonly counts: SiteCounts
  readonly board: OpenAskBoard
  readonly bounties: BountyFacts
  readonly fees: FeeSchedule
  readonly experts: readonly ExpertRow[]
}

const readReviewer = unstable_cache(
  (dayStart: number): Promise<ReviewerData> =>
    Promise.resolve({
      counts: readSiteCounts(),
      board: readOpenAskBoard(5, dayStart + DAY_MS - 1),
      bounties: readBountyFacts(),
      fees: getBountyFeeSchedule(),
      experts: readFeaturedExperts(3),
    }),
  ['marketing', 'for-reviewers'],
  CACHE_LIFE,
)

export function reviewerData(): Promise<ReviewerData> {
  return readReviewer(today())
}
