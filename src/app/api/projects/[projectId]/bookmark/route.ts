import { z } from 'zod'
import { get } from '@/server/db/client'
import { bookmarkProject, unbookmarkProject } from '@/server/repos/projects'
import { canSeeProject, projectAccess } from '@/server/queries/access'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { notFound } from '@/server/api/errors'
import { Id } from '@/server/api/schema'

/**
 * POST /api/projects/[projectId]/bookmark
 *
 * A private shelf, not a public signal. Nobody is notified, the count is never
 * rendered on the project, and the optional note is the reviewer's own ("come
 * back when the tutorial lands"), so it is read back only by the person who
 * wrote it.
 *
 * Because it is private it does not check blocks the way following does. It
 * does still check visibility: a bookmark on a project the viewer cannot open
 * would be a row that renders as a broken link on their own shelf.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const Params = z.object({ projectId: Id })
const Body = z.object({
  bookmarked: z.boolean(),
  note: z.string().trim().max(280).nullish(),
})

function bookmarkCount(userId: string): number {
  const row = get<{ n: number }>(`SELECT COUNT(*) AS n FROM project_bookmarks WHERE user_id = ?`, [
    userId,
  ])
  return row?.n ?? 0
}

export const POST = handler({
  auth: 'required',
  limit: LIMITS.bookmark,
  params: Params,
  body: Body,
  run({ viewer, params, body }) {
    const project = projectAccess(params.projectId)
    if (!project || !canSeeProject(project, viewer.id)) {
      throw notFound('That project is not here. It may have been unpublished or made private.')
    }

    if (body.bookmarked) bookmarkProject(viewer.id, params.projectId, body.note ?? null)
    else unbookmarkProject(viewer.id, params.projectId)

    return {
      projectId: params.projectId,
      bookmarked: body.bookmarked,
      shelfCount: bookmarkCount(viewer.id),
    }
  },
})
