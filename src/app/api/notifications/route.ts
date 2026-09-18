import { z } from 'zod'
import { getUnreadCount, listNotifications, type NotificationFilter } from '@/server/repos/notifications'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { Cursor, Limit } from '@/server/api/schema'

/**
 * GET /api/notifications
 *
 * The bell, and the notifications page's paging.
 *
 * Authorisation is structural rather than checked: `listNotifications` is
 * keyed on the user id and there is no parameter that can widen it, so there is
 * no id a caller could pass to read someone else's list. The route never
 * accepts a `userId`, and that is the point.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FILTERS = [
  'all',
  'unread',
  'feedback_received',
  'feedback_reply',
  'feedback_helpful',
  'suggestion_status',
  'suggestion_shipped',
  'project_update',
  'new_version',
  'test_invite',
  'test_reminder',
  'bounty_application',
  'bounty_awarded',
  'bounty_delivered',
  'bounty_paid',
  'thread_reply',
  'answer_accepted',
  'mention',
  'new_follower',
  'badge_awarded',
  'verification_decision',
  'moderation_notice',
  'system',
] as const

const ListQuery = z.object({
  filter: z.enum(FILTERS).default('all'),
  cursor: Cursor.optional(),
  limit: Limit.default(25),
})

export const GET = handler({
  auth: 'required',
  limit: LIMITS.notificationsList,
  query: ListQuery,
  run({ viewer, query, setMeta }) {
    const page = listNotifications(viewer.id, {
      filter: query.filter as NotificationFilter,
      cursor: query.cursor ?? null,
      limit: query.limit,
    })

    setMeta({ nextCursor: page.nextCursor, hasMore: page.hasMore })

    return {
      filter: query.filter,
      unreadCount: getUnreadCount(viewer.id),
      notifications: page.items,
    }
  },
})
