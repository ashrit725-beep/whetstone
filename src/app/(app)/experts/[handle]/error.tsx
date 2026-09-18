'use client'

import { ErrorState } from '@/components/ui'

export default function ExpertError({
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
        title="This rate card did not load"
        body="The reviewer exists; this read of their rate and record failed. Nothing was requested and nothing was charged. Try again, or open their profile instead."
        requestId={error.digest}
        onRetry={reset}
        backHref="/experts"
        backLabel="Back to the reviewer list"
      />
    </div>
  )
}
