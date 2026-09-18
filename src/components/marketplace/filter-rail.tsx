/**
 * URL-driven filter rails for the marketplace and the bounty list.
 *
 * These are links, not state. The whole rail renders in a Server Component,
 * every chip is a real href a reader can copy or open in a new tab, and the
 * selected chip carries `aria-current`. No client bundle is shipped for
 * filtering.
 *
 * Keyboard contract: a list of links. Tab moves between chips, Enter follows
 * one. Each chip clears 44px through its own padding, and the row sits at
 * `gap-xs` so no two hit areas touch.
 */

import { FilterChipLink } from '@/components/ui'

export interface FilterOption {
  value: string
  label: string
  count?: number
}

export interface FilterGroupProps {
  /** Visible heading for the group. */
  label: string
  /** The search-param key this group writes. */
  param: string
  options: readonly FilterOption[]
  selected: string | null
  /** Current params, so one group's chip preserves the others. */
  params: Readonly<Record<string, string | undefined>>
  basePath: string
  /** Label for the chip that clears this group. */
  anyLabel: string
}

function hrefFor(
  basePath: string,
  params: Readonly<Record<string, string | undefined>>,
  param: string,
  value: string | null,
): string {
  const next = new URLSearchParams()
  for (const [key, current] of Object.entries(params)) {
    if (key === param || key === 'cursor') continue
    if (current) next.set(key, current)
  }
  if (value) next.set(param, value)
  const query = next.toString()
  return query ? `${basePath}?${query}` : basePath
}

export function FilterGroup({
  label,
  param,
  options,
  selected,
  params,
  basePath,
  anyLabel,
}: FilterGroupProps) {
  return (
    <div className="flex flex-col gap-xs">
      <h3 className="text-xs text-text-3" style={TERM}>
        {label}
      </h3>
      <ul className="flex flex-wrap gap-xs">
        <li>
          <FilterChipLink
            href={hrefFor(basePath, params, param, null)}
            selected={selected === null}
          >
            {anyLabel}
          </FilterChipLink>
        </li>
        {options.map((option) => (
          <li key={option.value}>
            <FilterChipLink
              href={hrefFor(basePath, params, param, option.value)}
              selected={selected === option.value}
              count={option.count}
            >
              {option.label}
            </FilterChipLink>
          </li>
        ))}
      </ul>
    </div>
  )
}

const TERM = { fontVariationSettings: '"wdth" 87, "wght" 600' } as const

export default FilterGroup
