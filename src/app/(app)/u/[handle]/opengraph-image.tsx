import { notFound } from 'next/navigation'
import { getProfileByHandle } from '@/server/repos/profiles'
import { gritHistoryFor, topGritFor } from '@/server/queries/publishing'
import { renderProfileCard } from '@/server/api/og/card'

/**
 * The creator card.
 *
 * Its organising element is the same five-cell grit history strip the profile
 * page leads with: how many of this creator's published projects reached each
 * stage. Reputation is the sentence beneath it, never a badge wall and never a
 * bare giant number (CONTRACT §4.4, surface 6).
 */

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Whetstone creator card'

export default async function Image({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Response> {
  const { handle } = await params
  const profile = getProfileByHandle(handle)
  if (!profile) notFound()

  const cells = gritHistoryFor(profile.id)
  const shipped = cells.find((cell) => cell.key === 'shipped')?.count ?? 0
  const projects = cells.reduce((sum, cell) => sum + cell.count, 0)

  return renderProfileCard({
    displayName: profile.displayName,
    handle: profile.handle,
    bio: profile.bio,
    cells,
    topGrit: topGritFor(cells),
    projects,
    shipped,
    reviews: profile.counts.reviews,
  })
}
