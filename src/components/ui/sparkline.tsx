/**
 * Sparkline: a trend, inline, at text size.
 *
 * Keyboard contract: none. The drawing is `aria-hidden`; the same series is
 * rendered as a visually hidden <table> beside it, and `summary` is required so
 * the figure always has a sentence a screen reader can use instead of a shape.
 *
 * Contract notes: stroke is `--color-hatch`, the same ink as gridlines and the
 * grit hatch (§2.1). The final point carries the 2px accent grind-mark, which
 * is the one chromatic element in the drawing (§2.4.7). Nothing animates: the
 * line renders final on first paint (§0.10).
 */

import { cn } from '@/lib/utils'

const VIEW_W = 100
const VIEW_H = 24
const PAD = 2

export interface SparklineProps {
  /** The series, oldest first. Two points minimum to be a trend. */
  points: readonly number[]
  /** Required. "Feedback received per week over the last 8 weeks." */
  summary: string
  /** One label per point for the hidden table. Falls back to positions. */
  pointLabels?: readonly string[]
  /** Column head for the value column in the hidden table. */
  valueLabel?: string
  className?: string
}

export function Sparkline({
  points,
  summary,
  pointLabels,
  valueLabel = 'Value',
  className,
}: SparklineProps) {
  if (points.length < 2) {
    return (
      <figure className={cn('m-0', className)}>
        <figcaption className="text-xs text-text-3">
          {summary} Not enough data to draw a trend yet.
        </figcaption>
      </figure>
    )
  }

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min
  const stepX = (VIEW_W - PAD * 2) / (points.length - 1)

  const coords = points.map((value, index) => {
    const x = PAD + stepX * index
    // A flat series draws down the middle rather than collapsing onto an edge.
    const ratio = range === 0 ? 0.5 : (value - min) / range
    const y = VIEW_H - PAD - ratio * (VIEW_H - PAD * 2)
    return { x, y, value }
  })

  const last = coords[coords.length - 1]
  const path = coords.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(' ')

  return (
    <figure className={cn('m-0 flex flex-col gap-2xs', className)}>
      <svg
        viewBox={`0 0 ${String(VIEW_W)} ${String(VIEW_H)}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
        className="block h-lg w-full"
      >
        <polyline
          points={path}
          fill="none"
          className="stroke-hatch"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {last ? (
          <rect x={last.x - 1} y={last.y - 1} width={2} height={2} className="fill-accent" />
        ) : null}
      </svg>

      <figcaption className="sr-only">{summary}</figcaption>

      <table className="sr-only">
        <caption>{summary}</caption>
        <thead>
          <tr>
            <th scope="col">Point</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((value, index) => (
            <tr key={`spark-${String(index)}-${String(value)}`}>
              <th scope="row">{pointLabels?.[index] ?? `Point ${String(index + 1)}`}</th>
              <td>{value.toLocaleString('en')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
