'use client'

/**
 * Triage controls for the open note.
 *
 * Two real forms posting to Server Actions, so they work with JavaScript off;
 * `useActionState` is what adds the pending state and the spoken result on top.
 * The current state is not offered as a destination: moving a note to where it
 * already is would be a control that does nothing.
 *
 * Keyboard contract: Tab reaches each control in visual order, Enter or Space
 * submits the one that has focus. The result is written into a polite region
 * beside the buttons rather than a toast, because the change is on screen.
 */

import { Archive, Check, Eye, ThumbsUp } from 'lucide-react'
import { Form, SubmitButton } from '@/components/ui'
import { moveInboxState, toggleHelpful } from '@/server/actions/dashboard'
import type { InboxState } from '@/lib/types'

export interface NoteActionsProps {
  feedbackId: string
  state: InboxState
  helpfulMarked: boolean
  reviewerName: string
}

export function NoteActions({
  feedbackId,
  state,
  helpfulMarked,
  reviewerName,
}: NoteActionsProps) {
  return (
    <div className="flex flex-wrap items-center gap-md">
      <Form action={moveInboxState} showSummary={false} className="flex-row flex-wrap gap-xs">
        {({ state: result }) => (
          <>
            <input type="hidden" name="ids" value={feedbackId} />
            {state !== 'read' ? (
              <SubmitButton
                name="state"
                value="read"
                pendingLabel="Marking it read…"
                iconLeading={<Eye size={20} strokeWidth={1.5} />}
              >
                Mark read
              </SubmitButton>
            ) : null}
            {state !== 'actioned' ? (
              <SubmitButton
                name="state"
                value="actioned"
                pendingLabel="Marking it actioned…"
                iconLeading={<Check size={20} strokeWidth={1.5} />}
              >
                Mark actioned
              </SubmitButton>
            ) : null}
            {state !== 'archived' ? (
              <SubmitButton
                name="state"
                value="archived"
                pendingLabel="Archiving it…"
                iconLeading={<Archive size={20} strokeWidth={1.5} />}
              >
                Archive
              </SubmitButton>
            ) : null}
            <p
              aria-live="polite"
              className="self-center text-xs"
              style={{ minHeight: '1lh' }}
            >
              {result.status === 'error' ? (
                <span className="text-critical">{result.message}</span>
              ) : result.status === 'success' ? (
                <span className="text-positive">{result.message}</span>
              ) : null}
            </p>
          </>
        )}
      </Form>

      <Form action={toggleHelpful} showSummary={false} className="flex-row flex-wrap gap-xs">
        {({ state: result }) => (
          <>
            <input type="hidden" name="feedbackId" value={feedbackId} />
            <input type="hidden" name="helpful" value={helpfulMarked ? 'false' : 'true'} />
            <SubmitButton
              variant={helpfulMarked ? 'secondary' : 'primary'}
              pendingLabel="Telling them…"
              iconLeading={<ThumbsUp size={20} strokeWidth={1.5} />}
            >
              {helpfulMarked ? 'Take the helpful mark back' : `Tell ${reviewerName} it helped`}
            </SubmitButton>
            <p
              aria-live="polite"
              className="self-center text-xs"
              style={{ minHeight: '1lh' }}
            >
              {result.status === 'error' ? (
                <span className="text-critical">{result.message}</span>
              ) : result.status === 'success' ? (
                <span className="text-positive">{result.message}</span>
              ) : null}
            </p>
          </>
        )}
      </Form>
    </div>
  )
}

export default NoteActions
