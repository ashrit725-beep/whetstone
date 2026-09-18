import { z } from 'zod'
import { getUnreadCount, markAllRead, markRead } from '@/server/repos/notifications'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { Id } from '@/server/api/schema'

/**
 * POST /api/notifications/read
 *
 * Marks notifications read, one batch or all of them.
 *
 * `markRead` is scoped by user id as well as row id, so an id belonging to
 * someone else simply does not match and is reported as not marked rather than
 * as an error. That distinction matters: telling a caller "that id is not
 * yours" confirms the row exists, which is the same leak the scoped update
 * exists to prevent. The response says how many were marked, and the client
 * reconciles against that.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MarkRead = z
  .object({
    ids: z.array(Id).max(200).optional(),
    all: z.boolean().default(false),
  })
  .refine((value) => value.all || (value.ids?.length ?? 0) > 0, {
    path: ['ids'],
    message: 'Name the notifications to mark, or set all to true.',
  })

export const POST = handler({
  auth: 'required',
  limit: LIMITS.notificationsRead,
  body: MarkRead,
  run({ viewer, body }) {
    const marked = body.all
      ? markAllRead(viewer.id)
      : (body.ids ?? []).reduce((count, id) => count + (markRead(id, viewer.id) ? 1 : 0), 0)

    return { marked, unreadCount: getUnreadCount(viewer.id) }
  },
})
