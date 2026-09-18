'use client'

/**
 * Placement note: every component in `src/components/discover/` that draws from
 * `@/components/ui` declares `'use client'`. `src/components/ui/grit.tsx` is a
 * client module, so its exported values (`GRIT_STEPS`, `GRIT_NUMERAL_STYLE`)
 * reach a Server Component as client references rather than as data, and
 * `CoverArt` reads `GRIT_STEPS` at render time. Declaring the boundary here
 * means the row looks the same wherever it is rendered from. The data work all
 * happens in the two page files, which import nothing from the barrel; nothing
 * in this directory uses a hook unless its own contract says so.
 */

/**
 * Discover's empty states. Plural, and specific, because "No results found" is
 * not an empty state (§7.1 rule 5, §7.2 pair 5).
 *
 * Four real situations, four different sentences, and every number in them is
 * counted from a real row before the component is rendered:
 *   1. the filters exclude everything, and the widest of them is named
 *   2. the text query matched nothing, and the nearest real tag is offered
 *   3. the Most needed sort has nobody left in its pool
 *   4. nothing has been posted at all
 * Search has its own, per scope, because each scope reads different fields.
 *
 * Keyboard contract: inherited from EmptyState. Tab reaches the primary action,
 * then the secondary. Nothing autofocuses.
 */

import { EmptyState } from '@/components/ui'
import type { SearchScope } from '@/server/repos/search'

export interface LoosenSuggestion {
  /** "the 8000 grit filter" */
  readonly phrase: string
  /** "8000 grit" */
  readonly label: string
  readonly href: string
  readonly wouldShow: number
}

export interface FiltersTooNarrowProps {
  /** The filters that are on, in reading order: "Game + 8000 grit". */
  summary: string
  loosen: LoosenSuggestion | null
  clearAllHref: string
}

export function FiltersTooNarrow({ summary, loosen, clearAllHref }: FiltersTooNarrowProps) {
  if (!loosen) {
    return (
      <EmptyState
        variant="filtered"
        headingLevel={3}
        title={`No projects match ${summary}`}
        body="Each of these filters is empty on its own as well, so loosening one will not help. Clear them and start from the whole feed."
        primaryAction={{ label: 'Clear all filters', href: clearAllHref }}
      />
    )
  }

  return (
    <EmptyState
      variant="filtered"
      headingLevel={3}
      title={`No projects match ${summary}`}
      body={`Dropping ${loosen.phrase} shows ${String(loosen.wouldShow)} ${loosen.wouldShow === 1 ? 'project' : 'projects'}. Every other filter stays where it is.`}
      primaryAction={{ label: `Clear ${loosen.label}`, href: loosen.href }}
      secondaryAction={{ label: 'Clear all filters', href: clearAllHref }}
    />
  )
}

export interface NearestTag {
  readonly slug: string
  readonly label: string
  readonly count: number
}

export interface SearchFoundNothingProps {
  query: string
  nearestTag: NearestTag | null
  tagHref: string | null
  discussionsHref: string
  clearQueryHref: string
}

export function SearchFoundNothing({
  query,
  nearestTag,
  tagHref,
  discussionsHref,
  clearQueryHref,
}: SearchFoundNothingProps) {
  if (nearestTag && tagHref) {
    return (
      <EmptyState
        variant="filtered"
        headingLevel={3}
        title={`No project titles or summaries match “${query}”`}
        body={`The closest tag anyone has used is ${nearestTag.label}, on ${String(nearestTag.count)} ${nearestTag.count === 1 ? 'project' : 'projects'}. Search reads titles, taglines and summaries; it does not read feedback.`}
        primaryAction={{ label: `Browse the ${nearestTag.label} tag`, href: tagHref }}
        secondaryAction={{ label: 'Look in discussions', href: discussionsHref }}
      />
    )
  }

  return (
    <EmptyState
      variant="filtered"
      headingLevel={3}
      title={`No project titles or summaries match “${query}”`}
      body="Search reads titles, taglines and summaries; it does not read feedback or discussion posts. A shorter phrase usually finds more."
      primaryAction={{ label: 'Look in discussions', href: discussionsHref }}
      secondaryAction={{ label: 'Clear the search', href: clearQueryHref }}
    />
  )
}

export interface SearchScopeFoundNothingProps {
  scope: SearchScope
  query: string
  nearestTag: NearestTag | null
  /** Discover narrowed to `nearestTag`. */
  tagHref: string | null
  /** The same query across every scope. */
  everythingHref: string
  /** The search page with the field cleared. */
  clearHref: string
}

/**
 * /search's empty state. Each scope says which fields it read, so "nothing
 * matched" is a statement about those fields and never a claim about the whole
 * site, and each offers the place that lists that kind of thing in full.
 */
export function SearchScopeFoundNothing({
  scope,
  query,
  nearestTag,
  tagHref,
  everythingHref,
  clearHref,
}: SearchScopeFoundNothingProps) {
  const tag =
    nearestTag && tagHref
      ? {
          sentence: ` The closest tag anyone has used is ${nearestTag.label}, on ${String(nearestTag.count)} ${nearestTag.count === 1 ? 'project' : 'projects'}.`,
          action: { label: `Browse the ${nearestTag.label} tag`, href: tagHref },
        }
      : null

  if (scope === 'discussions') {
    return (
      <EmptyState
        variant="filtered"
        headingLevel={3}
        title={`No discussion matches “${query}”`}
        body="Discussion search reads thread titles and opening posts, not the replies under them. The channels list every thread by topic."
        primaryAction={{ label: 'Browse discussions', href: '/c' }}
        secondaryAction={{ label: 'Search everything', href: everythingHref }}
      />
    )
  }

  if (scope === 'experts') {
    return (
      <EmptyState
        variant="filtered"
        headingLevel={3}
        title={`No reviewer’s name or headline matches “${query}”`}
        body="Reviewer search reads names and headlines. The reviewer directory narrows by area of expertise, budget and turnaround instead."
        primaryAction={{ label: 'Browse reviewers', href: '/experts' }}
        secondaryAction={{ label: 'Search everything', href: everythingHref }}
      />
    )
  }

  if (scope === 'projects') {
    return (
      <EmptyState
        variant="filtered"
        headingLevel={3}
        title={`No project titles or summaries match “${query}”`}
        body={`Project search reads titles, taglines and summaries, not feedback.${tag?.sentence ?? ' A shorter phrase usually finds more.'}`}
        primaryAction={tag?.action ?? { label: 'Search everything', href: everythingHref }}
        secondaryAction={tag ? { label: 'Search everything', href: everythingHref } : undefined}
      />
    )
  }

  return (
    <EmptyState
      variant="filtered"
      headingLevel={3}
      title={`Nothing matches “${query}”`}
      body={`Search read project titles, taglines and summaries, discussion titles and opening posts, and reviewer names and headlines.${tag?.sentence ?? ' A shorter phrase usually finds more.'}`}
      primaryAction={tag?.action ?? { label: 'Clear the search', href: clearHref }}
      secondaryAction={tag ? { label: 'Clear the search', href: clearHref } : undefined}
    />
  )
}

export function NothingNeedsEyes({ rankedHref }: { rankedHref: string }) {
  return (
    <EmptyState
      variant="success"
      headingLevel={3}
      title="Every open project has had its first reads"
      body="Most needed lists open projects whose current build has at most one qualified review, and right now none is that short. The ranked feed still weighs every project by how much it needs a read."
      primaryAction={{ label: 'See the ranked feed', href: rankedHref }}
    />
  )
}

export function NothingPostedYet() {
  return (
    <EmptyState
      headingLevel={3}
      title="No projects have been posted yet"
      body="Discover fills up as creators publish. The first project posted has the whole page to itself, and the reviewers here are looking for something to read."
      primaryAction={{ label: 'Post a project', href: '/new' }}
    />
  )
}
