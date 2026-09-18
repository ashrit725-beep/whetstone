import './guard'
import { compactNumber } from '@/lib/utils'
import { FEATURE_POLICY, SCHEMA_VERSION } from './config'
import { inputHash } from './hash'
import { callValidated } from './provider'
import { UNTRUSTED_CONTENT_RULE, wrapUntrusted } from './redact'
import { DigestSchema, DIGEST_JSON_SCHEMA, METRIC_KEYS, type Digest } from './schemas'
import { readArtifact, writeArtifact } from './store'
import { excerpt } from './text'
import type { AiResult } from './types'

/**
 * Feature 6: the weekly creator digest.
 *
 * One brief per project per week: what changed, what the feedback said, and a
 * ranked list of what to fix first.
 *
 * Everything load-bearing is computed in TypeScript from the prepared brief.
 * The ranking is the impact score from feature 1, the counts come from SQL, and
 * the regressions are arithmetic. The model's job is genuinely narrow: better
 * prose, spotting that three themes share a root cause, and a conservative
 * effort guess. A creator with no provider configured gets a digest that reads
 * less well and is equally accurate.
 *
 * The send is never delayed for an AI reason. If the model path fails, the
 * computed digest goes out on time and the footer line simply differs.
 */

const FEATURE = 'digest' as const

export type MetricKey = (typeof METRIC_KEYS)[number]

/**
 * What each metric is called wherever a person reads it. The prompt uses these
 * too: it used to send the keys, and the model wrote them back into the brief,
 * so a creator read "avg_rating moved 3.4 to 3.9".
 */
export const METRIC_LABEL: Record<MetricKey, string> = {
  feedback_count: 'Notes received',
  reviewers: 'Reviewers',
  avg_rating: 'Mean rating',
  open_themes: 'Open themes',
  resolved: 'Suggestions shipped',
}

export type DigestTheme = {
  id: string
  label: string
  summary: string
  /** The impact score from feature 1, on the same 0 to 100 scale. */
  impact: number
  sentiment: 'praise' | 'problem' | 'request' | 'mixed'
  reporterCount: number
  status: 'open' | 'resolved'
  meanRating?: number
  previousMeanRating?: number
  previousReporterCount?: number
  /** A quote already selected and verified by feature 1. Never raw feedback. */
  quote?: string
}

export type DigestInput = {
  creatorId: string
  /** The project the brief is about. A creator with two projects gets two briefs. */
  projectId: string
  /** ISO week, e.g. 2026-W37. One artifact per project per week. */
  isoWeek: string
  cadence?: 'weekly' | 'biweekly' | 'off'
  metrics: ReadonlyArray<{ key: MetricKey; value: number; previous: number }>
  themes: readonly DigestTheme[]
  /**
   * Suggestions that moved to shipped inside the same seven days the metrics
   * count, so the brief and the "Suggestions shipped" figure cannot disagree.
   */
  shipped?: ReadonlyArray<{ id: string; title: string }>
  newReviewers?: number
  unansweredHighSeverity?: { feedbackId: string; ageDays: number }
  /** The creator's own changelog entries for the week, if any. */
  changelog?: string
}

export type DigestOptions = {
  signal?: AbortSignal
  refresh?: boolean
  /** Answer from a stored brief or the computed one; never call a model. */
  skipModel?: boolean
}

// --- skip rules -------------------------------------------------------------

export type SkipVerdict = { send: true } | { send: false; reason: 'cadence_off' | 'no_activity' }

/**
 * Evaluated before anything is generated. An empty digest is worse than no
 * digest, and it is the main reason people mute these.
 */
export function shouldSend(input: DigestInput): SkipVerdict {
  if (input.cadence === 'off') return { send: false, reason: 'cadence_off' }
  const feedback = input.metrics.find((m) => m.key === 'feedback_count')?.value ?? 0
  const shipped = input.shipped?.length ?? 0
  if (feedback === 0 && shipped === 0 && !input.changelog) return { send: false, reason: 'no_activity' }
  return { send: true }
}

// --- deterministic path -----------------------------------------------------

function directionOf(delta: number): 'up' | 'down' | 'flat' {
  if (delta > 0) return 'up'
  if (delta < 0) return 'down'
  return 'flat'
}

function metricsBlock(input: DigestInput): Digest['metrics'] {
  return input.metrics.map((metric) => {
    const delta = Number((metric.value - metric.previous).toFixed(2))
    return { key: metric.key, value: metric.value, delta, direction: directionOf(delta) }
  })
}

function fixFirstBlock(input: DigestInput): Digest['fixFirst'] {
  return [...input.themes]
    .filter((theme) => theme.status === 'open' && theme.sentiment !== 'praise')
    .sort((a, b) => b.impact - a.impact || (a.id < b.id ? -1 : 1))
    .slice(0, 3)
    .map((theme) => ({
      themeId: theme.id,
      title: theme.label.slice(0, 70),
      why: whyFor(theme),
      reporterCount: theme.reporterCount,
      impact: theme.impact,
      // Effort is a guess on either path, and it is labelled as one. With no
      // model there is nothing honest to guess from, so it says so.
      effortGuess: 'unknown' as const,
      evidence: [theme.id],
    }))
}

function whyFor(theme: DigestTheme): string {
  const reach = `${theme.reporterCount} ${theme.reporterCount === 1 ? 'reviewer' : 'reviewers'}`
  const quote = theme.quote ? ` Representative note: “${excerpt(theme.quote, 100)}”` : ''
  return `${reach}, impact ${theme.impact} of 100.${quote}`.slice(0, 180)
}

function winsBlock(input: DigestInput): Digest['wins'] {
  const wins: Digest['wins'] = []
  for (const theme of input.themes) {
    if (wins.length >= 2) break
    if (theme.meanRating === undefined || theme.previousMeanRating === undefined) continue
    if (theme.meanRating - theme.previousMeanRating >= 0.5) {
      wins.push({ title: `${theme.label} improved this week`.slice(0, 70), evidence: [theme.id] })
    }
  }
  for (const shipped of input.shipped ?? []) {
    if (wins.length >= 2) break
    wins.push({ title: `Shipped: ${shipped.title}`.slice(0, 70), evidence: [shipped.id] })
  }
  return wins
}

function regressionsBlock(input: DigestInput): Digest['regressions'] {
  const out: Digest['regressions'] = []
  for (const theme of input.themes) {
    if (out.length >= 2) break
    const ratingFell =
      theme.meanRating !== undefined &&
      theme.previousMeanRating !== undefined &&
      theme.previousMeanRating - theme.meanRating >= 0.5
    const reachGrew =
      theme.previousReporterCount !== undefined &&
      theme.previousReporterCount > 0 &&
      theme.reporterCount / theme.previousReporterCount >= 1.5
    if (!ratingFell && !reachGrew) continue
    const note = ratingFell
      ? `${theme.label}: mean rating fell from ${theme.previousMeanRating?.toFixed(1)} to ${theme.meanRating?.toFixed(1)}.`
      : `${theme.label}: reporters grew from ${theme.previousReporterCount} to ${theme.reporterCount}.`
    out.push({ themeId: theme.id, note: note.slice(0, 140) })
  }
  return out
}

/** "3 new notes", and "no new notes" rather than a zero at the head of a sentence. */
function newNotes(n: number): string {
  return n === 0 ? 'no new notes' : `${compactNumber(n)} new ${n === 1 ? 'note' : 'notes'}`
}

function headlineFor(input: DigestInput, quiet: boolean, fixFirst: Digest['fixFirst']): string {
  const feedback = input.metrics.find((m) => m.key === 'feedback_count')?.value ?? 0
  if (quiet) return `Quiet week: ${newNotes(feedback)}`
  const top = fixFirst[0]
  if (top) return `${top.title} is now your top issue`.slice(0, 90)
  const themes = input.themes.length
  // No group to name, so no count of them either: "4 new notes, 0 themes" read
  // as a fault on a project too young to group.
  if (themes === 0) return `${compactNumber(feedback)} new ${feedback === 1 ? 'note' : 'notes'} this week`
  return `${compactNumber(feedback)} new ${feedback === 1 ? 'note' : 'notes'}, ${themes} ${themes === 1 ? 'theme' : 'themes'}`
}

function nextStepFor(input: DigestInput, fixFirst: Digest['fixFirst']): string {
  if (input.unansweredHighSeverity) {
    const { ageDays } = input.unansweredHighSeverity
    return `Reply to the high-severity report that has been waiting ${ageDays} ${ageDays === 1 ? 'day' : 'days'}.`
  }
  const top = fixFirst[0]
  // Quoted: a theme label is a sentence of its own, and run into this one
  // unmarked it read as "Open Blocking for me: the export has…".
  if (top) return `Open “${top.title}” and decide whether it goes in the next build.`
  const feedback = input.metrics.find((m) => m.key === 'feedback_count')
  if (feedback && feedback.value < feedback.previous) {
    return 'Volume dropped this week. Post a build update to bring reviewers back.'
  }
  return 'Sharpen your ask so the next round of reviews answers a decision you face.'
}

function weekSummaryFor(input: DigestInput): string {
  const feedback = input.metrics.find((m) => m.key === 'feedback_count')
  const reviewers = input.metrics.find((m) => m.key === 'reviewers')
  // The headline already says a quiet week is one, so the summary does not.
  const parts: string[] = []
  if (feedback) {
    const delta = feedback.value - feedback.previous
    const change =
      delta === 0
        ? feedback.value === 0
          ? ', and none the week before'
          : ', level with last week'
        : delta > 0
          ? `, up ${delta}`
          : `, down ${Math.abs(delta)}`
    const sentence = `${newNotes(feedback.value)}${change}.`
    parts.push(`${sentence.charAt(0).toUpperCase()}${sentence.slice(1)}`)
  }
  if (reviewers && reviewers.value > 0) {
    parts.push(`${reviewers.value} ${reviewers.value === 1 ? 'reviewer' : 'reviewers'} took part.`)
  }
  const open = input.themes.filter((t) => t.status === 'open').length
  if (open > 0) parts.push(`${open} open ${open === 1 ? 'theme' : 'themes'}.`)
  return parts.join(' ').slice(0, 300)
}

/** The computed digest. Every number here is the number the AI version reports. */
export function heuristic(input: DigestInput): AiResult<Digest> {
  const startedAt = Date.now()
  return {
    data: compute(input),
    source: 'heuristic',
    ms: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
  }
}

function compute(input: DigestInput): Digest {
  const feedback = input.metrics.find((m) => m.key === 'feedback_count')?.value ?? 0
  const quiet = feedback < 3 && (input.shipped?.length ?? 0) === 0
  const fixFirst = fixFirstBlock(input)
  return {
    headline: headlineFor(input, quiet, fixFirst),
    weekSummary: weekSummaryFor(input),
    quiet,
    metrics: metricsBlock(input),
    fixFirst,
    wins: winsBlock(input),
    regressions: regressionsBlock(input),
    nextStep: nextStepFor(input, fixFirst),
  }
}

// --- prompt -----------------------------------------------------------------

const SYSTEM = [
  'You write a short weekly brief for a creator with limited time. You are not a cheerleader and not a critic.',
  '',
  'Rank the fix list by impact multiplied by confidence, divided by your effort guess.',
  'Effort is inferred conservatively and is always presented as a guess. Break ties toward whatever blocks the',
  'creator’s stated ask. Never rank a praise theme into the fix list.',
  '',
  'Honesty constraints, which are what make this worth opening:',
  '- Say when a week was quiet. Do not inflate it.',
  '- Do not manufacture a trend from fewer than five data points.',
  '- Report regressions even when the week was good overall.',
  '- If a shipped fix did not move its theme, say so.',
  '',
  'Every fix, win and regression cites its evidence by the short ids in the brief (t1 for a theme, s1 for a',
  'shipped suggestion), in the themeId and evidence fields. Anything citing an id that is not in the brief is',
  'dropped before the creator sees it, so inventing one costs you the whole item.',
  '',
  'The prose is read by a person. Never write an id, a short id or a field name in a headline, summary, title,',
  'reason or next step: name a theme by what it is about and a metric by its label. Prose that does is replaced.',
  '',
  'Voice: second person, fourteen words at most per headline, no exclamation marks.',
  '',
  UNTRUSTED_CONTENT_RULE,
].join('\n')

/**
 * Short names for the themes and shipped suggestions in one prompt: `t1`…,
 * `s1`…. A theme id is a slug and a suggestion id is a UUID, and the model
 * copied both into its prose ("so b6dc0f0d gets confirmation evidence"). The
 * mapping lives for one call and is undone in `ground`, so nothing downstream
 * sees an alias.
 */
interface Aliases {
  readonly of: ReadonlyMap<string, string>
  readonly back: ReadonlyMap<string, string>
}

function aliasesFor(input: DigestInput): Aliases {
  const of = new Map<string, string>()
  const back = new Map<string, string>()
  const name = (id: string, alias: string): void => {
    of.set(id, alias)
    back.set(alias, id)
  }
  input.themes.forEach((theme, i) => {
    name(theme.id, `t${String(i + 1)}`)
  })
  ;(input.shipped ?? []).forEach((shipped, i) => {
    name(shipped.id, `s${String(i + 1)}`)
  })
  return { of, back }
}

function buildUserTurn(input: DigestInput, aliases: Aliases): string {
  const alias = (id: string): string => aliases.of.get(id) ?? id
  const lines: string[] = []
  lines.push(`Week: ${input.isoWeek}`)
  lines.push('')
  lines.push('Metrics, this week against last:')
  for (const metric of input.metrics) {
    lines.push(`- ${METRIC_LABEL[metric.key]}: ${metric.value} (was ${metric.previous})`)
  }
  lines.push('')
  lines.push('Themes, already clustered and scored:')
  for (const theme of input.themes) {
    const id = alias(theme.id)
    const rating =
      theme.meanRating !== undefined
        ? ` rating=${theme.meanRating.toFixed(2)}${theme.previousMeanRating !== undefined ? ` (was ${theme.previousMeanRating.toFixed(2)})` : ''}`
        : ''
    lines.push(
      `- id=${id} status=${theme.status} sentiment=${theme.sentiment} impact=${theme.impact} reporters=${theme.reporterCount}${rating}`,
    )
    // A theme's label and summary can come from the deterministic path, which
    // builds them out of reviewer wording, and the quote is a verbatim
    // substring of a reviewer's note by definition. All three are untrusted
    // text and were going into the prompt with nothing around them.
    lines.push(`  label: ${wrapUntrusted('theme_label', id, theme.label, 120)}`)
    lines.push(`  summary: ${wrapUntrusted('theme_summary', id, theme.summary, 400)}`)
    if (theme.quote) {
      lines.push(`  representative quote: ${wrapUntrusted('reviewer_quote', id, excerpt(theme.quote, 180), 200)}`)
    }
  }
  if (input.shipped?.length) {
    lines.push('')
    // Suggestion titles are creator-written.
    lines.push('Shipped in the same seven days:')
    for (const shipped of input.shipped) {
      const id = alias(shipped.id)
      lines.push(`- ${id}: ${wrapUntrusted('suggestion_title', id, shipped.title, 160)}`)
    }
  }
  if (input.newReviewers !== undefined) lines.push(`New reviewers: ${input.newReviewers}`)
  if (input.unansweredHighSeverity) {
    lines.push(`Oldest unanswered high-severity report: ${input.unansweredHighSeverity.ageDays} days old.`)
  }
  if (input.changelog) {
    lines.push('')
    lines.push(`The creator’s own changelog for the week: ${input.changelog.slice(0, 1500)}`)
  }
  return lines.join('\n')
}

// --- grounding --------------------------------------------------------------

/** Machine text that must never reach a creator's eyes. */
const LEAKS: readonly RegExp[] = [
  // A metric key, or any other snake_case field name.
  /\b[a-z]+_[a-z_]+\b/,
  // A prompt alias.
  /\b[ts]\d{1,3}\b/i,
  // Eight hex characters with a digit and a letter among them: a UUID prefix.
  /\b(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{8}\b/i,
]

/**
 * Per-section verification. The schema is a flat object of independent parts, so
 * a section that cites an id we do not have, or whose prose carries one, is
 * replaced by the computed one rather than sinking the whole digest.
 */
function ground(model: Digest, input: DigestInput, aliases: Aliases): Digest {
  const themeIds = new Set(input.themes.map((theme) => theme.id))
  const shippedIds = new Set((input.shipped ?? []).map((s) => s.id))
  const known = new Set([...themeIds, ...shippedIds])
  const computed = compute(input)
  // An id the model made up stays as written and fails the checks below.
  const real = (id: string): string => aliases.back.get(id.trim()) ?? id
  const clean = (text: string): boolean =>
    text.trim().length > 0 && !LEAKS.some((pattern) => pattern.test(text)) && ![...known].some((id) => text.includes(id))
  const prose = (text: string, fallback: string): string => (clean(text) ? text : fallback)

  const fixFirst = model.fixFirst
    .map((entry) => ({ ...entry, themeId: real(entry.themeId), evidence: entry.evidence.map(real) }))
    .filter((entry) => themeIds.has(entry.themeId) && entry.evidence.every((id) => known.has(id)))
    .flatMap((entry) => {
      const theme = input.themes.find((t) => t.id === entry.themeId)
      if (!theme || theme.sentiment === 'praise') return []
      return [
        {
          ...entry,
          title: prose(entry.title, theme.label.slice(0, 70)),
          why: prose(entry.why, whyFor(theme)),
          // Reach and impact are ours. Only the title, the reasoning and the
          // effort guess are the model's to contribute.
          reporterCount: theme.reporterCount,
          impact: theme.impact,
        },
      ]
    })
    .slice(0, 3)

  const wins = model.wins
    .map((win) => ({ ...win, evidence: win.evidence.map(real) }))
    // A win citing nothing passed `every` on an empty list.
    .filter((win) => win.evidence.length > 0 && win.evidence.every((id) => known.has(id)) && clean(win.title))
    .slice(0, 2)
  const regressions = model.regressions
    .map((regression) => ({ ...regression, themeId: real(regression.themeId) }))
    .filter((regression) => themeIds.has(regression.themeId) && clean(regression.note))
    .slice(0, 2)

  return {
    headline: prose(model.headline, computed.headline),
    weekSummary: prose(model.weekSummary, computed.weekSummary),
    quiet: computed.quiet,
    // Metrics are never the model's to restate.
    metrics: computed.metrics,
    fixFirst: fixFirst.length > 0 ? fixFirst : computed.fixFirst,
    wins: wins.length > 0 ? wins : computed.wins,
    regressions: regressions.length > 0 ? regressions : computed.regressions,
    nextStep: prose(model.nextStep, computed.nextStep),
  }
}

// --- public entry point -----------------------------------------------------

function hashOf(input: DigestInput): string {
  return inputHash(SCHEMA_VERSION.digest, {
    creatorId: input.creatorId,
    projectId: input.projectId,
    isoWeek: input.isoWeek,
    metrics: input.metrics.map((m) => `${m.key}:${m.value}:${m.previous}`).sort(),
    themes: input.themes.map((t) => `${t.id}:${t.impact}:${t.reporterCount}:${t.status}`).sort(),
    shipped: (input.shipped ?? []).map((s) => s.id).sort(),
  })
}

/**
 * One digest for one project for one week. A past week is never regenerated:
 * the digest is a record of what was true then, and rewriting it later would
 * make it worthless as one.
 */
export async function generate(input: DigestInput, options: DigestOptions = {}): Promise<AiResult<Digest>> {
  const startedAt = Date.now()
  const key = {
    feature: FEATURE,
    subjectType: 'user' as const,
    subjectId: `${input.creatorId}:${input.projectId}:${input.isoWeek}`,
    inputHash: hashOf(input),
    schemaVersion: SCHEMA_VERSION.digest,
  }

  // A stored fallback is not an answer. Serving one meant a provider blip on
  // Monday fixed the computed brief in place for the rest of the week, with a
  // working model never asked again.
  const cached = readArtifact<Digest>(key)
  if (cached && cached.source !== 'heuristic' && !options.refresh) {
    return {
      data: cached.payload,
      source: 'cached',
      ...(cached.model ? { model: cached.model } : {}),
      ms: Date.now() - startedAt,
      generatedAt: new Date(cached.generatedAt).toISOString(),
    }
  }

  const verdict = shouldSend(input)
  if (options.skipModel && verdict.send) {
    return {
      data: compute(input),
      source: 'heuristic',
      ms: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
    }
  }
  if (!verdict.send) {
    return {
      data: compute(input),
      source: 'heuristic',
      ms: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
      degraded: verdict.reason === 'cadence_off' ? 'disabled_by_user' : 'gated',
    }
  }

  const aliases = aliasesFor(input)
  const outcome = await callValidated(
    {
      feature: FEATURE,
      system: SYSTEM,
      user: buildUserTurn(input, aliases),
      toolName: 'write_digest',
      toolDescription: 'Write the weekly brief from the supplied structured summary.',
      schema: DIGEST_JSON_SCHEMA,
      ...(options.signal ? { signal: options.signal } : {}),
    },
    DigestSchema,
    { userId: input.creatorId },
  )

  if (!outcome.ok) {
    const computed = compute(input)
    return {
      data: computed,
      source: 'heuristic',
      ms: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
      degraded: outcome.reason,
    }
  }

  const grounded = ground(outcome.data, input, aliases)
  writeArtifact(key, grounded, 'ai', outcome.model)
  return {
    data: grounded,
    source: 'ai',
    model: outcome.model,
    ms: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
  }
}

export function digestLabel(result: AiResult<Digest>): string {
  return result.source === 'heuristic' ? FEATURE_POLICY.digest.heuristicLabel : FEATURE_POLICY.digest.aiLabel
}

export type { Digest }
