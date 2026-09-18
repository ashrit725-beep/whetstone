/**
 * Open bounties at their loaded geometry: the header and its lede with the
 * terms in it, a three-group filter rail, the result line, and a column of
 * rows with the amount held open in the top right of each one.
 *
 * It sits in the (list) group beside the index page so it wraps only the list.
 * A skeleton above the bounty routes would be flushed with a 200 before a
 * missing id could answer 404.
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
        Loading open bounties.
      </p>
      <div className="flex flex-col gap-sm" aria-hidden="true">
        <Skeleton w="16rem" h="2.4414rem" />
        <div className="measure-ui">
          <Skeleton lines={4} h="1lh" />
        </div>
        <Skeleton w="8rem" h="1lh" />
      </div>
      {/* Area, Amount, State: the rail is three groups deep on the loaded page,
          and the area group lists only the areas that have a bounty in them. */}
      <div className="flex flex-col gap-md border-y border-border-hair py-md" aria-hidden="true">
        <div className="flex flex-col gap-xs">
          <Skeleton w="6rem" h="1lh" />
          <Skeleton w="30rem" h="2.75rem" className="max-w-full" />
        </div>
        <div className="flex flex-col gap-xs">
          <Skeleton w="8rem" h="1lh" />
          <Skeleton w="26rem" h="2.75rem" className="max-w-full" />
        </div>
        <div className="flex flex-col gap-xs">
          <Skeleton w="5rem" h="1lh" />
          <Skeleton w="30rem" h="2.75rem" className="max-w-full" />
        </div>
      </div>
      <Skeleton w="7rem" h="1lh" />
      <ul aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <li
            key={index}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-md gap-y-xs border-t border-border-hair py-lg first:border-t-0 sm:gap-x-xl"
          >
            <Skeleton w="20rem" h="1.75rem" />
            <div className="flex flex-col items-end gap-2xs">
              <Skeleton w="5rem" h="2.25rem" />
              <Skeleton w="5rem" h="0.8125rem" />
            </div>
            <div className="col-span-2 flex min-w-0 flex-col gap-xs sm:col-span-1">
              <Skeleton w="14rem" h="0.8125rem" />
              <Skeleton w="100%" h="1lh" />
              <Skeleton w="16rem" h="1.75rem" />
              <Skeleton w="12rem" h="1.25rem" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
