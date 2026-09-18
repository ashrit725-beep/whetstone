/**
 * Feedback: the review container, its structured points, the creator's inbox,
 * and the specificity score that gates every reputation reward downstream.
 *
 * A review is never assembled with a query per row. `hydrateFeedback` takes a
 * page of review rows and fills in points, attachments, themes, ratings and
 * viewer votes in four more queries, whatever the page size.
 */

import { all, get, run, tx } from '@/server/db/client'
import { noteInInboxUrl, noteOnProjectUrl } from './notification-targets'
import { now, uid } from '@/lib/utils'
import {
  DWELL_FLOOR_CAP,
  DWELL_FLOOR_SECONDS,
  GENERIC_PHRASES,
  GENERIC_WORDS,
  QUALIFIED_SPECIFICITY,
  SPECIFICITY_WEIGHTS,
  THEME,
  actionability as actionabilityLevel,
  categoryId as makeCategoryId,
  deriveItemKind,
  severity as severityLevel,
  severityRank,
  severityWeight,
} from '@/lib/taxonomy'
import type {
  ActionabilityKey,
  AnchorKind,
  CreateFeedbackResult,
  CreatorInbox,
  FeedbackPointView,
  FeedbackReplyView,
  FeedbackRow,
  FeedbackView,
  InboxState,
  NewFeedbackInput,
  NewFeedbackPointInput,
  Page,
  PageOptions,
  SentimentLabel,
  SeverityKey,
  ThemeRollupRow,
} from '@/lib/types'
import {
  addSeverity,
  bool,
  clamp01,
  decodeCursor,
  emptySeverityCounts,
  encodeCursor,
  jsonStringMap,
  mapUserCard,
  num,
  numOrNull,
  pageLimit,
  placeholders,
  str,
  strOrNull,
  toPage,
  userCardJoin,
  userCardSelect,
  type Row,
} from './_shared'
import { recomputeProjectRating } from './ratings'
import { invalidateReputation, isRepBearing, recordReputationEvent } from './reputation'
import { notify } from './notifications'
import { recomputeHotScore } from './projects'

/* ------------------------------------------------------------------------- *
 * Specificity — design/TAXONOMY.md §3.1
 * ------------------------------------------------------------------------- *
 *   S = clamp01(0.30·s_struct + 0.25·s_evidence + 0.25·s_anchor + 0.20·s_lex)
 *
 * S gates rewards and never blocks posting. A thin item still appears in the
 * thread; it simply earns close to nothing.
 *
 * Each term measures what the item carries, not which box it arrived in. The
 * composer has one text box per area and no anchor, steps or attachment field,
 * so a reviewer who writes "at 0:38 the text box appears as the meter fills"
 * has located the claim as surely as one who types 0:38 into a timecode field.
 * Anchor and evidence therefore take the better of the structured field and
 * what the body says. Scored on the fields alone, a review written in the
 * product topped out at 0.44 against the 0.5 floor, however good it was.
 */

export interface SpecificityBreakdown {
  readonly score: number
  readonly struct: number
  readonly evidence: number
  readonly anchor: number
  readonly lex: number
  /** True when the dwell floor capped the score. */
  readonly dwellCapped: boolean
}

/** Words the project itself declared: title, tags, needs, asks, version labels. */
export type ProjectVocabulary = ReadonlySet<string>

const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'if', 'of', 'to', 'in', 'on', 'at', 'for', 'with',
  'is', 'it', 'this', 'that', 'was', 'were', 'be', 'been', 'i', 'you', 'we', 'they', 'my',
  'your', 'so', 'then', 'than', 'as', 'by', 'from', 'not', 'no', 'do', 'did', 'does', 'have',
  'has', 'had', 'would', 'could', 'should', 'can', 'will', 'just', 'very', 'really', 'up',
])

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'’-]/g, ' ')
    .split(/\s+/)
    .map((t) => t.replace(/^['’-]+|['’-]+$/g, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
}

const GENERIC_WORD_SET: ReadonlySet<string> = new Set(GENERIC_WORDS)

/* What the words themselves carry ------------------------------------------ */

/**
 * The signals a structured field would otherwise hold, read from the body.
 * Every one of them names something a reader can go and check, which is the
 * whole of what specificity means; none of them is satisfied by tone.
 */
export interface TextSignals {
  /** The anchor the words give: 0 none, 0.5 a named part of the work, 1 a precise one. */
  readonly place: number
  /** Steps: a list, or the reviewer's own actions in order. */
  readonly steps: boolean
  /** What was expected, or promised, set against what happened. */
  readonly contrast: boolean
  /** A cause tied to its effect. */
  readonly cause: boolean
  /** Quoted copy, an error string, a code fragment. */
  readonly quote: boolean
  /** A count, a duration, a size, a version. */
  readonly measure: boolean
}

const NUMBER_WORDS =
  'two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|' +
  'seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|dozen'

/** Parts of a work that come counted or in order: level 3, the second paragraph, slide four. */
const COUNTED_PART =
  'level|stage|chapter|section|page|slide|step|scene|beat|act|room|screen|frame|shot|paragraph|line|' +
  'sentence|verse|stanza|chorus|episode|track|round|wave|world|zone|figure|table|footnote|question|' +
  'lesson|mission|floor|part|panel|card|row|column|item|bullet|option|tier|phase|day|minute|sheet|tab|' +
  'image|photo|wireframe|mockup|boss|street|enemy|field|button|menu|heading|puzzle|quest|map|run|' +
  'example|endpoint|call|request|draft|version|prototype|element'

/**
 * Nouns that name a place in a work once something narrows them down: the
 * claim button, the rate card empty state, the left hinge, the end title. On
 * its own "the page" points nowhere, so these need a modifier to count.
 * Screens and routes for software, rooms and beats for games, shots and cuts
 * for film, paragraphs and chapters for prose, parts for objects, sections for
 * a plan: the structured anchor kinds only ever covered the first two.
 */
const PLACE_NOUNS: ReadonlySet<string> = new Set(
  (
    // software, sites, tools
    'screen page view tab menu button link field form input toggle switch checkbox dropdown picker ' +
    'card list table row column section panel popup banner toast icon label flow step state message entry ' +
    'notification widget option setting sheet drawer bar counter badge chip feed grid search filter ' +
    'calendar chart graph editor preview timeline map board inbox profile cart endpoint method ' +
    'function parameter argument flag command response request error header token schema output ' +
    'example snippet guide docs quickstart client config log status report diff terminal prefix element ' +
    // games
    'level stage room meter gauge boss enemy weapon ability skill deck run wave round zone world ' +
    'quest mission puzzle dash jump parry combo timer score shop tree upgrade cutscene animation ' +
    // film, audio, writing
    'shot scene cut frame title track sequence transition sound music audio mix voice voiceover gesture ' +
    'narration interview caption thumbnail ending opening intro chapter paragraph sentence line ' +
    'passage stanza verse argument metaphor headline heading footnote quote character narrator dialogue ' +
    // design and objects
    'logo wordmark typeface font palette margin spacing illustration layout mockup wireframe ' +
    'artboard component colour color handle grip base stand case housing seam light led screw clip ' +
    'mount door hinge strap lid port cable charger battery dial knob trigger magnet spring hook edge ' +
    'corner surface finish sole bracket latch detent ' +
    // plans and pitches
    'price pricing plan tier segment channel customer market competitor forecast cost revenue memo ' +
    'slide survey pilot funnel'
  ).split(' '),
)

/** Parts specific enough to locate a note by their name alone. */
const NAMED_PART =
  /\b(?:hud|minimap|inventory|tutorial|onboarding|checkout|paywall|sign-?up|log-?in|dashboard|sidebar|navbar|header|footer|tooltip|modal|dropdown|carousel|cutscene|checkpoint|prologue|epilogue|footnotes?|lede|subheads?|captions?|subtitles|thumbnail|hinge|strap|latch|clasp|buckle|gasket|bezel|kickstand|charger|hook|lid|knob|dial|magnet|detent|seam|battery|quickstart|readme|changelog|diff|webhook|wordmark|favicon|typeface|faq|lower third|end card|end screen|empty state|title screen|main menu|pause menu|landing page|home ?page)\b/i

/** Modifiers that narrow nothing: "the whole page", "the overall layout". */
const VAGUE_MODIFIERS: ReadonlySet<string> = new Set([
  'whole', 'entire', 'overall', 'general', 'same', 'other', 'every', 'each', 'any', 'some', 'all',
  'more', 'most', 'many', 'few', 'little', 'big', 'small', 'main',
])
const DETERMINERS: ReadonlySet<string> = new Set(['the', 'a', 'an', 'this', 'that', 'your', 'its', 'their', 'our', 'my'])

const TIMECODE = /\b\d{1,2}:\d{2}(?::\d{2})?\b/
/**
 * A position said in words: "at eighteen seconds", "in the first ten seconds".
 * "About ninety seconds" is how long something took, not where it was, so
 * only the words that fix a point in the running time count.
 */
const TIME_MARK = new RegExp(
  `\\b(?:at|past|in the (?:first|last|final))\\s+(?:about\\s+|around\\s+|roughly\\s+|minute\\s+)?` +
    `(?:\\d+|one|${NUMBER_WORDS})(?:[\\s-](?:${NUMBER_WORDS}|one))?\\s*(?:seconds?|secs?|minutes?|mins?)\\b`,
  'i',
)
const ROUTE = /(?:^|[\s(“"'`])\/[a-z][\w\-./]*/im
const FILE_LINE = /\b[\w\-/]+\.[a-z]{1,5}:\d+\b/i
const CODE = /`[^`\n]{2,}`/
const NUMBERED_PART = new RegExp(`\\b(?:${COUNTED_PART})s?\\s+(?:\\d+[a-z]?|ii|iii|iv|one|${NUMBER_WORDS})\\b`, 'i')
/**
 * The same parts in order. "Part", "version" and "day" are left out: "the
 * first part" and "a good first version" place nothing, where "part two" and
 * "version 3" do.
 */
const ORDERED_PART = COUNTED_PART.split('|')
  .filter((p) => !['part', 'version', 'draft', 'prototype', 'example', 'item', 'option', 'day'].includes(p))
  .join('|')
const ORDINAL_PART = new RegExp(
  `\\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|last|final|penultimate|` +
    `opening|closing|\\d+(?:st|nd|rd|th))\\s+(?:[a-z’'-]+\\s+)?(?:${ORDERED_PART})s?\\b`,
  'i',
)
const QUOTED = /“[^”\n]{3,}”|"[^"\n]{3,}"|‘[^’\n]{3,}’|(?:^|[\s(])'[^'\n]{3,80}'(?=[\s.,;:!?)]|$)|`[^`\n]{2,}`/
const UI_NOUNS =
  'button|link|tab|menu|field|label|screen|page|option|toggle|setting|command|flag|error|message|' +
  'heading|section|column|dialog|modal|prompt|step|state|card|banner|toast|tooltip|badge|item|title|' +
  'placeholder|hint|string|header|key|shortcut|endpoint|parameter|argument|method|function|property|event'
/** A quoted label on a named control: the “Export” button, the tab called 'Rates'. */
const QUOTED_LABEL = new RegExp(
  `(?:“[^”\\n]{1,60}”|"[^"\\n]{1,60}"|‘[^’\\n]{1,60}’|\`[^\`\\n]{1,60}\`)\\s+(?:${UI_NOUNS})\\b|` +
    `\\b(?:${UI_NOUNS})s?\\s+(?:labell?ed|called|named|marked|reading|that says|says|reads)?\\s*[“"‘\`]`,
  'i',
)
/** A proper name after a preposition, case-sensitive: "in the Salt Forest", "on Windows". */
const NAMED_PLACE = /\b(?:in|on|at|near|inside|into|through|under|past|behind|from|to)\s+(?:the\s+)?[A-Z][a-z’'-]{2,}/
/** Where on a screen, a page or an object: top right, the bottom of the form, the left edge. */
const POSITION =
  /\b(?:top|bottom|upper|lower|far)[ -](?:left|right|corner|edge|half|third)\b|\b(?:left|right)[ -](?:edge|side|corner|half|margin)\b|\bmid[ -](?:screen|page)\b|\b(?:at|on|in|to|from) the (?:top|bottom|edge|corner|foot|head) of\b|\bat the (?:top|bottom)\b/i

const MEASURE = new RegExp(
  `\\d|\\b(?:${NUMBER_WORDS}|twice|half (?:an? )?(?:hour|minute|second|day|page|screen)|` +
    `one[ -](?:character|pixel|second|minute|click|tap|step|line|word|frame|hand(?:ed)?))\\b`,
  'i',
)
const LIST_ITEM = /^\s*(?:\d+[.)]|[-*•])\s+\S/gm
const ACTION =
  /\bi\s+(?:then\s+|first\s+|just\s+|had to\s+|tried to\s+|went to\s+)?(?:clicked|tapped|pressed|pushed|opened|closed|typed|entered|selected|chose|picked|dragged|dropped|scrolled|swiped|ran|installed|reloaded|refreshed|restarted|navigated|signed|logged|searched|pasted|copied|uploaded|downloaded|saved|submitted|exported|imported|folded|charged|plugged|unplugged|played|replayed|watched|rewound|paused|read|reread|skipped|went back|came back|hit|held|rotated|attached|connected|changed|switched|turned|filled|added|removed|deleted|created|started|finished|died|jumped|dashed|called|looked for|scrolled back)\b/gi
const SEQUENCE = /\b(?:then|afterwards|after (?:that|i|the|a)|once (?:i|the|it|you)|as soon as|every time|each time|the (?:first|second|third|next) time|when (?:i|you)|whenever|before (?:i|you)|until)\b/i
/**
 * The expectation, where it came from, or the silence where the product should
 * have said something: "I expected", "your page says eleven", "with no warning".
 */
const CONTRAST =
  /\b(?:expected|expecting|expectation|instead|should have|should've|should be|thought (?:it|this|that|i) (?:would|was)|thought (?:it|i|we|the \w+) had|i assumed|assumed|supposed to|rather than|whereas|would have|meant to|was looking for|looked for|turned out|(?:it |page |docs |readme |card |label |copy )?(?:says|claims|promises|promised|advertises)|silently|(?:with no|without(?: a| any)?) (?:warning|error|explanation|feedback|confirmation|message|indication|undo))\b/i
const CAUSE =
  /\b(?:because|so that|so (?:i|you|it|the|they|we|a|an|every|any|my|your|there|nobody|no)|which means|which is why|that is why|that's why|as a result|causes?|caused|causing|leads? to|led to|results? in|resulted in|by the time|by then|until|therefore|otherwise|which made|which makes|makes? (?:me|it|you|the|them)|made (?:me|it|you|the|them)|forces? (?:me|you)|forced (?:me|you))\b/i

/**
 * Modifier-then-noun places, read word by word within each clause, so one bad
 * match cannot hide the next and "the bundled fixture project. Output" is not
 * read as one noun phrase across the full stop.
 */
function namedPlace(body: string): boolean {
  for (const clause of body.split(/[.!?;:,()\n]+/)) {
    const words = clause.split(/[^A-Za-z0-9’'-]+/).filter((w) => w.length > 0)
    for (let i = 1; i < words.length; i++) {
      const noun = (words[i] ?? '').toLowerCase()
      const single = noun.endsWith('s') ? noun.slice(0, -1) : noun
      if (!PLACE_NOUNS.has(noun) && !PLACE_NOUNS.has(single)) continue
      for (let back = 2; back <= 4 && i - back >= 0; back++) {
        if (!DETERMINERS.has((words[i - back] ?? '').toLowerCase())) continue
        const modifiers = words.slice(i - back + 1, i).map((w) => w.toLowerCase())
        const narrows =
          modifiers.every((m) => !STOPWORDS.has(m) && !DETERMINERS.has(m)) &&
          modifiers.some((m) => !VAGUE_MODIFIERS.has(m) && !GENERIC_WORD_SET.has(m))
        if (narrows) return true
      }
    }
  }
  return false
}

export function textSignals(bodyMd: string): TextSignals {
  const body = bodyMd.trim()
  const precise =
    TIMECODE.test(body) ||
    TIME_MARK.test(body) ||
    ROUTE.test(body) ||
    FILE_LINE.test(body) ||
    CODE.test(body) ||
    NUMBERED_PART.test(body) ||
    ORDINAL_PART.test(body) ||
    QUOTED_LABEL.test(body)
  const coarse =
    !precise && (NAMED_PART.test(body) || NAMED_PLACE.test(body) || POSITION.test(body) || namedPlace(body))
  const actions = body.match(ACTION)?.length ?? 0
  return {
    place: precise ? 1 : coarse ? 0.5 : 0,
    steps: (body.match(LIST_ITEM)?.length ?? 0) >= 2 || actions >= 2 || (actions >= 1 && SEQUENCE.test(body)),
    contrast: CONTRAST.test(body),
    cause: CAUSE.test(body),
    quote: QUOTED.test(body),
    measure: MEASURE.test(body),
  }
}

/**
 * One item's specificity. Exported so the composer can show the reviewer what
 * their item is currently worth while they are still writing it.
 */
export function pointSpecificity(
  point: NewFeedbackPointInput,
  vocabulary: ProjectVocabulary = new Set(),
): SpecificityBreakdown {
  const body = point.bodyMd.trim()
  const attachments = point.attachments?.length ?? 0
  const repro = (point.reproSteps ?? '').trim()
  const said = textSignals(body)

  // s_lex: the only model-free-but-lexical term, capped at 20% of S on purpose.
  // It can nudge; it can never decide. Generic phrases are counted first and
  // taken out, so "looks good" is not counted again as "good".
  const tokens = tokenize(body)
  const contentTokens = Math.max(tokens.length, 1)
  let rest = body.toLowerCase()
  let genericTokens = 0
  for (const phrase of GENERIC_PHRASES) {
    const parts = rest.split(phrase)
    genericTokens += (parts.length - 1) * phrase.split(' ').length
    rest = parts.join(' ')
  }
  genericTokens += tokenize(rest).filter((t) => GENERIC_WORD_SET.has(t)).length
  // Concrete nouns from the project's own vocabulary offset the generic count,
  // but the offset saturates at a fifth of the body so keyword stuffing buys
  // less and less while still inflating the denominator it is divided by.
  const concrete = Math.min(
    tokens.filter((t) => vocabulary.has(t)).length,
    Math.ceil(contentTokens * 0.2),
  )
  const genericRatio = clamp01((genericTokens - concrete) / contentTokens)
  const lex = 1 - genericRatio

  // s_struct: the share of applicable structured fields filled non-trivially.
  // Category, severity and actionability are guaranteed by the schema, so this
  // term floors at 0.6 and the composer earns the rest with a real body, a link
  // to one of the creator's asks, and repro steps where the kind demands them.
  // A body is real when it is long enough to say something and is not mostly
  // verdict words: sixty characters of "okay I guess, feels a bit off" is a
  // box filled trivially. Steps written out in the body are steps.
  const applicable: boolean[] = [true, true, true, body.length >= 60 && lex >= 0.5, point.askId != null]
  if (point.actionability === 'repro') applicable.push(repro.length >= 20 || said.steps)
  const struct = applicable.filter(Boolean).length / applicable.length

  // s_evidence: artifacts a generated review cannot produce. Attachments are
  // still the only way to the first half. The second half is the artifact in
  // the words: steps, an expectation set against an outcome, the quoted error
  // or copy, a measurement, a cause tied to its effect. One kind earns half of
  // it and two earn all of it, so a lone number is not a finding.
  const written = [said.steps, said.contrast, said.quote, said.measure, said.cause].filter(Boolean).length
  const artifact = Math.max(repro.length >= 20 ? 1 : 0, Math.min(1, written / 2))
  const evidence = Math.min(1, 0.5 * attachments + 0.5 * artifact)

  // s_anchor: 0 none, 0.5 coarse, 1.0 precise, from the field or the words,
  // whichever locates the claim better.
  const anchor = Math.max(anchorPrecision(point.anchorKind ?? null, point.timecodeMs ?? null), said.place)

  const score = clamp01(
    SPECIFICITY_WEIGHTS.struct * struct +
      SPECIFICITY_WEIGHTS.evidence * evidence +
      SPECIFICITY_WEIGHTS.anchor * anchor +
      SPECIFICITY_WEIGHTS.lex * lex,
  )

  return { score, struct, evidence, anchor, lex, dwellCapped: false }
}

function anchorPrecision(kind: AnchorKind | null, timecodeMs: number | null): number {
  if (timecodeMs !== null) return 1
  if (kind === 'timecode' || kind === 'route' || kind === 'selector') return 1
  if (kind === 'screen' || kind === 'level') return 0.5
  return 0
}

/**
 * The review's `S_r`: the mean of its items, then the dwell floor.
 *
 * The dwell floor is the single most effective defence against generated review
 * dumps, because it measures the one thing generation cannot fake: time spent
 * with the artifact.
 */
export function computeSpecificity(
  input: Pick<NewFeedbackInput, 'points' | 'dwellSeconds' | 'openedArtifact'>,
  vocabulary: ProjectVocabulary = new Set(),
): SpecificityBreakdown {
  if (input.points.length === 0) {
    return { score: 0, struct: 0, evidence: 0, anchor: 0, lex: 0, dwellCapped: false }
  }
  const parts = input.points.map((p) => pointSpecificity(p, vocabulary))
  const mean = (pick: (b: SpecificityBreakdown) => number): number =>
    parts.reduce((sum, b) => sum + pick(b), 0) / parts.length

  const raw = mean((b) => b.score)
  const tooFast =
    (input.dwellSeconds ?? 0) < DWELL_FLOOR_SECONDS || input.openedArtifact === false
  const score = tooFast ? Math.min(raw, DWELL_FLOOR_CAP) : raw

  return {
    score,
    struct: mean((b) => b.struct),
    evidence: mean((b) => b.evidence),
    anchor: mean((b) => b.anchor),
    lex: mean((b) => b.lex),
    dwellCapped: tooFast && raw > DWELL_FLOOR_CAP,
  }
}

/** Title, tagline, tags, needs, asks and version labels, tokenised. */
export function projectVocabulary(projectId: string): ProjectVocabulary {
  const parts: string[] = []
  const p = get<Row>(`SELECT title, tagline, summary_md FROM projects WHERE id = ?`, [projectId])
  parts.push(str(p, 'title'), str(p, 'tagline'), str(p, 'summary_md').slice(0, 2000))
  for (const r of all<Row>(
    `SELECT t.label AS label FROM project_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.project_id = ?`,
    [projectId],
  )) {
    parts.push(str(r, 'label'))
  }
  for (const r of all<Row>(`SELECT prompt FROM project_asks WHERE project_id = ?`, [projectId])) {
    parts.push(str(r, 'prompt'))
  }
  for (const r of all<Row>(`SELECT version_label FROM project_versions WHERE project_id = ?`, [projectId])) {
    parts.push(str(r, 'version_label'))
  }
  return new Set(tokenize(parts.join(' ')))
}

/* ------------------------------------------------------------------------- *
 * Creating a review
 * ------------------------------------------------------------------------- */

/**
 * One transaction. A review that produced no points, no ratings, no reputation
 * event and no notification is a review the creator will never see, and half a
 * write is worse than none.
 *
 * The transaction covers: the container, every point and attachment, the axis
 * ratings, the ask answer counters, the project counter cache, the reputation
 * ledger entry, and the creator's notification.
 */
export function createFeedback(input: NewFeedbackInput): CreateFeedbackResult {
  const ts = now()
  const feedbackId = uid()

  const project = get<Row>(
    `SELECT p.id, p.owner_id, p.project_type_id, p.slug, p.title, p.feedback_state,
            (SELECT v.id FROM project_versions v WHERE v.project_id = p.id AND v.is_current = 1) AS current_version_id
       FROM projects p WHERE p.id = ? AND p.deleted_at IS NULL`,
    [input.projectId],
  )
  if (!project) throw new Error(`No such project: ${input.projectId}`)

  const projectTypeId = str(project, 'project_type_id')
  const ownerId = str(project, 'owner_id')
  const versionId = input.versionId ?? strOrNull(project, 'current_version_id')

  const vocabulary = projectVocabulary(input.projectId)
  const specificity = computeSpecificity(input, vocabulary)

  const reviewerIsExpert = bool(
    get<Row>(`SELECT is_expert FROM users WHERE id = ?`, [input.reviewerId]),
    'is_expert',
  )

  const blockerCount = input.points.filter((p) => p.severity === 'blocker').length
  const sentimentScore =
    input.points.length > 0
      ? input.points.reduce((sum, p) => sum + (p.sentiment ?? defaultSentiment(p.severity)), 0) /
        input.points.length
      : null

  const pointIds: string[] = []
  let notificationId: string | null = null
  let reputationDelta = 0

  tx(() => {
    run(
      `INSERT INTO feedback
         (id, project_id, project_type_id, version_id, reviewer_id, round_id, bounty_id,
          origin, status, visibility, headline, summary_md, time_spent_minutes, environment,
          point_count, blocker_count, sentiment_score, sentiment_label, quality_score,
          inbox_state, reviewer_is_expert, submitted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?)`,
      [
        feedbackId,
        input.projectId,
        projectTypeId,
        versionId,
        input.reviewerId,
        input.roundId ?? null,
        input.bountyId ?? null,
        input.origin ?? 'organic',
        input.visibility ?? 'public',
        input.headline ?? null,
        input.summaryMd ?? null,
        input.timeSpentMinutes ?? null,
        input.environment ? JSON.stringify(input.environment) : null,
        input.points.length,
        blockerCount,
        sentimentScore,
        sentimentLabel(sentimentScore),
        specificity.score,
        reviewerIsExpert ? 1 : 0,
        ts,
        ts,
        ts,
      ],
    )

    input.points.forEach((point, ordinal) => {
      const pointId = uid()
      pointIds.push(pointId)
      const repro = (point.reproSteps ?? '').trim()
      // The schema refuses a 'repro' point without steps: a bug report with the
      // bug missing is not a bug report.
      const action: ActionabilityKey =
        point.actionability === 'repro' && repro.length === 0 ? 'actionable' : point.actionability
      run(
        `INSERT INTO feedback_points
           (id, feedback_id, project_type_id, category_id, ask_id, ordinal, body_md,
            severity, actionability, sentiment, anchor_kind, anchor_value, timecode_ms,
            repro_steps, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          pointId,
          feedbackId,
          projectTypeId,
          makeCategoryId(projectTypeSlugFor(projectTypeId), point.categoryKey),
          point.askId ?? null,
          ordinal,
          point.bodyMd,
          point.severity,
          action,
          point.sentiment ?? defaultSentiment(point.severity),
          point.anchorKind ?? null,
          point.anchorValue ?? null,
          point.timecodeMs ?? null,
          repro.length > 0 ? repro : null,
          ts,
          ts,
        ],
      )
      for (const attachment of point.attachments ?? []) {
        run(
          `INSERT INTO feedback_attachments
             (id, point_id, media_kind, url, thumb_url, alt_text, byte_size, mime_type, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uid(),
            pointId,
            attachment.mediaKind,
            attachment.url,
            attachment.thumbUrl ?? null,
            attachment.altText ?? null,
            attachment.byteSize ?? null,
            attachment.mimeType ?? null,
            ts,
          ],
        )
      }
      if (point.askId) {
        run(`UPDATE project_asks SET answer_count = answer_count + 1 WHERE id = ?`, [point.askId])
      }
    })

    for (const rating of input.ratings) {
      // An omitted axis is "not enough exposure to rate". It is never stored as
      // a 3, so it cannot drag the mean toward the middle.
      if (!Number.isFinite(rating.value)) continue
      run(
        `INSERT INTO feedback_ratings
           (id, feedback_id, project_type_id, axis_id, rating_value, comment, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (feedback_id, axis_id) DO NOTHING`,
        [
          uid(),
          feedbackId,
          projectTypeId,
          `${projectTypeSlugFor(projectTypeId)}:${rating.axisKey}`,
          Math.round(rating.value),
          rating.comment ?? null,
          ts,
        ],
      )
    }

    run(
      `UPDATE project_stats
          SET feedback_count = (SELECT COUNT(*) FROM feedback f
                                 WHERE f.project_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL),
              reviewer_count = (SELECT COUNT(DISTINCT f.reviewer_id) FROM feedback f
                                 WHERE f.project_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL),
              expert_feedback_count = (SELECT COUNT(*) FROM feedback f
                                 WHERE f.project_id = ? AND f.status = 'submitted'
                                   AND f.deleted_at IS NULL AND f.reviewer_is_expert = 1),
              last_feedback_at = ?,
              last_activity_at = ?,
              computed_at = ?
        WHERE project_id = ?`,
      [input.projectId, input.projectId, input.projectId, ts, ts, ts, input.projectId],
    )

    // Beyond the daily cap a review still posts and still appears in the
    // thread. It simply earns nothing, which is what makes grinding pointless
    // without making it punitive.
    if (isRepBearing(input.reviewerId, ts) && specificity.score > 0.05) {
      // The ledger is the audit trail, not the score. Credibility is recomputed
      // from evidence, so this delta exists to answer "why did that move?".
      reputationDelta = Math.max(1, Math.round(20 * specificity.score))
      recordReputationEvent({
        userId: input.reviewerId,
        facet: 'reviewer',
        kind: 'feedback_submitted',
        delta: reputationDelta,
        weight: specificity.score,
        subjectType: 'feedback',
        subjectId: feedbackId,
        note: `Specificity ${specificity.score.toFixed(2)}`,
      })
    }

    if (ownerId !== input.reviewerId) {
      notificationId = notify({
        userId: ownerId,
        actorId: input.reviewerId,
        kind: 'feedback_received',
        subjectType: 'feedback',
        subjectId: feedbackId,
        title: `New review on ${str(project, 'title')}`,
        body:
          blockerCount > 0
            ? `${input.points.length} notes, ${blockerCount} marked blocker.`
            : `${input.points.length} notes.`,
        url: noteInInboxUrl(feedbackId),
        groupKey: `feedback:${input.projectId}`,
      })
    }
  })

  // Outside the transaction: derived rollups that are cheap to redo and must
  // never be the reason a review fails to save.
  recomputeProjectRating(input.projectId, ts)
  recomputeHotScore(input.projectId)
  invalidateReputation(input.reviewerId)

  return {
    feedbackId,
    pointIds,
    specificity: specificity.score,
    isQualified: specificity.score >= QUALIFIED_SPECIFICITY,
    blockerCount,
    reputationDelta,
    notificationId,
  }
}

function defaultSentiment(severity: SeverityKey): -1 | 0 | 1 {
  if (severity === 'praise') return 1
  if (severity === 'blocker' || severity === 'major') return -1
  return 0
}

function sentimentLabel(score: number | null): SentimentLabel | null {
  if (score === null) return null
  if (score >= 0.35) return 'positive'
  if (score <= -0.35) return 'negative'
  if (score > -0.15 && score < 0.15) return 'neutral'
  return 'mixed'
}

const typeSlugCache = new Map<string, string>()

/** Category and axis ids are `<typeSlug>:<key>`; the slug is stable per type. */
function projectTypeSlugFor(projectTypeId: string): string {
  const hit = typeSlugCache.get(projectTypeId)
  if (hit) return hit
  const slug = str(get<Row>(`SELECT slug FROM project_types WHERE id = ?`, [projectTypeId]), 'slug')
  if (slug) typeSlugCache.set(projectTypeId, slug)
  return slug
}

/* ------------------------------------------------------------------------- *
 * Reading reviews
 * ------------------------------------------------------------------------- */

export type FeedbackSort = 'most_helpful' | 'newest' | 'most_severe'

export interface ListFeedbackOptions extends PageOptions {
  readonly sort?: FeedbackSort
  readonly categoryId?: string | null
  readonly severity?: SeverityKey | null
  readonly versionId?: string | null
  readonly expertsOnly?: boolean
  readonly unansweredOnly?: boolean
  readonly viewerId?: string | null
  /** Owners and collaborators also see `creator_only` reviews. */
  readonly includePrivate?: boolean
}

/**
 * The worst severity among a review's points as a rank, blocker 4 down to
 * praise 0. The severity sort used to be the blocker count alone, so every
 * review without a blocker tied at zero and fell into id order, which put a
 * praise-only review above a run of majors under a heading that said
 * "Severity".
 */
const WORST_SEVERITY_RANK = `(SELECT COALESCE(MAX(CASE sev.severity
      WHEN 'blocker' THEN 4 WHEN 'major' THEN 3 WHEN 'minor' THEN 2 WHEN 'nit' THEN 1 ELSE 0 END), 0)
    FROM feedback_points sev WHERE sev.feedback_id = f.id)`

/**
 * Whitelisted orderings, most significant key first. Every key sorts
 * descending and `f.id` breaks the final tie, so a cursor is the tuple of the
 * last row's keys and the next page is every row strictly below it. Nothing
 * here comes from a request.
 */
const SORT_KEYS: Readonly<Record<FeedbackSort, readonly { sql: string; column: string }[]>> = {
  most_helpful: [{ sql: 'f.helpful_count', column: 'helpful_count' }],
  newest: [{ sql: 'f.submitted_at', column: 'submitted_at' }],
  most_severe: [
    { sql: WORST_SEVERITY_RANK, column: 'worst_rank' },
    { sql: 'f.blocker_count', column: 'blocker_count' },
    { sql: 'f.submitted_at', column: 'submitted_at' },
  ],
}

interface SortPlan {
  /** Extra SELECT columns the cursor reads back, with a leading comma. */
  readonly select: string
  readonly orderBy: string
  /** The keyset predicate, when a cursor was given and decoded. */
  readonly after: { readonly sql: string; readonly params: readonly unknown[] } | null
  readonly cursorOf: (last: Row) => string
}

function sortPlan(sort: FeedbackSort, cursor: Row | null): SortPlan {
  const keys = SORT_KEYS[sort]
  const exprs = [...keys.map((k) => k.sql), 'f.id']
  const values = cursor?.['k']
  const id = cursor?.['id']
  // A cursor minted by another sort, or edited by hand, restarts the list
  // rather than comparing the wrong keys.
  const valid =
    cursor?.['s'] === sort &&
    Array.isArray(values) &&
    values.length === keys.length &&
    values.every((v) => typeof v === 'number') &&
    typeof id === 'string'
  return {
    // A key that is not a plain column of `f` is selected under its name so
    // the cursor can read it back off the last row.
    select: keys
      .filter((k) => !k.sql.startsWith('f.'))
      .map((k) => `, ${k.sql} AS ${k.column}`)
      .join(''),
    orderBy: exprs.map((e) => `${e} DESC`).join(', '),
    after: valid
      ? { sql: `(${exprs.join(', ')}) < (${placeholders(exprs.length)})`, params: [...values, id] }
      : null,
    cursorOf: (last) =>
      encodeCursor({ s: sort, k: keys.map((k) => num(last, k.column)), id: str(last, 'id') }),
  }
}

/**
 * The public thread on a project, with the creator's response state on every
 * row so the UI never has to ask a second time whether a review was answered.
 */
export function listFeedbackForProject(
  projectId: string,
  opts: ListFeedbackOptions = {},
): Page<FeedbackView> {
  const limit = pageLimit(opts.limit, 20)
  const plan = sortPlan(opts.sort ?? 'most_helpful', decodeCursor(opts.cursor))

  const where: string[] = [
    'f.project_id = ?',
    "f.status = 'submitted'",
    'f.deleted_at IS NULL',
  ]
  const params: unknown[] = [projectId]

  if (!opts.includePrivate) where.push("f.visibility = 'public'")
  if (opts.versionId) {
    where.push('f.version_id = ?')
    params.push(opts.versionId)
  }
  if (opts.expertsOnly) where.push('f.reviewer_is_expert = 1')
  if (opts.unansweredOnly) where.push('f.first_reply_at IS NULL')
  if (opts.categoryId) {
    where.push('EXISTS (SELECT 1 FROM feedback_points fp WHERE fp.feedback_id = f.id AND fp.category_id = ?)')
    params.push(opts.categoryId)
  }
  if (opts.severity) {
    where.push('EXISTS (SELECT 1 FROM feedback_points fp2 WHERE fp2.feedback_id = f.id AND fp2.severity = ?)')
    params.push(opts.severity)
  }
  if (plan.after) {
    where.push(plan.after.sql)
    params.push(...plan.after.params)
  }

  const rows = all<Row>(
    `${feedbackSelect(opts.viewerId ?? null, plan.select)}
      WHERE ${where.join(' AND ')}
      ORDER BY ${plan.orderBy}
      LIMIT ?`,
    [...(opts.viewerId ? [opts.viewerId] : []), ...params, limit + 1],
  )

  const page = toPage(rows, limit, plan.cursorOf)
  return {
    items: hydrateFeedback(page.items, opts.viewerId ?? null),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  }
}

/**
 * The shared SELECT and JOIN list every review read uses. `extra` is a
 * whitelisted column list from `sortPlan`, never request input.
 */
function feedbackSelect(viewerId: string | null, extra = ''): string {
  return `SELECT f.*, p.slug AS project_slug, p.title AS project_title, p.owner_id AS owner_id,
                 pt.slug AS type_slug,
                 v.version_label AS version_label,
                 ${userCardSelect('u', 'pr', 'rs', 'r')},
                 ${viewerId ? '(SELECT fv.vote_value FROM feedback_votes fv WHERE fv.feedback_id = f.id AND fv.voter_id = ?)' : 'NULL'} AS viewer_vote
                 ${extra}
            FROM feedback f
            JOIN projects p ON p.id = f.project_id
            JOIN project_types pt ON pt.id = f.project_type_id
            JOIN users u ON u.id = f.reviewer_id
            ${userCardJoin('u', 'pr', 'rs')}
            LEFT JOIN project_versions v ON v.id = f.version_id`
}

export function getFeedback(feedbackId: string, viewerId?: string | null): FeedbackView | undefined {
  const row = get<Row>(
    `${feedbackSelect(viewerId ?? null)} WHERE f.id = ? AND f.deleted_at IS NULL`,
    [...(viewerId ? [viewerId] : []), feedbackId],
  )
  if (!row) return undefined
  return hydrateFeedback([row], viewerId ?? null)[0]
}

/** Reviews this person wrote. The public half of a reviewer's profile. */
export function listReviewsByUser(
  userId: string,
  opts: PageOptions & { readonly viewerId?: string | null } = {},
): Page<FeedbackView> {
  const limit = pageLimit(opts.limit, 20)
  const cursor = decodeCursor(opts.cursor)
  const at = cursor ? num(cursor, 'at') : null
  const rows = all<Row>(
    `${feedbackSelect(opts.viewerId ?? null)}
      WHERE f.reviewer_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
        AND f.visibility = 'public'
        -- Each row links to its project, so only projects anyone can open:
        -- a deactivated creator's projects are paused and their pages 404.
        AND p.deleted_at IS NULL AND p.status = 'published' AND p.visibility = 'public'
        AND (? IS NULL OR f.submitted_at < ?)
      ORDER BY f.submitted_at DESC
      LIMIT ?`,
    [...(opts.viewerId ? [opts.viewerId] : []), userId, at, at, limit + 1],
  )
  const page = toPage(rows, limit, (last) => encodeCursor({ at: num(last, 'submitted_at') }))
  return {
    items: hydrateFeedback(page.items, opts.viewerId ?? null),
    hasMore: page.hasMore,
    nextCursor: page.nextCursor,
  }
}

/**
 * Fills a page of review rows with their points, attachments, themes and axis
 * ratings. Four queries, independent of the page size.
 */
function hydrateFeedback(rows: readonly Row[], viewerId: string | null): readonly FeedbackView[] {
  if (rows.length === 0) return []
  const ids = rows.map((r) => str(r, 'id'))
  const idList = placeholders(ids.length)

  const pointRows = all<Row>(
    `SELECT fp.*, fc.category_key, fc.label AS category_label
       FROM feedback_points fp
       LEFT JOIN feedback_categories fc ON fc.id = fp.category_id
      WHERE fp.feedback_id IN (${idList})
      ORDER BY fp.feedback_id, fp.ordinal`,
    ids,
  )
  const pointIds = pointRows.map((r) => str(r, 'id'))

  const attachmentsByPoint = new Map<string, Row[]>()
  if (pointIds.length > 0) {
    for (const r of all<Row>(
      `SELECT * FROM feedback_attachments WHERE point_id IN (${placeholders(pointIds.length)})`,
      pointIds,
    )) {
      const list = attachmentsByPoint.get(str(r, 'point_id')) ?? []
      list.push(r)
      attachmentsByPoint.set(str(r, 'point_id'), list)
    }
  }

  const themesByPoint = new Map<string, { id: string; label: string }[]>()
  if (pointIds.length > 0) {
    for (const r of all<Row>(
      `SELECT pt.point_id, t.id, t.label
         FROM feedback_point_themes pt
         JOIN feedback_themes t ON t.id = pt.theme_id
        WHERE pt.point_id IN (${placeholders(pointIds.length)}) AND t.is_archived = 0`,
      pointIds,
    )) {
      const list = themesByPoint.get(str(r, 'point_id')) ?? []
      list.push({ id: str(r, 'id'), label: str(r, 'label') })
      themesByPoint.set(str(r, 'point_id'), list)
    }
  }

  const votedPoints = new Set<string>()
  if (viewerId && pointIds.length > 0) {
    for (const r of all<Row>(
      `SELECT point_id FROM feedback_point_votes
        WHERE voter_id = ? AND point_id IN (${placeholders(pointIds.length)})`,
      [viewerId, ...pointIds],
    )) {
      votedPoints.add(str(r, 'point_id'))
    }
  }

  const ratingsByFeedback = new Map<string, FeedbackView['ratings'][number][]>()
  for (const r of all<Row>(
    `SELECT fr.feedback_id, fr.axis_id, fr.rating_value, fr.comment,
            ra.axis_key, ra.label, ra.scale_max
       FROM feedback_ratings fr
       JOIN rating_axes ra ON ra.id = fr.axis_id
      WHERE fr.feedback_id IN (${idList})
      ORDER BY ra.sort_order`,
    ids,
  )) {
    const key = str(r, 'feedback_id')
    const list = ratingsByFeedback.get(key) ?? []
    list.push({
      axisId: str(r, 'axis_id'),
      axisKey: str(r, 'axis_key'),
      label: str(r, 'label'),
      value: num(r, 'rating_value'),
      scaleMax: num(r, 'scale_max', 5),
      comment: strOrNull(r, 'comment'),
    })
    ratingsByFeedback.set(key, list)
  }

  const pointsByFeedback = new Map<string, FeedbackPointView[]>()
  for (const r of pointRows) {
    const key = str(r, 'feedback_id')
    const list = pointsByFeedback.get(key) ?? []
    list.push(mapPoint(r, attachmentsByPoint, themesByPoint, votedPoints))
    pointsByFeedback.set(key, list)
  }

  return rows.map((r): FeedbackView => {
    const id = str(r, 'id')
    const points = pointsByFeedback.get(id) ?? []
    const inboxState = (str(r, 'inbox_state') || 'new') as InboxState
    const firstReplyAt = numOrNull(r, 'first_reply_at')
    const specificity = clamp01(num(r, 'quality_score'))
    const ownerId = str(r, 'owner_id')

    return {
      id,
      projectId: str(r, 'project_id'),
      projectSlug: str(r, 'project_slug'),
      projectTitle: str(r, 'project_title'),
      typeSlug: str(r, 'type_slug'),
      reviewer: mapUserCard(r, 'r'),
      origin: (str(r, 'origin') || 'organic') as FeedbackView['origin'],
      visibility: (str(r, 'visibility') || 'public') as FeedbackView['visibility'],
      headline: strOrNull(r, 'headline'),
      summaryMd: strOrNull(r, 'summary_md'),
      timeSpentMinutes: numOrNull(r, 'time_spent_minutes'),
      environment: jsonStringMap(r, 'environment'),
      versionId: strOrNull(r, 'version_id'),
      versionLabel: strOrNull(r, 'version_label'),
      points,
      ratings: ratingsByFeedback.get(id) ?? [],
      counts: {
        points: num(r, 'point_count'),
        blockers: num(r, 'blocker_count'),
        helpful: num(r, 'helpful_count'),
        unhelpful: num(r, 'unhelpful_count'),
        replies: num(r, 'reply_count'),
      },
      sentimentScore: numOrNull(r, 'sentiment_score'),
      sentimentLabel: (strOrNull(r, 'sentiment_label') as SentimentLabel | null) ?? null,
      specificity,
      isQualified: specificity >= QUALIFIED_SPECIFICITY,
      inboxState,
      creatorMarkedHelpful: bool(r, 'creator_marked_helpful'),
      responseState:
        inboxState === 'actioned' || (points.length > 0 && points.every((p) => p.isResolved))
          ? 'resolved'
          : firstReplyAt !== null
            ? 'replied'
            : 'unanswered',
      firstReplyAt,
      submittedAt: numOrNull(r, 'submitted_at'),
      viewer: {
        isReviewer: viewerId !== null && viewerId === str(r, 'reviewer_id'),
        isCreator: viewerId !== null && viewerId === ownerId,
        vote: normalizeVote(numOrNull(r, 'viewer_vote')),
      },
    }
  })
}

function normalizeVote(value: number | null): -1 | 0 | 1 {
  return value === 1 ? 1 : value === -1 ? -1 : 0
}

function mapPoint(
  r: Row,
  attachments: Map<string, Row[]>,
  themes: Map<string, { id: string; label: string }[]>,
  voted: ReadonlySet<string>,
): FeedbackPointView {
  const id = str(r, 'id')
  const severityKey = str(r, 'severity') as SeverityKey
  const actionKey = str(r, 'actionability') as ActionabilityKey
  const sev = severityLevel(severityKey)
  const act = actionabilityLevel(actionKey)
  const anchorKind = strOrNull(r, 'anchor_kind') as AnchorKind | null
  const sentiment = normalizeVote(numOrNull(r, 'sentiment'))
  const repro = strOrNull(r, 'repro_steps')

  return {
    id,
    ordinal: num(r, 'ordinal'),
    bodyMd: str(r, 'body_md'),
    severity: severityKey,
    severityCode: sev?.code ?? null,
    severityLabel: sev?.label ?? severityKey,
    actionability: actionKey,
    actionabilityCode: act?.code ?? 'A0',
    actionabilityLabel: act?.label ?? actionKey,
    kind: deriveItemKind({
      severity: severityKey,
      actionability: actionKey,
      hasReproSteps: repro !== null,
      sentiment,
    }),
    sentiment,
    categoryId: str(r, 'category_id'),
    categoryKey: str(r, 'category_key'),
    categoryLabel: str(r, 'category_label') || str(r, 'category_key'),
    anchor:
      anchorKind !== null
        ? {
            kind: anchorKind,
            value: str(r, 'anchor_value'),
            timecodeMs: numOrNull(r, 'timecode_ms'),
          }
        : null,
    reproSteps: repro,
    upvoteCount: num(r, 'upvote_count'),
    isResolved: bool(r, 'is_resolved'),
    attachments: (attachments.get(id) ?? []).map((a) => ({
      id: str(a, 'id'),
      point_id: str(a, 'point_id'),
      media_kind: str(a, 'media_kind') as 'image' | 'video' | 'gif' | 'log' | 'file',
      url: str(a, 'url'),
      thumb_url: strOrNull(a, 'thumb_url'),
      alt_text: strOrNull(a, 'alt_text'),
      byte_size: numOrNull(a, 'byte_size'),
      mime_type: strOrNull(a, 'mime_type'),
      created_at: num(a, 'created_at'),
    })),
    themes: themes.get(id) ?? [],
    askId: strOrNull(r, 'ask_id'),
    viewerUpvoted: voted.has(id),
    createdAt: num(r, 'created_at'),
  }
}

/* ------------------------------------------------------------------------- *
 * The creator inbox
 * ------------------------------------------------------------------------- */

export interface InboxFilters extends PageOptions {
  readonly projectId?: string | null
  readonly state?: InboxState | null
  readonly severity?: SeverityKey | null
  readonly unansweredOnly?: boolean
  readonly expertsOnly?: boolean
  readonly sort?: FeedbackSort
}

/** Everything addressed to this creator across all of their projects. */
export function listInboxFeedback(userId: string, filters: InboxFilters = {}): Page<FeedbackView> {
  const limit = pageLimit(filters.limit, 20)
  const plan = sortPlan(filters.sort ?? 'most_severe', decodeCursor(filters.cursor))

  const where: string[] = [
    'p.owner_id = ?',
    "f.status = 'submitted'",
    'f.deleted_at IS NULL',
  ]
  const params: unknown[] = [userId]

  if (filters.projectId) {
    where.push('f.project_id = ?')
    params.push(filters.projectId)
  }
  if (filters.state) {
    where.push('f.inbox_state = ?')
    params.push(filters.state)
  }
  if (filters.unansweredOnly) where.push('f.first_reply_at IS NULL')
  if (filters.expertsOnly) where.push('f.reviewer_is_expert = 1')
  if (filters.severity) {
    where.push('EXISTS (SELECT 1 FROM feedback_points fp WHERE fp.feedback_id = f.id AND fp.severity = ?)')
    params.push(filters.severity)
  }
  if (plan.after) {
    where.push(plan.after.sql)
    params.push(...plan.after.params)
  }

  const rows = all<Row>(
    `${feedbackSelect(userId, plan.select)}
      WHERE ${where.join(' AND ')}
      ORDER BY ${plan.orderBy}
      LIMIT ?`,
    [userId, ...params, limit + 1],
  )
  const page = toPage(rows, limit, plan.cursorOf)
  return { items: hydrateFeedback(page.items, userId), hasMore: page.hasMore, nextCursor: page.nextCursor }
}

export interface InboxCounts {
  readonly total: number
  readonly byState: Readonly<Record<InboxState, number>>
  readonly unanswered: number
  readonly blockers: number
  readonly fromExperts: number
}

/** One grouped query for the inbox chips. */
export function getInboxCounts(userId: string, projectId?: string | null): InboxCounts {
  const byState: Record<InboxState, number> = {
    new: 0, read: 0, triaged: 0, actioned: 0, archived: 0,
  }
  const rows = all<Row>(
    `SELECT f.inbox_state AS state, COUNT(*) AS n,
            SUM(CASE WHEN f.first_reply_at IS NULL THEN 1 ELSE 0 END) AS unanswered,
            SUM(f.blocker_count) AS blockers,
            SUM(f.reviewer_is_expert) AS experts
       FROM feedback f
       JOIN projects p ON p.id = f.project_id
      WHERE p.owner_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
        AND (? IS NULL OR f.project_id = ?)
      GROUP BY f.inbox_state`,
    [userId, projectId ?? null, projectId ?? null],
  )
  let total = 0
  let unanswered = 0
  let blockers = 0
  let fromExperts = 0
  for (const r of rows) {
    const state = str(r, 'state') as InboxState
    const n = num(r, 'n')
    if (state in byState) byState[state] = n
    total += n
    unanswered += num(r, 'unanswered')
    blockers += num(r, 'blockers')
    fromExperts += num(r, 'experts')
  }
  return { total, byState, unanswered, blockers, fromExperts }
}

/**
 * The dashboard rollup, grouped by theme.
 *
 * Three constant queries, never one per theme: the themes with their severity
 * split, the project totals, and the ask coverage. `reviewerCount` is distinct
 * reviewers rather than item count, because "6 reviewers agree" and "one person
 * said it 6 times" must never render the same way — and `contested` is set when
 * a theme's sentiment splits, so a design decision surfaced is not averaged
 * away into a number.
 */
export function getCreatorInbox(projectId: string): CreatorInbox | undefined {
  const project = get<Row>(
    `SELECT id, slug, title FROM projects WHERE id = ? AND deleted_at IS NULL`,
    [projectId],
  )
  if (!project) return undefined

  const themeRows = all<Row>(
    `SELECT t.id, t.label, t.summary_md, t.source, t.category_id, t.severity_score,
            t.sentiment_score, t.first_seen_at, t.last_seen_at,
            fc.label AS category_label,
            COUNT(fp.id)                        AS point_count,
            COUNT(DISTINCT f.reviewer_id)       AS reviewer_count,
            SUM(CASE WHEN f.reviewer_is_expert = 1 THEN 1 ELSE 0 END) AS expert_count,
            SUM(CASE WHEN fp.is_resolved = 1 THEN 1 ELSE 0 END)       AS resolved_count,
            SUM(CASE WHEN fp.severity = 'blocker' THEN 1 ELSE 0 END)  AS sev_blocker,
            SUM(CASE WHEN fp.severity = 'major'   THEN 1 ELSE 0 END)  AS sev_major,
            SUM(CASE WHEN fp.severity = 'minor'   THEN 1 ELSE 0 END)  AS sev_minor,
            SUM(CASE WHEN fp.severity = 'nit'     THEN 1 ELSE 0 END)  AS sev_nit,
            SUM(CASE WHEN fp.severity = 'praise'  THEN 1 ELSE 0 END)  AS sev_praise,
            AVG(CAST(fp.sentiment AS REAL))     AS sentiment_mean,
            AVG(CAST(fp.sentiment AS REAL) * CAST(fp.sentiment AS REAL)) AS sentiment_sq
       FROM feedback_themes t
       LEFT JOIN feedback_categories fc ON fc.id = t.category_id
       LEFT JOIN feedback_point_themes pt ON pt.theme_id = t.id
       LEFT JOIN feedback_points fp ON fp.id = pt.point_id
       LEFT JOIN feedback f ON f.id = fp.feedback_id
                           AND f.status = 'submitted' AND f.deleted_at IS NULL
      WHERE t.project_id = ? AND t.is_archived = 0
      GROUP BY t.id, t.label, t.summary_md, t.source, t.category_id, t.severity_score,
               t.sentiment_score, t.first_seen_at, t.last_seen_at, fc.label
      ORDER BY t.severity_score DESC, point_count DESC`,
    [projectId],
  )

  const themes = themeRows.map((r): ThemeRollupRow => {
    const bySeverity = emptySeverityCounts()
    addSeverity(bySeverity, 'blocker', num(r, 'sev_blocker'))
    addSeverity(bySeverity, 'major', num(r, 'sev_major'))
    addSeverity(bySeverity, 'minor', num(r, 'sev_minor'))
    addSeverity(bySeverity, 'nit', num(r, 'sev_nit'))
    addSeverity(bySeverity, 'praise', num(r, 'sev_praise'))
    const pointCount = num(r, 'point_count')
    const mean = num(r, 'sentiment_mean')
    const meanSq = num(r, 'sentiment_sq')
    // Population standard deviation of the sentiment values inside the theme.
    const sigma = Math.sqrt(Math.max(0, meanSq - mean * mean))
    return {
      id: str(r, 'id'),
      label: str(r, 'label'),
      summaryMd: strOrNull(r, 'summary_md'),
      source: (str(r, 'source') || 'auto') as ThemeRollupRow['source'],
      categoryId: strOrNull(r, 'category_id'),
      categoryLabel: strOrNull(r, 'category_label'),
      pointCount,
      reviewerCount: num(r, 'reviewer_count'),
      severityScore: num(r, 'severity_score'),
      sentimentScore: numOrNull(r, 'sentiment_score') ?? (pointCount > 0 ? round3(mean) : null),
      bySeverity,
      contested: pointCount >= 2 && sigma >= THEME.contestedSigma,
      expertCount: num(r, 'expert_count'),
      firstSeenAt: numOrNull(r, 'first_seen_at'),
      lastSeenAt: numOrNull(r, 'last_seen_at'),
      openCount: Math.max(0, pointCount - num(r, 'resolved_count')),
      resolvedCount: num(r, 'resolved_count'),
    }
  })

  const totals = get<Row>(
    `SELECT
       COUNT(DISTINCT f.id)                                            AS reviews,
       COUNT(fp.id)                                                    AS points,
       COUNT(DISTINCT f.reviewer_id)                                   AS reviewers,
       SUM(CASE WHEN f.inbox_state = 'new' THEN 1 ELSE 0 END)          AS state_new,
       SUM(CASE WHEN f.inbox_state = 'read' THEN 1 ELSE 0 END)         AS state_read,
       SUM(CASE WHEN f.inbox_state = 'triaged' THEN 1 ELSE 0 END)      AS state_triaged,
       SUM(CASE WHEN f.inbox_state = 'actioned' THEN 1 ELSE 0 END)     AS state_actioned,
       SUM(CASE WHEN f.inbox_state = 'archived' THEN 1 ELSE 0 END)     AS state_archived,
       SUM(CASE WHEN f.first_reply_at IS NULL THEN 1 ELSE 0 END)       AS unanswered,
       SUM(CASE WHEN fp.severity = 'blocker' THEN 1 ELSE 0 END)        AS sev_blocker,
       SUM(CASE WHEN fp.severity = 'major'   THEN 1 ELSE 0 END)        AS sev_major,
       SUM(CASE WHEN fp.severity = 'minor'   THEN 1 ELSE 0 END)        AS sev_minor,
       SUM(CASE WHEN fp.severity = 'nit'     THEN 1 ELSE 0 END)        AS sev_nit,
       SUM(CASE WHEN fp.severity = 'praise'  THEN 1 ELSE 0 END)        AS sev_praise,
       SUM(CASE WHEN fp.id IS NOT NULL AND NOT EXISTS (
             SELECT 1 FROM feedback_point_themes pt2 WHERE pt2.point_id = fp.id)
           THEN 1 ELSE 0 END)                                          AS unthemed
     FROM feedback f
     LEFT JOIN feedback_points fp ON fp.feedback_id = f.id
    WHERE f.project_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL`,
    [projectId],
  )

  const bySeverity = emptySeverityCounts()
  addSeverity(bySeverity, 'blocker', num(totals, 'sev_blocker'))
  addSeverity(bySeverity, 'major', num(totals, 'sev_major'))
  addSeverity(bySeverity, 'minor', num(totals, 'sev_minor'))
  addSeverity(bySeverity, 'nit', num(totals, 'sev_nit'))
  addSeverity(bySeverity, 'praise', num(totals, 'sev_praise'))

  const coverage = all<Row>(
    `SELECT id, prompt, answer_count FROM project_asks WHERE project_id = ? ORDER BY sort_order`,
    [projectId],
  ).map((r) => ({
    askId: str(r, 'id'),
    prompt: str(r, 'prompt'),
    answerCount: num(r, 'answer_count'),
  }))

  return {
    projectId,
    projectSlug: str(project, 'slug'),
    projectTitle: str(project, 'title'),
    themes,
    unthemed: num(totals, 'unthemed'),
    totals: {
      reviews: num(totals, 'reviews'),
      points: num(totals, 'points'),
      reviewers: num(totals, 'reviewers'),
      unread: num(totals, 'state_new'),
      unanswered: num(totals, 'unanswered'),
      blockers: num(totals, 'sev_blocker'),
      bySeverity,
      byState: {
        new: num(totals, 'state_new'),
        read: num(totals, 'state_read'),
        triaged: num(totals, 'state_triaged'),
        actioned: num(totals, 'state_actioned'),
        archived: num(totals, 'state_archived'),
      },
    },
    coverage,
  }
}

/** Points inside one theme, worst first, with reviewer and build attached. */
export function listPointsInTheme(themeId: string, viewerId?: string | null): readonly FeedbackPointView[] {
  const rows = all<Row>(
    `SELECT fp.*, fc.category_key, fc.label AS category_label
       FROM feedback_point_themes pt
       JOIN feedback_points fp ON fp.id = pt.point_id
       JOIN feedback f ON f.id = fp.feedback_id
       LEFT JOIN feedback_categories fc ON fc.id = fp.category_id
      WHERE pt.theme_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL
      ORDER BY CASE fp.severity
                 WHEN 'blocker' THEN 0 WHEN 'major' THEN 1
                 WHEN 'minor' THEN 2 WHEN 'nit' THEN 3 ELSE 4 END,
               fp.upvote_count DESC`,
    [themeId],
  )
  const ids = rows.map((r) => str(r, 'id'))
  const voted = new Set<string>()
  if (viewerId && ids.length > 0) {
    for (const r of all<Row>(
      `SELECT point_id FROM feedback_point_votes WHERE voter_id = ? AND point_id IN (${placeholders(ids.length)})`,
      [viewerId, ...ids],
    )) {
      voted.add(str(r, 'point_id'))
    }
  }
  return rows.map((r) => mapPoint(r, new Map(), new Map(), voted))
}

/* ------------------------------------------------------------------------- *
 * Triage and conversation
 * ------------------------------------------------------------------------- */

export function setInboxState(feedbackId: string, state: InboxState): void {
  run(`UPDATE feedback SET inbox_state = ?, updated_at = ? WHERE id = ?`, [state, now(), feedbackId])
}

/**
 * The creator's helpful mark. It is worth less the more freely a creator gives
 * it — see `κ(c)` in reputation.ts — and on a bounty-paid review it is worth
 * nothing at all, because money must not buy the mark.
 */
export function markHelpful(feedbackId: string, helpful: boolean): void {
  const ts = now()
  tx(() => {
    run(
      `UPDATE feedback SET creator_marked_helpful = ?, updated_at = ? WHERE id = ?`,
      [helpful ? 1 : 0, ts, feedbackId],
    )
    const row = get<Row>(`SELECT reviewer_id FROM feedback WHERE id = ?`, [feedbackId])
    const reviewerId = str(row, 'reviewer_id')
    if (helpful && reviewerId) {
      recordReputationEvent({
        userId: reviewerId,
        facet: 'reviewer',
        kind: 'feedback_marked_helpful',
        delta: 10,
        subjectType: 'feedback',
        subjectId: feedbackId,
      })
    }
    if (reviewerId) invalidateReputation(reviewerId)
  })
}

/** One vote per person per review, enforced by the primary key rather than hope. */
export function voteFeedback(feedbackId: string, voterId: string, value: -1 | 0 | 1): void {
  const ts = now()
  tx(() => {
    if (value === 0) {
      run(`DELETE FROM feedback_votes WHERE feedback_id = ? AND voter_id = ?`, [feedbackId, voterId])
    } else {
      run(
        `INSERT INTO feedback_votes (feedback_id, voter_id, vote_value, created_at) VALUES (?, ?, ?, ?)
         ON CONFLICT (feedback_id, voter_id) DO UPDATE SET vote_value = excluded.vote_value`,
        [feedbackId, voterId, value, ts],
      )
    }
    run(
      `UPDATE feedback
          SET helpful_count = (SELECT COUNT(*) FROM feedback_votes v
                                WHERE v.feedback_id = ? AND v.vote_value = 1),
              unhelpful_count = (SELECT COUNT(*) FROM feedback_votes v
                                  WHERE v.feedback_id = ? AND v.vote_value = -1),
              updated_at = ?
        WHERE id = ?`,
      [feedbackId, feedbackId, ts, feedbackId],
    )
  })
  const row = get<Row>(`SELECT reviewer_id FROM feedback WHERE id = ?`, [feedbackId])
  if (row) invalidateReputation(str(row, 'reviewer_id'))
}

/** "I hit this too" on one observation. Distinct from rating a whole review. */
export function votePoint(pointId: string, voterId: string, on: boolean): number {
  tx(() => {
    if (on) {
      run(
        `INSERT INTO feedback_point_votes (point_id, voter_id, created_at) VALUES (?, ?, ?)
         ON CONFLICT (point_id, voter_id) DO NOTHING`,
        [pointId, voterId, now()],
      )
    } else {
      run(`DELETE FROM feedback_point_votes WHERE point_id = ? AND voter_id = ?`, [pointId, voterId])
    }
    run(
      `UPDATE feedback_points SET upvote_count = (
         SELECT COUNT(*) FROM feedback_point_votes WHERE point_id = ?), updated_at = ?
       WHERE id = ?`,
      [pointId, now(), pointId],
    )
  })
  return num(get<Row>(`SELECT upvote_count FROM feedback_points WHERE id = ?`, [pointId]), 'upvote_count')
}

export function setPointResolved(pointId: string, resolved: boolean): void {
  run(`UPDATE feedback_points SET is_resolved = ?, updated_at = ? WHERE id = ?`, [
    resolved ? 1 : 0,
    now(),
    pointId,
  ])
}

export interface NewReplyInput {
  readonly feedbackId: string
  readonly authorId: string
  readonly bodyMd: string
  readonly pointId?: string | null
  readonly parentReplyId?: string | null
}

/**
 * A reply is the creator spending something, so it is also what the response
 * rate and the anti-extraction penalty are measured on. `first_reply_at` is
 * written once and never moved.
 */
export function createReply(input: NewReplyInput): string {
  const id = uid()
  const ts = now()
  tx(() => {
    const meta = get<Row>(
      `SELECT f.reviewer_id, f.project_id, p.owner_id, p.slug, p.title
         FROM feedback f JOIN projects p ON p.id = f.project_id
        WHERE f.id = ?`,
      [input.feedbackId],
    )
    const isCreator = str(meta, 'owner_id') === input.authorId
    run(
      `INSERT INTO feedback_replies
         (id, feedback_id, point_id, parent_reply_id, author_id, body_md, is_creator, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.feedbackId,
        input.pointId ?? null,
        input.parentReplyId ?? null,
        input.authorId,
        input.bodyMd,
        isCreator ? 1 : 0,
        ts,
        ts,
      ],
    )
    run(
      `UPDATE feedback
          SET reply_count = (SELECT COUNT(*) FROM feedback_replies fr
                              WHERE fr.feedback_id = ? AND fr.deleted_at IS NULL),
              first_reply_at = CASE WHEN ? = 1 THEN COALESCE(first_reply_at, ?) ELSE first_reply_at END,
              inbox_state = CASE WHEN ? = 1 AND inbox_state = 'new' THEN 'read' ELSE inbox_state END,
              updated_at = ?
        WHERE id = ?`,
      [input.feedbackId, isCreator ? 1 : 0, ts, isCreator ? 1 : 0, ts, input.feedbackId],
    )
    const projectId = str(meta, 'project_id')
    run(
      `UPDATE project_stats
          SET reply_rate = COALESCE((
                SELECT CAST(SUM(CASE WHEN f.first_reply_at IS NOT NULL THEN 1 ELSE 0 END) AS REAL)
                     / NULLIF(COUNT(*), 0)
                  FROM feedback f
                 WHERE f.project_id = ? AND f.status = 'submitted' AND f.deleted_at IS NULL), 0.0),
              last_activity_at = ?, computed_at = ?
        WHERE project_id = ?`,
      [projectId, ts, ts, projectId],
    )

    const reviewerId = str(meta, 'reviewer_id')
    const recipient = input.authorId === reviewerId ? str(meta, 'owner_id') : reviewerId
    if (recipient && recipient !== input.authorId) {
      notify({
        userId: recipient,
        actorId: input.authorId,
        kind: 'feedback_reply',
        subjectType: 'feedback',
        subjectId: input.feedbackId,
        title: `Reply on your review of ${str(meta, 'title')}`,
        url: noteOnProjectUrl(str(meta, 'slug'), input.feedbackId),
        groupKey: `reply:${input.feedbackId}`,
      })
    }
    if (isCreator) {
      recordReputationEvent({
        userId: input.authorId,
        facet: 'creator',
        kind: 'creator_replied',
        delta: 3,
        subjectType: 'feedback',
        subjectId: input.feedbackId,
      })
    }
  })
  recomputeHotScore(str(get<Row>(`SELECT project_id FROM feedback WHERE id = ?`, [input.feedbackId]), 'project_id'))
  return id
}

/** The thread under one review, nested one level deep as the schema allows. */
export function listReplies(feedbackId: string): readonly FeedbackReplyView[] {
  const rows = all<Row>(
    `SELECT fr.*, ${userCardSelect('u', 'pr', 'rs', 'a')}
       FROM feedback_replies fr
       JOIN users u ON u.id = fr.author_id
       ${userCardJoin('u', 'pr', 'rs')}
      WHERE fr.feedback_id = ? AND fr.deleted_at IS NULL
      ORDER BY fr.created_at`,
    [feedbackId],
  )

  const byId = new Map<string, FeedbackReplyView & { childList: FeedbackReplyView[] }>()
  const roots: (FeedbackReplyView & { childList: FeedbackReplyView[] })[] = []

  for (const r of rows) {
    const childList: FeedbackReplyView[] = []
    const view = {
      id: str(r, 'id'),
      bodyMd: str(r, 'body_md'),
      author: mapUserCard(r, 'a'),
      isCreator: bool(r, 'is_creator'),
      pointId: strOrNull(r, 'point_id'),
      parentReplyId: strOrNull(r, 'parent_reply_id'),
      createdAt: num(r, 'created_at'),
      updatedAt: num(r, 'updated_at'),
      children: childList,
      childList,
    }
    byId.set(view.id, view)
  }
  for (const view of byId.values()) {
    const parent = view.parentReplyId ? byId.get(view.parentReplyId) : undefined
    if (parent) parent.childList.push(view)
    else roots.push(view)
  }
  return roots
}

/* ------------------------------------------------------------------------- *
 * Drafts
 * ------------------------------------------------------------------------- */

/** A reviewer gets one open draft per build; finishing it unblocks the next. */
export function getDraft(projectId: string, reviewerId: string): FeedbackRow | undefined {
  return get<FeedbackRow>(
    `SELECT * FROM feedback
      WHERE project_id = ? AND reviewer_id = ? AND status = 'draft' AND deleted_at IS NULL
      LIMIT 1`,
    [projectId, reviewerId],
  )
}

export function listMyDrafts(reviewerId: string): readonly Row[] {
  return all<Row>(
    `SELECT f.id, f.project_id, f.updated_at, p.slug, p.title
       FROM feedback f JOIN projects p ON p.id = f.project_id
      WHERE f.reviewer_id = ? AND f.status = 'draft' AND f.deleted_at IS NULL
      ORDER BY f.updated_at DESC`,
    [reviewerId],
  )
}

export function withdrawFeedback(feedbackId: string, reviewerId: string): boolean {
  const r = run(
    `UPDATE feedback SET status = 'withdrawn', updated_at = ? WHERE id = ? AND reviewer_id = ?`,
    [now(), feedbackId, reviewerId],
  )
  return r.changes === 1
}

/** Severity ordering exposed so a surface can sort a list it already holds. */
export function compareBySeverity(a: { severity: SeverityKey }, b: { severity: SeverityKey }): number {
  return severityRank(a.severity) - severityRank(b.severity)
}

/** The theme severity score: blockers dominate, corroboration multiplies. */
export function recomputeThemeScores(projectId: string): void {
  run(
    `UPDATE feedback_themes
        SET severity_score = COALESCE((
              SELECT SUM(CASE fp.severity
                          WHEN 'blocker' THEN ? WHEN 'major' THEN ?
                          WHEN 'minor' THEN ? WHEN 'nit' THEN ? ELSE 0.0 END
                        * pt.confidence
                        * (1.0 + 0.25 * fp.upvote_count))
                FROM feedback_point_themes pt
                JOIN feedback_points fp ON fp.id = pt.point_id
               WHERE pt.theme_id = feedback_themes.id), 0.0),
            point_count = (SELECT COUNT(*) FROM feedback_point_themes pt2 WHERE pt2.theme_id = feedback_themes.id),
            reviewer_count = (SELECT COUNT(DISTINCT f.reviewer_id)
                                FROM feedback_point_themes pt3
                                JOIN feedback_points fp3 ON fp3.id = pt3.point_id
                                JOIN feedback f ON f.id = fp3.feedback_id
                               WHERE pt3.theme_id = feedback_themes.id),
            updated_at = ?
      WHERE project_id = ?`,
    [
      severityWeight('blocker'),
      severityWeight('major'),
      severityWeight('minor'),
      severityWeight('nit'),
      now(),
      projectId,
    ],
  )
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000
}
