/**
 * Discover: the feed, its filters and its search.
 *
 * The one bold element on this surface is the grit filter rail (CONTRACT §1):
 * five cells carrying the real hatch at its real stroke width, each with a live
 * count. Everything else here is hairlines, rows and type.
 *
 * Grammar (§4.4 surface 2): a <ul> of rows, never a card grid. One project per
 * line, read down like a spec sheet. Filters are URL search params parsed in
 * this Server Component, so the view is shareable and Back and Forward mean what
 * they say. The rail is persistent at ≥60rem and a drawer below it.
 */

import type { ReactNode } from 'react'
import type { Metadata } from 'next'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { searchTags } from '@/server/repos/tags'
import {
  asksForProjects,
  countListed,
  facetsFor,
  listSavedSearches,
  loadFeedSlice,
} from '@/server/queries/discover'
import { ActiveFilters } from '@/components/discover/active-filters'
import { DiscoverStyles } from '@/components/discover/discover-styles'
import { FeedList } from '@/components/discover/feed-list'
import { FilterAside } from '@/components/discover/filter-aside'
import { FilterDrawer } from '@/components/discover/filter-drawer'
import { FilterRail } from '@/components/discover/filter-rail'
import { ShortcutHint } from '@/components/discover/shortcut-hint'
import { ShortcutScope } from '@/components/discover/shortcut-scope'
import { SearchForm } from '@/components/discover/search-form'
import {
  FiltersTooNarrow,
  NothingNeedsEyes,
  NothingPostedYet,
  SearchFoundNothing,
} from '@/components/discover/empty-states'
import {
  activeFilters,
  clearedState,
  hrefFor,
  parseDiscoverParams,
  sortOption,
  toQueryString,
  withSort,
  type DiscoverState,
} from '@/components/discover/filters'
import { toProjectFilters } from '@/components/discover/query'
import { toFeedRow } from '@/components/discover/row-data'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Discover',
  description:
    'Projects open for feedback, filtered by grit stage, project type and what the creator is asking for.',
}

const PAGE_SIZE = 20

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function summarise(state: DiscoverState): string {
  return activeFilters(state)
    .map((f) => f.label)
    .join(' + ')
}

/** The tag closest to a free-text query, tried word by word, longest word first. */
function nearestTag(query: string): { slug: string; label: string; count: number } | null {
  const words = query
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ''))
    .filter((w) => w.length >= 3)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)

  for (const word of words) {
    const hit = searchTags(word, 1)[0]
    if (hit && hit.usage_count > 0) {
      return { slug: hit.slug, label: hit.label, count: hit.usage_count }
    }
  }
  return null
}

export default async function DiscoverPage({ searchParams }: { searchParams: SearchParams }) {
  const state = parseDiscoverParams(await searchParams)
  const claims = await currentClaimsLive()
  const viewerId = claims?.uid ?? null

  const filters = toProjectFilters(state)
  const slice = loadFeedSlice(filters, { sort: state.sort, viewerId, offset: 0, limit: PAGE_SIZE })
  const facets = facetsFor(filters, state.sort, viewerId)
  const asks = asksForProjects(slice.items.map((card) => card.id))
  const rows = slice.items.map((card) => toFeedRow(card, asks.get(card.id), state))
  const saved = viewerId ? listSavedSearches(viewerId) : []

  const applied = activeFilters(state)
  const queryString = toQueryString(state)
  const clearAllHref = hrefFor(clearedState(state))

  /* The count is every matching project, counted from the rows. The ranked
     feed composes a bounded window and says so; every other sort lists them
     all, which is where the capped sentence sends people. */
  const one = slice.total === 1
  const noun = one ? 'project' : 'projects'
  const counted =
    slice.total === 0
      ? applied.length > 0
        ? `No projects match ${summarise(state)}.`
        : state.sort === 'needed'
          ? 'No open project is short of a qualified review right now.'
          : 'No projects to list yet.'
      : applied.length > 0
        ? `${slice.total.toLocaleString('en')} ${noun} ${one ? 'matches' : 'match'} ${summarise(state)}, ${sortOption(state.sort).summary}.`
        : `${slice.total.toLocaleString('en')} ${noun}, ${sortOption(state.sort).summary}.`
  const resultSentence =
    slice.listed < slice.total
      ? `${counted} The top ${slice.listed.toLocaleString('en')} are listed here.`
      : counted

  /* Empty-state probes run only when there is nothing to show, and every number
     they produce is counted from real rows (§7.1.6). */
  let empty: ReactNode = null
  if (rows.length === 0) {
    if (facets.total === 0) {
      empty = <NothingPostedYet />
    } else {
      const probes = applied.map((filter) => ({
        filter,
        wouldShow: countListed(toProjectFilters(filter.without), state.sort, viewerId),
      }))
      const best = probes.filter((p) => p.wouldShow > 0).sort((a, b) => b.wouldShow - a.wouldShow)[0]

      if (state.query.length > 0 && (!best || best.filter.kind === 'query')) {
        const tag = nearestTag(state.query)
        empty = (
          <SearchFoundNothing
            query={state.query}
            nearestTag={tag}
            tagHref={tag ? hrefFor({ ...clearedState(state), tags: [tag.slug] }) : null}
            discussionsHref={`/search?q=${encodeURIComponent(state.query)}&in=discussions`}
            clearQueryHref={hrefFor({ ...state, query: '' })}
          />
        )
      } else if (applied.length > 0) {
        empty = (
          <FiltersTooNarrow
            summary={summarise(state)}
            loosen={
              best
                ? {
                    phrase: best.filter.phrase,
                    label: best.filter.label,
                    href: hrefFor(best.filter.without),
                    wouldShow: best.wouldShow,
                  }
                : null
            }
            clearAllHref={clearAllHref}
          />
        )
      } else if (state.sort === 'needed') {
        empty = <NothingNeedsEyes rankedHref={hrefFor(withSort(state, 'ranked'))} />
      } else {
        empty = <NothingPostedYet />
      }
    }
  }

  return (
    <ShortcutScope>
      <DiscoverStyles />

      <div className="pad-inline mx-auto w-full max-w-detail py-xl">
        <header className="mb-xl flex flex-col gap-xs">
          <h1>Projects open for feedback</h1>
          <p className="measure-ui text-base text-text-2">
            Every project here is asking for something specific. Pick the stage you are useful at,
            read the ask, and answer that.
          </p>
        </header>

        <div className="ws-shell">
          {/* Above 60rem the rail is its own scroll region (see `.ws-aside` in
              discover-styles), so it needs a tab stop to be scrollable from the
              keyboard and a cue while it runs past the fold. The name comes
              from the heading below, which the complementary landmark already
              points at. */}
          <FilterAside labelledBy="discover-filters-heading">
            <h2 id="discover-filters-heading" className="sr-only">
              Filters
            </h2>
            <FilterRail
              state={state}
              facets={facets}
              savedSearches={saved}
              signedIn={viewerId !== null}
              idPrefix="rail"
            />
          </FilterAside>

          <section aria-labelledby="discover-results-heading" className="track-safe">
            <h2 id="discover-results-heading" className="sr-only">
              Projects
            </h2>

            <div className="mb-md">
              <SearchForm state={state} />
            </div>

            <div className="ws-filterbar">
              <div className="ws-summary-line">
                <p role="status" aria-live="polite" className="measure-ui text-sm text-text-2">
                  {resultSentence}
                </p>
                <div className="md:hidden">
                  <FilterDrawer
                    state={state}
                    facets={facets}
                    savedSearches={saved}
                    signedIn={viewerId !== null}
                    activeCount={applied.length}
                  />
                </div>
              </div>
              {applied.length > 0 ? (
                <div className="mt-xs">
                  <ActiveFilters state={state} />
                </div>
              ) : null}
            </div>

            {rows.length > 0 ? (
              <>
                <ShortcutHint />
                <FeedList
                  key={queryString}
                  rows={rows}
                  total={slice.total}
                  listed={slice.listed}
                  clock={slice.clock}
                  nextOffset={slice.nextOffset}
                  queryString={queryString}
                  pageSize={PAGE_SIZE}
                  everyRowHref={hrefFor(withSort(state, 'newest'))}
                />
              </>
            ) : (
              <div className="mt-lg">{empty}</div>
            )}
          </section>
        </div>
      </div>
    </ShortcutScope>
  )
}
