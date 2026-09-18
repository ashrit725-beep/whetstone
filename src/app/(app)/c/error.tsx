'use client'

/**
 * The channel index failed to read. Focus is deliberately not moved: the reader
 * is already here, and stealing focus on an error is disorienting.
 */

import { ErrorState } from '@/components/ui'

export default function DiscussionsIndexError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // The shell already owns <main id="main">; this is the content column inside
  // it, so the skip link still lands in exactly one place.
  return (
    <div className="pad-inline mx-auto w-full max-w-feed py-xl">
      <ErrorState
        title="The channel list did not load"
        body="Nothing was lost, and no thread was affected. Read it again, and if it keeps failing the channels are still reachable from a thread you already have open."
        requestId={error.digest}
        onRetry={reset}
        backHref="/discover"
        backLabel="Back to Discover"
      />
    </div>
  )
}
