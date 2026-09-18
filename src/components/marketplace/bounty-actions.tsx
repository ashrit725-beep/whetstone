'use client'

/**
 * The bounty's state transitions, one small form each.
 *
 * Every control names the consequence in its own label, so nothing here needs a
 * confirmation dialog to be safe to press: "Award to Nkechi Obi" and "Accept and
 * release $216" say what happens. The one genuinely destructive control, the
 * cancellation, carries the amount it returns.
 *
 * Authorisation is not decided here. These forms are only rendered for the party
 * entitled to press them, and the Server Action checks the session again before
 * it writes, because a hidden input is not a permission.
 *
 * Every one of these columns is capped at 40rem and every submit sits at its
 * own intrinsic width. A submit inside a flex column stretches to the container
 * by default, which turned "Accept and release $216" into a 1200px slab of
 * straw: the widest, loudest object on a page whose subject is a $260 review.
 *
 * Keyboard contract: ordinary forms. One tab stop per control, Enter submits,
 * and every result is announced through the form's polite status region.
 */

import {
  Banner,
  Button,
  Field,
  Form,
  FormStatus,
  Select,
  SubmitButton,
  Textarea,
} from '@/components/ui'
import {
  acceptAward,
  awardApplication,
  cancelBountyAction,
  deliverAward,
  disputeAward,
} from '@/server/actions/bounties'
import { money } from '@/components/marketplace/format'

const RATING_OPTIONS = [
  { value: '', label: 'No rating' },
  { value: '5', label: '5, better than the brief asked for' },
  { value: '4', label: '4, everything the brief asked for' },
  { value: '3', label: '3, useful with gaps' },
  { value: '2', label: '2, thin for the amount' },
  { value: '1', label: '1, not usable' },
]

export function AwardButton({
  bountyId,
  applicationId,
  applicantName,
}: {
  bountyId: string
  applicationId: string
  applicantName: string
}) {
  return (
    <Form action={awardApplication} showSummary={false}>
      {({ state }) => (
        <div className="flex flex-col items-start gap-2xs">
          <input type="hidden" name="bountyId" value={bountyId} />
          <input type="hidden" name="applicationId" value={applicationId} />
          <SubmitButton variant="primary" size="sm" pendingLabel="Awarding…">
            {`Award to ${applicantName}`}
          </SubmitButton>
          {state.status === 'error' && state.message ? (
            <Banner variant="danger" title="This award was not recorded">
              {state.message}
            </Banner>
          ) : null}
        </div>
      )}
    </Form>
  )
}

export function DeliverForm({
  awardId,
  feedbackHeadline,
}: {
  awardId: string
  feedbackHeadline: string | null
}) {
  return (
    <Form action={deliverAward} showSummary={false}>
      {({ state }) => (
        <div className="flex w-full flex-col items-start gap-xs" style={COLUMN}>
          <input type="hidden" name="awardId" value={awardId} />
          {feedbackHeadline ? (
            <p className="measure-ui text-sm text-text-2">
              Delivery links the review you already posted, “{feedbackHeadline}”, so the
              creator reads the same thing everyone else does.
            </p>
          ) : (
            <p className="measure-ui text-sm text-text-2">
              Delivery links a submitted review. Post your review on the project first,
              then deliver it here.
            </p>
          )}
          {feedbackHeadline ? (
            <SubmitButton variant="primary" pendingLabel="Marking it delivered…">
              Deliver the review
            </SubmitButton>
          ) : (
            <Button
              disabled
              disabledReason="No submitted review of yours was found on this project yet."
            >
              Deliver the review
            </Button>
          )}
          <FormStatus state={state} />
        </div>
      )}
    </Form>
  )
}

export function AcceptForm({
  awardId,
  amountCents,
  feeCents,
  currency,
  expertName,
}: {
  awardId: string
  amountCents: number
  feeCents: number
  currency: string
  expertName: string
}) {
  const net = amountCents - feeCents

  return (
    <Form action={acceptAward} summaryTitle="This acceptance was not recorded.">
      {({ state }) => (
        <div className="flex w-full flex-col gap-md" style={COLUMN}>
          <input type="hidden" name="awardId" value={awardId} />

          <p className="measure-ui text-sm text-text-2">
            Accepting releases <span className="tnum text-text-1">{money(net, currency)}</span> to{' '}
            {expertName} and takes <span className="tnum">{money(feeCents, currency)}</span> as the
            platform fee. Both movements appear in the ledger below.
          </p>

          <Field
            id="rating"
            label="How did the review land?"
            hint="Optional, and shown on the reviewer’s rate card as an average of real ratings."
            error={state.fieldErrors?.['rating']}
            optional
          >
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                name="rating"
                defaultValue=""
                aria-describedby={describedBy}
                invalid={invalid}
                options={RATING_OPTIONS}
              />
            )}
          </Field>

          <Field
            id="review"
            label="A note back to the reviewer"
            hint="Optional. What you are acting on first is the most useful thing you can say."
            error={state.fieldErrors?.['review']}
            optional
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                name="review"
                prose
                maxChars={1000}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <div className="flex flex-col items-start gap-xs">
            <SubmitButton variant="straw" pendingLabel="Accepting…">
              {`Accept and release ${money(net, currency)}`}
            </SubmitButton>
            <FormStatus state={state} />
          </div>
        </div>
      )}
    </Form>
  )
}

export function DisputeForm({ awardId }: { awardId: string }) {
  return (
    <Form action={disputeAward} summaryTitle="This dispute was not opened.">
      {({ state }) => (
        <div className="flex w-full flex-col gap-md" style={COLUMN}>
          <input type="hidden" name="awardId" value={awardId} />
          <p className="measure-ui text-sm text-text-2">
            A dispute freezes the escrow at its current amount. Nothing is paid out and
            nothing is refunded until it is settled.
          </p>
          <Field
            id="reason"
            label="What is wrong with the delivery?"
            hint="Both parties read this. Name the part of the brief that was not met."
            error={state.fieldErrors?.['reason']}
            required
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                name="reason"
                prose
                required
                maxChars={1000}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>
          <div className="flex flex-col items-start gap-xs">
            <SubmitButton variant="secondary" pendingLabel="Opening the dispute…">
              Open a dispute
            </SubmitButton>
            <FormStatus state={state} />
          </div>
        </div>
      )}
    </Form>
  )
}

export function CancelForm({
  bountyId,
  amountCents,
  currency,
}: {
  bountyId: string
  amountCents: number
  currency: string
}) {
  return (
    <Form action={cancelBountyAction} showSummary={false}>
      {({ state }) => (
        <div className="flex flex-col items-start gap-xs">
          <input type="hidden" name="bountyId" value={bountyId} />
          <SubmitButton variant="danger" pendingLabel="Cancelling…">
            {`Cancel and refund ${money(amountCents, currency)}`}
          </SubmitButton>
          <FormStatus state={state} />
        </div>
      )}
    </Form>
  )
}

const COLUMN = { maxInlineSize: 'var(--container-prose)' } as const
