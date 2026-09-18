import './guard'
import { readSetting, writeSetting } from './store'
import type { FeatureKey, ProviderId, Tier } from './types'
import { FEATURE_KEYS } from './types'

/**
 * Tunables for the AI layer: model tiers, per-feature ceilings, rate cards and
 * spend caps.
 *
 * Provider keys come from `@/lib/env` and nowhere else. Everything here is
 * operational policy rather than a secret, so it lives as a typed default that
 * the operator page can override through `ai_setting`. Overrides are read
 * through a sixty-second in-process cache, so the hot path never pays for a
 * settings query.
 */

/** Bumping a schema version invalidates every cached artifact for that feature. */
export const SCHEMA_VERSION: Record<FeatureKey, number> = {
  themes: 1,
  coach: 1,
  intake: 1,
  triage: 1,
  dedupe: 1,
  digest: 1,
}

export const ANTHROPIC_MODELS: Record<Tier, string> = {
  reason: 'claude-opus-5',
  work: 'claude-sonnet-5',
  fast: 'claude-haiku-4-5',
}

export const OPENAI_MODELS: Record<Tier, string> = {
  reason: 'gpt-5',
  work: 'gpt-5-mini',
  fast: 'gpt-5-mini',
}

export const KIMI_MODELS: Record<Tier, string> = {
  reason: 'kimi-k2.6',
  work: 'kimi-k2.6',
  fast: 'kimi-k2.7-code-highspeed',
}

/**
 * How hard the reasoning tiers think. Only OpenAI's gpt-5 family reads this;
 * the fast tier asks for none at all, which is what keeps a sub-second-feeling
 * feature like the coach inside a budget it can actually meet.
 */
export const TIER_EFFORT: Record<Tier, 'minimal' | 'low' | 'medium'> = {
  reason: 'medium',
  work: 'low',
  fast: 'minimal',
}

export function modelFor(provider: ProviderId, tier: Tier): string {
  if (provider === 'anthropic') return ANTHROPIC_MODELS[tier]
  if (provider === 'openai') return OPENAI_MODELS[tier]
  return KIMI_MODELS[tier]
}

/** Dollars per million tokens. Cost is measured from usage, never estimated. */
type Rate = { input: number; output: number; cacheRead: number; cacheWrite: number }

const RATES: Record<string, Rate> = {
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5, cacheWrite: 6.25 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-4-5': { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
  'gpt-5': { input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 1.25 },
  'gpt-5-mini': { input: 0.25, output: 2, cacheRead: 0.025, cacheWrite: 0.25 },
  'kimi-k2.6': { input: 0.6, output: 2.5, cacheRead: 0.15, cacheWrite: 0.6 },
  'kimi-k2.7-code-highspeed': { input: 1.15, output: 8, cacheRead: 0.15, cacheWrite: 1.15 },
}

const FALLBACK_RATE: Rate = { input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 }

/** Micro-dollars, integer. Money never touches a float in this codebase. */
export function costMicros(
  model: string,
  usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheCreationTokens: number },
): number {
  const rate = RATES[model] ?? FALLBACK_RATE
  const dollars =
    (usage.inputTokens * rate.input +
      usage.outputTokens * rate.output +
      usage.cacheReadTokens * rate.cacheRead +
      usage.cacheCreationTokens * rate.cacheWrite) /
    1_000_000
  return Math.round(dollars * 1_000_000)
}

export type FeaturePolicy = {
  tier: Tier
  /**
   * Provider order for this feature, when it should differ from the default
   * (Anthropic, OpenAI, Kimi). Providers without a key are skipped either way.
   */
  prefer?: readonly ProviderId[]
  /** Hard ceiling on generated tokens for one call. */
  maxTokens: number
  /** AbortController deadline. Past this the heuristic path runs instead. */
  timeoutMs: number
  /** Whether the system prefix is large enough to be worth caching. */
  cachePrefix: boolean
  /**
   * A short, honest name for the deterministic path, shown as the UI badge.
   *
   * The AI labels do not name a vendor. Three providers are tried in order and
   * any of them may be the one that answers, so a badge reading "with Claude"
   * was a claim the product could not stand behind.
   */
  heuristicLabel: string
  /** The label when a model produced the result. */
  aiLabel: string
}

/**
 * Tier per feature: the cheap tier for triage and coaching, a stronger tier for
 * clustering and the digest, and the middle tier for duplicate adjudication.
 */
export const FEATURE_POLICY: Record<FeatureKey, FeaturePolicy> = {
  themes: {
    // OpenAI first for this one. The theme report is the largest structured
    // answer in the product, and OpenAI's strict mode holds the schema while it
    // writes; measured on a 45-note project it answered in 18 to 28 seconds.
    // Claude took 32 to 60-plus on the same input, sometimes returned the theme
    // array as a string, and a creator pressing "rebuild" waited for the timeout
    // before the fallback even started. Claude and Kimi remain behind it.
    prefer: ['openai', 'anthropic', 'kimi'],
    // Clustering thirty notes into a dozen themes on the reason tier ran past a
    // sixty-second deadline every time and returned nothing. The middle tier
    // finishes the same job well inside it, and a creator watching a spinner is
    // better served by an answer than by a better answer that never lands.
    tier: 'work',
    // The ceiling covers reasoning tokens as well as the answer, so it is not
    // the size of the JSON coming back.
    maxTokens: 12_000,
    timeoutMs: 60_000,
    cachePrefix: true,
    heuristicLabel: 'Keyword grouping',
    aiLabel: 'Clustered by a model',
  },
  coach: {
    tier: 'fast',
    // 400 tokens and 700ms were sized for a model that answers immediately.
    // Nothing current does, and the coach never blocks a submit, so it can
    // afford to wait a few seconds for something worth saying.
    maxTokens: 1600,
    timeoutMs: 8_000,
    cachePrefix: false,
    heuristicLabel: 'Writing tips',
    aiLabel: 'AI writing tips',
  },
  intake: {
    // Measured on the reason tier this took 41 seconds and 3,835 output
    // tokens, nearly all of them reasoning, to classify one paragraph. It is a
    // form assistant sitting in front of somebody who is waiting, so it runs on
    // the middle tier, which answers in a few seconds for a fraction of a penny.
    tier: 'work',
    maxTokens: 6000,
    timeoutMs: 30_000,
    cachePrefix: true,
    heuristicLabel: 'Suggested from your description',
    aiLabel: 'Suggested by a model',
  },
  triage: {
    tier: 'fast',
    maxTokens: 4000,
    timeoutMs: 25_000,
    cachePrefix: true,
    heuristicLabel: 'Auto-labelled',
    aiLabel: 'Labelled by a model',
  },
  dedupe: {
    tier: 'work',
    maxTokens: 5000,
    timeoutMs: 30_000,
    cachePrefix: true,
    heuristicLabel: 'Grouped by similarity',
    aiLabel: 'Grouped by a model',
  },
  digest: {
    tier: 'reason',
    maxTokens: 8000,
    timeoutMs: 60_000,
    cachePrefix: true,
    heuristicLabel: 'Computed from your week',
    aiLabel: 'Drafted by a model',
  },
}

/** Spend caps, in micro-dollars. */
export const DEFAULT_BUDGET = {
  monthlyMicros: 25_000_000,
  perUserDailyMicros: 250_000,
  perProjectDailyMicros: 1_000_000,
} as const

export type BudgetConfig = {
  monthlyMicros: number
  perUserDailyMicros: number
  perProjectDailyMicros: number
}

/** Per-feature and per-user call caps that sit in front of the budget ledger. */
export const RATE_LIMITS = {
  /** Interactive theme refreshes per project per hour. */
  themesRefreshPerHour: 1,
  /** Model-backed theme runs per project per day. */
  themesRunsPerDay: 2,
  /** Coach calls per reviewer per day, beyond which the linter runs alone. */
  coachCallsPerUserPerDay: 40,
  /** Nudges shown for one draft, ever. */
  coachNudgesPerDraft: 2,
  /** Backstop against a pathological client re-triggering the coach. */
  coachCallsPerDraft: 6,
  /** Intake suggestions per creator per hour. */
  intakePerUserPerHour: 3,
  /** Items coalesced into one triage request. */
  triageBatchSize: 20,
  /** Pairs adjudicated in one dedupe request. */
  dedupeBatchSize: 10,
  /** Newest same-axis items a new item is compared against. */
  dedupeCandidateWindow: 200,
  /** Items sent to the clusterer before deterministic sampling kicks in. */
  themesItemCap: 300,
} as const

const SETTINGS_TTL_MS = 60_000

type Cached<T> = { value: T; readAt: number }
let featureCache: Cached<Set<FeatureKey>> | undefined
let budgetCache: Cached<BudgetConfig> | undefined

/**
 * Per-feature kill switches, honoured server-side. An operator turning a feature
 * off never breaks a page: the feature module runs its deterministic path and
 * reports `degraded: 'disabled_by_user'`.
 */
export function enabledFeatures(): ReadonlySet<FeatureKey> {
  const nowMs = Date.now()
  if (featureCache && nowMs - featureCache.readAt < SETTINGS_TTL_MS) return featureCache.value
  const stored = readSetting<string[]>('features')
  const set = new Set<FeatureKey>(
    stored && Array.isArray(stored)
      ? stored.filter((k): k is FeatureKey => (FEATURE_KEYS as readonly string[]).includes(k))
      : FEATURE_KEYS,
  )
  featureCache = { value: set, readAt: nowMs }
  return set
}

export function setEnabledFeatures(features: readonly FeatureKey[]): void {
  writeSetting('features', [...features])
  featureCache = undefined
}

export function featureEnabled(feature: FeatureKey): boolean {
  return enabledFeatures().has(feature)
}

export function budgetConfig(): BudgetConfig {
  const nowMs = Date.now()
  if (budgetCache && nowMs - budgetCache.readAt < SETTINGS_TTL_MS) return budgetCache.value
  const stored = readSetting<Partial<BudgetConfig>>('budget')
  const value: BudgetConfig = {
    monthlyMicros: numberOr(stored?.monthlyMicros, DEFAULT_BUDGET.monthlyMicros),
    perUserDailyMicros: numberOr(stored?.perUserDailyMicros, DEFAULT_BUDGET.perUserDailyMicros),
    perProjectDailyMicros: numberOr(stored?.perProjectDailyMicros, DEFAULT_BUDGET.perProjectDailyMicros),
  }
  budgetCache = { value, readAt: nowMs }
  return value
}

export function setBudgetConfig(next: Partial<BudgetConfig>): void {
  writeSetting('budget', { ...budgetConfig(), ...next })
  budgetCache = undefined
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : fallback
}

/** Clears the settings caches. Used after an operator writes new policy. */
export function resetConfigCache(): void {
  featureCache = undefined
  budgetCache = undefined
}
