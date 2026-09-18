/**
 * CoverArt: generated cover for a project with no uploaded media.
 *
 * Keyboard contract: none. It is a picture, and by default a decorative one,
 * because in the feed and on the project header the title sits right next to
 * it. Pass `decorative={false}` only where the art stands alone.
 *
 * The whole drawing is built from the grit language and nothing else: hatch
 * fields at the five real stroke weights, hairline rules, and at most one
 * accent element, which is the same 2px grind-mark used everywhere else
 * (§2.4.7). No gradients, no blobs, no stock imagery, no letter-in-a-rounded-
 * square (§8.1.7, §8.4.44). It has to look like a decision, not a fallback.
 *
 * Determinism: every choice comes from `hashCode(seed)` through a small
 * deterministic generator, so one project looks identical on every render and
 * on every machine, and two projects differ in split, density, angle, rule
 * placement and accent position at once, not in one hue.
 */

import { cn, hashCode } from '@/lib/utils'
import { GRIT_STEPS, type GritStep } from './grit'

const VIEW_W = 480
const VIEW_H = 300

type Orientation = 'horizontal' | 'vertical'

interface Zone {
  x: number
  y: number
  w: number
  h: number
  step: GritStep
  orientation: Orientation
}

/** mulberry32. Small, fast, and identical in every JavaScript runtime. */
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
  const index = Math.floor(random() * options.length)
  return options[index] ?? options[0]
}

/** Fisher–Yates, seeded. Returns a copy. */
function shuffled<T>(random: () => number, input: readonly T[]): T[] {
  const out = [...input]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const a = out[i]
    const b = out[j]
    if (a === undefined || b === undefined) continue
    out[i] = b
    out[j] = a
  }
  return out
}

function buildZones(random: () => number): Zone[] {
  const steps = shuffled(random, GRIT_STEPS)
  const first = steps[0] ?? GRIT_STEPS[0]
  const second = steps[1] ?? GRIT_STEPS[1]
  const third = steps[2] ?? GRIT_STEPS[2]
  if (!first || !second || !third) return []

  const vertical = random() < 0.55
  const ratio = pick(random, [0.28, 0.38, 0.5, 0.62, 0.72] as const)
  const bands = pick(random, [2, 2, 3] as const)
  const orientationA: Orientation = random() < 0.5 ? 'horizontal' : 'vertical'
  const orientationB: Orientation = orientationA === 'horizontal' ? 'vertical' : 'horizontal'

  if (vertical) {
    const cut = Math.round(VIEW_W * ratio)
    if (bands === 2) {
      return [
        { x: 0, y: 0, w: cut, h: VIEW_H, step: first, orientation: orientationA },
        { x: cut, y: 0, w: VIEW_W - cut, h: VIEW_H, step: second, orientation: orientationB },
      ]
    }
    const secondCut = cut + Math.round((VIEW_W - cut) * pick(random, [0.4, 0.55, 0.7] as const))
    return [
      { x: 0, y: 0, w: cut, h: VIEW_H, step: first, orientation: orientationA },
      { x: cut, y: 0, w: secondCut - cut, h: VIEW_H, step: second, orientation: orientationB },
      { x: secondCut, y: 0, w: VIEW_W - secondCut, h: VIEW_H, step: third, orientation: orientationA },
    ]
  }

  const cut = Math.round(VIEW_H * ratio)
  if (bands === 2) {
    return [
      { x: 0, y: 0, w: VIEW_W, h: cut, step: first, orientation: orientationA },
      { x: 0, y: cut, w: VIEW_W, h: VIEW_H - cut, step: second, orientation: orientationB },
    ]
  }
  const secondCut = cut + Math.round((VIEW_H - cut) * pick(random, [0.4, 0.55, 0.7] as const))
  return [
    { x: 0, y: 0, w: VIEW_W, h: cut, step: first, orientation: orientationA },
    { x: 0, y: cut, w: VIEW_W, h: secondCut - cut, step: second, orientation: orientationB },
    { x: 0, y: secondCut, w: VIEW_W, h: VIEW_H - secondCut, step: third, orientation: orientationA },
  ]
}

export interface CoverArtProps {
  /** Stable per project: the slug or the id. Same seed, same picture. */
  seed: string
  /** Used for the accessible name when the art is not decorative. */
  title: string
  /** Default true: the project title is adjacent, so the art adds nothing. */
  decorative?: boolean
  className?: string
}

export function CoverArt({ seed, title, decorative = true, className }: CoverArtProps) {
  const hash = hashCode(seed)
  const random = makeRandom(hash)
  const zones = buildZones(random)

  // One or two hairline rules, laid across the split rather than along it.
  const ruleCount = pick(random, [1, 1, 2] as const)
  const rules = Array.from({ length: ruleCount }, () => ({
    y: Math.round(VIEW_H * (0.18 + random() * 0.64)),
    inset: pick(random, [0, 0, 48, 96] as const),
  }))

  // Exactly one accent element in the whole drawing: the grind-mark, 2px, on a
  // leading edge, the same motif the rest of the product uses (§2.4.5, §2.4.7).
  const accentVertical = random() < 0.6
  const accentSpan = pick(random, [0.34, 0.46, 0.62] as const)
  const accentOffset = 0.12 + random() * 0.4

  const idBase = `ws-cover-${String(hash)}`

  return (
    <svg
      viewBox={`0 0 ${String(VIEW_W)} ${String(VIEW_H)}`}
      preserveAspectRatio="xMidYMid slice"
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : `Generated cover art for ${title}`}
      focusable="false"
      className={cn('block h-full w-full bg-surface-0 text-hatch', className)}
    >
      <rect width={VIEW_W} height={VIEW_H} className="fill-surface-0" />

      <defs>
        {zones.map((zone, index) => {
          const patternId = `${idBase}-${String(index)}`
          const angle = zone.orientation === 'vertical' ? 135 : 45
          return (
            <pattern
              key={patternId}
              id={patternId}
              width={zone.step.spacing}
              height={zone.step.spacing}
              patternUnits="userSpaceOnUse"
              patternTransform={`rotate(${String(angle)})`}
            >
              <line
                x1={zone.step.strokeWidth / 2}
                y1={0}
                x2={zone.step.strokeWidth / 2}
                y2={zone.step.spacing}
                stroke="currentColor"
                strokeWidth={zone.step.strokeWidth}
              />
            </pattern>
          )
        })}
      </defs>

      {zones.map((zone, index) => (
        <rect
          key={`${idBase}-zone-${String(index)}`}
          x={zone.x}
          y={zone.y}
          width={zone.w}
          height={zone.h}
          fill={`url(#${idBase}-${String(index)})`}
        />
      ))}

      {rules.map((rule, index) => (
        <line
          key={`${idBase}-rule-${String(index)}-${String(rule.y)}`}
          x1={rule.inset}
          y1={rule.y}
          x2={VIEW_W - rule.inset}
          y2={rule.y}
          className="stroke-border-hair"
          strokeWidth={1}
        />
      ))}

      {accentVertical ? (
        <rect
          x={Math.round(VIEW_W * accentOffset)}
          y={Math.round(VIEW_H * 0.16)}
          width={2}
          height={Math.round(VIEW_H * accentSpan)}
          className="fill-accent"
        />
      ) : (
        <rect
          x={Math.round(VIEW_W * 0.1)}
          y={Math.round(VIEW_H * accentOffset)}
          width={Math.round(VIEW_W * accentSpan)}
          height={2}
          className="fill-accent"
        />
      )}
    </svg>
  )
}
