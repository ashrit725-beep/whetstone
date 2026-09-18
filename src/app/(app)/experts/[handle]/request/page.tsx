/**
 * Request a paid review from one reviewer.
 *
 * A direct request is an invite-only bounty, not a separate mechanism. It runs
 * the same escrow, the same acceptance and the same ledger, so a creator cannot
 * end up with a payment path that has no audit trail behind it. The reviewer
 * still chooses whether to take the work.
 *
 * Signed-in only, because the bounty is written against the creator's account.
 * A creator with no published project is told that plainly instead of being
 * shown a form that cannot be posted, and so is a reviewer who followed the link
 * on their own rate card.
 */

import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { getViewer } from '@/server/repos/users'
import { getExpertByHandle, getExpertProfileRow } from '@/server/repos/profiles'
import {
  expertiseOptions,
  ownedProjectOptions,
} from '@/server/queries/marketplace'
import { getBountyFeeSchedule } from '@/server/repos/bounties'
import { BountyForm } from '@/components/marketplace/bounty-form'
import { EmptyState, Link } from '@/components/ui'
import { money, turnaround } from '@/components/marketplace/format'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const expert = getExpertByHandle(handle)
  if (!expert || getExpertProfileRow(expert.user.id)?.is_listed !== 1) notFound()
  return { title: `Request a review from ${expert.user.displayName}` }
}

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ handle }, sp] = await Promise.all([params, searchParams])
  const claims = await currentClaimsLive()
  const viewer = getViewer(claims?.uid ?? null)
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent(`/experts/${handle}/request`)}`)

  const expert = getExpertByHandle(handle)
  const listing = expert ? getExpertProfileRow(expert.user.id) : undefined
  if (!expert || listing?.is_listed !== 1) notFound()

  const projects = ownedProjectOptions(viewer.id)
  const projectSlugRaw = sp['project']
  const projectSlug = typeof projectSlugRaw === 'string' ? projectSlugRaw : null
  const preselected = projectSlug ? projects.find((p) => p.slug === projectSlug) ?? null : null

  const fee = getBountyFeeSchedule()
  const areas = expertiseOptions()
  const verifiedArea = expert.expertise.find((area) => area.isVerified) ?? null
  const defaultExpertiseId =
    areas.find((area) => area.label === verifiedArea?.label)?.value ?? null

  return (
    <div
      className="pad-inline mx-auto flex w-full flex-col gap-xl py-xl"
      style={{ maxInlineSize: 'var(--container-prose)' }}
    >
      <header className="flex flex-col gap-sm">
        <h1 className="text-2xl">Request a review from {expert.user.displayName}</h1>
        <p className="prose-human">{expert.headline}</p>
        <dl className="flex flex-wrap items-baseline gap-x-lg gap-y-2xs text-sm text-text-2">
          {expert.minBountyCents !== null ? (
            <div className="flex items-baseline gap-2xs">
              <dt className="text-text-3">Takes work from</dt>
              <dd className="tnum text-text-1">
                {money(expert.minBountyCents, expert.currency)}
              </dd>
            </div>
          ) : null}
          {turnaround(expert.turnaroundHours) ? (
            <div className="flex items-baseline gap-2xs">
              <dt className="text-text-3">Usual turnaround</dt>
              <dd className="tnum text-text-1">{turnaround(expert.turnaroundHours)}</dd>
            </div>
          ) : null}
        </dl>
        <p>
          <Link href={`/experts/${expert.user.handle}`} variant="standalone">
            Back to the rate card
          </Link>
        </p>
      </header>

      {expert.user.id === viewer.id ? (
        <EmptyState
          title="This is your own rate card"
          body="A direct request goes from a creator to another reviewer. To have your own work reviewed, post a bounty openly or pick a reviewer from the list."
          primaryAction={{ label: 'Post a bounty', href: '/bounties/new', primary: true }}
          secondaryAction={{ label: 'See every reviewer', href: '/experts' }}
        />
      ) : projects.length === 0 ? (
        <EmptyState
          title="You need a published project first"
          body="A paid review is a review of something. Publishing a project gives the reviewer a build, an ask and a grit step to work against, and you land back here afterwards."
          primaryAction={{
            label: 'Post a project',
            href: `/new?then=request:${expert.user.handle}`,
            primary: true,
          }}
          secondaryAction={{ label: 'See every reviewer', href: '/experts' }}
        />
      ) : (
        <BountyForm
          projects={projects}
          expertiseOptions={areas}
          platformFeePercent={fee.platformFeePercent}
          defaultProjectId={preselected?.id ?? null}
          defaultExpertiseId={defaultExpertiseId}
          defaultAmountDollars={
            expert.minBountyCents !== null ? Math.round(expert.minBountyCents / 100) : undefined
          }
          invited={{
            handle: expert.user.handle,
            displayName: expert.user.displayName,
            minBountyCents: expert.minBountyCents,
          }}
        />
      )}
    </div>
  )
}
