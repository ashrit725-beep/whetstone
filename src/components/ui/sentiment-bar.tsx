/**
 * SentimentBar: the dashboard's theme rollup: how a run of feedback on one
 * theme split between positive, mixed and critical.
 *
 * Keyboard contract: none. The bar is a picture of a table, and the table is
 * right there: the same numbers are rendered as a visually hidden <table> so a
 * screen reader gets rows and headers instead of a shape.
 *
 * Contract notes:
 *   §2.4.8  no hue carries meaning alone. Every segment renders its own
 *           percentage numeral, and the legend beneath repeats the word and the
 *           count, so a greyscale screenshot is fully readable, which matters
 *           here because `positive` and `critical` sit at similar lightness.
 *   §4.4.5  the rollup is the dashboard's one bold element; it is bars, not
 *           another tile.
 */

import { cn } from '@/lib/utils'

export interface SentimentBarProps {
  /** The theme being measured, e.g. "Controls". */
  label: string
  positive: number
  neutral: number
  critical: number
  /** Noun for the counts. Default "notes". */
  unit?: string
  /** Override the segment words if this axis is not sentiment. */
  words?: { positive: string; neutral: string; critical: string }
  className?: string
}

interface Segment {
  key: 'positive' | 'neutral' | 'critical'
  word: string
  count: number
  percent: number
  fill: string
  swatch: string
}

export function SentimentBar({
  label,
  positive,
  neutral,
  critical,
  unit = 'notes',
  words = { positive: 'Positive', neutral: 'Mixed', critical: 'Critical' },
  className,
}: SentimentBarProps) {
  const total = positive + neutral + critical
  // Percentages are computed so they sum to exactly 100 and never read 33/33/33
  // for an uneven split.
  const positivePct = total === 0 ? 0 : Math.round((positive / total) * 100)
  const neutralPct = total === 0 ? 0 : Math.round((neutral / total) * 100)
  const criticalPct = total === 0 ? 0 : 100 - positivePct - neutralPct

  const segments: Segment[] = [
    {
      key: 'positive',
      word: words.positive,
      count: positive,
      percent: positivePct,
      fill: 'bg-positive text-positive-ink',
      swatch: 'bg-positive',
    },
    {
      key: 'neutral',
      word: words.neutral,
      count: neutral,
      percent: neutralPct,
      fill: 'bg-text-3 text-surface-0',
      swatch: 'bg-text-3',
    },
    {
      key: 'critical',
      word: words.critical,
      count: critical,
      percent: criticalPct,
      fill: 'bg-critical text-critical-ink',
      swatch: 'bg-critical',
    },
  ]

  if (total === 0) {
    return (
      <div className={cn('flex flex-col gap-2xs', className)}>
        <p className="flex items-baseline justify-between gap-sm text-sm text-text-1">
          <span>{label}</span>
          <span className="text-xs text-text-3">No {unit} yet</span>
        </p>
        <div
          aria-hidden="true"
          className="h-lg rounded-xs border border-dashed border-border-hair bg-surface-1"
        />
        <p className="text-xs text-text-3">
          Nothing has been filed under {label.toLowerCase()} so far.
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col gap-2xs', className)}>
      <p className="flex items-baseline justify-between gap-sm text-sm text-text-1">
        <span>{label}</span>
        <span className="text-xs text-text-3">
          <span className="tnum">{total.toLocaleString('en')}</span>
          <span>&nbsp;{unit}</span>
        </span>
      </p>

      <div
        aria-hidden="true"
        className="flex h-lg overflow-hidden rounded-xs border border-border-hair"
      >
        {segments.map((segment) =>
          segment.percent > 0 ? (
            <span
              key={segment.key}
              className={cn(
                'flex items-center justify-center overflow-hidden px-3xs text-2xs whitespace-nowrap',
                segment.fill,
              )}
              style={{ flexBasis: `${String(segment.percent)}%` }}
            >
              <span className="tnum">{segment.percent}%</span>
            </span>
          ) : null,
        )}
      </div>

      {/* The legend is what makes the bar readable without colour, so it lists
          the segments the bar drew and no others: a swatch reading "Praise 0%"
          beside a bar with no green in it is a key to nothing. The sr-only
          table below keeps the complete breakdown, zeros included. */}
      <ul className="flex flex-wrap gap-sm">
        {segments
          .filter((segment) => segment.percent > 0)
          .map((segment) => (
            <li key={segment.key} className="flex items-center gap-2xs text-xs text-text-2">
              <span
                aria-hidden="true"
                className={cn('block h-xs w-xs shrink-0 rounded-xs', segment.swatch)}
              />
              <span>{segment.word}</span>
              <span className="tnum text-text-3">{segment.percent}%</span>
            </li>
          ))}
      </ul>

      <table className="sr-only">
        <caption>
          {label}: {total.toLocaleString('en')} {unit} by sentiment
        </caption>
        <thead>
          <tr>
            <th scope="col">Sentiment</th>
            <th scope="col">{unit}</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {segments.map((segment) => (
            <tr key={segment.key}>
              <th scope="row">{segment.word}</th>
              <td>{segment.count.toLocaleString('en')}</td>
              <td>{segment.percent}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
