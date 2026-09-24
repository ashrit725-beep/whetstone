/**
 * Split decisions: one axis, every reviewer's own answer, drawn as units.
 *
 * Whetstone's rating axes are five-step scales, the same five steps as the grit
 * scale. That makes "eight of these fifteen people said 1 or 2 and four said 4
 * or 5" a fact the database already holds, and it is the one reading no star
 * average can give: a mean of 2.6 is what that disagreement looks like after the
 * information has been removed.
 *
 * One square is one reviewer. The squares stack three wide from the baseline up,
 * so the area standing on each step is that step's count and the shape of the
 * split is the shape of the drawing. The previous version printed three names
 * per step and counted the rest, which made a step with fifteen reviewers and a
 * step with three look identical — it hid the only thing the section exists to
 * show. Names are carried by each square's tooltip and in full by the table
 * underneath, which is what a screen reader reads.
 *
 * Keyboard contract: the drawing takes no focus. The project title above it is
 * one tab stop.
 */

import NextLink from 'next/link'
import type { SplitPlot } from '@/app/(marketing)/_data'
import { inSentence } from '@/lib/utils'
import { GritReading } from './grit-reading'
import styles from './paper.module.css'

const STEPS = [1, 2, 3, 4, 5] as const

function reviewersWord(count: number): string {
  return count === 1 ? 'reviewer' : 'reviewers'
}

/** "Ada, Bo and Cy", because "Ada, Bo, Cy" reads as a fragment mid-sentence. */
function names(list: readonly string[]): string {
  if (list.length <= 1) return list[0] ?? ''
  return `${list.slice(0, -1).join(', ')} and ${String(list.at(-1))}`
}

export interface SplitFigureProps {
  plot: SplitPlot
}

export function SplitFigure({ plot }: SplitFigureProps) {
  const lowNames = plot.votes.filter((vote) => vote.step === plot.low).map((vote) => vote.name)
  const highNames = plot.votes.filter((vote) => vote.step === plot.high).map((vote) => vote.name)

  return (
    <figure className={styles.split}>
      <figcaption className={styles.splitHead}>
        <span className="track-safe">
          <NextLink href={`/p/${plot.slug}`} className="link text-md text-ink">
            {plot.title}
          </NextLink>
          <span className="mt-1 block text-xs text-ink-3">
            {plot.ownerName} · {plot.typeLabel}
          </span>
        </span>

        <span className="track-safe">
          <span
            className="block text-base text-ink"
            style={{ fontVariationSettings: '"wght" 650' }}
          >
            {plot.axisLabel}
          </span>
          <span className={`${styles.splitKey} mt-1`}>
            <span>
              <b className="tnum">1</b> {plot.lowLabel}
            </span>
            <span>
              <b className="tnum">5</b> {plot.highLabel}
            </span>
          </span>
        </span>

        <span className="track-safe">
          <GritReading value={plot.grit} />
          <span className="tnum mt-1 block text-xs text-ink-3">
            {plot.raters} {reviewersWord(plot.raters)}, {plot.stdDev.toFixed(1)} steps of spread
          </span>
        </span>
      </figcaption>

      {/* The drawing. Everything in it is in the table below, so it is hidden
          from assistive technology rather than read out twice. */}
      <ol aria-hidden="true" className={styles.splitCols}>
        {STEPS.map((step) => {
          const here = plot.votes.filter((vote) => vote.step === step)
          return (
            <li key={step} className={styles.splitCol}>
              <span className={styles.splitUnits}>
                {here.length === 0 ? <i className={styles.splitNone} /> : null}
                {here.map((vote) => (
                  <i key={vote.handle} title={vote.name} />
                ))}
              </span>
              <p className={styles.splitFoot}>
                <span className={`${styles.splitStep} tnum`}>{step}</span>
                <span className={`${styles.splitCount} tnum`}>
                  {here.length === 0 ? 'Nobody' : `${String(here.length)} ${reviewersWord(here.length)}`}
                </span>
              </p>
            </li>
          )
        })}
      </ol>

      <p className={`${styles.splitWords} voice measure-cap text-voice`}>
        Lowest: {names(lowNames)} put {plot.title} at <strong className="tnum">{plot.low}</strong> on{' '}
        {inSentence(plot.axisLabel)}. Highest: {names(highNames)} put it at{' '}
        <strong className="tnum">{plot.high}</strong>. An average would have printed one number
        between them.
      </p>

      {/* The same reading as a table, for a screen reader. The wrapper carries
          `sr-only`, not the table: `overflow: hidden` on a table box does not
          clip its own content, so the class on the table itself left a 613px
          box in the layout and scrolled the page sideways at 390. */}
      <div className="sr-only">
        <table>
          <caption>
            {plot.title}: how {plot.raters} {reviewersWord(plot.raters)} rated {plot.axisLabel}, on a
            scale from 1 ({plot.lowLabel}) to 5 ({plot.highLabel}).
          </caption>
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">Reviewers</th>
              <th scope="col">Who</th>
            </tr>
          </thead>
          <tbody>
            {STEPS.map((step) => {
              const here = plot.votes.filter((vote) => vote.step === step)
              return (
                <tr key={step}>
                  <th scope="row">
                    {step}
                    {step === plot.median ? ', the median' : ''}
                  </th>
                  <td>{here.length}</td>
                  <td>{here.length === 0 ? 'Nobody' : here.map((vote) => vote.name).join(', ')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
