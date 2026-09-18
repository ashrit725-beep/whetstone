import './guard'
import {
  ANCHOR_PATTERN,
  CONTRAST_PATTERN,
  LOW_SIGNAL_PHRASES,
  REPRO_PATTERN,
  UNIT_PATTERN,
} from './lexicon'
import { normalise, overlapCount, sentences, tokens } from './text'
import { scaffoldFor, type CoachCheck, type ProjectType } from './taxonomy'
import type { CoachResult } from './schemas'

/**
 * The deterministic specificity linter.
 *
 * Two features share it. The quality coach uses it as both a gate (a draft that
 * already passes is never sent to a model, so most drafts cost nothing) and as
 * the fallback when a model is unavailable. Triage reuses its `containsRepro`
 * and its overall score for the actionability label, so the two features never
 * disagree about whether a report has steps in it.
 *
 * It runs in well under a millisecond and has no dependencies, which is why it
 * can sit on the keystroke path at all.
 */

export type LintInput = {
  draft: string
  projectType?: ProjectType
  /** The creator's ask, for the on-ask check. Absent means the check is skipped. */
  ask?: string
  /** Project tags and axis labels: the in-product vocabulary a specific claim names. */
  vocabulary?: readonly string[]
}

export type LintChecks = {
  specific: boolean
  reproducible: boolean
  contrastive: boolean
  scoped: boolean
  onAsk: boolean
}

export type LintReading = {
  checks: LintChecks
  verdict: CoachResult['verdict']
  /** 0 to 1. Four of five checks or better is a draft the coach leaves alone. */
  score: number
  passed: number
  /** Checks the draft failed, ordered by how much fixing them would help. */
  failed: CoachCheck[]
  wordCount: number
}

const MIN_CHARS = 40
const MIN_WORDS = 8

/** Contrast words that carry the framing on their own, without a second signal. */
const STRONG_CONTRAST = /\b(expected|instead|whereas|thought it would|should have|would have|rather than)\b/i

const BULLET = /^\s*([-*•]|\d+[.)])\s+/gm

export function lintDraft(input: LintInput): LintReading {
  const draft = input.draft.trim()
  const flat = normalise(draft)
  const words = flat.split(' ').filter(Boolean)
  const wordCount = words.length

  const specific = isSpecific(draft, flat, input.vocabulary)
  const reproducible = wordCount >= MIN_WORDS && REPRO_PATTERN.test(draft)
  const contrastive = STRONG_CONTRAST.test(draft) || (CONTRAST_PATTERN.test(draft) && specific)
  const scoped = isScoped(draft)
  const onAsk = input.ask ? overlapCount(draft, input.ask) >= 2 : true

  const checks: LintChecks = { specific, reproducible, contrastive, scoped, onAsk }
  const passed = Object.values(checks).filter(Boolean).length

  const verdict = verdictFor(draft, flat, wordCount, checks, passed, Boolean(input.ask))
  const failed = orderFailures(checks, verdict)

  return {
    checks,
    verdict,
    score: passed / 5,
    passed,
    failed,
    wordCount,
  }
}

function isSpecific(draft: string, flat: string, vocabulary: readonly string[] | undefined): boolean {
  if (UNIT_PATTERN.test(draft)) return true
  if (ANCHOR_PATTERN.test(draft)) return true
  if (/[“"'][^“”"']{3,}[”"']/.test(draft)) return true
  if (/\b\d+\b/.test(draft) && draft.length > 60) return true
  if (vocabulary && vocabulary.length > 0) {
    for (const term of vocabulary) {
      const t = normalise(term)
      if (t.length >= 3 && flat.includes(t)) return true
    }
  }
  // A capitalised in-product noun that is not a sentence opener reads as naming
  // something concrete, which is the signal the checks above are approximating.
  return /(?:[a-z,]\s)[A-Z][a-zA-Z]{2,}/.test(draft)
}

function isScoped(draft: string): boolean {
  const parts = sentences(draft)
  const bullets = draft.match(BULLET)?.length ?? 0
  if (bullets > 0) return parts.length <= bullets + 1
  return parts.length <= 3
}

function verdictFor(
  draft: string,
  flat: string,
  wordCount: number,
  checks: LintChecks,
  passed: number,
  hasAsk: boolean,
): CoachResult['verdict'] {
  if (draft.length < MIN_CHARS || wordCount < MIN_WORDS) return 'thin'
  if (lowSignalRatio(flat) >= 0.7) return 'vague'
  if (hasAsk && !checks.onAsk && passed >= 3) return 'off_ask'
  if (passed >= 4) return 'ok'
  if (!checks.specific) return 'vague'
  return 'thin'
}

/** How much of the draft is made of phrases that carry no information. */
export function lowSignalRatio(flat: string): number {
  if (flat.length === 0) return 1
  let matched = 0
  for (const phrase of LOW_SIGNAL_PHRASES) {
    let from = 0
    for (;;) {
      const at = flat.indexOf(phrase, from)
      if (at === -1) break
      matched += phrase.length
      from = at + phrase.length
    }
  }
  const content = tokens(flat).length
  const ratio = matched / flat.length
  // A long draft that happens to contain "looks good" is not a vague draft, so
  // the ratio is discounted once there is real content alongside the filler.
  return content >= 8 ? ratio * 0.5 : ratio
}

/**
 * Failure order. Fixing reproducibility and contrast moves a report further
 * than fixing scope, so those are offered first when several checks fail.
 */
const PRIORITY: readonly CoachCheck[] = ['specific', 'reproducible', 'contrastive', 'onAsk', 'scoped']

function orderFailures(checks: LintChecks, verdict: CoachResult['verdict']): CoachCheck[] {
  const failed = PRIORITY.filter((check) => !checks[check])
  if (verdict === 'off_ask') {
    return ['onAsk', ...failed.filter((c) => c !== 'onAsk')]
  }
  return failed
}

/**
 * The linter's own coach output. Identical in shape to the model's, so the
 * composer renders one component and the reviewer cannot tell which produced a
 * chip except by the panel's footer label.
 */
export function coachFromLint(reading: LintReading, projectType?: ProjectType): CoachResult {
  if (reading.verdict === 'ok' || reading.passed >= 4) {
    return { verdict: 'ok', checks: reading.checks, suggestions: [] }
  }
  const suggestions = reading.failed.slice(0, 2).map((check) => {
    const scaffold = scaffoldFor(check, projectType)
    return { prompt: scaffold.prompt, scaffold: scaffold.scaffold, check }
  })
  return { verdict: reading.verdict, checks: reading.checks, suggestions }
}

/** Shared with triage: does this text describe how to hit the problem again? */
export function containsRepro(text: string): boolean {
  return REPRO_PATTERN.test(text) && normalise(text).split(' ').filter(Boolean).length >= MIN_WORDS
}
