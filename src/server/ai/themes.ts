import './guard'
import { checkBudget, noteSpend } from './budget'
import { breakerAllows, recordFailure, recordSuccess } from './breaker'
import { recordRun } from './store'
import { costMicros } from './config'
import { slugify } from '@/lib/utils'
import { clusterGreedy, denseOps, representative, sparseOps, type Cluster, type VectorOps } from './cluster'
import { FEATURE_POLICY, RATE_LIMITS, SCHEMA_VERSION } from './config'
import { impactOf } from './impact'
import { typeFromText } from './lexicon'
import { embed } from './openai-compat'
import { anyProviderConfigured, callValidated } from './provider'
import { isVerbatimQuote, UNTRUSTED_CONTENT_RULE, wrapUntrusted } from './redact'
import { ThemeReportSchema, THEME_REPORT_JSON_SCHEMA, type Theme, type ThemeReport } from './schemas'
import { readArtifact, readLatestArtifact, writeArtifact } from './store'
import {
  buildIdf,
  centroidOf,
  excerpt,
  expandTerm,
  surfaceForms,
  tfidfVector,
  titleCase,
  tokens,
  topTerm,
  unigramsAndBigrams,
  type Vector,
} from './text'
import type { ProjectType } from './taxonomy'
import type { AiResult, FeedbackInput, Severity } from './types'
import { inputHash } from './hash'

/**
 * Feature 1: feedback theme clustering.
 *
 * N raw feedback points become ranked themes: a label, a one-line summary,
 * verbatim quotes, a member list and an impact estimate.
 *
 * The deterministic path is not a placeholder. It exploits a signal the model
 * has to derive for itself: the structured composer already scoped every point
 * to a category and a severity, so a large part of the clustering was done by a
 * human at write time. Partitioning on that for free and running TF-IDF inside
 * each partition gets much closer to the model's output than a bag of keywords
 * over the whole corpus would.
 */

const FEATURE = 'themes' as const
/**
 * Calibrated against real feedback rather than taken from a textbook. Two
 * phrasings of one complaint ("the jump feels floaty above 120fps" against
 * "jumping feels floaty when the framerate is high") land near 0.45 on
 * TF-IDF cosine; unrelated notes in the same category land near zero. A
 * threshold in the low twenties separates them with room on both sides.
 */
const COSINE_THRESHOLD = 0.24
/** Embedding cosine runs much hotter than TF-IDF, so its threshold is higher. */
const EMBEDDING_THRESHOLD = 0.62
const MAX_THEMES = 12
const MIN_MEMBERS = 2
/** Above this share of dropped themes the whole artifact is untrustworthy. */
const MAX_DROP_RATIO = 0.3

export type ThemesInput = {
  projectId: string
  projectType?: ProjectType
  /** What the creator asked reviewers to look at. Weights relevance. */
  ask?: string
  /** The project's category vocabulary, key to label. */
  categories?: ReadonlyArray<{ key: string; label: string }>
  items: readonly FeedbackInput[]
}

export type ThemesOptions = {
  /** Forces a model run even when a cached artifact matches. */
  refresh?: boolean
  signal?: AbortSignal
  userId?: string
  /**
   * Answer from what is already known (a matching artifact, the last model
   * board, or the local clusterer) and never call a model. For page renders,
   * which schedule the model run separately so it can take the time it needs.
   */
  skipModel?: boolean
}

// --- deterministic path -----------------------------------------------------

type Bucket = 'praise' | 'problem'

function bucketOf(item: FeedbackInput): Bucket {
  if (item.severity === 'praise') return 'praise'
  const ratings = item.axisRatings ? Object.values(item.axisRatings) : []
  if (ratings.length > 0 && item.severity === 'nit') {
    const scale = item.scaleMax ?? 5
    const mean = ratings.reduce((sum, n) => sum + n, 0) / ratings.length
    if (mean > scale * 0.7) return 'praise'
  }
  return 'problem'
}

function themeSentiment(members: readonly FeedbackInput[]): Theme['sentiment'] {
  let praise = 0
  let request = 0
  for (const item of members) {
    if (item.severity === 'praise') praise += 1
    if (typeFromText(item.text) === 'feature_request') request += 1
  }
  if (praise === members.length) return 'praise'
  if (request > members.length / 2) return 'request'
  if (praise > 0) return 'mixed'
  return 'problem'
}

/** Deterministic ordering. Two runs over the same rows produce the same board. */
function stableSort(items: readonly FeedbackInput[]): FeedbackInput[] {
  return [...items].sort((a, b) => {
    const lengthDelta = b.text.length - a.text.length
    if (lengthDelta !== 0) return lengthDelta
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

/**
 * The label for a group no model named: the opening sentence of the note that
 * best carries the group's distinctive terms, in that reviewer's own words.
 *
 * This used to be the single highest-weighted term, title-cased, which on real
 * projects produced "Fine Wrong", "Saw Treat" and "Quietest Good": two words
 * that are distinctive to a cluster are rarely a phrase. A sentence a person
 * wrote always is, and it is honest about where it came from.
 */
function labelFor(centroid: Vector, members: readonly FeedbackInput[], fallbackCategory: string): string {
  const terms = [...centroid.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([term]) => term)
  const ranked = [...members]
    .map((member) => {
      const lower = member.text.toLowerCase()
      return { member, score: terms.reduce((n, term) => n + (lower.includes(term) ? 1 : 0), 0) }
    })
    .sort((a, b) => b.score - a.score || a.member.text.length - b.member.text.length)
  for (const { member } of ranked) {
    const sentence = openingSentence(member.text)
    if (sentence) return sentence
  }
  return sentenceCase(fallbackCategory.replace(/[_-]+/g, ' '))
}

const LABEL_MAX = 60

/** The first sentence of a note that reads as a label, or undefined. */
function openingSentence(text: string): string | undefined {
  const sentences = text
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
  for (const raw of sentences) {
    const s = raw
      .replace(/^[“"'‘(\[]+/u, '')
      .replace(/[”"'’)\]]+$/u, '')
      .replace(/[.!?…:;,]+$/u, '')
      .trim()
    if (s.length < 14 || s.split(' ').length < 3) continue
    if (s.length <= LABEL_MAX) return sentenceCase(s)
    // A long sentence is cut at its first clause break if that leaves enough
    // to stand alone, and otherwise at a word, marked as cut.
    const clause = s.slice(0, LABEL_MAX).search(/[,;:–—](?=[^,;:–—]*$)/u)
    if (clause >= 24) return sentenceCase(s.slice(0, clause))
    const cut = s.slice(0, LABEL_MAX - 1)
    const space = cut.lastIndexOf(' ')
    return `${sentenceCase((space > 24 ? cut.slice(0, space) : cut).replace(/[\s,;:–—-]+$/u, ''))}…`
  }
  return undefined
}

function sentenceCase(text: string): string {
  const t = text.trim()
  return t.length === 0 ? t : t[0]!.toUpperCase() + t.slice(1)
}

function buildTheme<V>(
  cluster: Cluster<FeedbackInput, V>,
  ops: VectorOps<V>,
  label: string,
  categoryKey: string,
  categoryLabel: string,
  usedIds: Set<string>,
): Theme | undefined {
  const members = cluster.members
  if (members.length < MIN_MEMBERS) return undefined
  const rep = representative(cluster, ops) ?? members[0]
  if (!rep) return undefined

  const impact = impactOf(members)
  const sentiment = themeSentiment(members)
  const base = slugify(`${categoryKey}-${label}`)
  let id = base
  let suffix = 2
  while (usedIds.has(id)) {
    id = `${base}-${suffix}`
    suffix += 1
  }
  usedIds.add(id)

  return {
    id,
    label,
    summary: `${members.length} ${members.length === 1 ? 'point' : 'points'} in ${categoryLabel}, from ${impact.distinctReviewers} ${impact.distinctReviewers === 1 ? 'reviewer' : 'reviewers'}.`,
    categoryKey,
    sentiment,
    memberFeedbackIds: members.map((m) => m.id),
    quotes: [{ feedbackId: rep.id, text: excerpt(rep.text, 220) }],
    impact: {
      score: impact.score,
      reason: impact.reason,
      distinctReviewers: impact.distinctReviewers,
      meanSeverity: impact.meanSeverity,
    },
    confidence: confidenceFor(members),
  }
}

/**
 * A readable label for a group whose vectors are dense embeddings. The
 * embedding has no terms to read, so the label comes from a small TF-IDF pass
 * over the group's own members: semantic grouping, lexical naming.
 */
function lexicalLabel(members: readonly FeedbackInput[], categoryLabel: string): string {
  const documents = members.map((member) => unigramsAndBigrams(member.text))
  const idf = buildIdf(documents)
  const centroid = centroidOf(documents.map((doc) => tfidfVector(doc, idf)))
  return labelFor(centroid, members, categoryLabel)
}

/**
 * Confidence is a rule over what a theme holds, not an opinion: five or more
 * points from three or more people is high, three from two is medium. The
 * board prints the rule beside the word, so a model's own grade is replaced
 * with this one wherever a theme is shown.
 */
export function confidenceFor(members: ReadonlyArray<Pick<FeedbackInput, 'reviewerId'>>): Theme['confidence'] {
  const reviewers = new Set(members.map((m) => m.reviewerId)).size
  if (members.length >= 5 && reviewers >= 3) return 'high'
  if (members.length >= 3 && reviewers >= 2) return 'medium'
  return 'low'
}

function categoryLabelFor(input: ThemesInput, key: string): string {
  return input.categories?.find((c) => c.key === key)?.label ?? titleCase(key.replace(/[_-]+/g, ' '))
}

/** The lexical clusterer. Runs with no key, no network and no provider. */
export function heuristic(input: ThemesInput): AiResult<ThemeReport> {
  return finishHeuristic(input, Date.now(), anyProviderConfigured() ? undefined : 'no_key')
}

function clusterLexically(input: ThemesInput): ThemeReport {
  const items = stableSort(input.items)
  if (items.length === 0) return { themes: [], unclustered: [] }

  // IDF over this project's own corpus, so its jargon stays discriminative.
  //
  // Unigrams only for the clustering vector. Bigrams are almost all unique in
  // short feedback, so including them buries the handful of shared terms that
  // carry the signal: on a representative set they cut the similarity between
  // two phrasings of one complaint roughly in half. They earn their place in
  // the label, where being distinctive is exactly what is wanted.
  const documents = items.map((item) => tokens(item.text))
  const idf = buildIdf(documents)
  const vectors = new Map<string, Vector>()
  items.forEach((item, index) => {
    vectors.set(item.id, tfidfVector(documents[index] ?? [], idf))
  })

  return assemble(
    input,
    items,
    (item) => vectors.get(item.id) ?? new Map<string, number>(),
    sparseOps,
    COSINE_THRESHOLD,
    (cluster, categoryLabel) => lexicalLabel(cluster.members, categoryLabel),
  )
}

function assemble<V>(
  input: ThemesInput,
  items: readonly FeedbackInput[],
  vectorFor: (item: FeedbackInput) => V,
  ops: VectorOps<V>,
  threshold: number,
  labelOf: (cluster: Cluster<FeedbackInput, V>, categoryLabel: string) => string,
): ThemeReport {
  const partitions = new Map<string, FeedbackInput[]>()
  for (const item of items) {
    const key = `${item.categoryKey}|${bucketOf(item)}`
    const list = partitions.get(key)
    if (list) list.push(item)
    else partitions.set(key, [item])
  }

  const themes: Theme[] = []
  const unclustered: string[] = []
  const usedIds = new Set<string>()

  for (const [key, members] of [...partitions.entries()].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const categoryKey = key.split('|')[0] ?? 'general'
    const categoryLabel = categoryLabelFor(input, categoryKey)
    const entries = members.map((item) => ({ item, vector: vectorFor(item) }))
    for (const cluster of clusterGreedy(entries, ops, threshold)) {
      const theme = buildTheme(cluster, ops, labelOf(cluster, categoryLabel), categoryKey, categoryLabel, usedIds)
      if (theme) themes.push(theme)
      else for (const member of cluster.members) unclustered.push(member.id)
    }
  }

  themes.sort((a, b) => b.impact.score - a.impact.score || (a.id < b.id ? -1 : 1))
  const kept = themes.slice(0, MAX_THEMES)
  for (const dropped of themes.slice(MAX_THEMES)) unclustered.push(...dropped.memberFeedbackIds)

  const notes =
    input.items.length > RATE_LIMITS.themesItemCap
      ? `Themed from ${RATE_LIMITS.themesItemCap} of ${input.items.length} notes, newest first.`
      : undefined

  return { themes: kept, unclustered, ...(notes ? { notes } : {}) }
}

// --- sampling ---------------------------------------------------------------

/**
 * Deterministic sampling above the item cap: everything recent, then a
 * stratified fill across categories and severities. Never a silent truncation,
 * and the UI is told how many items were used.
 */
function sampleItems(items: readonly FeedbackInput[]): FeedbackInput[] {
  if (items.length <= RATE_LIMITS.themesItemCap) return [...items]
  const cutoff = Date.now() - 30 * 86_400_000
  const recent = items.filter((i) => i.createdAt >= cutoff)
  const picked = new Map<string, FeedbackInput>()
  for (const item of recent.slice(0, RATE_LIMITS.themesItemCap)) picked.set(item.id, item)

  const byStratum = new Map<string, FeedbackInput[]>()
  for (const item of items) {
    if (picked.has(item.id)) continue
    const key = `${item.categoryKey}|${item.severity}`
    const list = byStratum.get(key)
    if (list) list.push(item)
    else byStratum.set(key, [item])
  }
  const strata = [...byStratum.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
  let cursor = 0
  while (picked.size < RATE_LIMITS.themesItemCap && strata.length > 0) {
    let added = false
    for (const [, list] of strata) {
      const next = list[cursor]
      if (next && !picked.has(next.id)) {
        picked.set(next.id, next)
        added = true
        if (picked.size >= RATE_LIMITS.themesItemCap) break
      }
    }
    if (!added) break
    cursor += 1
  }
  return [...picked.values()]
}

// --- prompt -----------------------------------------------------------------

const SYSTEM = [
  'You group product feedback by the underlying problem, not by vocabulary.',
  '',
  'The discriminating rule: two notes belong to the same theme if and only if a single fix would address both.',
  'Same symptom with a different cause is two themes. Different symptoms with one cause is one theme.',
  '',
  'Worked examples that belong together:',
  '- “the double jump feels floaty” and “movement is unresponsive above 120fps”: one input-timing fix addresses both.',
  '- “I could not tell which card was selected” and “the highlight is too subtle on the deck screen”: one contrast fix.',
  '- “npm install failed on node 20” and “the postinstall script errors on a clean machine”: one install fix.',
  '',
  'Near misses that must stay apart:',
  '- “the tutorial is too long” and “the tutorial never explained crafting”: one is pacing, one is coverage.',
  '- “loading takes 40 seconds” and “the loading screen has no progress bar”: one is speed, one is feedback.',
  '- “combat is too hard” and “combat is repetitive”: difficulty and variety are different fixes.',
  '',
  'Length: a label is at most eight words (60 characters) and names the problem; a summary is one sentence',
  '(240 characters at most); an impact reason is one short clause (160 characters at most).',
  '',
  'Quote selection: verbatim, 220 characters at most, a contiguous substring of exactly one source note.',
  'Choose the quote that represents the group most clearly, not the longest or the angriest one.',
  'Return the source id with every quote; quotes are verified against the stored text and a theme whose quote',
  'does not verify is discarded before anything is shown to a creator.',
  '',
  'Impact is a 0 to 100 integer on a fixed rubric, so numbers stay comparable across projects:',
  'impact = 45% reach (distinct reviewers, with diminishing returns past four) + 35% mean severity + 20% reviewer credibility.',
  'Return the number and the inputs you used.',
  '',
  'Anti-patterns: do not invent a theme grounded in fewer than two notes; do not merge a compliment and a complaint',
  'about the same subsystem; leave genuinely singular notes in the unclustered array rather than forcing them.',
  'Use the category keys supplied in the user turn and no others.',
  '',
  UNTRUSTED_CONTENT_RULE,
].join('\n')

/**
 * Short names for the notes and reviewers in one prompt.
 *
 * Feedback ids are UUIDs, about twenty tokens each, and the report repeats
 * them in every theme's member list, every quote and the unclustered list.
 * On a 45-note project that was most of the output, and output is what a
 * model spends its time on: the middle Anthropic tier ran past the sixty-second
 * deadline writing ids out. `n1`…`nK` costs two tokens apiece. The mapping
 * lives only for the length of one call and is undone before verification,
 * so nothing downstream ever sees an alias.
 */
interface Aliases {
  readonly items: ReadonlyMap<string, string>
  readonly reviewers: ReadonlyMap<string, string>
  readonly back: ReadonlyMap<string, string>
}

function aliasesFor(items: readonly FeedbackInput[]): Aliases {
  const itemAlias = new Map<string, string>()
  const reviewerAlias = new Map<string, string>()
  const back = new Map<string, string>()
  const ordered = [...items].sort((a, b) => (a.id < b.id ? -1 : 1))
  ordered.forEach((item, i) => {
    const alias = `n${String(i + 1)}`
    itemAlias.set(item.id, alias)
    back.set(alias, item.id)
    if (!reviewerAlias.has(item.reviewerId)) reviewerAlias.set(item.reviewerId, `r${String(reviewerAlias.size + 1)}`)
  })
  return { items: itemAlias, reviewers: reviewerAlias, back }
}

function unalias(report: ThemeReport, aliases: Aliases): ThemeReport {
  // An id the model made up stays as written and fails verification later.
  const real = (id: string) => aliases.back.get(id.trim()) ?? id
  return {
    ...report,
    themes: report.themes.map((theme) => ({
      ...theme,
      memberFeedbackIds: theme.memberFeedbackIds.map(real),
      quotes: theme.quotes.map((quote) => ({ ...quote, feedbackId: real(quote.feedbackId) })),
    })),
    unclustered: report.unclustered.map(real),
  }
}

function buildUserTurn(
  input: ThemesInput,
  items: readonly FeedbackInput[],
  aliases: Aliases,
  existing?: ThemeReport,
): string {
  const lines: string[] = []
  lines.push(`Project type: ${input.projectType ?? 'unspecified'}`)
  if (input.ask) lines.push(`The creator asked for: ${input.ask.slice(0, 400)}`)
  if (input.categories?.length) {
    lines.push(`Category keys: ${input.categories.map((c) => `${c.key} (${c.label})`).join(', ')}`)
  }
  if (existing && existing.themes.length > 0) {
    // Delta prompting: on an incremental run the model assigns new notes to the
    // themes that already exist instead of re-reading the whole corpus.
    lines.push('')
    lines.push('Existing themes. Reuse an id when a note belongs to that theme; create a theme only when none fits:')
    for (const theme of existing.themes) lines.push(`- ${theme.id}: ${theme.label} · ${theme.summary}`)
  }
  lines.push('')
  lines.push('Notes:')
  for (const item of [...items].sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const meta = [
      `category=${item.categoryKey}`,
      `severity=${item.severity}`,
      item.axisKey ? `axis=${item.axisKey}` : '',
      `reviewer=${aliases.reviewers.get(item.reviewerId) ?? item.reviewerId}`,
      `tier=${item.reviewerTier ?? 'established'}`,
    ]
      .filter(Boolean)
      .join(' ')
    lines.push(`${meta}`)
    lines.push(wrapUntrusted('reviewer_feedback', aliases.items.get(item.id) ?? item.id, item.text, 1200))
  }
  return lines.join('\n')
}

// --- verification -----------------------------------------------------------

/**
 * Beyond zod: every cited id must exist and every quote must be a literal
 * substring of the note it claims. This is what makes a fabricated quote
 * impossible to display rather than merely unlikely.
 */
function verify(report: ThemeReport, items: readonly FeedbackInput[]): ThemeReport | undefined {
  const byId = new Map(items.map((item) => [item.id, item]))
  const kept: Theme[] = []
  for (const theme of report.themes) {
    const members = theme.memberFeedbackIds.filter((id) => byId.has(id))
    if (members.length < MIN_MEMBERS) continue
    const quotes = theme.quotes.filter((quote) => {
      const source = byId.get(quote.feedbackId)
      return source !== undefined && isVerbatimQuote(quote.text, source.text)
    })
    if (quotes.length === 0) continue
    const memberItems = members
      .map((id) => byId.get(id))
      .filter((item): item is FeedbackInput => item !== undefined)
    const measured = impactOf(memberItems)
    kept.push({
      ...theme,
      memberFeedbackIds: members,
      quotes,
      // The reach and severity terms are ours to compute, so the model's number
      // is replaced with the measured one and only its reasoning survives.
      impact: {
        score: measured.score,
        reason: theme.impact.reason.slice(0, 160) || measured.reason,
        distinctReviewers: measured.distinctReviewers,
        meanSeverity: measured.meanSeverity,
      },
      // So is confidence: a model graded two points from two people "high".
      confidence: confidenceFor(memberItems),
    })
  }
  if (report.themes.length > 0 && kept.length / report.themes.length < 1 - MAX_DROP_RATIO) return undefined
  const clustered = new Set(kept.flatMap((theme) => theme.memberFeedbackIds))
  const unclustered = items.filter((item) => !clustered.has(item.id)).map((item) => item.id)
  kept.sort((a, b) => b.impact.score - a.impact.score || (a.id < b.id ? -1 : 1))
  return { themes: kept.slice(0, MAX_THEMES), unclustered, ...(report.notes ? { notes: report.notes } : {}) }
}

/**
 * Whether a report may stand as the board for these notes.
 *
 * A reply with no themes passed `verify`, having nothing in it to fail, and was
 * cached as the answer for its input: one run of a small model left a project
 * with forty-five points and three obvious groups showing an empty board until
 * the notes changed, beside a metric that counted three open themes. An empty
 * report is now believed only when the local clusterer agrees there is nothing
 * to group; otherwise it is treated as a failed run and the ladder carries on.
 */
function standsAsBoard(report: ThemeReport, input: ThemesInput): boolean {
  return report.themes.length > 0 || clusterLexically(input).themes.length === 0
}

// --- embedding middle tier --------------------------------------------------

const EMBEDDING_MODEL = 'text-embedding-3-small'

/**
 * A genuine middle tier. Anthropic has no embeddings endpoint, so a deployment
 * with only an OpenAI key can upgrade the vectors without involving a chat
 * model: better grouping than TF-IDF for a fraction of a cent per two hundred
 * notes. Returns undefined when embeddings are unavailable, and the caller
 * falls back to the lexical path.
 */
async function clusterWithEmbeddings(
  input: ThemesInput,
  items: readonly FeedbackInput[],
  signal?: AbortSignal,
): Promise<ThemeReport | undefined> {
  // This is a paid OpenAI request. It used to sit outside every control the
  // chat path goes through: no budget ceiling, no circuit breaker, and no row
  // in `ai_run`, so a provider outage on the chat tier meant every themes
  // request also fired an unmetered embeddings call with nothing to stop it.
  const scope = { projectId: input.projectId }
  if (!checkBudget(scope).allowed) return undefined
  if (!breakerAllows('openai')) return undefined

  const startedAt = Date.now()
  const embedded = await embed(
    items.map((item) => item.text.slice(0, 2000)),
    signal,
  )
  const latencyMs = Date.now() - startedAt
  if (!embedded) {
    recordFailure('openai')
    recordRun(
      {
        feature: FEATURE,
        provider: 'openai',
        model: EMBEDDING_MODEL,
        status: 'error',
        usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0, costMicros: 0 },
        latencyMs,
        errorCode: 'embeddings_unavailable',
      },
      scope,
    )
    return undefined
  }
  recordSuccess('openai')
  const usage = {
    inputTokens: embedded.inputTokens,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  }
  const micros = costMicros(EMBEDDING_MODEL, usage)
  recordRun(
    { feature: FEATURE, provider: 'openai', model: EMBEDDING_MODEL, status: 'ok',
      usage: { ...usage, costMicros: micros }, latencyMs },
    scope,
  )
  noteSpend(micros, scope)

  const vectors = embedded.vectors
  if (vectors.length !== items.length) return undefined
  const byId = new Map<string, readonly number[]>()
  items.forEach((item, index) => {
    const vector = vectors[index]
    if (vector) byId.set(item.id, vector)
  })
  return assemble(
    input,
    stableSort(items),
    (item) => byId.get(item.id) ?? [],
    denseOps,
    EMBEDDING_THRESHOLD,
    (cluster, categoryLabel) => lexicalLabel(cluster.members, categoryLabel),
  )
}

// --- public entry point -----------------------------------------------------

function hashOf(input: ThemesInput): string {
  return inputHash(SCHEMA_VERSION.themes, {
    projectId: input.projectId,
    ask: input.ask ?? '',
    categories: input.categories?.map((c) => c.key).sort() ?? [],
    items: [...input.items]
      .map((item) => `${item.id}:${item.updatedAt ?? item.createdAt}`)
      .sort(),
  })
}

/**
 * Themes for a project. Tries the cache, then the model, then embeddings, then
 * the lexical clusterer. Never throws, and always returns a board a creator can
 * rename, merge and split.
 */
export async function generate(input: ThemesInput, options: ThemesOptions = {}): Promise<AiResult<ThemeReport>> {
  const startedAt = Date.now()
  const hash = hashOf(input)
  const scope = { projectId: input.projectId, ...(options.userId ? { userId: options.userId } : {}) }
  const key = {
    feature: FEATURE,
    subjectType: 'project' as const,
    subjectId: input.projectId,
    inputHash: hash,
    schemaVersion: SCHEMA_VERSION.themes,
  }

  if (!options.refresh) {
    const cached = readArtifact<ThemeReport>(key)
    // An empty report written before `standsAsBoard` existed is still in the
    // cache under the current hash, and would otherwise be served for as long
    // as the notes stay unchanged.
    if (cached && standsAsBoard(cached.payload, input)) {
      return {
        data: cached.payload,
        source: 'cached',
        ...(cached.model ? { model: cached.model } : {}),
        ms: Date.now() - startedAt,
        generatedAt: new Date(cached.generatedAt).toISOString(),
      }
    }
  }

  const items = sampleItems(input.items)
  if (items.length < MIN_MEMBERS) {
    return finishHeuristic(input, startedAt, 'no_key')
  }

  // The fallback is the last board that grouped something. An empty one says
  // nothing a fresh local pass would not say better.
  const previous = readLatestArtifact<ThemeReport>(
    FEATURE,
    'project',
    input.projectId,
    SCHEMA_VERSION.themes,
    (report) => report.themes.length > 0,
  )
  if (options.skipModel) {
    // The last model board, flagged with how many notes arrived since, beats
    // a fresh local one: its themes have names a person would give them.
    return degradeToPrevious(input, previous, startedAt, undefined)
  }
  const delta = shouldSendDelta(previous?.payload, items, input.items.length)
  const aliases = aliasesFor(items)

  const outcome = await callValidated(
    {
      feature: FEATURE,
      system: SYSTEM,
      user: buildUserTurn(input, items, aliases, delta ? previous?.payload : undefined),
      toolName: 'report_themes',
      toolDescription: 'Group the supplied feedback notes into themes by underlying problem.',
      schema: THEME_REPORT_JSON_SCHEMA,
      ...(options.signal ? { signal: options.signal } : {}),
    },
    ThemeReportSchema,
    scope,
  )

  if (outcome.ok) {
    const verified = verify(unalias(outcome.data, aliases), items)
    if (verified && standsAsBoard(verified, { ...input, items })) {
      writeArtifact(key, verified, 'ai', outcome.model)
      return {
        data: verified,
        source: 'ai',
        model: outcome.model,
        ms: Date.now() - startedAt,
        generatedAt: new Date().toISOString(),
      }
    }
    // Verification failed on more than the tolerated share of themes, or the
    // model grouped nothing where there is plainly something to group. The
    // output is discarded rather than partially rendered, and not cached.
    return degradeToPrevious(input, previous, startedAt, 'schema_invalid')
  }

  if (outcome.reason === 'provider_down' || outcome.reason === 'timeout' || outcome.reason === 'rate_limited') {
    const stale = degradeToPrevious(input, previous, startedAt, outcome.reason)
    if (stale.source === 'cached') return stale
  }

  const embedded = await clusterWithEmbeddings(input, items, options.signal)
  if (embedded && standsAsBoard(embedded, { ...input, items })) {
    writeArtifact(key, embedded, 'ai', EMBEDDING_MODEL)
    return {
      data: embedded,
      source: 'ai',
      model: EMBEDDING_MODEL,
      ms: Date.now() - startedAt,
      generatedAt: new Date().toISOString(),
    }
  }

  return finishHeuristic(input, startedAt, outcome.reason)
}

function shouldSendDelta(
  previous: ThemeReport | undefined,
  items: readonly FeedbackInput[],
  totalItems: number,
): boolean {
  if (!previous || previous.themes.length === 0) return false
  const known = new Set(previous.themes.flatMap((t) => t.memberFeedbackIds))
  const fresh = items.filter((item) => !known.has(item.id)).length
  return totalItems > 0 && fresh / totalItems < 0.25
}

function degradeToPrevious(
  input: ThemesInput,
  previous: { payload: ThemeReport; generatedAt: number; model?: string } | undefined,
  startedAt: number,
  reason: AiResult<ThemeReport>['degraded'],
): AiResult<ThemeReport> {
  if (previous) {
    // A note the last run left ungrouped was still read by it, so it is not new.
    const known = new Set([
      ...previous.payload.themes.flatMap((t) => t.memberFeedbackIds),
      ...previous.payload.unclustered,
    ])
    const newItems = input.items.filter((item) => !known.has(item.id)).length
    return {
      data: previous.payload,
      source: 'cached',
      ...(previous.model ? { model: previous.model } : {}),
      ms: Date.now() - startedAt,
      generatedAt: new Date(previous.generatedAt).toISOString(),
      ...(reason ? { degraded: reason } : {}),
      ...(newItems > 0 ? { stale: { newItemsSince: newItems } } : {}),
    }
  }
  return finishHeuristic(input, startedAt, reason)
}

function finishHeuristic(
  input: ThemesInput,
  startedAt: number,
  reason: AiResult<ThemeReport>['degraded'],
): AiResult<ThemeReport> {
  const report = clusterLexically(input)
  return {
    data: report,
    source: 'heuristic',
    ms: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
    ...(reason ? { degraded: reason } : {}),
  }
}

/** The honest badge for a result, so the UI never has to guess. */
export function themesLabel(result: AiResult<ThemeReport>): string {
  return result.source === 'heuristic' ? FEATURE_POLICY.themes.heuristicLabel : FEATURE_POLICY.themes.aiLabel
}

export type { Theme, ThemeReport, Severity }
