/**
 * Surface 8, one channel.
 *
 * Where boldness is spent on this surface: nowhere. The only accent object on
 * the page is the 2px rule under the current channel in the strip, the same
 * mark the top navigation uses for its current item (§2.4.6, and the
 * deviation recorded in design/direction.md).
 *
 * Sort is URL state, read here in a Server Component, so the control is a set of
 * links and the back button keeps meaning what it says.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Breadcrumbs, Button, EmptyState, Link } from '@/components/ui'
import { ChannelNav } from '@/components/discussions/channel-nav'
import { DiscussionStyles } from '@/components/discussions/discussion-styles'
import { ThreadRegister } from '@/components/discussions/thread-register'
import { ThreadSort } from '@/components/discussions/thread-sort'
import {
  DEFAULT_THREAD_SORT,
  channelEmptyCopy,
  filteredEmptyCopy,
  threadSortKey,
} from '@/components/discussions/labels'
import { getChannel, listChannels, listDiscussions } from '@/server/repos/discussions'

type Params = Promise<{ channel: string }>
type SearchParams = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { channel: slug } = await params
  const channel = getChannel(slug)
  if (!channel) notFound()
  return {
    title: channel.label,
    description: channel.description ?? `Threads in the ${channel.label} channel.`,
    alternates: { canonical: `/c/${channel.slug}` },
  }
}

function firstParam(value: string | string[] | undefined): string | null {
  const single = Array.isArray(value) ? value[0] : value
  return single && single.length > 0 ? single : null
}

export default async function ChannelPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { channel: slug } = await params
  const sp = await searchParams

  const channel = getChannel(slug)
  if (!channel) notFound()

  const sort = threadSortKey(sp['sort'])
  const cursor = firstParam(sp['cursor'])
  const channels = listChannels()

  const page = listDiscussions({ channelSlug: channel.slug, sort, cursor, limit: 20 })

  const neverWritten = channel.thread_count === 0
  const emptyCopy = neverWritten
    ? channelEmptyCopy(channel.slug, channel.label)
    : filteredEmptyCopy(sort, channel.label, channel.thread_count)

  const nextHref = page.nextCursor
    ? `/c/${channel.slug}?${new URLSearchParams(
        sort === DEFAULT_THREAD_SORT
          ? { cursor: page.nextCursor }
          : { sort, cursor: page.nextCursor },
      ).toString()}`
    : null

  // The shell already owns <main id="main">; this is the content column inside
  // it, so the skip link still lands in exactly one place.
  return (
    <div className="pad-inline mx-auto w-full max-w-feed py-xl">
      <DiscussionStyles />

      <Breadcrumbs
        items={[{ label: 'Discussions', href: '/c' }, { label: channel.label }]}
      />

      <header className="mt-lg flex flex-col gap-sm">
        <h1>{channel.label}</h1>
        {channel.description ? (
          <p className="measure-ui text-base text-text-2">{channel.description}</p>
        ) : null}
        <p className="text-xs text-text-3">
          <span className="tnum">{channel.thread_count.toLocaleString('en')}</span>
          {channel.thread_count === 1
            ? '\u00A0thread in this channel.'
            : '\u00A0threads in this channel.'}
        </p>
      </header>

      <div className="mt-lg">
        <ChannelNav
          channels={channels.map((item) => ({ slug: item.slug, label: item.label }))}
          currentSlug={channel.slug}
        />
      </div>

      <div className="mt-md flex flex-wrap items-center justify-between gap-md">
        <ThreadSort channelSlug={channel.slug} current={sort} />
        <Button as="a" href={`/c/${channel.slug}/new`} variant="secondary">
          Start a thread
        </Button>
      </div>

      <section aria-label={`Threads in ${channel.label}`} className="mt-md">
        {page.items.length === 0 ? (
          <EmptyState
            title={emptyCopy.title}
            body={emptyCopy.body}
            variant={neverWritten ? 'default' : 'filtered'}
            primaryAction={{
              label: emptyCopy.actionLabel,
              href: neverWritten ? `/c/${channel.slug}/new` : `/c/${channel.slug}`,
              primary: true,
            }}
          />
        ) : (
          <>
            <ThreadRegister
              threads={page.items}
              channelSlug={channel.slug}
              label={`Threads in ${channel.label}`}
            />

            {cursor !== null || nextHref ? (
              <nav
                aria-label="More threads"
                className="mt-lg flex flex-wrap items-center justify-between gap-md border-t border-border-hair pt-md"
              >
                {cursor !== null ? (
                  <Link
                    href={sort === DEFAULT_THREAD_SORT ? `/c/${channel.slug}` : `/c/${channel.slug}?sort=${sort}`}
                    variant="standalone"
                    className="text-text-2"
                  >
                    Back to the top of the register
                  </Link>
                ) : (
                  <span />
                )}
                {nextHref ? (
                  <Link href={nextHref} variant="standalone" className="text-text-2">
                    Older threads
                  </Link>
                ) : null}
              </nav>
            ) : null}
          </>
        )}
      </section>
    </div>
  )
}
