import './guard'

/**
 * The one contract every AI feature obeys.
 *
 * `data` is always present. A feature never throws, never returns null, and
 * never asks the caller to branch on whether a provider is configured.
 * Degradation lives inside the feature module; the UI reads `source` only to
 * pick an honest provenance label.
 */
export type AiSource = 'ai' | 'cached' | 'heuristic'

export type DegradeReason =
  | 'no_key'
  | 'provider_down'
  | 'timeout'
  | 'rate_limited'
  | 'budget_exhausted'
  | 'schema_invalid'
  | 'breaker_open'
  | 'disabled_by_user'
  | 'gated'

export type AiResult<T> = {
  /** Always populated. Heuristic output is real output, not a placeholder. */
  data: T
  source: AiSource
  /** Present only when `source === 'ai'`, or when a cached row came from a model. */
  model?: string
  /** Wall-clock cost of producing this result, in milliseconds. */
  ms: number
  /** ISO-8601. When a cached artifact is served this is the original generation time. */
  generatedAt: string
  /** Why the model path was not taken. Absent when `source === 'ai'`. */
  degraded?: DegradeReason
  /** A last-good artifact served while newer input waits on a background run. */
  stale?: { newItemsSince: number }
}

/** Model tiers, mapped per provider in `provider.ts`. */
export type Tier = 'reason' | 'work' | 'fast'

export type ProviderId = 'anthropic' | 'openai' | 'kimi'

export type FeatureKey = 'themes' | 'coach' | 'intake' | 'triage' | 'dedupe' | 'digest'

export const FEATURE_KEYS: readonly FeatureKey[] = [
  'themes',
  'coach',
  'intake',
  'triage',
  'dedupe',
  'digest',
] as const

/** Severity ladder, defined by consequence rather than by tone. */
export type Severity = 'praise' | 'nit' | 'minor' | 'major' | 'blocker'
export const SEVERITIES: readonly Severity[] = ['praise', 'nit', 'minor', 'major', 'blocker']

/** Weight per severity rung, used by the impact formula on both paths. */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  praise: 0,
  nit: 0.2,
  minor: 0.45,
  major: 0.75,
  blocker: 1,
}

export type Sentiment = 'negative' | 'mixed' | 'neutral' | 'positive'

export type Actionability = 'observation' | 'opinion' | 'suggestion' | 'actionable' | 'repro'

export type Confidence = 'low' | 'medium' | 'high'

/** Reviewer standing, used as one term of the impact formula. */
export type ReviewerTier = 'new' | 'established' | 'trusted' | 'expert'

export const REVIEWER_CREDIBILITY: Record<ReviewerTier, number> = {
  new: 0.35,
  established: 0.6,
  trusted: 0.8,
  expert: 1,
}

/**
 * A single feedback point as the AI layer sees it. Callers assemble this from
 * `feedback_points` joined to `feedback`; the layer itself never queries the
 * product tables, which keeps it testable and keeps repository ownership clear.
 */
export type FeedbackInput = {
  id: string
  /** The reviewer, by opaque id. Email addresses never enter this layer. */
  reviewerId: string
  reviewerTier?: ReviewerTier
  /** Category key from the project type taxonomy, e.g. `controls`. */
  categoryKey: string
  /** Axis key the point scores against, when the composer captured one. */
  axisKey?: string
  text: string
  severity: Severity
  actionability?: Actionability
  /** Mean of this review's axis ratings, on the axis scale. */
  axisRatings?: Record<string, number>
  /** Axis scale maximum, 5 or 10. Defaults to 5. */
  scaleMax?: number
  reproSteps?: string
  createdAt: number
  updatedAt?: number
}

/** Usage and cost captured from a single model call. */
export type RunUsage = {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  costMicros: number
}

export type RunRecord = {
  feature: FeatureKey
  provider: ProviderId
  model: string
  status: 'ok' | 'error' | 'invalid' | 'skipped'
  usage: RunUsage
  latencyMs: number
  errorCode?: string
}

/** Scope a spend cap applies to. */
export type BudgetScope = {
  userId?: string
  projectId?: string
}
