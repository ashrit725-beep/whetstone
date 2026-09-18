'use client'

import { ErrorPanel } from '@/components/marketing/error-panel'

export default function PageError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <section className="pad-inline py-32">
      <div className="mx-auto max-w-page">
        <ErrorPanel
          title="The reviewer board could not be loaded"
          body="The open asks are read live, and that read did not answer. Try again, or open Discover, which lists the same projects."
          digest={error.digest}
          onRetry={reset}
        />
      </div>
    </section>
  )
}
