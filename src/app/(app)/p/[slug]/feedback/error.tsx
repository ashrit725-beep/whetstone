'use client'

/**
 * The composer route's error boundary. It catches two failures, not one: the
 * page failing to load, and a step failing while it posts (a dropped
 * connection, a server that did not answer). The copy used to describe only
 * the first, so a review that failed to post said the composer "did not open",
 * and it told the reader to open the project while linking to Discover.
 *
 * Trying again refreshes from the server before it re-renders. A bare `reset`
 * re-renders from what the page was first given, which does not include the
 * notes saved since, so the composer would open empty and its next save would
 * write over them.
 */

import { startTransition } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ErrorState } from '@/components/ui'

export default function ComposerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  const params = useParams<{ slug?: string }>()
  const slug = typeof params.slug === 'string' ? params.slug : ''
  return (
    <div className="pad-inline w-full">
      <div className="mx-auto w-full max-w-prose py-8">
        <ErrorState
          title="The composer stopped"
          body="It failed while the page was loading or while the review was being sent. Notes are saved a few seconds after you stop typing, so the composer opens again with what you wrote up to then. Try again, or go back to the project and carry on from there."
          requestId={error.digest}
          onRetry={() => {
            startTransition(() => {
              router.refresh()
              reset()
            })
          }}
          backHref={slug ? `/p/${slug}` : '/discover'}
          backLabel={slug ? 'Back to the project' : 'Back to Discover'}
        />
      </div>
    </div>
  )
}
