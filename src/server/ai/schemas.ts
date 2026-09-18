import './guard'
import { z } from 'zod'
import { PROJECT_TYPES, PROJECT_STAGES } from './taxonomy'

/**
 * Output contracts.
 *
 * Each feature declares two things that must agree: a JSON Schema handed to the
 * provider as a strict tool definition, and a zod schema that re-validates the
 * response server-side. The provider schema stops the model emitting anything
 * but a shaped object; the zod pass is what protects us when a provider ignores
 * its own schema, when a compatible endpoint implements it loosely, or when a
 * future model version drifts. A zod failure is never thrown to a caller: it
 * demotes the call to the deterministic path.
 *
 * The two live side by side in this file on purpose. A schema generator would
 * hide the divergence; a reviewer reading twenty lines can see it.
 */

export type JsonSchema = {
  type: 'object'
  properties: Record<string, unknown>
  required: string[]
  additionalProperties: false
}

const str = (maxLength: number, description?: string) => ({ type: 'string', maxLength, ...(description ? { description } : {}) })
const enumOf = (values: readonly string[], description?: string) => ({
  type: 'string',
  enum: [...values],
  ...(description ? { description } : {}),
})
const arrayOf = (items: unknown, maxItems: number, description?: string) => ({
  type: 'array',
  items,
  maxItems,
  ...(description ? { description } : {}),
})

/**
 * A field the model may legitimately have nothing to say about.
 *
 * OpenAI's strict function tools have no optional properties: every key in
 * `properties` must appear in `required`, and a schema that leaves one out is
 * refused with a 400. Two schemas here shipped with an optional field, so both
 * features silently ran on their deterministic path with only an `http_400` in
 * `ai_run` to show for it. The strict-mode way to say "may be absent" is to
 * require the key and allow null, which is what this does. Each zod
 * counterpart accepts null and treats it as absent.
 */
const nullableStr = (maxLength: number, description?: string) => ({
  type: ['string', 'null'],
  maxLength,
  ...(description ? { description } : {}),
})

export const CONFIDENCE = ['low', 'medium', 'high'] as const
export const SENTIMENT_LABELS = ['negative', 'mixed', 'neutral', 'positive'] as const
export const SEVERITY_LABELS = ['praise', 'nit', 'minor', 'major', 'blocker'] as const
export const FEEDBACK_TYPES = [
  'bug',
  'usability',
  'balance',
  'performance',
  'content',
  'feature_request',
  'praise',
  'off_topic',
] as const
export const THEME_SENTIMENTS = ['praise', 'problem', 'request', 'mixed'] as const

// --- 1. theme clustering ----------------------------------------------------

export const ThemeSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(60),
  summary: z.string().max(240),
  categoryKey: z.string().max(40),
  sentiment: z.enum(THEME_SENTIMENTS),
  // No minimum on either list here, though a theme needs two members and a
  // quote to be shown. `verify` in themes.ts drops a theme short of either,
  // and counts it as dropped: filtered out at this layer instead, it vanished
  // before the drop-ratio guard could see it, so a reply whose themes were
  // mostly ungrounded still passed as a small, clean board.
  memberFeedbackIds: z.array(z.string()),
  quotes: z.array(z.object({ feedbackId: z.string(), text: z.string().max(220) })).max(3),
  impact: z.object({
    score: z.number().int().min(0).max(100),
    reason: z.string().max(160),
    distinctReviewers: z.number().int().min(0),
    meanSeverity: z.enum(SEVERITY_LABELS),
  }),
  confidence: z.enum(CONFIDENCE),
})

export const ThemeReportSchema = z.object({
  themes: z.array(ThemeSchema).max(12),
  unclustered: z.array(z.string()).default([]),
  notes: z.string().max(300).nullish().transform((v) => v ?? undefined),
})

export type Theme = z.infer<typeof ThemeSchema>
export type ThemeReport = z.infer<typeof ThemeReportSchema>

export const THEME_REPORT_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    themes: arrayOf(
      {
        type: 'object',
        properties: {
          id: str(64, 'Stable slug. Reuse the slug of an existing theme when the theme is the same one.'),
          label: str(60, 'Names the underlying problem, not the vocabulary. Sentence case.'),
          summary: str(240),
          categoryKey: str(40, 'One of the category keys supplied in the user turn.'),
          sentiment: enumOf(THEME_SENTIMENTS),
          memberFeedbackIds: arrayOf({ type: 'string' }, 300, 'At least two ids, all from the supplied items.'),
          quotes: arrayOf(
            {
              type: 'object',
              properties: {
                feedbackId: { type: 'string' },
                text: str(220, 'A contiguous verbatim substring of that one item. Verified server-side.'),
              },
              required: ['feedbackId', 'text'],
              additionalProperties: false,
            },
            3,
          ),
          impact: {
            type: 'object',
            properties: {
              score: { type: 'integer', minimum: 0, maximum: 100 },
              reason: str(160),
              distinctReviewers: { type: 'integer', minimum: 0 },
              meanSeverity: enumOf(SEVERITY_LABELS),
            },
            required: ['score', 'reason', 'distinctReviewers', 'meanSeverity'],
            additionalProperties: false,
          },
          confidence: enumOf(CONFIDENCE),
        },
        required: ['id', 'label', 'summary', 'categoryKey', 'sentiment', 'memberFeedbackIds', 'quotes', 'impact', 'confidence'],
        additionalProperties: false,
      },
      12,
    ),
    unclustered: arrayOf({ type: 'string' }, 300, 'Ids that genuinely belong to no theme. Do not force them.'),
    notes: nullableStr(300, 'Null when there is nothing worth adding.'),
  },
  required: ['themes', 'unclustered', 'notes'],
  additionalProperties: false,
}

// --- 2. quality coach -------------------------------------------------------

export const COACH_CHECKS = ['specific', 'reproducible', 'contrastive', 'scoped', 'onAsk'] as const
export const COACH_VERDICTS = ['ok', 'thin', 'vague', 'off_ask'] as const

export const CoachResultSchema = z.object({
  verdict: z.enum(COACH_VERDICTS),
  checks: z.object({
    specific: z.boolean(),
    reproducible: z.boolean(),
    contrastive: z.boolean(),
    scoped: z.boolean(),
    onAsk: z.boolean(),
  }),
  suggestions: z
    .array(
      z.object({
        prompt: z.string().max(70),
        scaffold: z.string().max(120),
        check: z.enum(COACH_CHECKS),
      }),
    )
    .max(2)
    .default([]),
})

export type CoachResult = z.infer<typeof CoachResultSchema>

export const COACH_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    verdict: enumOf(COACH_VERDICTS),
    checks: {
      type: 'object',
      properties: {
        specific: { type: 'boolean' },
        reproducible: { type: 'boolean' },
        contrastive: { type: 'boolean' },
        scoped: { type: 'boolean' },
        onAsk: { type: 'boolean' },
      },
      required: ['specific', 'reproducible', 'contrastive', 'scoped', 'onAsk'],
      additionalProperties: false,
    },
    suggestions: arrayOf(
      {
        type: 'object',
        properties: {
          prompt: str(70, 'A question, twelve words at most. Never a judgement of the writing.'),
          scaffold: str(120, 'A sentence opener the reviewer can complete. Never a rewrite of their words.'),
          check: enumOf(COACH_CHECKS),
        },
        required: ['prompt', 'scaffold', 'check'],
        additionalProperties: false,
      },
      2,
      'Empty when the draft already passes four checks or more.',
    ),
  },
  required: ['verdict', 'checks', 'suggestions'],
  additionalProperties: false,
}

// --- 3. intake assistant ----------------------------------------------------

export const IntakeSuggestionSchema = z.object({
  projectType: z.object({ value: z.enum(PROJECT_TYPES), confidence: z.enum(CONFIDENCE) }),
  stage: z.enum(PROJECT_STAGES),
  tags: z.array(z.object({ value: z.string().max(32), fromTaxonomy: z.boolean() })).max(8).default([]),
  ratingAxes: z
    .array(
      z.object({
        key: z.string().max(24),
        label: z.string().max(32),
        description: z.string().max(120),
        why: z.string().max(100),
      }),
    )
    .min(3)
    .max(6),
  ask: z.object({
    headline: z.string().max(90),
    body: z.string().max(400),
    ignoreList: z.array(z.string().max(60)).max(3).default([]),
  }),
  clarifyingQuestions: z.array(z.string().max(90)).max(3).default([]),
})

export type IntakeSuggestion = z.infer<typeof IntakeSuggestionSchema>

export const INTAKE_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    projectType: {
      type: 'object',
      properties: { value: enumOf(PROJECT_TYPES), confidence: enumOf(CONFIDENCE) },
      required: ['value', 'confidence'],
      additionalProperties: false,
    },
    stage: enumOf(PROJECT_STAGES),
    tags: arrayOf(
      {
        type: 'object',
        properties: {
          value: str(32),
          fromTaxonomy: { type: 'boolean', description: 'True only when the tag is in the supplied vocabulary.' },
        },
        required: ['value', 'fromTaxonomy'],
        additionalProperties: false,
      },
      8,
    ),
    ratingAxes: arrayOf(
      {
        type: 'object',
        properties: {
          key: str(24),
          label: str(32),
          description: str(120, 'Shown to reviewers in the composer.'),
          why: str(100, 'Shown to the creator, justifying a swap away from the default axis.'),
        },
        required: ['key', 'label', 'description', 'why'],
        additionalProperties: false,
      },
      6,
      'Start from the default axes for the type. Swap at most two.',
    ),
    ask: {
      type: 'object',
      properties: {
        headline: str(90, 'Names the decision the creator faces.'),
        body: str(400),
        ignoreList: arrayOf(str(60), 3, 'What reviewers should skip, such as placeholder art.'),
      },
      required: ['headline', 'body', 'ignoreList'],
      additionalProperties: false,
    },
    clarifyingQuestions: arrayOf(str(90), 3, 'Used when confidence is low. Prefer asking over guessing.'),
  },
  required: ['projectType', 'stage', 'tags', 'ratingAxes', 'ask', 'clarifyingQuestions'],
  additionalProperties: false,
}

// --- 4. triage --------------------------------------------------------------

export const TriageSchema = z.object({
  feedbackId: z.string(),
  sentiment: z.enum(SENTIMENT_LABELS),
  sentimentScore: z.number().min(-1).max(1),
  severity: z.enum(SEVERITY_LABELS),
  type: z.enum(FEEDBACK_TYPES),
  actionability: z.enum(['actionable', 'directional', 'not_actionable']),
  axisHints: z.array(z.string().max(40)).max(3).default([]),
  containsRepro: z.boolean(),
  overrodeReviewer: z.boolean(),
  overrideReason: z.string().max(120).nullish().transform((v) => v ?? undefined),
  confidence: z.enum(CONFIDENCE),
})

export const TriageBatchSchema = z.object({ results: z.array(TriageSchema).max(20) })

export type Triage = z.infer<typeof TriageSchema>
export type TriageBatch = z.infer<typeof TriageBatchSchema>

export const TRIAGE_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    results: arrayOf(
      {
        type: 'object',
        properties: {
          feedbackId: { type: 'string', description: 'Echo the id exactly as supplied.' },
          sentiment: enumOf(SENTIMENT_LABELS, 'About the experience described, not the politeness of the writing.'),
          sentimentScore: { type: 'number', minimum: -1, maximum: 1 },
          severity: enumOf(SEVERITY_LABELS, 'By consequence, never by intensity of language.'),
          type: enumOf(FEEDBACK_TYPES),
          actionability: enumOf(['actionable', 'directional', 'not_actionable']),
          axisHints: arrayOf(str(40), 3),
          containsRepro: { type: 'boolean' },
          overrodeReviewer: { type: 'boolean' },
          overrideReason: nullableStr(120, 'A sentence when overrodeReviewer is true, null otherwise.'),
          confidence: enumOf(CONFIDENCE),
        },
        required: [
          'feedbackId',
          'sentiment',
          'sentimentScore',
          'severity',
          'type',
          'actionability',
          'axisHints',
          'containsRepro',
          'overrodeReviewer',
          'overrideReason',
          'confidence',
        ],
        additionalProperties: false,
      },
      20,
    ),
  },
  required: ['results'],
  additionalProperties: false,
}

// --- 5. duplicate adjudication ---------------------------------------------

export const RELATIONS = ['duplicate', 'subset', 'related', 'distinct'] as const

export const PairVerdictSchema = z.object({
  aId: z.string(),
  bId: z.string(),
  relation: z.enum(RELATIONS),
  confidence: z.enum(CONFIDENCE),
  reason: z.string().max(140),
})

export const DedupeBatchSchema = z.object({
  verdicts: z.array(PairVerdictSchema).max(10),
  canonical: z.array(z.object({ clusterId: z.string(), statement: z.string().max(120) })).default([]),
})

export type PairVerdict = z.infer<typeof PairVerdictSchema>
export type DedupeBatch = z.infer<typeof DedupeBatchSchema>

export const DEDUPE_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    verdicts: arrayOf(
      {
        type: 'object',
        properties: {
          aId: { type: 'string' },
          bId: { type: 'string' },
          relation: enumOf(
            RELATIONS,
            'Duplicate only when a single fix would satisfy both authors. When uncertain, choose related.',
          ),
          confidence: enumOf(CONFIDENCE),
          reason: str(140),
        },
        required: ['aId', 'bId', 'relation', 'confidence', 'reason'],
        additionalProperties: false,
      },
      10,
    ),
    canonical: arrayOf(
      {
        type: 'object',
        properties: {
          clusterId: { type: 'string' },
          statement: str(120, 'Neutral. Never attributes one reviewer’s voice to another.'),
        },
        required: ['clusterId', 'statement'],
        additionalProperties: false,
      },
      10,
    ),
  },
  required: ['verdicts', 'canonical'],
  additionalProperties: false,
}

// --- 6. weekly digest -------------------------------------------------------

export const METRIC_KEYS = ['feedback_count', 'reviewers', 'avg_rating', 'open_themes', 'resolved'] as const

export const DigestSchema = z.object({
  headline: z.string().max(90),
  weekSummary: z.string().max(300),
  quiet: z.boolean(),
  metrics: z
    .array(
      z.object({
        key: z.enum(METRIC_KEYS),
        value: z.number(),
        delta: z.number(),
        direction: z.enum(['up', 'down', 'flat']),
      }),
    )
    .default([]),
  fixFirst: z
    .array(
      z.object({
        themeId: z.string(),
        title: z.string().max(70),
        why: z.string().max(180),
        reporterCount: z.number().int().min(0),
        impact: z.number().int().min(0).max(100),
        effortGuess: z.enum(['small', 'medium', 'large', 'unknown']),
        evidence: z.array(z.string()).default([]),
      }),
    )
    .max(3)
    .default([]),
  wins: z.array(z.object({ title: z.string().max(70), evidence: z.array(z.string()).default([]) })).max(2).default([]),
  regressions: z.array(z.object({ themeId: z.string(), note: z.string().max(140) })).max(2).default([]),
  nextStep: z.string().max(140),
})

export type Digest = z.infer<typeof DigestSchema>

export const DIGEST_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    headline: str(90, 'Second person, fourteen words at most, no exclamation marks.'),
    weekSummary: str(300),
    quiet: { type: 'boolean', description: 'True when the week was genuinely quiet. Say so rather than inflating it.' },
    metrics: arrayOf(
      {
        type: 'object',
        properties: {
          key: enumOf(METRIC_KEYS),
          value: { type: 'number' },
          delta: { type: 'number' },
          direction: enumOf(['up', 'down', 'flat']),
        },
        required: ['key', 'value', 'delta', 'direction'],
        additionalProperties: false,
      },
      5,
    ),
    fixFirst: arrayOf(
      {
        type: 'object',
        properties: {
          themeId: { type: 'string' },
          title: str(70),
          why: str(180),
          reporterCount: { type: 'integer', minimum: 0 },
          impact: { type: 'integer', minimum: 0, maximum: 100 },
          effortGuess: enumOf(['small', 'medium', 'large', 'unknown'], 'A guess, and labelled as one in the UI.'),
          evidence: arrayOf({ type: 'string' }, 8, 'Theme ids or feedback ids from the brief. Verified server-side.'),
        },
        required: ['themeId', 'title', 'why', 'reporterCount', 'impact', 'effortGuess', 'evidence'],
        additionalProperties: false,
      },
      3,
    ),
    wins: arrayOf(
      {
        type: 'object',
        properties: { title: str(70), evidence: arrayOf({ type: 'string' }, 8) },
        required: ['title', 'evidence'],
        additionalProperties: false,
      },
      2,
    ),
    regressions: arrayOf(
      {
        type: 'object',
        properties: { themeId: { type: 'string' }, note: str(140) },
        required: ['themeId', 'note'],
        additionalProperties: false,
      },
      2,
    ),
    nextStep: str(140, 'One concrete action.'),
  },
  required: ['headline', 'weekSummary', 'quiet', 'metrics', 'fixFirst', 'wins', 'regressions', 'nextStep'],
  additionalProperties: false,
}
