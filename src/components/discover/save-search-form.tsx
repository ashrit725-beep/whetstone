'use client'

/**
 * Name the filter set on screen and keep it.
 *
 * Keyboard contract: one field and one submit, in that order. Enter in the field
 * submits. The submit is never disabled at idle (§8.4.47); when there is nothing
 * to save it is `aria-disabled` with the reason stated in words beneath it, so
 * the reason is reachable rather than implied by a lighter colour.
 */

import { useId } from 'react'
import { BookmarkPlus } from 'lucide-react'
import { Field, Form, Input, SubmitButton, FormStatus } from '@/components/ui'
import { saveSearchAction } from './actions'

export interface SaveSearchFormProps {
  /** The canonical query string for the filters currently on screen. */
  queryString: string
  idPrefix: string
  atLimit: boolean
}

export function SaveSearchForm({ queryString, idPrefix, atLimit }: SaveSearchFormProps) {
  const reactId = useId()
  const fieldId = `${idPrefix}-saved-search-name-${reactId}`
  const nothingToSave = queryString.length === 0

  const reason = nothingToSave
    ? 'Pick at least one filter first. An empty search is the feed you already see.'
    : atLimit
      ? 'You have 20 saved searches, which is the limit. Remove one above first.'
      : undefined

  return (
    <Form action={saveSearchAction} showSummary={false} className="flex flex-col gap-xs">
      {({ state }) => (
        <>
          <input type="hidden" name="queryString" value={queryString} />

          <Field
            id={fieldId}
            label="Name this search"
            hint="It appears in this rail, on every device you sign in on."
            error={state.fieldErrors?.['saved-search-name'] ?? null}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="name"
                type="text"
                autoComplete="off"
                maxLength={48}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <SubmitButton
            size="sm"
            disabled={reason !== undefined}
            disabledReason={reason}
            pendingLabel="Saving the search…"
            iconLeading={<BookmarkPlus size={16} strokeWidth={1.5} />}
          >
            Save this search
          </SubmitButton>

          <FormStatus state={state} />
        </>
      )}
    </Form>
  )
}

export default SaveSearchForm
