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
      title="The reset link could not be checked"
      body="Your password has not changed, and the link stays valid until it expires. Loading the page again usually clears this."
      requestId={error.digest}
      onRetry={reset}
      backHref="/sign-in"
      backLabel="Back to sign in"
    />
  )
}
