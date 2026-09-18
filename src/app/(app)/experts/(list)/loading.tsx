/**
 * The marketplace at its loaded geometry: a filter rail, a result line, and a
 * column of rate-card rows with the price block held open on the right.
 *
 * It sits in the (list) group beside the index page so it wraps only the list.
 * A skeleton above the rate-card routes would be flushed with a 200 before a
 * missing handle could answer 404.
 */

import { Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <div
      className="pad-inline mx-auto flex w-full flex-col gap-xl py-xl"
      style={{ maxInlineSize: 'var(--container-feed)' }}
      aria-busy="true"
    >
      <p role="status" aria-live="polite" className="sr-only">
        Loading reviewers taking paid work.
      </p>
      <div className="flex flex-col gap-sm" aria-hidden="true">
        <Skeleton w="22rem" h="2.4414rem" />
        <div className="measure-ui">
          <Skeleton lines={3} h="1lh" />
        </div>
        <Skeleton w="10rem" h="1lh" />
      </div>
      {/* Three groups, and the first one wraps to two rows of chips: the same
          block the loaded rail occupies, so the list below does not jump. */}
      <div className="flex flex-col gap-md border-y border-border-hair py-md" aria-hidden="true">
        <div className="flex flex-col gap-xs">
          <Skeleton w="6rem" h="1lh" />
          <Skeleton w="100%" h="2.75rem" />
          <Skeleton w="45%" h="2.75rem" />
        </div>
        <div className="flex flex-col gap-xs">
          <Skeleton w="10rem" h="1lh" />
          <Skeleton w="24rem" h="2.75rem" className="max-w-full" />
        </div>
        <div className="flex flex-col gap-xs">
          <Skeleton w="7rem" h="1lh" />
          <Skeleton w="26rem" h="2.75rem" className="max-w-full" />
        </div>
      </div>
      <Skeleton w="8rem" h="1lh" />
      <ul aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <li
            key={index}
            className="flex flex-col gap-md border-t border-border-hair py-lg first:border-t-0 sm:flex-row sm:items-start sm:justify-between sm:gap-xl"
          >
            <div className="flex min-w-0 flex-1 flex-col gap-sm">
              <div className="flex items-start gap-sm">
                <Skeleton w="2.5rem" h="2.5rem" />
                <div className="flex w-full flex-col gap-3xs">
                  <Skeleton w="12rem" h="1.25rem" />
                  <Skeleton w="8rem" h="0.8125rem" />
                </div>
              </div>
              <Skeleton w="90%" h="1.0625rem" />
              <Skeleton lines={3} h="0.8125rem" />
            </div>
            <div className="flex shrink-0 flex-col gap-xs sm:w-6xl sm:items-end">
              <Skeleton w="7rem" h="2.5rem" />
              <Skeleton w="6rem" h="0.8125rem" />
              <Skeleton w="10rem" h="2.75rem" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
