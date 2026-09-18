import { z } from 'zod'
import { votePost } from '@/server/repos/discussions'
import { postAccess } from '@/server/queries/access'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { forbidden, notFound, stateInvalid } from '@/server/api/errors'
import { Id, SignedVoteValue } from '@/server/api/schema'

/**
 * POST /api/community/posts/[postId]/vote
 *
 * The only signed vote in the product. A discussion reply can be wrong in a way
 * a piece of feedback cannot: feedback is one person's experience and a
 * downvote on it would be an argument about whether they had it, while an
 * answer in a thread is a claim, and a claim can be marked as unhelpful.
 *
 * A locked thread still reads, still gets linked, and still gets found in
 * search. It just stops accepting new judgements, so a vote on one is a 409
 * naming the state rather than a silent no-op.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Params = z.object({ postId: Id })
const Body = z.object({ value: SignedVoteValue })

export const POST = handler({
  auth: 'required',
  limit: LIMITS.vote,
  params: Params,
  body: Body,
  run({ viewer, params, body }) {
    const post = postAccess(params.postId)
    if (!post || post.deleted || post.channelPrivate) {
      throw notFound('That reply is not here. It may have been removed by its author or by a moderator.')
    }

    if (post.authorId === viewer.id) {
      throw forbidden('You wrote this reply, so you cannot vote on it. The score is what other people made of it.')
    }

    if (post.threadStatus === 'locked' || post.threadStatus === 'archived') {
      throw stateInvalid(
        'This thread is closed to new activity, so the score is fixed. You can still read it and link to it.',
        { status: post.threadStatus },
      )
    }

    const score = votePost(params.postId, viewer.id, body.value)

    return { postId: params.postId, score, viewerVote: body.value }
  },
})
