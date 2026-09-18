/**
 * The handle resolves to nobody, or to a person without a listed rate card, on
 * the rate card itself or on its request form. Their normal profile still shows
 * what they have reviewed, and the list shows who is taking paid work.
 */

import type { Metadata } from 'next'
import { Button, Link } from '@/components/ui'

export const metadata: Metadata = { title: 'Rate card not found' }

export default function ExpertNotFound() {
  // The shell already owns <main id="main">; this is the content column inside
  // it, so the skip link still lands in exactly one place.
  return (
    <div
      className="pad-inline mx-auto flex w-full flex-col items-start gap-lg py-xl"
      style={{ maxInlineSize: 'var(--container-detail)' }}
    >
      <h1 className="text-2xl">No rate card at that handle</h1>
      <p className="measure-ui text-base text-text-2">
        Listing requires at least one verified area, and a reviewer can unlist themselves at any
        time. Their profile still shows what they have reviewed and how it landed.
      </p>
      <div className="flex flex-wrap items-center gap-lg">
        <Button as="a" href="/experts" variant="primary">
          See every listed reviewer
        </Button>
        <Link href="/bounties/new" variant="standalone">
          Post a bounty instead
        </Link>
      </div>
    </div>
  )
}
