'use client'

/**
 * Apply to a bounty.
 *
 * Re-applying updates the pitch rather than erroring, so a reviewer who thought
 * of a better first sentence is not blocked by a unique index. The quote is the
 * reviewer's own number: it does not have to match the posted amount, and the
 * creator sees both when they choose. The hint prints what an award actually
 * pays after the platform fee, so a reviewer quotes against their own side of
 * the amount rather than working it out.
 *
 * The column is capped at the composer's own 40rem (§4.4 surface 4). Left to
 * the page container it ran to 75rem: a 1200px-wide box for two sentences and a
 * 1200px-wide field for three digits, with every label and hint stopping at
 * 58ch, so the form read at a different measure from everything above it.
 *
 * Keyboard contract: one tab stop per control in visual order. On a failed
 * submit the error summary takes focus once and links to the field it names.
 */

import {
  Field,
  Form,
  FormStatus,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from '@/components/ui'
import { applyForBounty } from '@/server/actions/bounties'
import { money } from '@/components/marketplace/format'

const ETA_OPTIONS = [
  { value: '24', label: '1 day' },
  { value: '48', label: '2 days' },
  { value: '72', label: '3 days' },
  { value: '120', label: '5 days' },
  { value: '168', label: '7 days' },
  { value: '336', label: '14 days' },
]

export interface ApplyFormProps {
  bountyId: string
  amountCents: number
  /** What an award pays the reviewer: the posted amount less the platform fee. */
  netCents: number
  feePercent: number
  currency: string
  turnaroundHours: number | null
  /** True when this reviewer already applied; the form then updates the pitch. */
  alreadyApplied: boolean
}

export function ApplyForm({
  bountyId,
  amountCents,
  netCents,
  feePercent,
  currency,
  turnaroundHours,
  alreadyApplied,
}: ApplyFormProps) {
  const defaultEta = turnaroundHours ? String(Math.min(turnaroundHours, 336)) : '72'

  return (
    <Form action={applyForBounty} summaryTitle="This application was not sent.">
      {({ state }) => (
        <div className="flex w-full flex-col gap-lg" style={{ maxInlineSize: 'var(--container-prose)' }}>
          <input type="hidden" name="bountyId" value={bountyId} />

          <Field
            id="pitch"
            label="What would you look at first?"
            hint="Two or three sentences. The creator is choosing between people, not between prices."
            error={state.fieldErrors?.['pitch']}
            required
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                name="pitch"
                prose
                required
                maxChars={2000}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <div className="flex flex-col gap-lg sm:flex-row sm:gap-xl">
            <Field
              id="quotedDollars"
              label="Your quote, in US dollars"
              hint={`Posted at ${money(amountCents, currency)}, which pays ${money(netCents, currency)} after the ${String(feePercent)}% platform fee. Quote what the work is worth to you.`}
              error={state.fieldErrors?.['quotedDollars']}
              required
              className="sm:flex-1"
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="quotedDollars"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={5000}
                  step={1}
                  required
                  defaultValue={Math.round(amountCents / 100)}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>

            <Field
              id="etaHours"
              label="How long you need"
              error={state.fieldErrors?.['etaHours']}
              required
              className="sm:flex-1"
            >
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  name="etaHours"
                  required
                  defaultValue={defaultEta}
                  aria-describedby={describedBy}
                  invalid={invalid}
                  options={ETA_OPTIONS}
                />
              )}
            </Field>
          </div>

          <div className="flex flex-col items-start gap-xs">
            <SubmitButton variant="primary" pendingLabel="Sending the application…">
              {alreadyApplied ? 'Update your application' : 'Apply for this bounty'}
            </SubmitButton>
            <FormStatus state={state} />
          </div>
        </div>
      )}
    </Form>
  )
}

const STATUS_WORDING: Record<string, string> = {
  pending: 'Your application is in. The creator has not decided yet.',
  shortlisted: 'You are shortlisted. The creator is still deciding.',
  accepted: 'You were awarded this bounty.',
  declined: 'The creator chose someone else for this one.',
  withdrawn: 'You withdrew this application.',
  expired: 'This application expired when the bounty closed.',
}

/**
 * The applicant's side of the bounty page: where they stand, and the form to
 * write or rewrite the pitch. Split from `ApplyForm` so the page can render the
 * standing without duplicating the wording.
 */
export function ApplyFormWrapper({
  bountyId,
  amountCents,
  netCents,
  feePercent,
  currency,
  turnaroundHours,
  alreadyApplied,
  applicationStatus,
}: ApplyFormProps & { applicationStatus: string | null }) {
  const settled =
    applicationStatus === 'accepted' ||
    applicationStatus === 'declined' ||
    applicationStatus === 'expired'

  return (
    <div className="flex flex-col gap-md">
      {applicationStatus ? (
        <p className="measure-ui text-sm text-text-2">
          {STATUS_WORDING[applicationStatus] ?? 'Your application is on record.'}
        </p>
      ) : null}
      {settled ? null : (
        <ApplyForm
          bountyId={bountyId}
          amountCents={amountCents}
          netCents={netCents}
          feePercent={feePercent}
          currency={currency}
          turnaroundHours={turnaroundHours}
          alreadyApplied={alreadyApplied}
        />
      )}
    </div>
  )
}

export default ApplyForm
