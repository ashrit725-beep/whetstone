/**
 * Reviews this person wrote, each under the project it was for.
 *
 * The list holds reviews of projects anyone can open, because every row links
 * to one. The figures above it are the whole record, so a review of a project
 * that has since been paused still counts toward them.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { getProfileByHandle } from '@/server/repos/profiles'
import { listReviewsByUser } from '@/server/repos/feedback'
import { reviewerDepth } from '@/server/queries/profile'
import { ReviewRow } from '@/components/profile/review-row'
import { EmptyState, GritChip, Link } from '@/components/ui'
import { ofCount, plural } from '@/components/marketplace/format'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const profile = getProfileByHandle(handle)
  if (!profile) notFound()
  return {
    title: `Reviews by ${profile.displayName}`,
    alternates: { canonical: `/u/${profile.handle}/reviews` },
  }
}

export default async function ProfileReviewsPage({
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

  const page = listReviewsByUser(profile.id, { limit: 20, cursor, viewerId })
  const depth = reviewerDepth(profile.id)

  // Past the end of the list, which only a stale "Older reviews" link reaches:
  // the person has reviews, so the first page is the answer, not an empty state.
  if (page.items.length === 0 && cursor !== null) {
    return (
      <EmptyState
        variant="filtered"
        title="Nothing older than this"
        body="The list ends before this point. The newest reviews are on the first page."
        primaryAction={{
          label: 'Back to the newest reviews',
          href: `/u/${profile.handle}/reviews`,
          primary: true,
        }}
      />
    )
  }

  if (page.items.length === 0) {
    return (
      <EmptyState
        title="No reviews listed yet"
        body={
          profile.isSelf
            ? 'A review is the fastest way to build a record other creators can read. Each one you submit is listed here with the project it was for, while that project is public.'
            : `${profile.displayName} has no reviews of a public project yet. Each one they submit is listed here with the project it was for.`
        }
        primaryAction={
          profile.isSelf
            ? { label: 'Find a project to review', href: '/discover', primary: true }
            : { label: 'Read reviews across the bench', href: '/discover', primary: true }
        }
      />
    )
  }

  return (
    <section aria-labelledby="all-reviews" className="flex flex-col gap-md">
      <h2 id="all-reviews" className="text-md">
        {plural(profile.counts.reviews, 'review', 'reviews')} written
      </h2>

      <dl className="flex flex-wrap items-center gap-x-lg gap-y-xs border-b border-border-hair pb-md">
        <div className="flex items-center gap-2xs">
          <dt className="text-2xs text-text-3" style={TERM}>
            Usually reviews at
          </dt>
          <dd>
            {depth.medianGrit !== null ? (
              <GritChip value={depth.medianGrit} size="sm" showLabel />
            ) : (
              <span className="text-xs text-text-3">Not enough reviews to say.</span>
            )}
          </dd>
        </div>
        <div className="flex items-baseline gap-2xs">
          <dt className="text-2xs text-text-3" style={TERM}>
            Marked helpful
          </dt>
          <dd className="tnum text-xs text-text-2">
            {ofCount(depth.helpful.marked, depth.helpful.of)}
          </dd>
        </div>
        {depth.blockers > 0 ? (
          <div className="flex items-baseline gap-2xs">
            <dt className="text-2xs text-text-3" style={TERM}>
              Blockers found
            </dt>
            <dd className="tnum text-xs text-text-2">{depth.blockers}</dd>
          </div>
        ) : null}
      </dl>

      <ul aria-label={`Public reviews written by ${profile.displayName}`}>
        {page.items.map((review) => (
          <ReviewRow key={review.id} review={review} />
        ))}
      </ul>

      {page.hasMore && page.nextCursor ? (
        <p>
          <Link
            href={`/u/${profile.handle}/reviews?cursor=${encodeURIComponent(page.nextCursor)}`}
            variant="standalone"
          >
            Older reviews
          </Link>
        </p>
      ) : null}
    </section>
  )
}

const TERM = { fontVariationSettings: '"wdth" 87, "wght" 600' } as const
