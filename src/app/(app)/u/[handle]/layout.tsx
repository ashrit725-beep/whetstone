/**
 * Public creator profile, surface 6.
 *
 * Bold element: the five-cell grit history strip across the header. The header
 * lives in the layout, so switching tabs never redraws the identity block, and
 * the tab strip is the one client island (it reads the pathname).
 *
 * No segment under this one has a loading.tsx. A loading boundary above the
 * page flushes a 200 before the page can call `notFound()`, which turned every
 * unknown handle into a soft 404; every read here is a synchronous indexed
 * query, so there is nothing slow enough to hold a skeleton for anyway.
 *
 * Public to everyone, including a crawler: nothing here is gated.
 */

import type { ReactNode } from 'react'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { getProfileByHandle, getExpertProfileRow } from '@/server/repos/profiles'
import {
  feedbackReceivedFor,
  gritHistoryFor,
  reviewerDepth,
} from '@/server/queries/profile'
import { ProfileHeader } from '@/components/profile/profile-header'

export default async function ProfileLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const claims = await currentClaimsLive()
  const profile = getProfileByHandle(handle, claims?.uid ?? null)

  // An unknown handle is the page's call to make, not the layout's: a
  // `notFound()` thrown from a layout is caught by the *parent* segment's
  // boundary, which would show the app-wide 404 instead of this route's own
  // "no account with that handle" and its people search.
  //
  // The column is the prose measure, not the feed's 72rem. There is no list
  // here to line up with: at 1440 the feed width drew a 1150px panel around
  // three lines of text and two buttons, which is the shape of a page that
  // failed to load rather than the shape of an answer.
  if (!profile) {
    return (
      <div className="column-prose w-full py-xl">
        {children}
      </div>
    )
  }

  const gritCounts = gritHistoryFor(profile.id)
  const shipped = gritCounts[8000] ?? 0
  const depth = reviewerDepth(profile.id)
  const listing = getExpertProfileRow(profile.id)

  return (
    <div
      className="pad-inline mx-auto flex w-full flex-col gap-xl py-xl"
      style={{ maxInlineSize: 'var(--container-feed)' }}
    >
      <ProfileHeader
        profile={profile}
        gritCounts={gritCounts}
        totals={{
          projects: profile.counts.projects,
          shipped,
          feedbackReceived: feedbackReceivedFor(profile.id),
          reviewsWritten: profile.counts.reviews,
          helpfulMarks: depth.helpful.marked,
        }}
        hasExpertListing={listing?.is_listed === 1}
        counts={{ projects: profile.counts.projects, reviews: profile.counts.reviews }}
      />
      {children}
    </div>
  )
}
