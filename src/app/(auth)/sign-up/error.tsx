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
      title="The sign-up form did not load"
      body="The form could not be built, so no account was created and nothing was submitted. Loading it again usually clears this."
      requestId={error.digest}
      onRetry={reset}
      backHref="/sign-in"
      backLabel="Back to sign in"
    />
  )
}
