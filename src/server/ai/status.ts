import './guard'
import { aiAvailability } from '@/lib/env'
import { breakerCooldownMs, breakerStatus, type BreakerVerdict } from './breaker'
import { budgetSnapshot, checkBudget } from './budget'
import { FEATURE_POLICY, modelFor, featureEnabled } from './config'
import { cacheReadRatioSince, pendingJobCount, runStatsSince, storeReady, type FeatureRunStats } from './store'
import { FEATURE_KEYS, type DegradeReason, type FeatureKey, type ProviderId, type Tier } from './types'

/**
 * What is actually live, and what each feature will actually do.
 *
 * This exists so the interface can say “clustered locally” or “clustered with
 * Claude” honestly rather than hiding which one happened. A provenance label
 * that lies is worse than no label: it teaches a creator to distrust every
 * number on the page.
 */

export type ProviderStatus = {
  id: ProviderId
  configured: boolean
  breaker: BreakerVerdict
  /** Milliseconds until a half-open probe is allowed. Zero when closed. */
  cooldownMs: number
}

export type FeatureStatus = {
  feature: FeatureKey
  enabled: boolean
  /** What this feature will do on the next call, given the current state. */
  path: 'ai' | 'heuristic'
  /** The label the UI should render for that path. */
  label: string
  tier: Tier
  /** Present when `path` is 'ai'. */
  model?: string
  /** Present when `path` is 'heuristic'. */
  reason?: DegradeReason
}

export type AiStatus = {
  providers: ProviderStatus[]
  /** The provider a call would reach first, if any. */
  primary?: ProviderId
  /** True when at least one provider key is set and reachable. */
  live: boolean
  features: FeatureStatus[]
  budget: { spentMicros: number; capMicros: number; fraction: number; exhausted: boolean }
  /** Share of input tokens served from the prompt cache in the last day. */
  cacheReadRatio?: number
  runsToday: FeatureRunStats[]
  queueDepth: number
  /** False when SQLite is unavailable and the layer is running on its in-process store. */
  persistent: boolean
}

const PROVIDERS: readonly ProviderId[] = ['anthropic', 'openai', 'kimi']

/**
 * A snapshot for the operator page and for provenance labels. Cheap enough to
 * call per render: two indexed aggregates and some in-process state.
 */
export function aiStatus(): AiStatus {
  const availability = aiAvailability()
  const configured: Record<ProviderId, boolean> = {
    anthropic: availability.anthropic,
    openai: availability.openai,
    kimi: availability.kimi,
  }

  const providers: ProviderStatus[] = PROVIDERS.map((id) => ({
    id,
    configured: configured[id],
    breaker: breakerStatus(id),
    cooldownMs: breakerCooldownMs(id),
  }))

  const reachable = providers.filter((p) => p.configured && p.breaker !== 'open')
  const primary = reachable[0]?.id
  const budget = budgetSnapshot()
  const budgetOk = checkBudget().allowed

  const features: FeatureStatus[] = FEATURE_KEYS.map((feature) => {
    const policy = FEATURE_POLICY[feature]
    const enabled = featureEnabled(feature)
    const reason = pathReason(enabled, configured, reachable.length > 0, budgetOk)
    if (reason) {
      return { feature, enabled, path: 'heuristic', label: policy.heuristicLabel, tier: policy.tier, reason }
    }
    const provider = primary ?? 'anthropic'
    return {
      feature,
      enabled,
      path: 'ai',
      label: policy.aiLabel,
      tier: policy.tier,
      model: modelFor(provider, policy.tier),
    }
  })

  const dayAgo = Date.now() - 86_400_000
  const ratio = cacheReadRatioSince(dayAgo)

  return {
    providers,
    ...(primary ? { primary } : {}),
    live: reachable.length > 0,
    features,
    budget: {
      spentMicros: budget.monthSpentMicros,
      capMicros: budget.monthCapMicros,
      fraction: budget.fraction,
      exhausted: !budgetOk,
    },
    ...(ratio !== undefined ? { cacheReadRatio: ratio } : {}),
    runsToday: runStatsSince(dayAgo),
    queueDepth: pendingJobCount(),
    persistent: storeReady(),
  }
}

function pathReason(
  enabled: boolean,
  configured: Record<ProviderId, boolean>,
  anyReachable: boolean,
  budgetOk: boolean,
): DegradeReason | undefined {
  if (!enabled) return 'disabled_by_user'
  if (!configured.anthropic && !configured.openai && !configured.kimi) return 'no_key'
  if (!anyReachable) return 'breaker_open'
  if (!budgetOk) return 'budget_exhausted'
  return undefined
}

/** Plain-language provenance for one result, for a badge or a footer line. */
export function provenanceLabel(feature: FeatureKey, source: 'ai' | 'cached' | 'heuristic'): string {
  const policy = FEATURE_POLICY[feature]
  return source === 'heuristic' ? policy.heuristicLabel : policy.aiLabel
}

/** Micro-dollars as a readable figure for the spend page. */
export function formatMicros(micros: number): string {
  return `$${(micros / 1_000_000).toFixed(micros < 10_000 ? 4 : 2)}`
}
