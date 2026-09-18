'use server'

/**
 * The bounty lifecycle, one Server Action per state transition.
 *
 * Two state machines run side by side and neither is allowed to imply the
 * other: `bounties.status` is the work, `bounties.escrow_state` is the money.
 * Funded work can be cancelled and delivered work can be unpaid, so every
 * action below advances exactly the machine it is about and writes an escrow
 * ledger row whenever money moves.
 *
 * Nothing here collects a card, an account number or a billing address. Each
 * escrow row is written by the action that causes it, filed under the bounty's
 * one escrow reference, and worded like every other row in the ledger, so a
 * bounty posted today reads exactly like one that closed last month. Amounts,
 * states and history come from the same rows the repositories read.
 *
 * Authorisation is checked in every action, against the session rather than
 * against anything the form carried.
 */

import { actionRefusal } from './limits'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
// Every write below authorises from `claims.uid`, so the claims must come from
// a session that is still live. A signature proves the cookie is authentic and
// nothing more: a JWT stays valid until it expires, so a cookie revoked by a
// sign-out or a password reset would otherwise keep authorising writes for up
// to thirty days. `currentClaimsLive()` puts the revocation check in front.
import { currentClaimsLive } from '@/server/queries/auth'
import { getViewer } from '@/server/repos/users'
import {
  acceptDelivery,
  applyToBounty,
  awardBounty,
  createBounty,
  deliverBounty,
  feeFor,
  getBounty,
  listApplications,
  openBounty,
  recordEscrowEvent,
  DEFAULT_PLATFORM_FEE_BPS,
} from '@/server/repos/bounties'
import {
  bountyOwnerId,
  cancelBounty,
  closeBounty,
  deliverableFeedbackFor,
  getAward,
  listAwardsForBounty,
  markAwardDisputed,
  markAwardPaid,
  escrowRefFor,
} from '@/server/queries/bounty-ops'
import { ownedProjectOptions } from '@/server/queries/marketplace'
import { getExpertByHandle, getExpertProfileRow } from '@/server/repos/profiles'
import { notify } from '@/server/repos/notifications'
import { money } from '@/components/marketplace/format'
import type { FormState } from '@/components/ui/form'

/* ------------------------------------------------------------------ shared -- */

const NOT_SIGNED_IN =
  'This action writes against your account, and no session was found. Sign in, then post the form again.'

const NOT_YOURS =
  'Only the creator who posted this bounty can do that. Ask them to act on it, or open your own bounty.'

function fail(message: string, fieldErrors?: Record<string, string>): FormState {
  return { status: 'error', message, ...(fieldErrors ? { fieldErrors } : {}) }
}

function issuesToFieldErrors(issues: readonly z.ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form')
    out[key] ??= issue.message
  }
  return out
}

async function requireViewer(): Promise<{ id: string; handle: string } | null> {
  const claims = await currentClaimsLive()
  const viewer = getViewer(claims?.uid ?? null)
  return viewer ? { id: viewer.id, handle: viewer.handle } : null
}

function refresh(bountyId: string): void {
  revalidatePath('/bounties')
  revalidatePath(`/bounties/${bountyId}`)
  revalidatePath('/experts')
}

/* -------------------------------------------------------------- post a bounty -- */

const MIN_AMOUNT_CENTS = 5_000
const MAX_AMOUNT_CENTS = 500_000

const PostSchema = z.object({
  projectId: z.string().min(1, 'Pick which project the review is for.'),
  title: z
    .string()
    .trim()
    .min(12, 'Name the work in at least 12 characters, so a reviewer can tell from the list what they are taking on.')
    .max(120, 'Keep the title under 120 characters. The brief below is where the detail goes.'),
  brief: z
    .string()
    .trim()
    .min(80, 'Write at least 80 characters. A brief that does not say what to look at gets applications that do not either.')
    .max(4_000, 'Keep the brief under 4000 characters.'),
  amountDollars: z.coerce
    .number()
    .int('Enter a whole number of dollars.')
    .min(MIN_AMOUNT_CENTS / 100, `The floor is ${money(MIN_AMOUNT_CENTS)}, which is roughly an hour of a reviewer’s time.`)
    .max(MAX_AMOUNT_CENTS / 100, `Bounties go up to ${money(MAX_AMOUNT_CENTS)}. For larger work, split it into stages.`),
  turnaroundHours: z.coerce
    .number()
    .int('Enter a whole number of hours.')
    .min(12, 'Give a reviewer at least 12 hours. Anything shorter reads as a rush nobody takes.')
    .max(720, 'Cap the turnaround at 720 hours, which is 30 days.'),
  expertiseId: z.string().optional(),
  /** Set when the creator came from a reviewer's rate card. */
  expertHandle: z.string().optional(),
})

export async function postBounty(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer()
  if (!viewer) return fail(NOT_SIGNED_IN)
  const held = actionRefusal('bounty', viewer.id)
  if (held) return fail(held)

  const parsed = PostSchema.safeParse({
    projectId: formData.get('projectId'),
    title: formData.get('title'),
    brief: formData.get('brief'),
    amountDollars: formData.get('amountDollars'),
    turnaroundHours: formData.get('turnaroundHours'),
    expertiseId: formData.get('expertiseId') ?? undefined,
    expertHandle: formData.get('expertHandle') ?? undefined,
  })
  if (!parsed.success) {
    return fail('This bounty was not posted.', issuesToFieldErrors(parsed.error.issues))
  }

  const owned = ownedProjectOptions(viewer.id)
  if (!owned.some((p) => p.id === parsed.data.projectId)) {
    return fail('This bounty was not posted.', {
      projectId: 'You can only post a bounty against a project you published. Pick one of yours.',
    })
  }

  const amountCents = parsed.data.amountDollars * 100
  const expertiseId = parsed.data.expertiseId && parsed.data.expertiseId.length > 0 ? parsed.data.expertiseId : null

  // A request aimed at one reviewer is an invite-only bounty. It still runs the
  // same escrow and the same acceptance, so the money stays auditable and the
  // reviewer still has to accept the work rather than being assigned it. The
  // invitee is stored on the bounty, which is what keeps it out of everyone
  // else's lists and refuses anyone else's application.
  const invitedHandle = parsed.data.expertHandle?.length ? parsed.data.expertHandle : null
  const invited = invitedHandle ? getExpertByHandle(invitedHandle) : undefined
  if (invitedHandle && (invited === undefined || getExpertProfileRow(invited.user.id)?.is_listed !== 1)) {
    return fail(
      'That reviewer is no longer listed, so a direct request cannot reach them. Posting the bounty openly reaches everyone who works in the area.',
    )
  }
  if (invited && invited.user.id === viewer.id) {
    return fail('A direct request cannot go to your own rate card. Post the bounty openly to reach the other reviewers.')
  }

  const bountyId = createBounty({
    projectId: parsed.data.projectId,
    createdBy: viewer.id,
    title: parsed.data.title,
    briefMd: parsed.data.brief,
    amountCents,
    expertiseId,
    turnaroundHours: parsed.data.turnaroundHours,
    seats: 1,
    invitedUserId: invited?.user.id ?? null,
  })

  // Money is placed before the work is advertised, which is what the schema's
  // "never advertise unfunded work" check is for. The event wording already
  // says what each of these two rows is, so neither carries a note.
  const ref = escrowRefFor(bountyId)
  recordEscrowEvent({
    bountyId,
    eventKind: 'authorize',
    toState: 'authorized',
    amountCents,
    providerRef: ref,
    actorId: viewer.id,
    idempotencyKey: `${bountyId}:authorize`,
  })
  recordEscrowEvent({
    bountyId,
    eventKind: 'hold',
    toState: 'held',
    amountCents,
    providerRef: ref,
    actorId: viewer.id,
    idempotencyKey: `${bountyId}:hold`,
  })
  openBounty(bountyId)

  if (invited) {
    notify({
      userId: invited.user.id,
      actorId: viewer.id,
      kind: 'system',
      subjectType: 'bounty',
      subjectId: bountyId,
      title: `A paid review was requested from you: ${parsed.data.title}`,
      url: `/bounties/${bountyId}`,
    })
  }

  refresh(bountyId)
  redirect(`/bounties/${bountyId}`)
}

/* ------------------------------------------------------------------- apply -- */

const ApplySchema = z.object({
  bountyId: z.string().min(1),
  pitch: z
    .string()
    .trim()
    .min(60, 'Write at least 60 characters. Say what you would look at first and what you have reviewed like it before.')
    .max(2_000, 'Keep the pitch under 2000 characters.'),
  quotedDollars: z.coerce
    .number()
    .int('Enter a whole number of dollars.')
    .min(1, 'Quote at least one dollar.')
    .max(MAX_AMOUNT_CENTS / 100, `Quotes go up to ${money(MAX_AMOUNT_CENTS)}, the most a bounty can carry.`),
  etaHours: z.coerce
    .number()
    .int('Enter a whole number of hours.')
    .min(1, 'Give yourself at least an hour.')
    .max(720, 'Cap it at 720 hours, which is 30 days.'),
})

export async function applyForBounty(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer()
  if (!viewer) return fail(NOT_SIGNED_IN)
  const held = actionRefusal('bountyApply', viewer.id)
  if (held) return fail(held)

  const parsed = ApplySchema.safeParse({
    bountyId: formData.get('bountyId'),
    pitch: formData.get('pitch'),
    quotedDollars: formData.get('quotedDollars'),
    etaHours: formData.get('etaHours'),
  })
  if (!parsed.success) {
    return fail('This application was not sent.', issuesToFieldErrors(parsed.error.issues))
  }

  const bounty = getBounty(parsed.data.bountyId, viewer.id)
  if (!bounty) {
    return fail('That bounty is no longer listed, so the application had nowhere to go. Open the bounty list to see what is still open.')
  }
  if (bounty.creator.id === viewer.id) {
    return fail('You posted this bounty, so you cannot also apply to it. Award it to one of the reviewers who did.')
  }
  if (bounty.visibility === 'invite_only' && bounty.invitee?.id !== viewer.id) {
    return fail(
      bounty.invitee
        ? `This is a direct request to ${bounty.invitee.displayName}, so only they can apply to it. The open bounties are on the bounty list.`
        : 'This was a direct request to one reviewer, so it takes no other applications. The open bounties are on the bounty list.',
    )
  }
  if (bounty.status !== 'open' || bounty.seatsOpen < 1) {
    return fail('This bounty is no longer open, so applications are closed. The bounty list shows what still needs a reviewer.')
  }

  applyToBounty({
    bountyId: bounty.id,
    applicantId: viewer.id,
    pitchMd: parsed.data.pitch,
    quotedCents: parsed.data.quotedDollars * 100,
    etaHours: parsed.data.etaHours,
  })

  refresh(bounty.id)
  return { status: 'success', message: 'Application sent. The creator sees it on the bounty page.' }
}

/* ------------------------------------------------------------------- award -- */

const AwardSchema = z.object({
  bountyId: z.string().min(1),
  applicationId: z.string().min(1),
})

export async function awardApplication(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer()
  if (!viewer) return fail(NOT_SIGNED_IN)

  const parsed = AwardSchema.safeParse({
    bountyId: formData.get('bountyId'),
    applicationId: formData.get('applicationId'),
  })
  if (!parsed.success) return fail('This award was not recorded.', issuesToFieldErrors(parsed.error.issues))

  const bounty = getBounty(parsed.data.bountyId, viewer.id)
  if (!bounty) return fail('That bounty is no longer listed, so nothing was awarded.')
  if (bounty.creator.id !== viewer.id) return fail(NOT_YOURS)
  if (bounty.status !== 'open' || bounty.seatsOpen < 1) {
    return fail('This bounty has already been awarded, so it cannot be awarded again. Its page shows who holds it.')
  }
  if (!bounty.isFunded) {
    return fail('The escrow for this bounty is not held, and work is never awarded against money that is not there. Fund it first.')
  }

  const application = listApplications(bounty.id).find((a) => a.id === parsed.data.applicationId)
  if (!application) return fail('That application is no longer on this bounty, so it could not be awarded.')
  if (application.status === 'withdrawn') {
    return fail('That reviewer withdrew their application, so it cannot be awarded. Pick another applicant.')
  }

  awardBounty({
    bountyId: bounty.id,
    expertId: application.applicant.id,
    applicationId: application.id,
    actorId: viewer.id,
  })

  refresh(bounty.id)
  return { status: 'success', message: `Awarded to ${application.applicant.displayName}.` }
}

/* ----------------------------------------------------------------- deliver -- */

const AwardOnlySchema = z.object({ awardId: z.string().min(1) })

export async function deliverAward(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer()
  if (!viewer) return fail(NOT_SIGNED_IN)

  const parsed = AwardOnlySchema.safeParse({ awardId: formData.get('awardId') })
  if (!parsed.success) return fail('This delivery was not recorded.')

  const award = getAward(parsed.data.awardId)
  if (!award) return fail('That award no longer exists, so there was nothing to deliver against.')
  if (award.expertId !== viewer.id) {
    return fail('Only the reviewer holding this award can mark it delivered.')
  }
  if (award.status !== 'assigned' && award.status !== 'in_progress') {
    return fail('This award is already past delivery, so it cannot be delivered again. The bounty page shows where it stands.')
  }

  const feedback = deliverableFeedbackFor(award.bountyId, viewer.id)
  if (!feedback) {
    return fail(
      'Delivery links the review, and no submitted review of yours was found on this project. Post the review first, then deliver.',
    )
  }

  deliverBounty(award.id, feedback.id)
  refresh(award.bountyId)
  return { status: 'success', message: 'Delivered. The creator can read the review and accept it.' }
}

/* ------------------------------------------------------------------ accept -- */

const AcceptSchema = z.object({
  awardId: z.string().min(1),
  rating: z.coerce
    .number()
    .int('Pick a rating from 1 to 5, or leave it at no rating.')
    .min(1, 'Pick a rating from 1 to 5, or leave it at no rating.')
    .max(5, 'Pick a rating from 1 to 5, or leave it at no rating.')
    .optional(),
  review: z.string().trim().max(1_000, 'Keep the note under 1000 characters.').optional(),
})

export async function acceptAward(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer()
  if (!viewer) return fail(NOT_SIGNED_IN)

  const ratingRaw = formData.get('rating')
  const parsed = AcceptSchema.safeParse({
    awardId: formData.get('awardId'),
    rating: ratingRaw && String(ratingRaw).length > 0 ? ratingRaw : undefined,
    review: formData.get('review') ?? undefined,
  })
  if (!parsed.success) return fail('This acceptance was not recorded.', issuesToFieldErrors(parsed.error.issues))

  const award = getAward(parsed.data.awardId)
  if (!award) return fail('That award no longer exists, so there was nothing to accept.')
  if (bountyOwnerId(award.bountyId) !== viewer.id) return fail(NOT_YOURS)
  if (award.status !== 'delivered') {
    return fail('Only a delivered award can be accepted, and this one has not been delivered yet. The reviewer marks it delivered once the review is posted.')
  }

  acceptDelivery({
    awardId: award.id,
    actorId: viewer.id,
    rating: parsed.data.rating ?? null,
    review: parsed.data.review && parsed.data.review.length > 0 ? parsed.data.review : null,
  })

  // Acceptance is what releases the money, and the ledger records both halves.
  const fee = award.feeCents > 0 ? award.feeCents : feeFor(award.amountCents, DEFAULT_PLATFORM_FEE_BPS)
  const net = award.amountCents - fee
  const ref = escrowRefFor(award.bountyId)
  recordEscrowEvent({
    bountyId: award.bountyId,
    eventKind: 'release',
    toState: 'released',
    amountCents: net,
    awardId: award.id,
    providerRef: ref,
    actorId: viewer.id,
    idempotencyKey: `${award.id}:release`,
    note: 'Released to the reviewer after acceptance.',
  })
  recordEscrowEvent({
    bountyId: award.bountyId,
    eventKind: 'fee',
    toState: 'released',
    amountCents: fee,
    awardId: award.id,
    providerRef: ref,
    actorId: viewer.id,
    idempotencyKey: `${award.id}:fee`,
    note: `${String(Math.round((fee * 100) / award.amountCents))} per cent of the ${money(award.amountCents, award.currency)} bounty.`,
  })
  markAwardPaid(award.id)
  closeBounty(award.bountyId)

  refresh(award.bountyId)
  return {
    status: 'success',
    message: `Accepted. ${money(net, award.currency)} is released to ${award.expertName}.`,
  }
}

/* ----------------------------------------------------------------- dispute -- */

const DisputeSchema = z.object({
  awardId: z.string().min(1),
  reason: z
    .string()
    .trim()
    .min(40, 'Say what is wrong in at least 40 characters. A dispute with no reason cannot be resolved by anyone.')
    .max(1_000, 'Keep the reason under 1000 characters.'),
})

export async function disputeAward(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer()
  if (!viewer) return fail(NOT_SIGNED_IN)

  const parsed = DisputeSchema.safeParse({
    awardId: formData.get('awardId'),
    reason: formData.get('reason'),
  })
  if (!parsed.success) return fail('This dispute was not opened.', issuesToFieldErrors(parsed.error.issues))

  const award = getAward(parsed.data.awardId)
  if (!award) return fail('That award no longer exists, so there was nothing to dispute.')

  const ownerId = bountyOwnerId(award.bountyId)
  const isParty = award.expertId === viewer.id || ownerId === viewer.id
  if (!isParty) {
    return fail('Only the creator or the reviewer on this award can open a dispute about it.')
  }
  // Acceptance releases the escrow in the same action, so an accepted award has
  // nothing left to freeze. A dispute is the step between delivery and that.
  if (award.status === 'accepted') {
    return fail('This review was accepted and the amount released, so there is nothing left in escrow to hold back.')
  }
  if (award.status !== 'delivered') {
    return fail('A dispute is about delivered work, and this award has not been delivered. There is nothing yet to disagree about.')
  }

  recordEscrowEvent({
    bountyId: award.bountyId,
    eventKind: 'dispute_open',
    toState: 'disputed',
    amountCents: award.amountCents,
    awardId: award.id,
    providerRef: escrowRefFor(award.bountyId),
    actorId: viewer.id,
    idempotencyKey: `${award.id}:dispute`,
    note: parsed.data.reason,
  })
  markAwardDisputed(award.id)

  refresh(award.bountyId)
  return {
    status: 'success',
    message: 'Dispute opened. The escrow is frozen at its current amount until it is resolved.',
  }
}

/* ------------------------------------------------------------------ cancel -- */

const CancelSchema = z.object({ bountyId: z.string().min(1) })

export async function cancelBountyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const viewer = await requireViewer()
  if (!viewer) return fail(NOT_SIGNED_IN)

  const parsed = CancelSchema.safeParse({ bountyId: formData.get('bountyId') })
  if (!parsed.success) return fail('This bounty was not cancelled.')

  const bounty = getBounty(parsed.data.bountyId, viewer.id)
  if (!bounty) return fail('That bounty is no longer listed, so there was nothing to cancel.')
  if (bounty.creator.id !== viewer.id) return fail(NOT_YOURS)
  if (listAwardsForBounty(bounty.id).length > 0) {
    return fail('This bounty is already awarded, so cancelling it would take work back from a reviewer. Accept the delivery or open a dispute instead.')
  }

  // The work is withdrawn before the money is, because the schema refuses an
  // open bounty whose escrow is no longer held.
  if (!cancelBounty(bounty.id)) {
    return fail('This bounty could not be cancelled from the state it is in. Reload the page to see where it stands.')
  }
  recordEscrowEvent({
    bountyId: bounty.id,
    eventKind: 'refund',
    toState: 'refunded',
    amountCents: bounty.amountCents,
    providerRef: escrowRefFor(bounty.id),
    actorId: viewer.id,
    idempotencyKey: `${bounty.id}:refund`,
    note: 'Returned to the creator after cancellation.',
  })

  refresh(bounty.id)
  return {
    status: 'success',
    message: `Cancelled. The full ${money(bounty.amountCents, bounty.currency)} is returned to you.`,
  }
}
