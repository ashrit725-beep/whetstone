import './guard'

/**
 * The AI layer's public surface.
 *
 * Callers import from `@/server/ai` and never reach past it. Each feature
 * exports the same pair: an async `generate` that tries a model and falls back
 * internally, and a synchronous `heuristic` that never touches the network. Both
 * return the same `AiResult<T>`, so a server component renders `result.data` and
 * reads `result.source` only to pick a provenance label.
 *
 * Feature names are re-exported as namespaces because all six export `generate`
 * and `heuristic`, which is the point: the shapes are interchangeable.
 */

export * as themes from './themes'
export * as coach from './coach'
export * as intake from './intake'
export * as triage from './triage'
export * as dedupe from './dedupe'
export * as digest from './digest'

export { aiStatus, provenanceLabel, formatMicros } from './status'
export type { AiStatus, FeatureStatus, ProviderStatus } from './status'

export type {
  AiResult,
  AiSource,
  DegradeReason,
  FeatureKey,
  FeedbackInput,
  ProviderId,
  ReviewerTier,
  Severity,
  Tier,
} from './types'
export { FEATURE_KEYS, SEVERITIES, SEVERITY_WEIGHT, REVIEWER_CREDIBILITY } from './types'

export { impactScore, impactOf, severityLabelFor } from './impact'
export type { ImpactInputs, ImpactReading } from './impact'

export { lintDraft, coachFromLint, containsRepro } from './lint'
export type { LintChecks, LintInput, LintReading } from './lint'

export {
  DEFAULT_AXES,
  OPTIONAL_AXES,
  PROJECT_STAGES,
  PROJECT_TYPES,
  TAG_VOCABULARY,
  isProjectStage,
  isProjectType,
  scaffoldFor,
} from './taxonomy'
export type { AxisSpec, CoachCheck, ProjectStage, ProjectType } from './taxonomy'

export type {
  CoachResult,
  Digest,
  IntakeSuggestion,
  PairVerdict,
  Theme,
  ThemeReport,
  Triage,
  TriageBatch,
} from './schemas'

export { FEATURE_POLICY, budgetConfig, setBudgetConfig, enabledFeatures, setEnabledFeatures } from './config'
export { budgetSnapshot } from './budget'
export { claimJobs, enqueueJob, finishJob, lastRunAnswered, pendingJobCount } from './store'
export type { Job } from './store'
