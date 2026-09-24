/**
 * An unknown handle. Handles are not guessable, so the useful answer is a way
 * to find the person rather than an apology.
 *
 * This is the whole page, so it carries the page's one h1, set the way the
 * app-wide 404 sets it. The layout above has already dropped to the prose
 * column for a handle that does not resolve.
 */

import type { Metadata } from 'next'
import { Button, Link } from '@/components/ui'

export const metadata: Metadata = { title: 'Profile not found' }

export default function ProfileNotFound() {
  return (
    <div className="flex flex-col items-start gap-lg">
      <h1>No account with that handle</h1>
      {/* Search covers projects, discussions and listed reviewers — not people
          in general — so this no longer promises that searching a name finds
          anyone either way. It named the two cases it could not answer. */}
      <p className="measure-ui text-base text-text-2">
        Handles change when someone renames their account, and a closed account stops resolving
        entirely. If the person reviews for hire, the reviewer market lists them by name.
        Otherwise, ask whoever shared the link for the new one.
      </p>
      <div className="flex flex-wrap items-center gap-lg">
        <Button as="a" href="/experts" variant="primary">
          Browse the reviewer market
        </Button>
        <Link href="/search?in=experts" variant="standalone">
          Search reviewers by name
        </Link>
      </div>
    </div>
  )
}
