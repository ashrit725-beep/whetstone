/**
 * Discover's filter state is the URL, and this module is the only place that
 * knows how to read or write it (CONTRACT §4.4 surface 2).
 *
 * Everything here is pure and free of both React and the database, so the
 * Server Component that renders the page, the Server Action that loads the next
 * slice, and the client rail that draws the links all agree by construction. A
 * value that does not parse is dropped rather than defaulted to something the
 * reader did not ask for.
 */

import { GRIT_STAGES, NEED_KINDS, PROJECT_TYPES, allProjectTypes } from '@/lib/taxonomy'
import type { DiscoverSort } from '@/server/queries/discover'

export type { DiscoverSort }

export const GRIT_FILTER_VALUES = GRIT_STAGES.map((s) => s.grit) as readonly number[]

export interface SortOption {
  readonly value: DiscoverSort
  readonly label: string
  /** One plain sentence. Rendered under the group, never as a tooltip only. */
  readonly detail: string
  /** How the sort reads inside the result sentence. */
  readonly summary: string
}

export const SORT_OPTIONS: readonly SortOption[] = [
  {
    value: 'ranked',
    label: 'Ranked',
    detail: 'Weighs how badly a project needs eyes against how clear its ask is.',
    summary: 'ranked',
  },
  {
    value: 'newest',
    label: 'Newest',
    detail: 'Most recently published first.',
    summary: 'newest first',
  },
  {
    value: 'needed',
    label: 'Most needed',
    // The pool is FEED.needsEyesMaxReviews and the `needs_eyes` ordering in
    // src/server/repos/projects.ts; this sentence has to say what they do.
    detail: 'Open projects whose current build has at most one qualified review, fewest notes first.',
    summary: 'most needed first',
  },
  {
    value: 'discussed',
    label: 'Most discussed',
    detail: 'Most feedback received so far.',
    summary: 'most discussed first',
  },
  {
    value: 'shipping',
    label: 'Closest to shipping',
    detail: 'Highest grit first, 8000 down to 120.',
    summary: 'closest to shipping first',
  },
]

export const DEFAULT_SORT: DiscoverSort = 'ranked'

export function isDiscoverSort(value: string): value is DiscoverSort {
  return SORT_OPTIONS.some((o) => o.value === value)
}

export function sortOption(value: DiscoverSort): SortOption {
  return SORT_OPTIONS.find((o) => o.value === value) ?? (SORT_OPTIONS[0] as SortOption)
}

/* ------------------------------------------------------------------ state -- */

export interface DiscoverState {
  readonly typeSlug: string | null
  readonly grit: number | null
  readonly needs: readonly string[]
  readonly tags: readonly string[]
  readonly openOnly: boolean
  readonly query: string
  readonly sort: DiscoverSort
}

export const EMPTY_STATE: DiscoverState = {
  typeSlug: null,
  grit: null,
  needs: [],
  tags: [],
  openOnly: false,
  query: '',
  sort: DEFAULT_SORT,
}

export type RawSearchParams = Record<string, string | string[] | undefined>

function firstValue(raw: string | string[] | undefined): string | null {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return raw[0] ?? null
  return null
}

function allValues(raw: string | string[] | undefined): readonly string[] {
  if (typeof raw === 'string') return raw.split(',').filter((v) => v.length > 0)
  if (Array.isArray(raw)) return raw.flatMap((v) => v.split(',')).filter((v) => v.length > 0)
  return []
}

const NEED_KEYS: readonly string[] = NEED_KINDS.map((n) => n.key)

/**
 * The query as it will be printed and searched.
 *
 * Control, format and surrogate code points cannot be typed into the field and
 * have no glyph: a bidi override would reorder the sentence the chip sits in,
 * a lone surrogate cannot be serialised, and a NUL used to reach SQLite's MATCH
 * argument and take the page to its error state (`unterminated string`, since
 * SQLite reads that argument as a C string). Each becomes U+FFFD, the standard
 * stand-in for a character that cannot be shown, so the query stays the thing
 * the reader asked for, the feed reports honestly that nothing matches it, and
 * the server and the browser print the same string.
 *
 * The line breaks and tabs are the exception. They are separators wherever text
 * comes from, so a phrase pasted out of a document searches for its words rather
 * than for a phrase with a black diamond in the middle of it.
 */
export function printableQuery(raw: string): string {
  return raw
    .replace(/[\t\n\v\f\r\u0085\u2028\u2029]+/gu, ' ')
    .replace(/\p{Cc}|\p{Cf}|\p{Cs}/gu, '�')
    .trim()
    .slice(0, 120)
}

/** Reads the URL. Anything unrecognised is dropped, never guessed at. */
export function parseDiscoverParams(raw: RawSearchParams): DiscoverState {
  const typeRaw = firstValue(raw['type'])
  const typeSlug = typeRaw !== null && typeRaw in PROJECT_TYPES ? typeRaw : null

  const gritRaw = firstValue(raw['grit'])
  const gritNum = gritRaw === null ? Number.NaN : Number.parseInt(gritRaw, 10)
  const grit = GRIT_FILTER_VALUES.includes(gritNum) ? gritNum : null

  const needs = allValues(raw['need']).filter((k) => NEED_KEYS.includes(k))
  const tags = allValues(raw['tag']).filter((t) => /^[a-z0-9-]{1,64}$/.test(t))

  const sortRaw = firstValue(raw['sort'])
  const sort = sortRaw !== null && isDiscoverSort(sortRaw) ? sortRaw : DEFAULT_SORT

  const queryRaw = firstValue(raw['q']) ?? ''

  return {
    typeSlug,
    grit,
    needs: [...new Set(needs)],
    tags: [...new Set(tags)],
    openOnly: firstValue(raw['open']) === '1',
    query: printableQuery(queryRaw),
    sort,
  }
}

/** Parses a stored query string, e.g. a saved search. */
export function parseQueryString(queryString: string): DiscoverState {
  const params = new URLSearchParams(queryString)
  const raw: RawSearchParams = {}
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key)
    raw[key] = values.length > 1 ? values : values[0]
  }
  return parseDiscoverParams(raw)
}

/**
 * Writes the URL. Keys always appear in the same order, so two identical filter
 * sets produce one identical string and a saved search compares by equality.
 */
export function toQueryString(state: DiscoverState): string {
  const params = new URLSearchParams()
  if (state.typeSlug) params.set('type', state.typeSlug)
  if (state.grit !== null) params.set('grit', String(state.grit))
  for (const need of [...state.needs].sort()) params.append('need', need)
  for (const tag of [...state.tags].sort()) params.append('tag', tag)
  if (state.openOnly) params.set('open', '1')
  if (state.query.length > 0) params.set('q', state.query)
  if (state.sort !== DEFAULT_SORT) params.set('sort', state.sort)
  return params.toString()
}

export function hrefFor(state: DiscoverState, base = '/discover'): string {
  const qs = toQueryString(state)
  return qs.length > 0 ? `${base}?${qs}` : base
}

/* ------------------------------------------------------------- transforms -- */

export function withType(state: DiscoverState, typeSlug: string | null): DiscoverState {
  return { ...state, typeSlug: state.typeSlug === typeSlug ? null : typeSlug }
}

export function withGrit(state: DiscoverState, grit: number | null): DiscoverState {
  return { ...state, grit: state.grit === grit ? null : grit }
}

export function withNeedToggled(state: DiscoverState, need: string): DiscoverState {
  const on = state.needs.includes(need)
  return { ...state, needs: on ? state.needs.filter((n) => n !== need) : [...state.needs, need] }
}

export function withTagToggled(state: DiscoverState, tag: string): DiscoverState {
  const on = state.tags.includes(tag)
  return { ...state, tags: on ? state.tags.filter((t) => t !== tag) : [...state.tags, tag] }
}

export function withOpenOnly(state: DiscoverState, openOnly: boolean): DiscoverState {
  return { ...state, openOnly }
}

export function withSort(state: DiscoverState, sort: DiscoverSort): DiscoverState {
  return { ...state, sort }
}

export function withQuery(state: DiscoverState, query: string): DiscoverState {
  return { ...state, query: printableQuery(query) }
}

/* ---------------------------------------------------------- active filter -- */

export type ActiveFilterKind = 'type' | 'grit' | 'need' | 'tag' | 'open' | 'query'

export interface ActiveFilter {
  readonly kind: ActiveFilterKind
  /** Unique within one render. */
  readonly id: string
  /** What the chip reads. */
  readonly label: string
  /** How the filter is named in a sentence, e.g. "the Game type filter". */
  readonly phrase: string
  /** The state with just this filter removed. */
  readonly without: DiscoverState
}

function needLabel(key: string): string {
  return NEED_KINDS.find((n) => n.key === key)?.label ?? key
}

function typeLabel(slug: string): string {
  return allProjectTypes().find((t) => t.slug === slug)?.label ?? slug
}

function gritLabelFor(grit: number): string {
  return GRIT_STAGES.find((s) => s.grit === grit)?.label ?? String(grit)
}

/** Every filter currently narrowing the feed, in the order the rail lists them. */
export function activeFilters(state: DiscoverState): readonly ActiveFilter[] {
  const out: ActiveFilter[] = []

  if (state.query.length > 0) {
    out.push({
      kind: 'query',
      id: 'query',
      label: `“${state.query}”`,
      phrase: `the text search for “${state.query}”`,
      without: { ...state, query: '' },
    })
  }
  if (state.typeSlug) {
    out.push({
      kind: 'type',
      id: `type:${state.typeSlug}`,
      label: typeLabel(state.typeSlug),
      phrase: `the ${typeLabel(state.typeSlug)} type filter`,
      without: { ...state, typeSlug: null },
    })
  }
  if (state.grit !== null) {
    const g = state.grit
    out.push({
      kind: 'grit',
      id: `grit:${String(g)}`,
      label: `${String(g)} grit`,
      phrase: `the ${String(g)} grit filter`,
      without: { ...state, grit: null },
    })
  }
  for (const need of state.needs) {
    out.push({
      kind: 'need',
      id: `need:${need}`,
      label: needLabel(need),
      phrase: `the ${needLabel(need)} filter`,
      without: { ...state, needs: state.needs.filter((n) => n !== need) },
    })
  }
  for (const tag of state.tags) {
    out.push({
      kind: 'tag',
      id: `tag:${tag}`,
      label: tag,
      phrase: `the ${tag} tag filter`,
      without: { ...state, tags: state.tags.filter((t) => t !== tag) },
    })
  }
  if (state.openOnly) {
    out.push({
      kind: 'open',
      id: 'open',
      label: 'Open for feedback',
      phrase: 'the open-for-feedback filter',
      without: { ...state, openOnly: false },
    })
  }
  return out
}

export function filterCount(state: DiscoverState): number {
  return activeFilters(state).length
}

/** Everything cleared except the sort, which is a view preference, not a filter. */
export function clearedState(state: DiscoverState): DiscoverState {
  return { ...EMPTY_STATE, sort: state.sort }
}
