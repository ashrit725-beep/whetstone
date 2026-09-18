/**
 * Aggregates for the landing page, the dashboard, and project analytics.
 *
 * Every figure returned here is computed from real rows. Nothing on this
 * surface is modelled, extrapolated, or carried over from a previous period —
 * a number a creator cannot trace back to a review is worse than no number.
 * Where there is nothing to report, these functions return null and let the UI
 * say so in words.
 */

import { all, get } from '@/server/db/client'
import { now } from '@/lib/utils'
import { QUALIFIED_SPECIFICITY, tierFor } from '@/lib/taxonomy'
import type {
  ActivityEntry,
  DashboardSummary,
  LandingStats,
  Millis,
  ProjectAnalytics,
  SeverityKey,
} from '@/lib/types'
import {
  DAY_MS,
  addSeverity,
  emptySeverityCounts,
  mapUserCardOrNull,
  num,
  numOrNull,
  str,
  strOrNull,
  userCardJoin,
  userCardSelect,
  type Row,
} from './_shared'
import { axisTrendByVersion } from './ratings'
import { computeCreatorStanding } from './reputation'

/* ------------------------------------------------------------------------- *
 * Landing
 * ------------------------------------------------------------------------- */

/**
 * Three real counts and a real median. The landing page is expected to hide the
 * strip rather than render a zero, so no floor is applied here.
 */
export function getLandingStats(): LandingStats {
  const row = get<Row>(
    `SELECT
       (SELECT COUNT(DISTINCT f.project_id) FROM feedback f
         WHERE f.status = 'submitted' AND f.deleted_at IS NULL
           AND COALESCE(f.quality_score, 0) >= ?)                         AS sharpened,
       (SELECT COUNT(*) FROM feedback
         WHERE status = 'submitted' AND deleted_at IS NULL)               AS reviews,
       (SELECT COUNT(*) FROM suggestions WHERE status = 'shipped')        AS shipped`,
    [QUALIFIED_SPECIFICITY],
  )

  // Median, not mean: one project that waited a month should not move the
  // headline that describes the typical wait.
  const gaps = all<Row>(
    `SELECT MIN(f.submitted_at) - p.published_at AS ms
       FROM feedback f
       JOIN projects p ON p.id = f.project_id
      WHERE f.status = 'submitted' AND f.deleted_at IS NULL
        AND p.published_at IS NOT NULL
      GROUP BY f.project_id
      HAVING ms >= 0
      ORDER BY ms`,
  ).map((r) => num(r, 'ms'))

  return {
    projectsSharpened: num(row, 'sharpened'),
    reviewsWritten: num(row, 'reviews'),
    suggestionsShipped: num(row, 'shipped'),
    medianTimeToFirstFeedbackMs: median(gaps),
    computedAt: now(),
  }
}

/* ------------------------------------------------------------------------- *
 * Dashboard
 * ------------------------------------------------------------------------- */

/** The dashboard header, in three queries rather than one per tile. */
export function getDashboardSummary(userId: string): DashboardSummary {
  const owned = get<Row>(
    `SELECT
       COUNT(DISTINCT p.id)                                                   AS projects,
       SUM(CASE WHEN p.status = 'published' THEN 1 ELSE 0 END)                 AS published,
       (SELECT COUNT(*) FROM feedback f JOIN projects p2 ON p2.id = f.project_id
         WHERE p2.owner_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL) AS received,
       (SELECT COUNT(*) FROM feedback f JOIN projects p2 ON p2.id = f.project_id
         WHERE p2.owner_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
           AND f.inbox_state = 'new')                                          AS unread,
       (SELECT COUNT(*) FROM feedback f JOIN projects p2 ON p2.id = f.project_id
         WHERE p2.owner_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
           AND f.first_reply_at IS NULL)                                       AS unanswered,
       (SELECT COUNT(*) FROM feedback_points fp
          JOIN feedback f ON f.id = fp.feedback_id
          JOIN projects p2 ON p2.id = f.project_id
         WHERE p2.owner_id = ? AND fp.severity = 'blocker' AND fp.is_resolved = 0
           AND f.status = 'submitted' AND f.deleted_at IS NULL)                AS blockers
     FROM projects p
    WHERE p.owner_id = ? AND p.deleted_at IS NULL`,
    [userId, userId, userId, userId, userId],
  )

  const written = get<Row>(
    `SELECT
       COUNT(*)                                        AS reviews,
       COALESCE(SUM(creator_marked_helpful), 0)        AS helpful
     FROM feedback
    WHERE reviewer_id = ? AND status = 'submitted' AND deleted_at IS NULL`,
    [userId],
  )

  const shipped = num(
    get<Row>(
      `SELECT COUNT(DISTINCT sg.id) AS n
         FROM suggestions sg
         JOIN suggestion_sources ss ON ss.suggestion_id = sg.id
         JOIN feedback_points fp ON fp.id = ss.point_id
         JOIN feedback f ON f.id = fp.feedback_id
        WHERE f.reviewer_id = ? AND sg.status = 'shipped'`,
      [userId],
    ),
    'n',
  )

  const rep = get<Row>(
    `SELECT total_score FROM reputation_scores WHERE user_id = ?`,
    [userId],
  )
  const unread = num(
    get<Row>(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL`, [userId]),
    'n',
  )
  const standing = computeCreatorStanding(userId)
  const score = num(rep, 'total_score')

  return {
    projects: num(owned, 'projects'),
    publishedProjects: num(owned, 'published'),
    feedbackReceived: num(owned, 'received'),
    unreadFeedback: num(owned, 'unread'),
    unansweredFeedback: num(owned, 'unanswered'),
    blockersOpen: num(owned, 'blockers'),
    reviewsWritten: num(written, 'reviews'),
    helpfulMarks: num(written, 'helpful'),
    shippedFromFeedback: shipped,
    replyRate: standing.replyRate,
    medianResponseMs: standing.medianResponseMs,
    reputation: score,
    tier: tierFor(score).key,
    unreadNotifications: unread,
  }
}

/**
 * The recent-activity rail. One UNION over the four tables that produce
 * activity, ordered once, rather than four lists stitched together in the page.
 *
 * The destinations are the same ones `notification-targets.ts` names, and for
 * the same reason: these three were built here as SQL string concatenation
 * against `/dashboard/inbox/:id`, `/p/:slug/feedback/:id` and
 * `/p/:slug/tracker`, none of which is a route. Every row in this rail was a
 * dead link. Keep them in step with that module; `npm run check:links` follows
 * every one of them.
 */
export function getRecentActivity(userId: string, opts: { readonly limit?: number } = {}): readonly ActivityEntry[] {
  const limit = Math.min(50, Math.max(1, opts.limit ?? 8))
  const rows = all<Row>(
    `SELECT * FROM (
       SELECT f.id AS id, 'feedback_received' AS kind, p.title AS subject, p.title AS project,
              f.headline AS detail,
              '/dashboard/inbox?project=' || p.id || '&note=' || f.id || '#open-note' AS url,
              f.reviewer_id AS actor_id, f.submitted_at AS at
         FROM feedback f JOIN projects p ON p.id = f.project_id
        WHERE p.owner_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
       UNION ALL
       SELECT f.id, 'feedback_written', p.title, p.title, f.headline,
              '/p/' || p.slug || '#note-' || f.id, NULL, f.submitted_at
         FROM feedback f JOIN projects p ON p.id = f.project_id
        WHERE f.reviewer_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
       UNION ALL
       SELECT sg.id, 'suggestion_shipped', sg.title, p.title, sg.status_note,
              '/p/' || p.slug || '/versions', NULL, sg.shipped_at
         FROM suggestions sg JOIN projects p ON p.id = sg.project_id
        WHERE p.owner_id = ? AND sg.status = 'shipped' AND sg.shipped_at IS NOT NULL
       UNION ALL
       SELECT v.id, 'version_published', v.version_label, p.title, v.changelog_md,
              '/p/' || p.slug || '/versions', NULL, v.created_at
         FROM project_versions v JOIN projects p ON p.id = v.project_id
        WHERE p.owner_id = ?
     )
     WHERE at IS NOT NULL
     ORDER BY at DESC
     LIMIT ?`,
    [userId, userId, userId, userId, limit],
  )

  const actorIds = [...new Set(rows.map((r) => strOrNull(r, 'actor_id')).filter((v): v is string => v !== null))]
  const actors = new Map<string, ReturnType<typeof mapUserCardOrNull>>()
  if (actorIds.length > 0) {
    for (const r of all<Row>(
      `SELECT ${userCardSelect('u', 'pr', 'rs', 'a')}
         FROM users u ${userCardJoin('u', 'pr', 'rs')}
        WHERE u.id IN (${actorIds.map(() => '?').join(', ')})`,
      actorIds,
    )) {
      const card = mapUserCardOrNull(r, 'a')
      if (card) actors.set(card.id, card)
    }
  }

  return rows.map((r): ActivityEntry => {
    const kind = str(r, 'kind') as ActivityEntry['kind']
    const actor = actors.get(str(r, 'actor_id')) ?? null
    const detail = strOrNull(r, 'detail')
    return {
      id: str(r, 'id'),
      kind,
      title: activitySentence(kind, str(r, 'subject'), str(r, 'project'), actor?.displayName ?? null),
      detail: kind === 'version_published' && detail ? firstLine(detail) : detail,
      url: str(r, 'url'),
      actor,
      at: num(r, 'at'),
    }
  })
}

/**
 * Who did what to which thing. A row used to read only "Brinehollow", so a
 * review received, a review written and a build published were one word each
 * and told apart by their icons alone.
 */
function activitySentence(
  kind: ActivityEntry['kind'],
  subject: string,
  project: string,
  actor: string | null,
): string {
  switch (kind) {
    case 'feedback_received':
      return `${actor ?? 'A reviewer'} reviewed ${project}`
    case 'feedback_written':
      return `You reviewed ${project}`
    case 'suggestion_shipped':
      return `Shipped: ${subject}`
    case 'version_published':
      return `${project} ${subject} published`
    default:
      return subject
  }
}

/** The opening line of a changelog, without the markdown that starts it. */
function firstLine(markdown: string): string | null {
  const line = markdown
    .split('\n')
    .map((l) => l.replace(/^[\s#>*-]+/u, '').trim())
    .find((l) => l.length > 0)
  return line ?? null
}

/* ------------------------------------------------------------------------- *
 * Project analytics
 * ------------------------------------------------------------------------- */

export type AnalyticsRange = '7d' | '30d' | '90d' | 'all'

function rangeStart(range: AnalyticsRange, at: Millis): number {
  if (range === '7d') return at - 7 * DAY_MS
  if (range === '30d') return at - 30 * DAY_MS
  if (range === '90d') return at - 90 * DAY_MS
  return 0
}

export function getProjectAnalytics(
  projectId: string,
  opts: { readonly range?: AnalyticsRange } = {},
): ProjectAnalytics | undefined {
  const at = now()
  const range = opts.range ?? '30d'
  const since = rangeStart(range, at)

  const project = get<Row>(
    `SELECT p.id, p.project_type_id, COALESCE(st.view_count, 0) AS views,
            COALESCE(st.reply_rate, 0.0) AS reply_rate
       FROM projects p LEFT JOIN project_stats st ON st.project_id = p.id
      WHERE p.id = ? AND p.deleted_at IS NULL`,
    [projectId],
  )
  if (!project) return undefined

  const totals = get<Row>(
    `SELECT COUNT(*) AS reviews,
            COUNT(DISTINCT reviewer_id) AS reviewers,
            SUM(CASE WHEN COALESCE(quality_score, 0) >= ? THEN 1 ELSE 0 END) AS qualified
       FROM feedback
      WHERE project_id = ? AND status = 'submitted' AND deleted_at IS NULL
        AND submitted_at >= ?`,
    [QUALIFIED_SPECIFICITY, projectId, since],
  )

  const bySeverity = emptySeverityCounts()
  for (const r of all<Row>(
    `SELECT fp.severity AS severity, COUNT(*) AS n
       FROM feedback_points fp JOIN feedback f ON f.id = fp.feedback_id
      WHERE f.project_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
        AND f.submitted_at >= ?
      GROUP BY fp.severity`,
    [projectId, since],
  )) {
    addSeverity(bySeverity, str(r, 'severity'), num(r, 'n'))
  }

  const byCategory = all<Row>(
    `SELECT fc.category_key AS key, fc.label AS label, COUNT(*) AS n,
            AVG(CAST(fp.sentiment AS REAL)) AS sentiment
       FROM feedback_points fp
       JOIN feedback f ON f.id = fp.feedback_id
       LEFT JOIN feedback_categories fc ON fc.id = fp.category_id
      WHERE f.project_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
        AND f.submitted_at >= ?
      GROUP BY fc.category_key, fc.label
      ORDER BY n DESC`,
    [projectId, since],
  ).map((r) => ({
    key: str(r, 'key'),
    label: str(r, 'label') || str(r, 'key'),
    count: num(r, 'n'),
    sentiment: round2(num(r, 'sentiment')),
  }))

  const byVersion = all<Row>(
    `SELECT v.id AS version_id, v.version_label AS label,
            COUNT(f.id) AS n,
            AVG(fr.rating_value) AS rating_avg
       FROM project_versions v
       LEFT JOIN feedback f ON f.version_id = v.id
                           AND f.status = 'submitted' AND f.deleted_at IS NULL
       LEFT JOIN feedback_ratings fr ON fr.feedback_id = f.id
      WHERE v.project_id = ?
      GROUP BY v.id, v.version_label
      ORDER BY v.created_at`,
    [projectId],
  ).map((r) => ({
    versionId: str(r, 'version_id'),
    label: str(r, 'label'),
    count: num(r, 'n'),
    rating: numOrNull(r, 'rating_avg'),
  }))

  const responseDeltas = all<Row>(
    `SELECT first_reply_at - submitted_at AS ms FROM feedback
      WHERE project_id = ? AND first_reply_at IS NOT NULL AND submitted_at IS NOT NULL
      ORDER BY ms`,
    [projectId],
  ).map((r) => num(r, 'ms'))

  const timeline = all<Row>(
    `SELECT CAST(f.submitted_at / ? AS INTEGER) AS day,
            COUNT(*) AS feedback,
            SUM(CASE WHEN f.first_reply_at IS NOT NULL THEN 1 ELSE 0 END) AS replies
       FROM feedback f
      WHERE f.project_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
        AND f.submitted_at >= ?
      GROUP BY day
      ORDER BY day`,
    [DAY_MS, projectId, since],
  ).map((r) => ({
    day: num(r, 'day') * DAY_MS,
    feedback: num(r, 'feedback'),
    replies: num(r, 'replies'),
  }))

  return {
    projectId,
    range,
    views: num(project, 'views'),
    feedbackCount: num(totals, 'reviews'),
    reviewerCount: num(totals, 'reviewers'),
    qualifiedCount: num(totals, 'qualified'),
    replyRate: num(project, 'reply_rate'),
    medianResponseMs: median(responseDeltas),
    bySeverity,
    byCategory,
    byVersion: byVersion.map((v) => ({
      versionId: v.versionId,
      label: v.label,
      count: v.count,
      ratingAvg: v.rating === null ? null : round2(v.rating),
    })),
    axisTrend: axisTrendByVersion(projectId, str(project, 'project_type_id')).map((t) => ({
      axisKey: t.axisKey,
      label: t.label,
      points: t.points.map((p) => ({ versionLabel: p.versionLabel, mean: p.mean, count: p.count })),
    })),
    timeline,
  }
}

/** Severity split for one project, for callers that want only this slice. */
export function severityBreakdown(projectId: string): Readonly<Record<SeverityKey, number>> {
  const out = emptySeverityCounts()
  for (const r of all<Row>(
    `SELECT fp.severity AS severity, COUNT(*) AS n
       FROM feedback_points fp JOIN feedback f ON f.id = fp.feedback_id
      WHERE f.project_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
      GROUP BY fp.severity`,
    [projectId],
  )) {
    addSeverity(out, str(r, 'severity'), num(r, 'n'))
  }
  return out
}

function median(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? null
  const a = sorted[mid - 1]
  const b = sorted[mid]
  if (a === undefined || b === undefined) return null
  return Math.round((a + b) / 2)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
