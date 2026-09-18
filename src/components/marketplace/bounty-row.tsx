/**
 * One bounty, as a register row with a price column.
 *
 * The amount is the straw fill this surface is allowed (§2.4.10), so the money
 * is the one warm object in the row and a creator can scan a column of them.
 * Work state and money state are separate chips, because they genuinely are
 * separate facts.
 *
 * The row is a two-column grid at every width rather than a flex row that
 * reflows: stacked, the amount ended up under the poster's name, which is the
 * last place a creator reads for it. In the grid the amount sits beside the
 * title on a phone and above the fold, and the reading order still runs title,
 * amount, then the detail.
 *
 * A direct request is only ever listed to the creator who sent it and the
 * reviewer it went to, so its byline says so in terms of the reader: "to you"
 * for the reviewer, their name for the creator.
 *
 * Keyboard contract: the title link first, then the project and the people
 * named in the byline. The row is not clickable as a whole, so nothing here can
 * swallow a text selection.
 */

import { Clock, Users } from 'lucide-react'
import { Avatar, GritChip, Link } from '@/components/ui'
import { EscrowStateBadge, WorkStateBadge } from '@/components/marketplace/bounty-state'
import { money, plural, turnaround } from '@/components/marketplace/format'
import type { BountyView } from '@/lib/types'

export function BountyRow({ bounty, viewerId }: { bounty: BountyView; viewerId: string | null }) {
  const invitee = bounty.visibility === 'invite_only' ? bounty.invitee : null
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-md gap-y-xs border-t border-border-hair py-lg first:border-t-0 sm:gap-x-xl">
      <h3 className="text-md break-words">
        <Link
          href={`/bounties/${bounty.id}`}
          variant="inline"
          className="tap-44 inline-block break-words text-text-1 no-underline hover:underline"
        >
          {bounty.title}
        </Link>
      </h3>

      <div className="flex flex-col items-end gap-2xs">
        <p className="inline-flex items-baseline gap-2xs rounded-xs bg-straw-fill px-xs py-2xs text-straw-ink">
          <span className="tnum text-lg" style={PRICE}>
            {money(bounty.amountCents, bounty.currency)}
          </span>
        </p>
        {/* Seats are only a live question while applications are open: a
            cancelled bounty has an unfilled seat nobody can take. */}
        {bounty.status === 'open' ? (
          <p className="text-xs text-text-3">
            {bounty.seatsOpen > 0
              ? `${plural(bounty.seatsOpen, 'seat', 'seats')} open`
              : 'No seats open'}
          </p>
        ) : null}
      </div>

      <div className="col-span-2 flex min-w-0 flex-col gap-xs sm:col-span-1">
        <p className="flex flex-wrap items-center gap-x-xs gap-y-2xs text-xs text-text-3">
          <span>
            for{' '}
            <Link href={`/p/${bounty.project.slug}`} variant="inline">
              {bounty.project.title}
            </Link>
          </span>
          <span aria-hidden="true">·</span>
          <span>{bounty.project.typeLabel}</span>
        </p>

        <dl className="flex flex-wrap items-center gap-x-md gap-y-2xs">
          <div className="flex items-center gap-2xs">
            <dt className="sr-only">Project grit</dt>
            <dd>
              <GritChip value={bounty.project.grit} size="sm" showLabel />
            </dd>
          </div>
          {bounty.expertise ? (
            <div className="flex items-baseline gap-2xs text-xs">
              <dt className="text-text-3" style={TERM}>
                Area
              </dt>
              <dd className="text-text-2">{bounty.expertise.label}</dd>
            </div>
          ) : null}
          <div className="flex items-center gap-2xs text-xs">
            <dt className="flex items-center gap-2xs text-text-3">
              <Users size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Applications</span>
            </dt>
            <dd className="tnum text-text-2">{bounty.applicationCount}</dd>
          </div>
          {turnaround(bounty.turnaroundHours) ? (
            <div className="flex items-center gap-2xs text-xs">
              <dt className="flex items-center gap-2xs text-text-3">
                <Clock size={16} strokeWidth={1.5} aria-hidden="true" />
                <span>Turnaround</span>
              </dt>
              <dd className="tnum text-text-2">{turnaround(bounty.turnaroundHours)}</dd>
            </div>
          ) : null}
        </dl>

        <div className="flex flex-wrap items-center gap-xs">
          <WorkStateBadge status={bounty.status} />
          <EscrowStateBadge state={bounty.escrowState} />
        </div>

        <div className="flex items-center gap-2xs text-xs text-text-3">
          <Avatar
            userId={bounty.creator.id}
            name={bounty.creator.displayName}
            src={bounty.creator.avatarUrl}
            size="sm"
          />
          <span>
            Posted by{' '}
            <Link href={`/u/${bounty.creator.handle}`} variant="inline">
              {bounty.creator.displayName}
            </Link>
            {invitee ? (
              <>
                {' '}
                as a direct request to{' '}
                {invitee.id === viewerId ? (
                  'you'
                ) : (
                  <Link href={`/u/${invitee.handle}`} variant="inline">
                    {invitee.displayName}
                  </Link>
                )}
              </>
            ) : bounty.visibility === 'invite_only' ? (
              ' as a direct request to one reviewer'
            ) : null}
          </span>
        </div>
      </div>
    </li>
  )
}

const TERM = { fontVariationSettings: '"wdth" 87, "wght" 600' } as const
const PRICE = { fontVariationSettings: '"wdth" 104, "wght" 620' } as const

export default BountyRow
