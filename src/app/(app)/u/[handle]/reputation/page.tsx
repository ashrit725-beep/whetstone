/**
 * Reputation, with the arithmetic on screen.
 *
 * Expertise here is per domain, so the per-domain meters lead and the single
 * figure is a footnote. Every term in the per-review table comes from
 * `perReviewValues`, which is the same computation the score itself runs.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getExpertByHandle, getProfileByHandle } from '@/server/repos/profiles'
import { computeReputation, perReviewValues } from '@/server/repos/reputation'
import { ReputationBreakdown } from '@/components/profile/reputation-breakdown'
import { VerifiedCredentials } from '@/components/profile/verified-credentials'
import { verifiedCredentialsFor } from '@/server/queries/profile'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const profile = getProfileByHandle(handle)
  if (!profile) notFound()
  return {
    title: `Reputation of ${profile.displayName}`,
    alternates: { canonical: `/u/${profile.handle}/reputation` },
  }
}

export default async function ProfileReputationPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const { handle } = await params
  const profile = getProfileByHandle(handle)
  if (!profile) notFound()

  const reputation = computeReputation(profile.id)
  const reviews = perReviewValues(profile.id)
  const credentials = verifiedCredentialsFor(profile.id)
  const expert = getExpertByHandle(profile.handle)

  return (
    <div className="flex flex-col gap-2xl">
      <ReputationBreakdown
        reputation={reputation}
        reviews={reviews}
        displayName={profile.displayName}
      />

      <section aria-labelledby="rep-verification" className="flex flex-col gap-md">
        <h2 id="rep-verification" className="text-md">
          What has been verified
        </h2>
        <VerifiedCredentials credentials={credentials} declared={expert?.expertise} />
      </section>
    </div>
  )
}
