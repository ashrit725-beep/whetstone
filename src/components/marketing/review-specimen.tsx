/**
 * What comes back: one real review, whole, with its parts named.
 *
 * Everything else on this page counts reviews. This is one. It is the artifact a
 * creator actually receives, rendered with the anatomy the project page renders
 * it with — a single 1.5px edge, a provenance strip above each point, hairlines
 * between points, nothing nested inside anything — so what a reader sees here is
 * what they get there, not an illustration of it.
 *
 * Beside it, the same review read as a list of its parts: which question it
 * answers, what the point was filed as, how bad the reviewer said it is, which
 * build it was written against, and where in the work it happened. Those five
 * facts are the product. The list is a definition list with leader rules rather
 * than lines drawn to the note, because a drawn line has to be re-drawn at every
 * width and lies at one of them.
 *
 * Keyboard contract: two links, the project and the full review. No disclosure,
 * no vote: those belong to the thread, where they work.
 */

import NextLink from 'next/link'
import { Prose } from '@/components/ui'
import type { SpecimenReview } from '@/app/(marketing)/_data'
import { GritReading } from './grit-reading'
import { InlineAsk } from './inline-ask'
import styles from './paper.module.css'

/** Severity is never carried by colour: the chip fills in, and it says the word. */
const SEVERITY_SOLID = new Set(['blocker', 'major'])

export interface ReviewSpecimenProps {
  review: SpecimenReview
}

export function ReviewSpecimen({ review }: ReviewSpecimenProps) {
  const lead = review.points[0]
  const shown = review.points.length
  const rest = Math.max(0, review.pointCount - shown)

  return (
    <div className="grid gap-12 md:grid-cols-12 md:gap-12">
      <article className={`${styles.note} track-safe md:col-span-7`}>
        <div className={styles.noteHead}>
          <p className="track-safe">
            <span className="block text-md text-ink" style={{ fontVariationSettings: '"wght" 700' }}>
              {review.reviewerName}
            </span>
            <span className="mt-1 block text-xs text-ink-3">
              Reviewed{' '}
              <NextLink href={`/p/${review.slug}`} className="link text-ink-2">
                {review.projectTitle}
              </NextLink>{' '}
              · {review.typeLabel}
              {review.minutes === null ? null : (
                <>
                  {' · '}
                  <span className="tnum">{review.minutes}</span> minutes with the build
                </>
              )}
            </span>
          </p>
          <GritReading value={review.grit} />
        </div>

        {review.headline ? (
          <div className={styles.noteBlock}>
            <span className="eyebrow text-ink-3">First impression</span>
            <p className="voice mt-2 text-md text-ink">{review.headline}</p>
          </div>
        ) : null}

        {review.points.map((point, index) => (
          <div key={point.id} className={index === 0 ? undefined : styles.notePoint}>
            <dl className={styles.noteFacts}>
              <div>
                <dt>Category</dt>
                <dd>{point.categoryLabel}</dd>
              </div>
              <div>
                <dt>Severity</dt>
                <dd>
                  <span
                    className="chip"
                    data-solid={SEVERITY_SOLID.has(point.severityKey) ? 'true' : undefined}
                  >
                    {point.severityLabel}
                  </span>
                </dd>
              </div>
              <div>
                <dt>{point.anchorLabel ? 'Where' : 'Kind'}</dt>
                <dd>{point.anchorLabel ?? point.actionabilityLabel}</dd>
              </div>
              <div>
                <dt>Written against</dt>
                <dd className="tnum">{review.versionLabel}</dd>
              </div>
            </dl>

            <div className={styles.noteBody}>
              <div className="voice text-base text-ink">
                <Prose content={point.body} allow="comment" />
              </div>
              {point.seconded > 0 ? (
                <p className="tnum mt-4 text-2xs uppercase text-ink-3">
                  Seconded by {point.seconded.toLocaleString('en')}{' '}
                  {point.seconded === 1 ? 'reviewer' : 'reviewers'}
                </p>
              ) : null}
            </div>
          </div>
        ))}

        <div className={styles.noteFoot}>
          <span className="tnum text-xs text-ink-3">
            {rest > 0
              ? `${String(rest)} more ${rest === 1 ? 'point' : 'points'} in this review`
              : 'That is the whole review'}
          </span>
          <NextLink
            href={`/p/${review.slug}#note-${review.id}`}
            className="link tap-44 text-xs whitespace-nowrap text-ink"
            style={{ fontVariationSettings: '"wght" 650' }}
          >
            Read it in the thread
          </NextLink>
        </div>
      </article>

      <dl className={`${styles.anno} track-safe md:col-span-5`}>
        {review.ask !== null ? (
          <div>
            <dt>Answers the ask</dt>
            <dd className="voice text-base italic text-ink-2">
              “<InlineAsk text={review.ask} />”
            </dd>
          </div>
        ) : null}
        {lead ? (
          <>
            <div>
              <dt>Filed under</dt>
              <dd>{lead.categoryLabel}</dd>
            </div>
            <div>
              <dt>Severity the reviewer set</dt>
              <dd>{lead.severityLabel}</dd>
            </div>
            {lead.anchorLabel !== null ? (
              <div>
                <dt>Anchored in the work</dt>
                <dd className="tnum">{lead.anchorLabel}</dd>
              </div>
            ) : null}
          </>
        ) : null}
        <div>
          <dt>Written against the build</dt>
          <dd className="tnum">{review.versionLabel}</dd>
        </div>
        <div>
          <dt>Marked helpful by</dt>
          <dd className="tnum">
            {review.helpful.toLocaleString('en')} {review.helpful === 1 ? 'member' : 'members'}
          </dd>
        </div>
      </dl>
    </div>
  )
}
