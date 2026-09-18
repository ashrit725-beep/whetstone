/**
 * One public review this person wrote, as a register row.
 *
 * Serif body, because a human wrote it. The metadata is a `<dl>` rather than a
 * dot-joined string, and every figure on it is a count from the review's own
 * row: points filed, blockers found, whether the creator marked it helpful.
 *
 * The inline padding is the feed row's own `--spacing-sm`, not a smaller
 * number of its own. On the profile overview this list sits directly under the
 * project list, which is the Discover row, and two lists inset by different
 * amounts read as two lists that missed each other.
 *
 * Keyboard contract: one tab stop, on the project link. Nothing else here is
 * interactive.
 */

import { Check, MessageSquare, TriangleAlert } from 'lucide-react'
import { Link, Timestamp } from '@/components/ui'
import type { FeedbackView } from '@/lib/types'

export interface ReviewRowProps {
  review: FeedbackView
}

export function ReviewRow({ review }: ReviewRowProps) {
  const body = review.summaryMd ?? review.points[0]?.bodyMd ?? null

  return (
    <li className="flex flex-col gap-2xs border-t border-border-hair px-sm py-md first:border-t-0">
      <div className="flex flex-wrap items-baseline gap-x-xs gap-y-3xs">
        <h3 className="text-sm break-words text-text-1" style={{ fontVariationSettings: '"wdth" 100, "wght" 600' }}>
          {review.headline ?? 'Review'}
        </h3>
        <span className="text-xs text-text-3">
          on{' '}
          <Link href={`/p/${review.projectSlug}`} variant="inline">
            {review.projectTitle}
          </Link>
        </span>
      </div>

      {body ? <p className="prose-human text-xs line-clamp-3">{body}</p> : null}

      <dl className="mt-2xs flex flex-wrap items-center gap-x-md gap-y-2xs">
        <div className="flex items-baseline gap-2xs text-xs text-text-2">
          <dt className="text-text-3">Specificity</dt>
          <dd className="tnum">
            {review.specificity.toFixed(2)}
            <span className="text-text-3">
              {review.isQualified ? ', qualified' : ', below the qualifying line'}
            </span>
          </dd>
        </div>

        <div className="flex items-center gap-2xs text-xs text-text-2">
          <dt className="flex items-center gap-2xs text-text-3">
            <MessageSquare size={16} strokeWidth={1.5} aria-hidden="true" />
            <span>Points</span>
          </dt>
          <dd className="tnum">{review.counts.points}</dd>
        </div>

        {review.counts.blockers > 0 ? (
          <div className="flex items-center gap-2xs text-xs text-text-2">
            <dt className="flex items-center gap-2xs text-critical">
              <TriangleAlert size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Blockers</span>
            </dt>
            <dd className="tnum">{review.counts.blockers}</dd>
          </div>
        ) : null}

        {review.creatorMarkedHelpful ? (
          <div className="flex items-center gap-2xs text-xs text-positive">
            <dt className="flex items-center gap-2xs">
              <Check size={16} strokeWidth={1.5} aria-hidden="true" />
              <span>Creator marked this helpful</span>
            </dt>
            <dd className="sr-only">Yes</dd>
          </div>
        ) : null}

        {review.submittedAt !== null ? (
          <div className="flex items-center gap-2xs text-xs text-text-3">
            <dt className="sr-only">Posted</dt>
            <dd>
              <Timestamp ts={review.submittedAt} prefix="Posted" />
            </dd>
          </div>
        ) : null}
      </dl>
    </li>
  )
}

export default ReviewRow
