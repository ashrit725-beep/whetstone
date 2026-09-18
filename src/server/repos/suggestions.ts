/**
 * The suggestion tracker — the promise the product makes to reviewers.
 *
 *   open → acknowledged → planned → shipped | declined | duplicate
 *
 * Two rules from design/TAXONOMY.md §2.7 are enforced in code because the
 * schema can only half-enforce them:
 *
 *   `shipped` has to link a version, a changelog entry, or a commit. That is
 *   what makes follow-through auditable rather than claimable.
 *
 *   `declined` on an S0 or S1 owes a written reason. Cheap to write, and it
 *   keeps the thread honest in both directions.
 *
 * Shipping is also the single most effective retention mechanic on the
 * platform, so it notifies every contributing reviewer by name and credits
 * their ledger in the same transaction.
 */

import { all, get, run, tx } from '@/server/db/client'
import { projectBuildsUrl, projectUrl } from './notification-targets'
import { now, uid } from '@/lib/utils'
import { effort as effortLevel, priorityQuadrant } from '@/lib/taxonomy'
import type {
  EffortKey,
  Millis,
  Page,
  PageOptions,
  SeverityKey,
  SuggestionRow,
  SuggestionStatus,
  SuggestionTimelineEntry,
  SuggestionView,
  UserCard,
} from '@/lib/types'
import {
  decodeCursor,
  encodeCursor,
  mapUserCard,
  mapUserCardOrNull,
  num,
  numOrNull,
  pageLimit,
  placeholders,
  str,
  strOrNull,
  toPage,
  userCardJoin,
  userCardSelect,
  type Row,
} from './_shared'
import { notify } from './notifications'
import { invalidateReputation, recordReputationEvent } from './reputation'

const STATUS_LABEL: Record<SuggestionStatus, string> = {
  open: 'Open',
  under_review: 'Under review',
  planned: 'Planned',
  in_progress: 'In progress',
  shipped: 'Shipped',
  declined: 'Declined',
  duplicate: 'Duplicate',
  wont_fix: 'Not planned',
}

export function statusLabel(status: SuggestionStatus): string {
  return STATUS_LABEL[status] ?? status
}

/* ------------------------------------------------------------------------- *
 * Reads
 * ------------------------------------------------------------------------- */

export type SuggestionSort = 'top' | 'newest' | 'recently_moved'

export interface SuggestionFilters extends PageOptions {
  readonly projectId?: string | null
  /** All of one creator's projects, for the dashboard tracker. */
  readonly ownerId?: string | null
  readonly status?: SuggestionStatus | null
  readonly themeId?: string | null
  readonly sort?: SuggestionSort
  readonly viewerId?: string | null
}

const SORT_COLUMN: Record<SuggestionSort, string> = {
  top: 's.vote_count',
  newest: 's.created_at',
  recently_moved: 'COALESCE(s.status_changed_at, s.created_at)',
}

export function listSuggestions(filters: SuggestionFilters = {}): Page<SuggestionView> {
  const limit = pageLimit(filters.limit, 25)
  const sort: SuggestionSort = filters.sort ?? 'top'
  const column = SORT_COLUMN[sort]
  const cursor = decodeCursor(filters.cursor)

  const where: string[] = ['p.deleted_at IS NULL']
  const params: unknown[] = []
  if (filters.projectId) {
    where.push('s.project_id = ?')
    params.push(filters.projectId)
  }
  if (filters.ownerId) {
    where.push('p.owner_id = ?')
    params.push(filters.ownerId)
  }
  if (filters.status) {
    where.push('s.status = ?')
    params.push(filters.status)
  }
  if (filters.themeId) {
    where.push('s.theme_id = ?')
    params.push(filters.themeId)
  }
  if (cursor) {
    where.push(`(${column} < ? OR (${column} = ? AND s.id < ?))`)
    params.push(num(cursor, 'v'), num(cursor, 'v'), str(cursor, 'id'))
  }

  const viewerId = filters.viewerId ?? null
  const rows = all<Row>(
    `SELECT s.*, p.slug AS project_slug, p.title AS project_title,
            t.label AS theme_label, fc.label AS category_label,
            v.version_label AS shipped_version,
            ${viewerId ? '(SELECT 1 FROM suggestion_votes sv WHERE sv.suggestion_id = s.id AND sv.voter_id = ?)' : 'NULL'} AS viewer_voted,
            ${column} AS sort_value
       FROM suggestions s
       JOIN projects p ON p.id = s.project_id
       LEFT JOIN feedback_themes t ON t.id = s.theme_id
       LEFT JOIN feedback_categories fc ON fc.id = s.category_id
       LEFT JOIN project_versions v ON v.id = s.shipped_in_version_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${column} DESC, s.id DESC
      LIMIT ?`,
    [...(viewerId ? [viewerId] : []), ...params, limit + 1],
  )

  const page = toPage(rows, limit, (last) =>
    encodeCursor({ v: num(last, 'sort_value'), id: str(last, 'id') }),
  )
  return {
    items: hydrateSuggestions(page.items),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  }
}

/** The public roadmap board. Same query, scoped and without private statuses. */
export function listPublicSuggestions(args: SuggestionFilters & { projectId: string }): Page<SuggestionView> {
  return listSuggestions(args)
}

export function getSuggestion(suggestionId: string, viewerId?: string | null): SuggestionView | undefined {
  const row = get<Row>(
    `SELECT s.*, p.slug AS project_slug, p.title AS project_title,
            t.label AS theme_label, fc.label AS category_label,
            v.version_label AS shipped_version,
            ${viewerId ? '(SELECT 1 FROM suggestion_votes sv WHERE sv.suggestion_id = s.id AND sv.voter_id = ?)' : 'NULL'} AS viewer_voted
       FROM suggestions s
       JOIN projects p ON p.id = s.project_id
       LEFT JOIN feedback_themes t ON t.id = s.theme_id
       LEFT JOIN feedback_categories fc ON fc.id = s.category_id
       LEFT JOIN project_versions v ON v.id = s.shipped_in_version_id
      WHERE s.id = ?`,
    [...(viewerId ? [viewerId] : []), suggestionId],
  )
  if (!row) return undefined
  return hydrateSuggestions([row])[0]
}

/** Contributors resolved for the whole page in one query, never one per row. */
function hydrateSuggestions(rows: readonly Row[]): readonly SuggestionView[] {
  if (rows.length === 0) return []
  const ids = rows.map((r) => str(r, 'id'))

  const contributorsBySuggestion = new Map<string, UserCard[]>()
  for (const r of all<Row>(
    `SELECT DISTINCT ss.suggestion_id, ${userCardSelect('u', 'pr', 'rs', 'c')}
       FROM suggestion_sources ss
       JOIN feedback_points fp ON fp.id = ss.point_id
       JOIN feedback f ON f.id = fp.feedback_id
       JOIN users u ON u.id = f.reviewer_id
       ${userCardJoin('u', 'pr', 'rs')}
      WHERE ss.suggestion_id IN (${placeholders(ids.length)})`,
    ids,
  )) {
    const key = str(r, 'suggestion_id')
    const list = contributorsBySuggestion.get(key) ?? []
    list.push(mapUserCard(r, 'c'))
    contributorsBySuggestion.set(key, list)
  }

  // Worst severity per suggestion, for the whole page, in one grouped query.
  const worstBySuggestion = new Map<string, SeverityKey>()
  for (const r of all<Row>(
    `SELECT ss.suggestion_id AS suggestion_id,
            MIN(CASE fp.severity
                  WHEN 'blocker' THEN 0 WHEN 'major' THEN 1
                  WHEN 'minor' THEN 2 WHEN 'nit' THEN 3 ELSE 4 END) AS rank
       FROM suggestion_sources ss
       JOIN feedback_points fp ON fp.id = ss.point_id
      WHERE ss.suggestion_id IN (${placeholders(ids.length)})
      GROUP BY ss.suggestion_id`,
    ids,
  )) {
    const ladder: SeverityKey[] = ['blocker', 'major', 'minor', 'nit', 'praise']
    worstBySuggestion.set(str(r, 'suggestion_id'), ladder[num(r, 'rank', 2)] ?? 'minor')
  }

  return rows.map((r): SuggestionView => {
    const status = (str(r, 'status') || 'open') as SuggestionStatus
    const effortKey = (strOrNull(r, 'effort') as EffortKey | null) ?? null
    const level = effortKey ? effortLevel(effortKey) : undefined
    // Priority is severity against effort. With no severity on the suggestion
    // itself, the worst severity among its sources is the honest reading.
    const worst = worstBySuggestion.get(str(r, 'id')) ?? 'minor'
    return {
      id: str(r, 'id'),
      projectId: str(r, 'project_id'),
      projectSlug: str(r, 'project_slug'),
      projectTitle: str(r, 'project_title'),
      title: str(r, 'title'),
      bodyMd: strOrNull(r, 'body_md'),
      status,
      statusLabel: statusLabel(status),
      statusNote: strOrNull(r, 'status_note'),
      priority: (str(r, 'priority') || 'normal') as SuggestionView['priority'],
      effort: effortKey,
      effortCode: level?.code ?? null,
      effortLabel: level?.label ?? null,
      quadrant: priorityQuadrant(worst, effortKey),
      themeId: strOrNull(r, 'theme_id'),
      themeLabel: strOrNull(r, 'theme_label'),
      categoryLabel: strOrNull(r, 'category_label'),
      voteCount: num(r, 'vote_count'),
      sourceCount: num(r, 'source_count'),
      contributors: contributorsBySuggestion.get(str(r, 'id')) ?? [],
      shippedInVersion: strOrNull(r, 'shipped_version'),
      shippedAt: numOrNull(r, 'shipped_at'),
      statusChangedAt: numOrNull(r, 'status_changed_at'),
      createdAt: num(r, 'created_at'),
      viewerVoted: num(r, 'viewer_voted') === 1,
    }
  })
}

export interface SuggestionCounts {
  readonly total: number
  readonly byStatus: Readonly<Record<SuggestionStatus, number>>
}

export function getSuggestionCounts(args: { projectId?: string | null; ownerId?: string | null }): SuggestionCounts {
  const byStatus: Record<SuggestionStatus, number> = {
    open: 0, under_review: 0, planned: 0, in_progress: 0,
    shipped: 0, declined: 0, duplicate: 0, wont_fix: 0,
  }
  const rows = all<Row>(
    `SELECT s.status AS status, COUNT(*) AS n
       FROM suggestions s JOIN projects p ON p.id = s.project_id
      WHERE (? IS NULL OR s.project_id = ?) AND (? IS NULL OR p.owner_id = ?)
        AND p.deleted_at IS NULL
      GROUP BY s.status`,
    [args.projectId ?? null, args.projectId ?? null, args.ownerId ?? null, args.ownerId ?? null],
  )
  let total = 0
  for (const r of rows) {
    const status = str(r, 'status') as SuggestionStatus
    const n = num(r, 'n')
    if (status in byStatus) byStatus[status] = n
    total += n
  }
  return { total, byStatus }
}

export function listSuggestionTimeline(suggestionId: string): readonly SuggestionTimelineEntry[] {
  return all<Row>(
    `SELECT se.*, ${userCardSelect('u', 'pr', 'rs', 'a')}
       FROM suggestion_events se
       LEFT JOIN users u ON u.id = se.actor_id
       ${userCardJoin('u', 'pr', 'rs')}
      WHERE se.suggestion_id = ?
      ORDER BY se.created_at DESC`,
    [suggestionId],
  ).map(
    (r): SuggestionTimelineEntry => ({
      id: str(r, 'id'),
      fromStatus: (strOrNull(r, 'from_status') as SuggestionStatus | null) ?? null,
      toStatus: str(r, 'to_status') as SuggestionStatus,
      note: strOrNull(r, 'note'),
      actor: mapUserCardOrNull(r, 'a'),
      createdAt: num(r, 'created_at'),
    }),
  )
}

/* ------------------------------------------------------------------------- *
 * Writes
 * ------------------------------------------------------------------------- */

export interface NewSuggestionInput {
  readonly projectId: string
  readonly createdBy: string
  readonly title: string
  readonly bodyMd?: string | null
  readonly themeId?: string | null
  readonly categoryId?: string | null
  readonly priority?: SuggestionRow['priority']
  readonly effort?: EffortKey | null
  /** The feedback points this suggestion answers. This is the evidence link. */
  readonly sourcePointIds?: readonly string[]
}

export function createSuggestion(input: NewSuggestionInput): string {
  const id = uid()
  const ts = now()
  tx(() => {
    run(
      `INSERT INTO suggestions
         (id, project_id, theme_id, category_id, created_by, title, body_md,
          status, priority, effort, vote_count, source_count,
          status_changed_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, 0, ?, ?, ?, ?)`,
      [
        id,
        input.projectId,
        input.themeId ?? null,
        input.categoryId ?? null,
        input.createdBy,
        input.title,
        input.bodyMd ?? null,
        input.priority ?? 'normal',
        input.effort ?? null,
        input.sourcePointIds?.length ?? 0,
        ts,
        ts,
        ts,
      ],
    )
    for (const pointId of input.sourcePointIds ?? []) {
      run(
        `INSERT INTO suggestion_sources (suggestion_id, point_id, linked_by, created_at)
         VALUES (?, ?, ?, ?) ON CONFLICT (suggestion_id, point_id) DO NOTHING`,
        [id, pointId, input.createdBy, ts],
      )
    }
    run(
      `INSERT INTO suggestion_events (id, suggestion_id, actor_id, from_status, to_status, created_at)
       VALUES (?, ?, ?, NULL, 'open', ?)`,
      [uid(), id, input.createdBy, ts],
    )
    refreshProjectSuggestionCounts(input.projectId, ts)
  })
  return id
}

/** Adds evidence to an existing suggestion and keeps `source_count` honest. */
export function linkSources(suggestionId: string, pointIds: readonly string[], linkedBy: string): void {
  if (pointIds.length === 0) return
  const ts = now()
  tx(() => {
    for (const pointId of pointIds) {
      run(
        `INSERT INTO suggestion_sources (suggestion_id, point_id, linked_by, created_at)
         VALUES (?, ?, ?, ?) ON CONFLICT (suggestion_id, point_id) DO NOTHING`,
        [suggestionId, pointId, linkedBy, ts],
      )
    }
    run(
      `UPDATE suggestions SET source_count = (
         SELECT COUNT(*) FROM suggestion_sources WHERE suggestion_id = ?), updated_at = ?
       WHERE id = ?`,
      [suggestionId, ts, suggestionId],
    )
  })
}

export interface StatusChangeInput {
  readonly suggestionId: string
  readonly status: SuggestionStatus
  readonly actorId: string
  readonly note?: string | null
  /** Required by the schema and by the product when shipping. */
  readonly shippedInVersionId?: string | null
  readonly duplicateOf?: string | null
  readonly effort?: EffortKey | null
}

/**
 * A refusal the UI can attach to a field. Written as a plain class rather than
 * with a constructor parameter property, because Node's type-stripping mode —
 * which the seed script runs under — cannot compile those.
 */
export class SuggestionStatusError extends Error {
  readonly field: 'note' | 'version' | 'duplicate'

  constructor(message: string, field: 'note' | 'version' | 'duplicate') {
    super(message)
    this.name = 'SuggestionStatusError'
    this.field = field
  }
}

/**
 * Moves a suggestion and records why, in one transaction with the immutable
 * event, the contributor notifications and the reputation credit.
 *
 * A roadmap whose history can be quietly rewritten is not a commitment, so the
 * event row is written before anything else can fail.
 */
export function setSuggestionStatus(input: StatusChangeInput): SuggestionRow {
  const ts = now()
  const current = get<SuggestionRow>(`SELECT * FROM suggestions WHERE id = ?`, [input.suggestionId])
  if (!current) throw new Error(`No such suggestion: ${input.suggestionId}`)
  if (current.status === input.status) return current

  const note = input.note?.trim() ?? ''
  if ((input.status === 'declined' || input.status === 'wont_fix') && note.length === 0) {
    throw new SuggestionStatusError(
      'Declining owes the reviewer a reason. One line is enough.',
      'note',
    )
  }
  if (input.status === 'shipped' && !input.shippedInVersionId && note.length === 0) {
    throw new SuggestionStatusError(
      'Shipping links a version or a changelog note, so the reviewer can see what changed.',
      'version',
    )
  }
  if (input.status === 'duplicate' && !input.duplicateOf) {
    throw new SuggestionStatusError('A duplicate points at the suggestion it duplicates.', 'duplicate')
  }

  return tx(() => {
    run(
      `UPDATE suggestions
          SET status = ?, status_note = ?, effort = COALESCE(?, effort),
              shipped_in_version_id = COALESCE(?, shipped_in_version_id),
              duplicate_of = COALESCE(?, duplicate_of),
              shipped_at = CASE WHEN ? = 'shipped' THEN COALESCE(shipped_at, ?) ELSE shipped_at END,
              status_changed_at = ?, updated_at = ?
        WHERE id = ?`,
      [
        input.status,
        note.length > 0 ? note : current.status_note,
        input.effort ?? null,
        input.shippedInVersionId ?? null,
        input.duplicateOf ?? null,
        input.status,
        ts,
        ts,
        ts,
        input.suggestionId,
      ],
    )
    run(
      `INSERT INTO suggestion_events (id, suggestion_id, actor_id, from_status, to_status, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uid(), input.suggestionId, input.actorId, current.status, input.status, note || null, ts],
    )

    const project = get<Row>(
      `SELECT p.id, p.slug, p.title FROM projects p WHERE p.id = ?`,
      [current.project_id],
    )
    const contributors = all<Row>(
      `SELECT DISTINCT f.reviewer_id AS reviewer_id
         FROM suggestion_sources ss
         JOIN feedback_points fp ON fp.id = ss.point_id
         JOIN feedback f ON f.id = fp.feedback_id
        WHERE ss.suggestion_id = ?`,
      [input.suggestionId],
    ).map((r) => str(r, 'reviewer_id'))

    for (const reviewerId of contributors) {
      if (!reviewerId || reviewerId === input.actorId) continue
      notify({
        userId: reviewerId,
        actorId: input.actorId,
        kind: input.status === 'shipped' ? 'suggestion_shipped' : 'suggestion_status',
        subjectType: 'suggestion',
        subjectId: input.suggestionId,
        title:
          input.status === 'shipped'
            ? `Your note shipped in ${str(project, 'title')}`
            : `${statusLabel(input.status)}: ${current.title}`,
        body: note.length > 0 ? note : null,
        // Shipped means the change is in a build, so the build history is where
        // the reader can see it. Any other status change is about the project.
        url:
          input.status === 'shipped'
            ? projectBuildsUrl(str(project, 'slug'))
            : projectUrl(str(project, 'slug')),
      })
      if (input.status === 'shipped') {
        // Adoption is the heaviest positive term in the reputation formula, and
        // this is the row that records it happening.
        recordReputationEvent({
          userId: reviewerId,
          facet: 'reviewer',
          kind: 'suggestion_shipped',
          delta: 25,
          subjectType: 'suggestion',
          subjectId: input.suggestionId,
          actorId: input.actorId,
        })
        invalidateReputation(reviewerId)
      }
    }

    refreshProjectSuggestionCounts(current.project_id, ts)

    const updated = get<SuggestionRow>(`SELECT * FROM suggestions WHERE id = ?`, [input.suggestionId])
    if (!updated) throw new Error('Suggestion vanished inside its own transaction')
    return updated
  })
}

/** Community demand signal. One vote per person, enforced by the primary key. */
export function voteSuggestion(suggestionId: string, voterId: string, on: boolean): number {
  const ts = now()
  tx(() => {
    if (on) {
      run(
        `INSERT INTO suggestion_votes (suggestion_id, voter_id, created_at) VALUES (?, ?, ?)
         ON CONFLICT (suggestion_id, voter_id) DO NOTHING`,
        [suggestionId, voterId, ts],
      )
    } else {
      run(`DELETE FROM suggestion_votes WHERE suggestion_id = ? AND voter_id = ?`, [suggestionId, voterId])
    }
    run(
      `UPDATE suggestions SET vote_count = (
         SELECT COUNT(*) FROM suggestion_votes WHERE suggestion_id = ?), updated_at = ?
       WHERE id = ?`,
      [suggestionId, ts, suggestionId],
    )
  })
  return num(get<Row>(`SELECT vote_count FROM suggestions WHERE id = ?`, [suggestionId]), 'vote_count')
}

export function setSuggestionEffort(suggestionId: string, effort: EffortKey | null): void {
  run(`UPDATE suggestions SET effort = ?, updated_at = ? WHERE id = ?`, [effort, now(), suggestionId])
}

function refreshProjectSuggestionCounts(projectId: string, at: Millis): void {
  run(
    `UPDATE project_stats
        SET open_suggestions = (SELECT COUNT(*) FROM suggestions
                                 WHERE project_id = ?
                                   AND status IN ('open', 'under_review', 'planned', 'in_progress')),
            shipped_suggestions = (SELECT COUNT(*) FROM suggestions
                                    WHERE project_id = ? AND status = 'shipped'),
            last_activity_at = ?, computed_at = ?
      WHERE project_id = ?`,
    [projectId, projectId, at, at, projectId],
  )
}
