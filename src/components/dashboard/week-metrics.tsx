/**
 * What changed since last week, counted from rows.
 *
 * Two adjacent seven-day windows, nothing modelled and nothing extrapolated. A
 * delta is written in words (“3 more than the week before”), never as a bare
 * “+12%”, and no delta carries a tone: more open themes is not automatically
 * worse and more notes is not automatically better, so the arrow and the ink
 * stay neutral and the creator reads the number.
 */

import { Stat, StatGroup } from '@/components/ui'
import type { WeekMetric } from '@/server/queries/dashboard'

function deltaWords(metric: WeekMetric): {
  delta?: string
  direction: 'up' | 'down' | 'flat'
} {
  const change = Math.round((metric.value - metric.previous) * 100) / 100
  if (metric.value === 0 && metric.previous === 0) return { direction: 'flat' }
  if (change === 0) return { delta: 'same as the week before', direction: 'flat' }
  const size = Math.abs(change)
  const figure = metric.key === 'avg_rating' ? size.toFixed(2) : String(size)
  return {
    delta: `${figure} ${change > 0 ? 'more' : 'fewer'} than the week before`,
    direction: change > 0 ? 'up' : 'down',
  }
}

export interface WeekMetricsProps {
  metrics: readonly WeekMetric[]
  label: string
}

/**
 * Open themes is only in the strip where a board is drawn, so the strip is four
 * figures or five, and a fifth empty track would read as a missing number.
 */
const WIDE_COLUMNS: Record<number, string> = { 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' }

export function WeekMetrics({ metrics, label }: WeekMetricsProps) {
  return (
    <StatGroup
      label={label}
      className={`sm:grid-cols-2 md:grid-cols-3 ${WIDE_COLUMNS[metrics.length] ?? 'lg:grid-cols-5'}`}
    >
      {metrics.map((metric) => {
        const { delta, direction } = deltaWords(metric)
        const empty = metric.value === 0 && metric.previous === 0
        return (
          <Stat
            key={metric.key}
            label={metric.label}
            value={empty ? null : metric.display}
            {...(delta ? { delta, deltaDirection: direction } : {})}
            {...(empty ? { hint: 'Nothing in either week.' } : {})}
            width={5}
          />
        )
      })}
    </StatGroup>
  )
}

export default WeekMetrics
