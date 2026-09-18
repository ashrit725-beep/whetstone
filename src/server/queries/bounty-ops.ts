/**
 * The parts of the bounty lifecycle `repos/bounties.ts` does not expose: award
 * lookups, the two award transitions after acceptance, and the escrow ledger in
 * a shape the detail page can render.
 *
 * Nothing in this file talks to a payment provider or collects a card. The
 * escrow rows are written by the Server Actions as each transition happens,
 * and every one of them is filed under the bounty's own escrow reference.
 */

import { all, get, run } from '@/server/db/client'
import { now, uid } from '@/lib/utils'
import { num, str, strOrNull, type Row } from '@/server/repos/_shared'
import type { EscrowState, Millis } from '@/lib/types'

/**
 * The reference a bounty's escrow is filed under. It is opened with the first
 * commitment and reused by every later movement, so the ledger reads as one
 * account and a single id is enough to ask about any row in it.
 */
export function escrowRefFor(bountyId: string): string {
  const row = get<Row>(`SELECT escrow_ref FROM bounties WHERE id = ?`, [bountyId])
  return strOrNull(row, 'escrow_ref') ?? `esc_${uid().replaceAll('-', '').slice(0, 10)}`
}

export interface AwardRow {
  readonly id: string
  readonly bountyId: string
  readonly expertId: string
  readonly expertHandle: string
  readonly expertName: string
  readonly feedbackId: string | null
  readonly amountCents: number
  readonly feeCents: number
  readonly currency: string
  readonly status: string
  readonly payoutState: string
  readonly creatorRating: number | null
  readonly dueAt: Millis | null
  readonly deliveredAt: Millis | null
  readonly acceptedAt: Millis | null
  readonly paidAt: Millis | null
  readonly createdAt: Millis
}

export function listAwardsForBounty(bountyId: string): readonly AwardRow[] {
  return all<Row>(
    `SELECT ba.*, u.handle AS expert_handle, COALESCE(pr.display_name, u.handle) AS expert_name
       FROM bounty_awards ba
       JOIN users u ON u.id = ba.expert_id
       LEFT JOIN profiles pr ON pr.user_id = u.id
      WHERE ba.bounty_id = ?
      ORDER BY ba.created_at`,
    [bountyId],
  ).map(mapAward)
}

export function getAward(awardId: string): AwardRow | undefined {
  const row = get<Row>(
    `SELECT ba.*, u.handle AS expert_handle, COALESCE(pr.display_name, u.handle) AS expert_name
       FROM bounty_awards ba
       JOIN users u ON u.id = ba.expert_id
       LEFT JOIN profiles pr ON pr.user_id = u.id
      WHERE ba.id = ?`,
    [awardId],
  )
  return row ? mapAward(row) : undefined
}

function mapAward(r: Row): AwardRow {
  return {
    id: str(r, 'id'),
    bountyId: str(r, 'bounty_id'),
    expertId: str(r, 'expert_id'),
    expertHandle: str(r, 'expert_handle'),
    expertName: str(r, 'expert_name'),
    feedbackId: r['feedback_id'] === null ? null : str(r, 'feedback_id'),
    amountCents: num(r, 'amount_cents'),
    feeCents: num(r, 'fee_cents'),
    currency: str(r, 'currency', 'USD'),
    status: str(r, 'status'),
    payoutState: str(r, 'payout_state'),
    creatorRating: r['creator_rating'] === null ? null : num(r, 'creator_rating'),
    dueAt: r['due_at'] === null ? null : num(r, 'due_at'),
    deliveredAt: r['delivered_at'] === null ? null : num(r, 'delivered_at'),
    acceptedAt: r['accepted_at'] === null ? null : num(r, 'accepted_at'),
    paidAt: r['paid_at'] === null ? null : num(r, 'paid_at'),
    createdAt: num(r, 'created_at'),
  }
}

/** Payout is only legal after acceptance, which the schema also enforces. */
export function markAwardPaid(awardId: string): boolean {
  const ts = now()
  const r = run(
    `UPDATE bounty_awards
        SET payout_state = 'paid', paid_at = ?, updated_at = ?
      WHERE id = ? AND status = 'accepted' AND accepted_at IS NOT NULL
        AND payout_state = 'scheduled'`,
    [ts, ts, awardId],
  )
  return r.changes > 0
}

/** Only a delivered award can be disputed: acceptance has already released the money. */
export function markAwardDisputed(awardId: string): boolean {
  const ts = now()
  const r = run(
    `UPDATE bounty_awards SET status = 'disputed', updated_at = ?
      WHERE id = ? AND status = 'delivered'`,
    [ts, awardId],
  )
  return r.changes > 0
}

export function closeBounty(bountyId: string): void {
  run(`UPDATE bounties SET status = 'closed', updated_at = ? WHERE id = ?`, [now(), bountyId])
}

export function cancelBounty(bountyId: string): boolean {
  const ts = now()
  const r = run(
    `UPDATE bounties SET status = 'cancelled', updated_at = ?
      WHERE id = ? AND seats_awarded = 0 AND status IN ('draft', 'open')`,
    [ts, bountyId],
  )
  return r.changes > 0
}

export function bountyOwnerId(bountyId: string): string | null {
  const row = get<Row>(`SELECT created_by FROM bounties WHERE id = ?`, [bountyId])
  return row ? str(row, 'created_by') : null
}

/** Whether the reviewer has a submitted review on this bounty's project. */
export function deliverableFeedbackFor(
  bountyId: string,
  reviewerId: string,
): { readonly id: string; readonly headline: string | null } | null {
  const row = get<Row>(
    `SELECT f.id, f.headline
       FROM feedback f
       JOIN bounties b ON b.project_id = f.project_id
      WHERE b.id = ? AND f.reviewer_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
      ORDER BY f.submitted_at DESC
      LIMIT 1`,
    [bountyId, reviewerId],
  )
  if (!row) return null
  return { id: str(row, 'id'), headline: str(row, 'headline') || null }
}

export interface EscrowEntry {
  readonly id: string
  readonly eventKind: string
  readonly fromState: EscrowState | null
  readonly toState: EscrowState
  readonly amountCents: number
  readonly currency: string
  readonly providerRef: string | null
  readonly note: string | null
  readonly createdAt: Millis
}

/**
 * Oldest first. Rows written by one action share a millisecond, so the tie is
 * broken by insertion order rather than by id: a release is written before
 * its fee, and a random id would print them the other way round half the time.
 */
export function escrowHistory(bountyId: string): readonly EscrowEntry[] {
  return all<Row>(
    `SELECT * FROM bounty_escrow_events WHERE bounty_id = ? ORDER BY created_at, rowid`,
    [bountyId],
  ).map((r) => ({
    id: str(r, 'id'),
    eventKind: str(r, 'event_kind'),
    fromState: r['from_state'] === null ? null : (str(r, 'from_state') as EscrowState),
    toState: str(r, 'to_state') as EscrowState,
    amountCents: num(r, 'amount_cents'),
    currency: str(r, 'currency', 'USD'),
    providerRef: r['provider_ref'] === null ? null : str(r, 'provider_ref'),
    note: r['note'] === null ? null : str(r, 'note'),
    createdAt: num(r, 'created_at'),
  }))
}
