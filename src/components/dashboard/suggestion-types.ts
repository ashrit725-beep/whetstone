/**
 * What the tracker island needs, and nothing else.
 *
 * `contributors` is the important field: the reviewers whose notes fed this
 * suggestion. It is carried all the way to the card so the creator can see who
 * they are about to thank *before* they ship, not after.
 */

import type { TrackerColumnId } from '@/server/queries/dashboard'

export interface CardContributor {
  readonly id: string
  readonly name: string
  readonly handle: string
  readonly avatarUrl: string | null
}

export interface SuggestionCard {
  readonly id: string
  readonly title: string
  readonly column: TrackerColumnId
  readonly statusLabel: string
  readonly statusNote: string | null
  readonly projectTitle: string
  readonly themeLabel: string | null
  readonly voteCount: number
  readonly sourceCount: number
  readonly effortLabel: string | null
  readonly contributors: readonly CardContributor[]
  readonly shippedInVersion: string | null
  readonly statusChangedAt: number | null
}

export interface TrackerColumn {
  readonly id: TrackerColumnId
  readonly label: string
  readonly description: string
  readonly cards: readonly SuggestionCard[]
}

/** The status a column writes when a card lands in it. */
export const COLUMN_STATUS: Record<TrackerColumnId, string> = {
  open: 'open',
  planned: 'planned',
  in_progress: 'in_progress',
  shipped: 'shipped',
  declined: 'declined',
}

/** Columns that owe the reviewer a written reason before the move is allowed. */
export const NEEDS_A_REASON: readonly TrackerColumnId[] = ['shipped', 'declined']
