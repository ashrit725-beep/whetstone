import './guard'
import { FEATURE_POLICY, RATE_LIMITS, SCHEMA_VERSION } from './config'
import { inputHash } from './hash'
import { callValidated } from './provider'
import { stripContactDetails, UNTRUSTED_CONTENT_RULE, wrapUntrusted } from './redact'
import { IntakeSuggestionSchema, INTAKE_JSON_SCHEMA, type IntakeSuggestion } from './schemas'
import { countRunsSince, readArtifact, writeArtifact } from './store'
import { normalise, titleCase, tokens } from './text'
import {
  DEFAULT_AXES,
  HOST_RULES,
  OPTIONAL_AXES,
  PROJECT_TYPES,
  STAGE_KEYWORDS,
  TAG_VOCABULARY,
  TYPE_KEYWORDS,
  type AxisSpec,
  type ProjectStage,
  type ProjectType,
} from './taxonomy'
import type { AiResult } from './types'

/**
 * Feature 3: the project intake assistant.
 *
 * From a description and some links, suggest a project type, a stage, tags, the
 * rating axes reviewers will score, and a sharper ask.
 *
 * The trigger is explicit and nothing here writes to a form on its own. Results
 * come back as unsaved values the creator edits and submits, which is both the
 * polite behaviour and the accessible one: a form that rearranges itself under
 * someone's cursor is an unexpected context change.
 *
 * The deterministic path is worth more than it sounds, because the axis library
 * is the source of truth on both paths. The model only ever swaps an axis or
 * two; with no key the creator gets the curated defaults plus a picker, which
 * is most of the feature.
 */

const FEATURE = 'intake' as const
const MIN_DESCRIPTION_CHARS = 120
const TYPE_CONFIDENCE_FLOOR = 2.5
const TYPE_AMBIGUITY_MARGIN = 1.2

export type LinkMetadata = {
  url: string
  title?: string
  description?: string
  /** First few thousand characters of a readme or page body. */
  body?: string
}

export type IntakeInput = {
  description: string
  links?: readonly string[]
  linkMetadata?: readonly LinkMetadata[]
  /** Answers to the guided ask template, when the creator used it. */
  askAnswers?: { stage?: string; decision?: string; ignore?: string }
  userId?: string
}

export type IntakeOptions = { signal?: AbortSignal; refresh?: boolean }

// --- deterministic classification -------------------------------------------

type TypeScores = Map<ProjectType, number>

function scoreTypes(input: IntakeInput): TypeScores {
  const haystack = normalise(
    [
      input.description,
      ...(input.linkMetadata ?? []).flatMap((m) => [m.title ?? '', m.description ?? '', (m.body ?? '').slice(0, 4000)]),
    ].join(' \n '),
  )
  const scores: TypeScores = new Map(PROJECT_TYPES.map((type) => [type, 0]))

  for (const type of PROJECT_TYPES) {
    let total = 0
    for (const [term, weight] of TYPE_KEYWORDS[type]) {
      const needle = normalise(term)
      if (needle.length === 0) continue
      let from = 0
      let hits = 0
      for (;;) {
        const at = haystack.indexOf(needle, from)
        if (at === -1) break
        hits += 1
        from = at + needle.length
        if (hits >= 3) break
      }
      // Diminishing returns per term, so one word repeated cannot decide a type.
      if (hits > 0) total += weight * (1 + Math.log(hits))
    }
    scores.set(type, total)
  }

  // Host rules score above any keyword, because they are usually decisive.
  for (const url of input.links ?? []) {
    const host = hostOf(url)
    if (!host) continue
    for (const [pattern, type, weight] of HOST_RULES) {
      if (pattern.test(host)) scores.set(type, (scores.get(type) ?? 0) + weight)
    }
  }
  return scores
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname
  } catch {
    return undefined
  }
}

type TypeVerdict = {
  type: ProjectType
  confidence: IntakeSuggestion['projectType']['confidence']
  /** Populated when two types are too close to call, so the UI offers a choice. */
  alternative?: ProjectType
}

function classifyType(input: IntakeInput): TypeVerdict {
  const ranked = [...scoreTypes(input).entries()].sort(
    ([typeA, a], [typeB, b]) => b - a || (typeA < typeB ? -1 : 1),
  )
  const first = ranked[0]
  const second = ranked[1]
  if (!first || first[1] < TYPE_CONFIDENCE_FLOOR) {
    // Below the floor the honest answer is that we could not tell. A wrong
    // pre-fill costs the creator more than an empty one.
    return { type: first?.[0] ?? 'web_app', confidence: 'low' }
  }
  if (second && first[1] - second[1] < TYPE_AMBIGUITY_MARGIN) {
    return { type: first[0], confidence: 'low', alternative: second[0] }
  }
  return { type: first[0], confidence: first[1] >= TYPE_CONFIDENCE_FLOOR * 2.5 ? 'high' : 'medium' }
}

function classifyStage(input: IntakeInput): ProjectStage {
  const haystack = [input.description, input.askAnswers?.stage ?? ''].join(' ')
  for (const [stage, pattern] of STAGE_KEYWORDS) {
    if (pattern.test(haystack)) return stage
  }
  return 'prototype'
}

function suggestTags(input: IntakeInput, type: ProjectType): IntakeSuggestion['tags'] {
  const present = new Set(
    tokens([input.description, ...(input.linkMetadata ?? []).map((m) => m.title ?? '')].join(' ')),
  )
  // Padded so the match is on whole words. A substring test would pull the tag
  // "go" out of the word "godot", which is how tag lists become noise.
  const flat = ` ${normalise(input.description)} `
  const tags: IntakeSuggestion['tags'] = []
  for (const tag of TAG_VOCABULARY) {
    const readable = tag.replace(/-/g, ' ')
    const head = readable.split(' ')[0] ?? ''
    if (flat.includes(` ${readable} `) || (head.length >= 3 && present.has(head))) {
      tags.push({ value: tag, fromTaxonomy: true })
    }
    if (tags.length >= 8) break
  }
  if (tags.length === 0) {
    const typeTag = type.replace(/_/g, '-')
    tags.push({ value: typeTag, fromTaxonomy: TAG_VOCABULARY.includes(typeTag) })
  }
  return tags.slice(0, 8)
}

function axesFor(type: ProjectType): IntakeSuggestion['ratingAxes'] {
  return DEFAULT_AXES[type].map((axis) => ({
    key: axis.key,
    label: axis.label,
    description: axis.description,
    why: 'Default axis for this project type.',
  }))
}

/**
 * The guided ask builder. Three questions compose into the same structure the
 * model returns, which for a creator who knows their project is arguably better
 * than a generated paragraph.
 */
function buildAsk(input: IntakeInput, type: ProjectType, stage: ProjectStage): IntakeSuggestion['ask'] {
  const decision = input.askAnswers?.decision?.trim()
  const ignore = input.askAnswers?.ignore?.trim()
  const stageWords: Record<ProjectStage, string> = {
    concept: 'still a concept',
    prototype: 'a prototype',
    alpha: 'in alpha',
    beta: 'in beta',
    launch_ready: 'close to launch',
  }
  const headline = decision
    ? truncate(titleCase(firstClause(decision)), 90)
    : `What to look at in this ${readableType(type)}`
  const bodyParts: string[] = []
  bodyParts.push(`This is ${stageWords[stage]}.`)
  if (decision) bodyParts.push(`The decision I am stuck on: ${decision}`)
  else bodyParts.push('Tell me where you stalled, and what you expected to happen instead.')
  if (ignore) bodyParts.push(`Please skip: ${ignore}`)
  return {
    headline,
    body: truncate(bodyParts.join(' '), 400),
    ignoreList: ignore ? [truncate(ignore, 60)] : defaultIgnoreList(stage),
  }
}

function defaultIgnoreList(stage: ProjectStage): string[] {
  if (stage === 'concept' || stage === 'prototype') return ['placeholder art', 'unfinished copy']
  if (stage === 'alpha') return ['known rough edges in menus']
  return []
}

function readableType(type: ProjectType): string {
  return type.replace(/_/g, ' ')
}

function firstClause(text: string): string {
  const clause = text.split(/[.!?;]/)[0] ?? text
  return clause.trim()
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= max) return clean
  const cut = clean.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

function clarifyingFor(verdict: TypeVerdict, input: IntakeInput): string[] {
  const questions: string[] = []
  if (verdict.confidence === 'low') {
    questions.push(
      verdict.alternative
        ? `Is this closer to a ${readableType(verdict.type)} or a ${readableType(verdict.alternative)}?`
        : 'Which kind of project is this?',
    )
  }
  if (!input.askAnswers?.decision) questions.push('What decision are you stuck on right now?')
  if (!input.askAnswers?.ignore) questions.push('What should reviewers skip?')
  return questions.slice(0, 3)
}

/** Taxonomy matching plus the guided ask builder. No key, no network. */
export function heuristic(input: IntakeInput): AiResult<IntakeSuggestion> {
  const startedAt = Date.now()
  return {
    data: buildDeterministic(input),
    source: 'heuristic',
    ms: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
  }
}

function buildDeterministic(input: IntakeInput): IntakeSuggestion {
  const verdict = classifyType(input)
  const stage = classifyStage(input)
  return {
    projectType: { value: verdict.type, confidence: verdict.confidence },
    stage,
    tags: suggestTags(input, verdict.type),
    ratingAxes: axesFor(verdict.type),
    ask: buildAsk(input, verdict.type, stage),
    clarifyingQuestions: clarifyingFor(verdict, input),
  }
}

// --- link metadata ----------------------------------------------------------

/**
 * The server fetches link metadata itself rather than handing a model a browsing
 * tool, so exactly what enters the prompt is under our control: an allowlist of
 * hosts, a three second deadline, no redirect off the original host, and a hard
 * character cap per link.
 */
const LINK_ALLOWLIST: readonly RegExp[] = [
  /^github\.com$/i,
  /^gitlab\.com$/i,
  /^itch\.io$/i,
  /^[a-z0-9-]+\.itch\.io$/i,
  /^store\.steampowered\.com$/i,
  /^www\.youtube\.com$/i,
  /^youtu\.be$/i,
  /^vimeo\.com$/i,
  /^www\.figma\.com$/i,
  /^www\.npmjs\.com$/i,
  /^crates\.io$/i,
  /^pypi\.org$/i,
  /^apps\.apple\.com$/i,
  /^play\.google\.com$/i,
]

const LINK_TIMEOUT_MS = 3000
const LINK_BODY_CHARS = 4000
const LINK_CACHE_TTL_MS = 86_400_000
const MAX_LINKS = 3

const linkCache = new Map<string, { value: LinkMetadata; readAt: number }>()

export async function fetchLinkMetadata(urls: readonly string[]): Promise<LinkMetadata[]> {
  const out: LinkMetadata[] = []
  for (const url of urls.slice(0, MAX_LINKS)) {
    const host = hostOf(url)
    if (!host || !LINK_ALLOWLIST.some((rule) => rule.test(host))) continue
    const hit = linkCache.get(url)
    if (hit && Date.now() - hit.readAt < LINK_CACHE_TTL_MS) {
      out.push(hit.value)
      continue
    }
    const fetched = await fetchOne(url, host)
    if (fetched) {
      linkCache.set(url, { value: fetched, readAt: Date.now() })
      out.push(fetched)
    }
  }
  return out
}

async function fetchOne(url: string, host: string): Promise<LinkMetadata | undefined> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), LINK_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: 'manual',
      headers: { accept: 'text/html,text/plain' },
    })
    if (!response.ok) return undefined
    const finalHost = hostOf(response.url) ?? host
    if (finalHost !== host) return undefined
    const html = (await response.text()).slice(0, 200_000)
    return {
      url,
      ...pick('title', metaTitle(html)),
      ...pick('description', metaDescription(html)),
      ...pick('body', stripContactDetails(stripTags(html)).slice(0, LINK_BODY_CHARS)),
    }
  } catch {
    return undefined
  } finally {
    clearTimeout(timer)
  }
}

function pick(key: 'title' | 'description' | 'body', value: string | undefined): Record<string, string> {
  return value && value.length > 0 ? { [key]: value } : {}
}

function metaTitle(html: string): string | undefined {
  const og = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']{1,200})["']/i.exec(html)
  if (og?.[1]) return decodeEntities(og[1])
  const title = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(html)
  return title?.[1] ? decodeEntities(title[1]) : undefined
}

function metaDescription(html: string): string | undefined {
  const match =
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']{1,400})["']/i.exec(html) ??
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']{1,400})["']/i.exec(html)
  return match?.[1] ? decodeEntities(match[1]) : undefined
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '”')
    .replace(/&#39;/g, '’')
}

// --- prompt -----------------------------------------------------------------

const AXIS_LIBRARY = Object.entries(DEFAULT_AXES)
  .map(([type, axes]) => `${type}: ${axes.map((a) => `${a.key} (${a.label})`).join(', ')}`)
  .join('\n')

const SYSTEM = [
  'You classify a work-in-progress into a fixed taxonomy and sharpen the creator’s request for feedback.',
  '',
  `Project types, and nothing outside this list: ${PROJECT_TYPES.join(', ')}.`,
  'Stages: concept, prototype, alpha, beta, launch_ready.',
  '',
  'Default rating axes per type. Start from these and swap at most two for project-specific ones,',
  'giving a one-clause justification for each swap:',
  AXIS_LIBRARY,
  '',
  `Optional axes to swap in: ${OPTIONAL_AXES.map((a) => a.key).join(', ')}.`,
  `Tag vocabulary: ${TAG_VOCABULARY.join(', ')}. A tag outside it is allowed but must be marked fromTaxonomy false.`,
  '',
  'A good ask names four things: the decision the creator faces, the stage the work is at,',
  'what reviewers should ignore, and one concrete question.',
  'Before: “any feedback welcome”. After: “I am deciding whether to cut crafting before launch:',
  'tell me whether runs three to five feel repetitive without it. Ignore placeholder art.”',
  'Before: “thoughts on my landing page?”. After: “I am choosing between leading with the price',
  'or the demo video. Tell me which one you would click. Ignore the footer.”',
  '',
  'If the description is too thin to classify with confidence, return confidence "low" and fewer suggestions',
  'with clarifying questions instead. A wrong pre-filled field costs the creator more than an empty one.',
  '',
  UNTRUSTED_CONTENT_RULE,
].join('\n')

function buildUserTurn(input: IntakeInput): string {
  const lines: string[] = []
  lines.push('The creator’s description:')
  lines.push(wrapUntrusted('project_description', 'description', input.description, 4000))
  for (const [index, meta] of (input.linkMetadata ?? []).slice(0, MAX_LINKS).entries()) {
    lines.push('')
    lines.push(`Link ${index + 1}: ${meta.url}`)
    lines.push(
      wrapUntrusted(
        'link_metadata',
        `link${index + 1}`,
        [meta.title ?? '', meta.description ?? '', meta.body ?? ''].join('\n'),
        LINK_BODY_CHARS,
      ),
    )
  }
  if (input.askAnswers) {
    lines.push('')
    lines.push('The creator answered the guided ask questions:')
    if (input.askAnswers.stage) lines.push(`Stage: ${input.askAnswers.stage.slice(0, 200)}`)
    if (input.askAnswers.decision) lines.push(`Decision they are stuck on: ${input.askAnswers.decision.slice(0, 400)}`)
    if (input.askAnswers.ignore) lines.push(`What to ignore: ${input.askAnswers.ignore.slice(0, 200)}`)
  }
  return lines.join('\n')
}

// --- public entry point -----------------------------------------------------

function hashOf(input: IntakeInput): string {
  return inputHash(SCHEMA_VERSION.intake, {
    description: input.description.trim(),
    links: [...(input.links ?? [])].sort(),
    askAnswers: input.askAnswers ?? {},
  })
}

/**
 * Suggestions for the new-project form. Explicit trigger only: a caller should
 * bind this to a button, never to a change or blur event.
 */
export async function generate(input: IntakeInput, options: IntakeOptions = {}): Promise<AiResult<IntakeSuggestion>> {
  const startedAt = Date.now()
  const hash = hashOf(input)
  const key = {
    feature: FEATURE,
    subjectType: 'user' as const,
    subjectId: input.userId ?? 'anonymous',
    inputHash: hash,
    schemaVersion: SCHEMA_VERSION.intake,
  }

  if (!options.refresh) {
    const cached = readArtifact<IntakeSuggestion>(key)
    if (cached) {
      return {
        data: cached.payload,
        source: 'cached',
        ...(cached.model ? { model: cached.model } : {}),
        ms: Date.now() - startedAt,
        generatedAt: new Date(cached.generatedAt).toISOString(),
      }
    }
  }

  if (input.description.trim().length < MIN_DESCRIPTION_CHARS) {
    return finish(input, startedAt, 'gated')
  }
  if (input.userId) {
    const recent = countRunsSince(FEATURE, Date.now() - 3_600_000, { userId: input.userId })
    if (recent >= RATE_LIMITS.intakePerUserPerHour) return finish(input, startedAt, 'rate_limited')
  }

  const outcome = await callValidated(
    {
      feature: FEATURE,
      system: SYSTEM,
      user: buildUserTurn(input),
      toolName: 'suggest_project_details',
      toolDescription: 'Classify the project and sharpen the creator’s ask.',
      schema: INTAKE_JSON_SCHEMA,
      ...(options.signal ? { signal: options.signal } : {}),
    },
    IntakeSuggestionSchema,
    input.userId ? { userId: input.userId } : {},
  )

  if (!outcome.ok) return finish(input, startedAt, outcome.reason)

  const merged = reconcile(outcome.data, input)
  writeArtifact(key, merged, 'ai', outcome.model)
  return {
    data: merged,
    source: 'ai',
    model: outcome.model,
    ms: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Post-processing the model does not get to skip: tags outside the vocabulary
 * are kept but flagged, so they render as a chip the creator has to accept
 * rather than silently polluting the taxonomy, and an axis list that came back
 * short is topped up from the curated defaults.
 */
function reconcile(suggestion: IntakeSuggestion, input: IntakeInput): IntakeSuggestion {
  const type = suggestion.projectType.value
  const tags = suggestion.tags.map((tag) => ({
    value: tag.value,
    fromTaxonomy: TAG_VOCABULARY.includes(tag.value),
  }))
  const axes = [...suggestion.ratingAxes]
  for (const axis of DEFAULT_AXES[type]) {
    if (axes.length >= 3) break
    if (axes.some((a) => a.key === axis.key)) continue
    axes.push({ key: axis.key, label: axis.label, description: axis.description, why: 'Default axis for this type.' })
  }
  return { ...suggestion, tags, ratingAxes: axes.slice(0, 6) }
}

function finish(
  input: IntakeInput,
  startedAt: number,
  degraded: AiResult<IntakeSuggestion>['degraded'],
): AiResult<IntakeSuggestion> {
  return {
    data: buildDeterministic(input),
    source: 'heuristic',
    ms: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
    ...(degraded ? { degraded } : {}),
  }
}

/** The full axis picker the form shows beside the suggestion, on either path. */
export function axisPicker(type: ProjectType): { defaults: readonly AxisSpec[]; optional: readonly AxisSpec[] } {
  return { defaults: DEFAULT_AXES[type], optional: OPTIONAL_AXES }
}

export function intakeLabel(result: AiResult<IntakeSuggestion>): string {
  return result.source === 'heuristic' ? FEATURE_POLICY.intake.heuristicLabel : FEATURE_POLICY.intake.aiLabel
}

export type { IntakeSuggestion }
