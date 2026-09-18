'use client'

/**
 * The thread failed to read. Focus stays where it is: the reader is already
 * here, and moving focus on an error is disorienting.
 */

import { ErrorState } from '@/components/ui'

export default function ThreadError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // The shell already owns <main id="main">; this is the content column inside
  // it, so the skip link still lands in exactly one place.
  return (
    <div className="pad-inline mx-auto w-full max-w-prose py-xl">
      <ErrorState
        title="This thread did not load"
        body="Nothing was posted and nothing was lost. Read it again, and if it keeps failing the channel register still lists the thread."
        requestId={error.digest}
        onRetry={reset}
        backHref="/c"
        backLabel="Back to Discussions"
      />
    </div>
  )
}
