/**
 * Serialisable shapes passed from the server chrome into its client islands,
 * and back out of the chrome's Server Actions. Kept out of the `'use server'`
 * module because that file may export nothing but async functions.
 */

import type { NotificationKind } from '@/lib/types'

/** One row in the bell's popover. */
export interface NotificationItem {
  readonly id: string
  readonly kind: NotificationKind
  readonly title: string
  readonly body: string | null
  /** Always a real route. A notification with nowhere to go is not sent. */
  readonly url: string
  readonly actorName: string | null
  readonly createdAt: number
  readonly isRead: boolean
}

/**
 * One row on `/notifications`. Unlike the bell, the full list keeps a row
 * whose destination no longer exists, drawn without a link, so the page holds
 * exactly as many rows as the count beside it says.
 */
export interface NotificationListItem extends Omit<NotificationItem, 'url'> {
  readonly url: string | null
}

/** The named runs the bell groups its rows into, in render order. */
export type NotificationGroup = 'shipped' | 'feedback' | 'community' | 'market' | 'account'

/** A single row in the command palette's listbox. */
export interface CommandHit {
  readonly id: string
  readonly label: string
  /** The one line of context under the label. Never a duplicate of it. */
  readonly meta: string
  readonly href: string
}

export type CommandGroupKey = 'projects' | 'people' | 'discussions' | 'actions'

export interface CommandGroup {
  readonly key: CommandGroupKey
  readonly label: string
  readonly hits: readonly CommandHit[]
}

export interface CommandResults {
  readonly query: string
  readonly groups: readonly CommandGroup[]
  readonly total: number
}

/** What the palette writes to localStorage so a reopen is instant. */
export interface RecentHit extends CommandHit {
  readonly group: CommandGroupKey
}
