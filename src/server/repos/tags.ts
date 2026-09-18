/**
 * Tags and the taxonomy rows the composer and the filter rail read.
 *
 * `tags.usage_count` is denormalised so the picker and the trending rail never
 * aggregate `project_tags` on render. `project_tags` remains the source of
 * truth, and `recountTagUsage` reconciles the two.
 */

import { all, get, run, tx } from '@/server/db/client'
import { now, slugify, uid } from '@/lib/utils'
import {
  PROJECT_TYPES,
  categoriesFor,
  gritValue,
  isProjectTypeSlug,
  stageLabel,
} from '@/lib/taxonomy'
import type {
  ExpertiseAreaRow,
  FeedbackCategoryRow,
  NeedKindRow,
  ProjectStageRow,
  ProjectTypeRow,
  RatingAxisRow,
  TagRow,
  TagView,
} from '@/lib/types'
import { bool, num, pageLimit, placeholders, str, type Row } from './_shared'

/* ------------------------------------------------------------------------- *
 * Taxonomy rows
 * ------------------------------------------------------------------------- */

export function listProjectTypes(): readonly ProjectTypeRow[] {
  return all<ProjectTypeRow>(
    `SELECT * FROM project_types WHERE is_active = 1 ORDER BY sort_order, label`,
  )
}

export function getProjectType(idOrSlug: string): ProjectTypeRow | undefined {
  return get<ProjectTypeRow>(`SELECT * FROM project_types WHERE id = ? OR slug = ?`, [idOrSlug, idOrSlug])
}

export function listStages(projectTypeId: string): readonly ProjectStageRow[] {
  return all<ProjectStageRow>(
    `SELECT * FROM project_stages WHERE project_type_id = ? ORDER BY sort_order`,
    [projectTypeId],
  )
}

export function listCategories(projectTypeId: string): readonly FeedbackCategoryRow[] {
  return all<FeedbackCategoryRow>(
    `SELECT * FROM feedback_categories
      WHERE project_type_id = ? AND is_active = 1
      ORDER BY sort_order, label`,
    [projectTypeId],
  )
}

export function listAxes(projectTypeId: string): readonly RatingAxisRow[] {
  return all<RatingAxisRow>(
    `SELECT * FROM rating_axes
      WHERE project_type_id = ? AND is_active = 1
      ORDER BY sort_order, label`,
    [projectTypeId],
  )
}

export function listNeedKinds(): readonly NeedKindRow[] {
  return all<NeedKindRow>(`SELECT * FROM need_kinds WHERE is_active = 1 ORDER BY sort_order, label`)
}

export function listExpertiseAreas(): readonly ExpertiseAreaRow[] {
  return all<ExpertiseAreaRow>(`SELECT * FROM expertise_areas WHERE is_active = 1 ORDER BY label`)
}

/**
 * The composer's whole vocabulary for one project type, in one call: axes with
 * their written anchors, categories, and the elicitation prompts.
 */
export interface ComposerVocabulary {
  readonly typeSlug: string
  readonly typeLabel: string
  readonly axes: readonly RatingAxisRow[]
  readonly categories: readonly FeedbackCategoryRow[]
  readonly prompts: readonly string[]
  readonly requiredAnchor: 'timecode' | null
  readonly stages: readonly { readonly key: string; readonly label: string; readonly grit: number }[]
}

export function getComposerVocabulary(projectTypeId: string): ComposerVocabulary | undefined {
  const type = getProjectType(projectTypeId)
  if (!type) return undefined
  const slug = type.slug
  const def = isProjectTypeSlug(slug) ? PROJECT_TYPES[slug] : undefined
  const stages = listStages(type.id).map((s) => ({
    key: s.stage_key,
    label: stageLabel(slug, s.stage_key),
    grit: gritValue(s.stage_key),
  }))
  return {
    typeSlug: slug,
    typeLabel: type.label,
    axes: listAxes(type.id),
    // The database is authoritative, but if a type was seeded thin the code
    // taxonomy still answers: a composer with no categories is a dead end.
    categories: listCategories(type.id).length > 0
      ? listCategories(type.id)
      : categoriesFor(slug).map((c, i): FeedbackCategoryRow => ({
          id: `${slug}:${c.key}`,
          project_type_id: type.id,
          category_key: c.key,
          label: c.label,
          description: c.description,
          prompt: null,
          icon: null,
          sort_order: i,
          is_required: 0,
          is_active: 1,
        })),
    prompts: def?.prompts ?? [],
    requiredAnchor: def?.requiredAnchor ?? null,
    stages,
  }
}

/* ------------------------------------------------------------------------- *
 * Tags
 * ------------------------------------------------------------------------- */

export function getTagBySlug(slug: string): TagRow | undefined {
  return get<TagRow>(`SELECT * FROM tags WHERE slug = ? AND is_blocked = 0`, [slug])
}

export function listTags(opts: { readonly kind?: TagRow['kind'] | null; readonly limit?: number } = {}): readonly TagRow[] {
  if (opts.kind) {
    return all<TagRow>(
      `SELECT * FROM tags WHERE is_blocked = 0 AND kind = ? ORDER BY usage_count DESC, label LIMIT ?`,
      [opts.kind, pageLimit(opts.limit, 50)],
    )
  }
  return all<TagRow>(
    `SELECT * FROM tags WHERE is_blocked = 0 ORDER BY usage_count DESC, label LIMIT ?`,
    [pageLimit(opts.limit, 50)],
  )
}

/** The trending rail. Usage count only; no invented velocity figure. */
export function trendingTags(limit = 12, viewerId?: string | null): readonly TagView[] {
  const rows = all<Row>(
    `SELECT t.*, ${viewerId ? '(SELECT 1 FROM tag_follows tf WHERE tf.tag_id = t.id AND tf.user_id = ?)' : 'NULL'} AS followed
       FROM tags t
      WHERE t.is_blocked = 0 AND t.usage_count > 0
      ORDER BY t.usage_count DESC, t.label
      LIMIT ?`,
    viewerId ? [viewerId, pageLimit(limit, 12)] : [pageLimit(limit, 12)],
  )
  return rows.map(mapTagView)
}

/** Tags that co-occur with the ones already chosen. Drives "related tags". */
export function getRelatedTags(tagSlugs: readonly string[], limit = 8): readonly TagRow[] {
  const slugs = [...new Set(tagSlugs)].filter((s) => s.length > 0)
  if (slugs.length === 0) return []
  return all<TagRow>(
    `SELECT t.* FROM tags t
      WHERE t.is_blocked = 0
        AND t.slug NOT IN (${placeholders(slugs.length)})
        AND EXISTS (
          SELECT 1 FROM project_tags pt
           WHERE pt.tag_id = t.id
             AND pt.project_id IN (
               SELECT pt2.project_id FROM project_tags pt2
                 JOIN tags t2 ON t2.id = pt2.tag_id
                WHERE t2.slug IN (${placeholders(slugs.length)})))
      ORDER BY t.usage_count DESC, t.label
      LIMIT ?`,
    [...slugs, ...slugs, pageLimit(limit, 8)],
  )
}

export function searchTags(query: string, limit = 10): readonly TagRow[] {
  const like = `%${query.trim().toLowerCase()}%`
  return all<TagRow>(
    `SELECT * FROM tags
      WHERE is_blocked = 0 AND (slug LIKE ? OR lower(label) LIKE ?)
      ORDER BY usage_count DESC, label
      LIMIT ?`,
    [like, like, pageLimit(limit, 10)],
  )
}

/**
 * Resolves labels to tag rows, creating the ones that do not exist yet. Returns
 * ids in the caller's order so a project's tag order survives the round trip.
 */
export function ensureTags(labels: readonly string[], kind: TagRow['kind'] = 'topic'): readonly string[] {
  const cleaned = labels.map((l) => l.trim()).filter((l) => l.length > 0).slice(0, 12)
  if (cleaned.length === 0) return []
  return tx(() => {
    const ids: string[] = []
    for (const label of cleaned) {
      const slug = slugify(label)
      const existing = get<TagRow>(`SELECT * FROM tags WHERE slug = ?`, [slug])
      if (existing) {
        if (existing.is_blocked === 0) ids.push(existing.id)
        continue
      }
      const id = uid()
      run(
        `INSERT INTO tags (id, slug, label, kind, usage_count, is_blocked, created_at)
         VALUES (?, ?, ?, ?, 0, 0, ?)`,
        [id, slug, label, kind, now()],
      )
      ids.push(id)
    }
    return ids
  })
}

export function followTag(userId: string, tagId: string): void {
  run(
    `INSERT INTO tag_follows (user_id, tag_id, created_at) VALUES (?, ?, ?)
     ON CONFLICT (user_id, tag_id) DO NOTHING`,
    [userId, tagId, now()],
  )
}

export function unfollowTag(userId: string, tagId: string): void {
  run(`DELETE FROM tag_follows WHERE user_id = ? AND tag_id = ?`, [userId, tagId])
}

export function listFollowedTags(userId: string): readonly TagRow[] {
  return all<TagRow>(
    `SELECT t.* FROM tag_follows tf JOIN tags t ON t.id = tf.tag_id
      WHERE tf.user_id = ? AND t.is_blocked = 0
      ORDER BY t.label`,
    [userId],
  )
}

const LIVE_COUNT = `(
  SELECT COUNT(*) FROM project_tags pt
    JOIN projects p ON p.id = pt.project_id
   WHERE pt.tag_id = tags.id
     AND p.deleted_at IS NULL AND p.status = 'published' AND p.visibility = 'public')`

/** Reconciles the denormalised counter with `project_tags`. Cheap, run it freely. */
export function recountTagUsage(): void {
  run(`UPDATE tags SET usage_count = ${LIVE_COUNT}`)
}

/**
 * Recounts just the tags a write touched. Every path that changes which public
 * projects carry a tag calls this: counting up on insert alone let drafts
 * inflate the numbers and never let an edited-away tag come back down.
 */
export function recountTags(tagIds: readonly string[]): void {
  const ids = [...new Set(tagIds)]
  if (ids.length === 0) return
  run(`UPDATE tags SET usage_count = ${LIVE_COUNT} WHERE id IN (${ids.map(() => '?').join(',')})`, ids)
}

/** The tag ids a project carries, for recounting around an edit. */
export function tagIdsForProject(projectId: string): string[] {
  return all<{ tag_id: string }>(`SELECT tag_id FROM project_tags WHERE project_id = ?`, [projectId]).map(
    (r) => r.tag_id,
  )
}

function mapTagView(row: Row): TagView {
  return {
    id: str(row, 'id'),
    slug: str(row, 'slug'),
    label: str(row, 'label'),
    kind: (str(row, 'kind') || 'topic') as TagRow['kind'],
    usageCount: num(row, 'usage_count'),
    viewerFollows: bool(row, 'followed'),
  }
}

/** Exposed for the project editor, which needs the label as well as the id. */
export function getTagsByIds(ids: readonly string[]): readonly TagRow[] {
  const unique = [...new Set(ids)].filter((id) => id.length > 0)
  if (unique.length === 0) return []
  return all<TagRow>(`SELECT * FROM tags WHERE id IN (${placeholders(unique.length)})`, unique)
}
