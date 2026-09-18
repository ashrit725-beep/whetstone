/**
 * A thread id that does not resolve, or one that belongs to another channel.
 */

import type { Metadata } from 'next'
import { EmptyState } from '@/components/ui'

export const metadata: Metadata = { title: 'Thread not found' }

export default function ThreadNotFound() {
  // The shell already owns <main id="main">; this is the content column inside
  // it, so the skip link still lands in exactly one place.
  return (
    <div className="pad-inline mx-auto w-full max-w-prose py-xl">
      <h1>That thread is not here</h1>
      <p className="measure-ui mt-sm text-base text-text-2">
        The address does not match a thread in this channel, or the thread was deleted by its
        author or a moderator.
      </p>
      <div className="mt-xl">
        <EmptyState
          title="Nothing to read at this address"
          body="Threads keep the id they were given, so a link that worked before will keep working. This one does not match any of them."
          primaryAction={{ label: 'Back to Discussions', href: '/c', primary: true }}
          headingLevel={2}
        />
      </div>
    </div>
  )
}
