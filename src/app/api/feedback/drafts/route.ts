import { z } from 'zod'
import {
  DRAFT_SCHEMA_VERSION,
  MAX_DRAFT_BYTES,
  getComposerDraft,
  listComposerDrafts,
  saveComposerDraft,
} from '@/server/queries/drafts'
import { canSeeProject, projectAccess } from '@/server/queries/access'
import { getProjectBySlug } from '@/server/repos/projects'
import { reviewRefusal } from '@/components/project/composer-data'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { forbidden, invalid, notFound, stateInvalid } from '@/server/api/errors'
import { Id } from '@/server/api/schema'

/**
 * GET  /api/feedback/drafts?projectId=…   read this reviewer's draft
 * PUT  /api/feedback/drafts               replace it
 *
 * Autosave for the composer. The payload is opaque on purpose: a half-written
 * review does not satisfy the constraints a `feedback` row must satisfy, and
 * relaxing those constraints so a draft can be stored in the same table would
 * weaken the guarantees the submitted row depends on. See the note at the top
 * of `@/server/queries/drafts`.
 *
 * The composer keeps one draft per project, replaced whole. A merge would let a
 * field the reviewer just cleared come back from an earlier save, which reads
 * as the form arguing with them.
 *
 * Refusals follow `reviewRefusal`, the rule the composer and the submit share: a
 * reviewer cannot draft a review of a project they own or edit, an invite-only
 * project takes drafts only from invited reviewers, and a project that has
 * closed feedback stops accepting saves rather than collecting work that can
 * never be submitted. The second is a 409 with
 * the state named, so the composer can say so instead of failing quietly.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ReadQuery = z.object({ projectId: Id.optional() })

const SaveBody = z.object({
  projectId: Id,
  /** Whatever shape the composer is on. Validated at submit, not at autosave. */
  payload: z.record(z.string(), z.unknown()),
  schemaVersion: z.number().int().min(1).max(999).default(DRAFT_SCHEMA_VERSION),
})

export const GET = handler({
  auth: 'required',
  limit: LIMITS.draftRead,
  query: ReadQuery,
  run({ viewer, query }) {
    if (!query.projectId) {
      return { drafts: listComposerDrafts(viewer.id), draft: null }
    }
    const draft = getComposerDraft(viewer.id, query.projectId)
    return { drafts: [], draft: draft ?? null }
  },
})

export const PUT = handler({
  auth: 'required',
  limit: LIMITS.draftSave,
  body: SaveBody,
  maxBytes: MAX_DRAFT_BYTES + 4_096,
  run({ viewer, body }) {
    const project = projectAccess(body.projectId)
    if (!project || !canSeeProject(project, viewer.id)) {
      throw notFound('That project is not here. It may have been unpublished while you were writing.')
    }

    // The same gate the composer and postFeedback use. Checking the owner and a
    // closed state here by hand missed collaborators and invite-only projects,
    // so a draft could be stored on a project its writer could never post to.
    const detail = getProjectBySlug(project.slug, { viewerId: viewer.id })
    const refused = detail ? reviewRefusal(detail) : 'closed'
    if (refused === 'own') {
      throw forbidden(
        'This is your own project, so there is no review to write. Reply to the reviews you have received instead.',
      )
    }
    if (refused === 'invite') {
      throw forbidden(
        'This project takes reviews from invited reviewers only, so a draft here could never be posted.',
      )
    }
    if (refused === 'closed') {
      throw stateInvalid(
        'This project has closed feedback, so a draft here could never be posted. Copy your notes somewhere safe and follow the project to hear when it reopens.',
        { feedbackState: project.feedbackState },
      )
    }

    const size = Buffer.byteLength(JSON.stringify(body.payload), 'utf8')
    if (size > MAX_DRAFT_BYTES) {
      throw invalid(
        `This draft is larger than the ${Math.round(
          MAX_DRAFT_BYTES / 1000,
        )} kB a single review can hold, so it was not saved. Shorten it, or split the parts that stand alone into separate notes.`,
        { payload: ['Too large to store.'] },
      )
    }

    const saved = saveComposerDraft({
      reviewerId: viewer.id,
      projectId: body.projectId,
      payload: body.payload,
      schemaVersion: body.schemaVersion,
    })

    return { ...saved, projectId: body.projectId }
  },
})
