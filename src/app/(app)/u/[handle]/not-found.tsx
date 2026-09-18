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
      <p className="measure-ui text-base text-text-2">
        Handles change when someone renames their account, and a deactivated account stops
        resolving entirely. Searching by name finds the person either way.
      </p>
      <div className="flex flex-wrap items-center gap-lg">
        <Button as="a" href="/search" variant="primary">
          Search for a person
        </Button>
        <Link href="/experts" variant="standalone">
          Browse the reviewer market
        </Link>
      </div>
    </div>
  )
}
