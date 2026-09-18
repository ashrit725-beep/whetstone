import { GRIT_STAGES, type GritStage } from '@/lib/taxonomy'
import { OG } from './palette'

/**
 * The grit hatch, as a data URI an `ImageResponse` can place with `<img>`.
 *
 * Satori renders flexbox and text; it does not draw. So the one piece of the
 * Grit Index that is genuinely a drawing gets rasterised the way every other
 * image on the card does. The stroke and spacing values are read from
 * `GRIT_STAGES` rather than restated here, so the card and the product hatch
 * can never disagree about what 1000 looks like.
 *
 * `SCALE` doubles both stroke and spacing. A social card is shown at a quarter
 * of its pixel size in most feeds, and a 0.5px stroke at 1200 wide disappears
 * at 300 wide. Doubling both terms keeps the ratio, which is the part that
 * carries the meaning.
 */

const SCALE = 2

/** Above this the lines are closer than a rendered pixel and cost nothing. */
const MAX_LINES = 800

export interface HatchSpec {
  readonly strokeWidth: number
  readonly spacing: number
}

export function gritStageFor(grit: number): GritStage {
  let best: GritStage = GRIT_STAGES[0]
  for (const stage of GRIT_STAGES) {
    if (grit >= stage.grit) best = stage
  }
  return best
}

export function hatchSpecFor(grit: number): HatchSpec {
  const stage = gritStageFor(grit)
  return { strokeWidth: stage.strokeWidth, spacing: stage.spacing }
}

/**
 * Horizontal rules across a rail, at the density the grit value names.
 * `fade` masks the bottom third so the rail reads as a surface being worked
 * rather than a striped block.
 */
export function hatchDataUri(opts: {
  width: number
  height: number
  grit: number
  color?: string
  fade?: boolean
}): string {
  const { strokeWidth, spacing } = hatchSpecFor(opts.grit)
  const stroke = strokeWidth * SCALE
  const step = spacing * SCALE
  const color = opts.color ?? OG.hatch

  const count = Math.min(MAX_LINES, Math.floor(opts.height / step))
  const lines: string[] = []
  for (let i = 0; i <= count; i += 1) {
    const y = +(i * step + stroke / 2).toFixed(2)
    if (y > opts.height) break
    lines.push(`<line x1="0" y1="${y}" x2="${opts.width}" y2="${y}" />`)
  }

  const mask = opts.fade
    ? `<defs><linearGradient id="f" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="#ffffff" stop-opacity="1"/>` +
      `<stop offset="1" stop-color="#ffffff" stop-opacity="0"/>` +
      `</linearGradient><mask id="m"><rect width="${opts.width}" height="${opts.height}" fill="url(#f)"/></mask></defs>`
    : ''

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${opts.width}" height="${opts.height}" ` +
    `viewBox="0 0 ${opts.width} ${opts.height}">${mask}` +
    `<g stroke="${color}" stroke-width="${stroke}" ${opts.fade ? 'mask="url(#m)"' : ''}>${lines.join('')}</g>` +
    `</svg>`

  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}

/**
 * A flat rule of one colour, used for the 1px hairlines and the 2px accent
 * grind-mark. Satori honours `backgroundColor` on a sized box, so this exists
 * only where a box would need a child it does not otherwise have.
 */
export function ruleDataUri(width: number, height: number, color: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="${color}"/></svg>`
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`
}
