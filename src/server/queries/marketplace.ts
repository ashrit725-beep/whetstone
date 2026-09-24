/**
 * Marketplace reads the repository layer does not provide: facet counts for the
 * reviewer and bounty filter rails, and the reviewer-matching rank.
 *
 * Matching is deliberately legible. Every term below is a number the reader can
 * check against a row, and the surface prints the terms beside the result, so
 * "good match" is an argument rather than an assertion.
 */

import { all, get } from '@/server/db/client'
import { bool, num, str, type Row } from '@/server/repos/_shared'
import { domainsForUser } from '@/server/repos/reputation'
import { getUserCard } from '@/server/repos/profiles'
import { ensureInviteeColumn, listableBy } from '@/server/repos/bounties'
import type { BountyStatus, ProjectTypeSlug, UserCard } from '@/lib/types'
import { EXPERTISE_AREAS, PROJECT_TYPE_SLUGS, gritValue, stageLabel } from '@/lib/taxonomy'

/* ------------------------------------------------------------------ facets -- */

export interface ExpertFacet {
  readonly slug: string
  readonly label: string
  readonly count: number
}

/**
 * Listed experts per expertise area, counting only areas that were verified:
 * the list is filtered the same way, so a chip's count is the length of the
 * list it opens. The price and turnaround filters narrow the counts too, for
 * the same reason. Zero-count areas are dropped, not padded.
 */
export function expertFacets(
  filters: { readonly maxBudgetCents?: number | null; readonly maxTurnaroundHours?: number | null } = {},
): readonly ExpertFacet[] {
  const budget = filters.maxBudgetCents ?? null
  const hours = filters.maxTurnaroundHours ?? null
  const rows = all<Row>(
    `SELECT ea.slug, ea.label, COUNT(DISTINCT ee.user_id) AS n
       FROM expertise_areas ea
       JOIN expert_expertise ee ON ee.expertise_id = ea.id AND ee.is_verified = 1
       JOIN expert_profiles ep ON ep.user_id = ee.user_id AND ep.is_listed = 1
       JOIN users u ON u.id = ee.user_id AND u.deleted_at IS NULL AND u.status = 'active'
       LEFT JOIN profiles pr ON pr.user_id = ee.user_id
      WHERE COALESCE(pr.is_searchable, 1) = 1
        AND (? IS NULL OR ep.min_bounty_cents IS NULL OR ep.min_bounty_cents <= ?)
        AND (? IS NULL OR ep.turnaround_hours IS NULL OR ep.turnaround_hours <= ?)
      GROUP BY ea.id
      HAVING n > 0
      ORDER BY n DESC, ea.label`,
    [budget, budget, hours, hours],
  )
  return rows.map((r) => ({ slug: str(r, 'slug'), label: str(r, 'label'), count: num(r, 'n') }))
}

/**
 * Bounties per expertise area, over the bounties the state and amount filters
 * already allow and with the same visibility rule as the list, for the same
 * reader. A bounty's area is the one its creator set, which is a different
 * question from which areas listed reviewers are verified in, so the bounty
 * rail is counted here rather than borrowed from the reviewer rail.
 */
export function bountyAreaFacets(filters: {
  readonly status: BountyStatus
  readonly minAmountCents: number | null
  readonly viewerId: string | null
}): readonly ExpertFacet[] {
  ensureInviteeColumn()
  const listable = listableBy(filters.viewerId)
  const rows = all<Row>(
    `SELECT ea.slug, ea.label, COUNT(*) AS n
       FROM bounties b
       JOIN projects p ON p.id = b.project_id AND p.deleted_at IS NULL
       JOIN expertise_areas ea ON ea.id = b.expertise_id
      WHERE b.status = ? AND ${listable.sql}
        AND (? IS NULL OR b.amount_cents >= ?)
      GROUP BY ea.id
      ORDER BY n DESC, ea.label`,
    [filters.status, ...listable.params, filters.minAmountCents, filters.minAmountCents],
  )
  return rows.map((r) => ({ slug: str(r, 'slug'), label: str(r, 'label'), count: num(r, 'n') }))
}

/** Price floors across the listed market, so a budget filter offers real bands. */
export function listedPriceBand(): { readonly low: number; readonly high: number } | null {
  const row = get<Row>(
    `SELECT MIN(min_bounty_cents) AS lo, MAX(min_bounty_cents) AS hi
       FROM expert_profiles ep
       JOIN users u ON u.id = ep.user_id AND u.deleted_at IS NULL AND u.status = 'active'
      WHERE ep.is_listed = 1 AND ep.min_bounty_cents IS NOT NULL`,
  )
  if (!row || row['lo'] === null) return null
  return { low: num(row, 'lo'), high: num(row, 'hi') }
}

/** Expertise areas as the bounty form's optional picker sees them. */
export function expertiseOptions(): readonly { value: string; label: string }[] {
  return all<Row>(
    `SELECT id, label FROM expertise_areas WHERE is_active = 1 ORDER BY label`,
  ).map((r) => ({ value: str(r, 'id'), label: str(r, 'label') }))
}

/* ------------------------------------------------------------- the matching -- */

/**
 * Which expertise areas a project of each type is actually asking about. The
 * marketplace has twenty areas and ten project types; without this map a
 * hardware project matches a copy editor on a tie-break.
 */
const AREAS_BY_TYPE: Record<ProjectTypeSlug, readonly string[]> = {
  game: ['game-design', 'level-design', 'game-feel'],
  web_app: ['product-design', 'frontend-engineering', 'accessibility', 'ux-research'],
  mobile_app: ['product-design', 'accessibility', 'frontend-engineering', 'ux-research'],
  website: ['product-design', 'brand-design', 'growth-marketing', 'accessibility'],
  video: ['video-editing', 'motion-design', 'writing-editing'],
  business_idea: ['pricing-strategy', 'growth-marketing', 'fundraising'],
  hardware: ['hardware-engineering', 'industrial-design'],
  design: ['product-design', 'brand-design', 'motion-design'],
  writing: ['writing-editing', 'technical-writing'],
  api_tool: ['api-design', 'backend-engineering', 'technical-writing', 'security'],
}

const LEVEL_WEIGHT: Record<string, number> = {
  specialist: 1,
  practitioner: 0.6,
  familiar: 0.3,
}

export function areasForType(typeSlug: string): readonly { slug: string; label: string }[] {
  const slugs = isTypeSlug(typeSlug) ? AREAS_BY_TYPE[typeSlug] : []
  return slugs.flatMap((slug) => {
    const area = EXPERTISE_AREAS.find((a) => a.slug === slug)
    return area ? [{ slug: area.slug, label: area.label }] : []
  })
}

function isTypeSlug(value: string): value is ProjectTypeSlug {
  return (PROJECT_TYPE_SLUGS as readonly string[]).includes(value)
}

export interface MatchedArea {
  readonly slug: string
  readonly label: string
  readonly level: 'familiar' | 'practitioner' | 'specialist'
  readonly isVerified: boolean
}

export interface ReviewerMatch {
  readonly user: UserCard
  readonly headline: string
  readonly minBountyCents: number | null
  readonly currency: string
  readonly turnaroundHours: number | null
  readonly capacityPerWeek: number
  readonly availability: 'open' | 'limited' | 'closed'
  /** 0–1, and the three terms it is made of, so the rank can be argued with. */
  readonly score: number
  readonly overlap: number
  readonly domainScore: number
  readonly helpfulRate: number
  readonly matchedAreas: readonly MatchedArea[]
  /** Reviews this person has written on projects of this type. */
  readonly reviewsInType: number
  /** Creator helpful marks, and how many reviews could have earned one. */
  readonly helpful: { readonly marked: number; readonly of: number }
}

export interface MatchTarget {
  readonly projectId: string
  readonly title: string
  readonly slug: string
  readonly typeSlug: string
  readonly typeLabel: string
  readonly stageLabel: string
  readonly grit: number
  readonly ownerId: string
}

/** Resolves a project slug for the marketplace's "matches for" mode. */
export function matchTargetBySlug(slug: string, ownerId?: string | null): MatchTarget | undefined {
  const row = get<Row>(
    `SELECT p.id, p.slug, p.title, p.stage_key, p.owner_id, pt.slug AS type_slug, pt.label AS type_label
       FROM projects p
       JOIN project_types pt ON pt.id = p.project_type_id
      WHERE p.slug = ? AND p.deleted_at IS NULL
        AND (? IS NULL OR p.owner_id = ?)
        AND (p.visibility = 'public' OR p.owner_id = ?)
      ORDER BY p.published_at DESC
      LIMIT 1`,
    [slug, ownerId ?? null, ownerId ?? null, ownerId ?? ''],
  )
  if (!row) return undefined
  const typeSlug = str(row, 'type_slug')
  const stageKey = str(row, 'stage_key')
  return {
    projectId: str(row, 'id'),
    slug: str(row, 'slug'),
    title: str(row, 'title'),
    typeSlug,
    typeLabel: str(row, 'type_label'),
    stageLabel: stageLabel(typeSlug, stageKey),
    grit: gritValue(stageKey),
    ownerId: str(row, 'owner_id'),
  }
}

export function matchTargetById(projectId: string): MatchTarget | undefined {
  const row = get<Row>(
    `SELECT p.id, p.slug, p.title, p.stage_key, p.owner_id, pt.slug AS type_slug, pt.label AS type_label
       FROM projects p
       JOIN project_types pt ON pt.id = p.project_type_id
      WHERE p.id = ? AND p.deleted_at IS NULL`,
    [projectId],
  )
  if (!row) return undefined
  const typeSlug = str(row, 'type_slug')
  const stageKey = str(row, 'stage_key')
  return {
    projectId: str(row, 'id'),
    slug: str(row, 'slug'),
    title: str(row, 'title'),
    typeSlug,
    typeLabel: str(row, 'type_label'),
    stageLabel: stageLabel(typeSlug, stageKey),
    grit: gritValue(stageKey),
    ownerId: str(row, 'owner_id'),
  }
}

/**
 * Ranks listed reviewers against one project.
 *
 * `score = 0.45·overlap + 0.35·domain + 0.20·helpful`, halved when the reviewer
 * has closed their books. `overlap` is declared expertise against the areas this
 * project type is about, weighted by level and by whether the area itself was
 * verified. `domain` is the credibility this person earned reviewing projects of
 * this exact type, from `reputation.ts`. `helpful` is the share of their reviews
 * a creator marked helpful. Nothing is invented and nothing is averaged across
 * an ordinal scale.
 *
 * `domain` is the one expensive term: it replays every review the person wrote.
 * The other two are known first, so each candidate has a ceiling (its score with
 * full credibility), and candidates are scored in order of that ceiling until
 * the next one cannot reach the last place taken. The result is the ranking
 * that scoring everyone gives, without replaying thirty reviewers' histories.
 */
export function rankReviewersForProject(
  target: MatchTarget,
  opts: { readonly limit?: number; readonly excludeUserIds?: readonly string[] } = {},
): readonly ReviewerMatch[] {
  const limit = opts.limit ?? 5
  const exclude = new Set([target.ownerId, ...(opts.excludeUserIds ?? [])])
  const wanted = new Set(areasForType(target.typeSlug).map((a) => a.slug))

  const rows = all<Row>(
    `SELECT ep.user_id, ep.headline, ep.min_bounty_cents, ep.currency,
            ep.turnaround_hours, ep.capacity_per_week,
            COALESCE(pr.availability, 'open') AS availability,
            COALESCE(rs.feedback_count, 0) AS feedback_count,
            COALESCE(rs.helpful_count, 0) AS helpful_count
       FROM expert_profiles ep
       JOIN users u ON u.id = ep.user_id
       LEFT JOIN profiles pr ON pr.user_id = ep.user_id
       LEFT JOIN reputation_scores rs ON rs.user_id = ep.user_id
      WHERE ep.is_listed = 1 AND u.deleted_at IS NULL AND u.status = 'active'
        AND COALESCE(pr.is_searchable, 1) = 1`,
  )

  // The cheap terms for everyone whose declared areas touch this project type.
  const candidates = rows.flatMap((row) => {
    const userId = str(row, 'user_id')
    if (exclude.has(userId)) return []

    const areas = all<Row>(
      `SELECT ea.slug, ea.label, ee.level, ee.is_verified
         FROM expert_expertise ee
         JOIN expertise_areas ea ON ea.id = ee.expertise_id
        WHERE ee.user_id = ?`,
      [userId],
    )

    const matchedAreas: MatchedArea[] = []
    let overlapRaw = 0
    for (const area of areas) {
      const slug = str(area, 'slug')
      if (!wanted.has(slug)) continue
      const level = (str(area, 'level') || 'practitioner') as MatchedArea['level']
      const isVerified = bool(area, 'is_verified')
      const weight = Math.min(1, (LEVEL_WEIGHT[level] ?? 0.3) + (isVerified ? 0.2 : 0))
      overlapRaw += weight
      matchedAreas.push({ slug, label: str(area, 'label'), level, isVerified })
    }
    if (matchedAreas.length === 0) return []

    const overlap = Math.min(1, overlapRaw / Math.max(1, Math.min(wanted.size, 2)))
    const of = num(row, 'feedback_count')
    const marked = num(row, 'helpful_count')
    const helpfulRate = of > 0 ? marked / of : 0
    const availability = (str(row, 'availability') || 'open') as ReviewerMatch['availability']
    const capacityPerWeek = num(row, 'capacity_per_week')
    const factor = availability !== 'closed' && capacityPerWeek > 0 ? 1 : 0.5

    return [
      {
        userId,
        row,
        matchedAreas,
        overlap,
        helpfulRate,
        helpful: { marked, of },
        availability,
        capacityPerWeek,
        factor,
        ceiling: (0.45 * overlap + 0.35 + 0.2 * helpfulRate) * factor,
      },
    ]
  })
  candidates.sort((a, b) => b.ceiling - a.ceiling)

  const byRank = (a: ReviewerMatch, b: ReviewerMatch): number =>
    b.score - a.score || a.user.handle.localeCompare(b.user.handle)
  const matches: ReviewerMatch[] = []

  for (const candidate of candidates) {
    // Strictly below: a candidate that can only tie the last place might still
    // take it on the handle, so it is scored.
    const last = matches.length >= limit ? matches[limit - 1] : undefined
    if (last && candidate.ceiling < last.score) break

    const user = getUserCard(candidate.userId)
    if (!user) continue

    const domain = domainsForUser(candidate.userId).find((d) => d.domain === target.typeSlug)
    const domainScore = domain ? domain.score / 1000 : 0
    const row = candidate.row

    matches.push({
      user,
      headline: str(row, 'headline'),
      minBountyCents: row['min_bounty_cents'] === null ? null : num(row, 'min_bounty_cents'),
      currency: str(row, 'currency', 'USD'),
      turnaroundHours: row['turnaround_hours'] === null ? null : num(row, 'turnaround_hours'),
      capacityPerWeek: candidate.capacityPerWeek,
      availability: candidate.availability,
      score: (0.45 * candidate.overlap + 0.35 * domainScore + 0.2 * candidate.helpfulRate) * candidate.factor,
      overlap: candidate.overlap,
      domainScore,
      helpfulRate: candidate.helpfulRate,
      matchedAreas: candidate.matchedAreas,
      reviewsInType: domain ? domain.reviewCount : 0,
      helpful: candidate.helpful,
    })
    matches.sort(byRank)
  }

  return matches.slice(0, limit)
}

/* ------------------------------------------------ projects a viewer can post -- */

export interface OwnedProjectOption {
  readonly id: string
  readonly slug: string
  readonly title: string
  readonly typeLabel: string
  readonly stageLabel: string
  readonly grit: number
}

/** The creator's own projects, for the bounty form's project picker. */
export function ownedProjectOptions(userId: string): readonly OwnedProjectOption[] {
  return all<Row>(
    `SELECT p.id, p.slug, p.title, p.stage_key, pt.slug AS type_slug, pt.label AS type_label
       FROM projects p
       JOIN project_types pt ON pt.id = p.project_type_id
      WHERE p.owner_id = ? AND p.deleted_at IS NULL AND p.status = 'published'
      ORDER BY p.published_at DESC`,
    [userId],
  ).map((r) => {
    const typeSlug = str(r, 'type_slug')
    const stageKey = str(r, 'stage_key')
    return {
      id: str(r, 'id'),
      slug: str(r, 'slug'),
      title: str(r, 'title'),
      typeLabel: str(r, 'type_label'),
      stageLabel: stageLabel(typeSlug, stageKey),
      grit: gritValue(stageKey),
    }
  })
}
