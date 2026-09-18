'use client'

/**
 * Step one of a review: the blind first impression.
 *
 * Keyboard contract: an ordinary form. Tab reaches the build link, the note and
 * the two actions in that order. Nothing is trapped, nothing auto-focuses, and
 * the skip action is a real submit button in the same tab sequence as the
 * primary one, because a gate a reader cannot open is a paywall.
 *
 * Why it is here: a reviewer who reads the thread first writes the thread back.
 * The unanchored reaction is the part of the data a comment box cannot produce,
 * so it is collected before anything else is visible, and the clock beside it
 * is the same number the dwell floor scores the review on.
 *
 * It only says the notes are hidden when they are. Someone who pressed skip on
 * the project page has read them, so for them this is simply the opening line of
 * the review, and there is nothing left to skip to.
 *
 * Reopened from the step row once it is saved, it comes back with the words and
 * the clock it was saved with, so going back to change a sentence neither
 * empties the box nor restarts the time with the build.
 */

import { useEffect, useState } from 'react'
import { safeHref } from '@/lib/utils'
import { Clock, ExternalLink } from 'lucide-react'
import { Field, Form, SubmitButton, Textarea, type FormAction } from '@/components/ui'
import { ProjectStyles } from '../project/styles'
import type { ComposerProject } from './types'

export interface BlindStepProps {
  project: ComposerProject
  action: FormAction
  /** Posts the "show me the notes anyway" choice. */
  skipAction: (formData: FormData) => void | Promise<void>
  /** Notes already on the project. */
  noteCount: number
  /** True once this reviewer has opened those notes, so none of them is hidden. */
  notesRead: boolean
  /** The impression already saved on this review's draft, when there is one. */
  saved?: { impression: string; seconds: number } | undefined
}

export function BlindStep({ project, action, skipAction, noteCount, notesRead, saved }: BlindStepProps) {
  const hidden = noteCount > 0 && !notesRead
  const [seconds, setSeconds] = useState(saved?.seconds ?? 0)

  useEffect(() => {
    const id = window.setInterval(() => {
      setSeconds((s) => s + 1)
    }, 1000)
    return () => {
      window.clearInterval(id)
    }
  }, [])

  return (
    <div className="ws-composer-scope flex flex-col gap-lg">
      <ProjectStyles />

      <div className="flex flex-col gap-sm">
        <h2 className="text-lg text-ink">
          {saved ? 'Your first impression' : notesRead ? 'What you noticed first' : 'Before you read anyone else'}
        </h2>
        <p className="measure-ui text-sm text-ink-2">
          {saved ? (
            <>
              This opens your review of {project.title}, ahead of the areas. It stays a draft until you post the
              review, so change it while it still says what you noticed first.
            </>
          ) : hidden ? (
            <>
              <span className="tnum">{noteCount}</span>
              {noteCount === 1 ? ' note is' : ' notes are'} already on {project.title}, and they stay hidden until
              you have written this. An impression you formed after reading them is theirs, not yours.
            </>
          ) : noteCount > 0 ? (
            <>
              You have already read the notes on {project.title}. Say what you noticed yourself anyway: it opens your
              review, ahead of the areas.
            </>
          ) : (
            <>
              Nobody has reviewed {project.title} yet, so there is nothing to anchor you. Write what you noticed first,
              then work through the areas.
            </>
          )}
        </p>

        <dl className="m-0 flex flex-wrap items-baseline gap-x-lg gap-y-xs">
          <div className="flex items-center gap-2xs">
            <dt className="text-2xs text-text-3">
              {safeHref(project.buildUrl) ? 'Time with the build' : 'Time on this review'}
            </dt>
            <dd className="tnum m-0 flex items-center gap-2xs text-sm text-text-1">
              <Clock size={16} strokeWidth={1.5} aria-hidden="true" />
              {formatDuration(seconds)}
            </dd>
          </div>
          {project.versionLabel ? (
            <div className="flex items-baseline gap-2xs">
              <dt className="text-2xs text-text-3">Build</dt>
              <dd className="m-0 text-sm text-text-1">{project.versionLabel}</dd>
            </div>
          ) : null}
        </dl>

        {safeHref(project.buildUrl) ? (
          <a
            className="ws-scaffold w-fit gap-2xs text-sm"
            href={safeHref(project.buildUrl) ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={16} strokeWidth={1.5} aria-hidden="true" />
            Open the build
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        ) : null}
      </div>

      <Form action={action} summaryTitle="This step was not saved.">
        {({ state }) => (
          <div className="flex flex-col gap-md">
            <input type="hidden" name="slug" value={project.slug} />
            <input type="hidden" name="seconds" value={seconds} />
            <Field
              id="impression"
              label="What you noticed first"
              hint="Two or three sentences. What you expected, what actually happened, and where you were when it did."
              error={state.fieldErrors?.['impression'] ?? null}
            >
              {({ id, describedBy, invalid }) => (
                <Textarea
                  id={id}
                  name={id}
                  prose
                  rows={5}
                  maxChars={600}
                  defaultValue={saved?.impression}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
            <div className="flex flex-wrap items-center gap-xs">
              <SubmitButton variant="primary" pendingLabel="Saving your impression…">
                Save and open the areas
              </SubmitButton>
            </div>
          </div>
        )}
      </Form>

      {hidden ? (
        <form action={skipAction} className="flex flex-col gap-2xs border-t border-rule pt-md">
          <input type="hidden" name="projectId" value={project.id} />
          <input type="hidden" name="slug" value={project.slug} />
          <button type="submit" className="ws-scaffold w-fit text-sm">
            Skip, and show me the notes
          </button>
          <p className="measure-ui text-xs text-ink-3">
            Skipping is recorded, not punished. Your review still posts and still counts.
          </p>
        </form>
      ) : null}
    </div>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export default BlindStep
