import { all } from '@/server/db/client'
import { GRIT_STAGES, gritValue, type GritStageKey } from '@/lib/taxonomy'

/**
 * Read models the sitemap, the RSS feed and the social cards need, and that no
 * repository exposes, because no product surface wanted them.
 *
 * Every one of these is a projection: a list of addresses with a timestamp, or
 * a count per stage. Nothing here duplicates ranking, filtering or hydration
 * logic that lives in `src/server/repos`, and nothing here is called from a
 * page. If one of these ever grows a join it is time to move it.
 */

export interface PublishedProject {
  readonly slug: string
  readonly title: string
  readonly tagline: string | null
  readonly summary: string | null
  readonly typeLabel: string
  readonly stageKey: string
  readonly ownerHandle: string
  readonly ownerName: string
  readonly publishedAt: number
  readonly updatedAt: number
}

interface ProjectRow {
  slug: string
  title: string
  tagline: string | null
  summary_md: string | null
  type_label: string
  stage_key: string
  owner_handle: string
  owner_name: string
  published_at: number
  updated_at: number
}

const PUBLIC_PROJECT = `
  FROM projects p
  JOIN users u ON u.id = p.owner_id
  JOIN profiles pr ON pr.user_id = u.id
  JOIN project_types pt ON pt.id = p.project_type_id
 WHERE p.deleted_at IS NULL
   AND p.status = 'published'
   AND p.visibility = 'public'
   AND p.published_at IS NOT NULL
   AND u.deleted_at IS NULL`

/** Newest first. The feed's window and the sitemap's page both read this. */
export function listPublishedProjects(limit = 200): readonly PublishedProject[] {
  return all<ProjectRow>(
    `SELECT p.slug, p.title, p.tagline, p.summary_md,
            pt.label AS type_label, p.stage_key,
            u.handle AS owner_handle, pr.display_name AS owner_name,
            p.published_at, p.updated_at
     ${PUBLIC_PROJECT}
     ORDER BY p.published_at DESC
     LIMIT ?`,
    [Math.min(Math.max(limit, 1), 2000)],
  ).map((r) => ({
    slug: r.slug,
    title: r.title,
    tagline: r.tagline,
    summary: r.summary_md,
    typeLabel: r.type_label,
    stageKey: r.stage_key,
    ownerHandle: r.owner_handle,
    ownerName: r.owner_name,
    publishedAt: r.published_at,
    updatedAt: r.updated_at,
  }))
}

export interface SitemapEntry {
  readonly path: string
  readonly lastModified: number
}

/** Every profile with at least one published project. Nobody else is indexable. */
export function listPublicProfiles(limit = 1000): readonly SitemapEntry[] {
  return all<{ handle: string; last_modified: number }>(
    `SELECT u.handle, MAX(p.updated_at) AS last_modified
     ${PUBLIC_PROJECT}
     GROUP BY u.id
     ORDER BY last_modified DESC
     LIMIT ?`,
    [Math.min(Math.max(limit, 1), 5000)],
  ).map((r) => ({ path: `/u/${r.handle}`, lastModified: r.last_modified }))
}

export function listPublicThreads(limit = 500): readonly SitemapEntry[] {
  return all<{ id: string; channel: string; last_modified: number }>(
    `SELECT t.id, c.slug AS channel, COALESCE(t.last_post_at, t.created_at) AS last_modified
       FROM discussion_threads t
       JOIN discussion_channels c ON c.id = t.channel_id
      WHERE t.deleted_at IS NULL
        AND t.status IN ('open', 'answered', 'locked')
        AND c.is_private = 0
      ORDER BY last_modified DESC
      LIMIT ?`,
    [Math.min(Math.max(limit, 1), 2000)],
  ).map((r) => ({ path: `/c/${r.channel}/${r.id}`, lastModified: r.last_modified }))
}

export function listPublishedExperts(limit = 500): readonly SitemapEntry[] {
  return all<{ handle: string; last_modified: number }>(
    `SELECT u.handle, e.updated_at AS last_modified
       FROM expert_profiles e
       JOIN users u ON u.id = e.user_id
       LEFT JOIN profiles pr ON pr.user_id = e.user_id
      WHERE e.is_listed = 1 AND u.deleted_at IS NULL AND u.status = 'active'
        AND COALESCE(pr.is_searchable, 1) = 1
      ORDER BY last_modified DESC
      LIMIT ?`,
    [Math.min(Math.max(limit, 1), 2000)],
  ).map((r) => ({ path: `/experts/${r.handle}`, lastModified: r.last_modified }))
}

/* -------------------------------------------------------------------------- *
 * The grit history strip
 * -------------------------------------------------------------------------- */

export interface GritCell {
  readonly key: GritStageKey
  readonly grit: number
  readonly label: string
  readonly count: number
}

/**
 * How many of one creator's public projects have reached each of the five
 * stages. This is the profile surface's organising element, so the social card
 * renders the same data rather than a decorative approximation of it.
 */
export function gritHistoryFor(userId: string): readonly GritCell[] {
  const rows = all<{ stage_key: string; n: number }>(
    `SELECT p.stage_key, COUNT(*) AS n
       FROM projects p
      WHERE p.owner_id = ? AND p.deleted_at IS NULL
        AND p.status = 'published' AND p.visibility = 'public'
      GROUP BY p.stage_key`,
    [userId],
  )
  const counts = new Map<string, number>(rows.map((r) => [r.stage_key, r.n]))
  return GRIT_STAGES.map((stage) => ({
    key: stage.key,
    grit: stage.grit,
    label: stage.label,
    count: counts.get(stage.key) ?? 0,
  }))
}

/** The highest stage a creator has actually reached. Drives the profile rail. */
export function topGritFor(cells: readonly GritCell[]): number {
  let top: number = GRIT_STAGES[0].grit
  for (const cell of cells) {
    if (cell.count > 0 && cell.grit > top) top = cell.grit
  }
  return top
}

export function gritFor(stageKey: string): number {
  const value = gritValue(stageKey)
  return value > 0 ? value : GRIT_STAGES[0].grit
}
