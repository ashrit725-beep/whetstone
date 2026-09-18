/**
 * Surface 8, one thread.
 *
 * Where boldness is spent on this surface: nowhere. The single accent object is
 * the 2px grind-mark on the accepted answer, and only a question that has one
 * ever draws it.
 *
 * The opening post is Literata at 66ch, because a person wrote it. Everything
 * around it is Archivo, because the product wrote that.
 */

import type { Metadata } from 'next'
import { cache } from 'react'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { after } from 'next/server'
import { Check, Lock, Pin } from 'lucide-react'
import { Avatar, Badge, Breadcrumbs, Link, Prose, Separator, Timestamp } from '@/components/ui'
import { DiscussionStyles } from '@/components/discussions/discussion-styles'
import { ReportDialog } from '@/components/discussions/report-dialog'
import { SubscribeButton } from '@/components/discussions/subscribe-button'
import { ThreadConversation } from '@/components/discussions/thread-conversation'
import { THREAD_KIND_LABEL } from '@/components/discussions/labels'
import { getDiscussion, incrementThreadViews } from '@/server/repos/discussions'
import { getViewerCard, hasOpenReport } from '@/server/queries/discussions'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'

type Params = Promise<{ channel: string; threadId: string }>

/**
 * The thread at this address as the person reading it sees it, or a 404.
 *
 * One lookup for the metadata and the page, so the title cannot describe a
 * thread the body refuses, and the replies are read once per request rather
 * than twice. A thread filed under another channel is not-found rather than
 * redirected: the channel is part of the address.
 */
const threadAt = cache(async (channelSlug: string, threadId: string) => {
  const claims = await currentClaimsLive()
  const viewerId = claims?.uid ?? null
  const thread = getDiscussion(threadId, viewerId)
  if (!thread || thread.channel.slug !== channelSlug) notFound()
  return { thread, viewerId }
})

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { channel, threadId } = await params
  const { thread } = await threadAt(channel, threadId)
  return {
    title: `${thread.title} · ${thread.channel.label}`,
    description: thread.excerpt.slice(0, 155),
    alternates: { canonical: `/c/${thread.channel.slug}/${thread.id}` },
  }
}

export default async function ThreadPage({ params }: { params: Params }) {
  const { channel, threadId } = await params
  const { thread, viewerId } = await threadAt(channel, threadId)

  // A read is counted once the response has gone, so the page never waits on
  // the write. The render a Server Action runs to hand back fresh data after a
  // vote, a reply or a follow is not a read, and neither is a router prefetch.
  const request = await headers()
  if (!request.has('next-action') && !request.has('next-router-prefetch')) {
    after(() => {
      incrementThreadViews(thread.id)
    })
  }

  const viewer = viewerId ? (getViewerCard(viewerId) ?? null) : null
  const alreadyReported =
    viewerId !== null && hasOpenReport(viewerId, 'discussion_thread', thread.id)
  const locked = thread.status === 'locked' || thread.status === 'archived'

  // The shell already owns <main id="main">; this is the content column inside
  // it, so the skip link still lands in exactly one place.
  return (
    <div className="pad-inline mx-auto w-full max-w-prose py-xl">
      <DiscussionStyles />

      <Breadcrumbs
        items={[
          { label: 'Discussions', href: '/c' },
          { label: thread.channel.label, href: `/c/${thread.channel.slug}` },
          { label: thread.title },
        ]}
      />

      <header className="mt-lg flex flex-col gap-sm">
        <h1 className="measure-cap">{thread.title}</h1>

        {/* A byline, then a metadata line. As one wrapping row, a vertical rule
            was a flex item like any other and opened the second line at phone
            width. The only rule left sits inside a group that never breaks, so
            no line can start with one. */}
        <div className="flex flex-wrap items-center gap-xs">
          <Avatar
            userId={thread.author.id}
            name={thread.author.displayName}
            src={thread.author.avatarUrl}
            size="sm"
          />
          <Link
            href={`/u/${thread.author.handle}`}
            variant="inline"
            className="text-sm leading-none text-text-1 no-underline hover:underline"
          >
            {thread.author.displayName}
          </Link>
          <Timestamp ts={thread.createdAt} prefix="opened it" className="leading-none" />
        </div>

        <div className="flex flex-wrap items-center gap-xs">
          <div className="inline-flex items-center gap-xs text-xs leading-none whitespace-nowrap text-text-3">
            <span>
              <span className="tnum">{thread.viewCount.toLocaleString('en')}</span>
              {thread.viewCount === 1 ? ' view' : ' views'}
            </span>
            <Separator orientation="vertical" className="h-3" />
            <span>{THREAD_KIND_LABEL[thread.kind]}</span>
          </div>

          {thread.isPinned ? (
            <Badge tone="neutral" icon={Pin}>
              Pinned
            </Badge>
          ) : null}
          {thread.hasAcceptedAnswer ? (
            <Badge tone="positive" icon={Check}>
              Answered
            </Badge>
          ) : null}
          {locked ? (
            <Badge tone="neutral" icon={Lock}>
              Locked
            </Badge>
          ) : null}
        </div>

        {thread.project ? (
          <p className="text-xs text-text-3">
            About{' '}
            <Link href={`/p/${thread.project.slug}`} variant="inline" className="text-text-2">
              {thread.project.title}
            </Link>
          </p>
        ) : null}
      </header>

      <Prose content={thread.bodyMd} allow="article" className="mt-lg" />

      {viewer ? (
        <div className="mt-xl flex flex-wrap items-start gap-lg border-t border-border-hair pt-md">
          <SubscribeButton threadId={thread.id} subscribed={thread.viewerSubscribed} />
          {/* Nobody reports their own thread; the action refuses it as well. */}
          {thread.viewerIsAuthor ? null : (
            <ReportDialog
              targetType="discussion_thread"
              targetId={thread.id}
              what="this thread"
              triggerLabel="Report this thread"
              alreadyReported={alreadyReported}
            />
          )}
        </div>
      ) : null}

      {/* `?reply`, not `#reply`: the sign-in form redirects from a Server
          Action, and Next drops a fragment from that redirect. The
          conversation turns the query back into `#reply` on arrival. */}
      <ThreadConversation
        threadId={thread.id}
        isQuestion={thread.kind === 'question'}
        locked={locked}
        posts={thread.posts}
        viewer={viewer}
        viewerIsThreadAuthor={thread.viewerIsAuthor}
        signInHref={`/sign-in?next=${encodeURIComponent(`/c/${thread.channel.slug}/${thread.id}?reply`)}`}
      />
    </div>
  )
}
