import { all, get } from '@/server/db/client'
import type { FeedbackInput, ReviewerTier, Severity } from '@/server/ai'

/**
 * Assembles the AI theme clusterer's input from the product tables.
 *
 * The AI layer deliberately never queries `feedback_points` itself, so
 * somebody has to do this join, and it belongs on the calling side of that
 * boundary. This is that side.
 *
 * Two things worth noting about what is selected. First, only submitted,
 * non-deleted points on the current project are included: clustering a
 * withdrawn review would put a quote on a board that no longer exists anywhere
 * else. Second, the reviewer tier comes from the persisted reputation score
 * rather than being recomputed, because the clusterer only uses it as a weight
 * and a stale weight is much cheaper than a reputation recomputation per point.
 */

const TIER_BY_SCORE: readonly { floor: number; tier: ReviewerTier }[] = [
  { floor: 700, tier: 'trusted' },
  { floor: 300, tier: 'established' },
  { floor: 0, tier: 'new' },
]

function tierFor(score: number, isExpert: boolean): ReviewerTier {
  if (isExpert) return 'expert'
  for (const step of TIER_BY_SCORE) if (score >= step.floor) return step.tier
  return 'new'
}

interface PointRow {
  id: string
  reviewer_id: string
  category_key: string
  body_md: string
  severity: string
  actionability: string
  repro_steps: string | null
  created_at: number
  updated_at: number
  score: number | null
  is_expert: number
}

const SEVERITIES = new Set<string>(['praise', 'nit', 'minor', 'major', 'blocker'])

export interface ClusterInput {
  readonly items: readonly FeedbackInput[]
  readonly categories: readonly { key: string; label: string }[]
  readonly ask: string | null
  readonly typeSlug: string
}

export function clusterInputFor(projectId: string, cap = 400): ClusterInput {
  const rows = all<PointRow>(
    `SELECT fp.id, f.reviewer_id, fc.category_key, fp.body_md, fp.severity, fp.actionability,
            fp.repro_steps, fp.created_at, fp.updated_at,
            rs.reviewer_score AS score, u.is_expert
       FROM feedback_points fp
       JOIN feedback f ON f.id = fp.feedback_id
       JOIN feedback_categories fc ON fc.id = fp.category_id
       JOIN users u ON u.id = f.reviewer_id
       LEFT JOIN reputation_scores rs ON rs.user_id = f.reviewer_id
      WHERE f.project_id = ?
        AND f.status = 'submitted'
        AND f.deleted_at IS NULL
      ORDER BY fp.created_at DESC
      LIMIT ?`,
    [projectId, Math.min(Math.max(cap, 1), 2000)],
  )

  const items: FeedbackInput[] = rows.map((row) => ({
    id: row.id,
    reviewerId: row.reviewer_id,
    reviewerTier: tierFor(row.score ?? 0, row.is_expert === 1),
    categoryKey: row.category_key,
    text: row.body_md,
    severity: (SEVERITIES.has(row.severity) ? row.severity : 'minor') as Severity,
    ...(row.repro_steps ? { reproSteps: row.repro_steps } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  const categories = all<{ category_key: string; label: string }>(
    `SELECT DISTINCT fc.category_key, fc.label
       FROM feedback_categories fc
       JOIN projects p ON p.project_type_id = fc.project_type_id
      WHERE p.id = ?
      ORDER BY fc.sort_order`,
    [projectId],
  ).map((row) => ({ key: row.category_key, label: row.label }))

  const context = get<{ prompt: string | null; slug: string }>(
    `SELECT (SELECT pa.prompt FROM project_asks pa
              WHERE pa.project_id = p.id ORDER BY pa.sort_order LIMIT 1) AS prompt,
            pt.slug
       FROM projects p JOIN project_types pt ON pt.id = p.project_type_id
      WHERE p.id = ?`,
    [projectId],
  )

  return {
    items,
    categories,
    ask: context?.prompt ?? null,
    typeSlug: context?.slug ?? 'other',
  }
}

/** The project's own vocabulary, which the coach uses for its on-ask check. */
export function projectVocabularyFor(projectId: string): readonly string[] {
  const tags = all<{ label: string }>(
    `SELECT t.label FROM project_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.project_id = ?`,
    [projectId],
  ).map((row) => row.label)

  const axes = all<{ label: string }>(
    `SELECT ra.label FROM rating_axes ra
       JOIN projects p ON p.project_type_id = ra.project_type_id
      WHERE p.id = ?`,
    [projectId],
  ).map((row) => row.label)

  return [...new Set([...tags, ...axes])]
}
