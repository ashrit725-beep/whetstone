'use client'

/**
 * Tabs: two modes, because in-page state and route state are different things
 * and pretending otherwise is how you end up with a div that announces itself
 * as a tab and navigates.
 *
 *   mode="aria"    real ARIA tabs for state that lives on the page (the
 *                  composer's categories). Roving tabindex; selection follows
 *                  focus, which is the standard behaviour for tabs whose panels
 *                  are already in the DOM.
 *   mode="links"   route-mapped tabs. A <nav> with links and
 *                  `aria-current="page"`. No tab roles, because activating one
 *                  is a navigation, not a selection.
 *
 * Keyboard contract:
 *   aria mode   Tab enters the strip at the selected tab and Tab again leaves
 *               it, landing in the panel. ArrowLeft / ArrowRight move and
 *               select, wrapping at both ends. Home selects the first tab, End
 *               the last. Disabled tabs are skipped by the arrows but stay
 *               announced.
 *   links mode  plain link semantics: Tab reaches each, Enter follows.
 *
 * Contract notes: the underline moves with `transform: translateX` over 180ms
 * on the entrance curve, and its width is set instantly because width is never
 * animated (§6.2, §6.3). Overflow scrolls, and the scrollable edges are marked
 * with a 1px `border-strong` rule rather than a gradient fade, because the one
 * masked fade the contract allows belongs to the bevel rail (§9.1.5). The
 * selected tab is always scrolled fully into the strip, on arrival and on
 * every change, so a selection is never announced for a tab cut off at the
 * edge. Only the strip scrolls; the page does not move. The focus ring is
 * drawn inside the tab, because the scrolling strip clips anything outside
 * its box and the global ring sits 3px out: on a tab at the strip's end, the
 * keyboard's position showed as one stray vertical line.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export interface TabItem {
  value: string
  label: string
  /** Optional matching-row count, rendered tabular. */
  count?: number
  /** Required in links mode, ignored in aria mode. */
  href?: string
  disabled?: boolean
}

interface TabsCommon {
  tabs: readonly TabItem[]
  /** The selected tab's `value`. */
  value: string
  /** Names the strip. Required in both modes. */
  label: string
  className?: string
}

export interface TabsAriaProps extends TabsCommon {
  mode?: 'aria'
  onValueChange: (next: string) => void
  /** Prefix for the generated tab and panel ids. Must be stable and unique. */
  idBase: string
}

export interface TabsLinksProps extends TabsCommon {
  mode: 'links'
}

export type TabsProps = TabsAriaProps | TabsLinksProps

const TAB_TYPE = { fontVariationSettings: '"wdth" 94, "wght" 600' } as const

export function Tabs(props: TabsProps) {
  const { tabs, value, label, className } = props
  const isLinks = props.mode === 'links'
  const ariaProps = props.mode === 'links' ? null : props

  const stripRef = useRef<HTMLDivElement | null>(null)
  const tabRefs = useRef<Record<string, HTMLElement | null>>({})
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null)
  const [edges, setEdges] = useState<{ start: boolean; end: boolean }>({
    start: false,
    end: false,
  })

  const measure = useCallback(() => {
    const strip = stripRef.current
    const active = tabRefs.current[value]
    if (strip && active) {
      setIndicator({ left: active.offsetLeft, width: active.offsetWidth })
    }
    if (strip) {
      setEdges({
        start: strip.scrollLeft > 1,
        end: strip.scrollLeft + strip.clientWidth < strip.scrollWidth - 1,
      })
    }
  }, [value])

  // Measured from the rendered boxes and rounded outward: `offsetLeft` and
  // `offsetWidth` are whole pixels, and a tab 150.6px wide stopped 1px short
  // of the strip's end, still cut by its edge.
  useEffect(() => {
    const strip = stripRef.current
    const active = tabRefs.current[value]
    if (!strip || !active) return
    const box = strip.getBoundingClientRect()
    const tab = active.getBoundingClientRect()
    if (tab.left < box.left) strip.scrollLeft -= Math.ceil(box.left - tab.left)
    else if (tab.right > box.right) strip.scrollLeft += Math.ceil(tab.right - box.right)
  }, [value])

  useEffect(() => {
    measure()
    const strip = stripRef.current
    if (!strip) return
    const observer = new ResizeObserver(measure)
    observer.observe(strip)
    strip.addEventListener('scroll', measure, { passive: true })
    return () => {
      observer.disconnect()
      strip.removeEventListener('scroll', measure)
    }
  }, [measure])

  /** Walks from `start` in `direction`, skipping disabled tabs, and selects. */
  function selectFrom(start: number, direction: 1 | -1) {
    if (!ariaProps) return
    const count = tabs.length
    if (count === 0) return
    for (let hop = 0; hop < count; hop++) {
      const index = (((start + direction * hop) % count) + count) % count
      const candidate = tabs[index]
      if (!candidate || candidate.disabled) continue
      ariaProps.onValueChange(candidate.value)
      // The effect above brings the tab into the strip by the least distance.
      // The browser's own focus scroll centres it instead, which jumped the
      // strip by half its width on one press and not at all on the next.
      tabRefs.current[candidate.value]?.focus({ preventScroll: true })
      return
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!ariaProps) return
    const current = tabs.findIndex((t) => t.value === value)
    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        selectFrom(current + 1, 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        selectFrom(current - 1, -1)
        break
      case 'Home':
        event.preventDefault()
        selectFrom(0, 1)
        break
      case 'End':
        event.preventDefault()
        selectFrom(tabs.length - 1, -1)
        break
      default:
        break
    }
  }

  const strip = (
    <div className={cn('relative', className)}>
      {/* Edge marks: a hairline that firms up to `border-strong` where there is
          more strip to scroll to. */}
      {edges.start ? (
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-px bg-border-strong" />
      ) : null}
      {edges.end ? (
        <span aria-hidden="true" className="absolute inset-y-0 right-0 w-px bg-border-strong" />
      ) : null}

      <div
        ref={stripRef}
        data-scroll-region
        role={isLinks ? undefined : 'tablist'}
        aria-label={isLinks ? undefined : label}
        aria-orientation={isLinks ? undefined : 'horizontal'}
        onKeyDown={onKeyDown}
        className="relative flex w-full gap-2xs overflow-x-auto border-b border-border-hair"
      >
        {tabs.map((tab) => {
          const selected = tab.value === value
          const shared = cn(
            'relative inline-flex shrink-0 items-center gap-2xs rounded-xs rounded-b-none px-xs py-sm text-sm whitespace-nowrap min-[30rem]:px-sm no-underline transition-[color,background-color] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
            'focus-visible:outline-offset-[-2px]',
            selected ? 'text-text-1' : 'text-text-2',
            tab.disabled
              ? 'cursor-not-allowed text-text-disabled'
              : 'hover:bg-surface-2 hover:text-text-1',
          )
          const inner = (
            <>
              <span>{tab.label}</span>
              {typeof tab.count === 'number' ? (
                <span className="tnum text-text-3">{tab.count.toLocaleString('en')}</span>
              ) : null}
            </>
          )

          if (!ariaProps) {
            // A links-mode tab without a route is a label, not a dead link.
            // `href="#"` is banned outright (§8.3.32).
            if (!tab.href) {
              return (
                <span key={tab.value} className={shared} style={TAB_TYPE}>
                  {inner}
                </span>
              )
            }
            return (
              <Link
                key={tab.value}
                href={tab.href}
                ref={(node) => {
                  tabRefs.current[tab.value] = node
                }}
                aria-current={selected ? 'page' : undefined}
                aria-disabled={tab.disabled || undefined}
                className={shared}
                style={TAB_TYPE}
              >
                {inner}
              </Link>
            )
          }

          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              id={`${ariaProps.idBase}-tab-${tab.value}`}
              aria-controls={`${ariaProps.idBase}-panel-${tab.value}`}
              aria-selected={selected}
              aria-disabled={tab.disabled || undefined}
              tabIndex={selected ? 0 : -1}
              ref={(node) => {
                tabRefs.current[tab.value] = node
              }}
              onClick={() => {
                if (tab.disabled) return
                ariaProps.onValueChange(tab.value)
              }}
              className={shared}
              style={TAB_TYPE}
            >
              {inner}
            </button>
          )
        })}

        {/* One indicator for the whole strip. It slides; it never resizes in
            motion, because width is on the never-animated list. It is ink:
            selection steps the ink, and the mark belongs to the ask, which the
            composer shows directly above these tabs. */}
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute bottom-0 left-0 block h-3xs bg-ink motion-reduce:transition-none',
            indicator ? 'transition-transform duration-[180ms] ease-[cubic-bezier(0.16,1,0.3,1)]' : 'transition-none',
          )}
          style={{
            inlineSize: `${String(indicator?.width ?? 0)}px`,
            transform: `translateX(${String(indicator?.left ?? 0)}px)`,
            opacity: indicator ? 1 : 0,
          }}
        />
      </div>
    </div>
  )

  if (isLinks) {
    return <nav aria-label={label}>{strip}</nav>
  }
  return strip
}

export interface TabPanelProps {
  idBase: string
  /** This panel's tab value. */
  value: string
  /** The strip's currently selected value. */
  activeValue: string
  children: React.ReactNode
  className?: string
}

/**
 * Panels stay mounted and are hidden with the `hidden` attribute, so a form in
 * an unselected panel still posts and an in-progress draft is never discarded
 * by switching tabs.
 */
export function TabPanel({ idBase, value, activeValue, children, className }: TabPanelProps) {
  const selected = value === activeValue
  return (
    <div
      role="tabpanel"
      id={`${idBase}-panel-${value}`}
      aria-labelledby={`${idBase}-tab-${value}`}
      hidden={!selected}
      tabIndex={0}
      className={cn('pt-md', className)}
    >
      {children}
    </div>
  )
}
