import { z } from 'zod'
import { themes, isProjectType } from '@/server/ai'
import { canManageProject, projectAccess } from '@/server/queries/access'
import { clusterInputFor } from '@/server/queries/cluster-input'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { forbidden, notFound, stateInvalid } from '@/server/api/errors'
import { Id } from '@/server/api/schema'
import { consume } from '@/server/api/rate-limit'

/**
 * POST /api/ai/cluster
 *
 * Turns a project's raw feedback points into ranked themes: a label, a
 * one-line summary, verbatim quotes, members and an impact estimate.
 *
 * **This is the authorisation that matters in this surface.** Clustering reads
 * every point on a project, including points on creator-only reviews, and
 * returns verbatim quotes from them. Anything less than "may this person
 * manage this project" would turn a rollup into a way to read private feedback
 * about someone else's work. Owner or collaborator only, checked here, and a
 * public project is no exception.
 *
 * The bucket is keyed on the **project**, not on the caller, so two
 * collaborators share one allowance and cannot double the spend by taking
 * turns. The rate limiter the wrapper already ran is the per-subject one; this
 * second `consume` is the project-scoped ceiling, and it runs after the
 * ownership check so an unauthorised caller cannot drain someone else's budget
 * by asking.
 *
 * Below five reviews there is nothing to cluster: three notes are a list, not a
 * pattern, and naming a theme from them would be the product inventing
 * consensus. That is a 409 with the shortfall named, so the dashboard can say
 * how many more are needed.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIN_POINTS = 5

const ClusterBody = z.object({
  projectId: Id,
  /** Forces a fresh model run instead of serving a matching cached artifact. */
  refresh: z.boolean().default(false),
})

export const POST = handler({
  auth: 'required',
  limit: LIMITS.aiCluster,
  body: ClusterBody,
  async run({ viewer, body }) {
    const project = projectAccess(body.projectId)
    if (!project || project.deleted) {
      throw notFound('That project is not here.')
    }

    if (!canManageProject(project, viewer.id)) {
      throw forbidden(
        'Only this project’s creator and its collaborators can build its theme rollup, because the rollup quotes feedback that was written for them.',
      )
    }

    const input = clusterInputFor(body.projectId)
    if (input.items.length < MIN_POINTS) {
      throw stateInvalid(
        `This project has ${input.items.length} ${
          input.items.length === 1 ? 'note' : 'notes'
        }, and themes need at least ${MIN_POINTS}. Below that a rollup would be naming a pattern that is not there yet.`,
        { have: input.items.length, need: MIN_POINTS },
      )
    }

    // Project-scoped ceiling, spent only once the caller has proved they may
    // spend it. Co-owners share this bucket.
    const perProject = consume(
      [{ id: 'ai.cluster.project', capacity: 5, windowMs: 3_600_000, floorMs: 30_000 }],
      `project:${body.projectId}`,
    )
    if (!perProject.allowed) {
      throw stateInvalid(
        `This project’s rollup was rebuilt very recently. The next rebuild is available in ${perProject.reset} seconds; the board below is the last one.`,
        { retryAfter: perProject.reset },
      )
    }

    const result = await themes.generate(
      {
        projectId: body.projectId,
        ...(isProjectType(input.typeSlug) ? { projectType: input.typeSlug } : {}),
        ...(input.ask ? { ask: input.ask } : {}),
        categories: input.categories,
        items: input.items,
      },
      { refresh: body.refresh, userId: viewer.id },
    )

    return {
      projectId: body.projectId,
      report: result.data,
      itemsConsidered: input.items.length,
      source: result.source,
      generatedAt: result.generatedAt,
      ...(result.model ? { model: result.model } : {}),
      ...(result.degraded ? { degraded: result.degraded } : {}),
      ...(result.stale ? { stale: result.stale } : {}),
    }
  },
})
