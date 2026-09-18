import { z } from 'zod'
import { voteSuggestion } from '@/server/repos/suggestions'
import { canSeeProject, projectAccess, suggestionAccess } from '@/server/queries/access'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { notFound, stateInvalid } from '@/server/api/errors'
import { Id, Toggle } from '@/server/api/schema'

/**
 * POST /api/suggestions/[suggestionId]/vote
 *
 * The public roadmap's "me too". Votes are what let a creator sort a board by
 * demand rather than by recency, so this is the one vote in the product a
 * creator is allowed to cast on their own project's board: they are ranking
 * their own backlog, not conferring reputation on anyone.
 *
 * Visibility descends from the project, not from the suggestion: a suggestion
 * on a private or unpublished project is not addressable by anyone who could
 * not open the project itself.
 *
 * A closed suggestion is a 409 rather than a 403, and the message says which
 * state it is in, because the client's job here is to explain rather than to
 * fail.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Params = z.object({ suggestionId: Id })

const CLOSED = new Set(['shipped', 'declined', 'duplicate', 'wont_fix'])

export const POST = handler({
  auth: 'required',
  limit: LIMITS.vote,
  params: Params,
  body: Toggle,
  run({ viewer, params, body }) {
    const suggestion = suggestionAccess(params.suggestionId)
    const project = suggestion ? projectAccess(suggestion.projectId) : undefined
    if (!suggestion || !project || !canSeeProject(project, viewer.id)) {
      throw notFound('That suggestion is not here. It may have been merged into another one.')
    }

    if (CLOSED.has(suggestion.status)) {
      throw stateInvalid(
        'This suggestion is already closed, so voting on it would not change anything. Open the board to see what it was closed as.',
        { status: suggestion.status },
      )
    }

    const votes = voteSuggestion(params.suggestionId, viewer.id, body.on)

    return { suggestionId: params.suggestionId, votes, viewerVoted: body.on }
  },
})
