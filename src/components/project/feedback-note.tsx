'use client'

/**
 * One review in the thread: who wrote it, from what standing, when, against
 * which build, what they actually said, and what the creator did about it.
 *
 * The anatomy is the point. Every note carries its provenance on its face as a
 * `<dl>` strip: category, severity, where in the work, and status. A reader who
 * cannot tell a stranger's throwaway from an expert's repro is reading noise.
 *
 * One containment level. The note is the bordered object, so nothing inside it
 * has a border of its own; points are separated by hairlines and the creator's
 * reply hangs off a single 2px rule. No card inside a card, no shadow anywhere.
 *
 * Keyboard contract: everything is a real button, link or disclosure in
 * document order. The “this shipped” panel is a native `<details>`, so Enter
 * and Space open it and Tab walks the form inside. Nothing traps focus.
 */

import { useOptimistic, useState } from 'react'
import {
  Field,
  Form,
  Prose,
  SubmitButton,
  Textarea,
  Timestamp,
  type FormAction,
} from '@/components/ui'
import { Initials, plural } from './paper'
import type { ThreadNote, ThreadPoint } from './thread-types'

export interface FeedbackNoteProps {
  note: ThreadNote
  ordinal: number
  slug: string
  viewerIsCreator: boolean
  viewerSignedIn: boolean
  currentVersionId: string | null
  voteAction: (formData: FormData) => void | Promise<void>
  pointVoteAction: (formData: FormData) => void | Promise<void>
  replyAction: FormAction
  shipAction: FormAction
}

/** Severity is never carried by colour: the chip fills in, and it says the word. */
const SEVERITY_SOLID = new Set(['blocker', 'major'])

export function FeedbackNote({
  note,
  ordinal,
  slug,
  viewerIsCreator,
  viewerSignedIn,
  currentVersionId,
  voteAction,
  pointVoteAction,
  replyAction,
  shipAction,
}: FeedbackNoteProps) {
  const [replying, setReplying] = useState(false)
  const shipped = note.points.find((p) => p.shippedInVersion !== null)

  // An <article>, not an <li>: `AnimatedList` already wraps each child in a
  // list item, so rendering one here produced `li > li`, which is invalid and
  // makes a screen reader announce twice as many notes as there are.
  return (
    <article
      id={`note-${note.id}`}
      data-fresh={note.pending ? 'true' : undefined}
      // Notifications and "See your review" land here by fragment; the margin
      // keeps the reviewer's name clear of the sticky navigation.
      className="ws-note scroll-mt-24 border-[1.5px] border-ink bg-paper-hi"
      aria-busy={note.pending ? true : undefined}
    >
      {/* who */}
      <div className="flex flex-wrap items-start gap-4 border-b border-rule p-6">
        <Initials name={note.reviewerName} src={note.reviewerAvatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-md font-bold text-ink">{note.reviewerName}</span>
            {note.reviewerIsExpert ? (
              <span className="chip" data-solid="true">
                Verified expert
              </span>
            ) : (
              <span className="chip">{note.reviewerTierLabel}</span>
            )}
          </p>
          <p className="mt-1 text-xs text-ink-3">
            {note.submittedAt ? (
              <>
                Reviewed <Timestamp ts={note.submittedAt} />
              </>
            ) : (
              'Posting now'
            )}
            {' · '}
            <span className="tnum">{note.reviewerScore}</span> credibility
            {/* What is measured is specificity, not length, and it only
                changes anything for the creator reading their own thread. */}
            {viewerIsCreator && !note.isQualified ? ' · below the specificity floor, not scored' : null}
          </p>
        </div>
        <span className="eyebrow shrink-0 text-ink-3">
          {`No. ${String(ordinal).padStart(2, '0')}`}
        </span>
      </div>

      {/* the unanchored first impression, when there is one */}
      {note.headline ? (
        <div className="border-b border-rule px-6 py-6">
          <span className="eyebrow text-ink-3">First impression, before they read the thread</span>
          <p className="voice mt-2 text-md text-ink">{note.headline}</p>
        </div>
      ) : null}

      {/* the notes themselves, each with its own provenance */}
      {note.points.length > 0 ? (
        <ul className="m-0 flex list-none flex-col p-0">
          {note.points.map((point, i) => (
            <li key={point.id} className={i > 0 ? 'border-t border-rule' : ''}>
              <dl className="m-0 grid grid-cols-2 border-b border-rule sm:grid-cols-4">
                <Fact label="Category" value={point.categoryLabel} />
                <Fact
                  label="Severity"
                  value={
                    <span className="chip" data-solid={SEVERITY_SOLID.has(point.severityKey) ? 'true' : undefined}>
                      {point.severityLabel}
                    </span>
                  }
                />
                <Fact
                  label={point.anchorLabel ? 'Where' : 'Kind'}
                  value={point.anchorLabel ?? point.actionabilityLabel}
                />
                <Fact
                  label="Written against"
                  value={note.versionLabel ?? 'No build named'}
                />
              </dl>

              <div className="px-6 py-6">
                <div className="voice text-md text-ink">
                  <Prose content={point.bodyMd} allow="comment" />
                </div>

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <PointVote point={point} slug={slug} disabled={!viewerSignedIn} action={pointVoteAction} />
                  {/* Praise is a thing to keep, not a change to ship. */}
                  {viewerIsCreator && point.shippedInVersion === null && point.severityKey !== 'praise' ? (
                    <ShipDisclosure
                      point={point}
                      slug={slug}
                      currentVersionId={currentVersionId}
                      action={shipAction}
                    />
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* what the creator said back, attached to the thing it answers */}
      {note.replies.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-6 px-6 pb-8 pt-1 p-0">
          {note.replies.map((reply) => (
            <li key={reply.id} className="border-l-2 border-ink py-1 pl-5">
              <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Initials name={reply.authorName} size="sm" />
                <span className="text-sm font-bold text-ink">{reply.authorName}</span>
                {/* One child, so the eyebrow's flex gap cannot open up between
                    the words, and the date set in the eyebrow's own size. */}
                <span className="eyebrow text-ink-3">
                  <span>
                    {`${reply.isCreator ? 'Creator' : 'Reviewer'} · replied `}
                    <Timestamp ts={reply.createdAt} className="text-[length:inherit] text-inherit" />
                  </span>
                </span>
              </p>
              <div className="voice mt-3 text-base">
                <Prose content={reply.bodyMd} allow="comment" />
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {/* the credit, where a note actually changed the work */}
      {shipped ? (
        <div className="flex flex-wrap items-center justify-between gap-4 border-t-[1.5px] border-ink bg-paper-sub px-6 py-4">
          <span className="chip" data-mark="true">
            <span aria-hidden="true" className="ws-dot" />
            This shipped in {shipped.shippedInVersion}
          </span>
          <span className="text-xs text-ink-3">
            {note.reviewerName} is the reason it changed.
          </span>
        </div>
      ) : null}

      {/* the thread's own controls */}
      <div className="flex flex-wrap items-center gap-3 border-t border-rule px-6 py-4">
        {viewerSignedIn ? (
          <form action={voteAction}>
            <input type="hidden" name="feedbackId" value={note.id} />
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="vote" value={note.viewerVote === 1 ? '0' : '1'} />
            <button type="submit" className="ws-scaffold text-xs" aria-pressed={note.viewerVote === 1}>
              This helped
              <span className="tnum">{note.helpfulCount}</span>
            </button>
          </form>
        ) : (
          <p className="text-xs text-ink-3">
            <span className="tnum">{note.helpfulCount}</span>{' '}
            {plural(note.helpfulCount, 'person found this helpful', 'people found this helpful')}
          </p>
        )}

        {viewerIsCreator ? (
          <button
            type="button"
            className="ws-scaffold text-xs"
            aria-expanded={replying}
            onClick={() => {
              setReplying((r) => !r)
            }}
          >
            {replying ? 'Close the reply' : `Reply to ${note.reviewerName}`}
          </button>
        ) : null}

        {note.responseState === 'unanswered' && !viewerIsCreator ? (
          <span className="text-xs text-ink-3">No reply from the creator yet</span>
        ) : null}
      </div>

      {viewerIsCreator && replying ? (
        <div className="border-t border-rule px-6 py-6">
          <Form action={replyAction} summaryTitle="This reply was not posted.">
            {({ state }) => (
              <div className="flex flex-col gap-4">
                <input type="hidden" name="feedbackId" value={note.id} />
                <input type="hidden" name="slug" value={slug} />
                <Field
                  id={`reply-${note.id}`}
                  label={`Reply to ${note.reviewerName}`}
                  error={state.fieldErrors?.['body'] ?? null}
                >
                  {({ id, describedBy, invalid }) => (
                    <Textarea
                      id={id}
                      name="body"
                      prose
                      rows={3}
                      maxChars={1200}
                      aria-describedby={describedBy}
                      invalid={invalid}
                    />
                  )}
                </Field>
                <SubmitButton variant="primary" pendingLabel="Posting the reply…">
                  Post reply
                </SubmitButton>
              </div>
            )}
          </Form>
        </div>
      ) : null}
    </article>
  )
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-r border-rule px-6 py-3 last:border-r-0">
      <dt className="eyebrow text-ink-3">{label}</dt>
      <dd className="m-0 mt-1 flex items-center gap-2 text-sm font-bold text-ink">{value}</dd>
    </div>
  )
}

function PointVote({
  point,
  slug,
  disabled,
  action,
}: {
  point: ThreadPoint
  slug: string
  disabled: boolean
  action: (formData: FormData) => void | Promise<void>
}) {
  const [count, bump] = useOptimistic(point.upvoteCount, (current: number, delta: number) => current + delta)

  if (disabled) {
    // A signed-out reader gets the count as a sentence rather than a control.
    // "0 reviewers hit this too" is arithmetically true and reads as an error,
    // so nothing says zero out loud.
    return (
      <p className="text-xs text-ink-3">
        {point.upvoteCount === 0 ? (
          'Nobody else has hit this yet'
        ) : (
          <>
            <span className="tnum">{point.upvoteCount}</span>{' '}
            {plural(point.upvoteCount, 'reviewer hit this too', 'reviewers hit this too')}
          </>
        )}
      </p>
    )
  }

  return (
    <form
      action={(formData: FormData) => {
        // A form action is already a transition, so the optimistic bump lands
        // in the same commit as the request.
        bump(point.viewerUpvoted ? -1 : 1)
        return action(formData)
      }}
    >
      <input type="hidden" name="pointId" value={point.id} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="on" value={point.viewerUpvoted ? 'false' : 'true'} />
      <button type="submit" className="ws-scaffold text-xs" aria-pressed={point.viewerUpvoted}>
        I hit this too
        <span className="tnum">{count}</span>
      </button>
    </form>
  )
}

function ShipDisclosure({
  point,
  slug,
  currentVersionId,
  action,
}: {
  point: ThreadPoint
  slug: string
  currentVersionId: string | null
  action: FormAction
}) {
  return (
    <details className="w-full">
      <summary className="ws-scaffold w-fit cursor-pointer text-xs">Mark as shipped</summary>
      <div className="pt-4">
        <Form action={action} summaryTitle="This note was not marked as shipped.">
          {({ state }) => (
            <div className="flex flex-col gap-4">
              <input type="hidden" name="pointId" value={point.id} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="versionId" value={currentVersionId ?? ''} />
              <input type="hidden" name="title" value={point.bodyMd.slice(0, 90)} />
              <Field
                id={`ship-${point.id}`}
                label="What you changed"
                hint="The reviewer sees this sentence, and it is what turns the credit into something they can check."
                error={state.fieldErrors?.['note'] ?? null}
              >
                {({ id, describedBy, invalid }) => (
                  <Textarea
                    id={id}
                    name="note"
                    prose
                    rows={3}
                    maxChars={600}
                    aria-describedby={describedBy}
                    invalid={invalid}
                  />
                )}
              </Field>
              <SubmitButton variant="primary" pendingLabel="Recording it…">
                Tell the reviewer it shipped
              </SubmitButton>
            </div>
          )}
        </Form>
      </div>
    </details>
  )
}

export default FeedbackNote
