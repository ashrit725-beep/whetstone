'use client'

/**
 * The landing boundary. The home page must never be a blank error screen, so
 * this keeps the one action that does not depend on the feed.
 */

import { ErrorPanel } from '@/components/marketing/error-panel'

export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <section className="pad-inline py-32">
      <div className="mx-auto max-w-page">
        <ErrorPanel
          title="This page could not be built just now"
          body="The project feed behind it did not answer, so the live rows and the figures are missing. Try again, or go straight to the open asks, which are read separately."
          digest={error.digest}
          onRetry={reset}
        />
      </div>
    </section>
  )
}
