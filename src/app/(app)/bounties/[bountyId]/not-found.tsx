/**
 * An id that never was a bounty, or a bounty whose project was taken down.
 * Cancelled bounties still resolve, with their refund in the ledger, so this
 * page does not claim otherwise; the list is the useful destination.
 */

import type { Metadata } from 'next'
import { Button, Link } from '@/components/ui'

export const metadata: Metadata = { title: 'Bounty not found' }

export default function BountyNotFound() {
  // The shell already owns <main id="main">; this is the content column inside
  // it, so the skip link still lands in exactly one place.
  return (
    <div
      className="pad-inline mx-auto flex w-full flex-col items-start gap-lg py-xl"
      style={{ maxInlineSize: 'var(--container-detail)' }}
    >
      <h1 className="text-2xl">No bounty at that address</h1>
      <p className="measure-ui text-base text-text-2">
        The address is wrong, or the project it was posted for has been taken down. Every bounty
        still running, and every one that has finished, is on the list.
      </p>
      <div className="flex flex-wrap items-center gap-lg">
        <Button as="a" href="/bounties" variant="primary">
          See open bounties
        </Button>
        <Link href="/experts" variant="standalone">
          See reviewers taking paid work
        </Link>
      </div>
    </div>
  )
}
