/**
 * The two state machines a bounty runs, in words.
 *
 * `status` is the work and `escrowState` is the money, and the product never
 * lets one stand for the other: funded work can be cancelled and delivered work
 * can be unpaid. Both chips carry a label as well as a hue, so the pair reads
 * in greyscale (§2.4.8).
 *
 * The money is described one way on every bounty surface, by `settlementTerms`
 * below: committed when the bounty is posted, paid out only after the creator
 * accepts the delivered review, released to the reviewer less the platform fee,
 * and returned in full by a cancellation before anyone is awarded. A detail
 * anywhere that contradicts it is a defect, because a reader cannot tell which
 * of the two is true.
 */

import { Badge, type BadgeTone } from '@/components/ui'
import type { BountyStatus, EscrowState } from '@/lib/types'

export const WORK_STATE: Record<BountyStatus, { label: string; tone: BadgeTone; detail: string }> = {
  draft: {
    label: 'Draft',
    tone: 'neutral',
    detail: 'Written but not advertised. Nobody can apply yet.',
  },
  open: {
    label: 'Open for applications',
    tone: 'accent',
    detail: 'Reviewers can apply. The creator picks one.',
  },
  in_progress: {
    label: 'Awarded',
    tone: 'accent',
    detail: 'A reviewer holds this and is working on it.',
  },
  delivered: {
    label: 'Delivered',
    tone: 'positive',
    detail: 'The review is posted and linked. The creator can accept it.',
  },
  closed: {
    label: 'Closed',
    tone: 'positive',
    detail: 'Accepted and settled. Nothing further is owed.',
  },
  cancelled: {
    label: 'Cancelled',
    tone: 'neutral',
    detail: 'Withdrawn by the creator before anyone was awarded.',
  },
}

export const ESCROW_STATE: Record<EscrowState, { label: string; tone: BadgeTone; detail: string }> = {
  unfunded: {
    label: 'Not funded',
    tone: 'warn',
    detail: 'No amount is committed. Work is never advertised from here.',
  },
  authorized: {
    label: 'Committed',
    tone: 'accent',
    detail: 'The amount is committed and not yet moved into escrow.',
  },
  held: {
    label: 'Held',
    tone: 'accent',
    detail: 'The amount is set aside. It moves only when the creator accepts the review.',
  },
  released: {
    label: 'Released',
    tone: 'positive',
    detail: 'The amount, less the platform fee, went to the reviewer after acceptance.',
  },
  refunded: {
    label: 'Refunded',
    tone: 'neutral',
    detail: 'The amount went back to the creator. Nothing was paid out.',
  },
  disputed: {
    label: 'Disputed',
    tone: 'critical',
    detail: 'Frozen at its current amount while the disagreement is worked out.',
  },
}

export function WorkStateBadge({ status }: { status: BountyStatus }) {
  const state = WORK_STATE[status]
  return <Badge tone={state.tone}>{state.label}</Badge>
}

export function EscrowStateBadge({ state }: { state: EscrowState }) {
  const wording = ESCROW_STATE[state]
  return <Badge tone={wording.tone}>Escrow: {wording.label.toLowerCase()}</Badge>
}

/**
 * The terms, stated once per surface and in these words everywhere: the bounty
 * list, the form that posts one and the ledger on every bounty. The fee is
 * passed in from the fee schedule rather than written here, so the sentence
 * cannot disagree with the arithmetic beside it.
 */
export function settlementTerms(feePercent: number): string {
  return `The amount is committed when the bounty is posted, and nothing is paid out until the delivered review is accepted. Acceptance releases it to the reviewer, less the ${String(feePercent)}% platform fee, and a cancellation before anyone is awarded returns all of it.`
}
