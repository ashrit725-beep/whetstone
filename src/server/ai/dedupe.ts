import './guard'
import { UnionFind } from './cluster'
import { FEATURE_POLICY, RATE_LIMITS, SCHEMA_VERSION } from './config'
import { inputHash } from './hash'
import { typeFromText } from './lexicon'
import { callValidated } from './provider'
import { UNTRUSTED_CONTENT_RULE, wrapUntrusted } from './redact'
import { DedupeBatchSchema, DEDUPE_JSON_SCHEMA, type PairVerdict } from './schemas'
import { readArtifact, writeArtifact } from './store'
import {
  buildIdf,
  charNGrams,
  cosine,
  dice,
  excerpt,
  hamming64,
  jaccard,
  lshBands,
  minhash,
  simhash64,
  termFrequency,
  tfidfVector,
  tokens,
  trigrams,
  unigramsAndBigrams,
  wordNGrams,
  type Vector,
} from './text'
import type { AiResult, FeedbackInput } from './types'

/**
 * Feature 5: duplicate feedback detection.
 *
 * Twelve people reporting the same thing should be one inbox row with a reporter
 * count, not twelve rows, and every individual report must stay readable and
 * individually attributed underneath it.
 *
 * Stage one needs no model at all: a signature per item, an LSH bucket, and an
 * exact similarity on the collisions. Above the merge threshold items are linked
 * outright; below the floor they are discarded. Only the ambiguous band between
 * the two is worth a model, and that band is precisely where lexical methods
 * fail, as in “the jump is floaty” against “movement feels disconnected from input”.
 *
 * The bias is deliberate and asymmetric. A false merge hides a real report from
 * a creator and silences a reviewer; a false split costs one extra row. When
 * uncertain, this does not merge.
 */

const FEATURE = 'dedupe' as const

/**
 * Thresholds calibrated against real feedback rather than assumed.
 *
 * On the blended measure below, two near-identical restatements score above
 * 0.9, the same complaint in visibly different words scores in the high
 * fifties, the same complaint told from a different angle scores in the low
 * thirties, and unrelated notes in the same category sit under 0.15. So:
 * merge only at 0.72 and above, discard under 0.34, and let the model decide
 * the wide middle, which is exactly the band where a lexical measure is
 * guessing.
 */
const MERGE_THRESHOLD = 0.72
/**
 * With no adjudicator the band is not merged at all, and the auto-link bar drops
 * a little to recover some of the lost recall. It stays well clear of the
 * paraphrase range: a false merge hides a real report, a false split costs a row.
 */
const MERGE_THRESHOLD_NO_AI = 0.66
const DISCARD_THRESHOLD = 0.34
/** SimHash prefilter: beyond this Hamming distance nothing survives the exact test. */
const MAX_HAMMING = 28
/** Two items whose detected types disagree must clear a higher bar to pair. */
const TYPE_MISMATCH_PENALTY = 0.08

export type DedupeInput = {
  projectId: string
  items: readonly FeedbackInput[]
}

export type DedupeOptions = { signal?: AbortSignal; userId?: string }

export type PairLink = {
  aId: string
  bId: string
  similarity: number
  relation: PairVerdict['relation']
  confidence: PairVerdict['confidence']
  reason: string
  basis: 'similarity' | 'ai'
}

export type DuplicateCluster = {
  id: string
  memberIds: string[]
  reporterCount: number
  canonical: string
  basis: 'similarity' | 'ai'
}

export type DedupeReport = {
  clusters: DuplicateCluster[]
  /** Subset and related pairs: both rows stay visible, linked as “see also”. */
  seeAlso: PairLink[]
  /** Candidates in the ambiguous band that were not merged. */
  undecided: PairLink[]
}

// --- signatures -------------------------------------------------------------

export type Signature = {
  item: FeedbackInput
  trigrams: Set<string>
  wordGrams: Set<string>
  simhash: bigint
  bands: string[]
  /** TF-IDF over the candidate window, so project jargon stays discriminative. */
  vector: Vector
  type: string
}

/**
 * Signatures for a whole window at once, because the TF-IDF term needs an IDF
 * table and an IDF table needs the corpus.
 */
function buildSignatures(items: readonly FeedbackInput[]): Signature[] {
  const documents = items.map((item) => tokens(item.text))
  const idf = buildIdf(documents)
  return items.map((item, index) => {
    const wordGrams = wordNGrams(item.text, 3)
    const shingles = new Set([...wordGrams, ...charNGrams(item.text, 5)])
    return {
      item,
      trigrams: trigrams(item.text),
      wordGrams,
      simhash: simhash64(termFrequency(unigramsAndBigrams(item.text))),
      bands: lshBands(minhash(shingles)),
      vector: tfidfVector(documents[index] ?? [], idf),
      type: typeFromText(item.text) ?? 'unknown',
    }
  })
}

/**
 * The similarity measure: character trigrams, TF-IDF cosine, and word trigrams.
 *
 * Trigrams survive typos, inflection and word order, which short feedback is
 * full of. Cosine catches the pair that shares its vocabulary but not its
 * spelling. Word trigrams are the near-verbatim check, and stay a small term
 * because two people rarely phrase a complaint the same way twice.
 */
export function similarityOf(a: Signature, b: Signature): number {
  const character = dice(a.trigrams, b.trigrams)
  const semantic = cosine(a.vector, b.vector)
  const phrases = jaccard(a.wordGrams, b.wordGrams)
  const blended = 0.45 * character + 0.45 * semantic + 0.1 * phrases
  // A disagreement about type is evidence against a pair, but the detector is
  // a keyword table and wrong often enough that it must not be a hard gate:
  // one item saying "120fps" and another saying "framerate" should still meet.
  const mismatch = a.type !== b.type && a.type !== 'unknown' && b.type !== 'unknown'
  return Number(Math.max(0, blended - (mismatch ? TYPE_MISMATCH_PENALTY : 0)).toFixed(4))
}

/**
 * Candidate pairs. Axis and type gating comes first and removes most false
 * positives on its own: a performance complaint never merges with a balance
 * complaint, whatever the words happen to share.
 */
function candidatePairs(signatures: readonly Signature[]): Array<{ a: Signature; b: Signature; similarity: number }> {
  // The first gate is the one a human authored: the category the reviewer chose
  // in the composer. A performance complaint never meets a balance complaint,
  // whatever vocabulary they happen to share, and no statistical method has to
  // rediscover that.
  const groups = new Map<string, Signature[]>()
  for (const signature of signatures) {
    const gate = `${signature.item.categoryKey}|${signature.item.axisKey ?? ''}`
    const list = groups.get(gate)
    if (list) list.push(signature)
    else groups.set(gate, [signature])
  }

  const seen = new Set<string>()
  const pairs: Array<{ a: Signature; b: Signature; similarity: number }> = []
  for (const group of groups.values()) {
    if (group.length < 2) continue
    for (const [a, b] of pairsWithin(group)) {
      const key = pairKey(a.item.id, b.item.id)
      if (seen.has(key)) continue
      seen.add(key)
      if (hamming64(a.simhash, b.simhash) > MAX_HAMMING) continue
      const similarity = similarityOf(a, b)
      if (similarity < DISCARD_THRESHOLD) continue
      pairs.push({ a, b, similarity })
    }
  }
  pairs.sort((x, y) => y.similarity - x.similarity || (pairKey(x.a.item.id, x.b.item.id) < pairKey(y.a.item.id, y.b.item.id) ? -1 : 1))
  return pairs
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}:${b}` : `${b}:${a}`
}

/**
 * Which pairs inside one category are worth measuring.
 *
 * Below the LSH threshold every pair is compared directly. That is not a
 * shortcut: at the candidate window size the full comparison is a few thousand
 * set intersections, single-digit milliseconds, and it has perfect recall,
 * where locality-sensitive hashing at these similarity levels does not. LSH
 * earns its keep once a single category grows past the point where the
 * quadratic term starts to matter, and only then is it switched on.
 */
const LSH_MIN_GROUP = 80

function pairsWithin(group: readonly Signature[]): Array<[Signature, Signature]> {
  if (group.length <= LSH_MIN_GROUP) {
    const out: Array<[Signature, Signature]> = []
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const a = group[i]
        const b = group[j]
        if (a && b) out.push([a, b])
      }
    }
    return out
  }

  const buckets = new Map<string, Signature[]>()
  for (const signature of group) {
    for (const band of signature.bands) {
      const list = buckets.get(band)
      if (list) list.push(signature)
      else buckets.set(band, [signature])
    }
  }
  const out: Array<[Signature, Signature]> = []
  for (const bucket of buckets.values()) {
    if (bucket.length < 2 || bucket.length > 200) continue
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = bucket[i]
        const b = bucket[j]
        if (a && b && a.item.id !== b.item.id) out.push([a, b])
      }
    }
  }
  return out
}

// --- clustering -------------------------------------------------------------

function buildReport(
  items: readonly FeedbackInput[],
  merges: readonly PairLink[],
  seeAlso: readonly PairLink[],
  undecided: readonly PairLink[],
): DedupeReport {
  const byId = new Map(items.map((item) => [item.id, item]))
  const union = new UnionFind()
  for (const link of merges) union.union(link.aId, link.bId)

  const clusters: DuplicateCluster[] = []
  const merged = new Set(merges.flatMap((link) => [link.aId, link.bId]))
  for (const [root, memberIds] of union.groups([...merged])) {
    if (memberIds.length < 2) continue
    const members = memberIds
      .map((id) => byId.get(id))
      .filter((item): item is FeedbackInput => item !== undefined)
    if (members.length < 2) continue
    const reporters = new Set(members.map((member) => member.reviewerId))
    clusters.push({
      id: root,
      memberIds: [...memberIds].sort(),
      reporterCount: reporters.size,
      canonical: canonicalStatement(members),
      basis: merges.some((link) => link.basis === 'ai' && memberIds.includes(link.aId)) ? 'ai' : 'similarity',
    })
  }
  clusters.sort((a, b) => b.reporterCount - a.reporterCount || (a.id < b.id ? -1 : 1))
  return { clusters, seeAlso: [...seeAlso], undecided: [...undecided] }
}

/**
 * The canonical line for a roll-up: the member most representative of the group,
 * excerpted. Choosing an existing sentence rather than synthesising one means no
 * reviewer's voice is ever attributed to another.
 */
function canonicalStatement(members: readonly FeedbackInput[]): string {
  const grams = members.map((member) => trigrams(member.text))
  let best = members[0]
  let bestScore = -Infinity
  for (let i = 0; i < members.length; i++) {
    const own = grams[i]
    const member = members[i]
    if (!own || !member) continue
    let total = 0
    for (let j = 0; j < members.length; j++) {
      if (i === j) continue
      const other = grams[j]
      if (other) total += dice(own, other)
    }
    const score = total / Math.max(1, members.length - 1)
    if (score > bestScore) {
      bestScore = score
      best = member
    }
  }
  return best ? excerpt(best.text, 120) : ''
}

// --- deterministic path -----------------------------------------------------

/** Stage one alone. Shingling, SimHash, MinHash and an exact trigram measure. */
export function heuristic(input: DedupeInput, threshold = MERGE_THRESHOLD_NO_AI): AiResult<DedupeReport> {
  const startedAt = Date.now()
  const pairs = candidatePairs(buildSignatures(input.items))

  const merges: PairLink[] = []
  const undecided: PairLink[] = []
  for (const pair of pairs) {
    const link: PairLink = {
      aId: pair.a.item.id,
      bId: pair.b.item.id,
      similarity: pair.similarity,
      relation: pair.similarity >= threshold ? 'duplicate' : 'related',
      confidence: pair.similarity >= MERGE_THRESHOLD ? 'high' : 'medium',
      reason: `Text similarity ${pct(pair.similarity)} within the same category.`,
      basis: 'similarity',
    }
    if (pair.similarity >= threshold) merges.push(link)
    else undecided.push(link)
  }

  return {
    data: buildReport(input.items, merges, [], undecided),
    source: 'heuristic',
    ms: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
  }
}

// --- prompt -----------------------------------------------------------------

const SYSTEM = [
  'You decide whether two pieces of feedback are the same report.',
  '',
  'The rule: two items are duplicates if and only if a single fix would satisfy both authors.',
  'Same symptom with a different cause is not a duplicate. Different symptoms with one cause is a duplicate.',
  '',
  'Worked examples:',
  '- “the jump feels floaty” and “movement is disconnected from my input”: duplicate, one input-timing fix.',
  '- “the tutorial drags” and “the tutorial never mentions crafting”: distinct, pacing against coverage.',
  '- “saving failed” and “saving failed and the menu froze afterwards”: subset, the second reports the first plus more.',
  '- “combat is too hard” and “the second boss one-shots me”: related, the second is one instance, not the whole claim.',
  '',
  'If one item is a strict superset of the other, return subset rather than duplicate so the extra content stays visible.',
  '',
  'The cost of a mistake is asymmetric. A false merge hides a real report from the creator and silences a reviewer.',
  'A false split costs one extra row. When you are uncertain, do not merge.',
  '',
  'The canonical statement is neutral and 120 characters at most, and never puts one reviewer’s voice in another’s mouth.',
  '',
  UNTRUSTED_CONTENT_RULE,
].join('\n')

function buildUserTurn(pairs: ReadonlyArray<{ a: Signature; b: Signature; similarity: number }>): string {
  const lines: string[] = []
  for (const [index, pair] of pairs.entries()) {
    lines.push(`Pair ${index + 1}: aId=${pair.a.item.id} bId=${pair.b.item.id} lexicalSimilarity=${pair.similarity}`)
    lines.push(`Category: ${pair.a.item.categoryKey} / ${pair.b.item.categoryKey}`)
    lines.push(wrapUntrusted('reviewer_feedback', pair.a.item.id, pair.a.item.text, 1200))
    lines.push(wrapUntrusted('reviewer_feedback', pair.b.item.id, pair.b.item.text, 1200))
    lines.push('')
  }
  return lines.join('\n')
}

// --- verdict cache ----------------------------------------------------------

/**
 * The highest-value cache in the system. A project with N items has O(N²)
 * possible pairs but each one is adjudicated at most once, ever, and the
 * candidate band cuts the set to near-linear in practice.
 */
function readVerdict(a: string, b: string): PairVerdict | undefined {
  const key = pairKey(a, b)
  const artifact = readArtifact<PairVerdict>({
    feature: FEATURE,
    subjectType: 'pair',
    subjectId: key,
    inputHash: inputHash(SCHEMA_VERSION.dedupe, key),
    schemaVersion: SCHEMA_VERSION.dedupe,
  })
  return artifact?.payload
}

function writeVerdict(verdict: PairVerdict, model?: string, source: 'ai' | 'heuristic' = 'ai'): void {
  const key = pairKey(verdict.aId, verdict.bId)
  writeArtifact(
    {
      feature: FEATURE,
      subjectType: 'pair',
      subjectId: key,
      inputHash: inputHash(SCHEMA_VERSION.dedupe, key),
      schemaVersion: SCHEMA_VERSION.dedupe,
    },
    verdict,
    source,
    model,
  )
}

// --- public entry point -----------------------------------------------------

/**
 * The two-stage detector. Stage one runs unconditionally; stage two adjudicates
 * only the ambiguous band, in batches, and only for pairs never judged before.
 */
export async function generate(input: DedupeInput, options: DedupeOptions = {}): Promise<AiResult<DedupeReport>> {
  const startedAt = Date.now()
  const recent = [...input.items]
    .sort((a, b) => b.createdAt - a.createdAt || (a.id < b.id ? -1 : 1))
    .slice(0, RATE_LIMITS.dedupeCandidateWindow)
  const pairs = candidatePairs(buildSignatures(recent))

  const merges: PairLink[] = []
  const seeAlso: PairLink[] = []
  const undecided: PairLink[] = []
  const toAdjudicate: Array<{ a: Signature; b: Signature; similarity: number }> = []

  for (const pair of pairs) {
    if (pair.similarity >= MERGE_THRESHOLD) {
      merges.push(linkOf(pair, 'duplicate', 'high', `Near-identical wording, ${pct(pair.similarity)} similar.`, 'similarity'))
      continue
    }
    const cached = readVerdict(pair.a.item.id, pair.b.item.id)
    if (cached) {
      applyVerdict(cached, pair.similarity, merges, seeAlso, undecided)
      continue
    }
    toAdjudicate.push(pair)
  }

  let model: string | undefined
  let usedAi = false

  for (let offset = 0; offset < toAdjudicate.length; offset += RATE_LIMITS.dedupeBatchSize) {
    const batch = toAdjudicate.slice(offset, offset + RATE_LIMITS.dedupeBatchSize)
    const outcome = await callValidated(
      {
        feature: FEATURE,
        system: SYSTEM,
        user: buildUserTurn(batch),
        toolName: 'adjudicate_pairs',
        toolDescription: 'Decide, for each supplied pair, whether one fix would satisfy both authors.',
        schema: DEDUPE_JSON_SCHEMA,
        ...(options.signal ? { signal: options.signal } : {}),
      },
      DedupeBatchSchema,
      { projectId: input.projectId, ...(options.userId ? { userId: options.userId } : {}) },
    )

    if (!outcome.ok) {
      // The unadjudicated band simply does not merge. The creator sees a lower
      // reporter count, which is degraded rather than wrong.
      for (const pair of toAdjudicate.slice(offset)) {
        undecided.push(linkOf(pair, 'related', 'low', 'Waiting on a second look.', 'similarity'))
      }
      break
    }

    usedAi = true
    model = outcome.model
    const returned = new Map(outcome.data.verdicts.map((verdict) => [pairKey(verdict.aId, verdict.bId), verdict]))
    for (const pair of batch) {
      const verdict = returned.get(pairKey(pair.a.item.id, pair.b.item.id))
      if (!verdict) {
        undecided.push(linkOf(pair, 'related', 'low', 'No verdict returned for this pair.', 'similarity'))
        continue
      }
      writeVerdict(verdict, outcome.model)
      applyVerdict(verdict, pair.similarity, merges, seeAlso, undecided)
    }
  }

  const report = buildReport(input.items, merges, seeAlso, undecided)
  return {
    data: report,
    source: usedAi ? 'ai' : 'heuristic',
    ...(usedAi && model ? { model } : {}),
    ms: Date.now() - startedAt,
    generatedAt: new Date().toISOString(),
    ...(usedAi ? {} : { degraded: 'no_key' as const }),
  }
}

/** Only a confident duplicate merges. Everything else stays visible as two rows. */
function applyVerdict(
  verdict: PairVerdict,
  similarity: number,
  merges: PairLink[],
  seeAlso: PairLink[],
  undecided: PairLink[],
): void {
  const link: PairLink = {
    aId: verdict.aId,
    bId: verdict.bId,
    similarity,
    relation: verdict.relation,
    confidence: verdict.confidence,
    reason: verdict.reason,
    basis: 'ai',
  }
  if (verdict.relation === 'duplicate' && verdict.confidence !== 'low') merges.push(link)
  else if (verdict.relation === 'subset' || verdict.relation === 'related') seeAlso.push(link)
  else undecided.push(link)
}

function linkOf(
  pair: { a: Signature; b: Signature; similarity: number },
  relation: PairVerdict['relation'],
  confidence: PairVerdict['confidence'],
  reason: string,
  basis: PairLink['basis'],
): PairLink {
  return { aId: pair.a.item.id, bId: pair.b.item.id, similarity: pair.similarity, relation, confidence, reason, basis }
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`
}

/**
 * A creator unmerging a roll-up is also how a bad merge gets corrected, so the
 * verdict is overwritten rather than merely ignored: the pair is never
 * re-adjudicated into the same mistake.
 */
export function recordUnmerge(aId: string, bId: string, reason = 'A creator split this roll-up.'): void {
  writeVerdict({ aId, bId, relation: 'distinct', confidence: 'high', reason: reason.slice(0, 140) }, undefined, 'heuristic')
}

export function dedupeLabel(result: AiResult<DedupeReport>): string {
  return result.source === 'heuristic' ? FEATURE_POLICY.dedupe.heuristicLabel : FEATURE_POLICY.dedupe.aiLabel
}
