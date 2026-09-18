/**
 * CoverMark: the 48px cover for a Discover row.
 *
 * Why this exists rather than `@/components/ui/cover-art`: `CoverArt` draws in a
 * 480×300 viewBox and is placed with `preserveAspectRatio="xMidYMid slice"`, so
 * a 48px square renders it at scale 0.16. At that scale the grit ladder
 * disappears — 8000 grit is a 0.5px stroke on 1px spacing, which lands at 0.08px
 * on 0.16px, and 3000 and 1000 are no better — the 1px hairline rules become
 * 0.16px and the 2px grind-mark becomes 0.32px. Every cover in the feed
 * therefore resolved to the same flat grey square. The defect and its fix are
 * recorded in `design/PRIMITIVE-DEFECTS.md`; this is the local work-around, and
 * `CoverArt` is left untouched for the surfaces that draw it large, where it is
 * correct.
 *
 * So this module draws at 1:1 in a 48-unit square and picks its stroke widths
 * and spacings from a ladder chosen to survive there. It keeps the grit
 * language — hatch fields, hairline edges, one confident bevel line — and adds
 * nothing chromatic: the accent budget (§2.4.5, one accent-filled element per
 * viewport) belongs to the grind-mark on the current row, not to twenty
 * thumbnails.
 *
 * What makes two covers read as different pictures rather than two greys:
 * adjacent zones are forced at least two density steps and a quarter turn
 * apart, so every mark contains one coarse field against one fine one, and one
 * zone is left as bare ground so there is somewhere for the eye to rest.
 *
 * Determinism: every choice comes from `hashCode(seed)` through mulberry32, so a
 * project's cover is identical on every render and on every machine.
 *
 * Keyboard contract: none. It is a decorative picture; the title sits beside it.
 */

import { cn, hashCode } from '@/lib/utils'

const VIEW = 48

/** Stroke and spacing pairs that still resolve as separate marks at 48px. */
const DENSITIES = [
  { spacing: 12, stroke: 3 },
  { spacing: 8, stroke: 2 },
  { spacing: 5, stroke: 1.25 },
  { spacing: 3, stroke: 0.75 },
] as const

const ANGLES = [0, 45, 90, 135] as const

interface Band {
  readonly start: number
  readonly size: number
  /** Index into DENSITIES, or null for bare ground. */
  readonly density: number | null
  readonly angle: number
}

/** mulberry32. Small, fast, identical in every JavaScript runtime. */
function makeRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(random: () => number, options: readonly [T, ...T[]]): T {
  return options[Math.floor(random() * options.length)] ?? options[0]
}

/**
 * Two or three bands across the square. The first band's density is free; each
 * following one is forced at least two steps finer or coarser and a quarter
 * turn round, which is what stops a cover resolving to one even texture.
 */
function buildBands(random: () => number): Band[] {
  const count = random() < 0.42 ? 3 : 2
  const cuts =
    count === 2
      ? [pick(random, [16, 18, 24, 30, 32] as const)]
      : (() => {
          const first = pick(random, [12, 16, 18] as const)
          return [first, first + pick(random, [12, 16, 18, 22] as const)]
        })()

  const edges = [0, ...cuts, VIEW]
  const bare = Math.floor(random() * (count + 1)) // count + 1 means "no bare band"
  let density = Math.floor(random() * DENSITIES.length)
  let angle = ANGLES[Math.floor(random() * ANGLES.length)] ?? 45

  const bands: Band[] = []
  for (let i = 0; i < count; i++) {
    const start = edges[i] ?? 0
    const size = (edges[i + 1] ?? VIEW) - start
    if (i > 0) {
      density = density < 2 ? density + 2 : density - 2
      angle = (angle + 90) % 180
    }
    bands.push({ start, size, density: i === bare ? null : density, angle })
  }
  return bands
}

export interface CoverMarkProps {
  /** Stable per project: the slug. Same seed, same picture. */
  seed: string
  className?: string
}

export function CoverMark({ seed, className }: CoverMarkProps) {
  const hash = hashCode(seed)
  const random = makeRandom(hash)

  const vertical = random() < 0.5
  const bands = buildBands(random)

  /* One bevel line: a 2px bar on a band edge, the same confident single stroke
     the row's grind-mark is. It is ink, not accent. */
  const bevelAt = bands[1]?.start ?? Math.round(VIEW / 2)
  const bevelSpan = pick(random, [22, 30, 36, 48] as const)
  const bevelOffset = bevelSpan === VIEW ? 0 : pick(random, [0, 6, 12] as const)

  const id = `ws-mark-${String(hash)}`

  return (
    <svg
      viewBox={`0 0 ${String(VIEW)} ${String(VIEW)}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
      className={cn('block h-full w-full bg-surface-0 text-hatch', className)}
    >
      <rect width={VIEW} height={VIEW} className="fill-surface-0" />

      <defs>
        {bands.map((band, index) =>
          band.density === null ? null : (
            <pattern
              key={`${id}-p${String(index)}`}
              id={`${id}-p${String(index)}`}
              width={DENSITIES[band.density]?.spacing ?? 8}
              height={DENSITIES[band.density]?.spacing ?? 8}
              patternUnits="userSpaceOnUse"
              patternTransform={`rotate(${String(band.angle)})`}
            >
              <line
                x1={0}
                y1={0}
                x2={0}
                y2={DENSITIES[band.density]?.spacing ?? 8}
                stroke="currentColor"
                strokeWidth={DENSITIES[band.density]?.stroke ?? 2}
              />
            </pattern>
          ),
        )}
      </defs>

      {bands.map((band, index) =>
        band.density === null ? null : (
          <rect
            key={`${id}-b${String(index)}`}
            x={vertical ? band.start : 0}
            y={vertical ? 0 : band.start}
            width={vertical ? band.size : VIEW}
            height={vertical ? VIEW : band.size}
            fill={`url(#${id}-p${String(index)})`}
          />
        ),
      )}

      {/* The bevel: one solid 2px rule across the split. */}
      <rect
        x={vertical ? bevelAt - 1 : bevelOffset}
        y={vertical ? bevelOffset : bevelAt - 1}
        width={vertical ? 2 : bevelSpan}
        height={vertical ? bevelSpan : 2}
        className="fill-hatch"
      />
    </svg>
  )
}

export default CoverMark
