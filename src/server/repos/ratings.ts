/**
 * Per-axis rating aggregates.
 *
 * Two rules from design/TAXONOMY.md §0 are enforced here rather than in the UI,
 * because a number that leaves this module is a number somebody will render:
 *
 *   "Not enough exposure to rate" is the absence of a `feedback_ratings` row.
 *   It is never counted as a 3, so it cannot quietly drag a mean to the middle.
 *
 *   Axis means are Bayesian-shrunk toward the project type's own global mean,
 *   `μ̂ = (n·x̄ + k·μ_type) / (n + k)` with `k = 4`. Below four ratings the
 *   aggregate reports `showHeadline: false` and the UI shows the range and the
 *   individual ratings instead of a headline number nobody should trust.
 */

import { all, get, run } from '@/server/db/client'
import {
  AXIS_GLOBAL_PRIOR,
  MIN_RATINGS_FOR_HEADLINE,
  RATING_SCALE_MAX,
  shrinkAxisMean,
} from '@/lib/taxonomy'
import type { AxisAggregate, FeedbackRatingRow, Millis } from '@/lib/types'
import { num, numOrNull, str, strOrNull, type Row } from './_shared'

/** Distribution columns are generated for a fixed ladder, never from input. */
const MAX_SCALE = 10

function distributionSelect(): string {
  const parts: string[] = []
  for (let v = 1; v <= MAX_SCALE; v++) {
    parts.push(`SUM(CASE WHEN fr.rating_value = ${v} THEN 1 ELSE 0 END) AS d${v}`)
  }
  return parts.join(', ')
}

/**
 * Every axis for the project's type, whether or not it has ratings yet: an axis
 * nobody rated is information, and dropping it from the list hides it.
 */
export function axisAggregatesForProject(
  projectId: string,
  projectTypeId: string,
): readonly AxisAggregate[] {
  const priors = typeMeans(projectTypeId)

  const rows = all<Row>(
    `SELECT ra.id AS axis_id, ra.axis_key, ra.label, ra.description,
            ra.low_label, ra.high_label, ra.scale_max, ra.sort_order,
            COUNT(fr.id)         AS n,
            AVG(fr.rating_value) AS mean,
            MIN(fr.rating_value) AS lo,
            MAX(fr.rating_value) AS hi,
            ${distributionSelect()}
       FROM rating_axes ra
       LEFT JOIN feedback_ratings fr
              ON fr.axis_id = ra.id
             AND fr.feedback_id IN (
                   SELECT f.id FROM feedback f
                    WHERE f.project_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL)
      WHERE ra.project_type_id = ? AND ra.is_active = 1
      GROUP BY ra.id, ra.axis_key, ra.label, ra.description,
               ra.low_label, ra.high_label, ra.scale_max, ra.sort_order
      ORDER BY ra.sort_order, ra.label`,
    [projectId, projectTypeId],
  )

  return rows.map((r): AxisAggregate => {
    const count = num(r, 'n')
    const rawMean = count > 0 ? numOrNull(r, 'mean') : null
    const scaleMax = num(r, 'scale_max', RATING_SCALE_MAX)
    const prior = priors.get(str(r, 'axis_id')) ?? AXIS_GLOBAL_PRIOR
    const distribution: number[] = []
    for (let v = 1; v <= scaleMax && v <= MAX_SCALE; v++) distribution.push(num(r, `d${v}`))

    return {
      axisId: str(r, 'axis_id'),
      axisKey: str(r, 'axis_key'),
      label: str(r, 'label'),
      definition: strOrNull(r, 'description'),
      lowLabel: strOrNull(r, 'low_label'),
      highLabel: strOrNull(r, 'high_label'),
      scaleMax,
      count,
      rawMean: rawMean === null ? null : round2(rawMean),
      mean:
        count > 0 && rawMean !== null
          ? round2(shrinkAxisMean(rawMean * count, count, prior))
          : null,
      min: count > 0 ? numOrNull(r, 'lo') : null,
      max: count > 0 ? numOrNull(r, 'hi') : null,
      distribution,
      showHeadline: count >= MIN_RATINGS_FOR_HEADLINE,
    }
  })
}

/**
 * The shrinkage prior: this project type's own mean per axis, across every
 * project of that type. Falls back to the global constant while a type is new.
 */
export function typeMeans(projectTypeId: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const r of all<Row>(
    `SELECT fr.axis_id AS axis_id, AVG(fr.rating_value) AS m, COUNT(*) AS n
       FROM feedback_ratings fr
       JOIN feedback f ON f.id = fr.feedback_id
      WHERE fr.project_type_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
      GROUP BY fr.axis_id`,
    [projectTypeId],
  )) {
    // Under a handful of ratings platform-wide the "prior" would be noise.
    if (num(r, 'n') >= 5) out.set(str(r, 'axis_id'), num(r, 'm', AXIS_GLOBAL_PRIOR))
  }
  return out
}

/** How an axis moved build over build. The dashboard's trend chart reads this. */
export interface AxisTrendPoint {
  readonly versionId: string | null
  readonly versionLabel: string
  readonly mean: number | null
  readonly count: number
}

export interface AxisTrend {
  readonly axisId: string
  readonly axisKey: string
  readonly label: string
  readonly points: readonly AxisTrendPoint[]
}

export function axisTrendByVersion(projectId: string, projectTypeId: string): readonly AxisTrend[] {
  const rows = all<Row>(
    `SELECT ra.id AS axis_id, ra.axis_key, ra.label,
            f.version_id AS version_id,
            COALESCE(v.version_label, 'No build') AS version_label,
            COALESCE(v.created_at, f.submitted_at) AS ordered_at,
            AVG(fr.rating_value) AS mean,
            COUNT(*) AS n
       FROM feedback_ratings fr
       JOIN feedback f ON f.id = fr.feedback_id
       JOIN rating_axes ra ON ra.id = fr.axis_id
       LEFT JOIN project_versions v ON v.id = f.version_id
      WHERE f.project_id = ? AND ra.project_type_id = ?
        AND f.status = 'submitted' AND f.deleted_at IS NULL
      GROUP BY ra.id, ra.axis_key, ra.label, f.version_id, version_label, ordered_at
      ORDER BY ra.sort_order, ordered_at`,
    [projectId, projectTypeId],
  )

  const byAxis = new Map<string, { axisKey: string; label: string; points: AxisTrendPoint[] }>()
  for (const r of rows) {
    const axisId = str(r, 'axis_id')
    const entry =
      byAxis.get(axisId) ?? { axisKey: str(r, 'axis_key'), label: str(r, 'label'), points: [] }
    const mean = numOrNull(r, 'mean')
    entry.points.push({
      versionId: strOrNull(r, 'version_id'),
      versionLabel: str(r, 'version_label'),
      mean: mean === null ? null : round2(mean),
      count: num(r, 'n'),
    })
    byAxis.set(axisId, entry)
  }

  return [...byAxis.entries()].map(([axisId, v]) => ({
    axisId,
    axisKey: v.axisKey,
    label: v.label,
    points: v.points,
  }))
}

export function listRatingsForFeedback(feedbackId: string): readonly FeedbackRatingRow[] {
  return all<FeedbackRatingRow>(`SELECT * FROM feedback_ratings WHERE feedback_id = ?`, [feedbackId])
}

/**
 * Rewrites the denormalised headline on `project_stats`. The weighted mean uses
 * each axis's configured `weight`, so a type can say that Fun matters more than
 * Audio without a code change.
 */
export function recomputeProjectRating(projectId: string, at?: Millis): void {
  const row = get<Row>(
    `SELECT
       SUM(fr.rating_value * ra.weight * (5.0 / ra.scale_max)) AS weighted,
       SUM(ra.weight) AS weight_total,
       COUNT(*)       AS n
     FROM feedback_ratings fr
     JOIN feedback f    ON f.id = fr.feedback_id
     JOIN rating_axes ra ON ra.id = fr.axis_id
    WHERE f.project_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL`,
    [projectId],
  )
  const count = num(row, 'n')
  const weightTotal = num(row, 'weight_total')
  const avg = count > 0 && weightTotal > 0 ? num(row, 'weighted') / weightTotal : 0
  run(
    `UPDATE project_stats SET rating_avg = ?, rating_count = ?, computed_at = ? WHERE project_id = ?`,
    [round2(avg), count, at ?? Date.now(), projectId],
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
