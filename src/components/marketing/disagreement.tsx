/**
 * Where reviewers do not agree yet.
 *
 * Whetstone's rating axes are five-step scales, the same five steps as the
 * grit scale. That makes "these seven reviewers landed four steps apart" a
 * fact the database already holds, and it is the one reading no star average
 * can give you: a mean of 3.4 is what four people saying 5 and three saying 1
 * look like after the information has been removed.
 *
 * Two things are drawn here.
 *
 * The plot: five steps, each with the reviewers who chose it standing by name,
 * a numeral and a count. Every step has the same three parts in the same order,
 * so the numerals share one baseline and the names share one edge whatever the
 * data looks like. An empty step keeps its place and shows a hairline, because
 * the gap is the finding. The median is a lighter ground behind its step and
 * the word "Median" beside its numeral, so it adds no padding, moves nothing,
 * and survives greyscale. What 1 and 5 mean on this axis is said once, in the
 * caption, rather than squeezed under the end columns. Above 60rem a bracket
 * under the numerals measures the spread. The figure is restated in plain
 * English under "In words", which is the version most people will read, and an
 * `sr-only` table carries the same numbers for a screen reader.
 *
 * The index: every project with enough ratings to compare, ranked by spread
 * rather than by score.
 *
 * Keyboard contract: the plot takes no focus; the project title in its caption
 * is one tab stop, and the index is one tab stop per row, on the project title.
 */

import NextLink from 'next/link'
import type { SpreadPlot, SpreadRow } from '@/app/(marketing)/_data'
import { GritReading } from './grit-reading'
import styles from './paper.module.css'

const STEPS = [1, 2, 3, 4, 5] as const

/** How many names a step prints before it counts the rest. */
const NAMES_SHOWN = 3

function stepsWord(count: number): string {
  return count === 1 ? 'step' : 'steps'
}

function reviewersWord(count: number): string {
  return count === 1 ? 'reviewer' : 'reviewers'
}

/* ------------------------------------------------------------------ plot -- */

export interface SpreadFigureProps {
  plot: SpreadPlot
}

export function SpreadFigure({ plot }: SpreadFigureProps) {
  const { project, votes, columns, median, lowLabel, highLabel } = plot
  const lowCount = columns[project.low - 1] ?? 0
  const highCount = columns[project.high - 1] ?? 0
  const lowNote = project.low === 1 && lowLabel ? ` (${lowLabel.toLowerCase()})` : ''
  const highNote = project.high === 5 && highLabel ? ` (${highLabel.toLowerCase()})` : ''

  return (
    <figure className={styles.plot}>
      <figcaption className={styles.plotHead}>
        <span className="track-safe">
          <NextLink href={`/p/${project.slug}`} className="link text-md text-ink">
            {project.title}
          </NextLink>
          <span className="mt-1 block text-xs text-ink-3">
            {project.ownerName} · {project.typeLabel} · {project.stageLabel}
          </span>
        </span>
        <span className="track-safe">
          <span className="block text-base text-ink" style={{ fontVariationSettings: '"wght" 650' }}>
            {project.axisLabel}
          </span>
          {lowLabel && highLabel ? (
            <span className={`${styles.plotKey} mt-1`}>
              <span>
                <b className="tnum">1</b> {lowLabel}
              </span>
              <span>
                <b className="tnum">5</b> {highLabel}
              </span>
            </span>
          ) : null}
          <span className="tnum mt-1 block text-xs text-ink-3">
            Rated by {project.raters} {reviewersWord(project.raters)}, {project.spread}{' '}
            {stepsWord(project.spread)} apart
          </span>
        </span>
      </figcaption>

      {/* The drawing. Everything in it is also in the table below, so it is
          hidden from assistive technology rather than read out twice. */}
      <div aria-hidden="true">
        <ol className={styles.plotCols}>
          {STEPS.map((step) => {
            const here = votes.filter((vote) => vote.step === step)
            const shown = here.slice(0, NAMES_SHOWN)
            const hidden = here.length - shown.length

            return (
              <li
                key={step}
                className={styles.plotCol}
                data-median={step === median ? 'true' : undefined}
              >
                <p className={styles.plotFoot}>
                  <span className={`${styles.plotStep} tnum`}>
                    {step}
                    {step === median ? <span className={styles.plotTag}>Median</span> : null}
                  </span>
                  <span className={`${styles.plotCount} tnum`}>
                    {here.length === 0
                      ? 'Nobody'
                      : `${String(here.length)} ${reviewersWord(here.length)}`}
                  </span>
                </p>

                <span className={styles.plotStack}>
                  {here.length === 0 ? <span className={styles.plotNone} /> : null}
                  {shown.map((vote) => (
                    <span key={vote.handle} className={styles.plotVoter}>
                      <span>{vote.name}</span>
                    </span>
                  ))}
                  {hidden > 0 ? <span className={`${styles.plotMore} tnum`}>+{hidden} more</span> : null}
                </span>
              </li>
            )
          })}
        </ol>

        <div className={styles.plotBracket}>
          <span
            className={styles.plotBracketBar}
            style={{ gridColumn: `${String(project.low)} / ${String(project.high + 1)}` }}
          >
            <span>
              {project.spread} {stepsWord(project.spread)} apart
            </span>
          </span>
        </div>
      </div>

      {/* The same reading as a table, for a screen reader. The wrapper carries
          `sr-only`, not the table: `overflow: hidden` on a table box does not
          clip its own content, so the class on the table itself left a 613px
          box in the layout and scrolled the page sideways at 390. */}
      <div className="sr-only">
        <table>
          <caption>
            {project.title}: how {project.raters} {reviewersWord(project.raters)} rated{' '}
            {project.axisLabel}, on a scale from 1{lowLabel ? ` (${lowLabel})` : ''} to 5
            {highLabel ? ` (${highLabel})` : ''}.
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
              const here = votes.filter((vote) => vote.step === step)
              return (
                <tr key={step}>
                  <th scope="row">
                    {step}
                    {step === median ? ', the median' : ''}
                  </th>
                  <td>{here.length}</td>
                  <td>{here.length === 0 ? 'Nobody' : here.map((vote) => vote.name).join(', ')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.inWords}>
        <h3 className="text-2xs uppercase text-ink-3" style={{ fontVariationSettings: '"wght" 700' }}>
          In words
        </h3>
        <p className="voice measure text-voice">
          <strong>{project.raters}</strong> {reviewersWord(project.raters)} rated{' '}
          <strong>{project.title}</strong> on {project.axisLabel.toLowerCase()}, and their answers
          ran from <strong>{project.low}</strong>
          {lowNote} to <strong>{project.high}</strong>
          {highNote}. {lowCount} sat at the low end and {highCount} at the high end, and the median
          is <strong>{median}</strong>. An average would have printed one number somewhere between
          them and hidden a <strong>{project.spread}-step</strong> disagreement.
        </p>
      </div>
    </figure>
  )
}

/* ----------------------------------------------------------------- index -- */

export interface SpreadIndexProps {
  rows: readonly SpreadRow[]
}

export function SpreadIndex({ rows }: SpreadIndexProps) {
  return (
    <ol className={styles.index} aria-label="Projects ranked by how far apart their reviewers landed">
      {rows.map((row, position) => (
        <li key={row.slug} className={styles.indexRow}>
          <span aria-hidden="true" className={`${styles.rank} tnum`}>
            {String(position + 1).padStart(2, '0')}
          </span>

          <div className={styles.indexBody}>
            <p className="track-safe">
              <NextLink href={`/p/${row.slug}`} className={`${styles.stretch} text-md text-ink`}>
                {row.title}
              </NextLink>
              <span className="mt-1 block text-xs text-ink-3">
                {row.ownerName} · {row.typeLabel}
              </span>
            </p>

            <p className="track-safe">
              <GritReading value={row.grit} />
            </p>

            <p className="track-safe text-sm text-ink-2">
              {row.spread === 0 ? (
                <>
                  Agreed, <span className="text-ink">no spread</span>
                </>
              ) : (
                <>
                  Split{' '}
                  <span className="tnum text-ink" style={{ fontVariationSettings: '"wght" 700' }}>
                    {row.spread} {stepsWord(row.spread)}
                  </span>{' '}
                  on {row.axisLabel.toLowerCase()}
                </>
              )}
              <span className="mt-1 block text-xs text-ink-3">
                <span className="tnum">{row.raters}</span> reviewers rated it
              </span>
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
