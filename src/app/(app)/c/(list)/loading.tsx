/**
 * Geometry-matched skeleton for the channel index: the same header block and the
 * same row register, so nothing moves when the channels land.
 *
 * It lives in the `(list)` group with the index page so that it wraps the index
 * alone. At `c/loading.tsx` it was the loading boundary above every channel and
 * thread, and a boundary above a page flushes a 200 before that page can call
 * `notFound()`, so a mistyped channel or thread address answered as a soft 404.
 * The channel, thread and composer routes have no loading.tsx for that reason.
 */

import { Skeleton } from '@/components/ui'
import { DiscussionStyles } from '@/components/discussions/discussion-styles'

const ROWS = ['a', 'b', 'c', 'd', 'e', 'f']

export default function LoadingDiscussionsIndex() {
  // The shell already owns <main id="main">; this is the content column inside
  // it, so the skip link still lands in exactly one place.
  return (
    <div aria-busy="true" className="pad-inline mx-auto w-full max-w-feed py-xl">
      <DiscussionStyles />
      <p role="status" className="sr-only">
        Loading the discussion channels.
      </p>

      <div className="flex flex-col gap-sm">
        <Skeleton w="14rem" h="2.75rem" radius="sm" />
        <Skeleton w="32rem" h="3.1rem" radius="xs" className="max-w-full" />
      </div>

      <ul className="ws-register mt-xl" aria-hidden="true">
        {ROWS.map((key) => (
          <li key={key} className="ws-row ws-channel-row">
            <div className="track-safe flex flex-col gap-2xs">
              <Skeleton w="11rem" h="1.75rem" radius="xs" />
              <Skeleton w="26rem" h="1.2rem" radius="xs" className="max-w-full" />
            </div>
            <div className="ws-row-side">
              <Skeleton w="3rem" h="2.4rem" radius="xs" />
              <Skeleton w="3rem" h="2.4rem" radius="xs" />
              <Skeleton w="7rem" h="2.4rem" radius="xs" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
