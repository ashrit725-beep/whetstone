'use client'

/**
 * Post a bounty.
 *
 * The form collects what the work is and what it is worth, and nothing that
 * pays for it: no card, no account number, no billing address. The fee
 * arithmetic is shown live so a creator can see the reviewer's side of the
 * amount before they commit, the terms sit directly under it in the words every
 * other bounty surface uses, and the same arithmetic runs again on the server,
 * which is the number that counts.
 *
 * Keyboard contract: one tab stop per control, in visual order. The error
 * summary appears on a failed submit, takes focus once, and each entry is a
 * fragment link to the field it names.
 */

import { useState } from 'react'
import {
  Field,
  Form,
  FormStatus,
  Input,
  Select,
  SubmitButton,
  Textarea,
  GritChip,
} from '@/components/ui'
import { postBounty } from '@/server/actions/bounties'
import { money } from '@/components/marketplace/format'
import { settlementTerms } from '@/components/marketplace/bounty-state'
import type { OwnedProjectOption } from '@/server/queries/marketplace'

const TURNAROUND_OPTIONS = [
  { value: '24', label: '1 day' },
  { value: '48', label: '2 days' },
  { value: '72', label: '3 days' },
  { value: '120', label: '5 days' },
  { value: '168', label: '7 days' },
  { value: '336', label: '14 days' },
  { value: '720', label: '30 days' },
]

export interface BountyFormProps {
  projects: readonly OwnedProjectOption[]
  expertiseOptions: readonly { value: string; label: string }[]
  platformFeePercent: number
  /** Preselected when the creator came from a project or from a reviewer’s card. */
  defaultProjectId?: string | null
  defaultExpertiseId?: string | null
  defaultTitle?: string
  defaultAmountDollars?: number
  /** Set when the creator came from one reviewer's rate card. */
  invited?: { handle: string; displayName: string; minBountyCents: number | null } | null
}

export function BountyForm({
  projects,
  expertiseOptions,
  platformFeePercent,
  defaultProjectId,
  defaultExpertiseId,
  defaultTitle,
  defaultAmountDollars,
  invited,
}: BountyFormProps) {
  const [amount, setAmount] = useState<string>(
    defaultAmountDollars ? String(defaultAmountDollars) : '150',
  )
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? projects[0]?.id ?? '')

  const dollars = Number.parseInt(amount, 10)
  const valid = Number.isFinite(dollars) && dollars > 0
  const cents = valid ? dollars * 100 : 0
  const feeCents = valid ? Math.min(cents - 1, Math.round((cents * platformFeePercent) / 100)) : 0
  const chosen = projects.find((p) => p.id === projectId) ?? null

  return (
    <Form action={postBounty} summaryTitle="This bounty was not posted.">
      {({ state }) => (
        <div className="flex flex-col gap-lg">
          {invited ? <input type="hidden" name="expertHandle" value={invited.handle} /> : null}

          {invited ? (
            <p className="measure-ui text-sm text-text-2">
              This goes to {invited.displayName} as a direct request: it stays off the
              public bounty list, they are notified, and nobody else can apply. They reply
              with a pitch, and nothing is awarded until you pick them.
            </p>
          ) : null}

          <Field
            id="projectId"
            label="Which project is the review for?"
            hint="Only projects you have published can carry a bounty."
            error={state.fieldErrors?.['projectId']}
            required
          >
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                name="projectId"
                required
                value={projectId}
                onChange={(event) => {
                  setProjectId(event.target.value)
                }}
                aria-describedby={describedBy}
                invalid={invalid}
                options={projects.map((project) => ({
                  value: project.id,
                  label: `${project.title} · ${project.stageLabel}`,
                }))}
              />
            )}
          </Field>

          {chosen ? (
            <p className="flex items-center gap-xs text-xs text-text-3">
              <span>Reviewers will see this project at</span>
              <GritChip value={chosen.grit} size="sm" showLabel />
            </p>
          ) : null}

          <Field
            id="title"
            label="What do you want reviewed?"
            hint="A reviewer reads this in a list of ten. Name the work, not the project."
            error={state.fieldErrors?.['title']}
            required
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="title"
                required
                defaultValue={defaultTitle}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Field
            id="brief"
            label="The brief"
            hint="Say what to look at, what you already know is broken, and what a good delivery contains."
            error={state.fieldErrors?.['brief']}
            required
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                name="brief"
                prose
                required
                maxChars={4000}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <div className="flex flex-col gap-lg sm:flex-row sm:gap-xl">
            <Field
              id="amountDollars"
              label="Amount, in US dollars"
              hint="Whole dollars, from $50 to $5,000. $50 is roughly an hour of a reviewer’s time."
              error={state.fieldErrors?.['amountDollars']}
              required
              className="sm:flex-1"
            >
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="amountDollars"
                  type="number"
                  inputMode="numeric"
                  min={50}
                  max={5000}
                  step={1}
                  required
                  value={amount}
                  onChange={(event) => {
                    setAmount(event.target.value)
                  }}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>

            <Field
              id="turnaroundHours"
              label="Turnaround"
              hint="How long the reviewer has once they are awarded."
              error={state.fieldErrors?.['turnaroundHours']}
              required
              className="sm:flex-1"
            >
              {({ id, describedBy, invalid }) => (
                <Select
                  id={id}
                  name="turnaroundHours"
                  required
                  defaultValue="72"
                  aria-describedby={describedBy}
                  invalid={invalid}
                  options={TURNAROUND_OPTIONS}
                />
              )}
            </Field>
          </div>

          <Field
            id="expertiseId"
            label="Area of expertise"
            hint="Optional. Setting one puts the bounty in front of reviewers who work in it."
            error={state.fieldErrors?.['expertiseId']}
            optional
          >
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                name="expertiseId"
                defaultValue={defaultExpertiseId ?? ''}
                aria-describedby={describedBy}
                invalid={invalid}
                options={[
                  { value: '', label: 'Any area' },
                  ...expertiseOptions.map((option) => ({
                    value: option.value,
                    label: option.label,
                  })),
                ]}
              />
            )}
          </Field>

          <dl
            aria-live="polite"
            className="flex flex-col gap-2xs border-t border-border-hair pt-md"
          >
            <div className="flex items-baseline justify-between gap-md">
              <dt className="text-sm text-text-2">You commit</dt>
              <dd className="tnum text-md text-text-1">{valid ? money(cents) : '–'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-md">
              <dt className="text-sm text-text-2">
                Platform fee, <span className="tnum">{platformFeePercent}</span>%
              </dt>
              <dd className="tnum text-sm text-text-2">{valid ? money(feeCents) : '–'}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-md">
              <dt className="text-sm text-text-2">The reviewer receives</dt>
              <dd className="tnum text-md text-text-1">{valid ? money(cents - feeCents) : '–'}</dd>
            </div>
          </dl>
          <p className="measure-ui text-xs text-text-3">{settlementTerms(platformFeePercent)}</p>

          {/* Full width on a phone, its own width from 40rem: stretched across the
              column the submit was a 42rem slab louder than the amount above it. */}
          <div className="flex flex-col gap-xs sm:items-start">
            <SubmitButton variant={invited ? 'straw' : 'primary'} pendingLabel="Posting the bounty…">
              {invited ? `Send the request to ${invited.displayName}` : 'Post the bounty'}
            </SubmitButton>
            <FormStatus state={state} />
          </div>
        </div>
      )}
    </Form>
  )
}

export default BountyForm
