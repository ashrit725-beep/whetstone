import './guard'
import { fnv1a } from './hash'

/**
 * The text engine the non-AI paths are built on: normalisation, a light stemmer,
 * TF-IDF, cosine, character trigrams, SimHash and MinHash. Pure functions, no
 * dependencies, no network, deterministic for a given input.
 *
 * This is the default path, not a fallback of last resort. With no provider key
 * configured every one of the six features runs on what is in this file, so it
 * is written to be genuinely good rather than merely present.
 */

const CODE_FENCE = /```[\s\S]*?```/g
const INLINE_CODE = /`[^`]*`/g
const URL = /\bhttps?:\/\/\S+/gi
const NON_WORD = /[^a-z0-9']+/g

/** English function words plus the vocabulary every feedback item shares. */
export const STOPWORDS: ReadonlySet<string> = new Set([
  'a','about','above','after','again','all','also','am','an','and','any','are','as','at','be','because','been',
  'before','being','below','between','both','but','by','can','cant','could','did','do','does','doing','dont',
  'down','during','each','few','for','from','further','had','has','have','having','he','her','here','hers','him',
  'his','how','i','if','im','in','into','is','it','its','ive','just','me','more','most','my','no','nor','not','of',
  'off','on','once','only','or','other','our','out','over','own','same','she','should','so','some','such','than',
  'that','the','their','them','then','there','these','they','this','those','through','to','too','under','until',
  'up','very','was','we','were','what','when','where','which','while','who','whom','why','will','with','would',
  'you','your','yours','ill','id','youre','thats','theres','well','get','got','go','going','one','two','lot',
  // Domain stoplist. These words appear in nearly every item on the platform and
  // carry no discriminative signal, so leaving them in flattens every vector.
  'feedback','review','project','game','app','build','version','thing','things','stuff','bit','really','quite',
  'maybe','think','thought','feel','feels','felt','seem','seems','like','liked','overall','general','note','notes',
  'point','points','item','items','play','played','playing','tried','trying','use','used','using','user','users',
])

/** Strip markup, links and code, fold case, and collapse whitespace. */
export function normalise(input: string): string {
  return input
    .replace(CODE_FENCE, ' ')
    .replace(INLINE_CODE, ' ')
    .replace(URL, ' ')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(NON_WORD, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A deliberately small suffix stripper. Full Porter would be more aggressive
 * than this corpus rewards: "crashing" and "crashes" must collapse, "controls"
 * and "controller" must not.
 */
export function stem(word: string): string {
  let s = word
  if (s.length <= 3) return s
  if (s.endsWith('ies') && s.length > 4) return `${s.slice(0, -3)}y`
  if (s.endsWith('sses')) return s.slice(0, -2)
  if (s.endsWith('ss')) return s
  if (s.endsWith('s') && !s.endsWith('us') && !s.endsWith('is')) s = s.slice(0, -1)
  if (s.length > 5 && s.endsWith('ing')) s = undouble(s.slice(0, -3))
  else if (s.length > 4 && s.endsWith('ed')) s = undouble(s.slice(0, -2))
  if (s.length > 5 && s.endsWith('ly')) s = s.slice(0, -2)
  if (s.length > 6 && s.endsWith('ness')) s = s.slice(0, -4)
  if (s.length > 6 && s.endsWith('ment')) s = s.slice(0, -4)
  if (s.length > 4 && s.endsWith('e') && !s.endsWith('ee')) s = s.slice(0, -1)
  return s.length >= 2 ? s : word
}

function undouble(s: string): string {
  const last = s.at(-1)
  const prev = s.at(-2)
  if (last && prev && last === prev && !'aeiou'.includes(last)) return s.slice(0, -1)
  return s
}

/** Content tokens: normalised, stopword-filtered, stemmed, length two or more. */
export function tokens(input: string): string[] {
  const out: string[] = []
  for (const raw of normalise(input).split(' ')) {
    if (raw.length < 2) continue
    if (STOPWORDS.has(raw)) continue
    const s = stem(raw)
    if (s.length < 2) continue
    if (STOPWORDS.has(s)) continue
    out.push(s)
  }
  return out
}

/** Unigrams plus adjacent bigrams. Bigrams are what produce readable labels. */
export function unigramsAndBigrams(input: string): string[] {
  const uni = tokens(input)
  const out = [...uni]
  for (let i = 0; i + 1 < uni.length; i++) {
    const a = uni[i]
    const b = uni[i + 1]
    if (a && b) out.push(`${a} ${b}`)
  }
  return out
}

/** Character n-grams over the normalised string, whitespace included as a gram. */
export function charNGrams(input: string, n: number): Set<string> {
  const s = normalise(input)
  const out = new Set<string>()
  if (s.length < n) {
    if (s.length > 0) out.add(s)
    return out
  }
  for (let i = 0; i + n <= s.length; i++) out.add(s.slice(i, i + n))
  return out
}

/** Character trigrams. The measure behind the duplicate-detection fallback. */
export function trigrams(input: string): Set<string> {
  return charNGrams(input, 3)
}

/** Word n-grams over content tokens, used alongside character grams. */
export function wordNGrams(input: string, n: number): Set<string> {
  const t = tokens(input)
  const out = new Set<string>()
  if (t.length < n) {
    if (t.length > 0) out.add(t.join(' '))
    return out
  }
  for (let i = 0; i + n <= t.length; i++) out.add(t.slice(i, i + n).join(' '))
  return out
}

export function jaccard(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  let shared = 0
  for (const v of small) if (large.has(v)) shared += 1
  const union = a.size + b.size - shared
  return union === 0 ? 0 : shared / union
}

/** Dice coefficient. Kinder than Jaccard on short strings, which feedback is. */
export function dice(a: ReadonlySet<string>, b: ReadonlySet<string>): number {
  if (a.size === 0 || b.size === 0) return 0
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  let shared = 0
  for (const v of small) if (large.has(v)) shared += 1
  return (2 * shared) / (a.size + b.size)
}

// --- vectors ----------------------------------------------------------------

export type Vector = Map<string, number>

export function termFrequency(terms: readonly string[]): Vector {
  const v: Vector = new Map()
  for (const t of terms) v.set(t, (v.get(t) ?? 0) + 1)
  return v
}

/**
 * Inverse document frequency over this project's own corpus, so project-specific
 * jargon ("deckbuilder", "netcode") stays discriminative instead of being
 * diluted by a global frequency table drawn from a different kind of product.
 */
export function buildIdf(documents: ReadonlyArray<readonly string[]>): Map<string, number> {
  const df = new Map<string, number>()
  for (const doc of documents) {
    for (const term of new Set(doc)) df.set(term, (df.get(term) ?? 0) + 1)
  }
  const n = Math.max(1, documents.length)
  const idf = new Map<string, number>()
  for (const [term, count] of df) idf.set(term, Math.log((n + 1) / (count + 0.5)) + 1)
  return idf
}

/** L2-normalised TF-IDF, so cosine is a plain dot product. */
export function tfidfVector(terms: readonly string[], idf: ReadonlyMap<string, number>): Vector {
  const tf = termFrequency(terms)
  const v: Vector = new Map()
  let norm = 0
  for (const [term, count] of tf) {
    const weight = (1 + Math.log(count)) * (idf.get(term) ?? 1)
    v.set(term, weight)
    norm += weight * weight
  }
  const len = Math.sqrt(norm)
  if (len === 0) return v
  for (const [term, weight] of v) v.set(term, weight / len)
  return v
}

export function cosine(a: Vector, b: Vector): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a]
  let dot = 0
  for (const [term, weight] of small) {
    const other = large.get(term)
    if (other !== undefined) dot += weight * other
  }
  return dot
}

/** Running centroid, re-normalised so cosine against it stays in range. */
export function centroidOf(vectors: readonly Vector[]): Vector {
  const sum: Vector = new Map()
  for (const v of vectors) {
    for (const [term, weight] of v) sum.set(term, (sum.get(term) ?? 0) + weight)
  }
  let norm = 0
  for (const weight of sum.values()) norm += weight * weight
  const len = Math.sqrt(norm)
  if (len === 0) return sum
  for (const [term, weight] of sum) sum.set(term, weight / len)
  return sum
}

/** The highest-weight term in a vector, preferring bigrams for readability. */
export function topTerm(vector: Vector): string | undefined {
  let best: string | undefined
  let bestScore = -Infinity
  for (const [term, weight] of vector) {
    // A bigram carries more meaning per character than a unigram, so it earns a
    // bonus rather than having to beat unigrams on raw weight.
    const score = term.includes(' ') ? weight * 1.35 : weight
    if (score > bestScore) {
      bestScore = score
      best = term
    }
  }
  return best
}

// --- SimHash and MinHash ----------------------------------------------------

/** 64-bit SimHash over weighted features. A Hamming prefilter, not a decision. */
export function simhash64(features: ReadonlyMap<string, number> | readonly string[]): bigint {
  const weights = new Array<number>(64).fill(0)
  const entries: Array<[string, number]> =
    Array.isArray(features) ? features.map((f) => [f, 1]) : [...(features as ReadonlyMap<string, number>)]
  for (const [feature, weight] of entries) {
    const lo = fnv1a(feature)
    const hi = fnv1a(feature, 0x811c9dc5 ^ 0x5bf03635)
    for (let bit = 0; bit < 32; bit++) {
      const loBit = (lo >>> bit) & 1
      const hiBit = (hi >>> bit) & 1
      weights[bit] = (weights[bit] ?? 0) + (loBit === 1 ? weight : -weight)
      weights[bit + 32] = (weights[bit + 32] ?? 0) + (hiBit === 1 ? weight : -weight)
    }
  }
  let out = 0n
  for (let bit = 63; bit >= 0; bit--) {
    out = (out << 1n) | ((weights[bit] ?? 0) > 0 ? 1n : 0n)
  }
  return out
}

export function hamming64(a: bigint, b: bigint): number {
  let x = a ^ b
  let count = 0
  while (x !== 0n) {
    x &= x - 1n
    count += 1
  }
  return count
}

const MINHASH_PERMUTATIONS = 128
const SEEDS: readonly number[] = Array.from({ length: MINHASH_PERMUTATIONS }, (_, i) =>
  fnv1a(`whetstone-minhash-${i}`),
)

/**
 * MinHash signature. Estimates Jaccard in constant time per comparison, which is
 * what keeps duplicate detection linear as a project's item count grows.
 */
export function minhash(shingles: ReadonlySet<string>): number[] {
  const signature = new Array<number>(MINHASH_PERMUTATIONS).fill(0xffffffff)
  for (const shingle of shingles) {
    const base = fnv1a(shingle)
    for (let i = 0; i < MINHASH_PERMUTATIONS; i++) {
      const seed = SEEDS[i] ?? 0
      const value = (base ^ seed) >>> 0
      const current = signature[i]
      if (current === undefined || value < current) signature[i] = value
    }
  }
  return signature
}

export function minhashSimilarity(a: readonly number[], b: readonly number[]): number {
  const n = Math.min(a.length, b.length)
  if (n === 0) return 0
  let same = 0
  for (let i = 0; i < n; i++) if (a[i] === b[i]) same += 1
  return same / n
}

/**
 * Sixty-four bands of two rows. The textbook 16x8 split is tuned for documents
 * that are 80% identical; feedback items that describe the same problem in
 * different words share nearer a tenth of their shingles, and at eight rows per
 * band the probability of ever landing in the same bucket rounds to zero. Two
 * rows keeps recall high and lets the exact comparison that follows do the
 * discriminating, which is what it is for.
 */
const LSH_BANDS = 64
const LSH_ROWS = MINHASH_PERMUTATIONS / LSH_BANDS

/** Band keys for LSH bucketing: two items share a bucket or are never compared. */
export function lshBands(signature: readonly number[]): string[] {
  const keys: string[] = []
  for (let band = 0; band < LSH_BANDS; band++) {
    const slice: number[] = []
    for (let row = 0; row < LSH_ROWS; row++) slice.push(signature[band * LSH_ROWS + row] ?? 0)
    keys.push(`${band}:${fnv1a(slice.join(','))}`)
  }
  return keys
}

// --- sentence handling ------------------------------------------------------

const SENTENCE_SPLIT = /(?<=[.!?])\s+/

export function sentences(input: string): string[] {
  return input
    .split(SENTENCE_SPLIT)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/**
 * A representative excerpt: the first whole sentences that fit the budget, so a
 * quote is verbatim by construction and never a mid-word truncation.
 */
export function excerpt(input: string, maxChars = 220): string {
  const clean = input.replace(CODE_FENCE, ' ').replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  const parts = sentences(clean)
  let out = ''
  for (const part of parts) {
    const next = out ? `${out} ${part}` : part
    if (next.length > maxChars) break
    out = next
  }
  if (out.length === 0) {
    const cut = clean.slice(0, maxChars)
    const lastSpace = cut.lastIndexOf(' ')
    out = (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trim()
    return `${out}…`
  }
  return out
}

/** Title case for generated labels, with small words left lower unless first. */
const SMALL_WORDS = new Set(['a', 'an', 'and', 'at', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'vs'])

export function titleCase(input: string): string {
  const words = input.split(/\s+/).filter(Boolean)
  return words
    .map((word, i) => {
      if (i > 0 && SMALL_WORDS.has(word)) return word
      const head = word.charAt(0).toUpperCase()
      return head + word.slice(1)
    })
    .join(' ')
}

/**
 * Stem to surface form, so a generated label reads as English.
 *
 * The clusterer works on stems because "crashes" and "crashing" have to meet,
 * but a label reading “Craft Menu” instead of “Crafting Menu” looks like a bug
 * to the person reading it. This maps each stem back to the most common word
 * that produced it.
 */
export function surfaceForms(input: string): Map<string, string> {
  const counts = new Map<string, Map<string, number>>()
  for (const raw of normalise(input).split(' ')) {
    if (raw.length < 2 || STOPWORDS.has(raw)) continue
    const key = stem(raw)
    const bucket = counts.get(key) ?? new Map<string, number>()
    bucket.set(raw, (bucket.get(raw) ?? 0) + 1)
    counts.set(key, bucket)
  }
  const out = new Map<string, string>()
  for (const [key, bucket] of counts) {
    let best = key
    let bestCount = -1
    for (const [word, count] of bucket) {
      if (count > bestCount || (count === bestCount && word.length < best.length)) {
        best = word
        bestCount = count
      }
    }
    out.set(key, best)
  }
  return out
}

/** Expands a stemmed unigram or bigram back into readable words. */
export function expandTerm(term: string, forms: ReadonlyMap<string, string>): string {
  return term
    .split(' ')
    .map((part) => forms.get(part) ?? part)
    .join(' ')
}

/** Token overlap between two strings, counted on content words only. */
export function overlapCount(a: string, b: string): number {
  const left = new Set(tokens(a))
  if (left.size === 0) return 0
  let shared = 0
  for (const t of new Set(tokens(b))) if (left.has(t)) shared += 1
  return shared
}

/** Squash an unbounded count onto 0 to 1 with diminishing returns. */
export function saturate(value: number, halfway: number): number {
  if (value <= 0) return 0
  return value / (value + halfway)
}
