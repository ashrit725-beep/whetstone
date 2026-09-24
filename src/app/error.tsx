'use client'

/**
 * The last boundary before `global-error`. It catches a failure in a layout
 * above the product shell, so it cannot assume the nav is mounted: it renders
 * its own wordmark and its own footer line, and the help affordance stays in
 * the same slot it occupies everywhere else (SC 3.2.6).
 */

import { useTransition } from 'react'
import { ErrorState } from '@/components/ui'
import { Footer } from '@/components/chrome/footer'
import { Wordmark } from '@/components/chrome/wordmark'

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const [retrying, startRetry] = useTransition()

  return (
    <div className="flex min-h-dvh flex-col bg-surface-1 text-text-1">
      {/* A <header>, not a div: the nav above this boundary is gone, so this is
          the page's only banner landmark and must be one. */}
      <header className="pad-inline border-b border-border-hair bg-surface-2">
        <div
          className="mx-auto flex w-full max-w-detail items-center"
          style={{ blockSize: 'var(--nav-h)' }}
        >
          <Wordmark size="lg" href="/" />
        </div>
      </header>

      <main id="main" tabIndex={-1} className="pad-inline mx-auto w-full max-w-detail grow py-2xl">
        <ErrorState
          title="Whetstone did not finish loading this page."
          body="The failure happened before the page’s own content ran, so retrying is worth one try. If it repeats, open Discover and take a different route to what you were after."
          requestId={error.digest}
          onRetry={() => startRetry(() => reset())}
          retrying={retrying}
          backHref="/discover"
          backLabel="Open Discover"
        />
      </main>

      {/* The nav above this boundary is gone, so the footer carries the theme
          control the product shell would otherwise have provided. */}
      <Footer showTheme />
    </div>
  )
}
