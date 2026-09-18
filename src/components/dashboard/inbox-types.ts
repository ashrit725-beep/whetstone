/**
 * The serialisable shape the inbox client island receives.
 *
 * The repository returns a `FeedbackView` carrying points, ratings, themes and
 * the viewer’s own vote. Almost none of that belongs in a table row, and
 * shipping it all across the server boundary would put twenty fields in the
 * client bundle to render six columns. The page maps down to this.
 */

import type { InboxState, SeverityKey } from '@/lib/types'

export interface InboxRow {
  readonly id: string
  readonly reviewerName: string
  readonly reviewerHandle: string
  readonly reviewerAvatar: string | null
  readonly reviewerIsExpert: boolean
  readonly reviewerId: string
  /** The reviewer’s own words: headline if they wrote one, else the first note. */
  readonly headline: string
  readonly excerpt: string
  readonly severity: SeverityKey
  readonly severityLabel: string
  /** Points in this note: one note carries several. */
  readonly pointCount: number
  readonly state: InboxState
  readonly stateLabel: string
  readonly submittedAt: number
  readonly unanswered: boolean
  readonly projectTitle: string
  readonly helpfulMarked: boolean
}

export interface InboxRowGroup {
  readonly id: string
  readonly label: string
  readonly reviewers: number
  readonly impact: number | null
  readonly rows: readonly InboxRow[]
}

export type InboxSort = 'most_severe' | 'newest' | 'most_helpful'

export interface InboxFilterState {
  readonly project: string
  readonly state: InboxState | null
  readonly sort: InboxSort
  readonly unansweredOnly: boolean
  readonly grouped: boolean
  readonly note: string | null
}

export const SEVERITY_RANK: Record<SeverityKey, number> = {
  blocker: 0,
  major: 1,
  minor: 2,
  nit: 3,
  praise: 4,
}
