/**
 * Every public project this person has published, in the Discover feed's row.
 *
 * The list is resolved to explicit project ids first, so a profile can never
 * show a draft or a private row: `listProjects` widens deliberately when it is
 * given a bare `ownerId`, because that call is also the owner's own shelf.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { getProfileByHandle } from '@/server/repos/profiles'
import { listProjects } from '@/server/repos/projects'
import { publicProjectIdsFor } from '@/server/queries/profile'
import { ProjectList } from '@/components/profile/project-list'
import { EmptyState, Link } from '@/components/ui'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const profile = getProfileByHandle(handle)
  if (!profile) notFound()
  return {
    title: `Projects by ${profile.displayName}`,
    alternates: { canonical: `/u/${profile.handle}/projects` },
  }
}

export default async function ProfileProjectsPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ handle }, sp] = await Promise.all([params, searchParams])
  const claims = await currentClaimsLive()
  const viewerId = claims?.uid ?? null
  const profile = getProfileByHandle(handle, viewerId)
  if (!profile) notFound()

  const cursorRaw = sp['cursor']
  const cursor = typeof cursorRaw === 'string' ? cursorRaw : null

  const ids = publicProjectIdsFor(profile.id)
  const page =
    ids.length > 0
      ? listProjects({ projectIds: ids }, { limit: 20, cursor, sort: 'newest', viewerId })
      : { items: [], hasMore: false, nextCursor: null }

  // Past the end of the list, which only a stale "Older projects" link reaches.
  if (page.items.length === 0 && cursor !== null) {
    return (
      <EmptyState
        variant="filtered"
        title="Nothing older than this"
        body="The list ends before this point. The newest projects are on the first page."
        primaryAction={{
          label: 'Back to the newest projects',
          href: `/u/${profile.handle}/projects`,
          primary: true,
        }}
      />
    )
  }

  if (page.items.length === 0) {
    return (
      <EmptyState
        title={profile.isSelf ? 'You have not published a project yet' : 'No public projects'}
        body={
          profile.isSelf
            ? 'A published project is what a reviewer can react to. Drafts stay private until you publish them, so nothing here is visible to anyone else yet.'
            : `${profile.displayName} has nothing published. Unlisted and private projects never appear on a profile.`
        }
        primaryAction={
          profile.isSelf
            ? { label: 'Post a project', href: '/new', primary: true }
            : { label: 'See what is being reviewed', href: '/discover', primary: true }
        }
      />
    )
  }

  return (
    <section aria-labelledby="all-projects" className="flex flex-col gap-md">
      <h2 id="all-projects" className="text-md">
        <span className="tnum">{profile.counts.projects}</span>{' '}
        {profile.counts.projects === 1 ? 'published project' : 'published projects'}
      </h2>
      <ProjectList projects={page.items} label={`Projects by ${profile.displayName}`} />
      {page.hasMore && page.nextCursor ? (
        <p>
          <Link
            href={`/u/${profile.handle}/projects?cursor=${encodeURIComponent(page.nextCursor)}`}
            variant="standalone"
          >
            Older projects
          </Link>
        </p>
      ) : null}
    </section>
  )
}
