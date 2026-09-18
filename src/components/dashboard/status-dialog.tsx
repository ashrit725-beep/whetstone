'use client'

/**
 * Shipping a suggestion, and declining one.
 *
 * This is the moment the whole product turns on. When a creator ships, every
 * reviewer whose note fed the suggestion is notified by name and credited in
 * the reputation ledger, inside the same transaction as the status change. That
 * is what makes reviewing worth doing, so this dialog does two things a plain
 * confirm would not:
 *
 *   1. It shows the creator *who* they are about to thank, by name and face,
 *      before they press the button. A list of people is a different decision
 *      from a status field.
 *   2. It asks what changed, and says plainly that the sentence will be sent to
 *      them. The repository refuses a ship with neither a version nor a note, so
 *      the requirement is real rather than decorative.
 *
 * Declining runs the same shape, because a decline owes a reason too.
 *
 * Keyboard contract: a native modal `<dialog>`. Escape closes and focus returns
 * to whatever opened it; Tab cycles inside. The dialog stays open on failure so
 * nothing typed is lost, and stays open on success so the creator can read who
 * was told.
 */

import { Package, X } from 'lucide-react'
import {
  Avatar,
  Banner,
  Button,
  Dialog,
  Field,
  Form,
  Select,
  SubmitButton,
  Textarea,
} from '@/components/ui'
import { moveSuggestion } from '@/server/actions/suggestions'
import type { SuggestionCard } from './suggestion-types'

export interface StatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  card: SuggestionCard | null
  target: 'shipped' | 'declined'
  versions: readonly { readonly id: string; readonly label: string }[]
}

function nameList(names: readonly string[]): string {
  if (names.length === 0) return ''
  if (names.length === 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0] ?? ''} and ${names[1] ?? ''}`
  const rest = names.length - 2
  return `${names[0] ?? ''}, ${names[1] ?? ''} and ${String(rest)} ${rest === 1 ? 'other' : 'others'}`
}

export function StatusDialog({
  open,
  onOpenChange,
  card,
  target,
  versions,
}: StatusDialogProps) {
  if (!card) return null

  const shipping = target === 'shipped'
  const people = card.contributors
  const names = nameList(people.map((person) => person.name))
  const count = people.length

  const title = shipping ? 'Ship it, and tell the people who asked' : 'Decline it, and say why'
  const description = shipping
    ? count > 0
      ? `${String(count)} ${count === 1 ? 'reviewer' : 'reviewers'} wrote the notes behind this. Shipping tells each of them and credits their reputation.`
      : 'No reviewer notes are linked to this one, so nobody will be notified. It will still move to Shipped.'
    : count > 0
      ? `${String(count)} ${count === 1 ? 'reviewer' : 'reviewers'} wrote the notes behind this. They will read the reason you write here.`
      : 'No reviewer notes are linked to this one. The reason is kept on the card.'

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title} description={description} size="md">
      <Form action={moveSuggestion} summaryTitle="That move was not saved.">
        {({ state }) => (
          <>
            {state.status === 'success' ? (
              <Banner
                variant="success"
                title={shipping ? 'Shipped, and they were told' : 'Declined, and they were told why'}
              >
                {state.message}
              </Banner>
            ) : null}

            <input type="hidden" name="suggestionId" value={card.id} />
            <input type="hidden" name="status" value={shipping ? 'shipped' : 'declined'} />

            <div className="flex flex-col gap-2xs">
              <p className="text-sm text-text-1">{card.title}</p>
              <p className="text-xs text-text-3">{card.projectTitle}</p>
            </div>

            {count > 0 ? (
              <div className="flex flex-col gap-xs border-t border-border-hair pt-md">
                <h3 className="text-md text-text-1">
                  {shipping ? 'Who this thanks' : 'Who reads this reason'}
                </h3>
                <ul className="m-0 flex list-none flex-wrap gap-md p-0">
                  {people.map((person) => (
                    <li key={person.id} className="flex items-center gap-xs">
                      <Avatar
                        userId={person.id}
                        name={person.name}
                        src={person.avatarUrl}
                        size="sm"
                      />
                      <span className="text-sm text-text-1">{person.name}</span>
                    </li>
                  ))}
                </ul>
                <p className="measure-ui text-xs text-text-3">
                  {shipping
                    ? `${names} will see “your note shipped” against this project, and each gets reputation credit for it.`
                    : `${names} will see this reason on the card.`}
                </p>
              </div>
            ) : null}

            <Field
              id="note"
              label={shipping ? 'What changed?' : 'Why not?'}
              hint={
                shipping
                  ? 'One or two sentences. This is the line the reviewers read, so write it to them.'
                  : 'One line is enough. Declining without a reason is what makes people stop reviewing.'
              }
              required
              error={state.fieldErrors?.['note'] ?? state.fieldErrors?.['version']}
            >
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  name="note"
                  prose
                  rows={4}
                  required
                  maxChars={600}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>

            {shipping && versions.length > 0 ? (
              <Field
                id="version"
                label="Which build it shipped in"
                optional
                hint="Linking a build is what makes follow-through auditable rather than claimable."
              >
                {({ id, describedBy }) => (
                  <Select
                    id={id}
                    name="version"
                    aria-describedby={describedBy}
                    placeholderOption="No build linked"
                    options={versions.map((version) => ({
                      value: version.id,
                      label: version.label,
                    }))}
                  />
                )}
              </Field>
            ) : null}

            <div className="flex flex-wrap items-center gap-md">
              {state.status === 'success' ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    onOpenChange(false)
                  }}
                >
                  Back to the tracker
                </Button>
              ) : (
                <>
                  <SubmitButton
                    variant={shipping ? 'primary' : 'danger'}
                    pendingLabel={shipping ? 'Shipping it and telling them…' : 'Declining it…'}
                    iconLeading={
                      shipping ? (
                        <Package size={20} strokeWidth={1.5} />
                      ) : (
                        <X size={20} strokeWidth={1.5} />
                      )
                    }
                  >
                    {shipping ? 'Ship it and tell them' : 'Decline and tell them'}
                  </SubmitButton>
                  <Button
                    onClick={() => {
                      onOpenChange(false)
                    }}
                  >
                    {shipping ? 'Not yet' : 'Keep it open'}
                  </Button>
                </>
              )}
            </div>
          </>
        )}
      </Form>
    </Dialog>
  )
}

export default StatusDialog
