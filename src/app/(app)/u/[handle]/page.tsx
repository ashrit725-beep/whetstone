/**
 * Profile overview.
 *
 * The header above already carries the grit strip and the reputation sentence,
 * so this tab is the two lists a reader came for, shortened: the most recent
 * projects and the most recent public reviews, each with one link to the whole
 * set. A brand-new profile gets a real empty state, written for the person
 * looking at it.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { getProfileByHandle } from '@/server/repos/profiles'
import { listProjects } from '@/server/repos/projects'
import { listReviewsByUser } from '@/server/repos/feedback'
import { publicProjectIdsFor } from '@/server/queries/profile'
import { ProjectList } from '@/components/profile/project-list'
import { ReviewRow } from '@/components/profile/review-row'
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
    title: `${profile.displayName} · @${profile.handle}`,
    description:
      profile.bio?.slice(0, 155) ??
      `${profile.displayName} on Whetstone: projects, reviews and the record behind them.`,
    alternates: { canonical: `/u/${profile.handle}` },
  }
}

export default async function ProfileOverviewPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const claims = await currentClaimsLive()
  const viewerId = claims?.uid ?? null
  const profile = getProfileByHandle(handle, viewerId)
  if (!profile) notFound()

  const ids = publicProjectIdsFor(profile.id)
  const projects =
    ids.length > 0
      ? listProjects({ projectIds: ids }, { limit: 5, sort: 'newest', viewerId }).items
      : []
  const reviews = listReviewsByUser(profile.id, { limit: 3, viewerId }).items

  if (projects.length === 0 && reviews.length === 0) {
    return (
      <EmptyState
        title={
          profile.isSelf
            ? 'Your profile has nothing on it yet'
            : `${profile.displayName} has not posted or reviewed yet`
        }
        body={
          profile.isSelf
            ? 'This page is what a reviewer reads before deciding whether to spend an hour on your build. A project gives them something to react to, and a review gives them a reason to trust you.'
            : 'Nothing is published under this name and there are no reviews on record. Drafts and private projects never appear on a profile, so there may be work in progress that only its owner can see.'
        }
        primaryAction={
          profile.isSelf
            ? { label: 'Post your first project', href: '/new', primary: true }
            : { label: 'See what is being reviewed', href: '/discover', primary: true }
        }
        secondaryAction={
          profile.isSelf ? { label: 'Find a project to review', href: '/discover' } : undefined
        }
      />
    )
  }

  return (
    <div className="flex flex-col gap-2xl">
      {projects.length > 0 ? (
        <section aria-labelledby="recent-projects" className="flex flex-col gap-md">
          <div className="flex flex-wrap items-baseline justify-between gap-xs">
            <h2 id="recent-projects" className="text-md">
              Recent projects
            </h2>
            {profile.counts.projects > projects.length ? (
              <Link href={`/u/${profile.handle}/projects`} variant="standalone">
                All {profile.counts.projects} projects
              </Link>
            ) : null}
          </div>
          <ProjectList
            projects={projects}
            label={`Projects by ${profile.displayName}`}
            bench={false}
          />
        </section>
      ) : null}

      {reviews.length > 0 ? (
        <section aria-labelledby="recent-reviews" className="flex flex-col gap-md">
          <div className="flex flex-wrap items-baseline justify-between gap-xs">
            <h2 id="recent-reviews" className="text-md">
              Recent reviews
            </h2>
            {profile.counts.reviews > reviews.length ? (
              <Link href={`/u/${profile.handle}/reviews`} variant="standalone">
                All {profile.counts.reviews} reviews
              </Link>
            ) : null}
          </div>
          <ul aria-label={`Reviews written by ${profile.displayName}`}>
            {reviews.map((review) => (
              <ReviewRow key={review.id} review={review} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
