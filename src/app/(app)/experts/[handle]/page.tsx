/**
 * One reviewer's rate card.
 *
 * The same two-column grammar as the list, opened out: identity, depth and
 * what has been verified on the left, the price block and the request action on
 * the right. Straw fills the amount and the request button, and nothing else on
 * the page.
 *
 * There are no packages and no tiers. A reviewer here has one minimum and one
 * hourly rate, both their own, and the delivery record beside them is counted
 * from awards rather than claimed in a pitch.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BadgeCheck, Clock, Users } from 'lucide-react'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import {
  getExpertByHandle,
  getExpertProfileRow,
  getProfileByHandle,
} from '@/server/repos/profiles'
import { countRequests, listRequests } from '@/server/repos/bounties'
import { domainsForUser } from '@/server/repos/reputation'
import { reviewerDepth, verifiedCredentialsFor } from '@/server/queries/profile'
import { VerifiedCredentials } from '@/components/profile/verified-credentials'
import { money, ofCount, plural, turnaround } from '@/components/marketplace/format'
import { inSentence } from '@/lib/utils'
import {
  Avatar,
  Badge,
  Button,
  GritChip,
  Link,
  Meter,
  Prose,
} from '@/components/ui'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  // The same test as the page, so the metadata can never describe a rate card
  // the page then refuses to show.
  const expert = getExpertByHandle(handle)
  if (!expert || getExpertProfileRow(expert.user.id)?.is_listed !== 1) notFound()
  return {
    title: `${expert.user.displayName} · paid reviews`,
    description: expert.headline.slice(0, 155),
    alternates: { canonical: `/experts/${expert.user.handle}` },
  }
}

export default async function ExpertPage({
  params,
  searchParams,
}: {
  params: Promise<{ handle: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ handle }, sp] = await Promise.all([params, searchParams])
  const claims = await currentClaimsLive()
  const viewerId = claims?.uid ?? null

  const expert = getExpertByHandle(handle)
  const listing = expert ? getExpertProfileRow(expert.user.id) : undefined
  if (!expert || listing?.is_listed !== 1) notFound()

  const profile = getProfileByHandle(handle, viewerId)
  const depth = reviewerDepth(expert.user.id)
  const credentials = verifiedCredentialsFor(expert.user.id)
  // Work that reached delivery, whatever became of it after. A direct request
  // stays between its two parties, so it is in this list only for them, and the
  // total is counted over the same rows.
  const deliveredFilter = { role: 'expert', statuses: DELIVERED_STATES, viewerId } as const
  const delivered = listRequests(expert.user.id, { ...deliveredFilter, limit: 5 })
  const deliveredTotal = delivered.hasMore
    ? countRequests(expert.user.id, deliveredFilter)
    : delivered.items.length
  const isSelf = viewerId === expert.user.id

  const projectRaw = sp['project']
  const project = typeof projectRaw === 'string' ? projectRaw : null
  const requestHref = project
    ? `/experts/${expert.user.handle}/request?project=${encodeURIComponent(project)}`
    : `/experts/${expert.user.handle}/request`

  // Per-domain credibility is the number that means something here: it is
  // earned on Whetstone rather than claimed on a résumé. It replays every review
  // the person wrote, so it is read for this one page, not for every list row.
  const domain = domainsForUser(expert.user.id)[0] ?? null

  return (
    <div
      className="pad-inline mx-auto flex w-full flex-col gap-xl py-xl"
      style={{ maxInlineSize: 'var(--container-detail)' }}
    >
      {/* One grid rather than two flex columns, so the reading order can differ
          from the placement: on a phone the price and the request action come
          straight after the name, not after the whole record. From lg the rail
          sits beside the name and the record and stays in view while it scrolls. */}
      <div className="grid gap-xl lg:grid-cols-[minmax(0,1fr)_var(--container-rail)] lg:gap-x-2xl">
        <header className="flex flex-col gap-md lg:col-start-1 lg:row-start-1">
          <div className="flex items-start gap-md">
            <Avatar
              userId={expert.user.id}
              name={expert.user.displayName}
              src={expert.user.avatarUrl}
              size="lg"
            />
            <div className="flex min-w-0 flex-col gap-2xs">
              <h1 className="text-2xl break-words">{expert.user.displayName}</h1>
              <p className="text-sm text-text-3">
                <Link href={`/u/${expert.user.handle}`} variant="inline">
                  @{expert.user.handle}
                </Link>
                {expert.yearsExperience !== null ? (
                  <span>
                    {' '}
                    · <span className="tnum">{expert.yearsExperience}</span> years in the work
                  </span>
                ) : null}
              </p>
            </div>
          </div>
          <p className="prose-human">{expert.headline}</p>
        </header>

        <aside
          aria-label="Rate and availability"
          className="flex flex-col gap-md lg:sticky lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start"
          style={{ insetBlockStart: 'calc(var(--nav-h) + var(--spacing-md))' }}
        >
          {expert.minBountyCents !== null ? (
            <p className="inline-flex w-fit items-baseline gap-2xs rounded-sm bg-straw-fill px-sm py-xs text-straw-ink">
              <span className="tnum text-lg" style={PRICE}>
                {money(expert.minBountyCents, expert.currency)}
              </span>
              <span className="text-2xs" style={TERM}>
                minimum
              </span>
            </p>
          ) : null}

          {/* Between a phone and the rail the block runs the full width, where a
              single column put each figure a whole line away from its label. */}
          <dl className="grid gap-xs sm:grid-cols-2 sm:gap-x-xl lg:grid-cols-1">
            {expert.hourlyRateCents !== null ? (
              <div className="flex items-baseline justify-between gap-md text-sm">
                <dt className="text-text-3">Hourly rate</dt>
                <dd className="tnum text-text-1">
                  {money(expert.hourlyRateCents, expert.currency)}
                </dd>
              </div>
            ) : null}
            {turnaround(expert.turnaroundHours) ? (
              <div className="flex items-center justify-between gap-md text-sm">
                <dt className="flex items-center gap-2xs text-text-3">
                  <Clock size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span>Turnaround</span>
                </dt>
                <dd className="tnum text-text-1">{turnaround(expert.turnaroundHours)}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-md text-sm">
              <dt className="flex items-center gap-2xs text-text-3">
                <Users size={16} strokeWidth={1.5} aria-hidden="true" />
                <span>Reviews a week</span>
              </dt>
              <dd className="tnum text-text-1">{expert.capacityPerWeek}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-md text-sm">
              <dt className="text-text-3">Paid reviews accepted</dt>
              <dd className="tnum text-text-1">{expert.completedCount}</dd>
            </div>
            {expert.avgRating > 0 ? (
              <div className="flex items-baseline justify-between gap-md text-sm">
                <dt className="text-text-3">Rated by creators</dt>
                <dd className="tnum text-text-1">{expert.avgRating.toFixed(1)} of 5</dd>
              </div>
            ) : null}
          </dl>

          {profile ? (
            <p>
              <Badge tone={profile.availability === 'closed' ? 'neutral' : 'positive'}>
                {profile.availability === 'closed'
                  ? 'Not taking review requests'
                  : profile.availability === 'limited'
                    ? 'Limited availability'
                    : 'Open to review requests'}
              </Badge>
            </p>
          ) : null}

          {isSelf ? (
            <p className="measure-ui text-sm text-text-2">
              This is your rate card. Creators request paid reviews from you here, and each
              request reaches you as a notification.
            </p>
          ) : expert.capacityPerWeek > 0 && profile?.availability !== 'closed' ? (
            <Button as="a" href={requestHref} variant="straw" fullWidth>
              Request a paid review
            </Button>
          ) : (
            <Button
              disabled
              fullWidth
              disabledReason="This reviewer has closed their books for now. Following them puts their next opening in your notifications."
            >
              Request a paid review
            </Button>
          )}

          {expert.isVerified ? (
            <p className="flex items-start gap-2xs text-xs text-text-3">
              <BadgeCheck size={16} strokeWidth={1.5} aria-hidden="true" className="mt-3xs text-positive" />
              <span>
                Listed because at least one area was verified.{' '}
                <Link href="#verified" variant="inline">
                  What has been verified
                </Link>{' '}
                names which.
              </span>
            </p>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-col gap-xl lg:col-start-1 lg:row-start-2">
          {expert.pitchMd ? (
            <section aria-labelledby="pitch" className="flex flex-col gap-sm">
              <h2 id="pitch" className="text-md">
                How they work
              </h2>
              <Prose content={expert.pitchMd} allow="article" />
            </section>
          ) : null}

          <section aria-labelledby="depth" className="flex flex-col gap-md">
            <h2 id="depth" className="text-md">
              What they review, and how deep
            </h2>
            <dl className="flex flex-col gap-md">
              <div className="flex flex-wrap items-center gap-x-sm gap-y-2xs border-t border-border-hair pt-sm">
                <dt className="text-2xs text-text-3" style={TERM}>
                  Median grit reviewed
                </dt>
                <dd className="flex flex-wrap items-center gap-xs text-sm text-text-2">
                  {depth.medianGrit !== null ? (
                    <>
                      <GritChip value={depth.medianGrit} size="md" showLabel />
                      <span className="text-text-3">
                        across {plural(depth.reviews, 'review', 'reviews')}
                        {depth.range && depth.range.low !== depth.range.high ? (
                          <>
                            , from <span className="tnum">{depth.range.low}</span> to{' '}
                            <span className="tnum">{depth.range.high}</span>
                          </>
                        ) : null}
                      </span>
                    </>
                  ) : (
                    <span className="text-text-3">No reviews written on Whetstone yet.</span>
                  )}
                </dd>
              </div>

              {depth.categories.length > 0 ? (
                <div className="flex flex-col gap-2xs border-t border-border-hair pt-sm">
                  <dt className="text-2xs text-text-3" style={TERM}>
                    Categories they write in
                  </dt>
                  <dd className="flex flex-wrap gap-x-md gap-y-2xs text-sm text-text-2">
                    {depth.categories.map((category) => (
                      <span key={category.label}>
                        {category.label} <span className="tnum text-text-3">{category.count}</span>
                      </span>
                    ))}
                  </dd>
                </div>
              ) : null}

              {depth.types.length > 0 ? (
                <div className="flex flex-col gap-2xs border-t border-border-hair pt-sm">
                  <dt className="text-2xs text-text-3" style={TERM}>
                    Project types
                  </dt>
                  <dd className="flex flex-wrap gap-x-md gap-y-2xs text-sm text-text-2">
                    {depth.types.map((type) => (
                      <span key={type.label}>
                        {type.label} <span className="tnum text-text-3">{type.count}</span>
                      </span>
                    ))}
                  </dd>
                </div>
              ) : null}

              <div className="flex flex-wrap items-baseline gap-x-sm gap-y-2xs border-t border-border-hair pt-sm">
                <dt className="text-2xs text-text-3" style={TERM}>
                  Creators who marked a review helpful
                </dt>
                <dd className="tnum text-sm text-text-2">
                  {depth.helpful.of > 0
                    ? ofCount(depth.helpful.marked, depth.helpful.of)
                    : 'No reviews to mark yet'}
                </dd>
              </div>

              {depth.blockers > 0 ? (
                <div className="flex flex-wrap items-baseline gap-x-sm gap-y-2xs border-t border-border-hair pt-sm">
                  <dt className="text-2xs text-text-3" style={TERM}>
                    Blocker-severity findings
                  </dt>
                  <dd className="tnum text-sm text-text-2">{depth.blockers}</dd>
                </div>
              ) : null}
            </dl>

            {domain ? (
              <Meter
                label={`Credibility in ${inSentence(domain.label)}`}
                value={domain.score}
                min={0}
                max={1000}
                valueText={`${domain.label}: ${String(domain.score)} of 1000, ${domain.tier}`}
                tone={domain.isExpert ? 'positive' : 'accent'}
              />
            ) : null}
            <p className="measure-ui text-xs text-text-3">
              Credibility is earned inside one project type and decays over time.{' '}
              <Link href={`/u/${expert.user.handle}/reputation`} variant="inline">
                See the whole calculation
              </Link>
              .
            </p>
          </section>

          <section aria-labelledby="verified" className="flex flex-col gap-md">
            <h2 id="verified" className="text-md">
              What has been verified
            </h2>
            <VerifiedCredentials credentials={credentials} declared={expert.expertise} />
          </section>

          <section aria-labelledby="delivered" className="flex flex-col gap-md">
            <div className="flex flex-col gap-2xs">
              <h2 id="delivered" className="text-md">
                Paid work delivered here
              </h2>
              {deliveredTotal > delivered.items.length ? (
                <p className="text-sm text-text-3">
                  The latest <span className="tnum">{delivered.items.length}</span> of{' '}
                  <span className="tnum">{deliveredTotal}</span>.
                </p>
              ) : null}
            </div>
            {delivered.items.length === 0 ? (
              <p className="measure-ui text-sm text-text-3">
                No paid review has been delivered through Whetstone yet. The verified
                areas above are what stands behind the rate until one has.
              </p>
            ) : (
              <ul className="flex flex-col gap-xs">
                {delivered.items.map((request) => (
                  <li
                    key={request.awardId}
                    className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-2xs border-t border-border-hair py-sm first:border-t-0"
                  >
                    <span className="text-sm text-text-2">
                      {request.bountyTitle}{' '}
                      <span className="text-text-3">on {request.projectTitle}</span>
                    </span>
                    <span className="flex items-center gap-xs">
                      <Badge tone={request.status === 'accepted' ? 'positive' : 'neutral'}>
                        {AWARD_STATUS[request.status] ?? 'Delivered'}
                      </Badge>
                      <span className="tnum text-sm text-text-2">
                        {money(request.amountCents, request.currency)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

/** The award states a review has been delivered in, accepted or not. */
const DELIVERED_STATES = ['delivered', 'revision_requested', 'accepted', 'disputed'] as const

const AWARD_STATUS: Record<string, string> = {
  delivered: 'Delivered',
  accepted: 'Accepted',
  revision_requested: 'Revision asked for',
  disputed: 'Disputed',
}

const TERM = { fontVariationSettings: '"wdth" 87, "wght" 600' } as const
const PRICE = { fontVariationSettings: '"wdth" 104, "wght" 620' } as const
