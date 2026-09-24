'use client'

/**
 * The reply tree and every composer in it.
 *
 * Nesting is capped at three visible levels, marked by a 2px hair rule plus
 * indentation so the level survives a 320px reflow (SC 1.4.10). The rule is
 * offset from the parent's own leading edge (`.ws-nest` margin), because that
 * edge belongs to the accepted answer's grind-mark and the two running together
 * turn the identity motif into a stripe. Past three levels the conversation
 * continues flat and each reply says who it answers, which is the one thing
 * indentation was carrying.
 *
 * A posted reply appears immediately through `useOptimistic` and is replaced by
 * the server row when the action settles. Only the optimistic row carries
 * `data-fresh`, so the entrance plays once and the server-rendered tree does not
 * slide in on first paint.
 *
 * Keyboard contract:
 *  · Tab walks each reply in reading order: vote, reply, mark, report.
 *  · The reply disclosure carries `aria-expanded` and `aria-controls`; Cancel
 *    closes it and returns focus to the control that opened it.
 *  · The composer's own contract lives in `markdown-composer.tsx`.
 *  · Nothing here traps focus and nothing opens on hover.
 */

import { useEffect, useOptimistic, useState, type Ref } from 'react'
import { Check, CornerDownRight, MessageSquare } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Form,
  Link,
  Prose,
  SubmitButton,
  Timestamp,
  type FormState,
} from '@/components/ui'
import { cn } from '@/lib/utils'
import type { DiscussionPostView, UserCard } from '@/lib/types'
import { postReplyAction } from '@/server/actions/discussions'
import { AcceptAnswerButton } from './accept-answer-button'
import { MarkdownComposer } from './markdown-composer'
import { ReportDialog } from './report-dialog'
import { VoteControl } from './vote-control'

/** Three visible levels: 0, 1, 2. Past that the thread continues flat. */
const MAX_LEVEL = 2
const DRAFT_PREFIX = 'draft:'

interface ReplyDraft {
  tempId: string
  bodyMd: string
  parentPostId: string | null
  author: UserCard
  createdAt: number
}

function attach(
  posts: readonly DiscussionPostView[],
  parentPostId: string,
  node: DiscussionPostView,
): DiscussionPostView[] {
  return posts.map((post) => {
    if (post.id === parentPostId) return { ...post, children: [...post.children, node] }
    if (post.children.length === 0) return post
    return { ...post, children: attach(post.children, parentPostId, node) }
  })
}

function withDraft(
  posts: readonly DiscussionPostView[],
  draft: ReplyDraft,
): readonly DiscussionPostView[] {
  const node: DiscussionPostView = {
    id: draft.tempId,
    bodyMd: draft.bodyMd,
    author: draft.author,
    depth: 0,
    score: 0,
    isAccepted: false,
    parentPostId: draft.parentPostId,
    editedAt: null,
    createdAt: draft.createdAt,
    viewerVote: 0,
    children: [],
  }
  if (draft.parentPostId === null) return [...posts, node]
  return attach(posts, draft.parentPostId, node)
}

function findAccepted(posts: readonly DiscussionPostView[]): string | null {
  for (const post of posts) {
    if (post.isAccepted) return post.id
    const inChildren = findAccepted(post.children)
    if (inChildren) return inChildren
  }
  return null
}

function countReplies(posts: readonly DiscussionPostView[]): number {
  let total = 0
  for (const post of posts) total += 1 + countReplies(post.children)
  return total
}

/* ------------------------------------------------------------------------- *
 * The composer, used both inline and at the foot of the thread
 * ------------------------------------------------------------------------- */

interface ReplyComposerProps {
  id: string
  threadId: string
  parentPostId: string | null
  label: string
  hint: string
  submitLabel: string
  action: (state: FormState, formData: FormData) => Promise<FormState>
  onCancel?: () => void
  /** Set by the inline composer, which closes itself once the reply is posted. */
  onPosted?: () => void
  textareaRef?: Ref<HTMLTextAreaElement>
}

function ReplyComposer({
  id,
  threadId,
  parentPostId,
  label,
  hint,
  submitLabel,
  action,
  onCancel,
  onPosted,
  textareaRef,
}: ReplyComposerProps) {
  const [value, setValue] = useState('')

  /* The text is cleared optimistically and put back if the post fails, so a
     failed submit never costs the reader what they wrote. */
  const run = async (state: FormState, formData: FormData): Promise<FormState> => {
    const written = String(formData.get('bodyMd') ?? '')
    setValue('')
    const result = await action(state, formData)
    if (result.status === 'error') setValue(written)
    else onPosted?.()
    return result
  }

  return (
    <Form action={run} showSummary={false} className="gap-md">
      {({ state }) => (
        <>
          <input type="hidden" name="threadId" value={threadId} />
          {parentPostId ? (
            <input type="hidden" name="parentPostId" value={parentPostId} />
          ) : null}

          <MarkdownComposer
            id={id}
            name="bodyMd"
            label={label}
            hint={hint}
            value={value}
            onValueChange={setValue}
            error={state.fieldErrors?.['bodyMd'] ?? state.fieldErrors?.['threadId'] ?? null}
            maxChars={8000}
            textareaRef={textareaRef}
            required
          />

          <p aria-live="polite" className="measure-ui text-xs" style={{ minHeight: '1lh' }}>
            {state.status === 'error' && !state.fieldErrors ? (
              <span className="text-critical">{state.message}</span>
            ) : state.status === 'success' ? (
              <span className="text-text-3">
                Posted. Your reply is in the thread above, and everyone following it was told.
              </span>
            ) : null}
          </p>

          {/* Full width at phone size, side by side from 40rem: the same rule
              the bounty composer states, so the three composers agree. */}
          <div className="flex flex-col gap-xs sm:flex-row sm:flex-wrap sm:items-center">
            <SubmitButton variant="primary" pendingLabel="Posting the reply…">
              {submitLabel}
            </SubmitButton>
            {onCancel ? (
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            ) : null}
          </div>
        </>
      )}
    </Form>
  )
}

/* ------------------------------------------------------------------------- *
 * One reply, and the branch under it
 * ------------------------------------------------------------------------- */

interface BranchApi {
  threadId: string
  isQuestion: boolean
  locked: boolean
  signedIn: boolean
  /** Your own replies show their score but cannot be voted on or reported. */
  viewerId: string | null
  viewerIsThreadAuthor: boolean
  /** Replies this reader has an open report against. Their flag says so. */
  reportedPostIds: ReadonlySet<string>
  acceptedPostId: string | null
  openReplyFor: string | null
  openReply: (postId: string) => void
  closeReply: (postId: string) => void
  makeAction: (parentPostId: string | null) => (state: FormState, formData: FormData) => Promise<FormState>
}

interface ReplyBranchProps {
  post: DiscussionPostView
  level: number
  /** Set when the reply has been flattened past level three. */
  replyingTo: string | null
  api: BranchApi
}

function ReplyBranch({ post, level, replyingTo, api }: ReplyBranchProps) {
  const isDraft = post.id.startsWith(DRAFT_PREFIX)
  const ownPost = post.author.id === api.viewerId
  const nested = level < MAX_LEVEL
  const childLevel = nested ? level + 1 : MAX_LEVEL
  const composerOpen = api.openReplyFor === post.id
  const toggleId = `reply-toggle-${post.id}`
  const panelId = `reply-panel-${post.id}`

  return (
    <li className="ws-reply" data-fresh={isDraft ? '' : undefined}>
      <article className={cn('py-md', post.isAccepted && 'marked')}>
        <div className="flex flex-wrap items-center gap-xs">
          <Avatar userId={post.author.id} name={post.author.displayName} src={post.author.avatarUrl} size="sm" />
          <span className="text-sm leading-none text-text-1">{post.author.displayName}</span>
          <Timestamp ts={post.createdAt} prefix="wrote" className="leading-none" />
          {post.editedAt ? <span className="text-xs leading-none text-text-3">Edited</span> : null}
          {post.isAccepted ? (
            <Badge tone="positive" icon={Check}>
              Accepted answer
            </Badge>
          ) : null}
        </div>

        {replyingTo ? (
          <p className="mt-2xs flex items-center gap-2xs text-xs text-text-3">
            <CornerDownRight size={16} strokeWidth={1.5} aria-hidden="true" />
            Replying to {replyingTo}
          </p>
        ) : null}

        <Prose content={post.bodyMd} allow="comment" className="mt-sm" />

        {isDraft ? (
          <p className="mt-sm text-xs text-text-3">Posting…</p>
        ) : (
          /* gap-xs at phone width: a nested reply's row is about 300px, and at
             gap-lg the report flag wrapped onto a line of its own. */
          <div className="mt-sm flex flex-wrap items-center gap-xs sm:gap-lg">
            {api.signedIn && !ownPost ? (
              <VoteControl
                postId={post.id}
                score={post.score}
                viewerVote={post.viewerVote}
                authorName={post.author.displayName}
              />
            ) : (
              /* Without the chevrons either side of it, a bare numeral read as
                 nothing in particular, so the static score says what it counts. */
              <span className="text-xs text-text-3">
                <span className="tnum">{post.score.toLocaleString('en')}</span>
                {Math.abs(post.score) === 1 ? ' vote' : ' votes'}
              </span>
            )}

            {api.signedIn && !api.locked ? (
              <Button
                id={toggleId}
                variant="ghost"
                size="sm"
                aria-expanded={composerOpen}
                aria-controls={panelId}
                onClick={() => {
                  if (composerOpen) api.closeReply(post.id)
                  else api.openReply(post.id)
                }}
                iconLeading={<MessageSquare size={16} strokeWidth={1.5} />}
              >
                Reply
                <span className="sr-only"> to {post.author.displayName}</span>
              </Button>
            ) : null}

            {api.isQuestion && api.viewerIsThreadAuthor && !post.isAccepted ? (
              <AcceptAnswerButton
                threadId={api.threadId}
                postId={post.id}
                authorName={post.author.displayName}
                replacesExisting={api.acceptedPostId !== null}
              />
            ) : null}

            {api.signedIn && !ownPost ? (
              <ReportDialog
                targetType="discussion_post"
                targetId={post.id}
                what={`the reply by ${post.author.displayName}`}
                triggerLabel={`Report the reply by ${post.author.displayName}`}
                alreadyReported={api.reportedPostIds.has(post.id)}
                iconOnly
              />
            ) : null}
          </div>
        )}

        {/* Always rendered so `aria-controls` never points at a missing node.
            No nest rule on it: this is the reader's own composer, not a reply
            that already exists at a level. */}
        <div id={panelId} hidden={!composerOpen} className="mt-md">
          {composerOpen ? (
            <ReplyComposer
              id={`reply-body-${post.id}`}
              threadId={api.threadId}
              parentPostId={post.id}
              label={`Your reply to ${post.author.displayName}`}
              hint="Markdown works here: **bold**, `code`, a line starting with > for a quote, and - for a list."
              submitLabel="Post the reply"
              action={api.makeAction(post.id)}
              onCancel={() => {
                api.closeReply(post.id)
              }}
              /* A posted reply is its own confirmation, and it renders below
                 this panel rather than above it, so the disclosure closes the
                 way Cancel does and focus goes back to the Reply control. */
              onPosted={() => {
                api.closeReply(post.id)
              }}
            />
          ) : null}
        </div>
      </article>

      {post.children.length > 0 ? (
        <ul className={cn('ws-replies', nested && 'ws-nest')}>
          {post.children.map((child) => (
            <ReplyBranch
              key={child.id}
              post={child}
              level={childLevel}
              replyingTo={nested ? null : post.author.displayName}
              api={api}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/* ------------------------------------------------------------------------- *
 * The conversation
 * ------------------------------------------------------------------------- */

export interface ThreadConversationProps {
  threadId: string
  isQuestion: boolean
  locked: boolean
  posts: readonly DiscussionPostView[]
  /** Null for a signed-out reader, who can read and nothing else. */
  viewer: UserCard | null
  viewerIsThreadAuthor: boolean
  /** Ids of the replies this reader already has an open report against. */
  reportedPostIds: ReadonlySet<string>
  /** Where "Sign in" goes, carrying a return path back to this thread. */
  signInHref: string
}

export function ThreadConversation({
  threadId,
  isQuestion,
  locked,
  posts,
  viewer,
  viewerIsThreadAuthor,
  reportedPostIds,
  signInHref,
}: ThreadConversationProps) {
  const [tree, addDraft] = useOptimistic(posts, withDraft)
  const acceptedPostId = findAccepted(posts)
  const [openReplyFor, setOpenReplyFor] = useState<string | null>(null)

  /* Arriving back from "Sign in" to reply. The sign-in form redirects from a
     Server Action and Next drops the fragment from that redirect, so the return
     path carries `?reply` rather than `#reply`. It becomes `#reply` here: the
     composer is brought into view and focused, and the query leaves the
     address so a reload or a shared link does not do it again. The state
     argument is null on purpose: Next's patched replaceState only tells the
     router about the new address when it is not handed the router's own
     state, and a router still holding `?reply` writes it back on its next
     update. */
  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('reply')) return
    url.searchParams.delete('reply')
    url.hash = 'reply'
    window.history.replaceState(null, '', url)
    document.getElementById('reply')?.scrollIntoView({ block: 'start' })
    document.getElementById('thread-reply-body')?.focus({ preventScroll: true })
  }, [])

  const makeAction =
    (parentPostId: string | null) =>
    async (state: FormState, formData: FormData): Promise<FormState> => {
      const written = String(formData.get('bodyMd') ?? '').trim()
      if (viewer && written.length >= 2) {
        addDraft({
          tempId: `${DRAFT_PREFIX}${String(Date.now())}:${String(Math.random()).slice(2)}`,
          bodyMd: written,
          parentPostId,
          author: viewer,
          createdAt: Date.now(),
        })
      }
      return postReplyAction(state, formData)
    }

  const api: BranchApi = {
    threadId,
    isQuestion,
    locked,
    signedIn: viewer !== null,
    viewerId: viewer?.id ?? null,
    viewerIsThreadAuthor,
    reportedPostIds,
    acceptedPostId,
    openReplyFor,
    openReply: (postId) => {
      setOpenReplyFor(postId)
    },
    closeReply: (postId) => {
      setOpenReplyFor(null)
      /* The panel unmounts, so focus goes back to the control that opened it. */
      requestAnimationFrame(() => {
        document.getElementById(`reply-toggle-${postId}`)?.focus()
      })
    },
    makeAction,
  }

  const replyCount = countReplies(tree)

  /* The empty state points at whatever is actually below it: a composer, a
     sign-in line, or the note that the thread is locked. */
  const emptyBody = locked
    ? 'This thread was locked before anyone replied, so the opening post is all there is to read.'
    : viewer
      ? 'A thread with one specific answer gets the next reader further than a thread with none. The composer below is the whole of it.'
      : 'A thread with one specific answer gets the next reader further than a thread with none. Sign in below and the first reply can be yours.'

  return (
    <>
      <section aria-labelledby="replies-heading" className="mt-2xl flex flex-col gap-md">
        <h2 id="replies-heading" className="text-lg">
          {replyCount === 1 ? '1 reply' : `${replyCount.toLocaleString('en')} replies`}
        </h2>

        {tree.length === 0 ? (
          <EmptyState
            title="No replies yet"
            body={emptyBody}
            headingLevel={3}
          />
        ) : (
          <ul className="ws-replies">
            {tree.map((post) => (
              <ReplyBranch key={post.id} post={post} level={0} replyingTo={null} api={api} />
            ))}
          </ul>
        )}
      </section>

      {/* The margin keeps the section's rule clear of the sticky top bar when
          `#reply` brings it into view. */}
      <section
        aria-label="Write a reply"
        className="mt-2xl border-t border-border-hair pt-xl"
        id="reply"
        style={{ scrollMarginTop: 'var(--nav-h)' }}
      >
        {locked ? (
          <p className="measure-ui text-sm text-text-2">
            This thread is locked, so nobody can add to it. Start a new thread in the channel if
            the topic is still live.
          </p>
        ) : viewer ? (
          <ReplyComposer
            id="thread-reply-body"
            threadId={threadId}
            parentPostId={null}
            label="Your reply"
            hint="Markdown works here: **bold**, `code`, a line starting with > for a quote, and - for a list."
            submitLabel="Post the reply"
            action={makeAction(null)}
          />
        ) : (
          <p className="measure-ui text-sm text-text-2">
            <Link href={signInHref}>Sign in</Link> to reply to this thread or to vote on an answer.
            Reading needs no account.
          </p>
        )}
      </section>
    </>
  )
}

export default ThreadConversation
