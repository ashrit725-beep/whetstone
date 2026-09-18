/**
 * Surface 8, the channel index.
 *
 * Where boldness is spent on this surface: nowhere. Hairlines and type only
 * (CONTRACT §1). There is no card, no fill, no accent object on this page.
 */

import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui'
import { ChannelRegister } from '@/components/discussions/channel-register'
import { DiscussionStyles } from '@/components/discussions/discussion-styles'
import { listChannelSummaries } from '@/server/queries/discussions'

export const metadata: Metadata = {
  title: 'Discussions',
  description:
    'Channels where people building things compare notes on playtesting, feedback, pricing and craft.',
  alternates: { canonical: '/c' },
}

export default function DiscussionsIndexPage() {
  const channels = listChannelSummaries()

  // The shell already owns <main id="main">; this is the content column inside
  // it, so the skip link still lands in exactly one place.
  return (
    <div className="pad-inline mx-auto w-full max-w-feed py-xl">
      <DiscussionStyles />

      <header className="flex flex-col gap-sm">
        <h1>Discussions</h1>
        <p className="measure-ui text-base text-text-2">
          Every channel is a register of open threads. Read what is already there before you start
          one, and put the specific version of your question in the title.
        </p>
      </header>

      <section aria-label="Channels" className="mt-xl">
        {channels.length === 0 ? (
          <EmptyState
            title="No channels are open"
            body="Channels are opened by moderators, and none are open right now. The project feed is where the rest of the conversation happens in the meantime."
            primaryAction={{ label: 'Go to Discover', href: '/discover', primary: true }}
          />
        ) : (
          <ChannelRegister channels={channels} label="Discussion channels" />
        )}
      </section>
    </div>
  )
}
