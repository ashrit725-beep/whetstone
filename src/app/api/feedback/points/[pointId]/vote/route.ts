import { z } from 'zod'
import { votePoint } from '@/server/repos/feedback'
import { canSeeFeedback, feedbackAccess, pointAccess } from '@/server/queries/access'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { forbidden, notFound } from '@/server/api/errors'
import { Id, Toggle } from '@/server/api/schema'

/**
 * POST /api/feedback/points/[pointId]/vote
 *
 * "I hit this too", on one observation rather than on a whole review. It is the
 * signal that turns one reviewer's complaint into a pattern, so it is a
 * separate verb from marking a review helpful and it has no negative direction.
 *
 * The point carries no visibility of its own: it inherits its parent review's.
 * So the check resolves the parent and runs the same rule the review-level vote
 * runs, which is why both routes import the same predicate rather than each
 * writing their own version of "can see".
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Params = z.object({ pointId: Id })

export const POST = handler({
  auth: 'required',
  limit: LIMITS.vote,
  params: Params,
  body: Toggle,
  run({ viewer, params, body }) {
    const point = pointAccess(params.pointId)
    const parent = point ? feedbackAccess(point.feedbackId) : undefined
    if (!point || !parent || !canSeeFeedback(parent, viewer.id)) {
      throw notFound('That note is not here. The review it belonged to may have been withdrawn.')
    }

    if (parent.reviewerId === viewer.id) {
      throw forbidden(
        'You wrote this note, so you cannot add yourself to it. The count is of other people who hit the same thing.',
      )
    }

    const votes = votePoint(params.pointId, viewer.id, body.on)

    return { pointId: params.pointId, votes, viewerVoted: body.on }
  },
})
