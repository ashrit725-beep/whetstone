'use client'

/**
 * Placement note: every component in `src/components/discover/` that draws from
 * `@/components/ui` declares `'use client'`. `src/components/ui/grit.tsx` is a
 * client module, so its exported values (`GRIT_STEPS`, `GRIT_NUMERAL_STYLE`)
 * reach a Server Component as client references rather than as data, and
 * `CoverArt` reads `GRIT_STEPS` at render time. Declaring the boundary here
 * means the row looks the same wherever it is rendered from. The data work all
 * happens in the two page files, which import nothing from the barrel; nothing
 * in this directory uses a hook unless its own contract says so.
 */

/**
 * The loading feed.
 *
 * It is the same `<ul class="ws-feed">` with the same `<li>` grid, the same
 * 48px thumbnail box and the same title, ask and metadata slots, so the row is
 * already at its final height and nothing shifts when the data lands
 * (PLAYBOOK MOVE 1, MOVE 3.8).
 *
 * Keyboard contract: none. The list is `aria-hidden`; the region that owns it
 * carries `aria-busy` and one polite line saying what is loading.
 */

import { Skeleton } from '@/components/ui'

export interface FeedSkeletonProps {
  count?: number
  label?: string
  /** The three-row floor, matching the list it stands in for. Default true. */
  bench?: boolean
}

export function FeedSkeleton({
  count = 8,
  label = 'Loading projects.',
  bench = true,
}: FeedSkeletonProps) {
  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {label}
      </p>
      <ul className={bench ? 'ws-feed ws-bench' : 'ws-feed'} aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <li key={index}>
            <span className="ws-thumb">
              <Skeleton w="100%" h="100%" radius="none" />
            </span>

            <div className="ws-row-body">
              <div className="ws-row-main">
                <div className="ws-title-slot">
                  <Skeleton w={index % 3 === 0 ? '38%' : '46%'} h="1lh" />
                </div>
                <div className="ws-ask-slot">
                  <Skeleton w="92%" h="0.8125rem" />
                  <Skeleton w={index % 2 === 0 ? '64%' : '77%'} h="0.8125rem" />
                </div>
              </div>

              <dl className="ws-meta">
                <div>
                  <div className="ws-dt-slot">
                    <Skeleton w="2.75rem" h="0.6rem" />
                  </div>
                  <div className="ws-dd-slot">
                    <Skeleton w="4.5rem" h="0.8125rem" />
                  </div>
                </div>
                <div>
                  <div className="ws-dt-slot">
                    <Skeleton w="2rem" h="0.6rem" />
                  </div>
                  <div className="ws-dd-slot">
                    <Skeleton w="3.5rem" h="0.8125rem" />
                  </div>
                </div>
                <div>
                  <div className="ws-dt-slot">
                    <Skeleton w="1.75rem" h="0.6rem" />
                  </div>
                  <div className="ws-dd-slot">
                    <Skeleton w="3.25rem" h="1rem" />
                  </div>
                </div>
                <div className="ws-meta-num">
                  <div className="ws-dt-slot">
                    <Skeleton w="2.25rem" h="0.6rem" />
                  </div>
                  <div className="ws-dd-slot">
                    <Skeleton w="1.5rem" h="0.8125rem" />
                  </div>
                </div>
              </dl>
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

export default FeedSkeleton

/* ------------------------------------------------------------- the chrome -- */

/**
 * One rail group: the heading bar, `rows` option rows at their real 44px height,
 * and `note` lines of the explanatory paragraph some groups carry underneath,
 * so the group below starts at the same y in both states.
 */
export function RailGroupSkeleton({ rows, note = 0 }: { rows: number; note?: number }) {
  return (
    <div className="ws-rail-group" aria-hidden="true">
      <Skeleton w="5rem" h="0.75rem" />
      <div className="flex flex-col gap-3xs">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="ws-option">
            <span />
            <Skeleton w={i % 2 === 0 ? '72%' : '58%'} h="0.875rem" />
            <Skeleton w="1.5rem" h="0.8125rem" />
          </div>
        ))}
      </div>
      {note > 0 ? <NoteSkeleton lines={note} /> : null}
    </div>
  )
}

/** The one-to-three-line paragraph under a rail heading, at its real leading. */
export function NoteSkeleton({ lines }: { lines: number }) {
  return (
    <div className="ws-note-slot" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} w={i === lines - 1 ? '62%' : '100%'} h="1lh" />
      ))}
    </div>
  )
}

/** The grit rail, at the exact five-cell geometry it will take. */
export function GritRailSkeleton() {
  return (
    <div className="ws-rail-group" aria-hidden="true">
      <Skeleton w="3rem" h="0.75rem" />
      <NoteSkeleton lines={2} />
      <div className="ws-grit-rail">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="ws-grit-cell">
            <Skeleton w="3.25rem" h="1.5rem" radius="none" />
            <span />
            <Skeleton w="70%" h="0.875rem" />
            <Skeleton w="1.25rem" h="0.8125rem" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * The search form, drawn as `Field` draws it: a `flex-col gap-2xs` of label,
 * hint line, the 44px field-and-submit row, and the helper slot Field reserves
 * permanently so an appearing error never pushes the page down (§5.5). Without
 * the hint and the helper the placeholder stood 54px short and the whole feed
 * jumped up the moment the data landed.
 */
export function SearchFormSkeleton() {
  return (
    <div className="ws-search flex flex-col gap-2xs" aria-hidden="true">
      <div className="ws-label-slot">
        <Skeleton w="8rem" h="1lh" />
      </div>
      <div className="ws-hint-slot">
        <Skeleton w="14rem" h="1lh" />
      </div>
      <div className="ws-search-row">
        <Skeleton h="2.75rem" radius="sm" />
        <Skeleton w="7rem" h="2.75rem" radius="sm" />
      </div>
      <div className="ws-hint-slot" />
    </div>
  )
}

/** The sticky result line, at the height the sentence will occupy. */
export function ResultLineSkeleton() {
  return (
    <div className="ws-filterbar">
      <div className="ws-summary-line" aria-hidden="true">
        <Skeleton w="14rem" h="1.3125rem" />
      </div>
    </div>
  )
}

/**
 * The accelerator hint that sits between the result line and the first row.
 * It carries `.ws-hint`, so it disappears at exactly the widths and pointer
 * types the real one does and the feed starts at the same y in both states.
 */
export function ShortcutHintSkeleton() {
  return (
    <p className="ws-hint mt-sm mb-xs text-xs" aria-hidden="true">
      <Skeleton w="22rem" h="1lh" />
    </p>
  )
}

/** The "Load more projects" slot under the feed, at the button's 44px height. */
export function FeedFooterSkeleton() {
  return (
    <div className="mt-lg flex flex-col items-start gap-xs" aria-hidden="true">
      <Skeleton w="13rem" h="2.75rem" radius="sm" />
    </div>
  )
}
