'use client'

/**
 * The feedback thread, and the composer that posts into it.
 *
 * Keyboard contract: the sort control is a strip of real links, so the browser
 * owns its behaviour and every sorted view is addressable. “Give feedback” is a
 * real link to /p/<slug>/feedback; the click handler that opens the dialog
 * instead is skipped for middle-click, cmd-click and any modifier, so the
 * composer can always be opened in a new tab.
 *
 * Why this is one island: the composer and the thread share the optimistic
 * list. A posted review appears in the thread in the same commit as the
 * request, and is replaced by the server row on revalidation. The row is keyed
 * on a stable id so it never animates twice.
 */

import { useOptimistic, useState } from 'react'
import Link from 'next/link'
import type { FormAction } from '@/components/ui'
import { ComposerDialog } from '@/components/composer/composer-dialog'
import type { ComposerData, OptimisticNote } from '@/components/composer/types'
import { AnimatedList } from '@/components/motion'
import { FeedbackNote } from './feedback-note'
import { plural } from './paper'
import { THREAD_SORTS, type ThreadNote, type ThreadSort } from './thread-types'

export interface FeedbackThreadProps {
  slug: string
  notes: readonly ThreadNote[]
  sort: ThreadSort
  totalCount: number
  viewerIsCreator: boolean
  viewerSignedIn: boolean
  viewerHasReviewed: boolean
  currentVersionId: string | null
  /**
   * Absent when the viewer cannot review: signed out, their own project, or a
   * project the composer's gate turns them away from (closed, or invite-only).
   */
  composer: ComposerData | null
  composerAction: FormAction
  voteAction: (formData: FormData) => void | Promise<void>
  pointVoteAction: (formData: FormData) => void | Promise<void>
  replyAction: FormAction
  shipAction: FormAction
  /** Rendered when the thread is empty: the creator's ask, quoted. */
  askPrompt: string | null
  /** Notes with at least one point behind a change that went out. */
  shippedNoteCount: number
  /** False while the page is showing only the top of the thread. */
  showingAll: boolean
  /** Set when the thread is narrowed to the notes written against one build. */
  build: { id: string; label: string } | null
}

export function FeedbackThread({
  slug,
  notes,
  sort,
  totalCount,
  viewerIsCreator,
  viewerSignedIn,
  viewerHasReviewed,
  currentVersionId,
  composer,
  composerAction,
  voteAction,
  pointVoteAction,
  replyAction,
  shipAction,
  askPrompt,
  shippedNoteCount,
  showingAll,
  build,
}: FeedbackThreadProps) {
  const [open, setOpen] = useState(false)
  // Every link in the thread keeps the reader's other choices: re-sorting does
  // not drop the build they narrowed to, and widening the build keeps the sort.
  const threadHref = (next: { sort?: ThreadSort; all?: boolean; build?: string | null }) => {
    const query = new URLSearchParams({ sort: next.sort ?? sort })
    if (next.all ?? showingAll) query.set('notes', 'all')
    const buildId = next.build === undefined ? build?.id : next.build
    if (buildId) query.set('build', buildId)
    return `/p/${slug}?${query.toString()}#thread`
  }
  const [shown, addOptimistic] = useOptimistic(
    notes,
    (current: readonly ThreadNote[], posted: readonly OptimisticNote[]): readonly ThreadNote[] => [
      {
        id: 'pending-review',
        reviewerName: 'You',
        reviewerHandle: 'you',
        reviewerAvatarUrl: null,
        reviewerIsExpert: false,
        reviewerTierLabel: 'Posting now',
        reviewerScore: 0,
        headline: null,
        submittedAt: null,
        versionLabel: null,
        isQualified: true,
        responseState: 'unanswered',
        creatorMarkedHelpful: false,
        helpfulCount: 0,
        viewerVote: 0,
        points: posted.map((note) => ({
          id: `pending-${note.axisKey}`,
          bodyMd: note.body,
          severityKey: 'minor',
          severityLabel: 'Posting',
          actionabilityLabel: 'Observation',
          categoryLabel: note.axisLabel,
          upvoteCount: 0,
          viewerUpvoted: false,
          isResolved: false,
          anchorLabel: null,
          shippedInVersion: null,
        })),
        replies: [],
        pending: true,
      },
      ...current,
    ],
  )

  return (
    <section id="thread" aria-labelledby="thread-heading" className="flex scroll-mt-24 flex-col gap-8">
      <div className="grid gap-x-16 gap-y-4 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
        <div>
          <span className="eyebrow text-ink-3">
            {build
              ? `${String(totalCount)} ${plural(totalCount, 'note', 'notes')} against ${build.label}`
              : `${String(totalCount)} ${plural(totalCount, 'note', 'notes')}${
                  shippedNoteCount > 0 ? ` · ${String(shippedNoteCount)} led to a shipped change` : ''
                }`}
          </span>
          <h2 id="thread-heading" className="mt-3 text-lg lg:text-xl">
            What people actually wrote.
          </h2>
        </div>
        <p className="voice text-base">
          Every note carries who wrote it, from what standing, when, against which build and what the
          creator did about it. Provenance is the difference between feedback and comments.
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        {composer && !viewerHasReviewed ? (
          <Link
            href={`/p/${slug}/feedback`}
            className="btn"
            onClick={(event) => {
              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
              event.preventDefault()
              setOpen(true)
            }}
          >
            Write a note
          </Link>
        ) : (
          <span />
        )}

        {shown.length > 1 ? (
          <nav aria-label="Sort the feedback">
            <ul className="m-0 flex list-none flex-wrap items-center gap-4 p-0">
              {THREAD_SORTS.map((option) => (
                <li key={option.key}>
                  <Link
                    href={threadHref({ sort: option.key })}
                    scroll={false}
                    aria-current={option.key === sort ? 'true' : undefined}
                    className="ws-area-link"
                  >
                    {option.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}
      </div>

      {build ? (
        <div className="flex flex-wrap items-center justify-between gap-x-6 border-y border-rule">
          <p className="py-3 text-sm text-ink-2">
            Only the notes written against <span className="font-bold text-ink">{build.label}</span>
          </p>
          <Link href={threadHref({ build: null })} scroll={false} className="ws-area-link">
            Show every build
          </Link>
        </div>
      ) : null}

      {composer && !viewerHasReviewed ? (
        <ComposerDialog
          data={composer}
          action={composerAction}
          open={open}
          onOpenChange={setOpen}
          onOptimistic={addOptimistic}
        />
      ) : null}

      {shown.length === 0 && build ? (
        <p className="voice text-base">
          {`Nobody has written a note against ${build.label} yet.`}
        </p>
      ) : shown.length === 0 ? (
        <div className="marked bg-paper-hi py-8 pl-6 pr-6">
          <h3 className="text-md">
            {viewerIsCreator ? 'No feedback yet on this build' : 'Nobody has written a note yet'}
          </h3>
          <p className="voice mt-3 text-base">
            {askPrompt
              ? viewerIsCreator
                ? `Nobody has answered “${askPrompt}” yet. A project with a specific ask and a working build gets replies fastest, so check the link still opens.`
                : viewerSignedIn && !composer
                  ? `The creator asked: “${askPrompt}” Nobody has answered it yet.`
                  : `The creator asked: “${askPrompt}” Nobody has answered it, so yours is the note they act on.`
              : viewerIsCreator
                ? 'Nobody has reviewed this build yet. A project with a specific ask gets replies faster than one asking for thoughts.'
                : viewerSignedIn && !composer
                  ? 'Nobody has reviewed this build yet.'
                  : 'Nobody has reviewed this build yet, so yours is the note the creator acts on.'}
          </p>
          {/* A signed-in reader with no composer is one the composer turns away
              (feedback closed, or invited reviewers only), and the header says
              why. Offering them a sign-in or a form here would contradict it. */}
          {viewerSignedIn && !viewerIsCreator && !composer ? null : (
            <p className="mt-6">
              <Link
                href={
                  viewerIsCreator
                    ? `/p/${slug}/versions`
                    : composer
                      ? `/p/${slug}/feedback`
                      : `/sign-in?next=/p/${slug}/feedback`
                }
                className="btn"
              >
                {viewerIsCreator
                  ? 'Post a new build'
                  : composer
                    ? 'Write the first note'
                    : 'Sign in to review'}
              </Link>
            </p>
          )}
        </div>
      ) : (
        /* A note that lands while you are reading should say so. Only the tail
           beyond what was already on screen animates, so re-sorting or
           filtering the thread does not replay the entrance for everything. */
        <AnimatedList
          as="ul"
          className="m-0 list-none gap-8 p-0"
          announce={(n) => `${n} new ${n === 1 ? 'note' : 'notes'} on this project.`}
          // Only a note being posted from this page is news. "Show all" and a
          // re-sort also add keys, and the server copy of a just-posted note
          // replaces the optimistic one under its real id; none of those should
          // animate or be announced.
          isArrival={(key) => key.startsWith('pending-')}
        >
          {shown.map((note, i) => (
            <FeedbackNote
              key={note.id}
              note={note}
              ordinal={i + 1}
              slug={slug}
              viewerIsCreator={viewerIsCreator}
              viewerSignedIn={viewerSignedIn}
              currentVersionId={currentVersionId}
              voteAction={voteAction}
              pointVoteAction={pointVoteAction}
              replyAction={replyAction}
              shipAction={shipAction}
            />
          ))}
        </AnimatedList>
      )}

      {!showingAll && totalCount > shown.length ? (
        <p className="border-t border-rule pt-6">
          <Link href={threadHref({ all: true })} className="btn btn-secondary">
            {`Read all ${String(totalCount)} notes`}
          </Link>
        </p>
      ) : null}

      {showingAll && totalCount > shown.length ? (
        <p className="border-t border-rule pt-6 text-sm text-ink-3">
          {`Showing the first ${String(shown.length)} of ${String(totalCount)} notes. `}
          {`Sort by ${sort === 'newest' ? 'most helpful' : 'newest'} to read from the other end.`}
        </p>
      ) : null}
    </section>
  )
}

export default FeedbackThread
