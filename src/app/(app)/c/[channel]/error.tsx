'use client'

/**
 * The channel register failed to read. Focus stays where it is: the reader is
 * already here, and moving focus on an error is disorienting.
 */

import { ErrorState } from '@/components/ui'

export default function ChannelError({
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
        title="This channel did not load"
        body="No thread was affected and nothing you wrote was lost. Read it again, or open another channel from the index."
        requestId={error.digest}
        onRetry={reset}
        backHref="/c"
        backLabel="Back to Discussions"
      />
    </div>
  )
}
