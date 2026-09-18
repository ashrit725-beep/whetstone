'use client'

/**
 * The two registers search adds to the feed row: discussions and reviewers.
 *
 * Both reuse the feed's own row CSS with the cover column dropped, so search
 * results and Discover rows are visibly the same object at the same rhythm
 * rather than three invented list styles.
 *
 * Keyboard contract: one link per row, the title, with its `::after` covering
 * the row up to the metadata. Tab and Enter. No roving tabindex here: a results
 * page is read, not driven.
 *
 * `'use client'` for the same reason as `feed-row.tsx`: `Avatar` draws a grit
 * hatch, and `grit.tsx` is a client module. There are no hooks here.
 */

import Link from 'next/link'
import { Avatar } from '@/components/ui'
import type { ExpertCard, ThreadCard } from '@/lib/types'

export function DiscussionRow({ thread }: { thread: ThreadCard }) {
  return (
    <li>
      <div className="ws-row-body">
        <div className="ws-row-main">
          <h3 className="ws-row-title">
            <Link href={`/c/${thread.channel.slug}/${thread.id}`} prefetch={false}>
              {thread.title}
            </Link>
          </h3>
          <p className="ws-row-ask prose-human">{thread.excerpt}</p>
        </div>

        <dl className="ws-meta">
          <div>
            <dt>Channel</dt>
            <dd>{thread.channel.label}</dd>
          </div>
          <div>
            <dt>Started by</dt>
            <dd>{thread.author.displayName}</dd>
          </div>
          <div className="ws-meta-num">
            <dt>Replies</dt>
            <dd className="tnum">{thread.postCount.toLocaleString('en')}</dd>
          </div>
        </dl>
      </div>
    </li>
  )
}

export function ExpertRow({ expert }: { expert: ExpertCard }) {
  const areas = expert.expertise.slice(0, 3).map((a) => a.label)
  return (
    <li>
      <span className="ws-avatar-slot">
        <Avatar
          userId={expert.user.id}
          name={expert.user.displayName}
          src={expert.user.avatarUrl}
          size="lg"
        />
      </span>

      <div className="ws-row-body">
        <div className="ws-row-main">
          <h3 className="ws-row-title">
            <Link href={`/experts/${expert.user.handle}`} prefetch={false}>
              {expert.user.displayName}
            </Link>
          </h3>
          <p className="ws-row-ask prose-human">{expert.headline}</p>
        </div>

        <dl className="ws-meta">
          <div>
            <dt>Works on</dt>
            <dd>{areas.length > 0 ? areas.join(', ') : 'Not stated yet'}</dd>
          </div>
          <div>
            <dt>Turnaround</dt>
            <dd>
              {expert.turnaroundHours === null ? (
                'Not stated'
              ) : (
                <>
                  <span className="tnum">{expert.turnaroundHours.toLocaleString('en')}</span>
                  {' '}hours
                </>
              )}
            </dd>
          </div>
          <div className="ws-meta-num">
            <dt>Paid reviews</dt>
            <dd className="tnum">{expert.completedCount.toLocaleString('en')}</dd>
          </div>
        </dl>
      </div>
    </li>
  )
}
