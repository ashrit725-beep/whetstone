/**
 * The inbox filter bar.
 *
 * Every filter is a URL search param read by the Server Component that renders
 * the table, so each one is a real link: shareable, back-button correct, and
 * working with JavaScript switched off. There is no client state here at all,
 * which is why this file carries no `'use client'`.
 *
 * Counts beside each chip are real: they come from one grouped query
 * (`getInboxCounts`), not from counting the rows that happen to be on screen.
 */

import { FilterChipLink } from '@/components/ui'
import type { InboxCounts } from '@/server/repos/feedback'
import type { InboxFilterState } from './inbox-types'
import { ProjectPicker } from './project-picker'

export interface InboxFiltersProps {
  filters: InboxFilterState
  counts: InboxCounts
  projects: readonly { readonly id: string; readonly title: string; readonly unread: number }[]
  /** The params already on the URL, so a chip keeps the rest of them. */
  current: Readonly<Record<string, string>>
  basePath: string
  /** False with every project in view, or below the theme floor: no board to group by. */
  groupable: boolean
}

const STATES = [
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'actioned', label: 'Actioned' },
  { value: 'archived', label: 'Archived' },
] as const

export function InboxFilters({
  filters,
  counts,
  projects,
  current,
  basePath,
  groupable,
}: InboxFiltersProps) {
  function href(patch: Readonly<Record<string, string | null>>): string {
    const search = new URLSearchParams(current)
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) search.delete(key)
      else search.set(key, value)
    }
    // An open note belongs to the list that was on screen when it was opened.
    search.delete('note')
    const query = search.toString()
    return query.length > 0 ? `${basePath}?${query}` : basePath
  }

  return (
    <div className="flex flex-col gap-md">
      <ProjectPicker
        projects={projects.map((project) => ({ id: project.id, title: project.title, count: project.unread }))}
        selected={filters.project}
        href={(project) =>
          project === 'all' ? href({ project: 'all', grouped: 'off' }) : href({ project })
        }
        allowAll
      />

      <fieldset className="m-0 flex flex-col gap-xs border-0 p-0">
        <legend className="p-0 text-xs text-text-3">Triage state</legend>
        <div className="flex flex-wrap gap-xs">
          <FilterChipLink
            href={href({ state: null })}
            selected={filters.state === null}
            count={counts.total}
          >
            Everything
          </FilterChipLink>
          {STATES.map((state) => (
            <FilterChipLink
              key={state.value}
              href={href({ state: state.value })}
              selected={filters.state === state.value}
              count={counts.byState[state.value]}
            >
              {state.label}
            </FilterChipLink>
          ))}
        </div>
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-xs border-0 p-0">
        <legend className="p-0 text-xs text-text-3">Narrow it further</legend>
        <div className="flex flex-wrap gap-xs">
          <FilterChipLink
            href={href({ unanswered: filters.unansweredOnly ? null : 'only' })}
            selected={filters.unansweredOnly}
            count={counts.unanswered}
          >
            Waiting on a reply
          </FilterChipLink>
          {groupable ? (
            <>
              <FilterChipLink
                href={href({ grouped: 'on' })}
                selected={filters.grouped}
              >
                Grouped by theme
              </FilterChipLink>
              <FilterChipLink href={href({ grouped: 'off' })} selected={!filters.grouped}>
                One note per row
              </FilterChipLink>
            </>
          ) : null}
        </div>
      </fieldset>
    </div>
  )
}

export default InboxFilters
