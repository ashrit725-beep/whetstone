'use client'

import { ErrorState } from '@/components/ui'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorState
      title="The reset request did not load"
      body="The form could not be built, so no reset link was sent. Loading it again usually clears this."
      requestId={error.digest}
      onRetry={reset}
      backHref="/sign-in"
      backLabel="Back to sign in"
    />
  )
}
