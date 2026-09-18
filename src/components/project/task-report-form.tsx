'use client'

/**
 * A tester's report on one task.
 *
 * Keyboard contract: a radiogroup of outcomes (arrow keys move and select,
 * native behaviour), an optional minutes field, an optional note, and one
 * submit. Collapsed inside a native `<details>` so a round of eight tasks does
 * not open as eight forms at once; Enter or Space opens the one being answered.
 */

import { Field, Form, Input, RadioGroup, SubmitButton, Textarea, type FormAction } from '@/components/ui'
import { TASK_OUTCOMES } from './playtest-vocab'
import { ProjectStyles } from './styles'

export interface TaskReportFormProps {
  slug: string
  roundId: string
  taskId: string
  taskTitle: string
  action: FormAction
  /** The outcome this tester already reported, when they have. */
  current: string | null
}

export function TaskReportForm({ slug, roundId, taskId, taskTitle, action, current }: TaskReportFormProps) {
  return (
    <details>
      <ProjectStyles />
      <summary className="ws-scaffold w-fit cursor-pointer text-xs">
        {current ? 'Change your report' : 'Report how this went'}
      </summary>

      <div className="pt-4">
        <Form action={action} summaryTitle="This report was not saved.">
          {({ state }) => (
            <div className="flex measure flex-col gap-4">
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="roundId" value={roundId} />
              <input type="hidden" name="taskId" value={taskId} />

              <RadioGroup
                legend={`How ${taskTitle.toLowerCase()} went for you`}
                name="outcome"
                defaultValue={current ?? undefined}
                error={state.fieldErrors?.['outcome'] ?? null}
                options={TASK_OUTCOMES.map((outcome) => ({ value: outcome.key, label: outcome.label }))}
              />

              <Field id={`minutes-${taskId}`} label="Minutes it took" optional hint="Leave it blank if you did not time it.">
                {({ id, describedBy }) => (
                  <Input
                    id={id}
                    name="minutes"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={600}
                    autoComplete="off"
                    aria-describedby={describedBy}
                  />
                )}
              </Field>

              <Field
                id={`note-${taskId}`}
                label="What happened"
                optional
                hint="Where you got stuck, what you tried, what you expected instead."
              >
                {({ id, describedBy }) => (
                  <Textarea id={id} name="note" prose rows={3} maxChars={600} aria-describedby={describedBy} />
                )}
              </Field>

              <SubmitButton variant="primary" pendingLabel="Saving the report…">
                Save this report
              </SubmitButton>
            </div>
          )}
        </Form>
      </div>
    </details>
  )
}

export default TaskReportForm
