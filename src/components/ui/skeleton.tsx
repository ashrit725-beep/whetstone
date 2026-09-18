/**
 * Skeleton: loading geometry that matches loaded geometry, box for box.
 *
 * Keyboard contract: none. Skeletons are `aria-hidden` and never focusable.
 * Announcement is the caller’s job: pass `label` to a composite skeleton and it
 * renders one polite status line, or set `aria-busy` on the region you own.
 *
 * Motion: a pure-CSS opacity pulse on an overlay layer. Nothing animates
 * width, height, background-position or filter. Under
 * `prefers-reduced-motion: reduce` the pulse is removed entirely and the
 * skeleton becomes a static tint (contract §6.4).
 *
 * Recorded deviation (contract §6.1, the 400ms ceiling): the pulse cycle is
 * 1200ms. A cycle inside the ceiling would flash at 2.5&nbsp;Hz, which is
 * inside the range SC 2.3.1 exists to prevent. §6.4 exempts functional loading
 * motion; accessibility wins over the ceiling here.
 */

import { cn } from '@/lib/utils'

const SKELETON_CSS = `
@keyframes whetstone-skeleton-pulse {
  0%, 100% { opacity: 0; }
  50%      { opacity: 1; }
}
.whetstone-skeleton { display: block; position: relative; overflow: hidden; background-color: var(--color-surface-0); }
.whetstone-skeleton::after {
  content: "";
  position: absolute;
  inset: 0;
  background-color: var(--color-surface-2);
  opacity: 0;
}
@media (prefers-reduced-motion: no-preference) {
  .whetstone-skeleton::after {
    animation: whetstone-skeleton-pulse 1200ms cubic-bezier(0.4, 0, 0.2, 1) infinite;
  }
}
@media (prefers-reduced-motion: reduce) {
  .whetstone-skeleton::after { animation: none; opacity: 0.55; }
}
`

function SkeletonStyles() {
  return (
    <style href="whetstone-skeleton" precedence="medium">
      {SKELETON_CSS}
    </style>
  )
}

/* `full` exists for one job: standing in for an `<img>` avatar, the only round
   thing in Whetstone. Never use it for a button, chip or status dot. */
const RADIUS = {
  none: 'rounded-none',
  xs: 'rounded-xs',
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
} as const

export type SkeletonRadius = keyof typeof RADIUS

export interface SkeletonProps {
  /** Any CSS inline-size. Defaults to filling the track. */
  w?: string
  /** Any CSS block-size. Defaults to one line box. */
  h?: string
  radius?: SkeletonRadius
  /** Render this many stacked bars, the last one short, like real prose. */
  lines?: number
  className?: string
}

/**
 * One skeleton bar, or `lines` of them. Geometry is passed as real CSS lengths
 * because a skeleton must match the thing it stands in for exactly; the spacing
 * scale governs the gaps between bars, not the bars themselves. A width is
 * capped at the container, because the text it stands in for wraps there: a
 * `46ch` lede bar ran 108px past a 390px screen while the page streamed.
 *
 * Bars are block-level spans, not divs, because a bar usually stands in for
 * text and so sits inside the element that will hold the text: a `<div>` in a
 * `<p>` is invalid HTML, and React reports it as a hydration error.
 */
export function Skeleton({ w, h = '1lh', radius = 'xs', lines, className }: SkeletonProps) {
  if (typeof lines === 'number' && lines > 1) {
    return (
      <span aria-hidden="true" className={cn('flex flex-col gap-2xs', className)}>
        <SkeletonStyles />
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            className={cn('whetstone-skeleton', RADIUS[radius])}
            style={{ inlineSize: i === lines - 1 ? '62%' : (w ?? '100%'), maxInlineSize: '100%', blockSize: h }}
          />
        ))}
      </span>
    )
  }

  return (
    <span
      aria-hidden="true"
      className={cn('whetstone-skeleton', RADIUS[radius], className)}
      style={{ inlineSize: w ?? '100%', maxInlineSize: '100%', blockSize: h }}
    >
      <SkeletonStyles />
    </span>
  )
}

function LoadingLabel({ label }: { label?: string }) {
  if (!label) return null
  return (
    <p role="status" aria-live="polite" className="sr-only">
      {label}
    </p>
  )
}

export interface TextSkeletonProps {
  lines?: number
  className?: string
  label?: string
}

/** Prose placeholder. Line height matches Literata prose at 1.65. */
export function TextSkeleton({ lines = 3, className, label }: TextSkeletonProps) {
  return (
    <div className={cn('measure-prose', className)}>
      <LoadingLabel label={label} />
      <Skeleton lines={lines} h="1.0625rem" radius="xs" />
    </div>
  )
}

export interface FeedRowSkeletonProps {
  /** How many rows the real list will show. */
  count?: number
  className?: string
  label?: string
}

/**
 * Discover feed row: 4.5rem tall, 8px radius, 48px thumbnail at 2px radius,
 * hairline separation. Identical geometry to the loaded row (contract §4.4).
 */
export function FeedRowSkeleton({ count = 6, className, label }: FeedRowSkeletonProps) {
  return (
    <div className={cn('w-full', className)}>
      <LoadingLabel label={label} />
      <ul className="list-none m-0 p-0">
        {Array.from({ length: count }, (_, i) => (
          <li
            key={i}
            aria-hidden="true"
            className="grid items-center gap-sm rounded-md border-b border-border-hair px-sm"
            style={{ blockSize: '4.5rem', gridTemplateColumns: '3rem minmax(0, 1fr) auto' }}
          >
            <Skeleton w="3rem" h="3rem" radius="xs" />
            <div className="track-safe flex flex-col gap-2xs">
              <Skeleton w="42%" h="0.875rem" />
              <Skeleton w="78%" h="0.8125rem" />
            </div>
            <Skeleton w="3.5rem" h="1.5rem" radius="xs" />
          </li>
        ))}
      </ul>
    </div>
  )
}

export interface CardSkeletonProps {
  /** Media block above the text, for cards that carry a thumbnail. */
  media?: boolean
  lines?: number
  className?: string
  label?: string
}

/** Card placeholder: surface-3, 1px hairline, 8px radius, no shadow. */
export function CardSkeleton({ media = false, lines = 2, className, label }: CardSkeletonProps) {
  return (
    <div className={cn('rounded-md border border-border-hair bg-surface-3 p-md', className)}>
      <LoadingLabel label={label} />
      <div aria-hidden="true" className="flex flex-col gap-sm">
        {media ? <Skeleton h="9rem" radius="xs" /> : null}
        <Skeleton w="56%" h="1.25rem" />
        <Skeleton lines={lines} h="0.875rem" />
      </div>
    </div>
  )
}

export interface TableSkeletonProps {
  columns: number
  rows?: number
  className?: string
  label?: string
}

/**
 * Dense table placeholder: 0px cell radius, zebra stripe on surface-2, a header
 * band, and one bar per cell. Column count must match the real table so the
 * header does not jump when data lands.
 */
export function TableSkeleton({ columns, rows = 6, className, label }: TableSkeletonProps) {
  const cols = Math.max(1, columns)
  return (
    <div className={cn('w-full overflow-x-auto', className)} data-scroll-region tabIndex={0}>
      <LoadingLabel label={label} />
      <div
        aria-hidden="true"
        className="min-w-0"
        style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: cols }, (_, c) => (
          <div key={`h-${c}`} className="border-b border-border-control bg-surface-2 px-sm py-xs">
            <Skeleton w="64%" h="0.75rem" radius="none" />
          </div>
        ))}
        {Array.from({ length: rows }, (_, r) =>
          Array.from({ length: cols }, (_, c) => (
            <div
              key={`${r}-${c}`}
              className={cn('border-b border-border-hair px-sm py-sm', r % 2 === 1 && 'bg-surface-2')}
            >
              <Skeleton w={c === 0 ? '82%' : '48%'} h="0.875rem" radius="none" />
            </div>
          )),
        )}
      </div>
    </div>
  )
}

export default Skeleton
