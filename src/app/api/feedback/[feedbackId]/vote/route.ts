import { z } from 'zod'
import { getFeedback, voteFeedback } from '@/server/repos/feedback'
import { canSeeFeedback, feedbackAccess } from '@/server/queries/access'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { forbidden, notFound } from '@/server/api/errors'
import { Id, VoteValue } from '@/server/api/schema'

/**
 * POST /api/feedback/[feedbackId]/vote
 *
 * "This was helpful", and the retraction of it.
 *
 * Three checks, in this order, and the order is load-bearing:
 *
 *  1. The row exists and this viewer may *see* it. Creator-only feedback is
 *     visible to the reviewer, the creator and that project's collaborators;
 *     for anyone else a vote here returns the same 404 a missing id returns, so
 *     the endpoint cannot be used to confirm that a private review exists.
 *  2. The voter is not the reviewer. A reviewer voting their own note up is
 *     reputation laundering, and `voteFeedback` recomputes reputation on write.
 *  3. Only then is the vote recorded.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Params = z.object({ feedbackId: Id })
const Body = z.object({ value: VoteValue })

export const POST = handler({
  auth: 'required',
  limit: LIMITS.vote,
  params: Params,
  body: Body,
  run({ viewer, params, body }) {
    const target = feedbackAccess(params.feedbackId)
    if (!target || !canSeeFeedback(target, viewer.id)) {
      throw notFound('That review is not here. It may have been withdrawn, or it was never public.')
    }

    if (target.reviewerId === viewer.id) {
      throw forbidden(
        'You wrote this review, so you cannot mark it helpful. Helpful marks come from the people who read it.',
      )
    }

    voteFeedback(params.feedbackId, viewer.id, body.value === 1 ? 1 : 0)

    const updated = getFeedback(params.feedbackId, viewer.id)
    return {
      feedbackId: params.feedbackId,
      helpfulCount: updated?.counts.helpful ?? 0,
      viewerVoted: updated?.viewer.vote === 1,
    }
  },
})
