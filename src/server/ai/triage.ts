import './guard'
import { FEATURE_POLICY, RATE_LIMITS, SCHEMA_VERSION } from './config'
import { inputHash } from './hash'
import { severityFromText, typeFromText, valence, type FeedbackType } from './lexicon'
import { containsRepro, lintDraft } from './lint'
import { callValidated } from './provider'
import { UNTRUSTED_CONTENT_RULE, wrapUntrusted } from './redact'
import { TriageBatchSchema, TRIAGE_JSON_SCHEMA, type Triage, type TriageBatch } from './schemas'
import { readArtifact, writeArtifact } from './store'
import { normalise } from './text'
import { SEVERITIES } from './types'
import type { ProjectType } from './taxonomy'
import type { AiResult, FeedbackInput, Severity } from './types'

/**
 * Feature 4: sentiment and severity triage.
 *
 * Every incoming item gets a sentiment, a severity and a type so the creator's
 * inbox can be sorted by what is on fire.
 *
 * This is the feature whose deterministic path is strongest, because the
 * structured composer already collected most of the answer from the reviewer.
 * Sentiment falls out of the per-axis ratings arithmetically; severity is the
 * reviewer's own selection, which the heuristic may only escalate, and only by
 * one rung. The model's job is narrow: catch the four-out-of-five rating whose
 * body says “but it corrupted my save”.
 *
 * Nothing here is on the submit path. A row exists from the moment the item is
 * written, so a provider outage is invisible to the creator: the labels are
 * present, they are simply the deterministic ones.
 */

const FEATURE = 'triage' as const
/** Below this length with agreeing labels there is nothing left to detect. */
const SKIP_BODY_CHARS = 150

export type TriageInput = {
  projectId: string
  projectType?: ProjectType
  /** Axis keys for this project, so axis hints stay inside its own vocabulary. */
  axes?: readonly string[]
  items: readonly FeedbackInput[]
}

export type TriageOptions = { signal?: AbortSignal; userId?: string }

// --- deterministic path -----------------------------------------------------

function severityIndex(severity: Severity): number {
  const index = SEVERITIES.indexOf(severity)
  return index === -1 ? 2 : index
}

/**
 * Sentiment from the ratings the reviewer already gave, nudged by the lexicon.
 *
 * The arithmetic is the trunk and the lexicon is a correction, not the other way
 * round: ratings are a number the reviewer chose deliberately, and word counting
 * should not be allowed to overrule them.
 */
function sentimentFor(item: FeedbackInput): { score: number; label: Triage['sentiment'] } {
  const scale = item.scaleMax ?? 5
  const ratings = item.axisRatings ? Object.values(item.axisRatings).filter((n) => Number.isFinite(n)) : []
  const reading = valence(item.text)

  let score: number
  if (ratings.length > 0) {
    const midpoint = (scale + 1) / 2
    const halfRange = (scale - 1) / 2
    const mean = ratings.reduce((sum, n) => sum + n, 0) / ratings.length
    const fromRatings = halfRange === 0 ? 0 : (mean - midpoint) / halfRange
    // A confident lexicon reading moves the number by at most a third.
    const weight = reading.matches >= 3 ? 0.33 : reading.matches > 0 ? 0.18 : 0
    score = fromRatings * (1 - weight) + reading.score * weight
  } else {
    score = reading.matches > 0 ? reading.score : severityToSentiment(item.severity)
  }

  score = Math.max(-1, Math.min(1, Number(score.toFixed(3))))
  return { score, label: labelFor(score, reading.matches) }
}

function severityToSentiment(severity: Severity): number {
  if (severity === 'praise') return 0.8
  if (severity === 'nit') return -0.1
  if (severity === 'minor') return -0.35
  if (severity === 'major') return -0.7
  return -0.9
}

function labelFor(score: number, matches: number): Triage['sentiment'] {
  if (score >= 0.25) return 'positive'
  if (score <= -0.25) return 'negative'
  // A middling score with several matched terms is a genuinely mixed item; a
  // middling score with none is simply neutral, and saying so is more honest.
  return matches >= 2 ? 'mixed' : 'neutral'
}

/**
 * Severity: the reviewer's own selection, escalated at most one rung when the
 * text argues for more. Capping the escalation is what stops the heuristic
 * crying wolf on its own.
 */
function severityFor(item: FeedbackInput): { severity: Severity; overrode: boolean; reason?: string } {
  const claimed = severityFromText(item.text)
  if (!claimed) return { severity: item.severity, overrode: false }
  const own = severityIndex(item.severity)
  const argued = severityIndex(claimed)
  if (argued <= own) return { severity: item.severity, overrode: false }
  const capped = Math.min(argued, own + 1)
  const next = SEVERITIES[capped] ?? item.severity
  if (next === item.severity) return { severity: item.severity, overrode: false }
  return {
    severity: next,
    overrode: true,
    reason: `The body describes a ${claimed}-level consequence.`,
  }
}

function typeFor(item: FeedbackInput): FeedbackType {
  if (item.actionability === 'repro') return 'bug'
  const fromText = typeFromText(item.text)
  if (fromText) return fromText
  const category = normalise(item.categoryKey)
  if (category.includes('bug') || category.includes('defect')) return 'bug'
  if (category.includes('perf')) return 'performance'
  if (category.includes('balance') || category.includes('difficulty')) return 'balance'
  if (category.includes('copy') || category.includes('art') || category.includes('audio')) return 'content'
  if (category.includes('missing')) return 'feature_request'
  if (category.includes('delight') || category.includes('praise')) return 'praise'
  return 'usability'
}

function axisHintsFor(item: FeedbackInput, axes: readonly string[] | undefined): string[] {
  const hints: string[] = []
  if (item.axisKey) hints.push(item.axisKey)
  const flat = normalise(item.text)
  for (const axis of axes ?? []) {
    if (hints.length >= 3) break
    if (hints.includes(axis)) continue
    const readable = normalise(axis.replace(/[_-]+/g, ' '))
    if (readable.length >= 3 && flat.includes(readable)) hints.push(axis)
  }
  return hints.slice(0, 3)
}

function actionabilityFor(item: FeedbackInput, hasRepro: boolean): Triage['actionability'] {
  if (hasRepro || item.actionability === 'repro' || item.actionability === 'actionable') return 'actionable'
  const reading = lintDraft({ draft: item.text })
  if (reading.passed >= 3) return 'actionable'
  if (reading.passed >= 2) return 'directional'
  return 'not_actionable'
}

function triageOne(item: FeedbackInput, axes: readonly string[] | undefined): Triage {
  const sentiment = sentimentFor(item)
  const severity = severityFor(item)
  const hasRepro = containsRepro(item.text) || Boolean(item.reproSteps && item.reproSteps.trim().length > 0)
  const reading = lintDraft({ draft: item.text })
  return {
    feedbackId: item.id,
    sentiment: sentiment.label,
    sentimentScore: sentiment.score,
    severity: severity.severity,
    type: typeFor(item),
    actionability: actionabilityFor(item, hasRepro),
    axisHints: axisHintsFor(item, axes),
    containsRepro: hasRepro,
    overrodeReviewer: severity.overrode,
    ...(severity.reason ? { overrideReason: severity.reason } : {}),
    confidence: reading.passed >= 3 ? 'medium' : 'low',
  }
}

/** Structured signals plus the lexicon. Always available, always complete. */
export function heuristic(input: TriageInput): AiResult<TriageBatch> {
  const startedAt = Date.now()
  return {
    data: { results: input.items.map((item) => triageOne(item, input.axes)) },
    source: 'heuristic',
    ms: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
  }
}

/** One item, for the synchronous write on insert. */
export function triageHeuristicOne(item: FeedbackInput, axes?: readonly string[]): Triage {
  return triageOne(item, axes)
}

// --- prompt -----------------------------------------------------------------

const SYSTEM = [
  'You label feedback items for a creator’s inbox. Two rules carry the whole task.',
  '',
  'Severity is defined by consequence, never by tone:',
  '- blocker: data loss, a crash, the core loop is unreachable, or a security problem.',
  '  “it wiped my save file” · “the build will not launch on Windows”.',
  '- major: a main-path feature is broken, or the experience fails for a whole class of users.',
  '  “checkout returns a 500 every time” · “none of the text is readable at 125% zoom”.',
  '- minor: friction with a workaround. “I had to guess which button saved” · “loading takes 40 seconds”.',
  '- nit: polish and taste. “the icon is one pixel off” · “I would soften that shade”.',
  'Near miss: “this is infuriating” with no functional consequence is a nit, not a blocker. Intensity is not severity.',
  '',
  'Sentiment is about the experience described, not the politeness of the writing.',
  'A cheerfully worded bug report is negative sentiment. A blunt compliment is positive.',
  '',
  'The reviewer’s own severity and axis ratings are supplied as priors. You may override them,',
  'but only with overrodeReviewer true and a stated reason. The creator sees both labels and can restore theirs.',
  '',
  'Echo every id exactly as supplied. A response whose id set differs from the request is discarded whole.',
  '',
  UNTRUSTED_CONTENT_RULE,
].join('\n')

function buildUserTurn(input: TriageInput, items: readonly FeedbackInput[]): string {
  const lines: string[] = []
  lines.push(`Project type: ${input.projectType ?? 'unspecified'}`)
  if (input.axes?.length) lines.push(`Axis keys: ${input.axes.join(', ')}`)
  lines.push('')
  for (const item of items) {
    const ratings = item.axisRatings
      ? Object.entries(item.axisRatings)
          .map(([axis, value]) => `${axis}=${value}`)
          .join(' ')
      : 'none'
    lines.push(
      `id=${item.id} category=${item.categoryKey} reviewerSeverity=${item.severity} ratings=[${ratings}] scaleMax=${item.scaleMax ?? 5}`,
    )
    lines.push(wrapUntrusted('reviewer_feedback', item.id, item.text, 1500))
    lines.push('')
  }
  return lines.join('\n')
}

// --- public entry point -----------------------------------------------------

function hashOf(input: TriageInput, items: readonly FeedbackInput[]): string {
  return inputHash(SCHEMA_VERSION.triage, {
    projectId: input.projectId,
    items: items.map((item) => `${item.id}:${item.updatedAt ?? item.createdAt}`).sort(),
  })
}

/**
 * Triage a batch. Coalescing up to twenty items into one request amortises the
 * system prefix across all of them, which is the difference between a fraction
 * of a cent per item and a fraction of a cent per batch.
 */
export async function generate(input: TriageInput, options: TriageOptions = {}): Promise<AiResult<TriageBatch>> {
  const startedAt = Date.now()
  const baseline = input.items.map((item) => triageOne(item, input.axes))
  const byId = new Map(baseline.map((row) => [row.feedbackId, row]))

  // Items where the reviewer's structured labels and the heuristic already agree
  // and the body is short have nothing left for a model to detect.
  const candidates = input.items.filter((item) => {
    const row = byId.get(item.id)
    if (!row) return true
    if (row.overrodeReviewer) return true
    return item.text.trim().length >= SKIP_BODY_CHARS
  })

  if (candidates.length === 0) {
    return {
      data: { results: baseline },
      source: 'heuristic',
      ms: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
      degraded: 'gated',
    }
  }

  const batch = candidates.slice(0, RATE_LIMITS.triageBatchSize)
  const hash = hashOf(input, batch)
  const key = {
    feature: FEATURE,
    subjectType: 'project' as const,
    subjectId: input.projectId,
    inputHash: hash,
    schemaVersion: SCHEMA_VERSION.triage,
  }

  const cached = readArtifact<Triage[]>(key)
  if (cached) {
    return {
      data: { results: merge(baseline, cached.payload) },
      source: 'cached',
      ...(cached.model ? { model: cached.model } : {}),
      ms: Date.now() - startedAt,
      generatedAt: new Date(cached.generatedAt).toISOString(),
    }
  }

  const scope = { projectId: input.projectId, ...(options.userId ? { userId: options.userId } : {}) }
  const outcome = await callValidated(
    {
      feature: FEATURE,
      system: SYSTEM,
      user: buildUserTurn(input, batch),
      toolName: 'triage_feedback',
      toolDescription: 'Label each supplied feedback item with sentiment, severity, type and actionability.',
      schema: TRIAGE_JSON_SCHEMA,
      ...(options.signal ? { signal: options.signal } : {}),
    },
    TriageBatchSchema,
    scope,
  )

  if (!outcome.ok) {
    return {
      data: { results: baseline },
      source: 'heuristic',
      ms: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
      degraded: outcome.reason,
    }
  }

  const expected = new Set(batch.map((item) => item.id))
  const returned = new Set(outcome.data.results.map((row) => row.feedbackId))
  const aligned = expected.size === returned.size && [...expected].every((id) => returned.has(id))
  if (!aligned) {
    // A mis-aligned batch means one item's labels may be sitting on another
    // item's row. There is no safe partial recovery, so the batch is dropped.
    return {
      data: { results: baseline },
      source: 'heuristic',
      ms: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
      degraded: 'schema_invalid',
    }
  }

  const escalated = await escalate(input, outcome.data.results, scope, options.signal)
  writeArtifact(key, escalated, 'ai', outcome.model)

  return {
    data: { results: merge(baseline, escalated) },
    source: 'ai',
    model: outcome.model,
    ms: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Anything the cheap tier called a blocker, or was unsure about, is re-run on
 * the stronger tier before it can fire a notification. A false “your build
 * corrupts saves” alert costs more trust than the re-run costs money.
 */
async function escalate(
  input: TriageInput,
  rows: readonly Triage[],
  scope: { projectId: string; userId?: string },
  signal: AbortSignal | undefined,
): Promise<Triage[]> {
  const needsReview = rows.filter((row) => row.severity === 'blocker' || row.confidence === 'low')
  if (needsReview.length === 0) return [...rows]
  const items = input.items.filter((item) => needsReview.some((row) => row.feedbackId === item.id))
  if (items.length === 0) return [...rows]

  const outcome = await callValidated(
    {
      feature: FEATURE,
      tier: 'work',
      system: SYSTEM,
      user: buildUserTurn(input, items),
      toolName: 'triage_feedback',
      toolDescription: 'Re-check these items, which were labelled blocker or low confidence.',
      schema: TRIAGE_JSON_SCHEMA,
      ...(signal ? { signal } : {}),
    },
    TriageBatchSchema,
    scope,
  )
  if (!outcome.ok) return [...rows]

  const revised = new Map(outcome.data.results.map((row) => [row.feedbackId, row]))
  return rows.map((row) => revised.get(row.feedbackId) ?? row)
}

/** Model rows win where they exist; every other row keeps its deterministic labels. */
function merge(baseline: readonly Triage[], upgraded: readonly Triage[]): Triage[] {
  const byId = new Map(upgraded.map((row) => [row.feedbackId, row]))
  return baseline.map((row) => byId.get(row.feedbackId) ?? row)
}

export function triageLabel(result: AiResult<TriageBatch>): string {
  return result.source === 'heuristic' ? FEATURE_POLICY.triage.heuristicLabel : FEATURE_POLICY.triage.aiLabel
}

export type { Triage, TriageBatch }
