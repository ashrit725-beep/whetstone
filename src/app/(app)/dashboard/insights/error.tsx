'use client'

/**
 * Insights failure. Clustering and the weekly brief both fall back to a
 * deterministic path on their own, so a failure here is a read failure rather
 * than a model one, and retrying is worth a press.
 */

import { ErrorState } from '@/components/ui'

export default function InsightsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="The insights did not load"
      body="Your notes are untouched. Grouping them needs to read every one, and that read failed. Try again, or work from the inbox in the meantime."
      {...(error.digest ? { requestId: error.digest } : {})}
      onRetry={reset}
      backHref="/dashboard/inbox"
      backLabel="Go to the inbox"
    />
  )
}
