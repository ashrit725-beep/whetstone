/**
 * Reads for the four marketing surfaces.
 *
 * The landing page is not allowed to invent a number (§7.1.6, gate 9.6.43), and
 * it is not allowed to render a mock-up of the product either: the hero figure
 * holds real Discover rows and the full-bleed rail holds one real project per
 * grit stage. Those shapes are not in `src/server/repos/**`, so the queries live
 * here rather than being bolted onto a repository another surface owns.
 *
 * Every function returns plain, already-shaped data. Nothing here formats, and
 * nothing here falls back to a placeholder: when a query finds nothing the
 * caller gets an empty array and renders its empty state in words.
 */

import { all, get } from '@/server/db/client'
import { GRIT_STAGES } from '@/lib/taxonomy'

type Row = Record<string, unknown>

function str(row: Row | undefined, key: string, fallback = ''): string {
  const value = row?.[key]
  return typeof value === 'string' ? value : fallback
}

function strOrNull(row: Row | undefined, key: string): string | null {
  const value = row?.[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

function num(row: Row | undefined, key: string, fallback = 0): number {
  const value = row?.[key]
  return typeof value === 'number' ? value : Number(value ?? fallback) || fallback
}

/* ------------------------------------------------------------------------- *
 * The hero figure: real Discover rows
 * ------------------------------------------------------------------------- */

export interface MarketingFeedRow {
  readonly slug: string
  readonly title: string
  /** The creator’s own question. This is what a reviewer reads first. */
  readonly ask: string
  readonly typeLabel: string
  readonly stageKey: string
  readonly grit: number
  readonly feedbackCount: number
}

const FEED_ROW_SQL = `
  SELECT p.slug, p.title, p.stage_key, pt.label AS type_label,
         COALESCE(
           (SELECT a.prompt FROM project_asks a
             WHERE a.project_id = p.id ORDER BY a.sort_order LIMIT 1),
           p.tagline, '') AS ask,
         (SELECT COUNT(*) FROM feedback f
           WHERE f.project_id = p.id AND f.status = 'submitted'
             AND f.deleted_at IS NULL) AS feedback_count
    FROM projects p
    JOIN project_types pt ON pt.id = p.project_type_id
   WHERE p.status = 'published' AND p.visibility = 'public'
     AND p.deleted_at IS NULL AND p.is_nsfw = 0
`

function gritFor(stageKey: string): number {
  return GRIT_STAGES.find((stage) => stage.key === stageKey)?.grit ?? 120
}

function toFeedRow(row: Row): MarketingFeedRow {
  const stageKey = str(row, 'stage_key', 'concept')
  return {
    slug: str(row, 'slug'),
    title: str(row, 'title'),
    ask: str(row, 'ask'),
    typeLabel: str(row, 'type_label'),
    stageKey,
    grit: gritFor(stageKey),
    feedbackCount: num(row, 'feedback_count'),
  }
}

/**
 * The projects the hero figure shows: the most-reviewed project at each grit
 * stage, then the busiest of those. One per stage is a stated rule rather than
 * a taste call, and it is what makes the figure show the scale working instead
 * of three projects that happen to sit at the same number. The figure's caption
 * says exactly this, so the selection is visible to the reader.
 */
export function featuredFeedRows(limit = 3): readonly MarketingFeedRow[] {
  return all<Row>(
    `WITH candidates AS (${FEED_ROW_SQL})
     SELECT * FROM (
       SELECT *, ROW_NUMBER() OVER (
                   PARTITION BY stage_key
                   ORDER BY feedback_count DESC, title
                 ) AS rank_in_stage
         FROM candidates
     )
      WHERE rank_in_stage = 1
      ORDER BY feedback_count DESC, title
      LIMIT ?`,
    [limit],
  ).map(toFeedRow)
}

/* ------------------------------------------------------------------------- *
 * The full-bleed grit rail: one real project per stage
 * ------------------------------------------------------------------------- */

export interface GritLadderCell {
  readonly stageKey: string
  readonly grit: number
  readonly stageLabel: string
  readonly definition: string
  /** Null when no published project currently sits at this stage. */
  readonly project: { readonly slug: string; readonly title: string; readonly typeLabel: string } | null
  /** How many published projects sit at this stage right now. */
  readonly count: number
}

/**
 * Five cells, coarse to fine. The project shown at each stage is the one with
 * the most feedback on it, which makes the rail a live reading of the feed
 * rather than a diagram of the scale.
 */
export function gritLadder(): readonly GritLadderCell[] {
  const rows = all<Row>(
    `SELECT p.stage_key, p.slug, p.title, pt.label AS type_label,
            (SELECT COUNT(*) FROM feedback f
              WHERE f.project_id = p.id AND f.status = 'submitted'
                AND f.deleted_at IS NULL) AS feedback_count
       FROM projects p
       JOIN project_types pt ON pt.id = p.project_type_id
      WHERE p.status = 'published' AND p.visibility = 'public'
        AND p.deleted_at IS NULL AND p.is_nsfw = 0
      ORDER BY feedback_count DESC`,
  )

  return GRIT_STAGES.map((stage) => {
    const atStage = rows.filter((row) => str(row, 'stage_key') === stage.key)
    const top = atStage[0]
    return {
      stageKey: stage.key,
      grit: stage.grit,
      stageLabel: stage.label,
      definition: stage.definition,
      count: atStage.length,
      project: top
        ? {
            slug: str(top, 'slug'),
            title: str(top, 'title'),
            typeLabel: str(top, 'type_label'),
          }
        : null,
    }
  })
}

/* ------------------------------------------------------------------------- *
 * Counts the landing page states in words
 * ------------------------------------------------------------------------- */

export interface MarketingCounts {
  readonly openProjects: number
  readonly reviews: number
  /** Individual points raised inside those reviews: the unit a creator fixes. */
  readonly points: number
  readonly shippedSuggestions: number
  readonly projectTypes: number
  readonly reviewers: number
}

export function marketingCounts(): MarketingCounts {
  const row = get<Row>(
    `SELECT
       (SELECT COUNT(*) FROM projects
         WHERE status = 'published' AND visibility = 'public'
           AND feedback_state = 'open' AND deleted_at IS NULL)              AS open_projects,
       (SELECT COUNT(*) FROM feedback
         WHERE status = 'submitted' AND deleted_at IS NULL)                 AS reviews,
       (SELECT COUNT(*) FROM feedback_points fp
          JOIN feedback f ON f.id = fp.feedback_id
         WHERE f.status = 'submitted' AND f.deleted_at IS NULL)             AS points,
       (SELECT COUNT(*) FROM suggestions WHERE status = 'shipped')          AS shipped,
       (SELECT COUNT(*) FROM project_types)                                 AS types,
       (SELECT COUNT(DISTINCT reviewer_id) FROM feedback
         WHERE status = 'submitted' AND deleted_at IS NULL)                 AS reviewers`,
  )

  return {
    openProjects: num(row, 'open_projects'),
    reviews: num(row, 'reviews'),
    points: num(row, 'points'),
    shippedSuggestions: num(row, 'shipped'),
    projectTypes: num(row, 'types'),
    reviewers: num(row, 'reviewers'),
  }
}

/** Published projects per type, for the “who posts here” list. */
export interface TypeCount {
  readonly slug: string
  readonly label: string
  readonly count: number
}

export function publishedByType(): readonly TypeCount[] {
  return all<Row>(
    `SELECT pt.slug, pt.label, pt.sort_order,
            (SELECT COUNT(*) FROM projects p
              WHERE p.project_type_id = pt.id AND p.status = 'published'
                AND p.visibility = 'public' AND p.deleted_at IS NULL) AS n
       FROM project_types pt
      ORDER BY pt.sort_order`,
  ).map((row) => ({
    slug: str(row, 'slug'),
    label: str(row, 'label'),
    count: num(row, 'n'),
  }))
}

/* ------------------------------------------------------------------------- *
 * One real ask, quoted whole
 * ------------------------------------------------------------------------- */

export interface AskSpotlight {
  readonly slug: string
  readonly projectTitle: string
  readonly typeLabel: string
  readonly grit: number
  readonly stageKey: string
  readonly prompt: string
  readonly detail: string | null
  readonly ownerName: string
  readonly ownerHandle: string
  readonly reviews: number
  readonly points: number
  readonly blockers: number
  readonly themes: number
}

/**
 * The single most-reviewed project’s first required ask, with what came back.
 * This is the page’s proof, and it is one real project rather than a strip of
 * invented testimonials (§8.5.50).
 */
export function askSpotlight(): AskSpotlight | null {
  const row = get<Row>(
    `SELECT p.slug, p.title, p.stage_key, pt.label AS type_label,
            a.prompt, a.detail_md,
            pr.display_name AS owner_name, u.handle AS owner_handle,
            (SELECT COUNT(*) FROM feedback f
              WHERE f.project_id = p.id AND f.status = 'submitted'
                AND f.deleted_at IS NULL)                                  AS reviews,
            (SELECT COUNT(*) FROM feedback_points fp
               JOIN feedback f ON f.id = fp.feedback_id
              WHERE f.project_id = p.id AND f.status = 'submitted'
                AND f.deleted_at IS NULL)                                  AS points,
            (SELECT COUNT(*) FROM feedback_points fp
               JOIN feedback f ON f.id = fp.feedback_id
              WHERE f.project_id = p.id AND f.status = 'submitted'
                AND f.deleted_at IS NULL AND fp.severity = 'blocker')      AS blockers,
            (SELECT COUNT(*) FROM feedback_themes t
              WHERE t.project_id = p.id)                                   AS themes
       FROM projects p
       JOIN project_types pt ON pt.id = p.project_type_id
       JOIN project_asks a ON a.project_id = p.id
       JOIN users u ON u.id = p.owner_id
       JOIN profiles pr ON pr.user_id = u.id
      WHERE p.status = 'published' AND p.visibility = 'public'
        AND p.deleted_at IS NULL AND a.is_required = 1
      ORDER BY reviews DESC, a.sort_order
      LIMIT 1`,
  )
  if (!row) return null

  const stageKey = str(row, 'stage_key', 'concept')
  return {
    slug: str(row, 'slug'),
    projectTitle: str(row, 'title'),
    typeLabel: str(row, 'type_label'),
    stageKey,
    grit: gritFor(stageKey),
    prompt: str(row, 'prompt'),
    detail: strOrNull(row, 'detail_md'),
    ownerName: str(row, 'owner_name'),
    ownerHandle: str(row, 'owner_handle'),
    reviews: num(row, 'reviews'),
    points: num(row, 'points'),
    blockers: num(row, 'blockers'),
    themes: num(row, 'themes'),
  }
}

/* ------------------------------------------------------------------------- *
 * Open asks, for the reviewer page
 * ------------------------------------------------------------------------- */

export interface OpenAsk {
  readonly slug: string
  readonly projectTitle: string
  readonly typeLabel: string
  readonly grit: number
  readonly stageKey: string
  readonly prompt: string
  readonly needs: readonly string[]
  readonly answers: number
}

export function openAsks(limit = 5): readonly OpenAsk[] {
  const rows = all<Row>(
    `SELECT p.slug, p.title, p.stage_key, pt.label AS type_label,
            a.prompt, a.answer_count,
            (SELECT GROUP_CONCAT(nk.label, '|')
               FROM project_needs pn JOIN need_kinds nk ON nk.need_key = pn.need_key
              WHERE pn.project_id = p.id) AS needs
       FROM projects p
       JOIN project_types pt ON pt.id = p.project_type_id
       JOIN project_asks a ON a.project_id = p.id
      WHERE p.status = 'published' AND p.visibility = 'public'
        AND p.deleted_at IS NULL AND p.feedback_state = 'open'
        AND a.is_required = 1
      ORDER BY a.answer_count ASC, p.published_at DESC
      LIMIT ?`,
    [limit],
  )

  return rows.map((row) => {
    const stageKey = str(row, 'stage_key', 'concept')
    const needs = strOrNull(row, 'needs')
    return {
      slug: str(row, 'slug'),
      projectTitle: str(row, 'title'),
      typeLabel: str(row, 'type_label'),
      stageKey,
      grit: gritFor(stageKey),
      prompt: str(row, 'prompt'),
      needs: needs ? needs.split('|').filter((n) => n.length > 0) : [],
      answers: num(row, 'answer_count'),
    }
  })
}

