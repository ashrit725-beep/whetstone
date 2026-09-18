/**
 * Paid feedback: bounties, applications, awards, and the escrow ledger.
 *
 * `bounties.status` is the work's state machine and `bounties.escrow_state` is
 * the money's. They are deliberately separate, because funded work can still be
 * cancelled and delivered work can still be unpaid. `bounty_escrow_events` is
 * the record; the column on `bounties` is a cache of the last row, and every
 * money move writes both in one transaction.
 *
 * One product rule lives here rather than in the reputation module because it
 * is about payment: a bounty-paid review earns reputation only through adoption
 * and peer votes. The paying creator's helpful mark is worth zero, so money
 * cannot buy the mark.
 *
 * A second is about who sees what. An invite-only bounty is a direct request to
 * one reviewer, stored in `invited_user_id`. It is listed to exactly two people,
 * the creator who posted it and the reviewer it was sent to, and only that
 * reviewer can apply to it.
 */

import { all, get, run, tx } from '@/server/db/client'
import { bountyUrl } from './notification-targets'
import { now, uid } from '@/lib/utils'
import { gritValue, stageLabel } from '@/lib/taxonomy'
import type {
  BountyRow,
  BountyStatus,
  BountyView,
  EscrowState,
  Millis,
  Page,
  PageOptions,
  UserCard,
} from '@/lib/types'
import {
  DAY_MS,
  decodeCursor,
  encodeCursor,
  mapUserCard,
  num,
  numOrNull,
  pageLimit,
  str,
  strOrNull,
  toPage,
  userCardJoin,
  userCardSelect,
  type Row,
} from './_shared'
import { notify } from './notifications'
import { recordReputationEvent } from './reputation'

/** Platform fee, in basis points. The bounty pages read it from here rather than restating it. */
export const DEFAULT_PLATFORM_FEE_BPS = 1000

export interface FeeSchedule {
  readonly platformFeeBps: number
  readonly platformFeePercent: number
  readonly examples: readonly { readonly amountCents: number; readonly feeCents: number; readonly netCents: number }[]
}

export function getBountyFeeSchedule(): FeeSchedule {
  const amounts = [5_000, 15_000, 50_000]
  return {
    platformFeeBps: DEFAULT_PLATFORM_FEE_BPS,
    platformFeePercent: DEFAULT_PLATFORM_FEE_BPS / 100,
    examples: amounts.map((amountCents) => {
      const feeCents = feeFor(amountCents, DEFAULT_PLATFORM_FEE_BPS)
      return { amountCents, feeCents, netCents: amountCents - feeCents }
    }),
  }
}

export function feeFor(amountCents: number, bps: number): number {
  return Math.min(amountCents - 1, Math.round((amountCents * bps) / 10_000))
}

/* ------------------------------------------------------------------------- *
 * Schema addition
 * ------------------------------------------------------------------------- *
 * `invited_user_id` is in `schema.sql`, but `CREATE TABLE IF NOT EXISTS` never
 * alters a table that already exists, so a database created before the column
 * was added would fail every read below. The column is added once per process,
 * the first time anything here touches the table. It is nullable with no
 * default, which is what SQLite allows a foreign-key column added this way.
 */

let inviteeColumnReady = false

export function ensureInviteeColumn(): void {
  if (inviteeColumnReady) return
  const present = (): boolean =>
    all<Row>(`PRAGMA table_info(bounties)`).some((column) => str(column, 'name') === 'invited_user_id')
  if (!present()) {
    try {
      run(`ALTER TABLE bounties ADD COLUMN invited_user_id TEXT REFERENCES users (id) ON DELETE SET NULL`)
    } catch (error) {
      // Another process on the same file can add it between the check and here.
      if (!present()) throw error
    }
  }
  inviteeColumnReady = true
}

/* ------------------------------------------------------------------------- *
 * Reads
 * ------------------------------------------------------------------------- */

export interface BountyFilters extends PageOptions {
  readonly expertiseSlug?: string | null
  readonly minAmountCents?: number | null
  readonly status?: BountyStatus | null
  readonly projectId?: string | null
  readonly createdBy?: string | null
  /** Who is reading. It decides which invite-only bounties can be listed. */
  readonly viewerId?: string | null
  readonly openOnly?: boolean
}

/**
 * Which bounties a reader may see listed: every public one, and an invite-only
 * one only when they posted it or it was sent to them. Anyone else never finds
 * it in a list, whatever filter they ask for. Shared with the facet counts in
 * `queries/marketplace.ts`, so a chip counts exactly the rows it opens.
 */
export function listableBy(viewerId: string | null): { sql: string; params: unknown[] } {
  if (!viewerId) return { sql: "b.visibility = 'public'", params: [] }
  return {
    sql: "(b.visibility = 'public' OR b.created_by = ? OR b.invited_user_id = ?)",
    params: [viewerId, viewerId],
  }
}

/**
 * The WHERE clause the list and its count share, so the number printed above
 * the list is always the length of the list a reader can page through.
 */
function bountyWhere(filters: BountyFilters): { where: string[]; params: unknown[] } {
  const listable = listableBy(filters.viewerId ?? null)
  const where: string[] = ['p.deleted_at IS NULL', listable.sql]
  const params: unknown[] = [...listable.params]

  if (filters.status) {
    where.push('b.status = ?')
    params.push(filters.status)
  } else if (filters.openOnly !== false && !filters.createdBy) {
    where.push("b.status = 'open'")
  }
  if (filters.projectId) {
    where.push('b.project_id = ?')
    params.push(filters.projectId)
  }
  if (filters.createdBy) {
    where.push('b.created_by = ?')
    params.push(filters.createdBy)
  }
  if (filters.expertiseSlug) {
    where.push('ea.slug = ?')
    params.push(filters.expertiseSlug)
  }
  if (filters.minAmountCents != null) {
    where.push('b.amount_cents >= ?')
    params.push(filters.minAmountCents)
  }
  return { where, params }
}

/** How many bounties `listBounties` would page through for the same filters and reader. */
export function countBounties(filters: Omit<BountyFilters, 'cursor' | 'limit'> = {}): number {
  ensureInviteeColumn()
  const { where, params } = bountyWhere(filters)
  const row = get<Row>(
    `SELECT COUNT(*) AS n
       FROM bounties b
       JOIN projects p ON p.id = b.project_id
       LEFT JOIN expertise_areas ea ON ea.id = b.expertise_id
      WHERE ${where.join(' AND ')}`,
    params,
  )
  return num(row, 'n')
}

export function listBounties(filters: BountyFilters = {}): Page<BountyView> {
  ensureInviteeColumn()
  const limit = pageLimit(filters.limit, 20)
  const cursor = decodeCursor(filters.cursor)
  const { where, params } = bountyWhere(filters)

  if (cursor) {
    where.push('(b.amount_cents < ? OR (b.amount_cents = ? AND b.id < ?))')
    params.push(num(cursor, 'v'), num(cursor, 'v'), str(cursor, 'id'))
  }

  const viewerId = filters.viewerId ?? null
  const rows = all<Row>(
    `${bountySelect(viewerId)}
      WHERE ${where.join(' AND ')}
      ORDER BY b.amount_cents DESC, b.id DESC
      LIMIT ?`,
    [...(viewerId ? [viewerId] : []), ...params, limit + 1],
  )
  const page = toPage(rows, limit, (last) =>
    encodeCursor({ v: num(last, 'amount_cents'), id: str(last, 'id') }),
  )
  return {
    items: page.items.map((r) => mapBounty(r, viewerId)),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  }
}

/**
 * A bounty whose project was taken down goes with it, as it does from the list.
 * An invite-only bounty still resolves by its link, which is how its reviewer
 * reaches it from the notification; the page says whom it was sent to, and
 * `viewerCanApply` is false for everyone else.
 */
export function getBounty(bountyId: string, viewerId?: string | null): BountyView | undefined {
  ensureInviteeColumn()
  const row = get<Row>(`${bountySelect(viewerId ?? null)} WHERE b.id = ? AND p.deleted_at IS NULL`, [
    ...(viewerId ? [viewerId] : []),
    bountyId,
  ])
  return row ? mapBounty(row, viewerId ?? null) : undefined
}

export function listMyBounties(userId: string, opts: { readonly status?: BountyStatus | null } = {}): Page<BountyView> {
  return listBounties({ createdBy: userId, status: opts.status ?? null, viewerId: userId, limit: 50 })
}

function bountySelect(viewerId: string | null): string {
  return `SELECT b.*, p.slug AS project_slug, p.title AS project_title, p.stage_key,
                 pt.slug AS type_slug, pt.label AS type_label,
                 ea.id AS expertise_id_v, ea.slug AS expertise_slug, ea.label AS expertise_label,
                 ${userCardSelect('u', 'pr', 'rs', 'c')},
                 ${userCardSelect('iu', 'ipr', 'irs', 'i')},
                 (SELECT COUNT(*) FROM bounty_applications ba WHERE ba.bounty_id = b.id) AS application_count,
                 ${viewerId ? '(SELECT 1 FROM bounty_applications ba2 WHERE ba2.bounty_id = b.id AND ba2.applicant_id = ?)' : 'NULL'} AS viewer_applied
            FROM bounties b
            JOIN projects p ON p.id = b.project_id
            JOIN project_types pt ON pt.id = p.project_type_id
            JOIN users u ON u.id = b.created_by
            ${userCardJoin('u', 'pr', 'rs')}
            LEFT JOIN users iu ON iu.id = b.invited_user_id
            ${userCardJoin('iu', 'ipr', 'irs')}
            LEFT JOIN expertise_areas ea ON ea.id = b.expertise_id`
}

function mapBounty(r: Row, viewerId: string | null): BountyView {
  const seats = num(r, 'seats', 1)
  const awarded = num(r, 'seats_awarded')
  const status = (str(r, 'status') || 'draft') as BountyStatus
  const escrowState = (str(r, 'escrow_state') || 'unfunded') as EscrowState
  const creator = mapUserCard(r, 'c')
  const typeSlug = str(r, 'type_slug')
  const stageKey = str(r, 'stage_key')
  const viewerApplied = num(r, 'viewer_applied') === 1
  const visibility = str(r, 'visibility') === 'invite_only' ? 'invite_only' : 'public'
  const invitee = strOrNull(r, 'i_id') ? mapUserCard(r, 'i') : null
  // An invite-only bounty whose invitee is gone takes no applications at all.
  const viewerMayApply = visibility === 'public' || (invitee !== null && invitee.id === viewerId)

  return {
    id: str(r, 'id'),
    title: str(r, 'title'),
    briefMd: str(r, 'brief_md'),
    amountCents: num(r, 'amount_cents'),
    currency: str(r, 'currency', 'USD'),
    seats,
    seatsAwarded: awarded,
    seatsOpen: Math.max(0, seats - awarded),
    turnaroundHours: numOrNull(r, 'turnaround_hours'),
    status,
    escrowState,
    isFunded: escrowState === 'authorized' || escrowState === 'held',
    closesAt: numOrNull(r, 'closes_at'),
    createdAt: num(r, 'created_at'),
    expertise: strOrNull(r, 'expertise_slug')
      ? {
          id: str(r, 'expertise_id_v'),
          slug: str(r, 'expertise_slug'),
          label: str(r, 'expertise_label'),
        }
      : null,
    creator,
    visibility,
    invitee,
    project: {
      id: str(r, 'project_id'),
      slug: str(r, 'project_slug'),
      title: str(r, 'project_title'),
      typeLabel: str(r, 'type_label'),
      stageLabel: stageLabel(typeSlug, stageKey),
      grit: gritValue(stageKey),
    },
    applicationCount: num(r, 'application_count'),
    viewerApplied,
    viewerCanApply:
      viewerId !== null &&
      viewerId !== creator.id &&
      viewerMayApply &&
      status === 'open' &&
      awarded < seats &&
      !viewerApplied,
  }
}

/* ------------------------------------------------------------------------- *
 * Applications
 * ------------------------------------------------------------------------- */

export interface BountyApplicationView {
  readonly id: string
  readonly applicant: UserCard
  readonly pitchMd: string | null
  readonly quotedCents: number | null
  readonly etaHours: number | null
  readonly status: 'pending' | 'shortlisted' | 'accepted' | 'declined' | 'withdrawn' | 'expired'
  readonly createdAt: Millis
}

export function listApplications(bountyId: string): readonly BountyApplicationView[] {
  return all<Row>(
    `SELECT ba.*, ${userCardSelect('u', 'pr', 'rs', 'a')}
       FROM bounty_applications ba
       JOIN users u ON u.id = ba.applicant_id
       ${userCardJoin('u', 'pr', 'rs')}
      WHERE ba.bounty_id = ?
      ORDER BY CASE ba.status WHEN 'accepted' THEN 0 WHEN 'shortlisted' THEN 1 ELSE 2 END,
               ba.created_at`,
    [bountyId],
  ).map(
    (r): BountyApplicationView => ({
      id: str(r, 'id'),
      applicant: mapUserCard(r, 'a'),
      pitchMd: strOrNull(r, 'pitch_md'),
      quotedCents: numOrNull(r, 'quoted_cents'),
      etaHours: numOrNull(r, 'eta_hours'),
      status: (str(r, 'status') || 'pending') as BountyApplicationView['status'],
      createdAt: num(r, 'created_at'),
    }),
  )
}

export function applyToBounty(input: {
  readonly bountyId: string
  readonly applicantId: string
  readonly pitchMd?: string | null
  readonly quotedCents?: number | null
  readonly etaHours?: number | null
}): string {
  const id = uid()
  const ts = now()
  tx(() => {
    run(
      `INSERT INTO bounty_applications
         (id, bounty_id, applicant_id, pitch_md, quoted_cents, eta_hours, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)
       ON CONFLICT (bounty_id, applicant_id) DO UPDATE SET
         pitch_md = excluded.pitch_md, quoted_cents = excluded.quoted_cents,
         eta_hours = excluded.eta_hours, status = 'pending', updated_at = excluded.updated_at`,
      [id, input.bountyId, input.applicantId, input.pitchMd ?? null, input.quotedCents ?? null, input.etaHours ?? null, ts, ts],
    )
    const bounty = get<Row>(`SELECT created_by, title FROM bounties WHERE id = ?`, [input.bountyId])
    notify({
      userId: str(bounty, 'created_by'),
      actorId: input.applicantId,
      kind: 'bounty_application',
      subjectType: 'bounty',
      subjectId: input.bountyId,
      title: `New application for ${str(bounty, 'title')}`,
      url: bountyUrl(input.bountyId),
      groupKey: `bounty-app:${input.bountyId}`,
    })
  })
  return id
}

/* ------------------------------------------------------------------------- *
 * Writes: bounty lifecycle
 * ------------------------------------------------------------------------- */

export interface NewBountyInput {
  readonly projectId: string
  readonly createdBy: string
  readonly title: string
  readonly briefMd: string
  readonly amountCents: number
  readonly currency?: string
  readonly expertiseId?: string | null
  readonly seats?: number
  readonly turnaroundHours?: number | null
  readonly closesAt?: Millis | null
  readonly versionId?: string | null
  /** Set for a direct request. It is what makes the bounty invite-only. */
  readonly invitedUserId?: string | null
}

/**
 * Created unfunded and in draft. The schema refuses to advertise unfunded work.
 * Visibility follows from the invitee rather than being passed alongside it, so
 * an invite-only bounty cannot be written without someone to have invited.
 */
export function createBounty(input: NewBountyInput): string {
  ensureInviteeColumn()
  const id = uid()
  const ts = now()
  const invitedUserId = input.invitedUserId ?? null
  run(
    `INSERT INTO bounties
       (id, project_id, version_id, created_by, title, brief_md, expertise_id,
        amount_cents, currency, platform_fee_bps, seats, seats_awarded,
        turnaround_hours, visibility, invited_user_id, status, escrow_state, closes_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, 'draft', 'unfunded', ?, ?, ?)`,
    [
      id,
      input.projectId,
      input.versionId ?? null,
      input.createdBy,
      input.title,
      input.briefMd,
      input.expertiseId ?? null,
      input.amountCents,
      input.currency ?? 'USD',
      DEFAULT_PLATFORM_FEE_BPS,
      input.seats ?? 1,
      input.turnaroundHours ?? null,
      invitedUserId ? 'invite_only' : 'public',
      invitedUserId,
      input.closesAt ?? null,
      ts,
      ts,
    ],
  )
  return id
}

/**
 * Records a money movement and advances the cached state in the same
 * transaction. `idempotencyKey` is what keeps a retried webhook from moving
 * money twice; the unique index enforces it, and a repeat is a no-op.
 */
export function recordEscrowEvent(input: {
  readonly bountyId: string
  readonly eventKind:
    | 'authorize' | 'capture' | 'hold' | 'release' | 'partial_release'
    | 'refund' | 'chargeback' | 'dispute_open' | 'dispute_resolve' | 'fee'
  readonly toState: EscrowState
  readonly amountCents: number
  readonly awardId?: string | null
  readonly providerRef?: string | null
  readonly actorId?: string | null
  readonly idempotencyKey?: string | null
  readonly note?: string | null
}): boolean {
  const ts = now()
  return tx(() => {
    const bounty = get<Row>(`SELECT escrow_state, currency FROM bounties WHERE id = ?`, [input.bountyId])
    if (!bounty) return false
    const from = str(bounty, 'escrow_state')
    const r = run(
      `INSERT INTO bounty_escrow_events
         (id, bounty_id, award_id, event_kind, from_state, to_state, amount_cents,
          currency, provider_ref, actor_id, idempotency_key, note, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       -- The conflict target repeats the partial index predicate, which is what
       -- makes it match ux_escrow_idempotency at all.
       ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
      [
        uid(),
        input.bountyId,
        input.awardId ?? null,
        input.eventKind,
        from,
        input.toState,
        input.amountCents,
        str(bounty, 'currency', 'USD'),
        input.providerRef ?? null,
        input.actorId ?? null,
        input.idempotencyKey ?? null,
        input.note ?? null,
        ts,
      ],
    )
    if (r.changes === 0) return false
    run(
      `UPDATE bounties SET escrow_state = ?, escrow_ref = COALESCE(?, escrow_ref), updated_at = ?
        WHERE id = ?`,
      [input.toState, input.providerRef ?? null, ts, input.bountyId],
    )
    return true
  })
}

/** Opens a funded bounty to the market. */
export function openBounty(bountyId: string): void {
  run(
    `UPDATE bounties SET status = 'open', updated_at = ?
      WHERE id = ? AND escrow_state IN ('authorized', 'held')`,
    [now(), bountyId],
  )
}

export function awardBounty(input: {
  readonly bountyId: string
  readonly expertId: string
  readonly applicationId?: string | null
  readonly actorId: string
}): string {
  const id = uid()
  const ts = now()
  tx(() => {
    const bounty = get<BountyRow>(`SELECT * FROM bounties WHERE id = ?`, [input.bountyId])
    if (!bounty) throw new Error(`No such bounty: ${input.bountyId}`)
    const fee = feeFor(bounty.amount_cents, bounty.platform_fee_bps)
    const due = bounty.turnaround_hours ? ts + bounty.turnaround_hours * 3_600_000 : null
    run(
      `INSERT INTO bounty_awards
         (id, bounty_id, application_id, expert_id, amount_cents, fee_cents, currency,
          status, payout_state, due_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'assigned', 'pending', ?, ?, ?)`,
      [id, input.bountyId, input.applicationId ?? null, input.expertId, bounty.amount_cents, fee, bounty.currency, due, ts, ts],
    )
    if (input.applicationId) {
      run(`UPDATE bounty_applications SET status = 'accepted', updated_at = ? WHERE id = ?`, [ts, input.applicationId])
    }
    run(
      `UPDATE bounties
          SET seats_awarded = seats_awarded + 1,
              status = CASE WHEN seats_awarded + 1 >= seats THEN 'in_progress' ELSE status END,
              updated_at = ?
        WHERE id = ?`,
      [ts, input.bountyId],
    )
    notify({
      userId: input.expertId,
      actorId: input.actorId,
      kind: 'bounty_awarded',
      subjectType: 'bounty_award',
      subjectId: id,
      title: `You were awarded ${bounty.title}`,
      url: bountyUrl(input.bountyId),
    })
  })
  return id
}

/** Delivery links the review. The schema refuses "delivered" with nothing to read. */
export function deliverBounty(awardId: string, feedbackId: string): void {
  const ts = now()
  tx(() => {
    run(
      `UPDATE bounty_awards SET status = 'delivered', feedback_id = ?, delivered_at = ?, updated_at = ?
        WHERE id = ?`,
      [feedbackId, ts, ts, awardId],
    )
    const award = get<Row>(
      `SELECT ba.bounty_id, b.created_by, b.title FROM bounty_awards ba
         JOIN bounties b ON b.id = ba.bounty_id WHERE ba.id = ?`,
      [awardId],
    )
    run(`UPDATE bounties SET status = 'delivered', updated_at = ? WHERE id = ?`, [ts, str(award, 'bounty_id')])
    notify({
      userId: str(award, 'created_by'),
      kind: 'bounty_delivered',
      subjectType: 'bounty_award',
      subjectId: awardId,
      title: `Review delivered for ${str(award, 'title')}`,
      url: bountyUrl(str(award, 'bounty_id')),
    })
  })
}

/**
 * Acceptance is what releases money, and the schema enforces that ordering.
 * Reputation for paid work comes from adoption and peers, never from the
 * paying creator's mark, so the ledger entry here is the completion record.
 */
export function acceptDelivery(input: {
  readonly awardId: string
  readonly actorId: string
  readonly rating?: number | null
  readonly review?: string | null
}): void {
  const ts = now()
  tx(() => {
    run(
      `UPDATE bounty_awards
          SET status = 'accepted', accepted_at = ?, creator_rating = ?, creator_review = ?,
              payout_state = 'scheduled', updated_at = ?
        WHERE id = ? AND status = 'delivered'`,
      [ts, input.rating ?? null, input.review ?? null, ts, input.awardId],
    )
    const award = get<Row>(
      `SELECT ba.expert_id, ba.bounty_id, ba.amount_cents, b.title
         FROM bounty_awards ba JOIN bounties b ON b.id = ba.bounty_id WHERE ba.id = ?`,
      [input.awardId],
    )
    const expertId = str(award, 'expert_id')
    run(
      `UPDATE expert_profiles
          SET completed_count = completed_count + 1,
              avg_rating = COALESCE((
                SELECT AVG(CAST(creator_rating AS REAL)) FROM bounty_awards
                 WHERE expert_id = ? AND creator_rating IS NOT NULL), 0.0),
              updated_at = ?
        WHERE user_id = ?`,
      [expertId, ts, expertId],
    )
    recordReputationEvent({
      userId: expertId,
      facet: 'expert',
      kind: 'bounty_completed',
      delta: 40,
      subjectType: 'bounty',
      subjectId: str(award, 'bounty_id'),
      actorId: input.actorId,
    })
    notify({
      userId: expertId,
      actorId: input.actorId,
      kind: 'bounty_paid',
      subjectType: 'bounty_award',
      subjectId: input.awardId,
      title: `Accepted: ${str(award, 'title')}`,
      url: bountyUrl(str(award, 'bounty_id')),
    })
  })
}

/* ------------------------------------------------------------------------- *
 * Requests and earnings
 * ------------------------------------------------------------------------- */

export interface RequestView {
  readonly awardId: string
  readonly bountyId: string
  readonly bountyTitle: string
  readonly projectSlug: string
  readonly projectTitle: string
  readonly counterparty: UserCard
  readonly amountCents: number
  readonly feeCents: number
  readonly currency: string
  readonly status: string
  readonly payoutState: string
  readonly feedbackId: string | null
  readonly dueAt: Millis | null
  readonly deliveredAt: Millis | null
  readonly acceptedAt: Millis | null
  readonly createdAt: Millis
}

export interface RequestFilters {
  /** `'expert'` is the work you took; `'creator'` is the work you bought. */
  readonly role?: 'expert' | 'creator'
  readonly status?: string | null
  /** Any of several award states, such as everything that reached delivery. */
  readonly statuses?: readonly string[] | null
  /**
   * Who is reading, defaulting to the person whose own list it is. Someone else
   * reading a reviewer's record, on their rate card, sees the public bounties in
   * it and only the invite-only ones they were a party to.
   */
  readonly viewerId?: string | null
}

/** The WHERE clause the request list and its count share. */
function requestWhere(userId: string, opts: RequestFilters): { where: string[]; params: unknown[] } {
  const role = opts.role ?? 'expert'
  const viewerId = opts.viewerId === undefined ? userId : opts.viewerId

  // The reviewer holding an award is a party to it too, whoever it was sent to.
  const listable = listableBy(viewerId)
  const where: string[] = [
    role === 'expert' ? 'ba.expert_id = ?' : 'b.created_by = ?',
    viewerId ? `(${listable.sql} OR ba.expert_id = ?)` : listable.sql,
  ]
  const params: unknown[] = [userId, ...listable.params, ...(viewerId ? [viewerId] : [])]
  if (opts.status) {
    where.push('ba.status = ?')
    params.push(opts.status)
  }
  if (opts.statuses && opts.statuses.length > 0) {
    where.push(`ba.status IN (${opts.statuses.map(() => '?').join(', ')})`)
    params.push(...opts.statuses)
  }
  return { where, params }
}

/** How many awards `listRequests` would page through for the same filters and reader. */
export function countRequests(userId: string, opts: RequestFilters = {}): number {
  ensureInviteeColumn()
  const { where, params } = requestWhere(userId, opts)
  const row = get<Row>(
    `SELECT COUNT(*) AS n
       FROM bounty_awards ba
       JOIN bounties b ON b.id = ba.bounty_id
       JOIN projects p ON p.id = b.project_id
      WHERE ${where.join(' AND ')}`,
    params,
  )
  return num(row, 'n')
}

export function listRequests(userId: string, opts: PageOptions & RequestFilters = {}): Page<RequestView> {
  ensureInviteeColumn()
  const limit = pageLimit(opts.limit, 20)
  const cursor = decodeCursor(opts.cursor)
  const at = cursor ? num(cursor, 'at') : null
  const role = opts.role ?? 'expert'
  const { where, params } = requestWhere(userId, opts)
  if (at !== null) {
    where.push('ba.created_at < ?')
    params.push(at)
  }

  // The counterparty is whoever you are not.
  const counterpartyJoin =
    role === 'expert' ? 'JOIN users u ON u.id = b.created_by' : 'JOIN users u ON u.id = ba.expert_id'

  const rows = all<Row>(
    `SELECT ba.*, b.title AS bounty_title, b.id AS bounty_id_v,
            p.slug AS project_slug, p.title AS project_title,
            ${userCardSelect('u', 'pr', 'rs', 'x')}
       FROM bounty_awards ba
       JOIN bounties b ON b.id = ba.bounty_id
       JOIN projects p ON p.id = b.project_id
       ${counterpartyJoin}
       ${userCardJoin('u', 'pr', 'rs')}
      WHERE ${where.join(' AND ')}
      ORDER BY ba.created_at DESC
      LIMIT ?`,
    [...params, limit + 1],
  )

  const items = rows.map(
    (r): RequestView => ({
      awardId: str(r, 'id'),
      bountyId: str(r, 'bounty_id_v'),
      bountyTitle: str(r, 'bounty_title'),
      projectSlug: str(r, 'project_slug'),
      projectTitle: str(r, 'project_title'),
      counterparty: mapUserCard(r, 'x'),
      amountCents: num(r, 'amount_cents'),
      feeCents: num(r, 'fee_cents'),
      currency: str(r, 'currency', 'USD'),
      status: str(r, 'status'),
      payoutState: str(r, 'payout_state'),
      feedbackId: strOrNull(r, 'feedback_id'),
      dueAt: numOrNull(r, 'due_at'),
      deliveredAt: numOrNull(r, 'delivered_at'),
      acceptedAt: numOrNull(r, 'accepted_at'),
      createdAt: num(r, 'created_at'),
    }),
  )
  return toPage(items, limit, (last) => encodeCursor({ at: last.createdAt }))
}

export interface EarningsLedger {
  readonly currency: string
  readonly paidCents: number
  readonly scheduledCents: number
  readonly pendingCents: number
  readonly feeCents: number
  readonly entries: Page<RequestView>
}

/** Every figure here is summed from award rows. Nothing is modelled or averaged. */
export function getEarningsLedger(
  userId: string,
  opts: PageOptions & { readonly rangeDays?: number | null } = {},
): EarningsLedger {
  const since = opts.rangeDays ? now() - opts.rangeDays * DAY_MS : 0
  const totals = get<Row>(
    `SELECT
       COALESCE(SUM(CASE WHEN payout_state = 'paid' THEN amount_cents - fee_cents ELSE 0 END), 0)      AS paid,
       COALESCE(SUM(CASE WHEN payout_state = 'scheduled' THEN amount_cents - fee_cents ELSE 0 END), 0) AS scheduled,
       COALESCE(SUM(CASE WHEN payout_state = 'pending' THEN amount_cents - fee_cents ELSE 0 END), 0)   AS pending,
       COALESCE(SUM(fee_cents), 0)                                                                     AS fees,
       COALESCE(MAX(currency), 'USD')                                                                  AS currency
     FROM bounty_awards
    WHERE expert_id = ? AND created_at >= ?`,
    [userId, since],
  )
  return {
    currency: str(totals, 'currency', 'USD'),
    paidCents: num(totals, 'paid'),
    scheduledCents: num(totals, 'scheduled'),
    pendingCents: num(totals, 'pending'),
    feeCents: num(totals, 'fees'),
    entries: listRequests(userId, { ...opts, role: 'expert' }),
  }
}

export function listEscrowEvents(bountyId: string): readonly Row[] {
  return all<Row>(
    `SELECT * FROM bounty_escrow_events WHERE bounty_id = ? ORDER BY created_at`,
    [bountyId],
  )
}
