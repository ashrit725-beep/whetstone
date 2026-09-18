'use client'

import { ErrorState } from '@/components/ui'

export default function ExpertsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      className="pad-inline mx-auto w-full py-xl"
      style={{ maxInlineSize: 'var(--container-detail)' }}
    >
      <ErrorState
        title="The reviewer list did not load"
        body="Rates and delivery records are read together, and that read failed. No request was sent and no money moved. Try again, or post a bounty, which reaches the same people."
        requestId={error.digest}
        onRetry={reset}
        backHref="/bounties"
        backLabel="Back to open bounties"
      />
    </div>
  )
}
