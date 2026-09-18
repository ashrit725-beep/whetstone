/**
 * Everything the population says, written through one object so that one
 * ledger sees all of it.
 *
 * populate.mjs decides structure (who, what, when, how many, which category,
 * what severity) with its own PRNG and asks this for words. The words come
 * from the project's world (types/), the kinds of observation (kinds.mjs), the
 * frames around a review (stock.mjs), and the writer's own persona.
 */

import { makeRandom, makeRenderer, tidy, voice, count, subject, cap, Ledger, makePersona, isPlural, splitSentences, repeatsAWord } from './compose.mjs'
import { KINDS, GENERIC, BUG_FRAMES, MISSING_FRAMES, LEAD_IN, FOLLOW, WHEN } from './kinds.mjs'
import { TYPES } from './types/index.mjs'
import { makeTitle } from './titles.mjs'
import * as S from './stock.mjs'
import * as P from './people.mjs'
import * as D from './discourse.mjs'
import * as M from './market.mjs'

const slugify = (s) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

const BUG_PRAISE = ['^I tried to break {spot} and could not.', '^Nothing broke in {k} {units} of trying, which is worth saying.',
  '^Everything I threw at {spot2} held up.', 'Solid: nothing went wrong {where}.', 'I went looking for problems {where} and found none.',
  'No defects I could find on a {device}, and I looked.', 'Clean, technically: no glitches {where}.', 'I looked for technical problems in {spot} and found none.']
const BUG_NEUTRAL = ['^I could not reproduce the problem others mentioned {where}.', '^Nothing broke for me, though I only tried {k} {units}.',
  '^One odd moment {where}, but I could not make it happen again.', 'Something looked off {where}; could have been my {device}.',
  'No technical problems that I noticed, though I was not looking closely.']
/**
 * A creator names each part of the work once per ask and says "it" after that:
 * "Go through the middle scene on a phone. Say whether the middle scene earns
 * its place." is a slip nobody makes. The parts are the world's named places
 * and features, and any other name of more than one word (a rival, a task, a
 * venue); a single word such as an engine's name can recur without reading as
 * a slip.
 */
const PLACE_SLOTS = new Set(['spot', 'spot2', 'spot3', 'feature', 'feature2', 'feature3'])
function namesAPlaceTwice(text, world) {
  const lower = text.toLowerCase()
  const named = Object.entries(world).some(([slot, value]) => {
    const name = typeof value === 'string' ? value.toLowerCase() : ''
    if (name.length < 4 || !(PLACE_SLOTS.has(slot) || name.includes(' '))) return false
    const first = lower.indexOf(name)
    return first !== -1 && lower.indexOf(name, first + name.length) !== -1
  })
  if (named) return true
  // Two names can overlap ("booking the laser cutter", "the laser cutter
  // queue") and repeat a phrase just the same, so a "the" phrase of three
  // words may appear once.
  const words = lower.split(/[^a-z0-9’'-]+/).filter(Boolean)
  const seen = new Set()
  for (let i = 0; i + 2 < words.length; i++) {
    if (words[i] !== 'the') continue
    const phrase = words.slice(i, i + 3).join(' ')
    if (seen.has(phrase)) return true
    seen.add(phrase)
  }
  return false
}
const MISSING_PRAISE = ['I did not miss {subj}, which surprised me.', 'I assumed I would want {subj}, and never did.',
  'You have resisted adding {subj}, and I think that is right.', 'No need for {subj} as far as I can see.']

export class Writer {
  constructor(seed, expected) {
    this.R = makeRandom(seed)
    this.render = makeRenderer(this.R)
    this.ledger = new Ledger({ sentenceCap: 4 })
    const L = this.ledger
    const e = expected
    this.b = {
      tagline: L.budget('project taglines', e.projects),
      projectSummary: L.budget('project summaries', e.projects),
      ask: L.budget('ask prompts', e.asks),
      need: L.budget('need details', e.needs),
      bio: L.budget('bios', e.bios),
      headline: L.budget('note headlines', e.notes),
      noteSummary: L.budget('note summaries', e.notes),
      point: L.budget('point bodies', e.points),
      reply: L.budget('feedback replies', e.replies),
      changelog: L.budget('changelogs', e.builds),
      suggestion: L.budget('suggestion titles', e.suggestions),
      decline: L.budget('suggestion notes', e.declines ?? 300),
      threadTitle: L.budget('thread titles', e.threads),
      // Seven hundred threads is a small corpus: 0.4 per cent of it is three posts, which would forbid ordinary phrasing.
      threadBody: L.budget('thread bodies', e.threads, 0.01, 6),
      post: L.budget('discussion posts', e.posts),
      // The market is small, so these ceilings are loose: a hundred pitches in
      // twenty areas cannot avoid sharing a phrase or two about screen readers.
      expert: L.budget('expert pitches', e.experts ?? 120, 0.05, 4),
      claim: L.budget('verification claims', e.claims ?? 200, 0.05, 4),
      bounty: L.budget('bounty briefs', e.bounties ?? 260, 0.04, 4),
      application: L.budget('bounty applications', e.applications ?? 700, 0.03, 4),
      creatorReview: L.budget('paid review verdicts', e.creatorReviews ?? 200, 0.04, 4),
    }
    this.titles = new Set()
    this.slugs = new Set()
    this.names = new Set()
    this.personas = new Map()
    this.forcedTitles = 0
    this.fitted = new Map()
  }

  /**
   * A template list as one type may use it. A leading `~` marks a template that
   * only makes sense for software (a slow connection, a back button), and `^`
   * one that needs something you operate (a device you were on, a repro).
   */
  fit(list, T) {
    let byType = this.fitted.get(list)
    if (byType === undefined) {
      byType = new Map()
      this.fitted.set(list, byType)
    }
    let out = byType.get(T.slug)
    if (out === undefined) {
      // `!` survives: whether a line needs an issue to answer depends on the note, not the type.
      out = list
        .filter((t) => !(/^[!#%]*~/.test(t) && !T.digital) && !(/^[!#%]*\^/.test(t) && !T.interactive))
        .map((t) => t.replace(/^([!#%]*)[~^]/, '$1'))
      byType.set(T.slug, out)
    }
    return out
  }

  /** A world value (a screen, a part) mentioned twice in one note reads like a template. */
  repeatsWorld(p, text) {
    for (const key of ['spot', 'spot2', 'spot3', 'feature', 'feature2']) {
      const v = p.ctx[key]
      if (typeof v !== 'string' || v.length < 6) continue
      const first = text.indexOf(v)
      if (first !== -1 && text.indexOf(v, first + v.length) !== -1) return true
    }
    return false
  }

  /* --------------------------------------------------------------- people */

  reserveNames(names) {
    for (const n of names) this.names.add(n.toLowerCase())
  }

  /** A person: name, handle seed, city, role, bio, persona. Display names are unique. */
  person(existingHandles) {
    const R = this.R
    for (let attempt = 0; attempt < 400; attempt++) {
      const culture = R.weighted(P.CULTURES.map((c) => [c.weight, c]))
      const given = R.pick(culture.given)
      const family = R.pick(culture.family)
      const display = `${given} ${family}`
      if (this.names.has(display.toLowerCase())) continue
      const shapeRoll = R.rnd()
      let handle
      if (shapeRoll < 0.1) {
        handle = `${R.pick(P.HANDLE_WORDS_A)}${R.pick(P.HANDLE_WORDS_B)}`
        if (R.chance(0.4)) handle += String(R.between(2, 99))
      } else {
        const shape = R.weighted(P.HANDLE_SHAPES.map(([w, fn]) => [w, fn]))
        handle = shape(given, family.replace(/\s+/g, ''), String(R.between(1, 99)))
      }
      handle = slugify(handle).replace(/-/g, R.chance(0.5) ? '' : '_').slice(0, 24)
      if (handle.length < 3) continue
      if (existingHandles.has(handle)) {
        handle = `${handle}${String(R.between(2, 99))}`
        if (existingHandles.has(handle)) continue
      }
      this.names.add(display.toLowerCase())
      const [city, region] = R.chance(0.76) ? R.pick(culture.cities) : R.pick(P.ALL_CITIES)
      const [role, roleKey] = R.pick(P.ROLES)
      return { given, family, display, handle, city, region, role, roleKey, culture: culture.key }
    }
    throw new Error('ran out of distinct names')
  }

  personaFor(id, region = null) {
    let p = this.personas.get(id)
    if (p === undefined) {
      p = makePersona(id, region)
      this.personas.set(id, p)
    }
    return p
  }

  bio(person, persona) {
    const R = this.R
    const fill = P.BIO_FILL
    const [role2] = R.pick(P.ROLES)
    const ctx = {
      role: person.role, role2, city: person.city, city2: () => R.pick(P.ALL_CITIES)[0],
      k: () => String(R.between(2, 14)), focus: () => R.pick(P.REVIEW_FOCUS),
      types: () => R.pick(P.TYPES_PLURAL), types2: () => R.pick(P.TYPES_PLURAL), device: () => R.pick(P.BIO_DEVICE),
      ...Object.fromEntries(Object.entries(fill).map(([k, v]) => [k, v])),
    }
    return this.b.bio.draw((attempt) => {
      const parts = [this.render(R.pick(S.BIO_LEAD), ctx)]
      const family = P.WORKING_ON[person.roleKey] ?? P.WORKING_ON.other
      if (R.chance(0.78)) parts.push(this.render(R.pick(family), ctx))
      if (attempt < 30 && R.chance(0.45)) parts.push(this.render(R.pick(P.BIO_REVIEW), ctx))
      if (attempt < 30 && R.chance(0.18)) parts.push(this.render(R.pick(P.BIO_PAST), ctx))
      return voice(tidy(parts.join(' ')), persona, R)
    })
  }

  /* ------------------------------------------------------------- projects */

  reserveTitles(titles, slugs) {
    for (const t of titles) this.titles.add(t.toLowerCase())
    for (const s of slugs) this.slugs.add(s)
  }

  uniqueTitle(make) {
    let t = ''
    for (let i = 0; i < 200; i++) {
      t = make()
      const slug = slugify(t)
      // "Marsh Marsh Drawings" is two parts of a name meeting on one word.
      if (slug.length < 2 || repeatsAWord(t) || this.titles.has(t.toLowerCase()) || this.slugs.has(slug)) continue
      this.titles.add(t.toLowerCase())
      this.slugs.add(slug)
      return t
    }
    this.forcedTitles++
    return `${t} ${this.R.between(2, 9)}`
  }

  /**
   * A project: its title, the world everything else is written from, and the
   * text on its card. `owner` carries the persona the creator writes in.
   */
  project(typeSlug, owner, stage) {
    const R = this.R
    const T = TYPES[typeSlug]
    const currency = owner.persona.currency
    let world
    let title
    if (typeSlug === 'api_tool') {
      title = this.uniqueTitle(() => makeTitle(R, typeSlug))
      world = T.world(R, { title })
    } else {
      world = T.world(R, { currency })
      title = this.uniqueTitle(() => makeTitle(R, typeSlug, world))
    }
    const p = { type: typeSlug, T, world, title, currency, owner, stage, askSentences: new Set(),
      headlines: new Set(), summaries: new Set(), points: new Set(), replies: new Set(), changes: new Set(), suggestions: new Set() }
    p.ctx = this.baseCtx(p)
    // Two projects with the same one-line description is the same tell as two with the same name.
    this.taglines ??= new Set()
    p.tagline = this.b.tagline.draw(() => voice(tidy(this.render(R.pick(T.tagline), p.ctx)), owner.persona, R), 40,
      (t) => !this.taglines.has(t.toLowerCase()))
    this.taglines.add(p.tagline.toLowerCase())
    p.summary = this.b.projectSummary.draw((attempt) => {
      const bits = []
      // Most creators write two or three sentences here, not a paragraph.
      if (R.chance(0.5)) bits.push(R.chance(0.5) ? R.pick(T.summary.origin) : R.pick(S.ORIGIN))
      if (R.chance(0.4)) bits.push(R.pick(T.summary.how))
      bits.push(R.chance(0.5) ? R.pick(T.summary.state[stage] ?? T.summary.state.beta) : R.pick(S.STATE[stage] ?? S.STATE.beta))
      if (R.chance(0.5)) bits.push(R.chance(0.45) ? R.pick(T.summary.why) : R.pick(S.WHY))
      // The page prints the tagline right above this, so the summary never
      // restates it and always says at least two things of its own: how it
      // was made or why, and where it stands.
      if (bits.length < 2) bits.unshift(R.chance(0.5) ? R.pick(T.summary.how) : R.pick(T.summary.origin))
      // Short summaries are as common as long ones; a later attempt drops a sentence.
      if (attempt > 12 && bits.length > 2) bits.splice(R.between(0, bits.length - 1), 1)
      const body = bits.map((b) => this.render(b, this.withNumbers(p.ctx, owner.persona))).join(' ')
      return voice(tidy(body), owner.persona, R)
    })
    return p
  }

  baseCtx(p) {
    const R = this.R
    const T = p.T
    let lastDevice = null
    const ctx = {
      ...p.world,
      work: T.work, works: T.works, audience: T.audience, verbed: T.verbed, verb: T.verb, currency: p.currency, title: p.title,
      next: T.next ?? 'build',
      spotPlural: isPlural(p.world.spot ?? ''), spot2Plural: isPlural(p.world.spot2 ?? ''), spot3Plural: isPlural(p.world.spot3 ?? ''),
      featurePlural: isPlural(p.world.feature ?? ''), feature2Plural: isPlural(p.world.feature2 ?? ''), feature3Plural: isPlural(p.world.feature3 ?? ''),
      // A second device is never the one just named: "on a tablet first, then a tablet" is a slip no reviewer makes.
      device: () => (lastDevice = R.pick(T.devices)),
      device2: () => {
        let d = R.pick(T.devices)
        for (let i = 0; i < 8 && d === lastDevice; i++) d = R.pick(T.devices)
        return d
      },
      where: () => this.render(R.pick(T.places), ctx),
      ord: () => R.pick(['second', 'third', 'fourth', 'fifth']),
      year: () => String(R.between(2016, 2025)), month: () => R.pick(S.MONTHS), hobby: () => R.pick(S.HOBBIES),
      when: () => this.render(R.pick(WHEN), ctx), few: () => String(R.between(3, 8)), m: () => String(R.between(5, 45)),
      time: () => R.pick(S.TIME),
      tc: p.world.tc ?? (() => `${R.between(0, 4)}:${String(R.between(0, 59)).padStart(2, '0')}`),
      other: () => this.render(subject(R.pick(T.things).raw).text, ctx),
      price: p.world.price ?? `${R.between(4, 30)}`,
      genre: p.world.genre ?? T.work,
    }
    return ctx
  }

  /** Counts drawn fresh for each piece of text, written the way the persona writes numbers. */
  withNumbers(ctx, persona, extra = {}) {
    const k = this.R.between(2, 5)
    const k2 = k + this.R.between(1, 4)
    return { ...ctx, k: count(k, persona), k2: count(k2, persona), ...extra }
  }

  ask(p) {
    const R = this.R
    const T = p.T
    const persona = p.owner.persona
    const text = this.b.ask.draw((attempt) => {
      const ctx = this.withNumbers(p.ctx, persona, { n: count(R.pick([5, 10, 15, 20, 30]), persona) })
      // Some creators ask one direct question; most set a task and say what to report.
      const fit = (list) => this.fit(list, T)
      const parts = R.chance(0.2)
        ? [R.pick(fit(S.ASK_QUESTION))]
        : [R.chance(0.72) ? R.pick(T.ask.task) : R.pick(fit(S.ASK_TASK)), R.chance(0.68) ? R.pick(T.ask.probe) : R.pick(fit(S.ASK_PROBE))]
      if (attempt < 25 && R.chance(0.22)) parts.push(R.pick(S.ASK_CODA))
      return voice(tidy(parts.map((x) => this.render(x, ctx)).join(' ')), persona, R)
    }, 40, (t) => !namesAPlaceTwice(t, p.world) && !splitSentences(t).some((x) => p.askSentences.has(x)))
    for (const x of splitSentences(text)) p.askSentences.add(x)
    return text
  }

  /** A line of context under a need, or nothing when every fresh way of saying it is used up. */
  needDetail(p, key) {
    const lines = S.NEED_DETAIL[key]
    if (!lines) return null
    const persona = p.owner.persona
    const before = this.b.need.forced
    const text = this.b.need.draw(() => voice(tidy(this.render(this.R.pick(lines), this.withNumbers(p.ctx, persona, {
      n: count(this.R.pick([15, 20, 30, 45]), persona),
    }))), persona, this.R), 20)
    return this.b.need.forced > before ? null : text
  }

  changelog(p) {
    const R = this.R
    const persona = p.owner.persona
    const text = this.b.changelog.draw((attempt) => {
      const n = attempt > 20 ? 1 : R.between(1, 3)
      const lines = []
      for (let i = 0; i < n * 3 && lines.length < n; i++) {
        const l = tidy(this.render(R.pick(R.chance(0.62) ? p.T.changelog : S.CHANGELOG), this.withNumbers(p.ctx, persona)))
        if (!lines.includes(l) && !p.changes.has(l)) lines.push(l)
      }
      return voice(lines.join(' '), persona, R)
    }, 40, (t) => !p.changes.has(t))
    p.changes.add(text)
    return text
  }

  suggestionTitle(p) {
    const R = this.R
    let out = ''
    for (let i = 0; i < 30; i++) {
      out = this.b.suggestion.draw(() => tidy(this.render(R.pick(R.chance(0.72) ? p.T.suggestion : S.SUGGESTION), p.ctx))
        .replace(/\.$/, '').replace(/`/g, ''), 12)
      if (!p.suggestions.has(out)) break
    }
    p.suggestions.add(out)
    return out
  }

  declineNote(p) {
    const persona = p.owner.persona
    return this.b.decline.draw(() => voice(tidy(this.render(this.R.pick(S.DECLINE), this.withNumbers(p.ctx, persona))), persona, this.R))
  }

  /* --------------------------------------------------------------- points */

  /**
   * What a point is about. The category decides it: a point filed under
   * Audio is about something you hear. Delight, Confusion and Friction draw
   * from everything in the project, since any part of it can be those.
   */
  subjectFor(p, label) {
    const R = this.R
    const T = p.T
    let kind
    let raw
    const own = T.cats[label]
    if (own !== undefined && own[1].length > 0) {
      kind = own[0]
      raw = R.pick(own[1])
    } else if (/delight/i.test(label)) {
      const s = R.pick(T.things)
      kind = s.kind
      raw = s.raw
    } else if (/confusion/i.test(label)) {
      kind = 'confusion'
      raw = R.pick(T.things).raw
    } else if (/friction/i.test(label)) {
      kind = 'flow'
      raw = R.pick(T.doing.length > 0 ? T.doing : T.things).raw
    } else {
      const entry = T.cats[label]
      if (entry === undefined || entry[1].length === 0) {
        const s = R.pick(T.things)
        kind = s.kind
        raw = s.raw
      } else {
        kind = entry[0]
        raw = R.pick(entry[1])
      }
    }
    const s = subject(raw)
    const text = this.render(s.text, p.ctx)
    return { kind, plural: s.plural ?? isPlural(text), text }
  }

  /**
   * One point. Tone and severity are decided by the caller; this picks the
   * words, adds the follow-up sentences this reviewer would add, and returns
   * the noun phrase the note summary can refer back to.
   */
  point(p, persona, { tone, severity, label, avoid = null }) {
    const R = this.R
    const T = p.T
    const fit = (list) => this.fit(list, T)
    const strong = severity === 'blocker' || severity === 'major'
    // Two points in one note about the same thing read as one point said twice.
    const fresh = () => {
      let a = this.subjectFor(p, label)
      for (let i = 0; i < 8 && avoid !== null && avoid.has(a.text); i++) a = this.subjectFor(p, label)
      return a
    }
    let about = fresh()
    let noun = about.text
    let tplUsed = null
    // Evidence ("happened three times in twenty minutes") is only something a
    // reviewer can say about a thing that runs.
    const reproducible = T.interactive && ['bug', 'perf', 'flow', 'feel', 'system', 'access', 'confusion', 'power'].includes(about.kind)
    const text = this.b.point.draw((attempt) => {
      if (attempt > 0 && attempt % 8 === 0) about = fresh()
      noun = about.text
      tplUsed = null
      const K = KINDS[about.kind] ?? KINDS.flow
      const ctx = this.withNumbers(p.ctx, persona, {
        subj: about.text, plural: about.plural, bug: about.text,
        bare: about.text.replace(/^(a|an) /, ''),
        alt: () => this.render(R.pick(fit(K.alt)), ctx),
        effect: () => this.render(R.pick(fit(K.effect)), ctx),
        win: () => this.render(R.pick(fit(K.win)), ctx),
        whereTail: () => (R.chance(0.5) ? ` ${this.render(R.pick(T.places), ctx)}` : ''),
        other: () => {
          const same = T.things.filter((x) => x.kind === about.kind)
          for (let i = 0; i < 6; i++) {
            const o = this.render(subject(R.pick(same.length > 2 ? same : T.things).raw).text, p.ctx)
            if (o !== about.text) return o
          }
          return p.ctx.spot2
        },
      })
      const parts = []
      if (about.kind === 'bug') {
        // A short name for the bug, for the summary and the replies to use.
        noun = about.text.length <= 48 ? `the bug where ${about.text}` : `the bug ${this.render(R.pick(T.places), ctx)}`
        const tpl = tone === 'issue' ? R.pick(fit(strong ? BUG_FRAMES.strong : BUG_FRAMES.mild))
          : tone === 'praise' ? R.pick(fit(BUG_PRAISE)) : R.pick(fit(BUG_NEUTRAL))
        if (tone !== 'issue') noun = p.ctx.spot
        parts.push(this.render(tpl, ctx))
        if (tone === 'issue' && reproducible && R.chance(0.35)) parts.push(this.render(R.pick(fit(FOLLOW.evidence)), ctx))
      } else if (about.kind === 'missing') {
        const pool = tone === 'issue' ? (strong && (severity === 'blocker' || R.chance(0.6)) ? MISSING_FRAMES.strong : MISSING_FRAMES.issue)
          : tone === 'praise' ? MISSING_PRAISE : MISSING_FRAMES.neutral
        noun = tone === 'issue' ? `the lack of ${about.text}` : about.text
        parts.push(this.render(R.pick(fit(pool)), { ...ctx, effect: () => this.render(R.pick(fit(KINDS.flow.effect)), ctx) }))
      } else {
        let pool = tone === 'issue' ? (strong && K.strong && R.chance(0.7) ? fit(K.strong) : fit(K.issue)) : fit(K[tone] ?? [])
        if (pool.length === 0 || R.chance(0.22)) pool = fit(GENERIC[tone])
        let tpl = R.pick(pool)
        tplUsed = tpl
        const leads = tpl.startsWith('{Subj}') && R.chance(0.3)
        if (leads) {
          // "On the pricing page, the tagline..." only works for things you meet somewhere in particular.
          const placed = !['pitch', 'money', 'reason', 'tone', 'craft', 'balance'].includes(about.kind)
          const lead = placed ? R.weighted([[4, LEAD_IN.where], [2, LEAD_IN.device], [2, LEAD_IN.when], [3, LEAD_IN.plain]]) : LEAD_IN.plain
          tpl = R.pick(lead) + tpl.replace(/^\{Subj\}/, '{subj}')
        }
        parts.push(`${this.render(tpl, ctx)}.`)
        const chatty = 1 - persona.terse
        if (tone === 'issue') {
          if (R.chance(0.3 + chatty * 0.35)) parts.push(this.render(R.pick(fit(FOLLOW.suggest)), ctx))
          if (R.chance(0.15 + chatty * 0.2)) {
            parts.push(this.render(R.pick(reproducible && R.chance(0.4) ? fit(FOLLOW.evidence) : fit(FOLLOW.effect)), ctx))
          }
        } else if (tone === 'praise') {
          if (R.chance(0.2 + chatty * 0.3)) parts.push(this.render(R.pick(R.chance(0.55) ? fit(FOLLOW.win) : fit(FOLLOW.keep)), ctx))
        } else if (R.chance(0.15 + chatty * 0.3)) {
          parts.push(this.render(R.pick(fit(FOLLOW.observe)), ctx))
        }
      }
      if (R.chance(persona.hedge * 0.3)) parts.push(this.render(R.pick(fit(FOLLOW.hedge)), ctx))
      const kept = attempt > 24 ? parts.slice(0, 1) : parts
      return voice(tidy(kept.join(' ')), persona, R)
    }, 48, (t) => !p.points.has(t) && !this.repeatsWorld(p, t) && !(avoid !== null && tplUsed !== null && avoid.has(`tpl:${tplUsed}`)))
    p.points.add(text)
    avoid?.add(about.text)
    // One note does not use the same sentence shape twice.
    if (tplUsed !== null) avoid?.add(`tpl:${tplUsed}`)
    return { text, noun, tone, severity, kind: about.kind, subj: about.text }
  }

  /* ---------------------------------------------------------------- notes */

  /** Headline and summary for a note whose points are already written. */
  note(p, persona, sentiment, minutes, points) {
    const R = this.R
    const RANK = { blocker: 0, major: 1, minor: 2, nit: 3, praise: 4 }
    const issues = points.filter((x) => x.tone === 'issue').sort((a, b) => (RANK[a.severity] ?? 5) - (RANK[b.severity] ?? 5))
    const praises = points.filter((x) => x.tone === 'praise')
    const main = issues[0]?.noun ?? null
    const praiseFirst = praises[0]?.noun ?? null
    const praise = praiseFirst !== null && praiseFirst === issues[0]?.noun ? praises[1]?.noun ?? null : praiseFirst
    const obs = points.find((x) => x.tone === 'neutral')?.noun ?? null
    const n = count(minutes, persona)
    const ctx = this.withNumbers(p.ctx, persona, {
      n, main: main ?? p.ctx.spot, praise: praise ?? p.ctx.feature, obs: obs ?? p.ctx.spot,
      mainPlural: isPlural(main ?? p.ctx.spot), praisePlural: isPlural(praise ?? p.ctx.feature), obsPlural: isPlural(obs ?? p.ctx.spot),
      alt: () => this.render(R.pick((KINDS[issues[0]?.kind] ?? KINDS.flow).alt), ctx),
    })
    const short = (s) => s !== null && s.length <= 36 && !/`/.test(s)
    const headlineFrames = S.HEADLINE[sentiment] ?? S.HEADLINE.mixed
    const headline = this.b.headline.draw((attempt) => {
      const usable = headlineFrames.filter((f) => (!f.includes('{Main}') && !f.includes('{main}') || short(main))
        && (!f.includes('{Praise}') && !f.includes('{praise}') || short(praise)))
      let h = this.render(R.pick(usable), ctx)
      if (attempt < 20 && R.chance(0.14) && !/[,;]/.test(h)) h += this.render(R.pick(S.HEADLINE_TAIL), ctx)
      return voice(tidy(h).replace(/`/g, '').replace(/\.$/, ''), persona, R)
    }, 40, (t) => !p.headlines.has(t))
    p.headlines.add(headline)

    const summary = this.b.noteSummary.draw((attempt) => {
      const parts = []
      const opener = R.chance(0.12) ? null : this.render(R.pick(R.chance(0.55) ? this.fit(S.SESSION, p.T) : p.T.session), ctx)
      const verdictFirst = persona.leadsWithVerdict && attempt < 10
      const has = (f) => (!/\{[Pp]raise\}/.test(f) || praise) && (!/\{[Mm]ain\}/.test(f) || main)
      let finding
      const frames = S.FINDING[sentiment].filter(has)
      if (frames.length > 0 && (sentiment === 'positive' ? praise || main : main)) finding = R.pick(frames)
      else if (sentiment !== 'positive' && !main) finding = R.pick(S.FINDING.vague[sentiment])
      else if (obs) finding = R.pick(S.FINDING.observe)
      else finding = R.pick(S.FINDING.none)
      if (opener === null) parts.push(finding)
      else if (verdictFirst) parts.push(finding, opener)
      else parts.push(opener, finding)
      const chatty = 1 - persona.terse
      if (attempt < 25 && R.chance(0.25 + chatty * 0.3)) {
        if (sentiment !== 'positive' && praise) parts.push(R.pick(S.SECOND.praiseAfterIssue))
        else if (sentiment === 'positive' && main && !finding.includes('{main}') && !finding.includes('{Main}')) parts.push(R.pick(S.SECOND.issueAfterPraise))
      }
      if (attempt < 25 && persona.signs && R.chance(0.7)) {
        const closes = S.CLOSE[sentiment].filter((f) => !f.includes('{main}') || main)
        parts.push(R.pick(closes))
      }
      return voice(tidy(parts.map((x) => this.render(x, ctx)).join(' ')), persona, R)
    }, 40, (t) => !p.summaries.has(t))
    p.summaries.add(summary)
    return { headline, summary, main, praise, mainKind: issues[0]?.kind ?? null }

  }

  /** A reply on a note. `turn` is 0 for the creator's first word, 1 for the reviewer, 2 for the creator again. */
  reply(p, persona, turn, noteInfo) {
    const R = this.R
    const T = p.T
    const main = noteInfo?.main ?? null
    const praise = noteInfo?.praise ?? null
    // A line that presumes an issue ("did it happen more than once?") needs a note whose main point is one
    // that can happen again; "I can reproduce it" needs a bug.
    const repeatable = ['bug', 'perf', 'flow', 'feel', 'system', 'access', 'confusion', 'power'].includes(noteInfo?.mainKind)
    const ok = (f) => (!/\{[Mm]ain\}/.test(f) || main) && (!/\{[Pp]raise\}/.test(f) || praise)
      && (!f.startsWith('!') || (main && repeatable)) && (!/reproduce/.test(f) || noteInfo?.mainKind === 'bug')
      && (!f.startsWith('#') || noteInfo?.mainKind !== 'missing') && (!f.startsWith('%') || noteInfo?.mainKind !== 'bug')
    const pick = (list) => {
      const usable = this.fit(list, T).filter(ok)
      return (usable.length > 0 ? R.pick(usable) : R.pick(this.fit(list, T).filter((f) => !/^[!#%]/.test(f) && !/\{[Mm]ain\}/.test(f)))).replace(/^[!#%]+/, '')
    }
    return this.b.reply.draw((attempt) => {
      const ctx = this.withNumbers(p.ctx, persona, {
        main: main ?? p.ctx.spot, praise: praise ?? p.ctx.feature,
        mainPlural: isPlural(main ?? p.ctx.spot), praisePlural: isPlural(praise ?? p.ctx.feature),
        alt: () => this.render(R.pick(this.fit((KINDS[noteInfo?.mainKind] ?? KINDS.flow).alt, T)), ctx),
      })
      const parts = []
      if (turn === 0) {
        const shape = R.rnd()
        if (shape < 0.85) parts.push(pick(S.REPLY_ACK))
        if (shape > 0.3 && attempt < 30) parts.push(pick(S.REPLY_PLAN))
      } else if (turn === 1) {
        parts.push(pick(S.REPLY_REVIEWER))
        if (R.chance(0.2) && attempt < 30) parts.push(pick(S.REPLY_REVIEWER_EXTRA))
      } else {
        parts.push(pick(S.REPLY_CREATOR_LAST))
      }
      return voice(tidy(parts.map((x) => this.render(x, ctx)).join(' ')), persona, R)
    }, 40, (t) => !this.repeatsWorld(p, t))
  }

  /* ---------------------------------------------------------- discussions */

  threadCtx(channel, project) {
    return D.threadContext(this.R, channel, project)
  }

  /** Render a forum template with {thing} fixed first, so `[is|are]` agrees with it. */
  renderThread(tpl, ctx) {
    if (!/\{[Tt]hing2?\}/.test(tpl)) return this.render(tpl, ctx)
    const thing = typeof ctx.thing === 'function' ? ctx.thing() : ctx.thing
    let thing2 = typeof ctx.thing2 === 'function' ? ctx.thing2() : ctx.thing2
    for (let i = 0; i < 4 && thing2 === thing; i++) thing2 = ctx.thing2()
    return this.render(tpl, { ...ctx, thing, thing2, plural: isPlural(thing) })
  }

  threadTitle(channel, ctx, seen) {
    const R = this.R
    const t = this.b.threadTitle.draw(() => tidy(this.renderThread(R.pick(D.TITLE[channel] ?? D.TITLE.craft), ctx)).replace(/`/g, ''),
      60, (x) => !seen.has(x))
    return seen.has(t) ? null : t
  }

  threadBody(channel, persona, ctx) {
    const R = this.R
    this.bodies ??= new Set()
    const body = this.b.threadBody.draw((attempt) => {
      const parts = D.threadBody(R, channel, attempt).map((x) => this.renderThread(x, ctx))
      return voice(tidy(parts.join(' ').replace(/ ?\n\n ?/g, '\n\n')), persona, R)
    }, 40, (t) => !this.bodies.has(t))
    this.bodies.add(body)
    return body
  }

  post(channel, persona, threadCtx, seen) {
    const R = this.R
    const text = this.b.post.draw((attempt) => {
      const ctx = { ...threadCtx, k: count(R.between(2, 6), persona), n: count(R.between(3, 40), persona) }
      const parts = D.postParts(R, channel, attempt).map((x) => this.renderThread(x, ctx))
      return voice(tidy(parts.join(' ')), persona, R)
    }, 40, (t) => !splitSentences(t).some((x) => seen.has(x)))
    for (const x of splitSentences(text)) seen.add(x)
    return text
  }

  /* --------------------------------------------------------------- market */

  /** Numbers for market text, in the persona's own habit. */
  marketCtx(persona, extra = {}) {
    const R = this.R
    return { n: () => count(R.between(3, 14), persona), ...extra }
  }

  /** A listed reviewer's headline and pitch. Headlines are unique across the market. */
  /** Headlines already on the market, so a new one never repeats one. */
  reserveHeadlines(headlines) {
    this.expertHeadlines ??= new Set()
    for (const h of headlines) this.expertHeadlines.add(h)
  }

  expertProfile(areaSlug, persona) {
    const R = this.R
    const A = M.AREAS[areaSlug]
    this.expertHeadlines ??= new Set()
    const headline = this.uniqueIn(this.expertHeadlines, () => tidy(this.render(R.pick(A.headline), { kinds: R.pick(A.kinds) })))
    const pitch = this.b.expert.draw((attempt) => {
      // Some lead with how they work, some with what you get back.
      const parts = R.chance(0.35) ? [R.pick(A.deliver), R.pick(A.method)] : [R.pick(A.method), R.pick(A.deliver)]
      if (attempt < 25 && R.chance(0.72)) parts.push(R.pick(A.limit))
      return voice(tidy(parts.join(' ')), persona, R)
    })
    return { headline, pitch }
  }

  /** What was checked before an area was verified, in the reviewer's own words. */
  claim(areaSlug, persona, years) {
    const R = this.R
    const A = M.AREAS[areaSlug]
    return this.b.claim.draw(() => voice(tidy(this.render(R.pick(A.claim), this.marketCtx(persona, {
      years: count(years, persona),
    }))), persona, R))
  }

  /**
   * A bounty's title and brief, written as a pair against the project's own
   * world. Anything drawn fresh on each use, like a timecode, is drawn once,
   * so the title and the brief name the same moment.
   */
  bounty(p, areaSlug) {
    const R = this.R
    const A = M.AREAS[areaSlug]
    p.bounties ??= new Set()
    const persona = p.owner.persona
    const ctx = this.withNumbers(p.ctx, persona)
    for (const [key, value] of Object.entries(ctx)) if (typeof value === 'function') ctx[key] = value()
    // A project asks for each kind of review once, and the market as a whole
    // never lists one title twice: five "Pricing review of the pricing slide"
    // rows on one list read as one listing posted five times.
    this.bountyTitles ??= new Set()
    let pair = R.pick(A.bounty)
    let title = ''
    for (let i = 0; i < 24; i++) {
      title = tidy(this.render(pair[0], ctx)).replace(/\.$/, '').replace(/`/g, '')
      if (!p.bounties.has(pair[0]) && !this.bountyTitles.has(title.toLowerCase())) break
      pair = R.pick(A.bounty)
    }
    p.bounties.add(pair[0])
    this.bountyTitles.add(title.toLowerCase())
    const brief = this.b.bounty.draw((attempt) => {
      const parts = [pair[1]]
      if (attempt < 25 && R.chance(0.45)) parts.push(R.pick(M.BRIEF_CLOSE))
      return voice(tidy(parts.map((x) => this.render(x, ctx)).join(' ')), persona, R)
    })
    return { title, brief }
  }

  /** An applicant's pitch for one bounty. */
  application(p, areaSlug, persona) {
    const R = this.R
    const A = M.AREAS[areaSlug]
    const ctx = { ...p.ctx, weekday: () => R.pick(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']) }
    return this.b.application.draw((attempt) => {
      // What they would do about this project, then sometimes why them, then sometimes when.
      const parts = [R.pick(M.APPLY_FOCUS)]
      if (R.chance(0.5)) parts.unshift(R.pick(A.apply))
      if (attempt < 20 && R.chance(0.35)) parts.push(R.pick(M.APPLY_TIMING))
      return voice(tidy(parts.map((x) => this.render(x, ctx)).join(' ')), persona, R)
    })
  }

  /** What the creator wrote when they accepted the work, matching the rating they gave. */
  creatorReview(p, rating) {
    const R = this.R
    const persona = p.owner.persona
    return this.b.creatorReview.draw(() => voice(tidy(this.render(R.pick(M.CREATOR_REVIEW[rating] ?? M.CREATOR_REVIEW[4]), p.ctx)), persona, R))
  }

  /** A string not yet used in `seen`, or the last draw if none turns up. */
  uniqueIn(seen, make) {
    let out = ''
    for (let i = 0; i < 30; i++) {
      out = make()
      if (!seen.has(out)) break
    }
    seen.add(out)
    return out
  }
}
