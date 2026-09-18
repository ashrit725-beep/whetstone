import './guard'
import { normalise } from './text'
import type { Severity } from './types'

/**
 * The valence and severity vocabulary the non-AI triage path runs on.
 *
 * Two rules shape it. Sentiment describes the experience, not the politeness of
 * the writing, so a cheerful bug report reads negative. Severity is defined by
 * consequence, not by heat: "this is infuriating" with no functional
 * consequence is a nit, and the table below never lets intensity promote it.
 */

/** Domain valence list. Positive and negative weights on the same scale. */
const VALENCE: Record<string, number> = {
  // positive, general
  love: 1, loved: 1, great: 0.8, excellent: 1, brilliant: 1, delightful: 0.9, fantastic: 0.9,
  good: 0.6, nice: 0.55, solid: 0.6, clean: 0.5, polished: 0.8, smooth: 0.7, crisp: 0.7,
  satisfying: 0.85, intuitive: 0.8, clear: 0.6, readable: 0.6, responsive: 0.7, snappy: 0.8,
  helpful: 0.7, useful: 0.7, elegant: 0.8, thoughtful: 0.7, charming: 0.8, gorgeous: 0.9,
  impressive: 0.85, works: 0.5, worked: 0.5, enjoyed: 0.85, fun: 0.85, addictive: 0.7,
  compelling: 0.8, tight: 0.7, fair: 0.5, balanced: 0.6, generous: 0.5, welcome: 0.4,
  // negative, general
  hate: -1, awful: -1, terrible: -1, horrible: -1, bad: -0.7, poor: -0.7, ugly: -0.6,
  confusing: -0.7, confused: -0.65, unclear: -0.6, misleading: -0.75, frustrating: -0.8,
  frustrated: -0.8, annoying: -0.65, irritating: -0.65, tedious: -0.6, boring: -0.7,
  repetitive: -0.55, grindy: -0.55, clunky: -0.7, awkward: -0.6, janky: -0.75, sluggish: -0.7,
  slow: -0.6, laggy: -0.75, stutter: -0.7, choppy: -0.7, floaty: -0.5, unresponsive: -0.85,
  broken: -0.9, buggy: -0.85, unstable: -0.85, unplayable: -1, unusable: -1, useless: -0.9,
  disappointing: -0.8, disappointed: -0.8, wrong: -0.6, missing: -0.5, lost: -0.7,
  stuck: -0.75, blocked: -0.8, failed: -0.8, fails: -0.8, crash: -0.95, crashed: -0.95,
  freeze: -0.9, froze: -0.9, hang: -0.7, softlock: -0.95, corrupt: -1, corrupted: -1,
  overwhelming: -0.5, cluttered: -0.6, cramped: -0.5, noisy: -0.45, harsh: -0.5,
  punishing: -0.5, unfair: -0.75, exploit: -0.5, dominant: -0.35, grind: -0.5,
  // hedges that carry mild negative valence in a review context
  meh: -0.5, okay: -0.1, fine: 0.1, whatever: -0.4, mediocre: -0.65,
}

/** Negators flip the valence of the next few tokens. */
const NEGATORS: ReadonlySet<string> = new Set([
  'not', 'no', 'never', 'none', 'cannot', 'cant', 'couldnt', 'didnt', 'doesnt', 'dont',
  'isnt', 'wasnt', 'werent', 'wont', 'without', 'hardly', 'barely', 'rarely', 'lacks', 'lacking',
])

/** Intensifiers scale the next token; downtoners shrink it. */
const INTENSIFIERS: Record<string, number> = {
  very: 1.5, really: 1.4, extremely: 1.8, incredibly: 1.7, hugely: 1.6, massively: 1.6,
  totally: 1.5, completely: 1.6, absolutely: 1.7, super: 1.4, so: 1.3, way: 1.3,
  slightly: 0.5, somewhat: 0.6, a: 1, bit: 0.6, little: 0.6, mildly: 0.5, fairly: 0.8,
  kinda: 0.6, kind: 0.7, sort: 0.7, mostly: 0.9, pretty: 1.1,
}

const NEGATION_WINDOW = 3

export type ValenceReading = {
  /** Mean polarity of the matched terms, in the range −1 to 1. */
  score: number
  /** How many lexicon terms matched. Below three, treat the reading as weak. */
  matches: number
}

/**
 * Negation-aware, intensifier-aware valence over a normalised string. Reported
 * with a match count so callers can tell a confident read from a thin one
 * instead of treating a single matched word as a verdict.
 */
export function valence(text: string): ValenceReading {
  const words = normalise(text).split(' ').filter(Boolean)
  let total = 0
  let matches = 0
  for (let i = 0; i < words.length; i++) {
    const word = words[i]
    if (!word) continue
    const base = VALENCE[word]
    if (base === undefined) continue
    let weight = base
    const before = words[i - 1]
    if (before) {
      const scale = INTENSIFIERS[before]
      if (scale !== undefined) weight *= scale
    }
    for (let back = 1; back <= NEGATION_WINDOW; back++) {
      const prior = words[i - back]
      if (prior && NEGATORS.has(prior)) {
        // A negated positive is a complaint; a negated negative is only mild
        // relief, so the flip is asymmetric rather than a sign change.
        weight = weight > 0 ? -weight : Math.abs(weight) * 0.4
        break
      }
    }
    total += Math.max(-1.5, Math.min(1.5, weight))
    matches += 1
  }
  if (matches === 0) return { score: 0, matches: 0 }
  return { score: Math.max(-1, Math.min(1, total / matches)), matches }
}

/**
 * The severity ladder, by consequence. Ordered most severe first; the first
 * matching rung wins so "crash" beats "confusing" in the same sentence.
 */
const SEVERITY_PATTERNS: ReadonlyArray<{ rung: Severity; pattern: RegExp }> = [
  {
    rung: 'blocker',
    pattern:
      /\b(crash(?:e[sd])?|freez(?:e|es|ing)|froze|data ?loss|corrupt(?:ed|ion)?|lost (?:my )?(?:save|progress|work|data)|wipe[sd]? (?:my )?(?:save|data)|can.?t (?:launch|start|open|install)|won.?t (?:launch|start|boot)|unplayable|unusable|softlock(?:ed)?|hard ?lock|infinite loop|security|xss|sql injection|leak(?:s|ed)? (?:my )?(?:password|token|key)|blue ?screen|kernel panic)\b/,
  },
  {
    rung: 'major',
    pattern:
      /\b(broken|blocke[dr]|fail(?:s|ed|ure)?|error|exception|stack ?trace|404|500|timed? ?out|dead ?end|unresponsive|doesn.?t work|does not work|never works|cannot (?:save|submit|continue|proceed)|can.?t (?:save|submit|continue|proceed)|blocks? (?:me|the|my))\b/,
  },
  {
    rung: 'minor',
    pattern:
      /\b(confus(?:ing|ed)|unclear|slow|laggy|stutter(?:s|ing)?|janky|clunky|awkward|annoying|tedious|misleading|hard to (?:find|read|see)|had to (?:guess|retry|redo)|workaround)\b/,
  },
  { rung: 'nit', pattern: /\b(nit|nitpick|polish|typo|spacing|alignment|kerning|minor|cosmetic|small thing)\b/ },
]

/** The rung the text argues for on its own, ignoring the reviewer's selection. */
export function severityFromText(text: string): Severity | undefined {
  const s = normalise(text)
  for (const { rung, pattern } of SEVERITY_PATTERNS) {
    if (pattern.test(s)) return rung
  }
  return undefined
}

/** Type detection from the body, used to correct a mis-picked category. */
const TYPE_PATTERNS: ReadonlyArray<{ type: FeedbackType; pattern: RegExp }> = [
  { type: 'bug', pattern: /\b(bugs?|crash(?:e[sd]|ing)?|errors?|exception|repro|reproduce|steps to|stack ?trace|broken|regression|corrupt(?:ed|ion)?|wiped|softlock)\b/ },
  { type: 'performance', pattern: /(\d+\s?fps|\bfps\b|\bframe ?rate|\bframe ?pacing|\blag\b|\blatency\b|\bslow\b|\bload(?:ing)? time|\bmemory\b|\bcpu\b|\bgpu\b|\bbattery\b|\bjank|\d+\s?ms\b|\bthroughput\b)/ },
  { type: 'balance', pattern: /\b(balance|difficulty|too (?:easy|hard)|overpowered|op\b|underpowered|grind|economy|progression|tuning|curve)\b/ },
  { type: 'usability', pattern: /\b(confus|unclear|couldn.?t find|where do i|expected|discover|navigation|onboarding|tutorial|label|affordance|accessib)\b/ },
  { type: 'feature_request', pattern: /\b(would love|wish|it would be (?:nice|great)|please add|feature request|missing|should (?:have|support)|add (?:a|an|the))\b/ },
  { type: 'content', pattern: /\b(copy|wording|typo|grammar|art|music|sound|narrative|story|dialogue|writing|thumbnail)\b/ },
  { type: 'praise', pattern: /\b(love|loved|great|excellent|nailed|beautiful|satisfying|delight|keep this|don.?t change)\b/ },
]

export type FeedbackType =
  | 'bug'
  | 'usability'
  | 'balance'
  | 'performance'
  | 'content'
  | 'feature_request'
  | 'praise'
  | 'off_topic'

export function typeFromText(text: string): FeedbackType | undefined {
  const s = normalise(text)
  for (const { type, pattern } of TYPE_PATTERNS) {
    if (pattern.test(s)) return type
  }
  return undefined
}

/** Drafts made almost entirely of these are the ones the coach exists for. */
export const LOW_SIGNAL_PHRASES: readonly string[] = [
  'looks good', 'look good', 'looks great', 'nice work', 'good job', 'great job', 'well done',
  'love it', 'loved it', 'like it', 'cool', 'awesome', 'amazing', 'keep it up', 'keep going',
  'no notes', 'lgtm', 'ship it', 'good luck', 'nothing to add', 'all good', 'solid work',
  'really cool', 'pretty cool', 'so good', 'very nice', 'this is great', 'great stuff',
]

/** Units and quantities that mark a claim as measured rather than impressionistic. */
export const UNIT_PATTERN =
  /\b\d+(?:\.\d+)?\s?(?:fps|hz|ms|s|sec|secs|seconds?|min|mins|minutes?|hrs?|hours?|mb|gb|kb|px|rem|%|x|k)\b/i

/** Mentions of when or how, which is what makes a report reproducible. */
export const REPRO_PATTERN =
  /\b(when|after|before|if|on|during|while|step(?:s)?|repro|reproduce|reproducible|every time|each time|first time|consistently|clicked?|tapped?|pressed?|opened?|navigat\w*|reload\w*|restart\w*)\b/i

/** Expected-versus-actual framing, the single strongest quality signal. */
export const CONTRAST_PATTERN =
  /\b(expected|instead|but|whereas|however|thought it would|should have|would have|rather than|actual(?:ly)?|got)\b/i

/** A timecode, route, screen or level reference: a located claim. */
export const ANCHOR_PATTERN =
  /(\b\d{1,2}:\d{2}(?::\d{2})?\b|\/[a-z0-9\-_/]{2,}|\blevel \d+\b|\bchapter \d+\b|\bstage \d+\b|\bscreen\b|\bpage\b|\bscene\b|\btab\b|\bmodal\b|\bcheckpoint\b)/i

/** Second-person directives aimed at the reviewer rather than the work. */
export const PERSONAL_PATTERN = /\b(you should|you need to|you clearly|the dev|the creator|whoever made)\b/i
