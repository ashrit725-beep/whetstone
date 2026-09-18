'use client'

/**
 * The four writing steps of the project wizard.
 *
 * Keyboard contract: every step is one ordinary form. Tab follows the visual
 * order, the submit is never disabled at idle, and a failed submit renders the
 * error summary, which takes focus once and links to each bad field. Nothing
 * here traps focus or handles a key of its own.
 *
 * Redundant entry (SC 3.3.7): every field is prefilled from the draft row the
 * previous step wrote, so moving backwards and forwards never re-asks for a
 * value the creator has already given. The AI suggestion is offered behind an
 * explicit button and writes nothing on its own; the creator types over it.
 */

import { useState, useTransition } from 'react'
import { Lightbulb } from 'lucide-react'
import {
  Checkbox,
  Field,
  Form,
  GritScale,
  Input,
  Select,
  SubmitButton,
  Textarea,
  type FormAction,
  type GritValue,
} from '@/components/ui'
import { suggestAsk, type IntakeSuggestionResult } from '@/server/actions/project'
import { ProjectStyles } from '../styles'

export interface StepChrome {
  type: string
  draftId: string
  /** Where publishing should land, carried from step to step. See `./then`. */
  then: string | null
}

/** The fields every step posts back, so the next address can be built from them. */
function Carried({ type, draftId, then }: StepChrome) {
  return (
    <>
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="draft" value={draftId} />
      {then ? <input type="hidden" name="then" value={then} /> : null}
    </>
  )
}

/* ---------------------------------------------------------------- basics -- */

export interface BasicsStepProps extends StepChrome {
  action: FormAction
  defaults: { title: string; tagline: string; summary: string; grit: GritValue | null }
}

export function BasicsStep({ type, draftId, then, action, defaults }: BasicsStepProps) {
  const [grit, setGrit] = useState<GritValue | null>(defaults.grit)

  return (
    <Form action={action} summaryTitle="This step was not saved.">
      {({ state }) => (
        <div className="flex flex-col gap-6">
          <ProjectStyles />
          <Carried type={type} draftId={draftId} then={then} />

          <Field
            id="title"
            label="What it is called"
            error={state.fieldErrors?.['title'] ?? null}
            hint="The name you use for it yourself."
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name={id}
                defaultValue={defaults.title}
                autoComplete="off"
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Field
            id="tagline"
            label="One line about it"
            optional
            error={state.fieldErrors?.['tagline'] ?? null}
            hint="Read on the Discover row, under the name."
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name={id}
                defaultValue={defaults.tagline}
                autoComplete="off"
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Field
            id="summary"
            label="What it does, and who it is for"
            error={state.fieldErrors?.['summary'] ?? null}
            hint="Reviewers decide from this whether they are the right person to help you. Eighty characters is the floor."
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                name={id}
                prose
                rows={5}
                maxChars={2000}
                defaultValue={defaults.summary}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
            <legend className="mb-1 flex flex-col gap-1 p-0">
              <span className="text-md text-ink">How finished is it, honestly?</span>
              <span className="measure-ui block text-xs text-ink-3">
                This is the filter reviewers use most. Overstating it gets you notes about polish when you needed
                notes about the idea.
              </span>
            </legend>
            <GritScale
              name="grit"
              value={grit}
              onChange={setGrit}
              label="The stage this build is actually at, from 120 concept to 8000 shipped"
            />
            {state.fieldErrors?.['grit'] ? (
              <p className="measure-ui text-xs text-critical">{state.fieldErrors['grit']}</p>
            ) : null}
          </fieldset>

          <SubmitButton variant="primary" pendingLabel="Saving…">
            Save and write the ask
          </SubmitButton>
        </div>
      )}
    </Form>
  )
}

/* ------------------------------------------------------------------- ask -- */

export interface AskStepProps extends StepChrome {
  action: FormAction
  categories: readonly { key: string; label: string }[]
  prompts: readonly string[]
  defaults: { ask: string; ignore: string; category: string }
  /** Passed to the intake assistant when the creator asks for a suggestion. */
  summary: string
}

export function AskStep({ type, draftId, then, action, categories, prompts, defaults, summary }: AskStepProps) {
  const [suggestion, setSuggestion] = useState<IntakeSuggestionResult | null>(null)
  const [suggestionFailed, setSuggestionFailed] = useState(false)
  const [pending, startTransition] = useTransition()
  const [ask, setAsk] = useState(defaults.ask)

  return (
    <Form action={action} summaryTitle="This step was not saved.">
      {({ state }) => (
        <div className="flex flex-col gap-6">
          <ProjectStyles />
          <Carried type={type} draftId={draftId} then={then} />

          <Field
            id="ask"
            label="The one question you most want answered"
            error={state.fieldErrors?.['ask'] ?? null}
            hint="A specific ask gets replies faster than asking for thoughts. Name the decision you are stuck on."
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                name={id}
                prose
                rows={4}
                maxChars={600}
                value={ask}
                onChange={(event) => {
                  setAsk(event.target.value)
                }}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <div className="flex flex-col gap-2" aria-live="polite">
            <button
              type="button"
              className="ws-scaffold w-fit gap-1 text-sm"
              onClick={() => {
                startTransition(async () => {
                  // Optional help: a failed request leaves the step as it was
                  // rather than reaching the error boundary with the ask typed.
                  try {
                    setSuggestion(await suggestAsk(summary, ''))
                    setSuggestionFailed(false)
                  } catch {
                    setSuggestion(null)
                    setSuggestionFailed(true)
                  }
                })
              }}
            >
              <Lightbulb size={16} strokeWidth={1.5} aria-hidden="true" />
              {pending ? 'Reading your summary…' : 'Sharpen this from my summary'}
            </button>

            {suggestion ? (
              <div className="flex flex-col gap-2 border-l-2 border-rule pl-3">
                <p className="voice text-ink">{suggestion.askBody}</p>
                {suggestion.ignoreList.length > 0 ? (
                  <p className="measure-ui text-xs text-ink-3">
                    {`It also suggests telling reviewers not to spend time on ${suggestion.ignoreList.join(', ')}.`}
                  </p>
                ) : null}
                <button
                  type="button"
                  className="ws-scaffold w-fit text-xs"
                  onClick={() => {
                    setAsk(suggestion.askBody)
                  }}
                >
                  Use this wording
                </button>
                {/* Provenance in the product's words: "Suggested from your
                    description" or "Suggested by a model". How the server is
                    configured is not something a creator can act on. */}
                <p className="text-2xs text-ink-3">{suggestion.label}</p>
              </div>
            ) : suggestionFailed ? (
              <p className="measure-ui text-xs text-ink-3">
                No suggestion came back this time. Try again in a moment, or write the question as you would ask it.
              </p>
            ) : null}
          </div>

          <Field
            id="askCategory"
            label="The area it is about"
            optional
            error={state.fieldErrors?.['askCategory'] ?? null}
            hint="Reviewers who follow this area see the project sooner."
          >
            {({ id, describedBy, invalid }) => (
              <Select
                id={id}
                name={id}
                defaultValue={defaults.category}
                placeholderOption="No particular area"
                options={categories.map((c) => ({ value: c.key, label: c.label }))}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Field
            id="ignore"
            label="What not to spend time on"
            optional
            error={state.fieldErrors?.['ignore'] ?? null}
            hint="Saying what is already known to be broken saves every reviewer the same note."
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                name={id}
                prose
                rows={3}
                maxChars={400}
                defaultValue={defaults.ignore}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          {prompts.length > 0 ? (
            <section aria-labelledby="prompts-heading" className="flex flex-col gap-1">
              <h3 id="prompts-heading" className="text-sm text-ink">
                What reviewers are asked about this kind of project
              </h3>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {prompts.slice(0, 3).map((prompt) => (
                  <li key={prompt} className="measure-ui text-xs text-ink-3">
                    {prompt}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <SubmitButton variant="primary" pendingLabel="Saving…">
            Save and pick what would help
          </SubmitButton>
        </div>
      )}
    </Form>
  )
}

/* ----------------------------------------------------------------- needs -- */

export interface NeedsStepProps extends StepChrome {
  action: FormAction
  needs: readonly { key: string; label: string; description: string }[]
  defaults: { selected: readonly string[]; tags: string }
}

export function NeedsStep({ type, draftId, then, action, needs, defaults }: NeedsStepProps) {
  return (
    <Form action={action} summaryTitle="This step was not saved.">
      {({ state }) => (
        <div className="flex flex-col gap-6">
          <ProjectStyles />
          <Carried type={type} draftId={draftId} then={then} />

          <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
            <legend className="mb-1 flex flex-col gap-1 p-0">
              <span className="text-md text-ink">What kind of help would move this forward?</span>
              <span className="measure-ui block text-xs text-ink-3">
                Reviewers filter the feed by these, so pick the ones you would actually act on.
              </span>
            </legend>
            {/* Keyed by the checkboxes' shared name, so the error summary's link
                lands on the first of them. */}
            {state.fieldErrors?.['need'] ? (
              <p className="measure-ui text-xs text-critical">{state.fieldErrors['need']}</p>
            ) : null}
            <div className="flex flex-col gap-2">
              {needs.map((need) => (
                <Checkbox
                  key={need.key}
                  id={`need-${need.key}`}
                  name="need"
                  value={need.key}
                  defaultChecked={defaults.selected.includes(need.key)}
                  label={need.label}
                  description={need.description}
                />
              ))}
            </div>
          </fieldset>

          <Field
            id="tags"
            label="Tags"
            optional
            error={state.fieldErrors?.['tags'] ?? null}
            hint="Up to eight, comma separated. Reviewers follow tags, and a tag is how a stranger with the right expertise finds you."
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name={id}
                defaultValue={defaults.tags}
                autoComplete="off"
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <SubmitButton variant="primary" pendingLabel="Saving…">
            Save and add the build
          </SubmitButton>
        </div>
      )}
    </Form>
  )
}

/* ----------------------------------------------------------------- build -- */

export interface BuildStepProps extends StepChrome {
  action: FormAction
  defaults: { versionLabel: string; buildUrl: string; changelog: string }
}

export function BuildStep({ type, draftId, then, action, defaults }: BuildStepProps) {
  return (
    <Form action={action} summaryTitle="This step was not saved.">
      {({ state }) => (
        <div className="flex flex-col gap-6">
          <ProjectStyles />
          <Carried type={type} draftId={draftId} then={then} />

          <Field
            id="versionLabel"
            label="What this build is called"
            error={state.fieldErrors?.['versionLabel'] ?? null}
            hint="Reviewers cite it when they report, so a note can always be traced to a version."
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name={id}
                defaultValue={defaults.versionLabel}
                autoComplete="off"
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Field
            id="buildUrl"
            label="Where a reviewer gets it"
            optional
            error={state.fieldErrors?.['buildUrl'] ?? null}
            hint="A full address, starting with https. A project with no way in collects opinions about the summary."
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name={id}
                type="url"
                inputMode="url"
                defaultValue={defaults.buildUrl}
                autoComplete="off"
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <Field
            id="changelog"
            label="What is new in it"
            optional
            error={state.fieldErrors?.['changelog'] ?? null}
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                name={id}
                prose
                rows={4}
                maxChars={2000}
                defaultValue={defaults.changelog}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <SubmitButton variant="primary" pendingLabel="Saving…">
            Save and check it over
          </SubmitButton>
        </div>
      )}
    </Form>
  )
}

/* ---------------------------------------------------------------- publish -- */

export function PublishForm({ draftId, then, action }: { draftId: string; then: string | null; action: FormAction }) {
  return (
    <Form action={action} summaryTitle="This project was not published.">
      {() => (
        <div className="flex flex-col gap-3">
          <ProjectStyles />
          <input type="hidden" name="draft" value={draftId} />
          {then ? <input type="hidden" name="then" value={then} /> : null}
          <SubmitButton variant="primary" pendingLabel="Publishing…">
            Publish it and open for feedback
          </SubmitButton>
          <p className="measure-ui text-xs text-ink-3">
            Publishing puts it in Discover and lets anyone review it. You can close feedback at any time, and the
            reviews you already have stay.
          </p>
        </div>
      )}
    </Form>
  )
}
