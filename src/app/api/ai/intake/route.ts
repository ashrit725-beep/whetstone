import { z } from 'zod'
import { intake } from '@/server/ai'
import { canManageProject, projectAccess } from '@/server/queries/access'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { forbidden, notFound } from '@/server/api/errors'
import { Id, HttpsUrl} from '@/server/api/schema'

/**
 * POST /api/ai/intake
 *
 * The project intake assistant. From a description and some links it proposes a
 * type, a stage, tags, the rating axes reviewers will score, and a sharper ask.
 *
 * Nothing here writes. The response is a set of unsaved values the creator
 * edits and submits through the normal project routes, which is both the polite
 * behaviour and the accessible one: a form that rearranges itself under
 * someone's cursor is an unexpected change of context, and WCAG 3.2.2 has an
 * opinion about that. The trigger is a button, never a blur or a change event.
 *
 * Links are fetched by the server rather than handed to a model as a browsing
 * tool, so exactly what enters the prompt is under our control: an allowlist of
 * hosts, a three-second deadline, no redirect off the original host, and a hard
 * character cap. That fetch lives in `@/server/ai/intake`; this route only
 * passes the URLs through, and only after they have been parsed as https.
 *
 * When `projectId` is present the caller is editing an existing project, and
 * must be able to manage it. Without it they are drafting a new one, which any
 * signed-in account may do.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


const IntakeBody = z.object({
  description: z.string().trim().min(1).max(8_000),
  links: z.array(HttpsUrl).max(4).default([]),
  askAnswers: z
    .object({
      stage: z.string().trim().max(200).optional(),
      decision: z.string().trim().max(400).optional(),
      ignore: z.string().trim().max(400).optional(),
    })
    .optional(),
  projectId: Id.optional(),
  refresh: z.boolean().default(false),
})

export const POST = handler({
  auth: 'required',
  limit: LIMITS.aiIntake,
  body: IntakeBody,
  maxBytes: 32_768,
  async run({ viewer, body }) {
    if (body.projectId) {
      const project = projectAccess(body.projectId)
      if (!project || project.deleted) throw notFound('That project is not here.')
      if (!canManageProject(project, viewer.id)) {
        throw forbidden('Only this project’s creator and its collaborators can change how it is set up.')
      }
    }

    const linkMetadata =
      body.links.length > 0 ? await intake.fetchLinkMetadata(body.links) : []

    const result = await intake.generate(
      {
        description: body.description,
        links: body.links,
        linkMetadata,
        ...(body.askAnswers ? { askAnswers: body.askAnswers } : {}),
        userId: viewer.id,
      },
      { refresh: body.refresh },
    )

    return {
      suggestion: result.data,
      // The full picker travels with the suggestion, so the creator is choosing
      // from the real axis library rather than accepting whatever came back.
      axes: intake.axisPicker(result.data.projectType.value),
      source: result.source,
      label: intake.intakeLabel(result),
      ...(result.degraded ? { degraded: result.degraded } : {}),
    }
  },
})
