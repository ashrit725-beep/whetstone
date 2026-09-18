/**
 * The row's view model.
 *
 * `ProjectCard` carries far more than a row needs, and the feed list is a client
 * island (j/k traversal, the delegated row click, "Load more"), so what crosses
 * the boundary is this: flat, serialisable, and free of anything the row does
 * not draw. Every field traces to a real column (§7.1.6).
 */

import type { ProjectCard } from '@/lib/types'
import type { DiscoverState } from './filters'
import { hrefFor, withGrit } from './filters'

export interface FeedRow {
  readonly id: string
  readonly slug: string
  readonly title: string
  /** The creator's first ask, falling back to the tagline. A person wrote both. */
  readonly ask: string
  readonly typeLabel: string
  readonly stageLabel: string
  readonly grit: number
  /** The first declared need, or null when the creator declared none. */
  readonly wants: string | null
  readonly feedbackCount: number
  readonly href: string
  /** Filter the feed to this project's grit step. */
  readonly gritHref: string
  readonly feedbackState: 'open' | 'invite_only' | 'closed'
}

export function toFeedRow(
  card: ProjectCard,
  ask: string | undefined,
  state: DiscoverState,
): FeedRow {
  return {
    id: card.id,
    slug: card.slug,
    title: card.title,
    ask: ask ?? card.tagline ?? '',
    typeLabel: card.typeLabel,
    stageLabel: card.stageLabel,
    grit: card.grit,
    wants: card.needs[0]?.label ?? null,
    feedbackCount: card.counts.feedback,
    href: `/p/${card.slug}`,
    gritHref: hrefFor(withGrit({ ...state, grit: null }, card.grit)),
    feedbackState: card.feedbackState,
  }
}
