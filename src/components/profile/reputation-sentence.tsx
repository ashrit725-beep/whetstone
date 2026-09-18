/**
 * Reputation as a sentence, not a badge wall and not a giant number (§4.4
 * surface 6). Every figure is a count from a row; a clause whose count is zero
 * is dropped rather than printed as "0", because a sentence full of zeroes is a
 * worse empty state than a shorter true sentence.
 */

import { Fragment, type ReactElement } from 'react'
import { cn } from '@/lib/utils'

export interface ReputationSentenceProps {
  projects: number
  shipped: number
  feedbackReceived: number
  reviewsWritten: number
  helpfulMarks: number
  className?: string
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

export function ReputationSentence({
  projects,
  shipped,
  feedbackReceived,
  reviewsWritten,
  helpfulMarks,
  className,
}: ReputationSentenceProps) {
  const creator: ReactElement[] = []
  if (projects > 0) {
    creator.push(
      <span key="projects">
        <span className="tnum text-text-1">{projects}</span>{' '}
        {plural(projects, 'project', 'projects')}
      </span>,
    )
  }
  if (shipped > 0) {
    creator.push(
      <span key="shipped">
        <span className="tnum text-text-1">{shipped}</span> shipped
      </span>,
    )
  }
  if (feedbackReceived > 0) {
    creator.push(
      <span key="received">
        <span className="tnum text-text-1">{feedbackReceived}</span>{' '}
        {plural(feedbackReceived, 'piece', 'pieces')} of feedback received
      </span>,
    )
  }

  const reviewer: ReactElement[] = []
  if (reviewsWritten > 0) {
    reviewer.push(
      <span key="written">
        <span className="tnum text-text-1">{reviewsWritten}</span>{' '}
        {plural(reviewsWritten, 'review', 'reviews')} written
      </span>,
    )
  }
  if (helpfulMarks > 0) {
    reviewer.push(
      <span key="helpful">
        <span className="tnum text-text-1">{helpfulMarks}</span> marked helpful by the creator
      </span>,
    )
  }

  if (creator.length === 0 && reviewer.length === 0) {
    return (
      <p className={cn('measure-ui text-sm text-text-2', className)}>
        Nothing posted and nothing reviewed yet. The first review is what starts a record here.
      </p>
    )
  }

  return (
    <p className={cn('measure-ui text-sm text-text-2', className)}>
      {join(creator)}
      {creator.length > 0 && reviewer.length > 0 ? '. ' : null}
      {join(reviewer)}.
    </p>
  )
}

function join(parts: readonly ReactElement[]): React.ReactNode {
  return parts.map((part, i) => (
    <Fragment key={String(part.key)}>
      {i > 0 ? ', ' : null}
      {part}
    </Fragment>
  ))
}

export default ReputationSentence
