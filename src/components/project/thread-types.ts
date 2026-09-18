/** The thread's view model: plain data, serializable across the RSC boundary. */

export interface ThreadReply {
  readonly id: string
  readonly authorName: string
  readonly authorHandle: string
  readonly isCreator: boolean
  readonly bodyMd: string
  readonly createdAt: number
}

export interface ThreadPoint {
  readonly id: string
  readonly bodyMd: string
  readonly severityKey: string
  readonly severityLabel: string
  readonly actionabilityLabel: string
  readonly categoryLabel: string
  readonly upvoteCount: number
  readonly viewerUpvoted: boolean
  readonly isResolved: boolean
  /** Where in the work: a timecode, a route, a screen, a level. */
  readonly anchorLabel: string | null
  /** Present only when this note turned into a change that actually went out. */
  readonly shippedInVersion: string | null
}

export interface ThreadNote {
  readonly id: string
  readonly reviewerName: string
  readonly reviewerHandle: string
  readonly reviewerAvatarUrl: string | null
  readonly reviewerIsExpert: boolean
  readonly reviewerTierLabel: string
  /** Global credibility, 0-1000. Shown so “expert” is not the only signal. */
  readonly reviewerScore: number
  readonly headline: string | null
  readonly submittedAt: number | null
  readonly versionLabel: string | null
  readonly isQualified: boolean
  readonly responseState: 'unanswered' | 'replied' | 'resolved'
  readonly creatorMarkedHelpful: boolean
  readonly helpfulCount: number
  readonly viewerVote: -1 | 0 | 1
  readonly points: readonly ThreadPoint[]
  readonly replies: readonly ThreadReply[]
  /** True only for a row inserted optimistically, before the server answers. */
  readonly pending?: boolean
}

export type ThreadSort = 'most_helpful' | 'newest' | 'most_severe'

export const THREAD_SORTS: readonly { key: ThreadSort; label: string }[] = [
  { key: 'most_helpful', label: 'Most helpful' },
  { key: 'newest', label: 'Newest' },
  { key: 'most_severe', label: 'Most severe' },
]

export function isThreadSort(value: string): value is ThreadSort {
  return THREAD_SORTS.some((s) => s.key === value)
}
