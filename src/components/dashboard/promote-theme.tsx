'use client'

/**
 * Promotes a theme into a tracked suggestion, carrying its points as evidence.
 *
 * This is the first half of the loop. The hidden `pointIds` are the link the
 * tracker later reads to tell those exact reviewers, by name, that their note
 * shipped. Without it a suggestion is just a to-do; with it, it is a promise to
 * a list of people.
 *
 * Keyboard contract: the trigger opens a native modal `<dialog>`; Escape closes
 * it and focus returns to the trigger (handled by the Dialog primitive). Inside,
 * Tab reaches the title, the note, then the two actions, in that order. The
 * dialog stays open on failure so nothing typed is lost.
 */

import { useState } from 'react'
import { ListChecks } from 'lucide-react'
import {
  Banner,
  Button,
  Dialog,
  Field,
  Input,
  SubmitButton,
  Form,
  Textarea,
} from '@/components/ui'
import { promoteThemeToSuggestion } from '@/server/actions/dashboard'

export interface PromoteThemeProps {
  projectId: string
  themeLabel: string
  summary: string
  pointIds: readonly string[]
  pointCount: number
  reviewers: number
}

export function PromoteTheme({
  projectId,
  themeLabel,
  summary,
  pointIds,
  pointCount,
  reviewers,
}: PromoteThemeProps) {
  const [open, setOpen] = useState(false)
  const people = reviewers === 1 ? '1 reviewer' : `${String(reviewers)} reviewers`
  const points = pointCount === 1 ? '1 point' : `${String(pointCount)} points`

  return (
    <>
      <Button
        variant="secondary"
        onClick={() => {
          setOpen(true)
        }}
        iconLeading={<ListChecks size={20} strokeWidth={1.5} />}
      >
        Track this
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Track this theme"
        description={`${points} from ${people}. Tracking it keeps their names attached, so shipping it tells them.`}
        size="md"
      >
        <Form action={promoteThemeToSuggestion} summaryTitle="This suggestion was not created.">
          {({ state }) => (
            <>
              {state.status === 'success' ? (
                <Banner
                  variant="success"
                  title="Tracked in Open"
                  action={{
                    label: 'Open the tracker',
                    href: `/dashboard/suggestions?project=${encodeURIComponent(projectId)}`,
                  }}
                >
                  {state.message}
                </Banner>
              ) : null}

              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="themeLabel" value={themeLabel} />
              {pointIds.map((id) => (
                <input key={id} type="hidden" name="pointIds" value={id} />
              ))}

              <Field
                id="title"
                label="What are you going to change?"
                hint="Reviewers see this sentence when it moves, so name the change, not the complaint."
                error={state.fieldErrors?.['title']}
              >
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="title"
                    defaultValue={themeLabel}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    autoComplete="off"
                  />
                )}
              </Field>

              <Field
                id="body"
                label="Anything else you want on the card"
                optional
                error={state.fieldErrors?.['body']}
              >
                {({ id, describedBy, invalid }) => (
                  <Textarea
                    id={id}
                    name="body"
                    prose
                    rows={4}
                    defaultValue={summary}
                    maxChars={2000}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>

              <div className="flex flex-wrap items-center gap-md">
                <SubmitButton variant="primary" pendingLabel="Adding it to the tracker…">
                  Add to the tracker
                </SubmitButton>
                <Button
                  onClick={() => {
                    setOpen(false)
                  }}
                >
                  {state.status === 'success' ? 'Close' : 'Leave it untracked'}
                </Button>
              </div>
            </>
          )}
        </Form>
      </Dialog>
    </>
  )
}

export default PromoteTheme
