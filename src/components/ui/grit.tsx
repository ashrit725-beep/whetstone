/**
 * The grit index. Whetstone's one structural idea, rendered.
 *
 * A waterstone is graded by how coarse it is: 120 grit hogs metal off, 8000
 * polishes an edge you can shave with. A project is graded the same way. The
 * hatch gets finer as the work gets finer, and the numeral is always beside it,
 * because the hatch is a picture of the number and never a substitute for it
 * (§5.7). The same five steps are the Discover filter, the Project-detail rail,
 * the composer's selector, the dashboard axis, the profile history strip and
 * the marketplace segmentation. One idea, carried everywhere.
 *
 * Keyboard contract:
 *   GRIT_STEPS, GritHatch, GritChip, GritRail, GritHistoryStrip: no keyboard
 *     surface. GritHatch is `aria-hidden`; GritRail and GritHistoryStrip expose
 *     their data as text, not as a picture to be explored.
 *   GritScale: an ARIA radiogroup with a roving tabindex. Tab enters the group
 *     at the checked cell (or the first cell when nothing is checked) and Tab
 *     leaves the group entirely. ArrowRight / ArrowDown move to the next cell
 *     and select it; ArrowLeft / ArrowUp move to the previous cell and select
 *     it; Home selects the first, End the last; Space and Enter select the
 *     focused cell. Selection follows focus, which is the standard radio
 *     behaviour and the reason a coarse-to-fine scale is a radiogroup rather
 *     than five buttons.
 *
 * This module ships no `'use client'` directive and must not: it renders on
 * the server on every feed row. The one interactive member of the family,
 * `GritScale`, lives in `./grit-scale` because it needs a ref for its roving
 * tabindex, which would pull the whole hatch into the client bundle for no
 * gain. The only hook here is `useId`, which Server Components support. The
 * pure parts render in Server Components; GritScale is interactive and must be
 * rendered from inside a client module (the composer), which compiles it into
 * that client graph.
 */

import { useId } from 'react'
import { cn } from '@/lib/utils'

export const GRIT_VALUES = [120, 400, 1000, 3000, 8000] as const
export type GritValue = (typeof GRIT_VALUES)[number]

export type GritKey = 'concept' | 'prototype' | 'beta' | 'release-candidate' | 'shipped'

export interface GritStep {
  /** The real number. It is sortable data, not ornament. */
  value: GritValue
  key: GritKey
  label: string
  /** One sentence, written for the composer's selector. */
  description: string
  /** SVG stroke width in user units, per §5.7. */
  strokeWidth: number
  /** Distance between strokes in user units. Halves at every step. */
  spacing: number
}

export const GRIT_STEPS: readonly GritStep[] = [
  {
    value: 120,
    key: 'concept',
    label: 'Concept',
    description: 'An idea and a sketch. Nothing is running yet.',
    strokeWidth: 3,
    spacing: 16,
  },
  {
    value: 400,
    key: 'prototype',
    label: 'Prototype',
    description: 'It runs. The shape is there and most of the detail is still rough.',
    strokeWidth: 2,
    spacing: 8,
  },
  {
    value: 1000,
    key: 'beta',
    label: 'Beta',
    description: 'Feature-complete enough for strangers to use it unsupervised.',
    strokeWidth: 1.25,
    spacing: 4,
  },
  {
    value: 3000,
    key: 'release-candidate',
    label: 'Release candidate',
    description: 'You would ship this if nobody found anything today.',
    strokeWidth: 0.75,
    spacing: 2,
  },
  {
    value: 8000,
    key: 'shipped',
    label: 'Shipped',
    description: 'Out in the world. Feedback here is for the next pass.',
    strokeWidth: 0.5,
    spacing: 1,
  },
] as const

const FALLBACK_STEP: GritStep = {
  value: 120,
  key: 'concept',
  label: 'Concept',
  description: 'An idea and a sketch. Nothing is running yet.',
  strokeWidth: 3,
  spacing: 16,
}

export function isGritValue(n: number): n is GritValue {
  return GRIT_VALUES.some((v) => v === n)
}

/** Never throws: an out-of-range value snaps to the nearest real step. */
export function gritStep(value: number): GritStep {
  const exact = GRIT_STEPS.find((s) => s.value === value)
  if (exact) return exact
  let best: GritStep = GRIT_STEPS[0] ?? FALLBACK_STEP
  for (const s of GRIT_STEPS) {
    if (Math.abs(s.value - value) < Math.abs(best.value - value)) best = s
  }
  return best
}

export function gritLabel(value: number): string {
  return gritStep(value).label
}

/** "1000 of 8000, beta": the accessible name every grit surface reuses. */
export function gritDescription(value: number): string {
  const step = gritStep(value)
  return `${String(step.value)} of 8000, ${step.label.toLowerCase()}`
}

/**
 * Grit numerals turn on the slashed zero so 120 and 1000 cannot be misread at
 * 12px, and stay tabular so a column of them lines up (§3.4).
 */
export const GRIT_NUMERAL_STYLE = {
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1, "zero" 1',
} as const

const GRIT_LABEL_STYLE = { fontVariationSettings: '"wdth" 87, "wght" 600' } as const

/* -------------------------------------------------------------- the hatch -- */

export interface GritHatchProps {
  value: number
  /**
   * Which way the strokes lean. `horizontal` (45°) is the default and is what
   * chips, cover art and strips use; `vertical` (135°) leans the other way and
   * is used by the full-height bevel rail so the rail reads as a different
   * object from the chips beside it.
   */
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

/**
 * A tiling field of diagonal strokes at this grit's width and spacing. Fills
 * whatever box it is given, at any size, because it is an SVG <pattern> in user
 * space rather than a scaled drawing: a 16px chip and a 600px rail get strokes
 * of exactly the same weight.
 *
 * Every hatch owns its pattern. `url(#id)` resolves to the first element in
 * the document with that id, and a paint server inside a hidden subtree paints
 * nothing, so when ids were derived from the props alone, one copy in the
 * collapsed Discover rail or an unselected composer tab blanked every hatch of
 * that grit on the page. It is `aria-hidden` because the numeral beside it is
 * the real information.
 *
 * The stroke sits half a period into its tile. At the tile's edge, the 120
 * grit's one stroke per 16px fell on the corners of a 16 x 12 chip and left
 * two specks; half a period in, it crosses the middle of the chip.
 */
export function GritHatch({ value, orientation = 'horizontal', className }: GritHatchProps) {
  const step = gritStep(value)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const patternId = `ws-grit-${String(step.value)}-${orientation}-${uid}`
  const angle = orientation === 'vertical' ? 135 : 45
  const x = step.spacing / 2 + step.strokeWidth / 2

  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('block h-full w-full text-hatch', className)}
    >
      <defs>
        <pattern
          id={patternId}
          width={step.spacing}
          height={step.spacing}
          patternUnits="userSpaceOnUse"
          patternTransform={`rotate(${String(angle)})`}
        >
          <line
            x1={x}
            y1={0}
            x2={x}
            y2={step.spacing}
            stroke="currentColor"
            strokeWidth={step.strokeWidth}
            shapeRendering="crispEdges"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}

/* --------------------------------------------------------------- the chip -- */

export interface GritChipProps {
  value: number
  size?: 'sm' | 'md'
  /** Show the stage word beside the numeral. Off, it is still announced. */
  showLabel?: boolean
  className?: string
}

/**
 * The hatch plus the literal numeral. The pairing is the rule: the hatch never
 * carries the value on its own, in any surface, at any size (§5.7).
 */
export function GritChip({ value, size = 'md', showLabel = false, className }: GritChipProps) {
  const step = gritStep(value)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2xs rounded-xs border border-border-control bg-surface-2 text-text-2',
        size === 'sm' ? 'px-3xs py-3xs text-2xs' : 'px-2xs py-3xs text-2xs',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'block shrink-0 overflow-hidden rounded-none bg-surface-0',
          size === 'sm' ? 'h-sm w-md' : 'h-md w-lg',
        )}
      >
        <GritHatch value={step.value} />
      </span>
      <span className="sr-only">Grit index </span>
      <span className="text-text-1" style={GRIT_NUMERAL_STYLE}>
        {step.value}
      </span>
      {showLabel ? (
        <span className="text-text-3" style={GRIT_LABEL_STYLE}>
          {step.label}
        </span>
      ) : (
        <span className="sr-only">, {step.label.toLowerCase()}</span>
      )}
    </span>
  )
}

/* --------------------------------------------------------------- the rail -- */

/**
 * The one sanctioned mask fade in the product (§9.1.5). It is a mask, not a
 * background: it removes the rail's ends so the hatch does not collide with the
 * nav above it or the footer below it.
 */
const RAIL_MASK = 'linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)'

export interface GritRailProps {
  value: number
  className?: string
}

/**
 * Project detail's left-gutter bevel rail: 3rem wide, full height, the stroke
 * stepping 3px → 0.5px down all five grades, with this project's position
 * marked by the 2px grind-mark and its numeral in full ink.
 *
 * This is the one bold element on that surface. Everything else there is
 * hairlines and type.
 */
export function GritRail({ value, className }: GritRailProps) {
  const active = gritStep(value)
  return (
    <div
      role="img"
      aria-label={`Grit index: this project is at ${gritDescription(active.value)}. The scale runs 120–8000.`}
      className={cn('relative w-2xl self-stretch', className)}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 flex flex-col overflow-hidden rounded-none bg-surface-0"
        style={{ maskImage: RAIL_MASK, WebkitMaskImage: RAIL_MASK }}
      >
        {GRIT_STEPS.map((step) => (
          <div key={step.key} className="relative min-h-0 grow">
            <GritHatch value={step.value} orientation="vertical" />
          </div>
        ))}
      </div>

      <div aria-hidden="true" className="absolute inset-0 flex flex-col">
        {GRIT_STEPS.map((step) => {
          const isActive = step.value === active.value
          return (
            <div
              key={step.key}
              className={cn(
                'relative flex min-h-0 grow items-center justify-center',
                isActive && 'grind-mark-on',
              )}
            >
              <span
                className={cn(
                  'rounded-xs border px-3xs text-2xs',
                  isActive
                    ? 'border-border-control bg-surface-1 text-text-1'
                    : 'border-transparent bg-surface-1 text-text-3',
                )}
                style={GRIT_NUMERAL_STYLE}
              >
                {step.value}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------ the history -- */

export interface GritHistoryStripProps {
  /** Projects this person has carried to each stage. Missing keys read as 0. */
  counts: Partial<Record<GritValue, number>>
  className?: string
}

/**
 * The public profile's organising element: not a badge wall, not a giant
 * number, but the same five-step scale showing how far this person's work
 * actually gets. A creator with forty concepts and one shipped project reads
 * differently from one with five shipped, at a glance, in greyscale.
 *
 * Each cell is a subgrid of the strip's three rows (bar, stage, count), so the
 * counts share one baseline however the stage names wrap. The numeral sits
 * above the name, so "3000 Release candidate" wraps within its own 64px track
 * at 390 instead of printing over the cell beside it.
 */
export function GritHistoryStrip({ counts, className }: GritHistoryStripProps) {
  const values = GRIT_STEPS.map((s) => counts[s.value] ?? 0)
  const max = Math.max(1, ...values)

  return (
    <dl className={cn('grid grid-cols-5 grid-rows-[auto_auto_auto] gap-2xs', className)}>
      {GRIT_STEPS.map((step, index) => {
        const count = values[index] ?? 0
        const share = Math.round((count / max) * 100)
        return (
          <div key={step.key} className="row-span-3 grid min-w-0 grid-rows-subgrid">
            <div
              aria-hidden="true"
              className="relative flex h-2xl items-end overflow-hidden rounded-none border border-border-hair bg-surface-0"
            >
              <div
                className="relative w-full"
                style={{ blockSize: count === 0 ? '1px' : `${String(Math.max(share, 6))}%` }}
              >
                {count === 0 ? (
                  <div className="h-full w-full bg-border-hair" />
                ) : (
                  <GritHatch value={step.value} />
                )}
              </div>
            </div>
            <dt className="flex min-w-0 flex-col text-2xs text-text-3">
              <span className="text-text-2" style={GRIT_NUMERAL_STYLE}>
                {step.value}
              </span>
              <span style={GRIT_LABEL_STYLE} className="min-w-0 break-words">
                {step.label}
              </span>
            </dt>
            <dd className="text-xs text-text-1">
              <span className="tnum">{count.toLocaleString('en')}</span>{' '}
              <span className="text-text-3">{count === 1 ? 'project' : 'projects'}</span>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
