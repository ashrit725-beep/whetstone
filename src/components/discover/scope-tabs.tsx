'use client'

/**
 * Search's scope selector: four links, not four buttons, because the scope is
 * in the address and Back returns to the previous one.
 *
 * Keyboard contract: Tab and Enter, in document order. The selected scope
 * carries `aria-current="true"`; it is never carried by hue alone.
 *
 * Placement note: a client module only so it sits on the same side of the
 * boundary as the rest of this directory. There are no hooks here.
 */

import { FilterChipLink } from '@/components/ui'

export interface ScopeOption {
  value: string
  label: string
  href: string
  count?: number
}

export interface ScopeTabsProps {
  /** Every href is precomputed on the server: a function cannot cross the boundary. */
  options: readonly ScopeOption[]
  current: string
}

export function ScopeTabs({ options, current }: ScopeTabsProps) {
  return (
    <nav aria-label="Search scope" className="mb-md">
      <ul className="ws-active-filters">
        {options.map((option) => (
          <li key={option.value}>
            <FilterChipLink
              href={option.href}
              selected={current === option.value}
              count={option.count}
            >
              {option.label}
            </FilterChipLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export default ScopeTabs
