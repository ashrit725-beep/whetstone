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
 * The Discover filter rail: persistent at ≥60rem, the body of the drawer below
 * it (§4.4 surface 2). One component, one DOM shape, two placements, so the two
 * can never drift apart.
 *
 * Every control is a link, because every filter is a URL search param read in a
 * Server Component: the page is shareable, Back and Forward mean what they say,
 * and the whole rail works with JavaScript off. The one exception is an option
 * whose count is zero: it is printed, in text-3, but it is not a link, because
 * following it could not bring a single project into view.
 *
 * Keyboard contract: links in document order, Tab and Enter. Selection is
 * carried by `aria-current="true"`, the ink stepping to text-1 and a Check glyph
 * in a permanently reserved slot, never by a fill and never by hue alone.
 */

import Link from 'next/link'
import { Check } from 'lucide-react'
import { allProjectTypes, NEED_KINDS } from '@/lib/taxonomy'
import type { FacetCounts } from '@/lib/types'
import { GritFilterRail } from './grit-filter-rail'
import { SavedSearches, type SavedSearchItem } from './saved-searches'
import {
  SORT_OPTIONS,
  hrefFor,
  toQueryString,
  withNeedToggled,
  withOpenOnly,
  withSort,
  withType,
  type DiscoverState,
} from './filters'

function countsByKey(list: FacetCounts['stages']): Record<string, number> {
  const out: Record<string, number> = {}
  for (const f of list) out[f.key] = f.count
  return out
}

interface OptionLinkProps {
  href: string
  selected: boolean
  label: string
  count?: number
  /** Completes the accessible name, e.g. "4 projects". */
  detail?: string
  onNavigate?: () => void
}

function OptionLink({ href, selected, label, count, detail, onNavigate }: OptionLinkProps) {
  // A zero is still printed, because the rail's counts are the shape of the
  // feed, but it is not offered as a destination. Every count is taken against
  // the other filters, so following a zero would empty the page, or, for a need
  // beside one already ticked, add a chip that changes nothing.
  if (count === 0 && !selected) {
    return (
      <li>
        <span className="ws-option" data-empty="true">
          <span aria-hidden="true" />
          <span className="min-w-0">{label}</span>
          <span className="tnum text-xs">0</span>
          <span className="sr-only">, no projects</span>
        </span>
      </li>
    )
  }

  return (
    <li>
      <Link
        href={href}
        prefetch={false}
        aria-current={selected ? 'true' : undefined}
        onClick={onNavigate}
        className="ws-option"
      >
        <span aria-hidden="true">{selected ? <Check size={16} strokeWidth={1.5} /> : null}</span>
        <span className="min-w-0">{label}</span>
        {typeof count === 'number' ? (
          <span className="tnum text-xs text-text-3">{count.toLocaleString('en')}</span>
        ) : (
          <span />
        )}
        {detail ? <span className="sr-only">, {detail}</span> : null}
      </Link>
    </li>
  )
}

export interface FilterRailProps {
  state: DiscoverState
  facets: FacetCounts
  savedSearches: readonly SavedSearchItem[]
  signedIn: boolean
  /** Distinguishes the persistent rail's ids from the drawer's. */
  idPrefix: string
  /** The drawer passes a close handler; the persistent rail passes nothing. */
  onNavigate?: () => void
}

export function FilterRail({
  state,
  facets,
  savedSearches,
  signedIn,
  idPrefix,
  onNavigate,
}: FilterRailProps) {
  const stageCounts = countsByKey(facets.stages)
  const typeCounts = countsByKey(facets.types)
  const needCounts = countsByKey(facets.needs)
  const sortDetail = SORT_OPTIONS.find((o) => o.value === state.sort)?.detail ?? ''

  return (
    <div className="flex flex-col gap-xl">
      <nav aria-label="Filters" className="flex flex-col gap-xl">
        <div className="ws-rail-group">
          <h3 id={`${idPrefix}-sort`} className="ws-rail-heading">
            Sort
          </h3>
          <ul className="ws-option-list" aria-labelledby={`${idPrefix}-sort`}>
            {SORT_OPTIONS.map((option) => (
              <OptionLink
                key={option.value}
                href={hrefFor(withSort(state, option.value))}
                selected={state.sort === option.value}
                label={option.label}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
          <p className="measure-ui text-xs text-text-3">{sortDetail}</p>
        </div>

        <GritFilterRail
          state={state}
          counts={stageCounts}
          headingId={`${idPrefix}-grit`}
          onNavigate={onNavigate}
        />

        <div className="ws-rail-group">
          <h3 id={`${idPrefix}-type`} className="ws-rail-heading">
            Project type
          </h3>
          <ul className="ws-option-list" aria-labelledby={`${idPrefix}-type`}>
            {allProjectTypes().map((type) => {
              const count = typeCounts[type.slug] ?? 0
              return (
                <OptionLink
                  key={type.slug}
                  href={hrefFor(withType(state, type.slug))}
                  selected={state.typeSlug === type.slug}
                  label={type.label}
                  count={count}
                  detail={count === 1 ? '1 project' : `${String(count)} projects`}
                  onNavigate={onNavigate}
                />
              )
            })}
          </ul>
        </div>

        <div className="ws-rail-group">
          <h3 id={`${idPrefix}-needs`} className="ws-rail-heading">
            What they want
          </h3>
          <ul className="ws-option-list" aria-labelledby={`${idPrefix}-needs`}>
            {NEED_KINDS.map((need) => {
              const count = needCounts[need.key] ?? 0
              return (
                <OptionLink
                  key={need.key}
                  href={hrefFor(withNeedToggled(state, need.key))}
                  selected={state.needs.includes(need.key)}
                  label={need.label}
                  count={count}
                  detail={count === 1 ? '1 project' : `${String(count)} projects`}
                  onNavigate={onNavigate}
                />
              )
            })}
          </ul>
        </div>

        <div className="ws-rail-group">
          <h3 id={`${idPrefix}-state`} className="ws-rail-heading">
            Feedback state
          </h3>
          <ul className="ws-option-list" aria-labelledby={`${idPrefix}-state`}>
            <OptionLink
              href={hrefFor(withOpenOnly(state, !state.openOnly))}
              selected={state.openOnly}
              label="Open for feedback"
              detail={
                state.openOnly
                  ? 'selected. Activate to include projects that have closed their round.'
                  : 'hides projects that have closed their round.'
              }
              onNavigate={onNavigate}
            />
          </ul>
        </div>
      </nav>

      <SavedSearches
        items={savedSearches}
        signedIn={signedIn}
        currentQueryString={toQueryString(state)}
        idPrefix={idPrefix}
        onNavigate={onNavigate}
      />
    </div>
  )
}

export default FilterRail
