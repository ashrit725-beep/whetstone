/**
 * A channel slug that does not resolve. The page names the channels that do,
 * because "not found" without a way forward is a dead end.
 */

import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui'
import { ChannelRegister } from '@/components/discussions/channel-register'
import { DiscussionStyles } from '@/components/discussions/discussion-styles'
import { listChannelSummaries } from '@/server/queries/discussions'

export const metadata: Metadata = { title: 'Channel not found' }

export default function ChannelNotFound() {
  const channels = listChannelSummaries()

  // The shell already owns <main id="main">; this is the content column inside
  // it, so the skip link still lands in exactly one place.
  return (
    <div className="pad-inline mx-auto w-full max-w-feed py-xl">
      <DiscussionStyles />
      <h1>That channel is not open</h1>
      <p className="measure-ui mt-sm text-base text-text-2">
        The address does not match a channel, or the channel was archived. These are the ones open
        now.
      </p>

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
