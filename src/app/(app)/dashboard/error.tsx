'use client'

/**
 * Overview failure. The rail is in the layout, so it survives this boundary and
 * the reader can still reach the inbox and the tracker while the overview is
 * broken. The copy says what broke, what it costs, and what to do next.
 */

import { ErrorState } from '@/components/ui'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="The overview did not load"
      body="Your notes and suggestions are untouched: this page reads them and the read failed. Try again, or go straight to the inbox."
      {...(error.digest ? { requestId: error.digest } : {})}
      onRetry={reset}
      backHref="/dashboard/inbox"
      backLabel="Go to the inbox"
    />
  )
}
