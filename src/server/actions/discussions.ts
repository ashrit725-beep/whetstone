'use server'

/**
 * Every write the community surface makes. Each one re-checks the session on the
 * server: a form posted from a stale page is not authorisation.
 *
 * Errors name what broke, why it matters here, and what to do next, with no
 * apology and no exclamation mark (contract §7.1.4).
 */

import { actionRefusal } from './limits'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
// Every write below authorises from `claims.uid`, so the claims must come from
// a session that is still live. A signature proves the cookie is authentic and
// nothing more: a JWT stays valid until it expires, so a cookie revoked by a
// sign-out or a password reset would otherwise keep authorising writes for up
// to thirty days. `currentClaimsLive()` puts the revocation check in front.
import { currentClaimsLive } from '@/server/queries/auth'
import {
  acceptAnswer,
  createPost,
  createThread,
  getChannel,
  setSubscription,
  votePost,
  getPostAuthorId,
} from '@/server/repos/discussions'
import {
  fileContentReport,
  getPostThreadId,
  getThreadWriteContext,
} from '@/server/queries/discussions'
import { isDiscussionReportReason } from '@/components/discussions/labels'
import type { FormState } from '@/components/ui/form'

/** What the small, non-form controls hand back to their optimistic caller. */
export interface ActionResult {
  readonly ok: boolean
  readonly message?: string
}

const SIGNED_OUT: FormState = {
  status: 'error',
  message: 'Your session has ended. Sign in again and the text you wrote is still here.',
}

function threadPath(channelSlug: string, threadId: string): string {
  return `/c/${channelSlug}/${threadId}`
}

/* ------------------------------------------------------------------------- *
 * Replies
 * ------------------------------------------------------------------------- */

const ReplySchema = z.object({
  threadId: z.string().min(1),
  parentPostId: z.string().min(1).nullable(),
  bodyMd: z
    .string()
    .trim()
    .min(2, 'Write a reply before you post it. Even one sentence is worth more than an empty one.')
    .max(
      8000,
      'This reply is over 8,000 characters. Post the part that answers the question and put the rest in a second reply.',
    ),
})

export async function postReplyAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return SIGNED_OUT
  // On the way in: the submit costs an attempt whatever becomes of it. The
  // reply allowance itself is charged below, once the text has validated.
  const attempt = actionRefusal('attempt', claims.uid)
  if (attempt) return { status: 'error', message: attempt }

  const rawParent = formData.get('parentPostId')
  const parsed = ReplySchema.safeParse({
    threadId: String(formData.get('threadId') ?? ''),
    parentPostId: typeof rawParent === 'string' && rawParent.length > 0 ? rawParent : null,
    bodyMd: String(formData.get('bodyMd') ?? ''),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'bodyMd')
      fieldErrors[key] = issue.message
    }
    return {
      status: 'error',
      message: 'This reply was not posted.',
      fieldErrors,
    }
  }

  // Charged here, after the schema and before the lookups, which is the order
  // `actionRefusal` states. Charged first, a one-character reply armed the
  // two-second floor and took an hourly token, so correcting the typo and
  // pressing Post again was refused as spam with nothing posted.
  const held = actionRefusal('reply', claims.uid)
  if (held) return { status: 'error', message: held }

  const thread = getThreadWriteContext(parsed.data.threadId)
  if (!thread) {
    return {
      status: 'error',
      message: 'This thread is no longer here, so the reply has nowhere to go. Open the channel to see what is still open.',
    }
  }
  if (thread.locked) {
    return {
      status: 'error',
      message: 'This thread is locked, so nobody can add to it. Start a new thread in the channel if the topic is still live.',
    }
  }
  // The parent comes from the form, so it is checked against this thread rather
  // than trusted: a post id from another thread would otherwise nest the reply
  // under a stranger's post.
  if (parsed.data.parentPostId && getPostThreadId(parsed.data.parentPostId) !== thread.id) {
    return {
      status: 'error',
      message: 'The reply you are answering has been taken down, so yours was not posted. Your text is still here to copy into a reply to the thread.',
    }
  }

  createPost({
    threadId: parsed.data.threadId,
    authorId: claims.uid,
    bodyMd: parsed.data.bodyMd,
    parentPostId: parsed.data.parentPostId,
  })

  revalidatePath(threadPath(thread.channelSlug, thread.id))
  revalidatePath(`/c/${thread.channelSlug}`)
  return { status: 'success', message: 'Reply posted.' }
}

/* ------------------------------------------------------------------------- *
 * New threads
 * ------------------------------------------------------------------------- */

const ThreadSchema = z.object({
  channelSlug: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(12, 'Give the thread a title of at least 12 characters. The title is what people scan in the channel register.')
    .max(140, 'Titles stop at 140 characters so they stay on one line in the register. Move the detail into the body.'),
  kind: z.enum(['discussion', 'question', 'showcase']),
  bodyMd: z
    .string()
    .trim()
    .min(
      40,
      'Write at least 40 characters of context. A thread that says what you already tried gets a useful first reply instead of a clarifying question.',
    )
    .max(20000, 'This post is over 20,000 characters. Trim it, or link the long version and summarise it here.'),
})

export async function createThreadAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return SIGNED_OUT
  const attempt = actionRefusal('attempt', claims.uid)
  if (attempt) return { status: 'error', message: attempt }

  const parsed = ThreadSchema.safeParse({
    channelSlug: String(formData.get('channelSlug') ?? ''),
    title: String(formData.get('title') ?? ''),
    kind: String(formData.get('kind') ?? 'discussion'),
    bodyMd: String(formData.get('bodyMd') ?? ''),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'bodyMd')
      fieldErrors[key] = issue.message
    }
    return {
      status: 'error',
      message: 'This thread was not posted.',
      fieldErrors,
    }
  }

  // As in `postReplyAction`. Charged first, five rejected submits drained a new
  // account's whole hourly thread allowance and locked it out of the channel for
  // eleven minutes with nothing posted.
  const held = actionRefusal('thread', claims.uid)
  if (held) return { status: 'error', message: held }

  const channel = getChannel(parsed.data.channelSlug)
  if (!channel) {
    return {
      status: 'error',
      message: 'That channel is closed, so the thread has nowhere to go. Pick another channel from the index.',
      fieldErrors: { channelSlug: 'This channel is no longer open.' },
    }
  }

  const threadId = createThread({
    channelId: channel.id,
    authorId: claims.uid,
    title: parsed.data.title,
    bodyMd: parsed.data.bodyMd,
    kind: parsed.data.kind,
  })

  revalidatePath(`/c/${channel.slug}`)
  revalidatePath('/c')
  // redirect throws, so nothing after it runs and it is never inside a try block.
  redirect(threadPath(channel.slug, threadId))
}

/* ------------------------------------------------------------------------- *
 * Votes, answers, subscriptions
 * ------------------------------------------------------------------------- */

export async function voteOnPostAction(postId: string, value: -1 | 0 | 1): Promise<ActionResult> {
  const claims = await currentClaimsLive()
  if (!claims) {
    return { ok: false, message: 'Your session has ended. Sign in again to vote on a reply.' }
  }
  const held = actionRefusal('vote', claims.uid)
  if (held) return { ok: false, message: held }

  // A Server Action is a public endpoint; the type annotation is not a check.
  if (typeof postId !== 'string' || (value !== -1 && value !== 0 && value !== 1)) {
    return { ok: false, message: 'That vote was not understood, so nothing changed. Reload the page and try again.' }
  }

  const threadId = getPostThreadId(postId)
  if (!threadId) {
    return { ok: false, message: 'This reply has been taken down, so the vote did not count.' }
  }
  const thread = getThreadWriteContext(threadId)
  if (!thread) {
    return { ok: false, message: 'This thread is no longer here, so the vote did not count.' }
  }
  if (getPostAuthorId(postId) === claims.uid) {
    return { ok: false, message: 'You cannot vote on your own reply.' }
  }

  votePost(postId, claims.uid, value)
  revalidatePath(threadPath(thread.channelSlug, thread.id))
  return { ok: true }
}

export async function acceptAnswerAction(threadId: string, postId: string): Promise<ActionResult> {
  const claims = await currentClaimsLive()
  if (!claims) {
    return { ok: false, message: 'Your session has ended. Sign in again to mark an answer.' }
  }
  if (typeof threadId !== 'string' || typeof postId !== 'string') {
    return { ok: false, message: 'That reply was not understood, so nothing was marked. Reload the thread and try again.' }
  }

  const thread = getThreadWriteContext(threadId)
  if (!thread) {
    return { ok: false, message: 'This thread is no longer here, so nothing was marked.' }
  }
  if (thread.kind !== 'question') {
    return { ok: false, message: 'Only a question can have an answer, and this thread is not one.' }
  }
  if (thread.authorId !== claims.uid) {
    return { ok: false, message: 'Only the person who asked can mark the answer on their question.' }
  }

  const marked = acceptAnswer(threadId, postId, claims.uid)
  if (!marked) {
    return { ok: false, message: 'That reply could not be marked. Reload the thread and try the reply again.' }
  }

  revalidatePath(threadPath(thread.channelSlug, thread.id))
  revalidatePath(`/c/${thread.channelSlug}`)
  return { ok: true }
}

export async function setThreadSubscriptionAction(
  threadId: string,
  subscribed: boolean,
): Promise<ActionResult> {
  const claims = await currentClaimsLive()
  if (!claims) {
    return { ok: false, message: 'Your session has ended. Sign in again to follow this thread.' }
  }
  // A Server Action is a public endpoint; the type annotation is not a check.
  if (typeof threadId !== 'string' || typeof subscribed !== 'boolean') {
    return { ok: false, message: 'That setting was not understood, so nothing changed. Reload the thread and try again.' }
  }

  const thread = getThreadWriteContext(threadId)
  if (!thread) {
    return { ok: false, message: 'This thread is no longer here, so there is nothing to follow.' }
  }

  setSubscription(threadId, claims.uid, subscribed ? 'subscribed' : 'muted')
  revalidatePath(threadPath(thread.channelSlug, thread.id))
  return { ok: true }
}

/* ------------------------------------------------------------------------- *
 * Moderation reports
 * ------------------------------------------------------------------------- */

const ReportSchema = z.object({
  targetType: z.enum(['discussion_thread', 'discussion_post']),
  targetId: z.string().min(1),
  reason: z.string().refine(isDiscussionReportReason, 'Pick the reason that fits best. Moderators route reports by reason.'),
  detail: z.string().trim().max(1000, 'Keep the detail under 1,000 characters. Link the worst example rather than quoting all of it.'),
})

export async function reportContentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return SIGNED_OUT
  const attempt = actionRefusal('attempt', claims.uid)
  if (attempt) return { status: 'error', message: attempt }

  const parsed = ReportSchema.safeParse({
    targetType: String(formData.get('targetType') ?? ''),
    targetId: String(formData.get('targetId') ?? ''),
    reason: String(formData.get('reason') ?? ''),
    detail: String(formData.get('detail') ?? ''),
  })

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'reason')
      fieldErrors[key] = issue.message
    }
    return { status: 'error', message: 'This report was not sent.', fieldErrors }
  }

  if (!isDiscussionReportReason(parsed.data.reason)) {
    return {
      status: 'error',
      message: 'This report was not sent.',
      fieldErrors: { reason: 'Pick the reason that fits best. Moderators route reports by reason.' },
    }
  }

  // Reports are metered where the report is filed, for the same reason: a reason
  // nobody picked must not cost the twenty a person gets in an hour.
  const held = actionRefusal('report', claims.uid)
  if (held) return { status: 'error', message: held }

  const outcome = fileContentReport({
    reporterId: claims.uid,
    targetType: parsed.data.targetType,
    targetId: parsed.data.targetId,
    reason: parsed.data.reason,
    detail: parsed.data.detail,
  })

  if (outcome === 'missing') {
    return {
      status: 'error',
      message: 'This post has already been taken down, so there is nothing left to report.',
    }
  }
  if (outcome === 'own') {
    return {
      status: 'error',
      message: 'You cannot report your own post, so this report was not sent.',
    }
  }
  if (outcome === 'duplicate') {
    // Not a confirmation: nothing was written. Drawn as one, a second report
    // read as a second report filed, which is the opposite of what happened.
    return {
      status: 'error',
      message: 'You already reported this, and that report is still open with the moderators.',
    }
  }

  // No revalidation here. The page behind the dialog would re-render with the
  // flag disabled, which unmounts the dialog and takes the confirmation with
  // it. The flag reads `alreadyReported` on the next load, as the thread's own
  // control has always done.
  return {
    status: 'success',
    message: 'A moderator reads every report in the order it arrived. Nothing is posted publicly.',
  }
}
