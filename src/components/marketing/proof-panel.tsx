/**
 * The live proof panel.
 *
 * Not a picture of the product: these are the first three rows of Discover's
 * open projects, most discussed first, rendered the way the product renders
 * them, with the real ask the creator wrote and the real grit they set. The
 * footer link opens that same view, so "See all" continues the list rather than
 * starting a different one. A picture of a product goes stale, cannot be read
 * by a screen reader and cannot be clicked. This can be clicked.
 *
 * Keyboard contract: one tab stop per row, on the title link. The row's hit
 * area is a stretched pseudo-element on that anchor, so middle click, modifier
 * click and the browser's own URL preview all still work.
 */

import NextLink from 'next/link'
import type { ProofRow } from '@/app/(marketing)/_data'
import { GritReading } from './grit-reading'
import styles from './paper.module.css'

export interface ProofPanelProps {
  rows: readonly ProofRow[]
  /** Every project taking feedback right now, so the footer can say what is not shown. */
  openTotal: number
}

function splitLine(row: ProofRow): string {
  if (row.spread === null) return 'not enough ratings to compare yet'
  if (row.spread === 0) return 'reviewers agreed'
  return `split ${String(row.spread)} ${row.spread === 1 ? 'step' : 'steps'}`
}

export function ProofPanel({ rows, openTotal }: ProofPanelProps) {
  const remaining = Math.max(0, openTotal - rows.length)

  return (
    <figure className={styles.panel}>
      <div className={styles.panelHead}>
        <figcaption
          className="flex items-center gap-2 text-2xs whitespace-nowrap uppercase text-ink"
          style={{ fontVariationSettings: '"wght" 700' }}
        >
          <span aria-hidden="true" className="block size-2 bg-mark" />
          Open for feedback now
        </figcaption>
        {/* Between 60 and 80rem the panel is too narrow for both labels on one
            line; the order is the lesser fact, and the footer link carries it. */}
        <span
          className="hidden text-2xs whitespace-nowrap uppercase text-ink-3 lg:inline"
          style={{ fontVariationSettings: '"wght" 650' }}
        >
          Most discussed
        </span>
      </div>

      <ul aria-label="Projects taking feedback right now">
        {rows.map((row) => (
          <li key={row.slug} className={styles.panelRow}>
            {/* A grid rather than a wrapping row, so every row in the panel
                puts the grit reading in the same place: top right where the
                panel is wide enough to spare it 10rem, under the owner line on
                a phone and in the narrow 60 to 80rem column, where beside the
                title it squeezed the owner line onto two lines. */}
            <div className="grid items-start gap-x-6 gap-y-3 sm:grid-cols-[minmax(0,1fr)_auto] md:grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto]">
              <p className="track-safe">
                <NextLink href={`/p/${row.slug}`} className={`${styles.stretch} text-lg text-ink`}>
                  {row.title}
                </NextLink>
                <span className="mt-1 block text-xs text-ink-3">
                  {row.ownerName} · {row.typeLabel}
                </span>
              </p>
              <GritReading value={row.grit} />
            </div>

            <p className="voice mt-3 text-voice italic text-ink-2">“{row.ask}”</p>

            <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-2xs uppercase text-ink-3">
              <span className="tnum" style={{ fontVariationSettings: '"wght" 700' }}>
                {row.reviews.toLocaleString('en')} {row.reviews === 1 ? 'review' : 'reviews'}
              </span>
              {/* The mark is spent once per viewport, on the dot above that
                  says these projects are asking. The split is carried by the
                  words and the weight instead. */}
              <span className="text-ink-2" style={{ fontVariationSettings: '"wght" 700' }}>
                {splitLine(row)}
              </span>
            </p>
          </li>
        ))}
      </ul>

      <div className={styles.panelFoot}>
        <span className="text-xs text-ink-3">
          {remaining > 0
            ? `${remaining.toLocaleString('en')} more open for feedback`
            : 'That is every project open for feedback'}
        </span>
        <NextLink
          href="/discover?open=1&sort=discussed"
          className="link text-xs whitespace-nowrap text-ink"
          style={{ fontVariationSettings: '"wght" 650' }}
        >
          See all <span className="tnum">{openTotal.toLocaleString('en')}</span>
        </NextLink>
      </div>
    </figure>
  )
}
