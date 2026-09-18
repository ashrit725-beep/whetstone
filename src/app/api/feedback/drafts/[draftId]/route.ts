import { z } from 'zod'
import { deleteComposerDraft } from '@/server/queries/drafts'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { notFound } from '@/server/api/errors'
import { Id } from '@/server/api/schema'

/**
 * DELETE /api/feedback/drafts/[draftId]
 *
 * Discards a draft. Called on a successful submit, and by the composer's own
 * "discard this draft" control.
 *
 * The delete is scoped by reviewer id as well as by draft id, so a draft
 * belonging to someone else does not match and comes back as a 404 rather than
 * a 403. A 403 here would confirm the row exists, which is exactly what the
 * scoping is for.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Params = z.object({ draftId: Id })

export const DELETE = handler({
  auth: 'required',
  limit: LIMITS.draftDelete,
  params: Params,
  run({ viewer, params }) {
    if (!deleteComposerDraft(viewer.id, params.draftId)) {
      throw notFound('That draft is not here. It may already have been submitted or discarded.')
    }
    return { draftId: params.draftId, deleted: true }
  },
})
