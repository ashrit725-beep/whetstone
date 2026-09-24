import { Skeleton } from '@/components/ui'

export default function Loading() {
  return (
    <div className="column-prose flex w-full flex-col gap-xl py-xl" aria-busy="true">
      <p role="status" aria-live="polite" className="sr-only">
        Loading the bounty form.
      </p>
      <div className="flex flex-col gap-sm" aria-hidden="true">
        <Skeleton w="14rem" h="2.4414rem" />
        <Skeleton lines={2} h="1lh" />
      </div>
      <div className="flex flex-col gap-lg" aria-hidden="true">
        <Skeleton w="100%" h="5rem" />
        <Skeleton w="100%" h="5rem" />
        <Skeleton w="100%" h="10rem" />
        <Skeleton w="100%" h="5rem" />
        <Skeleton w="100%" h="2.75rem" />
      </div>
    </div>
  )
}
