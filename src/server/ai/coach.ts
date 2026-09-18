import './guard'
import { FEATURE_POLICY, RATE_LIMITS, SCHEMA_VERSION } from './config'
import { inputHash } from './hash'
import { coachFromLint, lintDraft, type LintReading } from './lint'
import { callValidated } from './provider'
import { UNTRUSTED_CONTENT_RULE, wrapUntrusted } from './redact'
import { CoachResultSchema, COACH_JSON_SCHEMA, type CoachResult } from './schemas'
import { countRunsSince, readSetting, writeSetting } from './store'
import { normalise } from './text'
import { scaffoldFor, type ProjectType } from './taxonomy'
import type { AiResult } from './types'

/**
 * Feature 2: the feedback quality coach.
 *
 * The interaction design is the specification here and the model is secondary,
 * so the rules that keep this from being irritating are enforced in code rather
 * than left to the caller:
 *
 * - Nothing fires on a keystroke. The entry point debounces on idle.
 * - A draft that already reads well is never sent to a model. The linter is the
 *   gate, so most drafts by experienced reviewers cost nothing.
 * - Two nudges per draft, ever. After the second this module returns silence no
 *   matter what the draft says.
 * - Sixty seconds between nudges, and never twice for an unchanged draft.
 * - Two dismissals turn it off for the session; a reviewer preference turns it
 *   off permanently and is honoured here, server-side, not in the client.
 * - Reviewers whose recent submissions score well are excluded outright.
 *
 * Nothing this module returns can block a submit. It has no verb: it produces a
 * verdict, five booleans and at most two suggestion chips. The composer renders
 * them beside the textarea and the reviewer submits whenever they like.
 */

const FEATURE = 'coach' as const
const DEBOUNCE_MS = 1200
const NUDGE_COOLDOWN_MS = 60_000
const MIN_DRAFT_CHARS = 40
const CACHE_TTL_MS = 90_000
const CACHE_MAX = 200
/** A reviewer averaging this or better over their last ten reviews is left alone. */
const GOOD_REVIEWER_SCORE = 0.8

export type CoachInput = {
  /** Stable for the life of one composer session. Scopes the nudge budget. */
  draftId: string
  draft: string
  projectId: string
  projectType?: ProjectType
  axisKey?: string
  /** The creator's ask, for the on-ask check. */
  ask?: string
  /** Project tags and axis labels: the in-product vocabulary. */
  vocabulary?: readonly string[]
  reviewerId?: string
  /** Mean quality of this reviewer's last ten submissions, 0 to 1. */
  reviewerQuality?: number
}

export type CoachOptions = { signal?: AbortSignal }

// --- per-draft state --------------------------------------------------------

type DraftState = {
  nudges: number
  calls: number
  dismissals: number
  lastNudgeAt: number
  lastHash: string
  touchedAt: number
}

const drafts = new Map<string, DraftState>()

function draftState(draftId: string): DraftState {
  const existing = drafts.get(draftId)
  if (existing) {
    existing.touchedAt = Date.now()
    return existing
  }
  const created: DraftState = {
    nudges: 0,
    calls: 0,
    dismissals: 0,
    lastNudgeAt: 0,
    lastHash: '',
    touchedAt: Date.now(),
  }
  drafts.set(draftId, created)
  sweepDrafts()
  return created
}

function sweepDrafts(): void {
  if (drafts.size < 500) return
  const cutoff = Date.now() - 3_600_000
  for (const [id, state] of drafts) if (state.touchedAt < cutoff) drafts.delete(id)
}

/** The composer calls this when a reviewer dismisses the panel. */
export function noteDismissed(draftId: string): void {
  draftState(draftId).dismissals += 1
}

/** The composer calls this when a draft is submitted or abandoned. */
export function forgetDraft(draftId: string): void {
  drafts.delete(draftId)
}

// --- reviewer preference ----------------------------------------------------

function preferenceKey(userId: string): string {
  return `coach_off:${userId}`
}

/** A reviewer turning writing tips off is honoured on the server, permanently. */
export function setCoachEnabled(userId: string, enabled: boolean): void {
  writeSetting(preferenceKey(userId), !enabled)
}

export function coachDisabledFor(userId: string | undefined): boolean {
  if (!userId) return false
  return readSetting<boolean>(preferenceKey(userId)) === true
}

// --- response cache ---------------------------------------------------------

type CacheEntry = { result: CoachResult; model?: string; readAt: number }
const cache = new Map<string, CacheEntry>()

function cacheKey(input: CoachInput): string {
  return inputHash(SCHEMA_VERSION.coach, {
    draft: normalise(input.draft),
    projectId: input.projectId,
    axis: input.axisKey ?? '',
  })
}

function cacheGet(key: string): CacheEntry | undefined {
  const hit = cache.get(key)
  if (!hit) return undefined
  if (Date.now() - hit.readAt > CACHE_TTL_MS) {
    cache.delete(key)
    return undefined
  }
  return hit
}

function cachePut(key: string, result: CoachResult, model?: string): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next()
    if (!oldest.done) cache.delete(oldest.value)
  }
  cache.set(key, { result, ...(model ? { model } : {}), readAt: Date.now() })
}

// --- deterministic path -----------------------------------------------------

/** The linter's own answer. Sub-millisecond, no network, always available. */
export function heuristic(input: CoachInput): AiResult<CoachResult> {
  const startedAt = Date.now()
  const reading = lint(input)
  return {
    data: coachFromLint(reading, input.projectType),
    source: 'heuristic',
    ms: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
  }
}

function lint(input: CoachInput): LintReading {
  return lintDraft({
    draft: input.draft,
    ...(input.projectType ? { projectType: input.projectType } : {}),
    ...(input.ask ? { ask: input.ask } : {}),
    ...(input.vocabulary ? { vocabulary: input.vocabulary } : {}),
  })
}

/**
 * Silence: the linter's honest verdict with the chips withheld.
 *
 * Reporting "ok" here instead would be a small lie the composer could act on,
 * and the verdict is the part a caller may want for its own reasons. What the
 * anti-annoyance rules suppress is the nudge, not the assessment.
 */
function silent(reading: LintReading, startedAt: number, degraded?: AiResult<CoachResult>['degraded']): AiResult<CoachResult> {
  return {
    data: { verdict: reading.verdict, checks: reading.checks, suggestions: [] },
    source: 'heuristic',
    ms: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
    ...(degraded ? { degraded } : {}),
  }
}

// --- prompt -----------------------------------------------------------------

const SYSTEM = [
  'You help a reviewer make feedback actionable. You never rewrite their words and never judge their opinion.',
  '',
  'Five checks, each pass or fail:',
  '- specific: names a concrete element, screen, moment or measurement.',
  '- reproducible: says when or how it happened.',
  '- contrastive: states what was expected against what happened.',
  '- scoped: one issue per point.',
  '- onAsk: addresses what the creator asked for, when an ask is supplied.',
  '',
  'If the draft passes four checks or more, return verdict "ok" and no suggestions. Silence is the goal, not a failure.',
  '',
  'A suggestion is a question or a fill-in opener, twelve words at most, two at most in total.',
  'Never write “your feedback is low quality”, never suggest being more positive or more negative,',
  'and never propose replacement wording for what the reviewer already wrote. Sentiment is out of scope.',
  '',
  UNTRUSTED_CONTENT_RULE,
].join('\n')

function buildUserTurn(input: CoachInput): string {
  const lines: string[] = []
  lines.push(`Project type: ${input.projectType ?? 'unspecified'}`)
  if (input.axisKey) lines.push(`Rating axis being written about: ${input.axisKey}`)
  if (input.ask) {
    // The ask is written by the creator, so it is untrusted text in exactly the
    // way the draft below it is. Interpolated raw, a creator could put
    // instructions in their own ask and steer what every reviewer of their
    // project is coached to write.
    lines.push('The creator asked:')
    lines.push(wrapUntrusted('creator_ask', input.projectId ?? 'ask', input.ask, 300))
  }
  if (input.vocabulary?.length) {
    // Vocabulary comes from the project's own tags and category labels, which
    // are also user-written.
    lines.push(wrapUntrusted('project_vocabulary', 'vocabulary', input.vocabulary.slice(0, 24).join(', '), 400))
  }
  lines.push('')
  lines.push('The draft:')
  lines.push(wrapUntrusted('reviewer_draft', input.draftId, input.draft, 2000))
  return lines.join('\n')
}

// --- public entry points ----------------------------------------------------

/**
 * One coaching pass. Callers that sit on an input event should use
 * `generateDebounced` instead; this is the un-debounced form, for a blur event
 * or an explicit "check my draft" control.
 */
export async function generate(input: CoachInput, options: CoachOptions = {}): Promise<AiResult<CoachResult>> {
  const startedAt = Date.now()
  const reading = lint(input)
  const state = draftState(input.draftId)
  const hash = cacheKey(input)

  if (coachDisabledFor(input.reviewerId)) return silent(reading, startedAt, 'disabled_by_user')
  if (state.dismissals >= 2) return silent(reading, startedAt, 'disabled_by_user')
  if (typeof input.reviewerQuality === 'number' && input.reviewerQuality >= GOOD_REVIEWER_SCORE) {
    return silent(reading, startedAt, 'disabled_by_user')
  }
  if (state.nudges >= RATE_LIMITS.coachNudgesPerDraft) return silent(reading, startedAt, 'gated')
  if (hash === state.lastHash) return silent(reading, startedAt, 'gated')
  if (Date.now() - state.lastNudgeAt < NUDGE_COOLDOWN_MS && state.nudges > 0) {
    return silent(reading, startedAt, 'gated')
  }
  if (input.draft.trim().length < MIN_DRAFT_CHARS) return silent(reading, startedAt, 'gated')

  // The gate that makes this feature nearly free: a draft the linter is happy
  // with never reaches a model.
  if (reading.passed >= 4) return silent(reading, startedAt)

  const cached = cacheGet(hash)
  if (cached) {
    return commit(input, state, hash, {
      data: cached.result,
      source: 'cached',
      ...(cached.model ? { model: cached.model } : {}),
      ms: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
    })
  }

  if (state.calls >= RATE_LIMITS.coachCallsPerDraft) {
    return commit(input, state, hash, fallback(input, reading, startedAt, 'gated'))
  }
  if (input.reviewerId) {
    const today = countRunsSince(FEATURE, Date.now() - 86_400_000, { userId: input.reviewerId })
    if (today >= RATE_LIMITS.coachCallsPerUserPerDay) {
      return commit(input, state, hash, fallback(input, reading, startedAt, 'gated'))
    }
  }

  state.calls += 1
  const outcome = await callValidated(
    {
      feature: FEATURE,
      system: SYSTEM,
      user: buildUserTurn(input),
      toolName: 'coach_draft',
      toolDescription: 'Return the five checks and at most two suggestions for this draft.',
      schema: COACH_JSON_SCHEMA,
      ...(options.signal ? { signal: options.signal } : {}),
    },
    CoachResultSchema,
    {
      projectId: input.projectId,
      ...(input.reviewerId ? { userId: input.reviewerId } : {}),
    },
  )

  if (!outcome.ok) {
    return commit(input, state, hash, fallback(input, reading, startedAt, outcome.reason))
  }

  const sanitised = sanitise(outcome.data, input, reading)
  cachePut(hash, sanitised, outcome.model)
  return commit(input, state, hash, {
    data: sanitised,
    source: 'ai',
    model: outcome.model,
    ms: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
  })
}

function fallback(
  input: CoachInput,
  reading: LintReading,
  startedAt: number,
  degraded: AiResult<CoachResult>['degraded'],
): AiResult<CoachResult> {
  return {
    data: coachFromLint(reading, input.projectType),
    source: 'heuristic',
    ms: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
    ...(degraded ? { degraded } : {}),
  }
}

/**
 * The model may only speak through the schema, and this trims what is left: a
 * suggestion with no scaffold is replaced by the curated one for that check, and
 * an empty suggestion list on a failing draft falls back to the linter's chips
 * so the panel is never a verdict with no way forward.
 */
function sanitise(result: CoachResult, input: CoachInput, reading: LintReading): CoachResult {
  const suggestions = result.suggestions
    .filter((s) => s.prompt.trim().length > 0)
    .slice(0, 2)
    .map((s) => ({
      ...s,
      scaffold: s.scaffold.trim().length > 0 ? s.scaffold : scaffoldFor(s.check, input.projectType).scaffold,
    }))
  if (result.verdict !== 'ok' && suggestions.length === 0) {
    return coachFromLint(reading, input.projectType)
  }
  return { ...result, suggestions }
}

function commit(
  input: CoachInput,
  state: DraftState,
  hash: string,
  result: AiResult<CoachResult>,
): AiResult<CoachResult> {
  state.lastHash = hash
  if (result.data.suggestions.length > 0) {
    state.nudges += 1
    state.lastNudgeAt = Date.now()
  }
  return result
}

// --- debounce ---------------------------------------------------------------

type PendingDraft = { sequence: number; controller?: AbortController }
const pending = new Map<string, PendingDraft>()
let sequence = 0

/**
 * The live path. Waits for typing to stop, then coaches once.
 *
 * A superseded call resolves immediately with the linter's answer rather than
 * hanging or throwing, so a caller that awaits every keystroke still gets a
 * usable result per call and only the last one costs a model round trip. The
 * in-flight request for an older draft is aborted the moment a newer one
 * arrives.
 */
export async function generateDebounced(
  input: CoachInput,
  options: CoachOptions = {},
): Promise<AiResult<CoachResult>> {
  const startedAt = Date.now()
  const mine = ++sequence
  const previous = pending.get(input.draftId)
  previous?.controller?.abort()

  const controller = new AbortController()
  pending.set(input.draftId, { sequence: mine, controller })

  await sleep(DEBOUNCE_MS)

  if (pending.get(input.draftId)?.sequence !== mine) {
    const reading = lint(input)
    return silent(reading, startedAt, 'gated')
  }

  const signal = options.signal ? anySignal([options.signal, controller.signal]) : controller.signal
  try {
    return await generate(input, { signal })
  } finally {
    if (pending.get(input.draftId)?.sequence === mine) pending.delete(input.draftId)
  }
}

function sleep(ms: number): Promise<void> {
  // Deliberately not unref'd. An unref'd timer lets the process exit while this
  // promise is still pending, which turns a debounced call into one that never
  // settles. The window is 1200ms and the caller is awaiting it.
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

function anySignal(signals: readonly AbortSignal[]): AbortSignal {
  const controller = new AbortController()
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort()
      break
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return controller.signal
}

/** The honest footer label for the panel. */
export function coachLabel(result: AiResult<CoachResult>): string {
  return result.source === 'heuristic' ? FEATURE_POLICY.coach.heuristicLabel : FEATURE_POLICY.coach.aiLabel
}

export type { CoachResult }
