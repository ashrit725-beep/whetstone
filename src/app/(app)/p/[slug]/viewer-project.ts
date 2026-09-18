/**
 * The project at this address, as the person reading it is allowed to see it.
 *
 * One gate for everything a project route renders. `generateMetadata` used to
 * look the slug up with no viewer and no visibility check, so a private or
 * unpublished project 404'd in the body while its title and tagline were
 * printed in `<title>` and the description meta for anyone who guessed the
 * slug. It also returned a "Project not found" title rather than calling
 * `notFound()`, which let the metadata contradict the page.
 *
 * Wrapped in `cache` so the metadata and the page share one identity check and
 * one query per request.
 */

import { cache } from 'react'
import { notFound } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { getProjectBySlug } from '@/server/repos/projects'
import type { ProjectDetail } from '@/lib/types'

export interface ViewerProject {
  readonly project: ProjectDetail
  readonly viewerId: string | null
}

export const projectForViewer = cache(async (slug: string): Promise<ViewerProject> => {
  const claims = await currentClaimsLive()
  const viewerId = claims?.uid ?? null

  const project = getProjectBySlug(slug, { viewerId })
  if (!project) notFound()
  // A private or unpublished project is not-found for everyone but its owner:
  // a 403 would confirm that it exists.
  if (!project.viewer.canEdit && (project.visibility !== 'public' || project.status !== 'published')) notFound()

  return { project, viewerId }
})
