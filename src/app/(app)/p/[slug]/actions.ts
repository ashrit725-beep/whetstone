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
import {
  bookmarkProject,
  followProject,
  getProjectBySlug,
  unbookmarkProject,
  unfollowProject,
} from '@/server/repos/projects'

export async function toggleSaved(formData: FormData): Promise<void> {
  const claims = await currentClaimsLive()
  if (!claims) return

  const slug = String(formData.get('slug') ?? '')
  if (!slug) return

  const project = getProjectBySlug(slug, { viewerId: claims.uid })
  if (!project) return

  if (String(formData.get('saved') ?? '') === 'true') bookmarkProject(claims.uid, project.id)
  else unbookmarkProject(claims.uid, project.id)

  revalidatePath(`/p/${slug}`)
}

export async function toggleFollowing(formData: FormData): Promise<void> {
  const claims = await currentClaimsLive()
  if (!claims) return

  const slug = String(formData.get('slug') ?? '')
  if (!slug) return

  const project = getProjectBySlug(slug, { viewerId: claims.uid })
  if (!project) return

  // A creator's own project already appears in their dashboard, so following it
  // would only send them notifications about themselves.
  if (project.owner.id === claims.uid) return

  if (String(formData.get('following') ?? '') === 'true') followProject(claims.uid, project.id)
  else unfollowProject(claims.uid, project.id)

  revalidatePath(`/p/${slug}`)
}
