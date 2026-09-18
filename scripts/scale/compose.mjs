/**
 * The machinery every generated sentence goes through.
 *
 * Three jobs, kept separate from the word stock so the word stock can stay
 * readable:
 *
 *   render   a tiny template language. `{slot}` fills from a context, `{Slot}`
 *            does the same and capitalises it, `<a|b|>` picks one alternative
 *            (an empty one makes a word optional), and `[is|are]` agrees with
 *            the number of the current subject. A subject written with a
 *            leading `+` is plural.
 *
 *   voice    five thousand people do not share one register. Each person gets
 *            a stable persona from their id: whether they contract, whether
 *            they spell the American way, whether they write numbers as words,
 *            how much they hedge and how much they write. The same reviewer
 *            sounds like themselves on every project.
 *
 *   budget   a ceiling on repetition, enforced while writing rather than
 *            measured afterwards. No sentence may appear more than a handful
 *            of times anywhere, and no five-word run may appear in more than a
 *            small share of any one kind of text. A draw that would break
 *            either is redrawn, so a phrase can never quietly become the
 *            community's catchphrase.
 *
 * Everything is driven by a seeded PRNG that is separate from the one that
 * decides structure (who reviews what, when, how many votes). Rewording a
 * sentence therefore never moves a count or a date.
 */

/* ------------------------------------------------------------ randomness */

export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** FNV-1a, for turning an id into a seed. */
export function hash32(s) {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** Resolve `<a|b>` alternatives once, for text that must read the same everywhere it appears. */
export function settle(R, s) {
  return String(s).replace(/<([^<>]*)>/g, (_, body) => R.pick(body.split('|')))
}

export function makeRandom(seed) {
  const rnd = typeof seed === 'function' ? seed : mulberry32(seed)
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)]
  const chance = (p) => rnd() < p
  const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1))
  /** Several distinct items, in random order. */
  const some = (arr, n) => {
    const copy = arr.slice()
    const out = []
    while (out.length < n && copy.length > 0) out.push(copy.splice(Math.floor(rnd() * copy.length), 1)[0])
    return out
  }
  /** [[weight, value], ...] */
  const weighted = (pairs) => {
    let total = 0
    for (const [w] of pairs) total += w
    let x = rnd() * total
    for (const [w, v] of pairs) {
      x -= w
      if (x < 0) return v
    }
    return pairs[pairs.length - 1][1]
  }
  return { rnd, pick, chance, between, some, weighted }
}

/* -------------------------------------------------------------- language */

const KEEPS_CASE = /^[`'"‘“(]*(iPhone|iPad|iOS|macOS|iMac|eBay|npm|pnpm|git\b|ffmpeg)/
export const cap = (s) => {
  if (KEEPS_CASE.test(s)) return s
  const i = s.search(/[A-Za-z]/)
  if (i === -1) return s
  // A leading code span or quote keeps its own case.
  if (i > 0 && /[`]/.test(s.slice(0, i))) return s
  return s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1)
}

/** `+the footsteps` is plural; anything else is judged from its head noun once rendered (see isPlural). */
export function subject(raw) {
  return raw.startsWith('+') ? { text: raw.slice(1), plural: true } : { text: raw, plural: null }
}

// Where a noun phrase's head ends: a preposition, a pronoun starting a
// relative clause, or a second article. "the letters you find" is headed by
// "letters", "the way the dash combines with..." by "way".
const HEAD_STOP = new Set(['on', 'in', 'of', 'for', 'at', 'when', 'between', 'under', 'across', 'after', 'with', 'from', 'to',
  'that', 'which', 'who', 'you', 'i', 'it', 'we', 'they', 'where', 'during', 'before', 'behind', 'around', 'while', 'if', 'about',
  'into', 'through', 'without', 'near', 'over', 'by', 'as', 'the', 'a', 'an', 'is', 'are', 'was', 'were'])
const SINGULAR_S = /(ss|us|is|os|ics|lens|news|series|species|canvas|atlas|alias|gas|bias|chaos|ethos|Barracks)$/i
const IRREGULAR_PLURAL = /^(feet|teeth|mice|people|children|men|women|radii|data|criteria|media)$/i

/** Is a rendered noun phrase plural? Judged from its head noun. */
export function isPlural(text) {
  const words = String(text).replace(/[`“”"’']/g, '').split(/\s+/).filter(Boolean)
  let i = /^(the|a|an|my|your|this|that|these|those|its|their|our)$/i.test(words[0] ?? '') ? 1 : 0
  if (/^(a|an|this|that|its)$/i.test(words[0] ?? '')) return false
  if (/^(these|those)$/i.test(words[0] ?? '')) return true
  let head = words[i] ?? ''
  for (; i < words.length; i++) {
    const w = words[i].replace(/[,.;:]$/, '')
    if (i > 0 && HEAD_STOP.has(w.toLowerCase()) && head !== '') break
    head = w
  }
  if (IRREGULAR_PLURAL.test(head)) return true
  if (/^[0-9]/.test(head)) return false
  return /[a-z]s$/i.test(head) && !SINGULAR_S.test(head) || /^[A-Z]{2,}s$/.test(head)
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
export function numberWords(n) {
  if (n < 20) return ONES[n]
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 === 0 ? '' : `-${ONES[n % 10]}`)
  return String(n)
}

// Words that start with a vowel letter but not a vowel sound, and the reverse.
const SOUNDS_CONSONANT = /^(one|once|uni|use|usu|usa|usb|url|eu|ewe|ubi|uti|ura|ufo|ux\b|ui\b|us\b)/i
const SOUNDS_VOWEL = /^(hour|honest|heir|honou?r|8|11|18|8\d\b|mp3|sd\b|sdk|seo|html|http|fps|mvp|rss|lcd|led\b|mri|nfc|srgb|xl\b|f1\b|rsvp|sms|svg|s3\b|rp\d|nrf|stm\d|esp\d|x\d)/i
function articleFor(word) {
  const w = word.replace(/^[`'"‘“(]+/, '')
  if (SOUNDS_VOWEL.test(w)) return 'an'
  if (SOUNDS_CONSONANT.test(w)) return 'a'
  return /^[aeiou]/i.test(w) ? 'an' : 'a'
}

/** Whitespace, punctuation spacing, a/an, and sentence capitals. */
export function tidy(s) {
  let t = s
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([,.;:!?)])/g, '$1')
    .replace(/\( +/g, '(')
    .replace(/([,;:]){2,}/g, '$1')
    .replace(/,([.!?])/g, '$1')
    .replace(/([.!?])\.+/g, '$1')
    .replace(/\.\?/g, '?')
    .replace(/ *\n */g, '\n')
    .trim()
  t = t.replace(/(^|[.!?:]\s+|\n|\s)(a|an|A|An) (?=([`'"‘“(]*[\w£$€]+))/g, (m, pre, art, next) => {
    const upper = art[0] === 'A'
    const sentenceStart = pre === '' || /[.!?:\n]\s*$/.test(pre)
    if (upper && !sentenceStart) return m
    const fixed = articleFor(next)
    return `${pre}${upper ? cap(fixed) : fixed} `
  })
  t = t.replace(/(^|[.!?]\s+|\n)([a-z])/g, (m, p, c, at) => (KEEPS_CASE.test(t.slice(at + p.length)) ? m : p + c.toUpperCase()))
  return t
}

/**
 * Fill a template. Slot values may be strings, arrays (one is picked), or
 * functions; a value that itself carries template syntax is rendered too, so
 * a subject like "the music in {spot}" resolves against the same context.
 */
export function makeRenderer(R) {
  const render = (tpl, ctx, depth = 0) => {
    let s = String(tpl)
    s = s.replace(/<([^<>]*)>/g, (_, body) => R.pick(body.split('|')))
    s = s.replace(/\{(\w+)\}/g, (m, name) => {
      const key = name[0].toLowerCase() + name.slice(1)
      let v = ctx[key]
      if (typeof v === 'function') v = v()
      if (Array.isArray(v)) v = R.pick(v)
      if (v === undefined || v === null) throw new Error(`unfilled slot {${name}} in: ${tpl}`)
      v = String(v)
      if (/[{<[]/.test(v) && depth < 5) v = render(v, ctx, depth + 1)
      return name[0] === key[0] ? v : cap(v)
    })
    // [is|are] agrees with the current subject; [is|are:main] with the {main} slot.
    s = s.replace(/\[([^[\]|]*)\|([^[\]:]*)(?::(\w+))?\]/g, (_, one, many, who) => {
      const plural = who === undefined ? ctx.plural : ctx[`${who}Plural`]
      return plural ? many : one
    })
    return s
  }
  return render
}

/* ----------------------------------------------------------------- voice */

const PARTICIPLE = 'been|seen|got|had|used|tried|played|read|watched|done|made|run|heard|looked|changed|never|already|just|spent|found|lost|shipped|built|kept|noticed|asked|said|written|had'
const CONTRACTIONS = [
  [/\b([Dd]o|[Dd]oes|[Dd]id|[Ii]s|[Aa]re|[Ww]as|[Ww]ere|[Ww]ould|[Cc]ould|[Ss]hould|[Hh]as|[Hh]ave|[Hh]ad) not\b/g, (m, v) => `${v}n’t`],
  [/\b([Cc])annot\b/g, (m, c) => `${c}an’t`],
  [/\b([Ww])ill not\b/g, (m, w) => `${w === 'W' ? 'W' : 'w'}on’t`],
  [/\bI am (?=[a-z])/g, () => 'I’m '],
  [/\bI would (?=[a-z])(?!not\b)/g, () => 'I’d '],
  [/\bI will (?=[a-z])(?!not\b)/g, () => 'I’ll '],
  [new RegExp(`\\b(I|[Yy]ou|[Ww]e|[Tt]hey) have (?=(${PARTICIPLE})\\b)`, 'g'), (m, p) => `${p}’ve `],
  [/\b([Yy]ou|[Ww]e|[Tt]hey) are (?=[a-z])/g, (m, p) => `${p}’re `],
  [/(?<!\b(?:as|what|how|where|who|whatever) )\b([Ii]t|[Tt]hat|[Tt]here|[Ww]hat|[Hh]e|[Ss]he|[Ww]here) is (?=[a-z])/g, (m, p) => `${p}’s `],
  [/\b([Ll])et us\b/g, (m, l) => `${l}et’s`],
  [/\b([Ii]t) will (?=[a-z])/g, (m, p) => `${p}’ll `],
]

const AMERICAN = [
  [/colour/g, 'color'], [/Colour/g, 'Color'], [/behaviour/g, 'behavior'], [/favourite/g, 'favorite'],
  [/\b(real|organ|recogn|apolog|optim|minim|priorit|summar|categor|emphas|visual|standard|custom|final|normal|personal|critic|memor|synthes|stabil|util)is(e|ed|es|ing|ation)\b/g, '$1iz$2'],
  [/\banalys(e|ed|es|ing)\b/g, 'analyz$1'],
  [/\bgrey/g, 'gray'], [/\bcentre/g, 'center'], [/\bCentre/g, 'Center'], [/metres\b/g, 'meters'], [/metre\b/g, 'meter'],
  [/labell(ed|ing)/g, 'label$1'], [/travell(ed|ing)/g, 'travel$1'], [/cancell(ed|ing)/g, 'cancel$1'],
  [/model{2}(ing|ed)/g, 'model$1'], [/signall(ed|ing)/g, 'signal$1'], [/\bper cent\b/g, 'percent'],
  [/\bcatalogue/g, 'catalog'], [/\blicence\b/g, 'license'], [/\bdefence\b/g, 'defense'], [/judgement/g, 'judgment'],
  [/\btowards\b/g, 'toward'], [/\bwhilst\b/g, 'while'], [/\bamongst\b/g, 'among'], [/\blearnt\b/g, 'learned'],
  [/\bspelt\b/g, 'spelled'], [/\bfulfil\b/g, 'fulfill'], [/\baluminium\b/g, 'aluminum'], [/\bpyjamas\b/g, 'pajamas'],
  [/\bhonour/g, 'honor'], [/\bneighbour/g, 'neighbor'], [/\bflavour/g, 'flavor'], [/\bharbour/g, 'harbor'],
  [/\bHarbour/g, 'Harbor'], [/\bhumour/g, 'humor'], [/\bplough/g, 'plow'], [/\bmum\b/g, 'mom'],
  [/\bcheque/g, 'check'], [/\btyre/g, 'tire'], [/\bdraught/g, 'draft'], [/\bprogramme\b/g, 'program'],
  [/\bqueue up\b/g, 'line up'], [/\bpostcode/g, 'zip code'], [/\bmobile phone/g, 'cell phone'],
]

/**
 * A stable persona for one person. `contract` is how often they reach for a
 * contraction, `terse` how readily they stop after one sentence, `hedge` how
 * often they qualify, `words` whether they spell out small numbers.
 */
export function makePersona(id, region = null) {
  const r = mulberry32(hash32(`persona:${id}`))
  const roll = r()
  const contract = roll < 0.46 ? 0.75 + r() * 0.25 : roll < 0.62 ? 0.25 + r() * 0.3 : 0
  const americanRegion = region === 'na' || region === 'latam'
  return {
    id,
    contract,
    american: americanRegion ? r() < 0.93 : r() < 0.22,
    words: r() < 0.33,
    terse: r(),
    hedge: r(),
    warmth: r(),
    // Some people number their points, some lead with the verdict, some never
    // sign off. Kept as independent habits rather than one "style".
    signs: r() < 0.38,
    leadsWithVerdict: r() < 0.3,
    currency: region === 'na' || region === 'latam' ? '$' : region === 'uk' ? '£' : region === 'eu' ? '€' : r() < 0.5 ? '$' : '€',
  }
}

/** Apply a persona to finished text. Code spans are left alone. */
export function voice(text, persona, R) {
  if (!persona) return text
  const parts = text.split(/(`[^`]*`)/)
  for (let i = 0; i < parts.length; i += 2) {
    let t = parts[i]
    if (persona.contract > 0) {
      for (const [re, fn] of CONTRACTIONS) {
        t = t.replace(re, (...args) => (R.rnd() < persona.contract ? fn(...args) : args[0]))
      }
    }
    if (persona.american) for (const [re, to] of AMERICAN) t = t.replace(re, to)
    parts[i] = t
  }
  return parts.join('')
}

/** How a persona writes a count of minutes, runs, people. */
export function count(n, persona) {
  if (persona?.words && n < 100) return numberWords(n)
  return String(n)
}

/* ---------------------------------------------------------------- budget */

export const splitSentences = (t) =>
  String(t ?? '')
    .split(/\n+|(?<=[.!?])\s+(?=[A-Z"'‘“(`£$€0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

const sentenceKey = (s) =>
  s.toLowerCase().replace(/[’']/g, '').replace(/n t\b/g, 'nt')
    .replace(/[^a-z0-9£$€ ]+/g, ' ').replace(/\s+/g, ' ').trim()

const wordsOf = (t) => String(t ?? '').toLowerCase().replace(/[’]/g, "'").match(/[a-z0-9']+/g) ?? []

/**
 * One budget per kind of text (points, headlines, posts...), all sharing one
 * sentence ledger, so a sentence cannot turn up four times in notes and four
 * more times in the forum either.
 */
/**
 * Two pieces of a template meeting on the same word: "letting on on a TV", "the
 * error when the export fails fails", "a short short story". Code spans are
 * exempt, because `seal-lint lint` is a command, not a slip.
 */
const REPEATED_WORD = /\b(\w{2,})\s+\1\b/i
export const repeatsAWord = (text) => REPEATED_WORD.test(text.replace(/`[^`]*`/g, ' '))

export class Ledger {
  constructor({ sentenceCap = 4 } = {}) {
    this.sentenceCap = sentenceCap
    this.sentences = new Map()
    this.budgets = new Map()
    this.debug = process.env.DEBUG_TEXT === '1'
  }
  budget(name, expected, share = 0.0042, floor = 4) {
    const b = new Budget(this, name, Math.max(floor, Math.floor(expected * share)))
    this.budgets.set(name, b)
    return b
  }
  report() {
    return [...this.budgets.values()].map((b) => ({
      name: b.name, written: b.written, forced: b.forced, gramCap: b.gramCap,
      blockers: b.blockers ? [...b.blockers.entries()].sort((x, y) => y[1] - x[1]).slice(0, 14) : [],
    }))
  }
}

export class Budget {
  constructor(ledger, name, gramCap) {
    this.ledger = ledger
    this.name = name
    this.gramCap = gramCap
    this.grams = new Map()
    this.written = 0
    this.forced = 0
  }
  fits(text) {
    const cap = this.ledger.sentenceCap
    for (const s of splitSentences(text)) {
      if ((this.ledger.sentences.get(sentenceKey(s)) ?? 0) >= cap) {
        if (this.ledger.debug) this.blocked(`S ${s}`)
        return false
      }
    }
    const w = wordsOf(text)
    for (let i = 0; i + 5 <= w.length; i++) {
      const g = w.slice(i, i + 5).join(' ')
      if ((this.grams.get(g) ?? 0) >= this.gramCap) {
        if (this.ledger.debug) this.blocked(`G ${g}`)
        return false
      }
    }
    return true
  }
  /** With DEBUG_TEXT set, what keeps refusing draws, so the thin spots in the stock are visible. */
  blocked(why) {
    this.blockers ??= new Map()
    this.blockers.set(why, (this.blockers.get(why) ?? 0) + 1)
  }
  commit(text) {
    for (const s of splitSentences(text)) {
      const k = sentenceKey(s)
      this.ledger.sentences.set(k, (this.ledger.sentences.get(k) ?? 0) + 1)
    }
    const w = wordsOf(text)
    const seen = new Set()
    for (let i = 0; i + 5 <= w.length; i++) seen.add(w.slice(i, i + 5).join(' '))
    for (const g of seen) this.grams.set(g, (this.grams.get(g) ?? 0) + 1)
    this.written++
  }
  /** How far over its ceilings a candidate is: 0 when it fits. */
  overage(text) {
    const cap = this.ledger.sentenceCap
    let over = 0
    for (const s of splitSentences(text)) {
      const n = this.ledger.sentences.get(sentenceKey(s)) ?? 0
      if (n >= cap) over += 1 + (n - cap)
    }
    const w = wordsOf(text)
    for (let i = 0; i + 5 <= w.length; i++) {
      const n = this.grams.get(w.slice(i, i + 5).join(' ')) ?? 0
      if (n >= this.gramCap) over += (1 + n - this.gramCap) / this.gramCap
    }
    return over
  }

  /**
   * Draw until something fits. `make(attempt)` is told how many attempts have
   * failed so it can shed optional sentences when the space gets tight. If
   * nothing fits, the draw that breaks the ceilings least is kept and
   * counted, so a thin word stock shows up in the report rather than as an
   * infinite loop or a pile of identical fallbacks. A draw where two pieces
   * meet on the same word is never kept while another attempt is left.
   */
  draw(make, attempts = 40, extra = null) {
    let best = ''
    let bestOver = Infinity
    let last = ''
    for (let i = 0; i < attempts; i++) {
      const t = make(i)
      if (t === null || t === undefined || t === '') continue
      last = t
      if (repeatsAWord(t)) continue
      if (extra !== null && !extra(t)) continue
      if (this.fits(t)) {
        this.commit(t)
        return t
      }
      const over = this.overage(t)
      if (over < bestOver) {
        best = t
        bestOver = over
      }
    }
    this.forced++
    const chosen = best !== '' ? best : last
    if (chosen !== '') this.commit(chosen)
    return chosen
  }
}
