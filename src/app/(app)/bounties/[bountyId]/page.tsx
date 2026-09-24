/**
 * One bounty, through its whole life.
 *
 * The page shows the work state and the money state separately and never lets
 * one stand for the other, and it prints the escrow ledger rather than
 * summarising it, so every amount on screen traces to a row. Nothing here
 * collects a payment detail of any kind.
 *
 * What a reader sees depends on who they are. Application pitches are visible
 * to the creator who has to choose between them, and to the reviewer who wrote
 * one; everyone else sees the count. A direct request names the reviewer it was
 * sent to, offers the application form to nobody else, and has no "reviewers
 * who match" list, because nobody else can take it. The Server Actions check
 * the session again before they write, so the shape of this page is a
 * convenience, not a permission.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { inSentence, now } from '@/lib/utils'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { feeFor, getBounty, getBountyFeeSchedule, listApplications } from '@/server/repos/bounties'
import {
  deliverableFeedbackFor,
  escrowHistory,
  listAwardsForBounty,
} from '@/server/queries/bounty-ops'
import {
  matchTargetById,
  rankReviewersForProject,
} from '@/server/queries/marketplace'
import { ApplyFormWrapper } from '@/components/marketplace/apply-form'
import {
  AcceptForm,
  AwardButton,
  CancelForm,
  DeliverForm,
  DisputeForm,
} from '@/components/marketplace/bounty-actions'
import { EscrowLedger } from '@/components/marketplace/escrow-ledger'
import {
  ESCROW_STATE,
  EscrowStateBadge,
  WORK_STATE,
  WorkStateBadge,
  settlementTerms,
} from '@/components/marketplace/bounty-state'
import { money, plural, turnaround } from '@/components/marketplace/format'
import {
  Avatar,
  Badge,
  Banner,
  GritChip,
  Link,
  Prose,
  Timestamp,
} from '@/components/ui'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ bountyId: string }>
}): Promise<Metadata> {
  const { bountyId } = await params
  const bounty = getBounty(bountyId)
  if (!bounty) notFound()
  return {
    title: `${bounty.title} · ${money(bounty.amountCents, bounty.currency)}`,
    description: bounty.briefMd.slice(0, 155),
    alternates: { canonical: `/bounties/${bounty.id}` },
  }
}

export default async function BountyPage({
  params,
}: {
  params: Promise<{ bountyId: string }>
}) {
  const { bountyId } = await params
  const claims = await currentClaimsLive()
  const viewerId = claims?.uid ?? null

  const bounty = getBounty(bountyId, viewerId)
  if (!bounty) notFound()

  const isOwner = viewerId !== null && viewerId === bounty.creator.id
  const isDirect = bounty.visibility === 'invite_only'
  const invitee = isDirect ? bounty.invitee : null
  const applications = listApplications(bounty.id)
  const awards = listAwardsForBounty(bounty.id)
  const award = awards[0] ?? null
  const isAwardee = viewerId !== null && award?.expertId === viewerId
  const ledger = escrowHistory(bounty.id)
  const myApplication = viewerId
    ? applications.find((a) => a.applicant.id === viewerId) ?? null
    : null

  // Only a review written since the award can be delivered against it, so the
  // lookup is scoped to the award rather than to the project.
  const deliverable =
    isAwardee && viewerId && award ? deliverableFeedbackFor(bounty.id, viewerId, award.createdAt) : null

  const target =
    isOwner && !isDirect && bounty.status === 'open' ? matchTargetById(bounty.project.id) : undefined
  const matches = target
    ? rankReviewersForProject(target, {
        limit: 3,
        excludeUserIds: applications.map((a) => a.applicant.id),
      })
    : []

  const workState = WORK_STATE[bounty.status]
  const escrow = ESCROW_STATE[bounty.escrowState]
  const fees = getBountyFeeSchedule()
  const renderedAt = now()

  return (
    <div
      className="pad-inline mx-auto flex w-full flex-col gap-xl py-xl"
      style={{ maxInlineSize: 'var(--container-detail)' }}
    >
      <header className="flex flex-col gap-md">
        <p className="flex flex-wrap items-center gap-x-xs gap-y-2xs text-sm text-text-3">
          <span>
            for{' '}
            <Link href={`/p/${bounty.project.slug}`} variant="inline">
              {bounty.project.title}
            </Link>
          </span>
          <span aria-hidden="true">·</span>
          <span>{bounty.project.typeLabel}</span>
        </p>

        <h1 className="text-2xl break-words">{bounty.title}</h1>

        <div className="flex flex-wrap items-center gap-md">
          <p className="inline-flex items-baseline gap-2xs rounded-sm bg-straw-fill px-sm py-xs text-straw-ink">
            <span className="tnum text-lg" style={PRICE}>
              {money(bounty.amountCents, bounty.currency)}
            </span>
          </p>
          <GritChip value={bounty.project.grit} size="md" showLabel />
          {bounty.expertise ? <Badge tone="neutral">{bounty.expertise.label}</Badge> : null}
        </div>

        {/* Two columns until the four facts fit on one line: left to wrap freely
            at tablet width, the work state sat alone on a row of its own. On
            one line the two states share what the short facts leave, and their
            sentences wrap inside their own columns; as a wrapping flex row the
            posting date dropped onto a second line by itself. */}
        <dl className="grid gap-sm border-y border-border-hair py-md sm:grid-cols-2 sm:gap-x-xl lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
          <div className="flex flex-col gap-2xs">
            <dt className="text-2xs text-text-3" style={TERM}>
              The work
            </dt>
            <dd className="flex flex-col items-start gap-2xs">
              <WorkStateBadge status={bounty.status} />
              <span className="measure-ui text-xs text-text-3">
                {isDirect && bounty.status === 'open' ? DIRECT_OPEN_DETAIL : workState.detail}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-2xs">
            <dt className="text-2xs text-text-3" style={TERM}>
              The money
            </dt>
            <dd className="flex flex-col items-start gap-2xs">
              <EscrowStateBadge state={bounty.escrowState} />
              <span className="measure-ui text-xs text-text-3">{escrow.detail}</span>
            </dd>
          </div>
          {turnaround(bounty.turnaroundHours) ? (
            <div className="flex flex-col gap-2xs">
              <dt className="text-2xs text-text-3" style={TERM}>
                Turnaround once awarded
              </dt>
              <dd className="tnum text-sm text-text-2">{turnaround(bounty.turnaroundHours)}</dd>
            </div>
          ) : null}
          <div className="flex flex-col gap-2xs">
            <dt className="text-2xs text-text-3" style={TERM}>
              Posted
            </dt>
            <dd className="text-sm text-text-2">
              <Timestamp ts={bounty.createdAt} />
            </dd>
          </div>
        </dl>

        <div className="flex items-center gap-xs text-sm text-text-3">
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
            ) : isDirect ? (
              ' as a direct request to one reviewer'
            ) : null}
          </span>
        </div>
      </header>

      <section aria-labelledby="brief" className="flex flex-col gap-sm">
        <h2 id="brief" className="text-md">
          The brief
        </h2>
        <Prose content={bounty.briefMd} allow="article" />
      </section>

      {award ? (
        <section aria-labelledby="award" className="flex flex-col gap-sm">
          <h2 id="award" className="text-md">
            Who holds this
          </h2>
          <dl className="flex flex-wrap gap-x-xl gap-y-sm border-t border-border-hair pt-md">
            <div className="flex flex-col gap-2xs">
              <dt className="text-2xs text-text-3" style={TERM}>
                Reviewer
              </dt>
              <dd className="text-sm text-text-2">
                <Link href={`/u/${award.expertHandle}`} variant="inline">
                  {award.expertName}
                </Link>
              </dd>
            </div>
            <div className="flex flex-col gap-2xs">
              <dt className="text-2xs text-text-3" style={TERM}>
                Reviewer receives
              </dt>
              <dd className="tnum text-sm text-text-1">
                {money(award.amountCents - award.feeCents, award.currency)}
              </dd>
            </div>
            <div className="flex flex-col gap-2xs">
              <dt className="text-2xs text-text-3" style={TERM}>
                Platform fee
              </dt>
              <dd className="tnum text-sm text-text-2">{money(award.feeCents, award.currency)}</dd>
            </div>
            <div className="flex flex-col gap-2xs">
              <dt className="text-2xs text-text-3" style={TERM}>
                Payout
              </dt>
              <dd className="text-sm text-text-2">{PAYOUT_WORDING[award.payoutState] ?? 'Pending'}</dd>
            </div>
            {award.feedbackId ? (
              <div className="flex flex-col gap-2xs">
                <dt className="text-2xs text-text-3" style={TERM}>
                  The delivered review
                </dt>
                <dd className="text-sm">
                  <Link href={`/p/${bounty.project.slug}`} variant="inline">
                    Read it on the project
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}

      {isOwner || isAwardee || bounty.viewerCanApply || myApplication ? (
        <section aria-labelledby="next" className="flex flex-col gap-md">
          <h2 id="next" className="text-md">
            What happens next
          </h2>

          {isOwner && bounty.status === 'open' ? (
            <p className="measure-ui text-sm text-text-2">
              {applications.length > 0
                ? isDirect
                  ? 'Award it below to take the request forward.'
                  : 'Award it to one of the applicants below.'
                : invitee
                  ? `${invitee.displayName} was notified and has not applied yet.`
                  : 'No applications yet.'}{' '}
              Until someone is awarded, cancelling returns the whole amount; after that the
              bounty runs to delivery.
            </p>
          ) : null}

          {isOwner && award && (award.status === 'assigned' || award.status === 'in_progress') ? (
            <p className="measure-ui text-sm text-text-2">
              {award.expertName} holds this and is working on it.
              {award.dueAt !== null ? (
                <>
                  {' '}
                  Delivery {award.dueAt < renderedAt ? 'was' : 'is'} due{' '}
                  <Timestamp ts={award.dueAt} />.
                </>
              ) : null}
            </p>
          ) : null}

          {isAwardee && award?.status === 'delivered' ? (
            <p className="measure-ui text-sm text-text-2">
              Delivered. {bounty.creator.displayName} can accept it, which releases{' '}
              <span className="tnum">{money(award.amountCents - award.feeCents, award.currency)}</span>{' '}
              to you, or open a dispute if the brief was not met.
            </p>
          ) : null}

          {award?.status === 'accepted' && (isOwner || isAwardee) ? (
            <p className="measure-ui text-sm text-text-2">
              Accepted.{' '}
              <span className="tnum">{money(award.amountCents - award.feeCents, award.currency)}</span>{' '}
              was released to {isAwardee ? 'you' : award.expertName}, and nothing further is owed.
              {award.creatorRating !== null ? (
                <>
                  {' '}
                  {isOwner ? 'You rated' : `${bounty.creator.displayName} rated`} the review{' '}
                  <span className="tnum">{award.creatorRating}</span> of 5.
                </>
              ) : null}
            </p>
          ) : null}

          {/* The note the creator wrote back on acceptance. It is addressed to
              the reviewer, so it is printed for them here as well as sent with
              the notification, and the creator can re-read what they sent. */}
          {award?.status === 'accepted' && award.creatorReview && (isOwner || isAwardee) ? (
            <figure className="measure-prose m-0 flex flex-col gap-2xs border-s-2 border-border-hair ps-md">
              <figcaption className="text-2xs text-text-3" style={TERM}>
                {isOwner ? `What you wrote back to ${award.expertName}` : `What ${bounty.creator.displayName} wrote back`}
              </figcaption>
              <blockquote className="m-0">
                <p className="prose-human whitespace-pre-line text-sm text-text-1">
                  {award.creatorReview}
                </p>
              </blockquote>
            </figure>
          ) : null}

          {isOwner && bounty.status === 'cancelled' ? (
            <p className="measure-ui text-sm text-text-2">
              Cancelled before anyone was awarded. The full{' '}
              <span className="tnum">{money(bounty.amountCents, bounty.currency)}</span> was returned
              to you.
            </p>
          ) : null}

          {isOwner && awards.length === 0 && bounty.status === 'open' ? (
            <CancelForm
              bountyId={bounty.id}
              amountCents={bounty.amountCents}
              currency={bounty.currency}
            />
          ) : null}

          {isAwardee && award && (award.status === 'assigned' || award.status === 'in_progress') ? (
            <DeliverForm
              awardId={award.id}
              deliverable={deliverable ? { headline: deliverable.headline } : null}
              composerHref={`/p/${bounty.project.slug}/feedback`}
              projectTitle={bounty.project.title}
            />
          ) : null}

          {isOwner && award && award.status === 'delivered' ? (
            <AcceptForm
              awardId={award.id}
              amountCents={award.amountCents}
              feeCents={award.feeCents}
              currency={award.currency}
              expertName={award.expertName}
            />
          ) : null}

          {award?.status === 'delivered' && (isOwner || isAwardee) ? (
            <DisputeForm awardId={award.id} />
          ) : null}

          {award?.status === 'disputed' ? (
            <Banner variant="warning" title="This award is in dispute">
              The escrow is frozen at its current amount. Nothing is paid out and nothing
              is refunded until the creator and the reviewer settle it.
            </Banner>
          ) : null}

          {!isOwner && (bounty.viewerCanApply || myApplication) ? (
            <ApplyFormWrapper
              bountyId={bounty.id}
              amountCents={bounty.amountCents}
              netCents={bounty.amountCents - feeFor(bounty.amountCents, fees.platformFeeBps)}
              feePercent={fees.platformFeePercent}
              currency={bounty.currency}
              turnaroundHours={bounty.turnaroundHours}
              alreadyApplied={myApplication !== null}
              applicationStatus={myApplication?.status ?? null}
              pitchMd={myApplication?.pitchMd ?? null}
              quotedCents={myApplication?.quotedCents ?? null}
              etaHours={myApplication?.etaHours ?? null}
            />
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="applications" className="flex flex-col gap-md">
        <h2 id="applications" className="text-md">
          {plural(bounty.applicationCount, 'application', 'applications')}
        </h2>

        {applications.length === 0 ? (
          <p className="measure-ui text-sm text-text-3">
            Nobody has applied yet.
          </p>
        ) : isOwner ? (
          <ul aria-label="Applications">
            {applications.map((application) => (
              <li
                key={application.id}
                className="flex flex-col gap-sm border-t border-border-hair py-md first:border-t-0 sm:flex-row sm:items-start sm:justify-between sm:gap-xl"
              >
                <div className="flex min-w-0 flex-1 flex-col gap-xs">
                  <div className="flex items-center gap-xs">
                    <Avatar
                      userId={application.applicant.id}
                      name={application.applicant.displayName}
                      src={application.applicant.avatarUrl}
                      size="sm"
                    />
                    <span className="text-sm text-text-1">
                      <Link href={`/u/${application.applicant.handle}`} variant="inline">
                        {application.applicant.displayName}
                      </Link>
                    </span>
                    <Badge tone={APPLICATION_TONE[application.status] ?? 'neutral'}>
                      {APPLICATION_WORDING[application.status] ?? application.status}
                    </Badge>
                  </div>
                  {application.pitchMd ? (
                    <Prose content={application.pitchMd} allow="comment" />
                  ) : null}
                  <dl className="flex flex-wrap items-baseline gap-x-md gap-y-2xs text-xs">
                    {application.quotedCents !== null ? (
                      <div className="flex items-baseline gap-2xs">
                        <dt className="text-text-3">Quote</dt>
                        <dd className="tnum text-text-2">
                          {money(application.quotedCents, bounty.currency)}
                        </dd>
                      </div>
                    ) : null}
                    {turnaround(application.etaHours) ? (
                      <div className="flex items-baseline gap-2xs">
                        <dt className="text-text-3">Needs</dt>
                        <dd className="tnum text-text-2">{turnaround(application.etaHours)}</dd>
                      </div>
                    ) : null}
                    <div className="flex items-baseline gap-2xs">
                      <dt className="text-text-3">Applied</dt>
                      <dd className="text-text-2">
                        <Timestamp ts={application.createdAt} />
                      </dd>
                    </div>
                  </dl>
                </div>

                {bounty.status === 'open' && bounty.seatsOpen > 0 && application.status !== 'withdrawn' ? (
                  <div className="shrink-0">
                    <AwardButton
                      bountyId={bounty.id}
                      applicationId={application.id}
                      applicantName={application.applicant.displayName}
                    />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : isDirect ? (
          <p className="measure-ui text-sm text-text-3">
            A direct request takes one application, from the reviewer it was sent to, and
            only the creator reads the pitch.
          </p>
        ) : (
          <p className="measure-ui text-sm text-text-3">
            Pitches are visible to the creator who has to choose between them.{' '}
            <span className="tnum">{bounty.applicationCount}</span>{' '}
            {bounty.applicationCount === 1 ? 'reviewer has' : 'reviewers have'} applied so
            far.
          </p>
        )}
      </section>

      {matches.length > 0 ? (
        <section aria-labelledby="matches" className="flex flex-col gap-sm">
          <h2 id="matches" className="text-md">
            Reviewers who match this project
          </h2>
          <p className="measure-ui text-sm text-text-2">
            Ranked on declared expertise this project type is about, credibility earned
            reviewing that type here, and how often a creator marked their reviews
            helpful. They have not applied.
          </p>
          <ul className="flex flex-col gap-xs">
            {matches.map((match) => (
              <li
                key={match.user.id}
                className="flex flex-wrap items-baseline justify-between gap-x-md gap-y-2xs border-t border-border-hair py-sm first:border-t-0"
              >
                <span className="text-sm text-text-2">
                  <Link href={`/experts/${match.user.handle}`} variant="inline">
                    {match.user.displayName}
                  </Link>{' '}
                  <span className="text-text-3">
                    {match.matchedAreas.map((area) => area.label).join(', ')}
                  </span>
                </span>
                <span className="text-xs text-text-3">
                  {match.reviewsInType > 0 ? (
                    <>
                      <span className="tnum">{match.reviewsInType}</span>{' '}
                      {match.reviewsInType === 1 ? 'review' : 'reviews'} on{' '}
                      {target ? inSentence(target.typeLabel) : null}
                    </>
                  ) : (
                    'No reviews of this type here yet'
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="ledger" className="flex flex-col gap-md">
        <div className="flex flex-col gap-xs">
          <h2 id="ledger" className="text-md">
            The escrow ledger
          </h2>
          <p className="measure-ui text-sm text-text-2">
            Every movement of the amount, oldest first.{' '}
            {settlementTerms(fees.platformFeePercent)}
          </p>
        </div>
        <EscrowLedger entries={ledger} currency={bounty.currency} />
      </section>
    </div>
  )
}

/** The open state's detail, for a bounty only one reviewer can apply to. */
const DIRECT_OPEN_DETAIL = 'Sent to one reviewer, who can apply. The creator then awards it.'

const PAYOUT_WORDING: Record<string, string> = {
  pending: 'Not scheduled. Acceptance is what schedules it.',
  scheduled: 'Scheduled after acceptance.',
  paid: 'Paid out. The release is in the ledger below.',
  refunded: 'Returned to the creator.',
  failed: 'The payout attempt failed.',
}

const APPLICATION_WORDING: Record<string, string> = {
  pending: 'Waiting on the creator',
  shortlisted: 'Shortlisted',
  accepted: 'Awarded',
  declined: 'Not chosen',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
}

const APPLICATION_TONE: Record<string, 'neutral' | 'accent' | 'positive'> = {
  pending: 'neutral',
  shortlisted: 'accent',
  accepted: 'positive',
  declined: 'neutral',
  withdrawn: 'neutral',
  expired: 'neutral',
}

const TERM = { fontVariationSettings: '"wdth" 87, "wght" 600' } as const
const PRICE = { fontVariationSettings: '"wdth" 104, "wght" 620' } as const
