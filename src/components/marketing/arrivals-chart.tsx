/**
 * Reviews submitted per day over the last four weeks, ending today.
 *
 * Rendered on the server with no script and no entrance: there is nothing to
 * hydrate and nothing hidden until an observer fires. The bars are boxes rather
 * than SVG so they draw in the page's own ink and follow the theme.
 *
 * Three rules keep it readable at any shape of data:
 *
 *   The scale is set by the ordinary days, not by the busiest one. One heavy day
 *   would otherwise flatten the other twenty-seven into a hairline, so a day
 *   that clears the scale is drawn to the top with a break across it, and its
 *   real figure is printed above it.
 *
 *   Today is the last column and is drawn open, on a lighter ground: the day is
 *   still filling, and a short solid bar would read as a quiet day.
 *
 *   The dashed line is the median of the finished days, so every bar can be
 *   read against an ordinary day without a lattice of gridlines.
 *
 * The chart is a picture of the table under it, which gives every day's figure
 * to a screen reader. The legend underneath restates the three readings in
 * words.
 */

import type { CSSProperties } from 'react'
import type { ArrivalSeries } from '@/app/(marketing)/_data'
import styles from './paper.module.css'

/** Where a scale ceiling may land within each power of ten. */
const NICE_STEPS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10] as const

/** Days that get a caption under the axis: the start of each week. Today is added separately. */
const WEEK_TICKS = [0, 7, 14, 21] as const

function niceCeil(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = NICE_STEPS.find((candidate) => candidate * power >= value) ?? 10
  return step * power
}

/**
 * The top of the scale. Normally the busiest day, rounded up to a round
 * number. When the busiest day is more than twice the ninetieth-percentile day
 * it is an outlier, and the scale is taken from the ordinary days instead.
 */
function scaleCeiling(counts: readonly number[]): number {
  const sorted = [...counts].sort((a, b) => a - b)
  const busiest = sorted.at(-1) ?? 0
  const typical = sorted[Math.floor((sorted.length - 1) * 0.9)] ?? 0
  return typical > 0 && busiest > typical * 2 ? niceCeil(typical * 1.25) : niceCeil(busiest)
}

function share(value: number, ceiling: number): string {
  return `${String(Math.min(100, (value / ceiling) * 100))}%`
}

export interface ArrivalsChartProps {
  series: ArrivalSeries
}

export function ArrivalsChart({ series }: ArrivalsChartProps) {
  const { days, medianDay, busiest } = series
  const last = days.length - 1
  const today = days[last]
  const ceiling = scaleCeiling(days.map((day) => day.count))
  // Two labels closer than a fifth of the plot would print over each other; the
  // median line is the more useful reference, so the ceiling gives way.
  const showCeiling = medianDay / ceiling < 0.8

  return (
    <figure className={styles.arrivals}>
      <div aria-hidden="true">
        <div className={styles.arrivalsField}>
          <span className={styles.arrivalsRule} style={{ '--y': '100%' } as CSSProperties}>
            {showCeiling ? <b>{ceiling.toLocaleString('en')}</b> : null}
          </span>
          {medianDay > 0 ? (
            <span
              className={styles.arrivalsRule}
              data-median="true"
              style={{ '--y': share(medianDay, ceiling) } as CSSProperties}
            >
              <b>{medianDay.toLocaleString('en')}</b>
            </span>
          ) : null}

          <ol className={styles.arrivalsBars}>
            {days.map((day, index) => (
              <li
                key={day.start}
                data-today={index === last ? 'true' : undefined}
                data-over={day.count > ceiling ? 'true' : undefined}
                data-edge={index < 2 ? 'start' : index > last - 2 ? 'end' : undefined}
                style={{ '--h': share(day.count, ceiling) } as CSSProperties}
              >
                <i />
                {busiest !== null && day.start === busiest.start ? (
                  <span className={`${styles.arrivalsPeak} tnum`}>
                    {day.count.toLocaleString('en')}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
        </div>

        <div className={styles.arrivalsAxis}>
          {WEEK_TICKS.filter((index) => index < last).map((index) => (
            <span
              key={index}
              data-minor={index % 14 === 7 ? 'true' : undefined}
              style={{ '--x': `${String((index / days.length) * 100)}%` } as CSSProperties}
            >
              {days[index]?.label}
            </span>
          ))}
          <span data-today="true">Today</span>
        </div>
      </div>

      <dl className={styles.arrivalsLegend}>
        <div>
          <dt>
            <i aria-hidden="true" data-key="median" />
            Median day
          </dt>
          <dd className="tnum">{medianDay.toLocaleString('en')}</dd>
        </div>
        {busiest !== null ? (
          <div>
            <dt>Busiest day</dt>
            <dd className="tnum">
              {busiest.count.toLocaleString('en')}
              <span> on {busiest.label}</span>
            </dd>
          </div>
        ) : null}
        {today !== undefined ? (
          <div>
            <dt>
              <i aria-hidden="true" data-key="today" />
              Today so far
            </dt>
            <dd className="tnum">{today.count.toLocaleString('en')}</dd>
          </div>
        ) : null}
      </dl>

      {/* The chart is a picture of this table. The wrapper carries `sr-only`,
          not the table, because a table box does not clip its own content. */}
      <div className="sr-only">
        <table>
          <caption>Reviews submitted per day over the last four weeks, oldest first</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              <th scope="col">Reviews</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day, index) => (
              <tr key={day.start}>
                <th scope="row">{index === last ? `${day.label}, today so far` : day.label}</th>
                <td>{day.count.toLocaleString('en')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
