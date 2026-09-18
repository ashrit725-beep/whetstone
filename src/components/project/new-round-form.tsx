'use client'

/**
 * The creator's round builder.
 *
 * Keyboard contract: a plain form in a native `<details>`. "Add a task" appends
 * one more text field and moves focus to it, so a keyboard user is never left
 * hunting for the box that just appeared. Removing a task returns focus to the
 * add button. It is collapsed by default; the header's and the empty state's
 * "Open a round" arrive as `#new-round`, which opens it.
 */

import { useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Field, Form, Input, SubmitButton, Textarea, type FormAction } from '@/components/ui'
import { ProjectStyles } from './styles'
import { useOpenFromHash } from './use-open-from-hash'

export interface NewRoundFormProps {
  slug: string
  action: FormAction
}

export function NewRoundForm({ slug, action }: NewRoundFormProps) {
  const [tasks, setTasks] = useState<string[]>(['task-1', 'task-2', 'task-3'])
  const addRef = useRef<HTMLButtonElement | null>(null)
  const lastRef = useRef<HTMLInputElement | null>(null)
  const ref = useRef<HTMLDetailsElement | null>(null)
  useOpenFromHash(ref, 'new-round')

  return (
    <details id="new-round" ref={ref} className="scroll-mt-24">
      <ProjectStyles />
      <summary className="ws-scaffold w-fit cursor-pointer text-sm">Open a playtest round</summary>

      <div className="pt-4">
        <Form action={action} summaryTitle="This round was not created.">
          {({ state }) => (
            <div className="flex measure flex-col gap-4">
              <input type="hidden" name="slug" value={slug} />

              <Field
                id="title"
                label="What this round is for"
                hint="Name the question the round answers, not the build."
                error={state.fieldErrors?.['title'] ?? null}
              >
                {({ id, describedBy, invalid }) => (
                  <Input id={id} name={id} autoComplete="off" aria-describedby={describedBy} invalid={invalid} />
                )}
              </Field>

              <Field id="brief" label="Brief for testers" optional error={state.fieldErrors?.['brief'] ?? null}>
                {({ id, describedBy, invalid }) => (
                  <Textarea id={id} name={id} prose rows={3} maxChars={2000} aria-describedby={describedBy} invalid={invalid} />
                )}
              </Field>

              <Field id="seats" label="Seats" optional hint="Leave it blank for an open round.">
                {({ id, describedBy }) => (
                  <Input id={id} name={id} type="number" inputMode="numeric" min={1} max={200} aria-describedby={describedBy} />
                )}
              </Field>

              <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
                <legend className="mb-1 p-0 text-sm text-ink">
                  The tasks, in the order a tester should do them
                </legend>
                <p className="measure-ui text-xs text-ink-3">
                  Testers report an outcome per task, which is what makes one tester comparable with the next.
                </p>
                {state.fieldErrors?.['task'] ? (
                  <p className="measure-ui text-xs text-critical">{state.fieldErrors['task']}</p>
                ) : null}

                <ul className="m-0 flex list-none flex-col gap-2 p-0">
                  {tasks.map((key, index) => (
                    <li key={key} className="flex items-center gap-2">
                      <label className="sr-only" htmlFor={key}>
                        {`Task ${index + 1}`}
                      </label>
                      <Input
                        id={key}
                        name="task"
                        autoComplete="off"
                        placeholder=""
                        wrapperClassName="flex-1"
                        ref={index === tasks.length - 1 ? lastRef : undefined}
                      />
                      {tasks.length > 1 ? (
                        <button
                          type="button"
                          className="grid size-[2.75rem] shrink-0 place-items-center rounded-sm border border-rule-2 text-ink-2"
                          onClick={() => {
                            setTasks((current) => current.filter((t) => t !== key))
                            addRef.current?.focus()
                          }}
                        >
                          <X size={16} strokeWidth={1.5} aria-hidden="true" />
                          <span className="sr-only">{`Remove task ${index + 1}`}</span>
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>

                <button
                  ref={addRef}
                  type="button"
                  className="ws-scaffold w-fit gap-1 text-sm"
                  onClick={() => {
                    setTasks((current) => [...current, `task-${String(current.length + 1)}-${String(Date.now())}`])
                    window.setTimeout(() => lastRef.current?.focus(), 0)
                  }}
                >
                  <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
                  Add a task
                </button>
              </fieldset>

              <SubmitButton variant="primary" pendingLabel="Opening the round…">
                Open the round
              </SubmitButton>
            </div>
          )}
        </Form>
      </div>
    </details>
  )
}

export default NewRoundForm
