'use client'

/**
 * The shell's error boundary. The nav and the footer stay mounted, because they
 * live in the layout segment above this one, so a failed query never strands
 * the reader on a page with no way out.
 *
 * `error.digest` is the id to quote in a support message: the stack itself is
 * stripped in production and would tell the reader nothing anyway.
 */

import { useTransition } from 'react'
import { ErrorState } from '@/components/ui'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [retrying, startRetry] = useTransition()

  return (
    <div className="pad-inline mx-auto w-full max-w-detail py-xl">
      <ErrorState
        title="This page did not load."
        body="The query behind it did not come back, so nothing here is current. Run it again; if it keeps failing, quote the request id when you ask for help."
        requestId={error.digest}
        onRetry={() => startRetry(() => reset())}
        retrying={retrying}
        backHref="/discover"
        backLabel="Open Discover"
      />
    </div>
  )
}
