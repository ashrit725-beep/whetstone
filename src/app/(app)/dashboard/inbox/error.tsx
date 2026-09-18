'use client'

/**
 * Inbox failure. Nothing has been lost: this route only reads. The escape hatch
 * goes to the overview, which reads a different set of rows and often survives.
 */

import { ErrorState } from '@/components/ui'

export default function InboxError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="The inbox did not load"
      body="No note was lost: this page only reads them, and the read failed. Try again, or take the overview route in while this settles."
      {...(error.digest ? { requestId: error.digest } : {})}
      onRetry={reset}
      backHref="/dashboard"
      backLabel="Back to the overview"
    />
  )
}
