'use client'

/**
 * The composer failed to load. Focus stays where it is.
 */

import { ErrorState } from '@/components/ui'

export default function NewThreadError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // The shell already owns <main id="main">; this is the content column inside
  // it, so the skip link still lands in exactly one place.
  return (
    <div className="column-prose w-full py-xl">
      <ErrorState
        title="The composer did not load"
        body="Nothing was posted. Open it again, and if it keeps failing the channel register is still readable."
        requestId={error.digest}
        onRetry={reset}
        backHref="/c"
        backLabel="Back to Discussions"
      />
    </div>
  )
}
