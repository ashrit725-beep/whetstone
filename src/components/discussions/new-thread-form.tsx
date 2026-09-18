'use client'

/**
 * Starting a thread: a title, what kind of thread it is, and the post itself.
 *
 * One column of labelled fields, no card. The form posts to a Server Action and
 * the error summary takes focus once per failed submit, so a rejected post never
 * leaves the reader hunting for what went wrong.
 *
 * Keyboard contract:
 *  · Tab walks title, kind, editor mode, body, submit.
 *  · Arrow keys move within the kind radios, which is native radio behaviour.
 *  · The error summary is reachable by its own fragment links, and each one
 *    focuses the field it names.
 */

import { useState } from 'react'
import { Field, Form, Input, RadioGroup, SubmitButton } from '@/components/ui'
import { AUTHORABLE_KINDS } from './labels'
import { MarkdownComposer } from './markdown-composer'
import { createThreadAction } from '@/server/actions/discussions'

const KIND_OPTIONS = AUTHORABLE_KINDS.map((kind) => ({
  value: kind.value,
  label: kind.label,
  description: kind.description,
}))

export interface NewThreadFormProps {
  channelSlug: string
  channelLabel: string
}

export function NewThreadForm({ channelSlug, channelLabel }: NewThreadFormProps) {
  const [body, setBody] = useState('')

  return (
    <Form action={createThreadAction} summaryTitle="This thread was not posted.">
      {({ state }) => (
        <>
          <input type="hidden" name="channelSlug" value={channelSlug} />

          <Field
            id="title"
            label="Title"
            hint={`The line people scan in the ${channelLabel} register. The specific version of the question beats the general one.`}
            error={state.fieldErrors?.['title'] ?? null}
            required
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="title"
                type="text"
                autoComplete="off"
                required
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <RadioGroup
            legend="What kind of thread is this"
            name="kind"
            options={KIND_OPTIONS}
            defaultValue="discussion"
            hint="A question can have one reply marked as the answer. The other two cannot."
          />

          <MarkdownComposer
            id="bodyMd"
            name="bodyMd"
            label="The post"
            hint="Markdown works here: **bold**, `code`, a line starting with > for a quote, and - for a list. Say what you already tried."
            value={body}
            onValueChange={setBody}
            error={state.fieldErrors?.['bodyMd'] ?? state.fieldErrors?.['channelSlug'] ?? null}
            maxChars={20000}
            tall
            required
            allow="article"
          />

          <p aria-live="polite" className="measure-ui text-xs" style={{ minHeight: '1lh' }}>
            {state.status === 'error' && !state.fieldErrors ? (
              <span className="text-critical">{state.message}</span>
            ) : null}
          </p>

          <div>
            <SubmitButton variant="primary" pendingLabel="Posting the thread…">
              Post the thread
            </SubmitButton>
          </div>
        </>
      )}
    </Form>
  )
}

export default NewThreadForm
