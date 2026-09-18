/**
 * The disagreement plot: the most valuable thing on this page.
 *
 * A mean of a five step scale is a number nobody chose. So this draws the
 * people instead: every step carries the reviewers who chose it, by name, the
 * median step is picked out, and a bracket under the whole thing says how far
 * apart they are.
 *
 * It is drawn in the same hand as the figure on the landing page, so the
 * reading a visitor met there is the reading they meet here. Every step has the
 * same parts in the same order (the numeral, how many stood there, then the
 * names), so the numerals share one baseline and the names share one edge
 * whatever the data looks like. A step prints three names and counts the rest:
 * the sentence underneath and the table carry every one of them. An empty step
 * keeps its place with a hairline, because the gap is the finding. What 1 and
 * the top of the scale mean on this axis is said once, in the head, rather
 * than squeezed under the end columns.
 *
 * Three things make it survive contact with reality.
 *
 *   Greyscale. The median is a lighter ground AND a word hung off its numeral.
 *   Nothing on this plot is carried by hue, and the mark colour stays reserved
 *   for the ask.
 *
 *   Small screens. Below 60rem five columns of names is unreadable, so the same
 *   markup lies down as rows. The drawing is `aria-hidden`, and the single
 *   accessible representation is the table beside it, which is the honest way
 *   to expose a chart.
 *
 *   Plain English. Under the heading “In words” the whole reading is restated
 *   as sentences, generated from the same counts the plot is drawn from, so a
 *   reader who takes nothing from the picture still gets the finding. The
 *   heading above the plot is generated the same way, so four contested areas
 *   carry four different headlines rather than one sentence four times.
 *
 * Server-safe. Nothing here is interactive, so nothing here is a client island.
 */

import type { AxisVerdicts } from '@/server/queries/project-surface'
import { joinWords, plural } from './paper'

export interface AxisReading {
  readonly axisId: string
  readonly label: string
  readonly scaleMax: number
  readonly lowLabel: string | null
  readonly highLabel: string | null
  readonly steps: readonly AxisStep[]
  readonly count: number
  readonly min: number
  readonly max: number
  readonly median: number
  readonly spread: number
  readonly contested: boolean
}

interface AxisStep {
  readonly value: number
  /** Verified experts first, then by name, so the three a step prints are the most informed. */
  readonly names: readonly string[]
}

/** How many names a step prints before it counts the rest, as the landing figure does. */
const NAMES_SHOWN = 3

/** One pass over the verdicts. Everything the plot needs, nothing it does not. */
export function readAxis(axis: AxisVerdicts): AxisReading | null {
  if (axis.verdicts.length === 0) return null

  const values = axis.verdicts.map((v) => v.value).sort((a, b) => a - b)
  // The verdicts arrive in name order, and the sort is stable, so experts lead
  // and everyone else stays alphabetical behind them.
  const steps = Array.from({ length: axis.scaleMax }, (_, i) => ({
    value: i + 1,
    names: axis.verdicts
      .filter((v) => v.value === i + 1)
      .sort((a, b) => Number(b.isExpert) - Number(a.isExpert))
      .map((v) => v.reviewerName),
  }))

  const mid = Math.floor(values.length / 2)
  const median =
    values.length % 2 === 1
      ? (values[mid] ?? 0)
      : Math.round(((values[mid - 1] ?? 0) + (values[mid] ?? 0)) / 2)

  const min = values[0] ?? 0
  const max = values[values.length - 1] ?? 0

  return {
    axisId: axis.axisId,
    label: axis.label,
    scaleMax: axis.scaleMax,
    lowLabel: axis.lowLabel,
    highLabel: axis.highLabel,
    steps,
    count: values.length,
    min,
    max,
    median,
    spread: max - min,
    contested: max - min >= 2,
  }
}

function countLine(step: AxisStep): string {
  return step.names.length === 0
    ? 'Nobody'
    : `${String(step.names.length)} ${plural(step.names.length, 'reviewer', 'reviewers')}`
}

/** What 1 and the top of the scale mean on this axis, where the axis says. */
function endLabel(step: AxisStep, reading: AxisReading): string | null {
  if (step.value === 1) return reading.lowLabel
  if (step.value === reading.scaleMax) return reading.highLabel
  return null
}

function stepsApart(spread: number): string {
  return `${String(spread)} ${plural(spread, 'step', 'steps')} apart`
}

/* -------------------------------------------------------------------------- */

export function DisagreementPlot({ reading }: { reading: AxisReading }) {
  const headingId = `axis-${reading.axisId}`
  const top = String(reading.scaleMax)

  return (
    <section aria-labelledby={headingId} className="flex flex-col">
      <div className="ws-plot-head">
        <h3 id={headingId} className="flex flex-col gap-3">
          <span className="eyebrow text-ink-3">{reading.label}</span>
          <span className="max-w-[30ch] text-lg lg:text-xl">{headline(reading)}</span>
        </h3>
        <div className="track-safe flex flex-col gap-1">
          {reading.lowLabel || reading.highLabel ? (
            <p className="ws-plot-key">
              {reading.lowLabel ? (
                <span>
                  <b className="tnum">1</b>
                  {reading.lowLabel}
                </span>
              ) : null}
              {reading.highLabel ? (
                <span>
                  <b className="tnum">{top}</b>
                  {reading.highLabel}
                </span>
              ) : null}
            </p>
          ) : null}
          <p className="tnum text-xs text-ink-3">
            {`Rated by ${String(reading.count)} ${plural(reading.count, 'reviewer', 'reviewers')}, ${stepsApart(reading.spread)}`}
          </p>
        </div>
      </div>

      {/* The drawing. Everything in it is also in the table below, so it is
          hidden from assistive technology rather than read out twice. */}
      <div aria-hidden="true" style={{ ['--steps' as string]: top }}>
        <ol className="ws-plot-cols">
          {reading.steps.map((step) => {
            const shown = step.names.slice(0, NAMES_SHOWN)
            const rest = step.names.length - shown.length
            const median = step.value === reading.median
            return (
              <li key={step.value} className="ws-plot-col" data-median={median ? 'true' : undefined}>
                <p className="ws-plot-foot">
                  <span className="ws-plot-step tnum">
                    {step.value}
                    {median ? <span className="ws-plot-tag">Median</span> : null}
                  </span>
                  <span className="tnum text-xs text-ink-3">{countLine(step)}</span>
                </p>
                <span className="ws-plot-stack">
                  {step.names.length === 0 ? <span className="ws-plot-none" /> : null}
                  {/* Two reviewers can share a name, so the key carries the
                      position as well. */}
                  {shown.map((name, i) => (
                    <span key={`${name}-${String(i)}`} className="ws-voter">
                      <span>{name}</span>
                    </span>
                  ))}
                  {rest > 0 ? <span className="ws-plot-more tnum">{`+${String(rest)} more`}</span> : null}
                </span>
              </li>
            )
          })}
        </ol>

        <div className="ws-plot-bracket">
          <span
            className="ws-plot-bracket-bar"
            style={{ gridColumn: `${String(reading.min)} / ${String(reading.max + 1)}` }}
          >
            {stepsApart(reading.spread)}
          </span>
        </div>
      </div>

      <VerdictTable reading={reading} />

      <div className="ws-plot-words">
        <span className="eyebrow text-ink-3">In words</span>
        <p className="voice measure">{inWords(reading)}</p>
      </div>
    </section>
  )
}

/* --------------------------------------------------------- the quiet case */

/**
 * Where they agree, say where, in one line of numbers. The verdict ("not in
 * dispute") is said once, over the list, rather than as the same closing
 * sentence under every row. A single rating is not an agreement, so a row only
 * one reviewer has rated carries no line at all: its count says it.
 */
export function AgreementRow({ reading }: { reading: AxisReading }) {
  const max = String(reading.scaleMax)
  const all = reading.count === 2 ? 'Both' : `All ${String(reading.count)}`
  const line =
    reading.count === 1
      ? null
      : reading.spread === 0
        ? `${all} put it at ${String(reading.median)} of ${max}.`
        : `${all} within one step of each other, at ${String(reading.min)} to ${String(reading.max)} of ${max}.`

  return (
    <li className="grid gap-x-16 gap-y-2 py-6 lg:grid-cols-[1fr_auto_auto] lg:items-baseline">
      <div>
        <p className="text-md font-bold text-ink">{reading.label}</p>
        {line ? <p className="mt-1 max-w-[62ch] text-sm text-ink-3">{line}</p> : null}
      </div>
      <span className="tnum text-lg font-bold text-ink">
        {reading.median}
        <span className="text-md text-ink-3">{`/${max}`}</span>
      </span>
      <span className="eyebrow text-ink-3">
        {`${String(reading.count)} ${plural(reading.count, 'reviewer', 'reviewers')}`}
      </span>
    </li>
  )
}

/* -------------------------------------------------------------------------- */

/**
 * The one accessible representation of the plot.
 *
 * The wrapper carries `sr-only`, not the table: `width: 1px` on a `<table>` is
 * a suggestion the table layout algorithm is free to ignore, and it does, which
 * put a 1,560px invisible table on the page and scrolled the whole document
 * sideways. An absolutely positioned, overflow-hidden wrapper cannot.
 */
function VerdictTable({ reading }: { reading: AxisReading }) {
  return (
    <div className="sr-only">
    <table>
      <caption>{`${reading.label}: where each of the ${String(reading.count)} reviewers placed it, on a scale of 1 to ${String(reading.scaleMax)}. Median ${String(reading.median)}.`}</caption>
      <thead>
        <tr>
          <th scope="col">Step</th>
          <th scope="col">Reviewers</th>
          <th scope="col">Who</th>
        </tr>
      </thead>
      <tbody>
        {reading.steps.map((step) => {
          const end = endLabel(step, reading)
          return (
            <tr key={step.value}>
              <th scope="row">{`${String(step.value)} of ${String(reading.scaleMax)}${end ? `, ${end}` : ''}${step.value === reading.median ? ', the median' : ''}`}</th>
              <td>{step.names.length}</td>
              <td>{step.names.length === 0 ? 'Nobody' : joinWords(step.names)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
    </div>
  )
}

function capitalise(s: string): string {
  return s.length === 0 ? s : (s[0] ?? '').toUpperCase() + s.slice(1)
}

/** Counts up to ten are words and larger ones are numerals, everywhere. */
function count(n: number): string {
  return WORDS[n] ?? String(n)
}

function says(n: number): string {
  return n === 1 ? 'says' : 'say'
}

/**
 * The plot's headline: where most of them stood, and who stood furthest away.
 *
 * A near-even split between the two biggest groups is the finding itself, so
 * it is said as one. Otherwise the largest group is named, then whoever sits
 * furthest from it; when the far ends on both sides are equally far, both are.
 */
function headline(reading: AxisReading): string {
  const max = String(reading.scaleMax)
  const ranked = reading.steps
    .filter((s) => s.names.length > 0)
    .sort((a, b) => b.names.length - a.names.length || a.value - b.value)
  const top = ranked[0]
  if (!top) return 'Nobody has rated this yet.'
  const second = ranked[1]

  if (second && second.names.length * 4 >= top.names.length * 3) {
    const [lo, hi] = [top.value, second.value].sort((a, b) => a - b)
    return `Split between ${String(lo)} and ${String(hi)} of ${max}.`
  }

  const lead = `${capitalise(count(top.names.length))} ${says(top.names.length)} ${String(top.value)} of ${max}.`
  const low = reading.steps.find((s) => s.names.length > 0 && s.value < top.value)
  const high = [...reading.steps].reverse().find((s) => s.names.length > 0 && s.value > top.value)
  const reach = (s: AxisStep | undefined) => (s ? Math.abs(s.value - top.value) : -1)
  const furthest = Math.max(reach(low), reach(high))
  const far = [low, high].filter((s): s is AxisStep => s !== undefined && reach(s) === furthest)
  if (far.length === 0) return lead
  const tail = far.map((s) => `${count(s.names.length)} ${says(s.names.length)} ${String(s.value)}`).join(' and ')
  return `${lead} ${capitalise(tail)}.`
}

/**
 * The reading, as sentences. Generated from the same counts the plot is drawn
 * from, so the picture and the words can never disagree with each other.
 */
export function inWords(reading: AxisReading): string {
  const occupied = reading.steps.filter((s) => s.names.length > 0)
  const ranked = [...occupied].sort((a, b) => b.names.length - a.names.length)
  const max = String(reading.scaleMax)

  const opening = `${capitalise(count(reading.count))} ${plural(reading.count, 'reviewer', 'reviewers')}, split across ${count(occupied.length)} ${plural(occupied.length, 'step', 'steps')} of the scale.`

  const body = ranked
    .map((step) => {
      const n = step.names.length
      const who = joinWords(step.names)
      // The same people the drawing prints for this step, in the same order.
      const named = step.names.slice(0, NAMES_SHOWN)
      if (n === 1) return `${who} says ${String(step.value)} of ${max}.`
      if (n <= named.length) return `${capitalise(count(n))} of them say ${String(step.value)} of ${max}: ${who}.`
      return `${capitalise(count(n))} say ${String(step.value)} of ${max}, among them ${joinWords(named)}.`
    })
    .join(' ')

  // "The work is not the problem" is only true when nobody put it in the
  // bottom half of the scale. Said over a spread that reaches 2, it contradicted
  // an ask about testers quitting in the tutorial.
  const low = reading.steps.filter((s) => s.value <= 2).reduce((sum, s) => sum + s.names.length, 0)
  const close =
    reading.min >= 3
      ? ` The median is ${String(reading.median)} of ${max}. Nobody placed it below ${String(reading.min)}, so the work is not the problem; what they disagree about is how far along it is.`
      : ` The median is ${String(reading.median)} of ${max}, and ${count(low)} placed it at 2 or below, which is the note to read first.`

  // A display name is typed by its owner and can end in a full stop (“Aleksy
  // N.”), so a sentence that ends on one would otherwise read “Aleksy N..”.
  return `${opening} ${body}${close}`.replace(/\.\.(?=\s|$)/g, '.')
}

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']

export default DisagreementPlot
