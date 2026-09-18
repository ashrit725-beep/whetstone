'use client'

/**
 * Discover's error boundary. The filter rail is a sibling of this boundary in
 * the layout tree, so a failed query costs the reader their results and not
 * their filters: Retry re-runs the same address.
 */

import { ErrorState } from '@/components/ui'

export default function DiscoverError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="pad-inline mx-auto w-full max-w-detail py-2xl">
      <ErrorState
        title="The project feed did not load"
        body="The filters in the address are still there, so nothing you picked was lost. Run the query again, and if it fails twice the database is the place to look."
        requestId={error.digest}
        onRetry={reset}
        backHref="/"
        backLabel="Back to the home page"
      />
    </div>
  )
}
