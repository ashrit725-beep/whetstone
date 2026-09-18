/**
 * Reads the public-profile surface needs and the repository layer does not
 * already provide. Nothing here writes; the repositories own every mutation.
 *
 * Why this file exists: `listProjectsByUser` deliberately widens to drafts and
 * private rows when it is given an `ownerId`, because it is also the owner's
 * own shelf. A public profile must not leak either, so the public list is
 * resolved to explicit ids first and handed back to `listProjects`, which then
 * takes its normal `visibility = 'public'` path.
 */

import { all, get } from '@/server/db/client'
import { num, str, type Row } from '@/server/repos/_shared'
import { GRIT_STAGES, type GritStageKey } from '@/lib/taxonomy'

export type GritCounts = Partial<Record<120 | 400 | 1000 | 3000 | 8000, number>>

/** Ids of a person's published, public projects, newest first. */
export function publicProjectIdsFor(userId: string): readonly string[] {
  return all<Row>(
    `SELECT id FROM projects
      WHERE owner_id = ? AND deleted_at IS NULL
        AND status = 'published' AND visibility = 'public'
      ORDER BY published_at DESC`,
    [userId],
  ).map((r) => str(r, 'id'))
}

/**
 * How many of this person's public projects have reached each grit step. The
 * profile header's organising element, so it is counted from rows rather than
 * derived from a score.
 */
export function gritHistoryFor(userId: string): GritCounts {
  const rows = all<Row>(
    `SELECT stage_key, COUNT(*) AS n FROM projects
      WHERE owner_id = ? AND deleted_at IS NULL
        AND status = 'published' AND visibility = 'public'
      GROUP BY stage_key`,
    [userId],
  )
  const counts: GritCounts = {}
  for (const row of rows) {
    const key = str(row, 'stage_key') as GritStageKey
    const stage = GRIT_STAGES.find((s) => s.key === key)
    if (!stage) continue
    counts[stage.grit] = num(row, 'n')
  }
  return counts
}

/**
 * Feedback other people have written on this person's public projects. The
 * reputation sentence needs the number a creator actually cares about, which is
 * what came back, not what they wrote.
 */
export function feedbackReceivedFor(userId: string): number {
  const row = get<Row>(
    `SELECT COUNT(*) AS n
       FROM feedback f
       JOIN projects p ON p.id = f.project_id
      WHERE p.owner_id = ? AND p.deleted_at IS NULL
        AND p.status = 'published' AND p.visibility = 'public'
        AND f.status = 'submitted' AND f.deleted_at IS NULL
        AND f.reviewer_id <> ?`,
    [userId, userId],
  )
  return num(row, 'n')
}

export interface ReviewerDepth {
  /** Reviews this person submitted, counted from rows. */
  readonly reviews: number
  /** The middle grit step of everything they reviewed. Null under one review. */
  readonly medianGrit: number | null
  readonly medianStageLabel: string | null
  /** The grit steps they have actually worked at, lowest and highest. */
  readonly range: { readonly low: number; readonly high: number } | null
  /** Feedback categories they write in most, with counts. */
  readonly categories: readonly { readonly label: string; readonly count: number }[]
  /** Every project type they have reviewed, with counts, most reviewed first. */
  readonly types: readonly { readonly label: string; readonly count: number }[]
  /** Blocker-severity points they have filed. */
  readonly blockers: number
  /** Reviews the creator marked helpful, and the total that could be marked. */
  readonly helpful: { readonly marked: number; readonly of: number }
}

const EMPTY_DEPTH: ReviewerDepth = {
  reviews: 0,
  medianGrit: null,
  medianStageLabel: null,
  range: null,
  categories: [],
  types: [],
  blockers: 0,
  helpful: { marked: 0, of: 0 },
}

/**
 * What a reviewer has actually worked on, which is the left column of the rate
 * card. Median rather than mean: grit is an ordinal scale and averaging it
 * produces a number nobody chose.
 */
export function reviewerDepth(userId: string): ReviewerDepth {
  const stageRows = all<Row>(
    `SELECT p.stage_key, COUNT(*) AS n
       FROM feedback f
       JOIN projects p ON p.id = f.project_id
      WHERE f.reviewer_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
      GROUP BY p.stage_key`,
    [userId],
  )

  let total = 0
  const perGrit = new Map<number, number>()
  for (const row of stageRows) {
    const stage = GRIT_STAGES.find((s) => s.key === str(row, 'stage_key'))
    if (!stage) continue
    const n = num(row, 'n')
    total += n
    perGrit.set(stage.grit, (perGrit.get(stage.grit) ?? 0) + n)
  }
  if (total === 0) return EMPTY_DEPTH

  const ordered = GRIT_STAGES.filter((s) => (perGrit.get(s.grit) ?? 0) > 0)
  const first = ordered[0]
  const last = ordered[ordered.length - 1]

  // Weighted median, snapped to a real step. Never interpolated.
  const half = total / 2
  let running = 0
  let medianGrit: number | null = null
  let medianLabel: string | null = null
  for (const stage of GRIT_STAGES) {
    running += perGrit.get(stage.grit) ?? 0
    if (running >= half) {
      medianGrit = stage.grit
      medianLabel = stage.label
      break
    }
  }

  const categories = all<Row>(
    `SELECT fc.label, COUNT(*) AS n
       FROM feedback_points fp
       JOIN feedback f ON f.id = fp.feedback_id
       JOIN feedback_categories fc ON fc.id = fp.category_id
      WHERE f.reviewer_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
      GROUP BY fc.label
      ORDER BY n DESC, fc.label
      LIMIT 5`,
    [userId],
  ).map((r) => ({ label: str(r, 'label'), count: num(r, 'n') }))

  // Every type, not the top four. There are ten at most, and a cap silently
  // dropped the rest: a reviewer whose headline was "apps and games" showed
  // four types and seven of eleven reviews, with Game cut on an alphabetical
  // tie. Ties now go to the type reviewed most recently.
  const types = all<Row>(
    `SELECT pt.label, COUNT(*) AS n
       FROM feedback f
       JOIN projects p ON p.id = f.project_id
       JOIN project_types pt ON pt.id = p.project_type_id
      WHERE f.reviewer_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
      GROUP BY pt.label
      ORDER BY n DESC, MAX(f.submitted_at) DESC, pt.label`,
    [userId],
  ).map((r) => ({ label: str(r, 'label'), count: num(r, 'n') }))

  const marks = get<Row>(
    `SELECT COUNT(*) AS of,
            COALESCE(SUM(CASE WHEN f.creator_marked_helpful = 1 THEN 1 ELSE 0 END), 0) AS marked,
            COALESCE(SUM(f.blocker_count), 0) AS blockers
       FROM feedback f
      WHERE f.reviewer_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL`,
    [userId],
  )

  return {
    reviews: total,
    medianGrit,
    medianStageLabel: medianLabel,
    range: first && last ? { low: first.grit, high: last.grit } : null,
    categories,
    types,
    blockers: num(marks, 'blockers'),
    helpful: { marked: num(marks, 'marked'), of: num(marks, 'of') },
  }
}

export interface VerifiedCredential {
  readonly id: string
  /** What the credential asserts, in the schema's own words. */
  readonly credential: 'domain_expert' | 'shipped_titles' | 'employer' | string
  readonly expertiseLabel: string | null
  readonly issuedAt: number
  readonly expiresAt: number | null
}

/**
 * What was actually verified about this person, so the badge can say it.
 * A generic checkmark asserts nothing a reader can check.
 */
export function verifiedCredentialsFor(userId: string): readonly VerifiedCredential[] {
  return all<Row>(
    `SELECT vc.id, vc.credential, vc.issued_at, vc.expires_at, ea.label AS expertise_label
       FROM verification_credentials vc
       LEFT JOIN expertise_areas ea ON ea.id = vc.expertise_id
      WHERE vc.user_id = ? AND vc.revoked_at IS NULL
      ORDER BY vc.issued_at DESC`,
    [userId],
  ).map((r) => ({
    id: str(r, 'id'),
    credential: str(r, 'credential'),
    expertiseLabel: str(r, 'expertise_label') || null,
    issuedAt: num(r, 'issued_at'),
    expiresAt: r['expires_at'] === null ? null : num(r, 'expires_at'),
  }))
}

/** Plain words for what each credential actually proves. */
export const CREDENTIAL_WORDING: Record<string, string> = {
  domain_expert: 'Domain work reviewed by two existing experts',
  shipped_titles: 'Shipped work checked against a public credit',
  employer: 'Current employer confirmed by work email',
}

export function credentialWording(credential: string): string {
  return CREDENTIAL_WORDING[credential] ?? 'Checked by a moderator'
}
