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
 * Saved searches: a named filter set, kept in a real table, replayed as a link.
 *
 * Keyboard contract: each entry is a link followed by a single-button form.
 * Tab reaches the link, then the remove control, then the next entry. Removal
 * posts a real form to a Server Action, so it works with JavaScript off; there
 * is no confirmation dialog, because the action is reversible by saving the same
 * filters again (§8.4.46).
 */

import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { Button, Link as UiLink } from '@/components/ui'
import { deleteSavedSearchAction } from './actions'
import { SaveSearchForm } from './save-search-form'
import { parseQueryString, activeFilters } from './filters'

export interface SavedSearchItem {
  readonly id: string
  readonly name: string
  readonly queryString: string
}

export interface SavedSearchesProps {
  items: readonly SavedSearchItem[]
  signedIn: boolean
  /** The filter set currently on screen, canonicalised. */
  currentQueryString: string
  idPrefix: string
  onNavigate?: () => void
}

/** "Game, 1000 grit, Playtesters" — what the saved link will actually do. */
function describe(queryString: string): string {
  const filters = activeFilters(parseQueryString(queryString))
  if (filters.length === 0) return 'Every project'
  return filters.map((f) => f.label).join(', ')
}

export function SavedSearches({
  items,
  signedIn,
  currentQueryString,
  idPrefix,
  onNavigate,
}: SavedSearchesProps) {
  const headingId = `${idPrefix}-saved`

  return (
    <div className="ws-rail-group">
      <h3 id={headingId} className="ws-rail-heading">
        Saved searches
      </h3>

      {!signedIn ? (
        <p className="measure-ui text-xs text-text-3">
          Saved searches belong to an account.{' '}
          <UiLink href="/sign-in?next=/discover">Sign in to keep this filter set</UiLink>.
        </p>
      ) : (
        <>
          {items.length === 0 ? (
            <p className="measure-ui text-xs text-text-3">
              Nothing saved yet. A saved search is a name for the filters you keep coming back to.
            </p>
          ) : (
            <ul className="ws-option-list" aria-labelledby={headingId}>
              {items.map((item) => (
                <li key={item.id} className="ws-saved">
                  <Link
                    href={`/discover?${item.queryString}`}
                    prefetch={false}
                    onClick={onNavigate}
                    className="ws-saved-link"
                  >
                    <span className="text-sm text-text-2">{item.name}</span>
                    <span className="text-2xs text-text-3">{describe(item.queryString)}</span>
                  </Link>
                  <form action={deleteSavedSearchAction}>
                    <input type="hidden" name="id" value={item.id} />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="sm"
                      aria-label={`Remove the saved search “${item.name}”`}
                      iconLeading={<Trash2 size={16} strokeWidth={1.5} />}
                    >
                      <span className="sr-only">Remove</span>
                    </Button>
                  </form>
                </li>
              ))}
            </ul>
          )}

          <SaveSearchForm
            queryString={currentQueryString}
            idPrefix={idPrefix}
            atLimit={items.length >= 20}
          />
        </>
      )}
    </div>
  )
}

export default SavedSearches
