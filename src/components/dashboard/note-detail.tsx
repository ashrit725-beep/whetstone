/**
 * One note, opened from the inbox table, the bell or the dashboard register.
 *
 * It lives at `?note=<id>`, so the open note is part of the URL: linkable,
 * back-button correct and server-rendered. It renders above the table rather
 * than after it: below a fifty-row table it landed some 3,000px down the page,
 * out of sight of anyone arriving from a notification, and the table streaming
 * in above it moved it again. The row it came from carries `aria-current` and
 * the accent grind-mark, which is the one accent-marked element in this view
 * (§2.4.7).
 *
 * The reviewer’s words are Literata, rendered through the `Prose` primitive, so
 * a pasted `<script>` arrives as characters and never as markup. Everything the
 * machine wrote around them is Archivo. A serif paragraph in this product means
 * a person wrote it.
 */

import { ANCHOR_WORDS } from '@/server/queries/project-surface'
import { Link as UiLink, Prose, Timestamp } from '@/components/ui'
import type { FeedbackView } from '@/lib/types'
import { NoteActions } from './note-actions'
import { SeverityChip } from './severity-chip'
import { RevealNote } from './reveal-note'

export interface NoteDetailProps {
  note: FeedbackView
  /** Where the close control goes: the same list, without `?note`. */
  closeHref: string
}

export function NoteDetail({ note, closeHref }: NoteDetailProps) {
  return (
    <section
      id="open-note"
      tabIndex={-1}
      aria-labelledby="open-note-heading"
      className="flex flex-col gap-md border-y border-border-hair py-lg"
      style={{ scrollMarginBlockStart: 'var(--spacing-xl)' }}
    >
      <RevealNote targetId="open-note" focusId="open-note-heading" noteId={note.id} />
      <div className="flex flex-wrap items-start justify-between gap-sm">
        <div className="flex min-w-0 flex-col gap-2xs">
          <h2 id="open-note-heading" tabIndex={-1}>
            {`Note from ${note.reviewer.displayName}`}
          </h2>
          <p className="text-sm text-text-2">
            {note.reviewer.tierLabel}
            {note.reviewer.isExpert ? ', expert' : ''}
            {`, on ${note.projectTitle}`}
          </p>
        </div>
        {/* Standalone, so the control that dismisses the open note carries a
            44px hit area rather than a 17px line box (§0.11). */}
        <UiLink href={closeHref} variant="standalone" className="shrink-0 text-sm">
          Close this note
        </UiLink>
      </div>

      <dl className="m-0 flex flex-wrap items-baseline gap-lg">
        <div className="flex items-baseline gap-2xs">
          <dt className="text-xs text-text-3">Received</dt>
          <dd className="m-0 text-sm text-text-1">
            <Timestamp ts={note.submittedAt ?? note.firstReplyAt ?? 0} />
          </dd>
        </div>
        <div className="flex items-baseline gap-2xs">
          <dt className="text-xs text-text-3">Points in this note</dt>
          <dd className="tnum m-0 text-sm text-text-1">{note.counts.points}</dd>
        </div>
        <div className="flex items-baseline gap-2xs">
          <dt className="text-xs text-text-3">Specificity</dt>
          <dd className="tnum m-0 text-sm text-text-1">
            {note.specificity.toFixed(2)}
            <span className="text-text-3">{note.isQualified ? ', qualified' : ', thin'}</span>
          </dd>
        </div>
        {note.versionLabel ? (
          <div className="flex items-baseline gap-2xs">
            <dt className="text-xs text-text-3">Build</dt>
            <dd className="m-0 text-sm text-text-1">{note.versionLabel}</dd>
          </div>
        ) : null}
        <div className="flex items-baseline gap-2xs">
          <dt className="text-xs text-text-3">Reply</dt>
          <dd className="m-0 text-sm text-text-1">
            {note.responseState === 'unanswered'
              ? 'Not answered yet'
              : note.responseState === 'replied'
                ? 'Answered'
                : 'Resolved'}
          </dd>
        </div>
      </dl>

      {note.headline ? <p className="measure-ui text-md text-text-1">{note.headline}</p> : null}
      {note.summaryMd ? <Prose content={note.summaryMd} allow="comment" /> : null}

      <ol className="m-0 flex list-none flex-col p-0">
        {note.points.map((point) => (
          <li
            key={point.id}
            className="flex flex-col gap-xs border-t border-border-hair py-md first:border-t-0"
          >
            <div className="flex flex-wrap items-center gap-xs">
              <SeverityChip severity={point.severity} label={point.severityLabel} />
              <span className="text-xs text-text-3">{point.categoryLabel}</span>
              <span className="text-xs text-text-3">{point.actionabilityLabel}</span>
              {point.anchor ? (
                <span className="text-xs text-text-3">
                  <span>{`${ANCHOR_WORDS[point.anchor.kind] ?? 'In the work'}: `}</span>
                  <span className="tnum">{point.anchor.value}</span>
                </span>
              ) : null}
              {point.upvoteCount > 0 ? (
                <span className="text-xs text-text-3">
                  <span className="tnum">{point.upvoteCount.toLocaleString('en')}</span>
                  <span>{point.upvoteCount === 1 ? ' person hit this too' : ' people hit this too'}</span>
                </span>
              ) : null}
            </div>

            <Prose content={point.bodyMd} allow="comment" />

            {point.reproSteps ? (
              <details className="text-sm text-text-2">
                <summary className="cursor-pointer text-sm text-text-1">Steps to reproduce</summary>
                <Prose content={point.reproSteps} allow="comment" />
              </details>
            ) : null}
          </li>
        ))}
      </ol>

      {note.ratings.length > 0 ? (
        <div className="flex flex-col gap-xs border-t border-border-hair pt-md">
          <h3 className="text-md text-text-1">How this reviewer rated the build</h3>
          <dl className="m-0 flex flex-wrap gap-lg">
            {note.ratings.map((rating) => (
              <div key={rating.axisId} className="flex items-baseline gap-2xs">
                <dt className="text-xs text-text-3">{rating.label}</dt>
                <dd className="tnum m-0 text-sm text-text-1">
                  {rating.value}
                  <span className="text-text-3">{` of ${String(rating.scaleMax)}`}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-md border-t border-border-hair pt-md">
        <NoteActions
          feedbackId={note.id}
          state={note.inboxState}
          helpfulMarked={note.creatorMarkedHelpful}
          reviewerName={note.reviewer.displayName}
        />
      </div>
    </section>
  )
}

export default NoteDetail
