'use client'

import { ErrorState } from '@/components/ui'

export default function BountiesError({
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
        title="The bounty list did not load"
        body="Amounts and escrow states are read together, and that read failed. No bounty was changed and no amount moved. Try again."
        requestId={error.digest}
        onRetry={reset}
        backHref="/experts"
        backLabel="Back to the reviewer list"
      />
    </div>
  )
}
