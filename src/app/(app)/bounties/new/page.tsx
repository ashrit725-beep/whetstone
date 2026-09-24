/**
 * Post a bounty.
 *
 * Signed-in only, because the bounty is written against the creator's account
 * and the escrow ledger names them. A creator with nothing published is told so
 * rather than given a form whose first field has no options.
 *
 * The fee is not restated up here. The form works it out live on the amount
 * the creator types, which is a better example than any fixed one, and a
 * second example above it would show two different sums on one screen.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { getViewer } from '@/server/repos/users'
import { getBountyFeeSchedule } from '@/server/repos/bounties'
import { expertiseOptions, ownedProjectOptions } from '@/server/queries/marketplace'
import { BountyForm } from '@/components/marketplace/bounty-form'
import { EmptyState, Link } from '@/components/ui'

export const metadata: Metadata = {
  title: 'Post a bounty',
}

export default async function NewBountyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const claims = await currentClaimsLive()
  const viewer = getViewer(claims?.uid ?? null)
  if (!viewer) redirect(`/sign-in?next=${encodeURIComponent('/bounties/new')}`)

  const projects = ownedProjectOptions(viewer.id)
  const projectSlugRaw = sp['project']
  const projectSlug = typeof projectSlugRaw === 'string' ? projectSlugRaw : null
  const preselected = projectSlug ? projects.find((p) => p.slug === projectSlug) ?? null : null

  const fee = getBountyFeeSchedule()
  const areas = expertiseOptions()

  return (
    <div className="column-prose flex w-full flex-col gap-xl py-xl">
      <header className="flex flex-col gap-sm">
        <h1 className="text-2xl">Post a bounty</h1>
        <p className="measure-ui text-sm text-text-2">
          A bounty buys one specific piece of review work. The amount is committed
          before the bounty is advertised, reviewers apply with a pitch and a quote,
          and you pick one.
        </p>
        <p>
          <Link href="/bounties" variant="standalone">
            See what is already open
          </Link>
        </p>
      </header>

      {projects.length === 0 ? (
        <EmptyState
          title="You need a published project first"
          body="A bounty is attached to a build a reviewer can open. Publishing a project gives them the build, the ask and the grit step to work against."
          primaryAction={{ label: 'Post a project', href: '/new?then=bounty', primary: true }}
          secondaryAction={{ label: 'See reviewers taking paid work', href: '/experts' }}
        />
      ) : (
        <BountyForm
          projects={projects}
          expertiseOptions={areas}
          platformFeePercent={fee.platformFeePercent}
          defaultProjectId={preselected?.id ?? null}
        />
      )}
    </div>
  )
}
