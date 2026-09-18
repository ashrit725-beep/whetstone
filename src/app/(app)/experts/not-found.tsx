/**
 * The reviewer market's own 404, for a `notFound()` under `/experts` that no
 * closer boundary catches. A handle that does not resolve is caught one level
 * down, by `[handle]/not-found.tsx`, which covers the request route too.
 */

import type { Metadata } from 'next'
import { Button, Link } from '@/components/ui'

export const metadata: Metadata = { title: 'Not in the reviewer market' }

export default function ExpertsNotFound() {
  // The shell already owns <main id="main">; this is the content column inside
  // it, so the skip link still lands in exactly one place.
  return (
    <div
      className="pad-inline mx-auto flex w-full flex-col items-start gap-lg py-xl"
      style={{ maxInlineSize: 'var(--container-detail)' }}
    >
      <h1 className="text-2xl">Nothing at that address in the reviewer market</h1>
      <p className="measure-ui text-base text-text-2">
        A reviewer can unlist their rate card at any time, and its address stops resolving when they
        do. The list shows everyone taking paid work right now.
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
