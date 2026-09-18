/**
 * The Paper & Ink primitives this surface is built from.
 *
 * Server-safe, every one of them. They exist because `components/ui` is shared
 * with surfaces still on the previous token names and must not be rewritten
 * from here; these are small, local, and written against the real tokens
 * (`paper`, `ink`, `rule`, `mark`) only.
 *
 * The one idea running through all of it: ink density is the grit scale. A cell
 * at 120 is nearly blank paper and a cell at 8000 is solid ink, so how finished
 * a thing is and how finished it looks are the same fact.
 */

import { GRIT_SCALE } from './grit-values'

/** Ink fraction per grit step: concept is an outline, shipped is solid. */
export const INK_DENSITY: readonly number[] = [0.1, 0.26, 0.48, 0.74, 1]

export function gritIndex(grit: number): number {
  const i = GRIT_SCALE.findIndex((rung) => rung.value === grit)
  return i < 0 ? 0 : i
}

export function gritLabel(grit: number): string {
  return GRIT_SCALE[gritIndex(grit)]?.label ?? 'Concept'
}

/* ------------------------------------------------------------------ labels */

/** A ruled section label. Never a filled pill: the rule does the work. */
export function SectionLabel({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <div className="flex items-baseline gap-4">
      <span id={id} className="eyebrow text-ink-3">
        {children}
      </span>
      <span aria-hidden="true" className="h-px min-w-0 flex-1 bg-rule" />
    </div>
  )
}

/* ----------------------------------------------------------- the grit mark */

/**
 * Five cells at the five ink densities, the project's own step outlined and
 * taller, beside the literal numeral. The outline is what carries the reading
 * in greyscale; the density alone would not.
 */
export function GritReading({
  grit,
  showLabel = true,
  className,
}: {
  grit: number
  showLabel?: boolean
  className?: string
}) {
  const here = gritIndex(grit)
  const label = gritLabel(grit)

  return (
    <span className={className ? `ws-grit ${className}` : 'ws-grit'}>
      <span aria-hidden="true" className="flex items-end gap-[2px]">
        {INK_DENSITY.map((d, i) => (
          <span
            key={GRIT_SCALE[i]?.key ?? i}
            className="grit-cell"
            data-on={i === here ? 'true' : 'false'}
            style={{ ['--d' as string]: String(d) }}
          />
        ))}
      </span>
      <span className="tnum text-sm font-bold text-ink">{grit}</span>
      {showLabel ? <span className="eyebrow text-ink-3">{label}</span> : null}
      <span className="sr-only">{`Grit ${String(grit)}, ${label.toLowerCase()}, step ${String(here + 1)} of 5.`}</span>
    </span>
  )
}

/* ---------------------------------------------------------------- identity */

/**
 * A square inked tile with initials. Square because there is exactly one round
 * thing in this product and it is a real uploaded photograph.
 */
export function Initials({
  name,
  src,
  size = 'md',
}: {
  name: string
  src?: string | null
  size?: 'sm' | 'md' | 'lg'
}) {
  // Sizes are written as explicit lengths, not scale steps: this product
  // redefines --spacing-1..11 as the design's own 4-to-192px ramp, so `w-32`
  // means 128px here and a "40px avatar" written that way is a 128px avatar.
  const px = size === 'lg' ? 56 : size === 'sm' ? 28 : 40
  const box =
    size === 'lg'
      ? 'h-[3.5rem] w-[3.5rem] text-sm'
      : size === 'sm'
        ? 'h-[1.75rem] w-[1.75rem] text-2xs'
        : 'h-[2.5rem] w-[2.5rem] text-xs'
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={px}
        height={px}
        className={`${box} shrink-0 rounded-full border-[1.5px] border-ink object-cover`}
      />
    )
  }
  return (
    <span
      aria-hidden="true"
      className={`${box} inline-flex shrink-0 items-center justify-center rounded-xs border-[1.5px] border-ink bg-paper-hi font-bold tracking-[0.06em] text-ink`}
    >
      {initialsOf(name)}
    </span>
  )
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return (first + second).toUpperCase()
}

/* -------------------------------------------------------------------- data */

/** Plain-English list joining, so no sentence on this surface reads as code. */
export function joinWords(items: readonly string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0] ?? ''} and ${items[1] ?? ''}`
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1] ?? ''}`
}

export function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}
