'use client'

/**
 * Tracker failure. No card moved: the board reads its columns on every render,
 * and this failed before any of them were drawn.
 */

import { ErrorState } from '@/components/ui'

export default function SuggestionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="The tracker did not load"
      body="Nothing moved: this page reads the board and the read failed, so every card is where you left it. Try again."
      {...(error.digest ? { requestId: error.digest } : {})}
      onRetry={reset}
      backHref="/dashboard"
      backLabel="Back to the overview"
    />
  )
}
