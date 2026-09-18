import { z } from 'zod'
import { get } from '@/server/db/client'
import { followProject, unfollowProject } from '@/server/repos/projects'
import { canSeeProject, eitherBlocks, projectAccess } from '@/server/queries/access'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { forbidden, notFound } from '@/server/api/errors'
import { Id } from '@/server/api/schema'

/**
 * POST /api/projects/[projectId]/follow
 *
 * Following a project subscribes you to its versions and updates, so this is a
 * notification-producing relationship and not a bookmark. That is why it checks
 * blocks and why it takes a delivery preference: a follower who only wants to
 * hear about new builds should not be opted into every devlog post.
 *
 * `following: false` unfollows. A single idempotent verb beats a pair of routes
 * whose only difference is a method, and it means a double-tap settles on a
 * state rather than toggling past it.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Params = z.object({ projectId: Id })
const Body = z.object({
  following: z.boolean(),
  notify: z.enum(['all', 'versions', 'none']).default('all'),
})

function followerCount(projectId: string): number {
  const row = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM project_follows WHERE project_id = ?`,
    [projectId],
  )
  return row?.n ?? 0
}

export const POST = handler({
  auth: 'required',
  limit: LIMITS.follow,
  params: Params,
  body: Body,
  run({ viewer, params, body }) {
    const project = projectAccess(params.projectId)
    if (!project || !canSeeProject(project, viewer.id)) {
      throw notFound('That project is not here. It may have been unpublished or made private.')
    }

    if (body.following && eitherBlocks(viewer.id, project.ownerId)) {
      throw forbidden(
        'You cannot follow this project, because one of you has blocked the other. Lift the block from your settings if that was not intended.',
      )
    }

    if (body.following) followProject(viewer.id, params.projectId, body.notify)
    else unfollowProject(viewer.id, params.projectId)

    return {
      projectId: params.projectId,
      following: body.following,
      notify: body.following ? body.notify : 'none',
      followerCount: followerCount(params.projectId),
    }
  },
})
