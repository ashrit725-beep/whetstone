'use client'

/**
 * The moderation entry point. Writes one row to `content_reports` and says what
 * happens next, because a report that vanishes is a report nobody files twice.
 *
 * The schema allows a single open report per person per thing, so a second one
 * is answered with what is already true rather than with an error.
 *
 * Keyboard contract: the trigger opens the dialog and focus moves inside it;
 * Escape closes it and focus returns to the trigger; arrow keys move between
 * reasons, which is native radio behaviour; Tab cannot leave the dialog while
 * it is open.
 */

import { useState } from 'react'
import { Flag } from 'lucide-react'
import {
  Button,
  Dialog,
  Field,
  Form,
  RadioGroup,
  SubmitButton,
  Textarea,
} from '@/components/ui'
import { DISCUSSION_REPORT_REASONS, type ReportTargetType } from './labels'
import { reportContentAction } from '@/server/actions/discussions'

export interface ReportDialogProps {
  targetType: ReportTargetType
  targetId: string
  /** Names the thing in the dialog title, e.g. "the reply by Maya Okonkwo". */
  what: string
  /** Trigger label. Rendered visually unless `iconOnly`. */
  triggerLabel: string
  iconOnly?: boolean
  /** The viewer already has an open report against this thing. */
  alreadyReported?: boolean
}

const REASON_OPTIONS = DISCUSSION_REPORT_REASONS.map((reason) => ({
  value: reason.value,
  label: reason.label,
}))

export function ReportDialog({
  targetType,
  targetId,
  what,
  triggerLabel,
  iconOnly = false,
  alreadyReported = false,
}: ReportDialogProps) {
  const [open, setOpen] = useState(false)

  if (alreadyReported) {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled
        disabledReason={`You have already reported ${what}, and a moderator still has that report open.`}
        iconLeading={<Flag size={16} strokeWidth={1.5} />}
      >
        {iconOnly ? <span className="sr-only">{triggerLabel}</span> : triggerLabel}
      </Button>
    )
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(true)
        }}
        iconLeading={<Flag size={16} strokeWidth={1.5} />}
      >
        {iconOnly ? <span className="sr-only">{triggerLabel}</span> : triggerLabel}
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Report ${what}`}
        description="A moderator reads the report. The author is not told who filed it."
        size="md"
      >
        <Form action={reportContentAction} summaryTitle="This report was not sent.">
          {({ state }) => {
            if (state.status === 'success') {
              return (
                <div className="flex flex-col gap-md">
                  <p className="measure-ui text-base text-text-1">{state.message}</p>
                  <div className="flex justify-end">
                    <Button
                      variant="primary"
                      onClick={() => {
                        setOpen(false)
                      }}
                    >
                      Back to the thread
                    </Button>
                  </div>
                </div>
              )
            }

            return (
              <div className="flex flex-col gap-md">
                <input type="hidden" name="targetType" value={targetType} />
                <input type="hidden" name="targetId" value={targetId} />

                {/* No reason is chosen in advance: a preselected "Spam" let a
                    report be filed without anyone deciding what it was for. */}
                <RadioGroup
                  legend="What is wrong with it"
                  name="reason"
                  options={REASON_OPTIONS}
                  error={state.fieldErrors?.['reason'] ?? null}
                  required
                />

                <Field
                  id="report-detail"
                  label="Anything a moderator should see first"
                  optional
                  hint="One or two sentences. A quoted line or a timestamp saves a moderator the search."
                  error={state.fieldErrors?.['detail'] ?? null}
                >
                  {({ id, describedBy, invalid }) => (
                    <Textarea
                      id={id}
                      name="detail"
                      aria-describedby={describedBy}
                      invalid={invalid}
                      maxChars={1000}
                    />
                  )}
                </Field>

                {/* Pinned to the foot of the dialog's scroll region, drawn as
                    Dialog draws its own footer. It cannot move into that footer
                    slot: SubmitButton reads the pending state of the <form> it
                    sits in, and the footer is outside it. Unpinned, both buttons
                    sat below the fold of a 900px-tall window. The negative
                    offset matches the region's padding, which a sticky box
                    otherwise stops short of, leaving a strip of the form
                    scrolling past underneath it. */}
                <div className="sticky -bottom-md -mx-md -mb-md flex flex-wrap justify-end gap-xs rounded-b-lg border-t border-border-hair bg-surface-4 p-md">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setOpen(false)
                    }}
                  >
                    Keep reading
                  </Button>
                  <SubmitButton variant="primary" pendingLabel="Sending the report…">
                    Send the report
                  </SubmitButton>
                </div>
              </div>
            )
          }}
        </Form>
      </Dialog>
    </>
  )
}

export default ReportDialog
