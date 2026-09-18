import { z } from 'zod'
import { get } from '@/server/db/client'
import { followUser, unfollowUser } from '@/server/repos/profiles'
import { eitherBlocks, userAccessByHandle } from '@/server/queries/access'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { forbidden, notFound } from '@/server/api/errors'
import { Handle } from '@/server/api/schema'

/**
 * POST /api/users/[handle]/follow
 *
 * Addressed by handle rather than by id, because that is what the profile page
 * already has in its own URL and a round trip to resolve an id would be a round
 * trip for nothing.
 *
 * Three refusals, each with its own reason:
 *
 *  - following yourself is a 403 with a plain explanation, not a silent no-op,
 *    because a button that appears to work and does nothing is worse;
 *  - a suspended or deactivated account is a 404, since its profile is not
 *    readable either and a distinct error would report a moderation outcome;
 *  - a block in either direction is a 403, and only on the follow, so someone
 *    who was blocked after following can always still unfollow.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Params = z.object({ handle: Handle })
const Body = z.object({ following: z.boolean() })

function followerCount(userId: string): number {
  const row = get<{ n: number }>(`SELECT COUNT(*) AS n FROM user_follows WHERE followee_id = ?`, [
    userId,
  ])
  return row?.n ?? 0
}

export const POST = handler({
  auth: 'required',
  limit: LIMITS.follow,
  params: Params,
  body: Body,
  run({ viewer, params, body }) {
    const target = userAccessByHandle(params.handle)
    if (!target || target.deleted || target.status !== 'active') {
      throw notFound('There is no account at that handle.')
    }

    if (target.id === viewer.id) {
      throw forbidden('You cannot follow your own account. Your projects already appear on your own profile.')
    }

    if (body.following && eitherBlocks(viewer.id, target.id)) {
      throw forbidden(
        'You cannot follow this person, because one of you has blocked the other. Lift the block from your settings if that was not intended.',
      )
    }

    if (body.following) followUser(viewer.id, target.id)
    else unfollowUser(viewer.id, target.id)

    return {
      handle: target.handle,
      following: body.following,
      followerCount: followerCount(target.id),
    }
  },
})
