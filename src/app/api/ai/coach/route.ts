import { z } from 'zod'
import { coach } from '@/server/ai'
import { isProjectType } from '@/server/ai'
import { canSeeProject, projectAccess } from '@/server/queries/access'
import { projectVocabularyFor } from '@/server/queries/cluster-input'
import { get } from '@/server/db/client'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { forbidden, notFound } from '@/server/api/errors'
import { Id } from '@/server/api/schema'

/**
 * POST /api/ai/coach
 *
 * The composer's writing coach, for one draft.
 *
 * This route never blocks a submit and has no verb: it returns a verdict, five
 * booleans and at most two suggestion chips, and the reviewer posts whenever
 * they like. All of the anti-annoyance rules live inside `@/server/ai/coach`
 * (two nudges per draft, sixty seconds between them, silence for a draft that
 * already reads well, permanently off for a reviewer who turned it off), which
 * is the right place for them: they are product rules, not client behaviour,
 * and a client that forgot one would be irritating for everyone.
 *
 * What this route adds is authorisation and cost control:
 *
 *  - the draft id is namespaced with the caller's user id before it reaches the
 *    coach, so one reviewer cannot spend, read or reset another reviewer's
 *    nudge budget by guessing a draft id;
 *  - the project must exist and be visible, and must not be the caller's own,
 *    which is the same rule the draft route enforces;
 *  - forty calls an hour with a four-second floor, on top of the AI layer's own
 *    per-user daily cost ceiling. A stuck client costs one request.
 *
 * `dismiss` is a separate verb on the same route rather than a second endpoint,
 * because it is the same budget being spent from the other end.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CoachBody = z.object({
  draftId: z.string().trim().min(8).max(64),
  projectId: Id,
  draft: z.string().max(8_000),
  axisKey: z.string().trim().max(32).optional(),
  /** `dismiss` records the reviewer closing the panel; it returns no advice. */
  action: z.enum(['check', 'dismiss', 'forget']).default('check'),
})

export const POST = handler({
  auth: 'required',
  limit: LIMITS.aiCoach,
  body: CoachBody,
  maxBytes: 32_768,
  async run({ viewer, body }) {
    const project = projectAccess(body.projectId)
    if (!project || !canSeeProject(project, viewer.id)) {
      throw notFound('That project is not here. It may have been unpublished while you were writing.')
    }
    if (project.ownerId === viewer.id) {
      throw forbidden('This is your own project, so there is no review here to coach.')
    }

    // The caller names a draft; the coach is told about a draft belonging to
    // this reviewer. Those are different strings on purpose.
    const draftId = `${viewer.id}:${body.draftId}`

    if (body.action === 'dismiss') {
      coach.noteDismissed(draftId)
      return { draftId: body.draftId, dismissed: true, coaching: null }
    }
    if (body.action === 'forget') {
      coach.forgetDraft(draftId)
      return { draftId: body.draftId, dismissed: false, coaching: null }
    }

    const context = get<{ slug: string; prompt: string | null }>(
      `SELECT pt.slug,
              (SELECT pa.prompt FROM project_asks pa
                WHERE pa.project_id = p.id ORDER BY pa.sort_order LIMIT 1) AS prompt
         FROM projects p JOIN project_types pt ON pt.id = p.project_type_id
        WHERE p.id = ?`,
      [body.projectId],
    )

    const result = await coach.generate({
      draftId,
      draft: body.draft,
      projectId: body.projectId,
      ...(context && isProjectType(context.slug) ? { projectType: context.slug } : {}),
      ...(context?.prompt ? { ask: context.prompt } : {}),
      ...(body.axisKey ? { axisKey: body.axisKey } : {}),
      vocabulary: projectVocabularyFor(body.projectId),
      reviewerId: viewer.id,
    })

    return {
      draftId: body.draftId,
      dismissed: false,
      coaching: result.data,
      // Provenance, so the panel can say where the reading came from rather
      // than implying a model wrote it when the linter did.
      source: result.source,
      ...(result.degraded ? { degraded: result.degraded } : {}),
    }
  },
})
