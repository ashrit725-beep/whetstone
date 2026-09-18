'use client'

/**
 * The route's error boundary.
 *
 * It names what broke, what it means for anything the reader had typed, and
 * gives them two ways forward. No exclamation mark, no apology theatre.
 */

import { startTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ProjectStyles } from '@/components/project/styles'

export default function ProjectError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter()
  // A bare `reset` re-renders what the page was first given: the same failed
  // render, and a composer without the notes saved since.
  const retry = () => {
    startTransition(() => {
      router.refresh()
      reset()
    })
  }
  return (
    <div className="pad-inline mx-auto w-full max-w-page pb-32 pt-24">
      <ProjectStyles />
      <div className="marked bg-paper-hi py-8 pl-6 pr-6" role="alert">
        <h1 className="text-lg">This project did not load</h1>
        <p className="voice mt-3 text-base">
          The page reached the database and did not get an answer back. Nothing you have written is
          lost. Try again, and if it keeps failing the Discover feed will still be there.
        </p>
        <p className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn" onClick={retry}>
            Try again
          </button>
          <Link href="/discover" className="btn btn-secondary">
            Back to Discover
          </Link>
        </p>
        {error.digest ? (
          <p className="mt-6 text-xs text-ink-3">
            Reference <span className="tnum">{error.digest}</span>, which is what support will ask for.
          </p>
        ) : null}
      </div>
    </div>
  )
}
