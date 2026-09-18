/**
 * What is currently narrowing the feed, and one control per filter to drop it.
 *
 * Each entry is a single link whose destination is the same feed without that
 * one filter, so removal costs one activation, works without JavaScript, and is
 * undone by Back. The visible word is the filter; the accessible name says what
 * activating it does, and contains the visible word (SC 2.5.3).
 *
 * Keyboard contract: links in the order the rail lists the filters, then the
 * clear-everything link. Tab and Enter, nothing else.
 */

import Link from 'next/link'
import { X } from 'lucide-react'
import { activeFilters, clearedState, hrefFor, type DiscoverState } from './filters'

export interface ActiveFiltersProps {
  state: DiscoverState
}

export function ActiveFilters({ state }: ActiveFiltersProps) {
  const filters = activeFilters(state)
  if (filters.length === 0) return null

  return (
    <ul className="ws-active-filters" aria-label="Filters applied to this feed">
      {filters.map((filter) => (
        <li key={filter.id}>
          <Link
            href={hrefFor(filter.without)}
            prefetch={false}
            aria-label={`Clear ${filter.phrase}`}
            className="ws-clear"
          >
            <span>{filter.label}</span>
            <X size={16} strokeWidth={1.5} aria-hidden="true" />
          </Link>
        </li>
      ))}
      {filters.length > 1 ? (
        <li>
          <Link href={hrefFor(clearedState(state))} prefetch={false} className="ws-clear">
            <span>Clear all filters</span>
          </Link>
        </li>
      ) : null}
    </ul>
  )
}

export default ActiveFilters
