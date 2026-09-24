/**
 * Search across projects, discussions and reviewers.
 *
 * The same rows as Discover, in three registers, scoped by a link group rather
 * than by client state, so every result set is a shareable address. There is no
 * card grid here either: search is a longer feed, not a different product.
 *
 * Everything is a digest: the ten closest projects, five discussions and three
 * reviewers, each list linking to its own scope. A scope lists twenty at a time
 * and pages with a cursor in the address, the way the reviewer directory does.
 * Projects and reviewers carry an exact count, each from the predicate its list
 * uses. Projects also get a way into Discover, which counts, filters and pages
 * the same matches.
 *
 * The three register headings are h2 for structure but take the h4 type step
 * (`.ws-register-heading`): at the global h2 size they were the largest thing on
 * a page whose subject is the results underneath them.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { countProjects } from '@/server/repos/projects'
import { countExperts } from '@/server/repos/profiles'
import { search, type SearchScope } from '@/server/repos/search'
import { searchTags, trendingTags } from '@/server/repos/tags'
import { asksForProjects } from '@/server/queries/discover'
import { DiscoverStyles } from '@/components/discover/discover-styles'
import { FeedRowItem } from '@/components/discover/feed-row'
import { DiscussionRow, ExpertRow } from '@/components/discover/search-rows'
import { SearchForm } from '@/components/discover/search-form'
import { ScopeTabs } from '@/components/discover/scope-tabs'
import { ShortcutScope } from '@/components/discover/shortcut-scope'
import { SearchScopeFoundNothing } from '@/components/discover/empty-states'
import { EMPTY_STATE, printableQuery } from '@/components/discover/filters'
import { toFeedRow } from '@/components/discover/row-data'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search Whetstone projects, discussions and reviewers.',
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

/** Each scope names the field for what it actually reads. */
const SCOPES = [
  {
    value: 'all',
    label: 'Everything',
    field: 'Search Whetstone',
    hint: 'Projects, discussions and reviewers.',
  },
  {
    value: 'projects',
    label: 'Projects',
    field: 'Search projects',
    hint: 'Matches titles, taglines and summaries.',
  },
  {
    value: 'discussions',
    label: 'Discussions',
    field: 'Search discussions',
    hint: 'Matches thread titles and opening posts.',
  },
  {
    value: 'experts',
    label: 'Reviewers',
    field: 'Search reviewers',
    hint: 'Matches names, handles, headlines and verified areas.',
  },
] as const satisfies readonly { value: SearchScope; label: string; field: string; hint: string }[]

/** Rows per page within one scope. */
const PAGE_SIZE = 20
/** Projects shown under Everything, beside five discussions and three reviewers. */
const DIGEST_PROJECTS = 10

interface ListLink {
  readonly href: string
  readonly label: string
  /** A link into Discover opts out of prefetch, as every Discover link does. */
  readonly prefetch?: false
}

/** The links under one list: its next page, its wider view, the way back. */
function ListLinks({ links }: { links: readonly ListLink[] }) {
  if (links.length === 0) return null
  return (
    <div className="mt-sm flex flex-wrap gap-x-lg">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          prefetch={link.prefetch}
          className="inline-flex min-h-11 items-center text-sm text-accent underline"
        >
          {link.label}
        </Link>
      ))}
    </div>
  )
}

function first(raw: string | string[] | undefined): string {
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return raw[0] ?? ''
  return ''
}

function nearestTag(query: string): { slug: string; label: string; count: number } | null {
  const words = query
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}-]/gu, ''))
    .filter((w) => w.length >= 3)
    .sort((a, b) => b.length - a.length)
    .slice(0, 3)
  for (const word of words) {
    const hit = searchTags(word, 1)[0]
    if (hit && hit.usage_count > 0) return { slug: hit.slug, label: hit.label, count: hit.usage_count }
  }
  return null
}

function counted(n: number, one: string, many: string): string {
  return `${n.toLocaleString('en')} ${n === 1 ? one : many}`
}

export default async function SearchPage({ searchParams }: { searchParams: SearchParams }) {
  const raw = await searchParams
  // Same reading as Discover's, so one address searched from either surface
  // prints and matches the same string.
  const query = printableQuery(first(raw['q']))
  const scopeRaw = first(raw['in'])
  const scopeDef = SCOPES.find((s) => s.value === scopeRaw) ?? SCOPES[0]
  const scope: SearchScope = scopeDef.value
  // Only a single scope pages: Everything is a digest of three lists.
  const cursor = scope === 'all' ? undefined : first(raw['cursor']) || undefined
  const continued = cursor !== undefined

  const claims = await currentClaimsLive()
  const viewerId = claims?.uid ?? null

  const searching = query.length > 0
  const results = searching
    ? search(query, { scope, viewerId, limit: scope === 'all' ? DIGEST_PROJECTS : PAGE_SIZE, cursor })
    : null
  // The same number Discover announces for these words: one predicate, one count.
  const projectTotal =
    searching && (scope === 'all' || scope === 'projects') ? countProjects({ query }, { viewerId }) : 0
  // And the number the reviewer list pages through, from the WHERE clause it shares.
  const expertTotal = searching && (scope === 'all' || scope === 'experts') ? countExperts({ query }) : 0

  const projectCards = results?.projects.items.map((hit) => hit.project) ?? []
  const asks = asksForProjects(projectCards.map((c) => c.id))
  const projectRows = projectCards.map((card) =>
    toFeedRow(card, asks.get(card.id), { ...EMPTY_STATE, query }),
  )
  const threads = results?.discussions.items ?? []
  const experts = results?.experts.items ?? []
  const found = projectRows.length + threads.length + experts.length
  const next = {
    projects: results?.projects.hasMore ? results.projects.nextCursor : null,
    discussions: results?.discussions.hasMore ? results.discussions.nextCursor : null,
    experts: results?.experts.hasMore ? results.experts.nextCursor : null,
  }
  const closestTag =
    searching && found === 0 && (scope === 'all' || scope === 'projects') ? nearestTag(query) : null

  const hrefFor = (value: SearchScope, after?: string | null): string => {
    const params = new URLSearchParams({ q: query })
    if (value !== 'all') params.set('in', value)
    if (after) params.set('cursor', after)
    return `/search?${params.toString()}`
  }
  const quoted = `“${query}”`

  /* Under Everything a list links to its own scope; within a scope it links
     to its next page and, past the first, back to the start. */
  const backToFirst: readonly ListLink[] = continued
    ? [{ href: hrefFor(scope), label: 'Back to the first page' }]
    : []
  const linksFor = (kind: Exclude<SearchScope, 'all'>, more: string): readonly ListLink[] => {
    const after = next[kind]
    if (scope === 'all') return after ? [{ href: hrefFor(kind), label: more }] : []
    return [...(after ? [{ href: hrefFor(kind, after), label: more }] : []), ...backToFirst]
  }
  const projectLinks: readonly ListLink[] =
    scope === 'all'
      ? linksFor('projects', `All ${counted(projectTotal, 'project', 'projects')} matching ${quoted}`)
      : [
          ...(next.projects
            ? [{ href: hrefFor('projects', next.projects), label: `More projects matching ${quoted}` }]
            : []),
          {
            href: `/discover?q=${encodeURIComponent(query)}`,
            label: 'Filter these on Discover',
            prefetch: false,
          },
          ...backToFirst,
        ]

  let resultSentence: string
  if (!searching) {
    resultSentence =
      'Type something to search. Search reads project titles, taglines and summaries, discussion titles and opening posts, and reviewer names, headlines and verified areas.'
  } else if (found === 0) {
    resultSentence = continued ? `No more matches for ${quoted} past this point.` : `Nothing matches ${quoted}.`
  } else if (scope === 'projects') {
    resultSentence = `${counted(projectTotal, 'project matches', 'projects match')} ${quoted}, closest match first.`
  } else if (scope === 'discussions') {
    resultSentence =
      continued || next.discussions
        ? `${continued ? 'More discussions' : 'Discussions'} matching ${quoted}, most active first.`
        : `${counted(threads.length, 'discussion matches', 'discussions match')} ${quoted}.`
  } else if (scope === 'experts') {
    resultSentence = `${counted(expertTotal, 'reviewer matches', 'reviewers match')} ${quoted}, highest rated first.`
  } else {
    resultSentence =
      next.projects || next.discussions || next.experts
        ? `The first ${found.toLocaleString('en')} matches for ${quoted}. Narrow the scope to see more of one kind.`
        : `${counted(found, 'result', 'results')} for ${quoted}.`
  }

  return (
    <ShortcutScope>
      <DiscoverStyles />

      <div className="pad-inline mx-auto w-full max-w-detail py-xl">
        <header className="mb-lg flex flex-col gap-xs">
          <h1>Search</h1>
          <p className="measure-ui text-base text-text-2">
            Projects, discussions and the people who review them. Press the slash key to come back
            to the field.
          </p>
        </header>

        <div className="mb-md">
          <SearchForm
            state={{ ...EMPTY_STATE, query }}
            action="/search"
            label={scopeDef.field}
            hint={scopeDef.hint}
            hidden={scope === 'all' ? {} : { in: scope }}
          />
        </div>

        <ScopeTabs
          current={scope}
          options={SCOPES.map((option) => ({
            value: option.value,
            label: option.label,
            // No counts on these. Discussions cannot be counted exactly, and a
            // tab reading "Projects 0" while scoped to discussions (which never
            // searched projects at all) was a number that was not true.
            href: hrefFor(option.value),
          }))}
        />

        <p role="status" aria-live="polite" className="measure-ui mt-sm text-sm text-text-2">
          {resultSentence}
        </p>

        {!searching ? (
          <section aria-labelledby="search-trending" className="mt-xl">
            <h2 id="search-trending" className="ws-register-heading">
              Tags people are using
            </h2>
            <p className="measure-ui mt-2xs text-sm text-text-3">
              Every count below is the number of projects carrying that tag right now.
            </p>
            <ul className="ws-active-filters mt-md">
              {trendingTags(12).map((tag) => (
                <li key={tag.slug}>
                  <Link href={`/discover?tag=${tag.slug}`} prefetch={false} className="ws-clear">
                    <span>{tag.label}</span>
                    <span className="tnum text-text-3">{tag.usageCount.toLocaleString('en')}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : found === 0 ? (
          continued ? (
            <ListLinks links={backToFirst} />
          ) : (
            <div className="mt-lg">
              <SearchScopeFoundNothing
                scope={scope}
                query={query}
                nearestTag={closestTag}
                tagHref={closestTag ? `/discover?tag=${closestTag.slug}` : null}
                everythingHref={hrefFor('all')}
                clearHref="/search"
              />
            </div>
          )
        ) : (
          <div className="mt-lg flex flex-col gap-xl">
            {projectRows.length > 0 ? (
              <section aria-labelledby="search-projects">
                <h2 id="search-projects" className="ws-register-heading mb-sm">
                  Projects
                </h2>
                <ul className="ws-feed">
                  {projectRows.map((row) => (
                    <FeedRowItem key={row.id} row={row} />
                  ))}
                </ul>
                <ListLinks links={projectLinks} />
              </section>
            ) : null}

            {threads.length > 0 ? (
              <section aria-labelledby="search-discussions">
                <h2 id="search-discussions" className="ws-register-heading mb-sm">
                  Discussions
                </h2>
                <ul className="ws-feed ws-feed-flat">
                  {threads.map((thread) => (
                    <DiscussionRow key={thread.id} thread={thread} />
                  ))}
                </ul>
                <ListLinks links={linksFor('discussions', `More discussions matching ${quoted}`)} />
              </section>
            ) : null}

            {experts.length > 0 ? (
              <section aria-labelledby="search-experts">
                <h2 id="search-experts" className="ws-register-heading mb-sm">
                  Reviewers
                </h2>
                <ul className="ws-feed">
                  {experts.map((expert) => (
                    <ExpertRow key={expert.user.id} expert={expert} />
                  ))}
                </ul>
                <ListLinks
                  links={linksFor(
                    'experts',
                    scope === 'all'
                      ? `All ${counted(expertTotal, 'reviewer', 'reviewers')} matching ${quoted}`
                      : `More reviewers matching ${quoted}`,
                  )}
                />
              </section>
            ) : null}

          </div>
        )}
      </div>
    </ShortcutScope>
  )
}
