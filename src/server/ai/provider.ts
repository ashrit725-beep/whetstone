import './guard'
import type { z } from 'zod'
import { aiAvailability } from '@/lib/env'
import { anthropicStructured, anthropicErrorCode, isRateLimit, type AdapterRequest, type AdapterResponse } from './anthropic'
import { compatStructured, compatErrorCode, compatIsRateLimit } from './openai-compat'
import { breakerAllows, recordFailure, recordSuccess } from './breaker'
import { checkBudget, noteSpend } from './budget'
import { costMicros, featureEnabled, modelFor, FEATURE_POLICY,
  TIER_EFFORT,
} from './config'
import { recordRun } from './store'
import { conformToSchema } from './conform'
import type { BudgetScope, DegradeReason, FeatureKey, ProviderId, RunUsage, Tier } from './types'

/**
 * The provider router.
 *
 * Selection order is Anthropic, then OpenAI, then Kimi, then nothing. Every
 * failure mode below lands on the same answer: the caller is told the model path
 * is unavailable and runs its deterministic path. This function never throws.
 *
 * Cost is measured from the usage the provider reports, not estimated from
 * string lengths, and written to the ledger on every call including failures, so
 * the spend page reflects what actually happened.
 */

export type StructuredRequest = {
  feature: FeatureKey
  /** Overrides the feature's default tier. Used by the triage escalation rule. */
  tier?: Tier
  system: string
  user: string
  toolName: string
  toolDescription: string
  schema: AdapterRequest['schema']
  maxTokens?: number
  timeoutMs?: number
  /** Caller-supplied cancellation, combined with the per-feature deadline. */
  signal?: AbortSignal
}

export type StructuredOutcome =
  | { ok: true; value: unknown; provider: ProviderId; model: string; usage: RunUsage; latencyMs: number }
  | { ok: false; reason: DegradeReason; latencyMs: number }

function providerChain(feature?: FeatureKey): ProviderId[] {
  const availability = aiAvailability()
  const chain: ProviderId[] = []
  if (availability.anthropic) chain.push('anthropic')
  if (availability.openai) chain.push('openai')
  if (availability.kimi) chain.push('kimi')
  const prefer = feature ? FEATURE_POLICY[feature].prefer : undefined
  if (!prefer) return chain
  const rank = (p: ProviderId) => {
    const i = prefer.indexOf(p)
    return i === -1 ? prefer.length : i
  }
  return [...chain].sort((a, b) => rank(a) - rank(b))
}

export function anyProviderConfigured(): boolean {
  return providerChain().length > 0
}

async function callProvider(provider: ProviderId, request: AdapterRequest): Promise<AdapterResponse> {
  if (provider === 'anthropic') return anthropicStructured(request)
  return compatStructured(provider, request)
}

function errorCode(provider: ProviderId, error: unknown): string {
  return provider === 'anthropic' ? anthropicErrorCode(error) : compatErrorCode(error)
}

function rateLimited(provider: ProviderId, error: unknown): boolean {
  return provider === 'anthropic' ? isRateLimit(error) : compatIsRateLimit(error)
}

/**
 * One structured call, with the whole cost-control stack in front of it: the
 * feature kill switch, the provider chain, the circuit breaker, the budget
 * ledger, a token ceiling and a hard deadline.
 */
export async function callStructured(
  request: StructuredRequest,
  scope: BudgetScope = {},
  repair?: { previous: string; problem: string },
): Promise<StructuredOutcome> {
  const startedAt = Date.now()
  const elapsed = () => Date.now() - startedAt

  if (!featureEnabled(request.feature)) {
    return { ok: false, reason: 'disabled_by_user', latencyMs: elapsed() }
  }

  const chain = providerChain(request.feature)
  if (chain.length === 0) {
    // No network call is attempted, so a zero-key deployment pays no latency at
    // all for the AI path it does not have.
    return { ok: false, reason: 'no_key', latencyMs: elapsed() }
  }

  const budget = checkBudget(scope)
  if (!budget.allowed) {
    return { ok: false, reason: 'budget_exhausted', latencyMs: elapsed() }
  }

  const policy = FEATURE_POLICY[request.feature]
  const tier = request.tier ?? policy.tier
  const maxTokens = Math.min(request.maxTokens ?? policy.maxTokens, policy.maxTokens)
  const timeoutMs = request.timeoutMs ?? policy.timeoutMs

  let lastReason: DegradeReason = 'provider_down'

  for (const provider of chain) {
    if (!breakerAllows(provider)) {
      lastReason = 'breaker_open'
      continue
    }

    const model = modelFor(provider, tier)
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), timeoutMs)
    const onOuterAbort = () => controller.abort()
    request.signal?.addEventListener('abort', onOuterAbort, { once: true })
    const attemptStart = Date.now()

    try {
      const response = await callProvider(provider, {
        model,
        system: request.system,
        user: request.user,
        toolName: request.toolName,
        toolDescription: request.toolDescription,
        schema: request.schema,
        maxTokens,
        timeoutMs,
        effort: TIER_EFFORT[tier],
        cachePrefix: policy.cachePrefix,
        signal: controller.signal,
        ...(repair ? { repair } : {}),
      })

      const micros = costMicros(model, response.rawUsage)
      const usage: RunUsage = { ...response.rawUsage, costMicros: micros }
      const latencyMs = Date.now() - attemptStart

      recordSuccess(provider)
      recordRun({ feature: request.feature, provider, model, status: 'ok', usage, latencyMs }, scope)
      noteSpend(micros, scope)

      return { ok: true, value: response.value, provider, model, usage, latencyMs }
    } catch (error) {
      const latencyMs = Date.now() - attemptStart
      const code = errorCode(provider, error)
      const aborted = code === 'aborted' || controller.signal.aborted
      // A request the caller cancelled says nothing about the provider. The
      // coach's deadline is eight seconds and a reviewer typing another
      // character cancels the one in flight, so counting those as failures
      // tripped the breaker against a provider that was answering fine and
      // pushed every feature onto its deterministic path for the cooldown.
      if (!aborted) recordFailure(provider)
      recordRun(
        {
          feature: request.feature,
          provider,
          model,
          status: 'error',
          usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costMicros: 0 },
          latencyMs,
          errorCode: code,
        },
        scope,
      )
      lastReason = aborted ? 'timeout' : rateLimited(provider, error) ? 'rate_limited' : 'provider_down'
      // A caller-cancelled request is not a reason to try the next provider:
      // the reviewer typed another character and this answer is already stale.
      if (request.signal?.aborted) return { ok: false, reason: 'timeout', latencyMs: elapsed() }
    } finally {
      clearTimeout(deadline)
      request.signal?.removeEventListener('abort', onOuterAbort)
    }
  }

  return { ok: false, reason: lastReason, latencyMs: elapsed() }
}

export type ValidatedOutcome<T> =
  | { ok: true; data: T; provider: ProviderId; model: string; latencyMs: number }
  | { ok: false; reason: DegradeReason; latencyMs: number }

/**
 * A structured call plus zod validation, with one repair retry.
 *
 * A schema violation gets exactly one corrective turn carrying the validation
 * error. If that fails too, the call is reported as `schema_invalid` and the
 * caller runs its deterministic path. Nothing is thrown, and the invalid payload
 * is recorded against the run rather than rendered.
 */
export async function callValidated<T>(
  request: StructuredRequest,
  // The third parameter pins T to the schema's *output* type. Without it a zod
  // object carrying `.default()` infers its input type here, and every caller
  // ends up handling fields the parser guarantees are present.
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  scope: BudgetScope = {},
): Promise<ValidatedOutcome<T>> {
  const first = await callStructured(request, scope)
  if (!first.ok) return { ok: false, reason: first.reason, latencyMs: first.latencyMs }

  const parsed = schema.safeParse(conformToSchema(first.value, request.schema))
  if (parsed.success) {
    return { ok: true, data: parsed.data, provider: first.provider, model: first.model, latencyMs: first.latencyMs }
  }

  const problem = parsed.error.issues
    .slice(0, 4)
    .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
    .join('; ')
  // The ledger keeps a code, not the reason. Without this line an operator can
  // see that a feature fell back and never why.
  console.warn(`[ai] ${request.feature}: ${first.provider} ${first.model} failed the schema: ${problem}`)

  recordRun(
    {
      feature: request.feature,
      provider: first.provider,
      model: first.model,
      status: 'invalid',
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costMicros: 0 },
      latencyMs: first.latencyMs,
      errorCode: 'schema_invalid',
    },
    scope,
  )

  const retry = await callStructured(request, scope, {
    previous: JSON.stringify(first.value).slice(0, 4000),
    problem,
  })
  if (!retry.ok) return { ok: false, reason: 'schema_invalid', latencyMs: first.latencyMs + retry.latencyMs }

  const second = schema.safeParse(conformToSchema(retry.value, request.schema))
  if (second.success) {
    return {
      ok: true,
      data: second.data,
      provider: retry.provider,
      model: retry.model,
      latencyMs: first.latencyMs + retry.latencyMs,
    }
  }

  console.warn(
    `[ai] ${request.feature}: the repair attempt failed the schema too: ${second.error.issues
      .slice(0, 4)
      .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`)
      .join('; ')}`,
  )
  return { ok: false, reason: 'schema_invalid', latencyMs: first.latencyMs + retry.latencyMs }
}
