/**
 * What happened lately: a hairline-ruled register, not a feed of cards.
 *
 * The rule belongs to the following row (`li + li`), so there is no orphan
 * hairline under the last entry and none doubled against the section edge
 * (PLAYBOOK MOVE 1). A short list still occupies three rows of height, so two
 * entries do not read as a broken page.
 */

import Link from 'next/link'
import { CircleCheck, MessageSquare, Package, Reply, Send, Tag, type LucideIcon } from 'lucide-react'
import { Avatar, EmptyState, Timestamp } from '@/components/ui'
import type { ActivityEntry } from '@/lib/types'

const ICON: Record<ActivityEntry['kind'], LucideIcon> = {
  feedback_received: MessageSquare,
  feedback_written: Send,
  reply: Reply,
  suggestion_shipped: Package,
  // A build is a label on a release, not a shipped change.
  version_published: Tag,
  project_published: Send,
  badge_awarded: CircleCheck,
}

export interface ActivityRegisterProps {
  entries: readonly ActivityEntry[]
}

export function ActivityRegister({ entries }: ActivityRegisterProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        variant="success"
        title="Nothing has happened since you last looked"
        body="This fills in as reviewers post, reply and vote. It is a record, so an empty one means a quiet week rather than a problem."
        primaryAction={{ label: 'Find a build to review', href: '/discover' }}
        headingLevel={3}
      />
    )
  }

  return (
    <ul
      className="m-0 flex list-none flex-col p-0"
      style={{ minBlockSize: 'calc(3 * var(--row-h))' }}
    >
      {entries.map((entry) => {
        const Icon = ICON[entry.kind]
        return (
          <li
            key={entry.id}
            className="flex items-center gap-sm border-t border-border-hair py-sm first:border-t-0"
            style={{ minBlockSize: 'var(--row-h)' }}
          >
            {/* Both leading marks are 32px, so every entry's text starts on
                the same line whether a person or an icon leads it. */}
            {entry.actor ? (
              <Avatar
                userId={entry.actor.id}
                name={entry.actor.displayName}
                src={entry.actor.avatarUrl}
                size="md"
              />
            ) : (
              <span className="flex h-xl w-xl shrink-0 items-center justify-center rounded-xs border border-border-hair text-text-3">
                <Icon size={16} strokeWidth={1.5} aria-hidden="true" />
              </span>
            )}

            <span className="flex min-w-0 flex-1 flex-col gap-3xs">
              <Link href={entry.url} className="text-sm text-text-1 no-underline hover:underline">
                {entry.title}
              </Link>
              {entry.detail ? (
                <span className="font-prose truncate text-xs text-text-2">{entry.detail}</span>
              ) : null}
            </span>

            <Timestamp ts={entry.at} />
          </li>
        )
      })}
    </ul>
  )
}

export default ActivityRegister
