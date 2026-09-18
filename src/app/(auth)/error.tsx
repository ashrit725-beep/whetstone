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
      title="This page did not load"
      body="Nothing was submitted and nothing changed on your account. Loading it again usually clears this. If it keeps happening, quote the reference below."
      requestId={error.digest}
      onRetry={reset}
      backHref="/sign-in"
      backLabel="Back to sign in"
    />
  )
}
