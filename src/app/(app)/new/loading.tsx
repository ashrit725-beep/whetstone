import { Skeleton, TextSkeleton } from '@/components/ui'

export default function Loading() {
  return (
    <div className="pad-inline w-full" aria-busy="true">
      <div className="mx-auto flex w-full max-w-prose flex-col gap-xl py-xl">
        <p className="sr-only" role="status">
          Loading the project form.
        </p>
        <Skeleton w="18rem" h="2.75rem" radius="sm" />
        <TextSkeleton lines={2} />
        <Skeleton w="100%" h="3.5rem" radius="sm" />
        <div className="flex flex-col gap-lg">
          <Skeleton w="100%" h="4rem" radius="sm" />
          <Skeleton w="100%" h="4rem" radius="sm" />
          <Skeleton w="100%" h="9rem" radius="sm" />
          <Skeleton w="100%" h="4rem" radius="xs" />
        </div>
      </div>
    </div>
  )
}
