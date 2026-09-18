'use client'

import Link from 'next/link'
import { ProjectStyles } from '@/components/project/styles'

export default function SectionError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="pad-inline mx-auto w-full max-w-page pb-32 pt-24">
      <ProjectStyles />
      <div className="marked bg-paper-hi py-8 pl-6 pr-6" role="alert">
        <h1 className="text-lg">The build history did not load</h1>
        <p className="voice mt-3 text-base">
          The page reached the database and did not get an answer back. Nothing here is lost. Try
          again, and the project page itself will still be there either way.
        </p>
        <p className="mt-6 flex flex-wrap gap-3">
          <button type="button" className="btn" onClick={reset}>
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
