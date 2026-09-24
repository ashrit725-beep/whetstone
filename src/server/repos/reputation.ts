/**
 * Reputation — design/TAXONOMY.md §3, implemented term by term.
 *
 * Design goals, in the document's priority order: specificity beats volume;
 * follow-through beats applause; collusion is arithmetically unprofitable;
 * honest critical feedback is never punished; expertise is per-domain, never a
 * single vanity number.
 *
 * The arithmetic runs in JavaScript rather than SQL on purpose. Every term is
 * then inspectable, `getReputationBreakdown` can hand the profile page the exact
 * working, and a weighting change is a rerun rather than a migration.
 *
 * Two places where the schema and the document disagree, resolved here and
 * recorded in design/REPOS.md:
 *
 *   `d_r` (creator marked "not applicable") has no column. It is read as a
 *   review the creator archived without replying and without marking helpful —
 *   the only shape in the schema that means the same thing.
 *
 *   `ω_d` cross-tag attribution (1.0 / 0.7 / 0.3) needs a project to declare
 *   more than one type. The schema gives a project exactly one, so the primary
 *   weight 1.0 is the only one that can currently apply.
 */

import { all, get, run } from '@/server/db/client'
import { now, uid } from '@/lib/utils'
import {
  EXPERT_GATES,
  PROJECT_TYPES,
  PROJECT_TYPE_SLUGS,
  REPUTATION,
  isProjectTypeSlug,
  tierFor,
} from '@/lib/taxonomy'
import type {
  DomainCredibility,
  ExpertGateStatus,
  Millis,
  ProjectTypeSlug,
  ReputationComputation,
  ReputationEventKind,
  ReputationFacet,
  ReputationScoreRow,
  ReputationSubjectType,
  ReviewValueBreakdown,
  UserCard,
} from '@/lib/types'
import {
  DAY_MS,
  clamp01,
  clampNum,
  decodeCursor,
  encodeCursor,
  mapUserCard,
  num,
  numOrNull,
  pageLimit,
  str,
  toPage,
  userCardSelect,
  type Row,
} from './_shared'
import type { Page, PageOptions } from '@/lib/types'

const LN2 = Math.LN2

/* ------------------------------------------------------------------------- *
 * A small memo, because a marketplace page asks for twelve of these at once
 * ------------------------------------------------------------------------- *
 * One computation is six queries. Rendering a leaderboard without this would
 * multiply that by the page size for numbers that cannot change mid-request.
 */

const MEMO_TTL_MS = 30_000
const memo = new Map<string, { at: number; value: ReputationComputation }>()

function memoGet(userId: string, nowMs: number): ReputationComputation | undefined {
  const hit = memo.get(userId)
  if (hit && nowMs - hit.at < MEMO_TTL_MS) return hit.value
  if (hit) memo.delete(userId)
  return undefined
}

function memoSet(userId: string, nowMs: number, value: ReputationComputation): void {
  if (memo.size > 512) memo.clear()
  memo.set(userId, { at: nowMs, value })
}

/** Guards the one re-entrant path: `persistReputation` drops the memo itself. */
const rewriting = new Set<string>()

/**
 * Call after anything that changes a user's evidence.
 *
 * Two things cache a score: the memo above, and the `reputation_scores` rollup
 * that every card, leaderboard, expert row and profile header reads. Dropping
 * the memo alone left the rollup frozen at whatever last wrote it — for every
 * account created since the seed, that is the all-zero row `createUser` inserts
 * — so a reviewer whose own reputation page computed a real score from evidence
 * was shown as 0 everywhere else on the site. The rollup is derived data, so it
 * is rewritten here, where the evidence changed, rather than by a cadence
 * nothing runs.
 *
 * A failed rewrite must never be the reason a review, a vote or a shipped
 * suggestion fails to save: the previous rollup stands, and the next evidence
 * change writes it again.
 */
export function invalidateReputation(userId: string): void {
  memo.delete(userId)
  if (!userId || rewriting.has(userId)) return
  rewriting.add(userId)
  try {
    persistReputation(userId)
  } catch {
    // Left as it was, on purpose. See above.
  } finally {
    rewriting.delete(userId)
  }
}

/* ------------------------------------------------------------------------- *
 * Raw evidence
 * ------------------------------------------------------------------------- */

interface ReviewEvidence {
  readonly feedbackId: string
  readonly projectId: string
  readonly projectTitle: string
  readonly creatorId: string
  readonly domain: ProjectTypeSlug
  readonly submittedAt: Millis
  /** Specificity `S_r`, stored on the row at write time. */
  readonly specificity: number
  readonly helpful: number
  readonly adoption: number
  readonly notApplicable: number
  readonly moderation: number
  readonly voteTrustUp: number
  readonly voteTrustDown: number
  /** A bounty-paid review cannot earn from the paying creator's helpful mark. */
  readonly paidByCreator: boolean
}

/**
 * One query for the whole evidence set. Each correlated subquery is bounded by
 * the review it hangs off, so this stays linear in the reviewer's own history
 * rather than in the size of the platform.
 */
function loadEvidence(userId: string, nowMs: number): readonly ReviewEvidence[] {
  const plannedCutoff = nowMs - REPUTATION.plannedDecayDays * DAY_MS
  const rows = all<Row>(
    `SELECT
       f.id                AS feedback_id,
       f.project_id        AS project_id,
       p.title             AS project_title,
       p.owner_id          AS creator_id,
       pt.slug             AS domain,
       f.submitted_at      AS submitted_at,
       COALESCE(f.quality_score, 0.0)     AS specificity,
       f.creator_marked_helpful           AS helpful,
       f.bounty_id                        AS bounty_id,
       CASE WHEN f.inbox_state = 'archived'
             AND f.creator_marked_helpful = 0
             AND f.first_reply_at IS NULL THEN 1 ELSE 0 END       AS not_applicable,
       -- a_r: shipped 1.0, planned 0.5, planned and stale 0.25, else 0.
       (SELECT MAX(CASE
                     WHEN sg.status = 'shipped' THEN ?
                     WHEN sg.status IN ('planned', 'in_progress')
                          AND COALESCE(sg.status_changed_at, sg.updated_at) < ? THEN ?
                     WHEN sg.status IN ('planned', 'in_progress') THEN ?
                     ELSE 0.0 END)
          FROM feedback_points fp
          JOIN suggestion_sources ss ON ss.point_id = fp.id
          JOIN suggestions sg        ON sg.id = ss.suggestion_id
         WHERE fp.feedback_id = f.id)                              AS adoption,
       -- Trust-weighted peer votes, split by direction.
       (SELECT COALESCE(SUM(MIN(COALESCE(vrs.total_score, 0) / ?, ?)), 0.0)
          FROM feedback_votes fv
          LEFT JOIN reputation_scores vrs ON vrs.user_id = fv.voter_id
         WHERE fv.feedback_id = f.id AND fv.vote_value = 1)        AS vote_up,
       (SELECT COALESCE(SUM(MIN(COALESCE(vrs.total_score, 0) / ?, ?)), 0.0)
          FROM feedback_votes fv
          LEFT JOIN reputation_scores vrs ON vrs.user_id = fv.voter_id
         WHERE fv.feedback_id = f.id AND fv.vote_value = -1)       AS vote_down,
       -- m_r: a live moderation action against this review.
       (SELECT COALESCE(MAX(CASE
                    WHEN ma.action IN ('remove', 'ban', 'suspend', 'reputation_penalty') THEN 1.0
                    WHEN ma.action IN ('warn', 'hide', 'unlist') THEN 0.5
                    ELSE 0.0 END), 0.0)
          FROM moderation_actions ma
         WHERE ma.target_type = 'feedback' AND ma.target_id = f.id
           AND ma.reverted_at IS NULL)                             AS moderation
     FROM feedback f
     JOIN projects p      ON p.id = f.project_id
     JOIN project_types pt ON pt.id = f.project_type_id
    WHERE f.reviewer_id = ?
      AND f.status = 'submitted'
      AND f.deleted_at IS NULL
      AND f.submitted_at IS NOT NULL`,
    [
      REPUTATION.adoptionShipped,
      plannedCutoff,
      REPUTATION.adoptionPlannedDecayed,
      REPUTATION.adoptionPlanned,
      REPUTATION.voterTrustDivisor,
      REPUTATION.voterTrustCap,
      REPUTATION.voterTrustDivisor,
      REPUTATION.voterTrustCap,
      userId,
    ],
  )

  return rows.flatMap((r): ReviewEvidence[] => {
    const domain = str(r, 'domain')
    if (!isProjectTypeSlug(domain)) return []
    return [
      {
        feedbackId: str(r, 'feedback_id'),
        projectId: str(r, 'project_id'),
        projectTitle: str(r, 'project_title'),
        creatorId: str(r, 'creator_id'),
        domain,
        submittedAt: num(r, 'submitted_at'),
        specificity: clamp01(num(r, 'specificity')),
        helpful: num(r, 'helpful') > 0 ? 1 : 0,
        adoption: clamp01(num(r, 'adoption')),
        notApplicable: num(r, 'not_applicable') > 0 ? 1 : 0,
        moderation: clampNum(num(r, 'moderation'), 0, 1),
        voteTrustUp: num(r, 'vote_up'),
        voteTrustDown: num(r, 'vote_down'),
        paidByCreator: r['bounty_id'] !== null && r['bounty_id'] !== undefined,
      },
    ]
  })
}

/**
 * κ(c) — creator discrimination, the core anti-collusion term. A creator who
 * marks everything helpful carries no information, so their mark is worth 40%
 * of face value; the more they inflate, the less their inflation buys.
 */
function loadKappa(creatorIds: readonly string[]): Map<string, number> {
  const out = new Map<string, number>()
  if (creatorIds.length === 0) return out
  const ids = [...new Set(creatorIds)]
  const rows = all<Row>(
    `SELECT p.owner_id AS creator_id,
            COUNT(*)   AS received,
            SUM(f.creator_marked_helpful) AS helpful
       FROM feedback f
       JOIN projects p ON p.id = f.project_id
      WHERE p.owner_id IN (${ids.map(() => '?').join(', ')})
        AND f.status = 'submitted' AND f.deleted_at IS NULL
      GROUP BY p.owner_id`,
    ids,
  )
  for (const id of ids) out.set(id, REPUTATION.kappaFloor + REPUTATION.kappaRange) // no history: full weight
  for (const r of rows) {
    const received = num(r, 'received')
    const helpful = num(r, 'helpful')
    // Beta(2,2) prior, so a creator with three reviews is not read as certain.
    const pHelpful =
      (helpful + REPUTATION.helpfulPriorSuccess) / (received + REPUTATION.helpfulPriorTotal)
    const discrimination = 1 - Math.abs(2 * pHelpful - 1)
    out.set(str(r, 'creator_id'), REPUTATION.kappaFloor + REPUTATION.kappaRange * discrimination)
  }
  return out
}

/**
 * ρ(u,c) — reciprocity damping. One-way admiration is untouched; mutual
 * back-scratching collapses toward zero after two or three exchanges.
 *
 * Every arm names `status = 'submitted' AND deleted_at IS NULL`, which is what
 * lets the planner use the partial indexes on `feedback` (ix_feedback_reviewer,
 * ix_feedback_helpful_by_project). Without them "upvotes this user received"
 * walked every row of `feedback_votes` and the helpful arms scanned `feedback`:
 * 16 seconds for a reviewer with 162 reviews, on every visit to their
 * reputation tab. A deleted review is not evidence, so it is not an exchange
 * either.
 */
function loadReciprocity(userId: string, nowMs: number): Map<string, number> {
  const since = nowMs - REPUTATION.reciprocityWindowDays * DAY_MS

  const outbound = all<Row>(
    `SELECT counterparty, SUM(n) AS n FROM (
       -- helpful marks this user gave as a creator
       SELECT f.reviewer_id AS counterparty, COUNT(*) AS n
         FROM feedback f
         JOIN projects p ON p.id = f.project_id
        WHERE p.owner_id = ? AND f.creator_marked_helpful = 1 AND f.updated_at >= ?
          AND f.status = 'submitted' AND f.deleted_at IS NULL
        GROUP BY f.reviewer_id
       UNION ALL
       -- upvotes this user cast on other people's reviews
       SELECT f.reviewer_id AS counterparty, COUNT(*) AS n
         FROM feedback_votes fv
         JOIN feedback f ON f.id = fv.feedback_id
        WHERE fv.voter_id = ? AND fv.vote_value = 1 AND fv.created_at >= ?
          AND f.status = 'submitted' AND f.deleted_at IS NULL
        GROUP BY f.reviewer_id
     ) GROUP BY counterparty`,
    [userId, since, userId, since],
  )

  const inbound = all<Row>(
    `SELECT counterparty, SUM(n) AS n FROM (
       -- helpful marks this user received, credited to the creator who gave them
       SELECT p.owner_id AS counterparty, COUNT(*) AS n
         FROM feedback f
         JOIN projects p ON p.id = f.project_id
        WHERE f.reviewer_id = ? AND f.creator_marked_helpful = 1 AND f.updated_at >= ?
          AND f.status = 'submitted' AND f.deleted_at IS NULL
        GROUP BY p.owner_id
       UNION ALL
       -- upvotes this user received: from their own reviews outward, so the
       -- walk is their history and not the whole vote table
       SELECT fv.voter_id AS counterparty, COUNT(*) AS n
         FROM feedback f
         JOIN feedback_votes fv ON fv.feedback_id = f.id
        WHERE f.reviewer_id = ? AND fv.vote_value = 1 AND fv.created_at >= ?
          AND f.status = 'submitted' AND f.deleted_at IS NULL
        GROUP BY fv.voter_id
     ) GROUP BY counterparty`,
    [userId, since, userId, since],
  )

  const outMap = new Map<string, number>()
  for (const r of outbound) outMap.set(str(r, 'counterparty'), num(r, 'n'))
  const rho = new Map<string, number>()
  for (const r of inbound) {
    const other = str(r, 'counterparty')
    const mutual = Math.min(outMap.get(other) ?? 0, num(r, 'n'))
    rho.set(other, 1 / (1 + REPUTATION.reciprocityFactor * mutual))
  }
  return rho
}

/* ------------------------------------------------------------------------- *
 * The computation
 * ------------------------------------------------------------------------- */

export interface ComputeOptions {
  /** Pin the clock, so a page and its cursor agree about decay. */
  readonly at?: Millis
  /** Skip the memo when a caller has just written new evidence. */
  readonly fresh?: boolean
}

/**
 * `C_d(u)` per domain, plus the effective-count-weighted global score.
 *
 *   w_time = exp(−ln2 · age_days / 270)              nine-month half-life
 *   n_d    = Σ w_time·ω_d                            effective review count
 *   E_d    = Σ w_time·ω_d·v_r                        decayed evidence
 *   q̄_d    = E_d / (n_d + 8)                         Bayesian shrink toward 0
 *   V_d    = n_d / (n_d + 20)                        saturating volume
 *   C_d    = 1000·clamp01(0.65·norm(q̄_d) + 0.35·V_d)
 */
export function computeReputation(userId: string, opts: ComputeOptions = {}): ReputationComputation {
  const nowMs = opts.at ?? now()
  if (!opts.fresh) {
    const hit = memoGet(userId, nowMs)
    if (hit) return hit
  }

  const rows = perReviewValues(userId, nowMs)

  const byDomain = new Map<ProjectTypeSlug, { n: number; e: number; count: number }>()
  for (const r of rows) {
    const weight = r.timeWeight * r.domainWeight
    const acc = byDomain.get(r.domain) ?? { n: 0, e: 0, count: 0 }
    acc.n += weight
    acc.e += weight * r.value
    acc.count += 1
    byDomain.set(r.domain, acc)
  }

  const expertDomains = new Set<string>(
    all<Row>(
      `SELECT ea.slug AS slug FROM expert_expertise ee
         JOIN expertise_areas ea ON ea.id = ee.expertise_id
        WHERE ee.user_id = ? AND ee.is_verified = 1`,
      [userId],
    ).map((r) => str(r, 'slug')),
  )

  const domains: DomainCredibility[] = []
  let weightedScoreSum = 0
  let weightSum = 0

  for (const slug of PROJECT_TYPE_SLUGS) {
    const acc = byDomain.get(slug)
    if (!acc || acc.count === 0) continue
    const n = acc.n
    const meanValue = acc.e / (n + REPUTATION.shrinkK)
    const volumeTerm = n / (n + REPUTATION.volumeK)
    const normalized = clamp01((meanValue + REPUTATION.normOffset) / REPUTATION.normSpan)
    const score =
      REPUTATION.scoreMax *
      clamp01(REPUTATION.qualityShare * normalized + REPUTATION.volumeShare * volumeTerm)
    weightedScoreSum += n * score
    weightSum += n
    domains.push({
      domain: slug,
      label: PROJECT_TYPES[slug].label,
      effectiveReviews: round3(n),
      reviewCount: acc.count,
      evidence: round3(acc.e),
      // The profile prints both: the plain mean is what a reader can check
      // against the per-review table, the shrunk one is what the score used.
      rawMean: round3(n > 0 ? acc.e / n : 0),
      meanValue: round3(meanValue),
      volumeTerm: round3(volumeTerm),
      score: Math.round(score),
      tier: tierFor(score).key,
      // The numeric floors are necessary but never sufficient: expert status is
      // granted by panel, and the grant is what this flag reads.
      isExpert: expertDomains.has(slug) && score >= EXPERT_GATES.credibility,
    })
  }

  domains.sort((a, b) => b.score - a.score)

  // A generalist number must never hide behind one strong specialty, so the
  // global score is weighted by effective review count, not by best domain.
  const score = weightSum > 0 ? Math.round(weightedScoreSum / weightSum) : 0

  const previous = get<Row>(
    `SELECT total_score, computed_at FROM reputation_scores WHERE user_id = ?`,
    [userId],
  )
  // A stored total above the scale's ceiling was not written by this formula
  // (the bulk loader's additive tally reached 1,517) and cannot be a peak of it.
  const previousScore = Math.min(REPUTATION.scoreMax, num(previous, 'total_score'))
  const previousAt = numOrNull(previous, 'computed_at')
  const peakScore = Math.max(score, previousScore)
  const monthsSincePeak =
    peakScore > score && previousAt !== null
      ? Math.max(0, (nowMs - previousAt) / (DAY_MS * 30.44))
      : 0
  // Expertise does not vanish in a sabbatical: a former expert still shows
  // meaningful standing, marked inactive rather than silently collapsed.
  const floor =
    REPUTATION.peakFloorShare *
    peakScore *
    Math.exp((-LN2 * monthsSincePeak) / REPUTATION.peakHalfLifeMonths)
  const displayScore = Math.round(Math.max(score, floor))

  const totals = loadTotals(userId, rows)
  const tier = tierFor(displayScore)

  const result: ReputationComputation = {
    userId,
    computedAt: nowMs,
    score,
    displayScore,
    peakScore,
    monthsSincePeak: peakScore > score ? round3(monthsSincePeak) : null,
    tier: tier.key,
    tierLabel: tier.label,
    level: tier.level,
    domains,
    totals,
  }
  memoSet(userId, nowMs, result)
  return result
}

/**
 * `v_r` for every submitted review, with each factor kept separate so the
 * profile page can show the working instead of a number nobody can audit.
 *
 *   v_r = S_r·(1.0·κ(c)·ρ(u,c)·h_r + 1.8·κ(c)·a_r + 0.8·û_r)
 *         − 0.6·d_r − 4.0·m_r,     clamped to ±4
 */
export function perReviewValues(userId: string, at?: Millis): readonly ReviewValueBreakdown[] {
  const nowMs = at ?? now()
  const evidence = loadEvidence(userId, nowMs)
  if (evidence.length === 0) return []

  const kappa = loadKappa(evidence.map((e) => e.creatorId))
  const rho = loadReciprocity(userId, nowMs)
  const voteSaturation = Math.log1p(REPUTATION.voteSaturation)

  return evidence.map((e): ReviewValueBreakdown => {
    const k = kappa.get(e.creatorId) ?? REPUTATION.kappaFloor + REPUTATION.kappaRange
    const r = rho.get(e.creatorId) ?? 1

    // Money cannot buy the helpful mark: on a bounty-paid review the paying
    // creator's h_r is zeroed, and the work earns through adoption and peers.
    const helpful = e.paidByCreator ? 0 : e.helpful

    const netVotes = Math.max(0, e.voteTrustUp - e.voteTrustDown)
    const peerVotes = voteSaturation > 0 ? clamp01(Math.log1p(netVotes) / voteSaturation) : 0

    const positive =
      REPUTATION.weightHelpful * k * r * helpful +
      REPUTATION.weightAdoption * k * e.adoption +
      REPUTATION.weightPeerVotes * peerVotes

    const value = clampNum(
      e.specificity * positive -
        REPUTATION.weightNotApplicable * e.notApplicable -
        REPUTATION.weightModeration * e.moderation,
      -REPUTATION.valueClamp,
      REPUTATION.valueClamp,
    )

    const ageDays = Math.max(0, (nowMs - e.submittedAt) / DAY_MS)
    const timeWeight = Math.exp((-LN2 * ageDays) / REPUTATION.halfLifeDays)

    return {
      feedbackId: e.feedbackId,
      projectId: e.projectId,
      projectTitle: e.projectTitle,
      creatorId: e.creatorId,
      domain: e.domain,
      submittedAt: e.submittedAt,
      specificity: round3(e.specificity),
      helpful,
      adoption: round3(e.adoption),
      peerVotes: round3(peerVotes),
      notApplicable: e.notApplicable,
      moderation: e.moderation,
      kappa: round3(k),
      rho: round3(r),
      timeWeight: round3(timeWeight),
      // Cross-tag attribution needs a project to declare a second type; the
      // schema gives it exactly one, so the primary weight is the only one live.
      domainWeight: REPUTATION.domainPrimary,
      value: round3(value),
    }
  })
}

function loadTotals(
  userId: string,
  rows: readonly ReviewValueBreakdown[],
): ReputationComputation['totals'] {
  const agg = get<Row>(
    `SELECT
       COUNT(*)                              AS reviews,
       COALESCE(SUM(f.creator_marked_helpful), 0) AS helpful,
       COUNT(DISTINCT p.owner_id)            AS creators,
       COALESCE(SUM(f.helpful_count), 0)     AS peer_votes
     FROM feedback f
     JOIN projects p ON p.id = f.project_id
    WHERE f.reviewer_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL`,
    [userId],
  )

  const shipped = num(
    get<Row>(
      `SELECT COUNT(DISTINCT sg.id) AS n
         FROM suggestions sg
         JOIN suggestion_sources ss ON ss.suggestion_id = sg.id
         JOIN feedback_points fp    ON fp.id = ss.point_id
         JOIN feedback f            ON f.id = fp.feedback_id
        WHERE f.reviewer_id = ? AND sg.status = 'shipped'`,
      [userId],
    ),
    'n',
  )

  const strikes = num(
    get<Row>(
      `SELECT COUNT(*) AS n FROM moderation_actions
        WHERE subject_user_id = ? AND reverted_at IS NULL
          AND action NOT IN ('none', 'restore')`,
      [userId],
    ),
    'n',
  )

  // Herfindahl over creators: 1/k when work is spread across k creators evenly,
  // 1.0 when every review went to one patron. A farm cannot hide in this number.
  const perCreator = new Map<string, number>()
  const reviews = rows.length
  for (const r of rows) {
    perCreator.set(r.creatorId, (perCreator.get(r.creatorId) ?? 0) + 1)
  }
  let concentration = 0
  if (reviews > 0) {
    for (const count of perCreator.values()) {
      const share = count / reviews
      concentration += share * share
    }
  }

  const adopted = rows.filter((r) => r.adoption > 0).length
  const helpful = num(agg, 'helpful')
  const total = num(agg, 'reviews')

  return {
    reviews: total,
    helpful,
    adopted,
    shipped,
    peerVotes: num(agg, 'peer_votes'),
    strikes,
    helpfulRate: total > 0 ? round3(helpful / total) : 0,
    adoptionRate: total > 0 ? round3(adopted / total) : 0,
    distinctCreators: num(agg, 'creators'),
    creatorConcentration: round3(concentration),
  }
}

/* ------------------------------------------------------------------------- *
 * Creator-side reputation
 * ------------------------------------------------------------------------- *
 * Creators have reputation too, and it is made of exactly what reviewers care
 * about: do you answer, do you triage, do you ship. It feeds `Q_creator` in the
 * Discover formula, so a creator who extracts and never responds loses reach.
 */

export interface CreatorStanding {
  readonly score: number
  readonly replyRate: number
  readonly triageRate: number
  readonly shipRate: number
  readonly reviewsReceived: number
  readonly medianResponseMs: number | null
}

export function computeCreatorStanding(userId: string): CreatorStanding {
  const agg = get<Row>(
    `SELECT
       COUNT(*)                                                           AS received,
       SUM(CASE WHEN f.first_reply_at IS NOT NULL THEN 1 ELSE 0 END)      AS answered,
       SUM(CASE WHEN f.inbox_state <> 'new' THEN 1 ELSE 0 END)            AS triaged
     FROM feedback f
     JOIN projects p ON p.id = f.project_id
    WHERE p.owner_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL`,
    [userId],
  )
  const received = num(agg, 'received')
  const replyRate = received > 0 ? num(agg, 'answered') / received : 0
  const triageRate = received > 0 ? num(agg, 'triaged') / received : 0

  const ship = get<Row>(
    `SELECT
       SUM(CASE WHEN sg.status = 'shipped' THEN 1 ELSE 0 END) AS shipped,
       COUNT(*)                                               AS total
     FROM suggestions sg
     JOIN projects p ON p.id = sg.project_id
    WHERE p.owner_id = ? AND sg.status <> 'duplicate'`,
    [userId],
  )
  const suggestionTotal = num(ship, 'total')
  const shipRate = suggestionTotal > 0 ? num(ship, 'shipped') / suggestionTotal : 0

  // The same reviews `received` counts. Naming status and deleted_at is also
  // what lets ix_feedback_replied_by_project answer this; without them each of
  // the owner's projects scanned `feedback` whole (1.9s for one creator).
  const deltas = all<Row>(
    `SELECT (f.first_reply_at - f.submitted_at) AS ms
       FROM feedback f
       JOIN projects p ON p.id = f.project_id
      WHERE p.owner_id = ? AND f.first_reply_at IS NOT NULL AND f.submitted_at IS NOT NULL
        AND f.status = 'submitted' AND f.deleted_at IS NULL
      ORDER BY ms`,
    [userId],
  ).map((r) => num(r, 'ms'))

  const score = Math.round(1000 * clamp01(0.45 * replyRate + 0.25 * triageRate + 0.3 * shipRate))

  return {
    score,
    replyRate: round3(replyRate),
    triageRate: round3(triageRate),
    shipRate: round3(shipRate),
    reviewsReceived: received,
    medianResponseMs: median(deltas),
  }
}

/* ------------------------------------------------------------------------- *
 * Persistence
 * ------------------------------------------------------------------------- */

/** Reads the stored rollup. Every card and leaderboard reads this, not the ledger. */
export function getReputation(userId: string): ReputationScoreRow | undefined {
  return get<ReputationScoreRow>(`SELECT * FROM reputation_scores WHERE user_id = ?`, [userId])
}

/**
 * Recomputes from evidence and writes the rollup. Safe to run on a cadence, on
 * demand, or after a weighting change; nothing here depends on the previous
 * value except the peak floor.
 */
export function persistReputation(userId: string, at?: Millis): ReputationScoreRow {
  const nowMs = at ?? now()
  const rep = computeReputation(userId, { at: nowMs, fresh: true })
  const creator = computeCreatorStanding(userId)

  const community = num(
    get<Row>(
      `SELECT COALESCE(SUM(delta * weight * EXP(? * ((? - created_at) / CAST(? AS REAL)) / ?)), 0.0) AS points
         FROM reputation_events
        WHERE user_id = ? AND facet = 'community'`,
      [-LN2, nowMs, DAY_MS, REPUTATION.halfLifeDays, userId],
    ),
    'points',
  )
  // Saturating rather than linear: community standing should rise quickly from
  // nothing and then flatten, so it can never outweigh review evidence.
  const communityScore = Math.round(1000 * (Math.max(0, community) / (Math.max(0, community) + 300)))

  const expertScore = rep.domains.reduce((best, d) => (d.isExpert ? Math.max(best, d.score) : best), 0)

  const applied = rep.totals.shipped
  const ts = nowMs

  run(
    `INSERT INTO reputation_scores
       (user_id, reviewer_score, creator_score, community_score, expert_score, total_score,
        level, feedback_count, helpful_count, applied_count, helpful_rate, response_rate,
        median_response_ms, streak_days, computed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET
       reviewer_score     = excluded.reviewer_score,
       creator_score      = excluded.creator_score,
       community_score    = excluded.community_score,
       expert_score       = excluded.expert_score,
       total_score        = excluded.total_score,
       level              = excluded.level,
       feedback_count     = excluded.feedback_count,
       helpful_count      = excluded.helpful_count,
       applied_count      = excluded.applied_count,
       helpful_rate       = excluded.helpful_rate,
       response_rate      = excluded.response_rate,
       median_response_ms = excluded.median_response_ms,
       streak_days        = excluded.streak_days,
       computed_at        = excluded.computed_at`,
    [
      userId,
      rep.displayScore,
      creator.score,
      communityScore,
      expertScore,
      // The headline number on every card is the reviewer credibility with the
      // peak floor applied. Creator and community standing render beside it,
      // never folded into it.
      rep.displayScore,
      tierFor(rep.displayScore).level,
      rep.totals.reviews,
      rep.totals.helpful,
      applied,
      clamp01(rep.totals.helpfulRate),
      clamp01(creator.replyRate),
      creator.medianResponseMs,
      reviewStreakDays(userId, nowMs),
      ts,
    ],
  )

  // The memo directly, not `invalidateReputation`: that function's job is to
  // call this one, and the rollup it would ask for has just been written.
  memo.delete(userId)
  const stored = getReputation(userId)
  if (!stored) throw new Error('Reputation rollup vanished immediately after its own write')
  return stored
}

/** Consecutive days ending today on which this user submitted a review. */
export function reviewStreakDays(userId: string, at?: Millis): number {
  const nowMs = at ?? now()
  const days = all<Row>(
    `SELECT DISTINCT CAST(submitted_at / ? AS INTEGER) AS day
       FROM feedback
      WHERE reviewer_id = ? AND status = 'submitted' AND submitted_at IS NOT NULL
      ORDER BY day DESC
      LIMIT 400`,
    [DAY_MS, userId],
  ).map((r) => num(r, 'day'))

  const today = Math.floor(nowMs / DAY_MS)
  let streak = 0
  let expected = today
  for (const day of days) {
    if (day === expected) {
      streak += 1
      expected -= 1
    } else if (day === expected - 1 && streak === 0) {
      // Yesterday still counts as a live streak; today is not over yet.
      streak += 1
      expected = day - 1
    } else if (day < expected) {
      break
    }
  }
  return streak
}

/* ------------------------------------------------------------------------- *
 * The ledger
 * ------------------------------------------------------------------------- */

export interface ReputationEventInput {
  readonly userId: string
  readonly facet: ReputationFacet
  readonly kind: ReputationEventKind
  readonly delta: number
  readonly weight?: number
  readonly subjectType?: ReputationSubjectType | null
  readonly subjectId?: string | null
  readonly actorId?: string | null
  readonly note?: string | null
}

/**
 * Appends to the audit ledger. Idempotent on (user, kind, subject): replaying a
 * backfill or a retried webhook cannot double-credit. Returns null when the
 * event already existed or the delta was zero, since the schema refuses both.
 */
export function recordReputationEvent(input: ReputationEventInput): string | null {
  const delta = Math.trunc(input.delta)
  if (delta === 0) return null
  const id = uid()
  const r = run(
    `INSERT INTO reputation_events
       (id, user_id, facet, kind, delta, weight, subject_type, subject_id, actor_id, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     -- The predicate repeats the WHERE clause of ux_rep_events_dedup; without it
     -- SQLite will not match the partial index and rejects the statement.
     ON CONFLICT (user_id, kind, subject_type, subject_id)
       WHERE subject_id IS NOT NULL DO NOTHING`,
    [
      id,
      input.userId,
      input.facet,
      input.kind,
      delta,
      input.weight ?? 1.0,
      input.subjectType ?? null,
      input.subjectId ?? null,
      input.actorId ?? null,
      input.note ?? null,
      now(),
    ],
  )
  if (r.changes === 0) return null
  invalidateReputation(input.userId)
  return id
}

export interface ReputationLedgerEntry {
  readonly id: string
  readonly facet: ReputationFacet
  readonly kind: ReputationEventKind
  readonly delta: number
  readonly weight: number
  readonly note: string | null
  readonly subjectType: ReputationSubjectType | null
  readonly subjectId: string | null
  readonly createdAt: Millis
}

/** "Why did I lose 40 points?" answered from the ledger, newest first. */
export function listReputationEvents(userId: string, opts: PageOptions = {}): Page<ReputationLedgerEntry> {
  const limit = pageLimit(opts.limit, 30)
  const cursor = decodeCursor(opts.cursor)
  const at = cursor ? num(cursor, 'at') : null
  const rows = all<Row>(
    `SELECT id, facet, kind, delta, weight, note, subject_type, subject_id, created_at
       FROM reputation_events
      WHERE user_id = ? AND (? IS NULL OR created_at < ?)
      ORDER BY created_at DESC
      LIMIT ?`,
    [userId, at, at, limit + 1],
  )
  const entries = rows.map(
    (r): ReputationLedgerEntry => ({
      id: str(r, 'id'),
      facet: str(r, 'facet') as ReputationFacet,
      kind: str(r, 'kind') as ReputationEventKind,
      delta: num(r, 'delta'),
      weight: num(r, 'weight', 1),
      note: str(r, 'note') || null,
      subjectType: (str(r, 'subject_type') || null) as ReputationSubjectType | null,
      subjectId: str(r, 'subject_id') || null,
      createdAt: num(r, 'created_at'),
    }),
  )
  return toPage(entries, limit, (last) => encodeCursor({ at: last.createdAt }))
}

/* ------------------------------------------------------------------------- *
 * Rate cap, expert gates, leaderboard
 * ------------------------------------------------------------------------- */

/**
 * Volume grinding defence. Beyond the daily cap a review still posts and still
 * appears in the thread; it simply earns nothing.
 */
export function repBearingReviewsToday(userId: string, at?: Millis): number {
  const nowMs = at ?? now()
  const since = nowMs - DAY_MS
  return num(
    get<Row>(
      `SELECT COUNT(*) AS n FROM feedback
        WHERE reviewer_id = ? AND status = 'submitted'
          AND submitted_at >= ? AND COALESCE(quality_score, 0) >= 0.5`,
      [userId, since],
    ),
    'n',
  )
}

export function isRepBearing(userId: string, at?: Millis): boolean {
  return repBearingReviewsToday(userId, at) < REPUTATION.repBearingReviewsPerDay
}

/**
 * Every numeric gate on expert status in one domain, each reported with its
 * requirement and its actual value. The human confirmation gate is deliberately
 * not modelled here: no formula should own it.
 */
export function checkExpertGates(userId: string, domain: ProjectTypeSlug, at?: Millis): ExpertGateStatus {
  const nowMs = at ?? now()
  const rep = computeReputation(userId, { at: nowMs })
  const d = rep.domains.find((x) => x.domain === domain)
  const rows = perReviewValues(userId, nowMs).filter((r) => r.domain === domain)

  const recent = [...rows].sort((a, b) => b.submittedAt - a.submittedAt).slice(0, EXPERT_GATES.adoptionRateWindow)
  const adoptionSum = recent.reduce((s, r) => s + r.adoption, 0)
  const adoptionRate = adoptionSum / EXPERT_GATES.adoptionRateWindow

  const helpfulRate = rows.length > 0 ? rows.filter((r) => r.helpful > 0).length / rows.length : 0

  const creators = new Map<string, number>()
  for (const r of rows) creators.set(r.creatorId, (creators.get(r.creatorId) ?? 0) + 1)
  let herfindahl = 0
  if (rows.length > 0) {
    for (const c of creators.values()) herfindahl += (c / rows.length) ** 2
  }

  const strike = get<Row>(
    `SELECT 1 AS hit FROM moderation_actions
      WHERE subject_user_id = ? AND reverted_at IS NULL
        AND action NOT IN ('none', 'restore') AND created_at >= ?`,
    [userId, nowMs - EXPERT_GATES.cleanRecordDays * DAY_MS],
  )

  const gates = [
    {
      key: 'credibility',
      label: 'Sustained credibility',
      required: `≥ ${EXPERT_GATES.credibility}`,
      actual: String(d?.score ?? 0),
      passes: (d?.score ?? 0) >= EXPERT_GATES.credibility,
    },
    {
      key: 'volume',
      label: 'Effective reviews in this domain',
      required: `≥ ${EXPERT_GATES.effectiveReviews}`,
      actual: (d?.effectiveReviews ?? 0).toFixed(1),
      passes: (d?.effectiveReviews ?? 0) >= EXPERT_GATES.effectiveReviews,
    },
    {
      key: 'adoption',
      label: 'Adoption rate, last 40 reviews',
      required: `≥ ${(EXPERT_GATES.adoptionRate * 100).toFixed(0)}%`,
      actual: `${(adoptionRate * 100).toFixed(0)}%`,
      passes: adoptionRate >= EXPERT_GATES.adoptionRate,
    },
    {
      key: 'helpful',
      label: 'Helpful rate',
      required: `≥ ${(EXPERT_GATES.helpfulRate * 100).toFixed(0)}%`,
      actual: `${(helpfulRate * 100).toFixed(0)}%`,
      passes: helpfulRate >= EXPERT_GATES.helpfulRate,
    },
    {
      key: 'breadth',
      label: 'Distinct creators',
      required: `≥ ${EXPERT_GATES.distinctCreators}`,
      actual: String(creators.size),
      passes: creators.size >= EXPERT_GATES.distinctCreators,
    },
    {
      key: 'concentration',
      label: 'Creator concentration',
      required: `≤ ${EXPERT_GATES.creatorConcentration}`,
      actual: herfindahl.toFixed(2),
      passes: rows.length > 0 && herfindahl <= EXPERT_GATES.creatorConcentration,
    },
    {
      key: 'record',
      label: 'Clean record, 180 days',
      required: 'No strikes',
      actual: strike ? 'One or more strikes' : 'No strikes',
      passes: strike === undefined,
    },
  ]

  return { domain, passes: gates.every((g) => g.passes), gates }
}

/** Per-domain bars for a profile card, without the rest of the computation. */
export function domainsForUser(userId: string): readonly DomainCredibility[] {
  return computeReputation(userId).domains
}

export interface LeaderboardEntry {
  readonly user: UserCard
  readonly score: number
  readonly reviews: number
  readonly helpfulRate: number
  readonly rank: number
}

export function listLeaderboard(
  opts: PageOptions & { readonly facet?: ReputationFacet } = {},
): Page<LeaderboardEntry> {
  const limit = pageLimit(opts.limit, 25)
  const cursor = decodeCursor(opts.cursor)
  // A whitelist, not a caller-supplied column name: this is the one place an
  // identifier varies, and it can only ever be one of these four strings.
  const column =
    opts.facet === 'creator'
      ? 'creator_score'
      : opts.facet === 'community'
        ? 'community_score'
        : opts.facet === 'expert'
          ? 'expert_score'
          : 'reviewer_score'
  const offset = cursor ? num(cursor, 'o') : 0

  const rows = all<Row>(
    `SELECT ${userCardSelect('u', 'pr', 'rs', 'u')},
            rs.${column} AS facet_score, rs.feedback_count, rs.helpful_rate
       FROM reputation_scores rs
       JOIN users u ON u.id = rs.user_id
       LEFT JOIN profiles pr ON pr.user_id = u.id
      WHERE u.deleted_at IS NULL AND u.status = 'active' AND rs.${column} > 0
      ORDER BY rs.${column} DESC, u.id
      LIMIT ? OFFSET ?`,
    [limit + 1, offset],
  )

  const entries = rows.map(
    (r, i): LeaderboardEntry => ({
      user: mapUserCard(r, 'u'),
      score: num(r, 'facet_score'),
      reviews: num(r, 'feedback_count'),
      helpfulRate: num(r, 'helpful_rate'),
      rank: offset + i + 1,
    }),
  )
  return toPage(entries, limit, () => encodeCursor({ o: offset + limit }))
}

/* ------------------------------------------------------------------------- *
 * Local helpers
 * ------------------------------------------------------------------------- */

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}

function median(sorted: readonly number[]): number | null {
  if (sorted.length === 0) return null
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 1) return sorted[mid] ?? null
  const a = sorted[mid - 1]
  const b = sorted[mid]
  if (a === undefined || b === undefined) return null
  return Math.round((a + b) / 2)
}
