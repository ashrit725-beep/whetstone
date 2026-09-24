'use server'

/**
 * The two writes the project page owns that are not already actions elsewhere.
 *
 * Saving keeps a project on a reader's own list. Following asks to hear about
 * it: `project_follows` carries a notify preference and drives the notification
 * the creator's next build sends. Both were in the schema and the repository
 * from the start; only saving had a control, so following was a row nobody
 * could ever write.
 *
 * The caller passes the state it wants rather than “flip it”, so a double
 * submit from an impatient pointer cannot land the reader on the opposite of
 * what they asked for.
 */

import { revalidatePath } from 'next/cache'
// Authorises from `claims.uid`, so the claims must come from a session that is
// still live: a signature alone cannot tell a revoked cookie from a good one.
import { currentClaimsLive } from '@/server/queries/auth'
import { canSeeProject, eitherBlocks, projectAccess } from '@/server/queries/access'
import {
  bookmarkProject,
  followProject,
  getProjectBySlug,
  unbookmarkProject,
  unfollowProject,
} from '@/server/repos/projects'

/**
 * The project this slug names, when the caller is allowed to see it.
 *
 * `getProjectBySlug` answers for any row that exists, which is the read a
 * signed-in owner needs; it says nothing about whether *this* caller may act.
 * Both forms below carry the slug in a hidden field, so a private, unpublished
 * project could be followed or bookmarked by anyone who retargeted the form —
 * and the follow then delivered notifications naming a draft the reader gets a
 * 404 on. The API twins run exactly this gate.
 */
function actionable(formData: FormData, uid: string): { id: string; slug: string; ownerId: string } | null {
  const slug = String(formData.get('slug') ?? '')
  if (!slug) return null

  const project = getProjectBySlug(slug, { viewerId: uid })
  if (!project) return null

  const access = projectAccess(project.id)
  if (!access || !canSeeProject(access, uid)) return null

  return { id: project.id, slug, ownerId: project.owner.id }
}

export async function toggleSaved(formData: FormData): Promise<void> {
  const claims = await currentClaimsLive()
  if (!claims) return

  const project = actionable(formData, claims.uid)
  if (!project) return

  if (String(formData.get('saved') ?? '') === 'true') bookmarkProject(claims.uid, project.id)
  else unbookmarkProject(claims.uid, project.id)

  revalidatePath(`/p/${project.slug}`)
}

export async function toggleFollowing(formData: FormData): Promise<void> {
  const claims = await currentClaimsLive()
  if (!claims) return

  const project = actionable(formData, claims.uid)
  if (!project) return

  // A creator's own project already appears in their dashboard, so following it
  // would only send them notifications about themselves.
  if (project.ownerId === claims.uid) return

  const following = String(formData.get('following') ?? '') === 'true'
  // Following delivers notifications, so it is refused across a block in either
  // direction — the same rule the API route applies.
  if (following && eitherBlocks(claims.uid, project.ownerId)) return

  if (following) followProject(claims.uid, project.id)
  else unfollowProject(claims.uid, project.id)

  revalidatePath(`/p/${project.slug}`)
}
