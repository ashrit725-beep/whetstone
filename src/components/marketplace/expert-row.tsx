/**
 * One reviewer on the marketplace: a rate-card row, not a tier card (§4.4
 * surface 7).
 *
 * Two columns. Identity and depth on the left, in a `<dl>` whose terms are the
 * things a creator actually chooses on: the grit steps this person reviews at,
 * the categories they write in, and what has been verified about them. Price on
 * the right in Archivo at `--text-lg` with tabular figures.
 *
 * This is the one surface where straw is a fill (§2.4.10). In a list it fills
 * the amount and nothing else: a column of straw buttons out-shouts the column
 * of prices, and the price is the fact a creator is scanning for. The straw
 * button belongs on the reviewer's own page, where it is the single action.
 * Here the request is a bordered control beneath the rate.
 *
 * Keyboard contract: two tab stops per row, the name link and the request
 * button, in visual order. Nothing is hover-only.
 */

import { BadgeCheck, Clock, Users } from 'lucide-react'
import { Avatar, Badge, Button, GritChip, Link } from '@/components/ui'
import type { ExpertCard } from '@/lib/types'
import type { ReviewerDepth } from '@/server/queries/profile'
import { money, plural, turnaround } from '@/components/marketplace/format'
import { inSentence } from '@/lib/utils'

export interface MatchNote {
  /** Areas this reviewer declares that the project is actually about. */
  areas: readonly { slug: string; label: string; level: string; isVerified: boolean }[]
  reviewsInType: number
  typeLabel: string
  helpful: { marked: number; of: number }
}

export interface ExpertRowProps {
  expert: ExpertCard
  depth: ReviewerDepth
  /** Set on the "matches for this project" list. Prints why, in real numbers. */
  match?: MatchNote
  /** Carried into the request route so the form arrives with the project set. */
  requestFor?: string | null
}

export function ExpertRow({ expert, depth, match, requestFor }: ExpertRowProps) {
  const { user } = expert
  const requestHref = requestFor
    ? `/experts/${user.handle}/request?project=${encodeURIComponent(requestFor)}`
    : `/experts/${user.handle}/request`

  return (
    <li className="flex flex-col gap-md border-t border-border-hair py-lg first:border-t-0 sm:flex-row sm:items-start sm:justify-between sm:gap-xl">
      <div className="flex min-w-0 flex-1 flex-col gap-sm">
        <div className="flex items-start gap-sm">
          <Avatar userId={user.id} name={user.displayName} src={user.avatarUrl} size="md" />
          <div className="flex min-w-0 flex-col gap-3xs">
            <h3 className="text-md break-words">
              <Link
                href={`/experts/${user.handle}`}
                variant="inline"
                className="tap-44 inline-block break-words text-text-1 no-underline hover:underline"
              >
                {user.displayName}
              </Link>
            </h3>
            <p className="text-xs text-text-3">
              <span>@{user.handle}</span>
              {expert.yearsExperience !== null ? (
                <span>
                  {' '}
                  · <span className="tnum">{expert.yearsExperience}</span> years in the work
                </span>
              ) : null}
            </p>
          </div>
        </div>

        <p className="prose-human text-xs">{expert.headline}</p>

        <dl className="flex flex-col gap-xs">
          <div className="flex flex-wrap items-center gap-x-xs gap-y-2xs">
            <dt className="text-2xs text-text-3" style={TERM}>
              Reviews at
            </dt>
            <dd className="flex flex-wrap items-center gap-2xs text-xs text-text-2">
              {depth.medianGrit !== null ? (
                <>
                  <GritChip value={depth.medianGrit} size="sm" showLabel />
                  <span className="text-text-3">
                    median of {plural(depth.reviews, 'review', 'reviews')}
                    {depth.range && depth.range.low !== depth.range.high ? (
                      <>
                        , across <span className="tnum">{depth.range.low}</span>–
                        <span className="tnum">{depth.range.high}</span>
                      </>
                    ) : null}
                  </span>
                </>
              ) : (
                <span className="text-text-3">No reviews on Whetstone yet.</span>
              )}
            </dd>
          </div>

          {depth.categories.length > 0 ? (
            <div className="flex flex-wrap items-baseline gap-x-xs gap-y-2xs">
              <dt className="text-2xs text-text-3" style={TERM}>
                Writes about
              </dt>
              <dd className="flex flex-wrap items-baseline gap-x-sm gap-y-2xs text-xs text-text-2">
                {depth.categories.map((category) => (
                  <span key={category.label}>
                    {category.label} <span className="tnum text-text-3">{category.count}</span>
                  </span>
                ))}
              </dd>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-x-xs gap-y-2xs">
            <dt className="text-2xs text-text-3" style={TERM}>
              Verified in
            </dt>
            <dd className="flex flex-wrap items-center gap-xs">
              {expert.expertise.filter((area) => area.isVerified).length > 0 ? (
                expert.expertise
                  .filter((area) => area.isVerified)
                  .map((area) => (
                    <Badge key={area.slug} tone="positive" icon={BadgeCheck}>
                      {area.label}
                    </Badge>
                  ))
              ) : (
                <span className="text-xs text-text-3">Nothing verified yet.</span>
              )}
            </dd>
          </div>

          <div className="flex flex-wrap items-center gap-x-xs gap-y-2xs">
            <dt className="text-2xs text-text-3" style={TERM}>
              Paid work
            </dt>
            <dd className="text-xs text-text-2">
              {expert.completedCount > 0 ? (
                <>
                  <span className="tnum">{expert.completedCount}</span> paid{' '}
                  {expert.completedCount === 1 ? 'review' : 'reviews'} accepted
                  {expert.avgRating > 0 ? (
                    <span className="text-text-3">
                      {' '}
                      · rated <span className="tnum">{expert.avgRating.toFixed(1)}</span> of 5 by the
                      creators who paid
                    </span>
                  ) : null}
                </>
              ) : (
                <span className="text-text-3">No paid review accepted here yet.</span>
              )}
            </dd>
          </div>
        </dl>

        {match ? <MatchWhy match={match} /> : null}
      </div>

      <div className="flex shrink-0 flex-col items-start gap-xs sm:w-6xl sm:items-end">
        {expert.minBountyCents !== null ? (
          <p className="inline-flex items-baseline gap-2xs rounded-xs bg-straw-fill px-xs py-2xs text-straw-ink">
            <span className="tnum text-lg" style={PRICE}>
              {money(expert.minBountyCents, expert.currency)}
            </span>
            <span className="text-2xs" style={TERM}>
              minimum
            </span>
          </p>
        ) : (
          <p className="text-xs text-text-3">No minimum published.</p>
        )}

        <dl className="flex flex-col gap-2xs sm:items-end">
          {expert.hourlyRateCents !== null ? (
            <div className="flex items-baseline gap-2xs text-xs text-text-2">
              <dt className="text-text-3">Hourly</dt>
              <dd className="tnum">{money(expert.hourlyRateCents, expert.currency)}</dd>
            </div>
          ) : null}
          {turnaround(expert.turnaroundHours) ? (
            <div className="flex items-center gap-2xs text-xs text-text-2">
              <dt className="flex items-center gap-2xs text-text-3">
                <Clock size={16} strokeWidth={1.5} aria-hidden="true" />
                <span>Turnaround</span>
              </dt>
              <dd className="tnum">{turnaround(expert.turnaroundHours)}</dd>
            </div>
          ) : null}
          <div className="flex items-center gap-2xs text-xs text-text-2">
            <dt className="flex items-center gap-2xs text-text-3">
              <Users size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Takes</span>
            </dt>
            <dd>
              <span className="tnum">{expert.capacityPerWeek}</span> a week
            </dd>
          </div>
        </dl>

        {expert.capacityPerWeek > 0 ? (
          <Button as="a" href={requestHref} variant="secondary">
            Request a review
          </Button>
        ) : (
          <Button
            disabled
            disabledReason="This reviewer has no open slots this week. Follow them to hear when one opens."
          >
            Request a review
          </Button>
        )}
      </div>
    </li>
  )
}

function MatchWhy({ match }: { match: MatchNote }) {
  return (
    <p className="measure-ui text-xs text-text-2">
      Matched on{' '}
      {match.areas.map((area, index) => (
        <span key={area.slug}>
          {index > 0 ? ', ' : null}
          <span className="text-text-1">{area.label}</span> ({area.level}
          {area.isVerified ? ', verified' : ', declared'})
        </span>
      ))}
      .{' '}
      {match.reviewsInType > 0 ? (
        <>
          <span className="tnum">{match.reviewsInType}</span>{' '}
          {match.reviewsInType === 1 ? 'review' : 'reviews'} already written on{' '}
          {inSentence(match.typeLabel)} projects
        </>
      ) : (
        <>No reviews on {inSentence(match.typeLabel)} projects here yet</>
      )}
      {match.helpful.of > 0 ? (
        <>
          , and <span className="tnum">{match.helpful.marked}</span> of{' '}
          <span className="tnum">{match.helpful.of}</span> reviews marked helpful by the creator
        </>
      ) : null}
      .
    </p>
  )
}

const TERM = { fontVariationSettings: '"wdth" 87, "wght" 600' } as const
const PRICE = { fontVariationSettings: '"wdth" 104, "wght" 620' } as const

export default ExpertRow
