/**
 * ProjectCover: the generated cover a project wears when it has no uploaded
 * media, drawn to survive both sizes it is asked to appear at.
 *
 * Keyboard contract: none. It is a picture, decorative by default because the
 * project title sits beside it everywhere it is used.
 *
 * Why it is not `CoverArt` from `components/ui`. That primitive draws the whole
 * composition inside one `viewBox`, so the hatch scales with the frame: a 3px
 * 120-grit stroke renders at 0.3px in a 48px feed thumbnail and at 4px in a
 * 660px figure. Both ends lose the grit language, which is the only thing the
 * drawing is made of. Here the geometry scales (zones are percentages) and the
 * hatch does not (patterns are in `userSpaceOnUse` with no `viewBox`, exactly
 * as `GritHatch` does it), so a stroke is 3px wide at every size and the five
 * grades stay distinguishable from a thumbnail to a full-width figure. The
 * defect and this fix are written up in `design/PRIMITIVE-DEFECTS.md`.
 *
 * The vocabulary is the contract's and nothing else (§1, §5.7, §8.1.7): hatch
 * fields at the five real stroke weights, laid at four angles, cut by hairline
 * rules, with at most one accent element, which is the same 2px grind-mark used
 * everywhere else in the product. No gradient, no blob, no letter in a box.
 *
 * Determinism: every choice comes from `hashCode(seed)` through mulberry32, so
 * one project looks identical on every render and on every machine, and two
 * projects differ in their split, their density ramp, their angles and their
 * accent position at once.
 */

import { GRIT_STAGES } from '@/lib/taxonomy'
import { cn, hashCode } from '@/lib/utils'

/** The module grid every cut snaps to, so the splits read as structure. */
const COLS = 12
const ROWS = 8
/** No zone is narrower or shorter than this many modules. */
const MIN_MODULES = 2

type GritStage = (typeof GRIT_STAGES)[number]

interface Zone {
  x: number
  y: number
  w: number
  h: number
}

interface Cut {
  vertical: boolean
  /** Module index the rule sits on. */
  at: number
  from: number
  to: number
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

/**
 * Guillotine split, always cutting the largest zone, so the frame stays
 * balanced instead of shredding one corner. Every cut is recorded, because the
 * cuts are drawn as hairlines and they are what makes the drawing architecture
 * rather than a pile of rectangles.
 *
 * The first two cuts are forced to cross. Left to the coin-flip, roughly a
 * third of seeds came out with every cut running the same way, and a frame of
 * five full-height stripes reads as a barcode, not as a composition: there is
 * no near and far, and the zone shapes stop telling projects apart because they
 * are all the same shape. Forcing one cut each way means every cover has
 * structure in both directions and at least two zone proportions, while the
 * remaining cuts stay free, which is where the variety between projects is.
 */
function carve(random: () => number): { zones: Zone[]; cuts: Cut[] } {
  const zones: Zone[] = [{ x: 0, y: 0, w: COLS, h: ROWS }]
  const cuts: Cut[] = []
  const target = 5 + Math.floor(random() * 2)
  const firstVertical = random() < 0.5

  let guard = 0
  while (zones.length < target && guard < 24) {
    guard += 1
    zones.sort((a, b) => b.w * b.h - a.w * a.h)
    const head = zones[0]
    if (!head) break

    const canSplitV = head.w >= MIN_MODULES * 2
    const canSplitH = head.h >= MIN_MODULES * 2
    if (!canSplitV && !canSplitH) break

    const forced = cuts.length === 0 ? firstVertical : cuts.length === 1 ? !firstVertical : null
    const vertical =
      forced !== null && (forced ? canSplitV : canSplitH)
        ? forced
        : canSplitV && (!canSplitH || random() < 0.55)
    zones.shift()

    if (vertical) {
      const span = head.w - MIN_MODULES * 2 + 1
      const cut = MIN_MODULES + Math.floor(random() * span)
      cuts.push({ vertical: true, at: head.x + cut, from: head.y, to: head.y + head.h })
      zones.push({ x: head.x, y: head.y, w: cut, h: head.h })
      zones.push({ x: head.x + cut, y: head.y, w: head.w - cut, h: head.h })
    } else {
      const span = head.h - MIN_MODULES * 2 + 1
      const cut = MIN_MODULES + Math.floor(random() * span)
      cuts.push({ vertical: false, at: head.y + cut, from: head.x, to: head.x + head.w })
      zones.push({ x: head.x, y: head.y, w: head.w, h: cut })
      zones.push({ x: head.x, y: head.y + cut, w: head.w, h: head.h - cut })
    }
  }

  zones.sort((a, b) => b.w * b.h - a.w * a.h)
  return { zones, cuts }
}

type Fill = { kind: 'bare' } | { kind: 'plate' } | { kind: 'hatch'; stage: GritStage }

/**
 * The density ramp, quietest first. Taking evenly spaced entries from it means
 * a cover always holds both extremes: at least one empty zone and at least one
 * field of the coarsest stroke in the system. That is what keeps it legible at
 * 48px, where the only thing that survives is the macro figure-ground.
 */
function ramp(): Fill[] {
  const byValue = (grit: number): GritStage => GRIT_STAGES.find((s) => s.grit === grit) ?? GRIT_STAGES[0]
  return [
    { kind: 'bare' },
    { kind: 'hatch', stage: byValue(8000) },
    { kind: 'hatch', stage: byValue(3000) },
    { kind: 'hatch', stage: byValue(1000) },
    { kind: 'hatch', stage: byValue(400) },
    { kind: 'hatch', stage: byValue(120) },
  ]
}

interface HatchFieldProps {
  stage: GritStage
  angle: number
}

/**
 * A tiling field of strokes at this grade's real width and spacing, in CSS
 * pixels rather than viewBox units, so the weight is the same in a 48px
 * thumbnail as in a 660px figure.
 */
function HatchField({ stage, angle }: HatchFieldProps) {
  const patternId = `ws-cover-hatch-${String(stage.grit)}-${String(angle)}`
  const offset = stage.strokeWidth / 2
  return (
    <svg aria-hidden="true" focusable="false" className="block h-full w-full text-hatch">
      <defs>
        <pattern
          id={patternId}
          width={stage.spacing}
          height={stage.spacing}
          patternUnits="userSpaceOnUse"
          patternTransform={`rotate(${String(angle)})`}
        >
          <line
            x1={offset}
            y1={0}
            x2={offset}
            y2={stage.spacing}
            stroke="currentColor"
            strokeWidth={stage.strokeWidth}
            shapeRendering="crispEdges"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  )
}

export interface ProjectCoverProps {
  /** Stable per project: the slug or the id. Same seed, same picture. */
  seed: string
  /** Used for the accessible name when the drawing stands alone. */
  title: string
  /** Default true: a title sits beside it, so the art adds nothing to read. */
  decorative?: boolean
  className?: string
}

export function ProjectCover({ seed, title, decorative = true, className }: ProjectCoverProps) {
  const hash = hashCode(seed)
  const random = makeRandom(hash)
  const { zones, cuts } = carve(random)

  const n = zones.length
  const steps = ramp()
  // Evenly spaced across the ramp, so both extremes are always in the picture.
  const picks: Fill[] = Array.from({ length: n }, (_, i) => {
    const index = n === 1 ? 0 : Math.round((i * (steps.length - 1)) / (n - 1))
    return steps[index] ?? { kind: 'bare' }
  })

  // Two modes. Quiet-large reads as a sheet with a dense block struck into it;
  // loud-large reads as a field with clearings cut out of it. Both are the same
  // vocabulary, and the seed picks which way round this project wears it.
  const loudLargest = random() < 0.45
  const fills: Fill[] = picks.map((_, i) => picks[loudLargest ? n - 1 - i : i] ?? { kind: 'bare' })

  // One flat plate, sometimes, where a mid grade would have been: a tonal block
  // with no texture at all gives the eye somewhere to rest.
  const plateAt = random() < 0.35 ? 1 + Math.floor(random() * Math.max(1, n - 2)) : -1
  if (plateAt >= 0 && plateAt < n) fills[plateAt] = { kind: 'plate' }

  // Three directions, cycled across the zones that actually carry a hatch, so
  // no two neighbouring fields lean the same way and exactly one is cut across
  // the grain. Cycling over the hatched zones rather than over every zone is
  // the point: assigning by absolute index put the cross-grain field on a bare
  // zone as often as not, and the drawing came out all one direction.
  const baseAngle = random() < 0.5 ? 45 : 135
  const counterAngle = baseAngle === 45 ? 135 : 45
  const crossAngle = random() < 0.5 ? 0 : 90
  const rotation = [baseAngle, counterAngle, crossAngle, counterAngle, baseAngle]
  const hatchOrder = fills.map((fill, index) => (fill.kind === 'hatch' ? index : -1)).filter((i) => i >= 0)
  const angleFor = (index: number): number => {
    const slot = hatchOrder.indexOf(index)
    return rotation[(slot < 0 ? 0 : slot) % rotation.length] ?? baseAngle
  }

  // Exactly one accent element in the drawing, and it is the product's own
  // grind-mark: 2px, leading edge, nothing else (§2.4.7). It runs the full
  // leading edge of the dominant zone rather than a random span of it. A stub
  // starting and stopping at two seeded offsets read as a stray tick that had
  // landed on a boundary by accident; an edge that is marked end to end reads
  // as the same deliberate mark the open ask wears.
  const accentZone = zones[0]

  const pct = (value: number, total: number): string => `${String((value / total) * 100)}%`

  return (
    <div
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : `Generated cover for ${title}, drawn from the grit scale`}
      className={cn('relative h-full w-full overflow-hidden bg-paper-sub', className)}
    >
      {zones.map((zone, index) => {
        const fill = fills[index] ?? { kind: 'bare' as const }
        return (
          <div
            key={`zone-${String(zone.x)}-${String(zone.y)}-${String(zone.w)}-${String(zone.h)}`}
            className={cn(
              'absolute overflow-hidden',
              fill.kind === 'plate' ? 'bg-paper-hi' : 'bg-paper-sub',
            )}
            style={{
              insetInlineStart: pct(zone.x, COLS),
              insetBlockStart: pct(zone.y, ROWS),
              inlineSize: pct(zone.w, COLS),
              blockSize: pct(zone.h, ROWS),
            }}
          >
            {fill.kind === 'hatch' ? <HatchField stage={fill.stage} angle={angleFor(index)} /> : null}
          </div>
        )
      })}

      {/* The cuts, drawn. A hairline is decorative by contract, and here it is
          decorating nothing but itself: the boundary is already carried by the
          change in density on either side of it. */}
      {cuts.map((cut) =>
        cut.vertical ? (
          <span
            key={`cut-v-${String(cut.at)}-${String(cut.from)}-${String(cut.to)}`}
            className="absolute block bg-border-hair"
            style={{
              insetInlineStart: pct(cut.at, COLS),
              insetBlockStart: pct(cut.from, ROWS),
              blockSize: pct(cut.to - cut.from, ROWS),
              inlineSize: '1px',
            }}
          />
        ) : (
          <span
            key={`cut-h-${String(cut.at)}-${String(cut.from)}-${String(cut.to)}`}
            className="absolute block bg-border-hair"
            style={{
              insetInlineStart: pct(cut.from, COLS),
              insetBlockStart: pct(cut.at, ROWS),
              inlineSize: pct(cut.to - cut.from, COLS),
              blockSize: '1px',
            }}
          />
        ),
      )}

      {accentZone ? (
        <span
          className="absolute block bg-mark"
          style={{
            insetInlineStart: pct(accentZone.x, COLS),
            insetBlockStart: pct(accentZone.y, ROWS),
            blockSize: pct(accentZone.h, ROWS),
            inlineSize: '2px',
          }}
        />
      ) : null}
    </div>
  )
}

export default ProjectCover
