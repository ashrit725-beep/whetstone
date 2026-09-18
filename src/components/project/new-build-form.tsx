'use client'

/**
 * The creator's "post a new build" form.
 *
 * Keyboard contract: a plain form inside a native `<details>`. Enter or Space on
 * the summary opens it, Tab walks the three fields and the submit, and nothing
 * is focus-trapped. It is collapsed by default because the page's subject is the
 * history, not the form. The header's "Post a build" and the empty state's
 * "Post the first build" arrive as `#new-build`, which opens it, so both land on
 * the form and not on a closed toggle.
 */

import { useRef } from 'react'
import { Field, Form, Input, SubmitButton, Textarea, type FormAction } from '@/components/ui'
import { ProjectStyles } from './styles'
import { useOpenFromHash } from './use-open-from-hash'

export interface NewBuildFormProps {
  slug: string
  action: FormAction
  suggestedLabel: string
}

export function NewBuildForm({ slug, action, suggestedLabel }: NewBuildFormProps) {
  const ref = useRef<HTMLDetailsElement | null>(null)
  useOpenFromHash(ref, 'new-build')

  return (
    <details id="new-build" ref={ref} className="flex scroll-mt-24 flex-col gap-3">
      <ProjectStyles />
      <summary className="ws-scaffold w-fit cursor-pointer text-sm">Post a new build</summary>

      <div className="pt-4">
        <Form action={action} summaryTitle="This build was not posted.">
          {({ state }) => (
            <div className="flex measure flex-col gap-4">
              <input type="hidden" name="slug" value={slug} />

              <Field
                id="versionLabel"
                label="Build name"
                hint="However you name it yourself. Reviewers cite it when they report."
                error={state.fieldErrors?.['versionLabel'] ?? null}
              >
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name={id}
                    defaultValue={suggestedLabel}
                    autoComplete="off"
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>

              <Field
                id="changelog"
                label="What changed"
                hint="Everyone who reviewed an earlier build sees this, and it is what makes a second pass cheap."
                error={state.fieldErrors?.['changelog'] ?? null}
              >
                {({ id, describedBy, invalid }) => (
                  <Textarea
                    id={id}
                    name={id}
                    prose
                    rows={4}
                    maxChars={2000}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>

              <Field
                id="buildUrl"
                label="Where to get it"
                optional
                hint="A full address, starting with https."
                error={state.fieldErrors?.['buildUrl'] ?? null}
              >
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name={id}
                    type="url"
                    inputMode="url"
                    autoComplete="off"
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>

              <SubmitButton variant="primary" pendingLabel="Posting the build…">
                Post the build
              </SubmitButton>
            </div>
          )}
        </Form>
      </div>
    </details>
  )
}

export default NewBuildForm
