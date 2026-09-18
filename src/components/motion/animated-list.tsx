'use client'

/**
 * AnimatedList — items animate in as they arrive.
 *
 * Whetstone's use: a feedback thread while a review is posting, and the
 * notification popover. The point is to show that something ARRIVED, so only
 * genuinely new children animate. Re-renders, reorders and filter changes do
 * not, which is the bug in most versions of this component.
 *
 * Motion: 240ms, opacity plus an 8px rise, 40ms stagger capped at 280ms total
 * so a burst of twenty never turns into a wave. Under reduced motion the
 * animation is removed entirely and items simply appear.
 *
 * Accessibility: the region is a polite live region so a screen reader is told
 * a note arrived without focus moving. If the list is the page's main content
 * rather than an inbox, pass `live="off"`; announcing every row of a feed is
 * noise.
 */

import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface AnimatedListProps {
  children: ReactNode
  /** Stagger between items, ms. Total is capped at 280ms regardless. */
  stagger?: number
  live?: 'polite' | 'off'
  /** Announced when items arrive, e.g. "3 new notes". */
  announce?: (added: number) => string
  /**
   * Which newly rendered keys count as an arrival. Defaults to all of them.
   * A list that also grows for other reasons ("Show all", a server copy
   * replacing an optimistic one) passes a narrower test, so revealing old
   * items is not announced as news.
   */
  isArrival?: (key: string) => boolean
  className?: string
  as?: 'ul' | 'ol' | 'div'
}

const everything = () => true

/** The key the caller wrote, without the prefix `Children.toArray` adds. */
function callerKey(child: ReactNode, index: number): string {
  if (isValidElement(child) && child.key !== null) return String(child.key).replace(/^\.\$/, '')
  return `#${String(index)}`
}

/*
 * Items are tracked by key, not by position. The first version keyed rows by
 * index and treated "past the old length" as new, which animated the wrong row
 * whenever something was prepended or re-sorted, and on first load it treated
 * every row as new and announced the whole thread.
 *
 * An arrival keeps its class for as long as it is on screen. Removing it on the
 * next render (which the announcement itself causes) cut the animation off
 * after one frame; left in place, a finished animation simply holds its end.
 */
export function AnimatedList({
  children,
  stagger = 40,
  live = 'polite',
  announce,
  isArrival = everything,
  className,
  as: Tag = 'ul',
}: AnimatedListProps) {
  const items = Children.toArray(children)
  const keys = items.map(callerKey)

  const mounted = useRef(false)
  const known = useRef<Set<string> | null>(null)
  const arrivals = useRef(new Map<string, number>())
  const announced = useRef(0)
  const [message, setMessage] = useState('')

  if (known.current === null) {
    // What is there on first render was already there: nothing animates.
    known.current = new Set(keys)
  } else if (mounted.current) {
    let slot = 0
    for (const key of keys) {
      if (known.current.has(key)) continue
      known.current.add(key)
      if (isArrival(key)) arrivals.current.set(key, Math.min(slot++, 7))
    }
  }

  useEffect(() => {
    mounted.current = true
  }, [])

  const arrivedCount = arrivals.current.size
  useEffect(() => {
    const fresh = arrivedCount - announced.current
    announced.current = arrivedCount
    if (fresh > 0 && announce) setMessage(announce(fresh))
  }, [arrivedCount, announce])

  const Item = Tag === 'div' ? 'div' : 'li'

  return (
    <>
      {/* No aria-live on the list itself. It wraps every item, so one arriving
          note made a screen reader re-read the whole thread; the sr-only status
          region below says what changed, once, in a sentence. */}
      <Tag className={cn('flex flex-col', className)}>
        {items.map((child, i) => {
          const key = keys[i] ?? `#${String(i)}`
          const slot = arrivals.current.get(key)
          return (
            <Item
              key={key}
              className={slot !== undefined ? 'ws-arrive' : undefined}
              style={slot !== undefined ? ({ '--i': String(slot) } as React.CSSProperties) : undefined}
            >
              {child}
            </Item>
          )
        })}
      </Tag>
      {live === 'polite' && (
        <span role="status" aria-live="polite" className="sr-only">
          {message}
        </span>
      )}
      <style href="ws-animated-list" precedence="medium">{`
        @keyframes ws-arrive { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        .ws-arrive {
          animation: ws-arrive var(--dur-3) var(--ease) both;
          animation-delay: calc(var(--i, 0) * ${String(stagger)}ms);
        }
        @media (prefers-reduced-motion: reduce) { .ws-arrive { animation: none } }
      `}</style>
    </>
  )
}
