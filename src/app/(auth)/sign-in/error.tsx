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
      title="Sign-in did not load"
      body="The form could not be built, so there is nothing here to sign in with yet. Loading it again usually clears this; if it keeps happening, quote the reference below."
      requestId={error.digest}
      onRetry={reset}
      backHref="/sign-in"
      backLabel="Back to sign in"
    />
  )
}
