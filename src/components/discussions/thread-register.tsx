/**
 * The thread register inside a channel: title, what kind of thread it is, who
 * started it, what it says, how many replies, and when it last moved.
 *
 * No faces. Surface 8 spends no boldness (§1), and a stack of four generated
 * avatar tiles per row was the loudest object on the quietest page in the
 * product while telling the reader less than the reply count already does.
 * See `design/PRIMITIVE-DEFECTS.md` for the AvatarGroup issue behind it.
 *
 * Server-safe. The one link per row is the title; its `::after` covers the row,
 * so the target is the whole row and the accessible name is the title alone.
 *
 * Keyboard contract: Tab reaches each title in reading order. Nothing here
 * traps focus.
 */

import { Check, Lock, Pin } from 'lucide-react'
import { Badge, Link, Timestamp } from '@/components/ui'
import type { ThreadCard } from '@/lib/types'
import { THREAD_KIND_LABEL } from './labels'

export interface ThreadRegisterProps {
  threads: readonly ThreadCard[]
  channelSlug: string
  label: string
}

/**
 * Two lines of the opening post at the register's 66ch measure, cut on a word.
 * `line-clamp` would do the same job in CSS and cut mid-word: "designs gam…" is
 * a worse line than one word fewer.
 */
const EXCERPT_CHARS = 132

/** Trailing punctuation before an ellipsis reads as ".…" or ",…". Drop it. */
function elide(text: string): string {
  return `${text.replace(/[\s.,;:…]+$/u, '')}…`
}

function twoLines(text: string): string {
  const flat = text.replace(/[\s…]+$/u, '')
  const truncated = flat.length < text.replace(/\s+$/u, '').length
  if (flat.length <= EXCERPT_CHARS) return truncated ? elide(flat) : flat
  const cut = flat.slice(0, EXCERPT_CHARS)
  const lastSpace = cut.lastIndexOf(' ')
  return elide(lastSpace > 40 ? cut.slice(0, lastSpace) : cut)
}

export function ThreadRegister({ threads, channelSlug, label }: ThreadRegisterProps) {
  return (
    <ul className="ws-register" aria-label={label}>
      {threads.map((thread) => {
        const lastMoved = thread.lastPostAt ?? thread.createdAt

        return (
          <li key={thread.id} className="ws-row ws-thread-row">
            <div className="track-safe">
              <div className="flex flex-wrap items-center gap-xs">
                <h2
                  className="ws-row-title text-sm"
                  style={{ fontVariationSettings: '"wdth" 100, "wght" 600' }}
                >
                  <Link
                    href={`/c/${channelSlug}/${thread.id}`}
                    variant="inline"
                    className="text-text-1 no-underline hover:underline"
                  >
                    {thread.title}
                  </Link>
                </h2>
                {thread.isPinned ? (
                  <Badge tone="neutral" icon={Pin}>
                    Pinned
                  </Badge>
                ) : null}
                {thread.hasAcceptedAnswer ? (
                  <Badge tone="positive" icon={Check}>
                    Answered
                  </Badge>
                ) : null}
                {/* Archived threads take no replies either, and the thread page
                    already calls both Locked; the register now agrees. */}
                {thread.status === 'locked' || thread.status === 'archived' ? (
                  <Badge tone="neutral" icon={Lock}>
                    Locked
                  </Badge>
                ) : null}
              </div>

              <p className="mt-2xs text-xs text-text-3">
                {THREAD_KIND_LABEL[thread.kind]} started by{' '}
                <span className="text-text-2">{thread.author.displayName}</span>{' '}
                <Timestamp ts={thread.createdAt} />
              </p>

              {thread.excerpt ? (
                <p className="measure-prose mt-2xs font-prose text-xs text-text-2">
                  {twoLines(thread.excerpt)}
                </p>
              ) : null}
            </div>

            <div className="ws-row-side">
              <dl className="ws-cell ws-cell-count">
                <dt>Replies</dt>
                <dd>{thread.postCount.toLocaleString('en')}</dd>
              </dl>

              <dl className="ws-cell ws-cell-when">
                <dt>Last activity</dt>
                <dd>
                  <Timestamp ts={lastMoved} />
                </dd>
              </dl>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default ThreadRegister
