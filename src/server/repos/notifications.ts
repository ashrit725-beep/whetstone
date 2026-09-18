/**
 * Notifications.
 *
 * `group_key` is what collapses "12 people voted" into one row. Rather than
 * relying on a partial-index conflict target, `notify` updates an existing
 * unread row in the same group first and only inserts when there is none —
 * which is also the behaviour a reader expects: one row, freshly dated.
 */

import { all, get, run } from '@/server/db/client'
import { now, uid } from '@/lib/utils'
import type {
  Millis,
  NotificationKind,
  NotificationRow,
  NotificationSubjectType,
  NotificationView,
  Page,
  PageOptions,
} from '@/lib/types'
import {
  bool,
  decodeCursor,
  encodeCursor,
  jsonObject,
  mapUserCardOrNull,
  num,
  pageLimit,
  str,
  strOrNull,
  toPage,
  userCardJoin,
  userCardSelect,
  type Row,
} from './_shared'

export interface NotifyInput {
  readonly userId: string
  readonly kind: NotificationKind
  readonly title: string
  readonly actorId?: string | null
  readonly subjectType?: NotificationSubjectType | null
  readonly subjectId?: string | null
  readonly body?: string | null
  readonly url?: string | null
  readonly groupKey?: string | null
  readonly payload?: Record<string, unknown> | null
}

/**
 * Writes one notification. Returns the row id, or null when the recipient has
 * turned this kind off in-app: an opt-out that still writes the row is not an
 * opt-out.
 *
 * Plain statements only, no transaction of its own, so it composes inside the
 * transactions that call it.
 */
export function notify(input: NotifyInput): string | null {
  if (!input.userId) return null

  const pref = get<Row>(
    `SELECT in_app FROM notification_preferences WHERE user_id = ? AND kind = ?`,
    [input.userId, input.kind],
  )
  // A row exists only where the user changed the default, so absence means on.
  if (pref && !bool(pref, 'in_app')) return null

  const ts = now()
  const payload = input.payload ? JSON.stringify(input.payload) : null

  if (input.groupKey) {
    const existing = get<Row>(
      `SELECT id FROM notifications
        WHERE user_id = ? AND group_key = ? AND read_at IS NULL
        ORDER BY created_at DESC LIMIT 1`,
      [input.userId, input.groupKey],
    )
    if (existing) {
      const id = str(existing, 'id')
      run(
        `UPDATE notifications
            SET actor_id = ?, title = ?, body = ?, url = ?, payload = ?, created_at = ?
          WHERE id = ?`,
        [input.actorId ?? null, input.title, input.body ?? null, input.url ?? null, payload, ts, id],
      )
      return id
    }
  }

  const id = uid()
  run(
    `INSERT INTO notifications
       (id, user_id, actor_id, kind, subject_type, subject_id, group_key,
        title, body, url, payload, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId,
      input.actorId ?? null,
      input.kind,
      input.subjectType ?? null,
      input.subjectId ?? null,
      input.groupKey ?? null,
      input.title,
      input.body ?? null,
      input.url ?? null,
      payload,
      ts,
    ],
  )
  return id
}

/** Fan-out to many recipients, skipping the actor so nobody notifies themselves. */
export function notifyMany(
  userIds: readonly string[],
  input: Omit<NotifyInput, 'userId'>,
): number {
  let sent = 0
  for (const userId of new Set(userIds)) {
    if (!userId || userId === input.actorId) continue
    if (notify({ ...input, userId })) sent += 1
  }
  return sent
}

export type NotificationFilter = 'all' | 'unread' | NotificationKind

export function listNotifications(
  userId: string,
  opts: PageOptions & { readonly filter?: NotificationFilter } = {},
): Page<NotificationView> {
  const limit = pageLimit(opts.limit, 25)
  const cursor = decodeCursor(opts.cursor)
  const at = cursor ? num(cursor, 'at') : null
  // The id breaks ties. Paging on created_at alone dropped a notification that
  // shared its millisecond with the last row of the previous page. A cursor
  // from before this carried no id, and reads as "every id at that instant".
  const afterId = cursor ? strOrNull(cursor, 'id') : null
  const filter = opts.filter ?? 'all'

  const where: string[] = ['n.user_id = ?']
  const params: unknown[] = [userId]
  if (filter === 'unread') {
    where.push('n.read_at IS NULL')
  } else if (filter !== 'all') {
    where.push('n.kind = ?')
    params.push(filter)
  }
  if (at !== null && afterId !== null) {
    where.push('(n.created_at < ? OR (n.created_at = ? AND n.id < ?))')
    params.push(at, at, afterId)
  } else if (at !== null) {
    where.push('n.created_at < ?')
    params.push(at)
  }

  const rows = all<Row>(
    `SELECT n.*, ${userCardSelect('u', 'pr', 'rs', 'a')}
       FROM notifications n
       LEFT JOIN users u ON u.id = n.actor_id
       ${userCardJoin('u', 'pr', 'rs')}
      WHERE ${where.join(' AND ')}
      ORDER BY n.created_at DESC, n.id DESC
      LIMIT ?`,
    [...params, limit + 1],
  )

  const items = rows.map(
    (r): NotificationView => ({
      id: str(r, 'id'),
      kind: str(r, 'kind') as NotificationKind,
      title: str(r, 'title'),
      body: strOrNull(r, 'body'),
      url: strOrNull(r, 'url'),
      actor: mapUserCardOrNull(r, 'a'),
      subjectType: (strOrNull(r, 'subject_type') as NotificationSubjectType | null) ?? null,
      subjectId: strOrNull(r, 'subject_id'),
      isRead: r['read_at'] !== null && r['read_at'] !== undefined,
      createdAt: num(r, 'created_at'),
      payload: jsonObject(r, 'payload'),
    }),
  )
  return toPage(items, limit, (last) => encodeCursor({ at: last.createdAt, id: last.id }))
}

/** The bell badge. Index-only against `ix_notifications_unread`. */
export function getUnreadCount(userId: string): number {
  return num(
    get<Row>(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL`, [userId]),
    'n',
  )
}

/** Every notification the user has, read or not. Index-only against `ix_notifications_all`. */
export function countNotifications(userId: string): number {
  return num(get<Row>(`SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?`, [userId]), 'n')
}

/** Scoped by user id as well as row id: a notification is nobody else's to read. */
export function markRead(notificationId: string, userId: string): boolean {
  const r = run(
    `UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL`,
    [now(), notificationId, userId],
  )
  return r.changes === 1
}

export function markAllRead(userId: string): number {
  return run(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`, [
    now(),
    userId,
  ]).changes
}

export function getNotification(notificationId: string, userId: string): NotificationRow | undefined {
  return get<NotificationRow>(`SELECT * FROM notifications WHERE id = ? AND user_id = ?`, [
    notificationId,
    userId,
  ])
}

/* ------------------------------------------------------------------------- *
 * Preferences
 * ------------------------------------------------------------------------- */

export interface NotificationPreference {
  readonly kind: NotificationKind
  readonly inApp: boolean
  readonly email: boolean
  readonly push: boolean
  /** True when this is the built-in default rather than a stored choice. */
  readonly isDefault: boolean
}

/** Defaults live in code; a row exists only where the user changed one. */
const DEFAULT_PREFERENCE = { inApp: true, email: true, push: false } as const

export function getNotificationPrefs(
  userId: string,
  kinds: readonly NotificationKind[],
): readonly NotificationPreference[] {
  const stored = new Map<string, Row>()
  for (const r of all<Row>(`SELECT * FROM notification_preferences WHERE user_id = ?`, [userId])) {
    stored.set(str(r, 'kind'), r)
  }
  return kinds.map((kind): NotificationPreference => {
    const row = stored.get(kind)
    if (!row) return { kind, ...DEFAULT_PREFERENCE, isDefault: true }
    return {
      kind,
      inApp: bool(row, 'in_app'),
      email: bool(row, 'email'),
      push: bool(row, 'push'),
      isDefault: false,
    }
  })
}

export function setNotificationPref(
  userId: string,
  kind: NotificationKind,
  patch: { readonly inApp?: boolean; readonly email?: boolean; readonly push?: boolean },
): void {
  const current = get<Row>(
    `SELECT in_app, email, push FROM notification_preferences WHERE user_id = ? AND kind = ?`,
    [userId, kind],
  )
  const inApp = patch.inApp ?? (current ? bool(current, 'in_app') : DEFAULT_PREFERENCE.inApp)
  const email = patch.email ?? (current ? bool(current, 'email') : DEFAULT_PREFERENCE.email)
  const push = patch.push ?? (current ? bool(current, 'push') : DEFAULT_PREFERENCE.push)
  run(
    `INSERT INTO notification_preferences (user_id, kind, in_app, email, push, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, kind) DO UPDATE SET
       in_app = excluded.in_app, email = excluded.email,
       push = excluded.push, updated_at = excluded.updated_at`,
    [userId, kind, inApp ? 1 : 0, email ? 1 : 0, push ? 1 : 0, now()],
  )
}

/** The email worker's queue: unsent rows, oldest first. */
export function listPendingEmails(limit = 100): readonly NotificationRow[] {
  return all<NotificationRow>(
    `SELECT * FROM notifications WHERE emailed_at IS NULL ORDER BY created_at LIMIT ?`,
    [pageLimit(limit, 100)],
  )
}

export function markEmailed(notificationId: string, at?: Millis): void {
  run(`UPDATE notifications SET emailed_at = ? WHERE id = ?`, [at ?? now(), notificationId])
}
