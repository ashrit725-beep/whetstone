'use client'

import { ErrorState } from '@/components/ui'

export default function BountyError({
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
        title="This bounty did not load"
        body="The bounty, its applications and its escrow ledger are read together, and that read failed. Nothing was awarded, accepted or paid. Try again."
        requestId={error.digest}
        onRetry={reset}
        backHref="/bounties"
        backLabel="Back to open bounties"
      />
    </div>
  )
}
