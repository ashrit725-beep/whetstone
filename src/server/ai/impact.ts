import './guard'
import { saturate } from './text'
import { SEVERITY_WEIGHT, REVIEWER_CREDIBILITY } from './types'
import type { FeedbackInput, ReviewerTier, Severity } from './types'

/**
 * The impact formula, used by both paths.
 *
 * This is the piece that makes switching a key on non-disruptive. The model is
 * given this rubric in its prompt and returns the same 0 to 100 integer the
 * TypeScript below computes, so a creator who configures a provider sees better
 * grouping and better prose, not a dashboard where every number moved.
 *
 *   impact = 45% reach + 35% severity + 20% reviewer credibility
 *
 * Reach saturates rather than scaling linearly: the difference between two
 * reporters and six is large, the difference between forty and forty-four is
 * not, and a linear term would let one popular theme flatten everything else.
 */

const REACH_HALFWAY = 4

export type ImpactInputs = {
  distinctReviewers: number
  /** Mean severity weight across the members, 0 to 1. */
  meanSeverityWeight: number
  /** Mean reviewer credibility across the members, 0 to 1. */
  reviewerCredibility: number
}

export function impactScore(inputs: ImpactInputs): number {
  const reach = saturate(inputs.distinctReviewers, REACH_HALFWAY)
  const raw =
    0.45 * reach + 0.35 * clamp01(inputs.meanSeverityWeight) + 0.2 * clamp01(inputs.reviewerCredibility)
  return Math.round(clamp01(raw) * 100)
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.min(1, Math.max(0, n))
}

/** Impact plus the inputs it used, so the UI can show the working. */
export type ImpactReading = ImpactInputs & {
  score: number
  meanSeverity: Severity
  reason: string
}

export function impactOf(members: readonly FeedbackInput[]): ImpactReading {
  const reviewers = new Set<string>()
  let severityTotal = 0
  let credibilityTotal = 0
  for (const item of members) {
    reviewers.add(item.reviewerId)
    severityTotal += SEVERITY_WEIGHT[item.severity]
    credibilityTotal += REVIEWER_CREDIBILITY[item.reviewerTier ?? 'established']
  }
  const n = Math.max(1, members.length)
  const meanSeverityWeight = severityTotal / n
  const reviewerCredibility = credibilityTotal / n
  const inputs: ImpactInputs = {
    distinctReviewers: reviewers.size,
    meanSeverityWeight,
    reviewerCredibility,
  }
  const meanSeverity = severityLabelFor(meanSeverityWeight)
  return {
    ...inputs,
    score: impactScore(inputs),
    meanSeverity,
    reason: `${reviewers.size} ${reviewers.size === 1 ? 'reviewer' : 'reviewers'}, mean severity ${meanSeverity}`,
  }
}

/** Maps a mean weight back onto the rung it sits closest to. */
export function severityLabelFor(weight: number): Severity {
  if (weight >= 0.88) return 'blocker'
  if (weight >= 0.6) return 'major'
  if (weight >= 0.33) return 'minor'
  if (weight > 0.05) return 'nit'
  return 'praise'
}

export function credibilityOf(tier: ReviewerTier | undefined): number {
  return REVIEWER_CREDIBILITY[tier ?? 'established']
}
