'use client'

/**
 * The persistent filter rail's container. At ≥60rem it is its own scroll region,
 * one viewport tall (see `.ws-aside` in discover-styles), and a region that is
 * cut off at the bottom of the screen has to say that it continues: this marks
 * it `data-more-below` while there is rail below the fold, which draws a short
 * fade into the paper. Below 60rem the rail does not scroll, so it never is.
 *
 * The attribute is measured, not guessed. A ResizeObserver catches the viewport
 * and the rail's own content changing height (the saved-search form opening,
 * say) and the scroll listener catches the reader reaching the end. With
 * JavaScript off the rail still scrolls; it only lacks the cue.
 *
 * Keyboard contract: the region takes one tab stop so it can be scrolled with
 * the arrow keys (SC 2.1.1). Its name comes from the heading it is labelled by.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'

export interface FilterAsideProps {
  /** Id of the heading that names the region. */
  labelledBy: string
  children: ReactNode
}

export function FilterAside({ labelledBy, children }: FilterAsideProps) {
  const ref = useRef<HTMLElement>(null)
  const [moreBelow, setMoreBelow] = useState(false)

  useEffect(() => {
    const aside = ref.current
    if (!aside) return
    // One pixel of slack: fractional scroll positions never quite reach the end.
    const measure = () => setMoreBelow(aside.scrollHeight - aside.scrollTop - aside.clientHeight > 1)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(aside)
    for (const child of Array.from(aside.children)) observer.observe(child)
    aside.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      aside.removeEventListener('scroll', measure)
    }
  }, [])

  return (
    <aside
      ref={ref}
      className="ws-aside"
      aria-labelledby={labelledBy}
      tabIndex={0}
      data-more-below={moreBelow ? 'true' : undefined}
    >
      {children}
    </aside>
  )
}

export default FilterAside
