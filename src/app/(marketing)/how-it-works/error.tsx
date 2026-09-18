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
          title="How it works could not be built just now"
          body="The counts on this page are read from the database at render time, and that read did not answer. Nothing about your account is affected."
          digest={error.digest}
          onRetry={reset}
        />
      </div>
    </section>
  )
}
