'use client'

/**
 * Search's error boundary. The query stays in the address, so Retry runs the
 * same search rather than dropping the reader back on an empty field.
 */

import { ErrorState } from '@/components/ui'

export default function SearchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="pad-inline mx-auto w-full max-w-detail py-2xl">
      <ErrorState
        title="The search did not run"
        body="The text index answers most queries in a few milliseconds, so this is usually a one-off. Your query is still in the page address; run it again."
        requestId={error.digest}
        onRetry={reset}
        backHref="/discover"
      />
    </div>
  )
}
