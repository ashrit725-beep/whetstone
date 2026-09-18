/**
 * Queries the community surface needs that `src/server/repos/discussions.ts`
 * does not expose. Nothing here writes to a discussion row: the repository owns
 * that. The one write is the moderation report, which has no repository at all.
 *
 * Same house rules as the repository layer: synchronous, every value bound,
 * missing is `undefined`, empty is `[]`.
 */

import { all, get, run } from '@/server/db/client'
import {
  mapUserCard,
  num,
  numOrNull,
  placeholders,
  str,
  strOrNull,
  userCardJoin,
  userCardSelect,
  type Row,
} from '@/server/repos/_shared'
import { now, uid } from '@/lib/utils'
import type { Millis, UserCard } from '@/lib/types'
import type {
  DiscussionReportReason,
  ReportTargetType,
} from '@/components/discussions/labels'

/* ------------------------------------------------------------------------- *
 * Channel register
 * ------------------------------------------------------------------------- */

export interface ChannelSummary {
  readonly id: string
  readonly slug: string
  readonly label: string
  readonly description: string | null
  /** Threads that are live: not deleted, not removed by a moderator. */
  readonly threadCount: number
  readonly replyCount: number
  /** Open questions with nothing on them yet. */
  readonly unansweredCount: number
  readonly lastActivityAt: Millis | null
}

const CHANNEL_LIVE_THREAD = `t.channel_id = dc.id AND t.deleted_at IS NULL AND t.status <> 'removed'`

/**
 * One row per open channel, with the counters the index register prints. The
 * correlated subqueries run over `ix_threads_channel`; six channels is not a
 * scale problem and the alternative is four separate round trips.
 */
export function listChannelSummaries(): readonly ChannelSummary[] {
  const rows = all<Row>(
    `SELECT dc.id, dc.slug, dc.label, dc.description,
            (SELECT COUNT(*) FROM discussion_threads t
              WHERE ${CHANNEL_LIVE_THREAD}) AS thread_count,
            (SELECT COALESCE(SUM(t.post_count), 0) FROM discussion_threads t
              WHERE ${CHANNEL_LIVE_THREAD}) AS reply_count,
            (SELECT COUNT(*) FROM discussion_threads t
              WHERE ${CHANNEL_LIVE_THREAD}
                AND t.thread_kind = 'question' AND t.status = 'open' AND t.post_count = 0)
              AS unanswered_count,
            (SELECT MAX(COALESCE(t.last_post_at, t.created_at)) FROM discussion_threads t
              WHERE ${CHANNEL_LIVE_THREAD}) AS last_activity_at
       FROM discussion_channels dc
      WHERE dc.is_archived = 0 AND dc.is_private = 0
      ORDER BY dc.sort_order, dc.label`,
  )

  return rows.map((r) => ({
    id: str(r, 'id'),
    slug: str(r, 'slug'),
    label: str(r, 'label'),
    description: strOrNull(r, 'description'),
    threadCount: num(r, 'thread_count'),
    replyCount: num(r, 'reply_count'),
    unansweredCount: num(r, 'unanswered_count'),
    lastActivityAt: numOrNull(r, 'last_activity_at'),
  }))
}

/* ------------------------------------------------------------------------- *
 * Participants
 * ------------------------------------------------------------------------- */

export interface ThreadParticipant {
  readonly id: string
  readonly handle: string
  readonly displayName: string
  readonly avatarUrl: string | null
}

/**
 * Everyone who has written in each thread, most recent first, for the avatar
 * group in a thread row. One query for the whole page, so a twenty row register
 * costs one round trip and not twenty.
 */
export function listThreadParticipants(
  threadIds: readonly string[],
): ReadonlyMap<string, readonly ThreadParticipant[]> {
  const out = new Map<string, ThreadParticipant[]>()
  if (threadIds.length === 0) return out

  const rows = all<Row>(
    `SELECT dp.thread_id, u.id AS user_id, u.handle,
            COALESCE(pr.display_name, u.handle) AS display_name,
            pr.avatar_url,
            MAX(dp.created_at) AS last_at
       FROM discussion_posts dp
       JOIN users u ON u.id = dp.author_id
       LEFT JOIN profiles pr ON pr.user_id = u.id
      WHERE dp.thread_id IN (${placeholders(threadIds.length)})
        AND dp.deleted_at IS NULL
      GROUP BY dp.thread_id, u.id
      ORDER BY dp.thread_id, last_at DESC`,
    [...threadIds],
  )

  for (const r of rows) {
    const threadId = str(r, 'thread_id')
    const list = out.get(threadId) ?? []
    list.push({
      id: str(r, 'user_id'),
      handle: str(r, 'handle'),
      displayName: str(r, 'display_name'),
      avatarUrl: strOrNull(r, 'avatar_url'),
    })
    out.set(threadId, list)
  }
  return out
}

/* ------------------------------------------------------------------------- *
 * The viewer, as a card
 * ------------------------------------------------------------------------- */

/**
 * The signed-in reader in the same shape every post already carries, so an
 * optimistic reply can be drawn with the real name and avatar rather than a
 * placeholder that changes when the server answers.
 */
export function getViewerCard(userId: string): UserCard | undefined {
  const row = get<Row>(
    `SELECT ${userCardSelect('u', 'pr', 'rs', 'a')}
       FROM users u
       ${userCardJoin('u', 'pr', 'rs')}
      WHERE u.id = ? AND u.status = 'active'`,
    [userId],
  )
  return row ? mapUserCard(row, 'a') : undefined
}

/* ------------------------------------------------------------------------- *
 * Moderation reports
 * ------------------------------------------------------------------------- */

/* Reason list and target union live in the surface's label module, which is
   client-safe; this file only needs their types. */

export interface NewReportInput {
  readonly reporterId: string
  readonly targetType: ReportTargetType
  readonly targetId: string
  readonly reason: DiscussionReportReason
  readonly detail?: string | null
}

export type ReportOutcome = 'filed' | 'duplicate' | 'missing' | 'own'

/**
 * Files one report. `ux_reports_dedup` allows a single open report per person
 * per thing, so a second one is reported back as a duplicate rather than thrown:
 * pressing the button twice is a misunderstanding, not an error.
 */
export function fileContentReport(input: NewReportInput): ReportOutcome {
  const owner =
    input.targetType === 'discussion_thread'
      ? get<Row>(`SELECT author_id FROM discussion_threads WHERE id = ? AND deleted_at IS NULL`, [
          input.targetId,
        ])
      : get<Row>(`SELECT author_id FROM discussion_posts WHERE id = ? AND deleted_at IS NULL`, [
          input.targetId,
        ])
  if (!owner) return 'missing'
  if (str(owner, 'author_id') === input.reporterId) return 'own'

  const existing = get<Row>(
    `SELECT 1 AS hit FROM content_reports
      WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'open'`,
    [input.reporterId, input.targetType, input.targetId],
  )
  if (existing) return 'duplicate'

  const detail = input.detail?.trim()
  run(
    `INSERT INTO content_reports
       (id, reporter_id, target_type, target_id, target_owner_id, reason, detail, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [
      uid(),
      input.reporterId,
      input.targetType,
      input.targetId,
      str(owner, 'author_id'),
      input.reason,
      detail && detail.length > 0 ? detail : null,
      now(),
    ],
  )
  return 'filed'
}

/* ------------------------------------------------------------------------- *
 * Small reads the actions need before they write
 * ------------------------------------------------------------------------- */

export interface ThreadWriteContext {
  readonly id: string
  readonly channelSlug: string
  readonly status: string
  readonly kind: string
  readonly authorId: string
  readonly locked: boolean
}

/**
 * Enough of a thread to decide whether a write is allowed and what to revalidate.
 *
 * Every write resolves its thread here, so this is where a thread stops being
 * writable: a private or archived channel is refused exactly as `getChannel`
 * refuses it, and a thread a moderator removed is refused as gone. Without the
 * channel guard a thread in a closed channel could still be replied to, voted
 * in, answered and followed by anyone who had its id.
 */
export function getThreadWriteContext(threadId: string): ThreadWriteContext | undefined {
  const row = get<Row>(
    `SELECT dt.id, dt.status, dt.thread_kind, dt.author_id, dc.slug AS channel_slug
       FROM discussion_threads dt
       JOIN discussion_channels dc ON dc.id = dt.channel_id
      WHERE dt.id = ? AND dt.deleted_at IS NULL AND dt.status <> 'removed'
        AND dc.is_private = 0 AND dc.is_archived = 0`,
    [threadId],
  )
  if (!row) return undefined
  const status = str(row, 'status')
  return {
    id: str(row, 'id'),
    channelSlug: str(row, 'channel_slug'),
    status,
    kind: str(row, 'thread_kind'),
    authorId: str(row, 'author_id'),
    locked: status === 'locked' || status === 'archived',
  }
}

/** The thread a post belongs to, so a vote or a report can revalidate its page. */
export function getPostThreadId(postId: string): string | undefined {
  const row = get<Row>(
    `SELECT thread_id FROM discussion_posts WHERE id = ? AND deleted_at IS NULL`,
    [postId],
  )
  return row ? str(row, 'thread_id') : undefined
}

/** True when the viewer has already filed an open report against this thing. */
export function hasOpenReport(
  reporterId: string,
  targetType: ReportTargetType,
  targetId: string,
): boolean {
  const row = get<Row>(
    `SELECT 1 AS hit FROM content_reports
      WHERE reporter_id = ? AND target_type = ? AND target_id = ? AND status = 'open'`,
    [reporterId, targetType, targetId],
  )
  return row !== undefined
}
