'use client'

/**
 * Text search over the feed. A real GET form, so it works with JavaScript off
 * and the result is a shareable address.
 *
 * The other filters ride along as hidden inputs, because a search should narrow
 * what is on screen rather than silently reset the rail. `cursor`-style state is
 * deliberately not carried: a new query starts at the first row. /search passes
 * its scope the same way, through `hidden`, and its own label and hint, because
 * it reads more than project fields.
 *
 * Keyboard contract: Tab reaches the field then the submit; Enter in the field
 * submits. `/` from anywhere inside Discover focuses it (see shortcut-scope).
 *
 * This is a client module for one reason: `Field` takes a render function for
 * its control, and a function cannot cross the server-to-client boundary. The
 * form itself still posts without JavaScript, because it is a real GET form.
 */

import { Search } from 'lucide-react'
import { Button, Field, Input } from '@/components/ui'
import { SEARCH_FIELD_ID } from './shortcut-scope'
import type { DiscoverState } from './filters'
import { DEFAULT_SORT } from './filters'

export interface SearchFormProps {
  state: DiscoverState
  action?: string
  /** Names what the field searches. */
  label?: string
  /** Says which fields it reads. */
  hint?: string
  /** Extra parameters to carry through a resubmit, e.g. search's scope. */
  hidden?: Readonly<Record<string, string>>
}

export function SearchForm({
  state,
  action = '/discover',
  label = 'Search projects',
  hint = 'Matches titles, taglines and summaries.',
  hidden = {},
}: SearchFormProps) {
  return (
    <form action={action} method="get" className="ws-search" role="search">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {state.typeSlug ? <input type="hidden" name="type" value={state.typeSlug} /> : null}
      {state.grit !== null ? <input type="hidden" name="grit" value={String(state.grit)} /> : null}
      {state.needs.map((need) => (
        <input key={need} type="hidden" name="need" value={need} />
      ))}
      {state.tags.map((tag) => (
        <input key={tag} type="hidden" name="tag" value={tag} />
      ))}
      {state.openOnly ? <input type="hidden" name="open" value="1" /> : null}
      {state.sort !== DEFAULT_SORT ? <input type="hidden" name="sort" value={state.sort} /> : null}

      <Field id={SEARCH_FIELD_ID} label={label} hint={hint}>
        {({ id, describedBy }) => (
          <div className="ws-search-row">
            <Input
              id={id}
              name="q"
              type="search"
              defaultValue={state.query}
              autoComplete="off"
              spellCheck={false}
              aria-describedby={describedBy}
            />
            <Button type="submit" iconLeading={<Search size={20} strokeWidth={1.5} />}>
              Search
            </Button>
          </div>
        )}
      </Field>
    </form>
  )
}

export default SearchForm
