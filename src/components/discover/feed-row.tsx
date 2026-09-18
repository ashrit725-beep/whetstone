'use client'

/**
 * One Discover row: 48px cover, title in Archivo, the ask in Literata clipped to
 * two lines, and a <dl> of metadata. Never a card (§4.4 surface 2).
 *
 * The cover is `CoverMark`, not `@/components/ui/cover-art`: see the header of
 * `cover-mark.tsx` and `design/PRIMITIVE-DEFECTS.md` for why the shared
 * primitive resolves to a flat grey square at 48px.
 *
 * Keyboard contract: the row holds exactly two controls, the title link and the
 * grit chip link, and both take their tabindex from the list (roving tabindex,
 * see feed-list.tsx). The title's `::after` covers the row up to the metadata
 * columns, so a pointer anywhere on the row opens the project while the grit
 * chip stays a live filter and the accessible name stays the title.
 *
 * This module carries `'use client'` and no hooks. The directive is placement,
 * not interactivity: `grit.tsx` is a client module, so `GritChip` (which reads
 * `GRIT_STEPS` at render time) only works inside a client graph. Declaring it
 * here means the row renders the same whether the feed list, the search page or
 * a future surface asks for it, instead of silently losing its chip in one
 * of them.
 */

import Link from 'next/link'
import Image from 'next/image'
import { GritChip } from '@/components/ui'
import { artworkFor } from '@/components/project/artwork'
import { CoverMark } from './cover-mark'
import type { FeedRow } from './row-data'

const FEEDBACK_STATE_WORDS: Record<FeedRow['feedbackState'], string | null> = {
  open: null,
  invite_only: 'Invited reviewers only',
  closed: 'Closed to new notes',
}

export interface FeedRowItemProps {
  row: FeedRow
  /** True for the row the keyboard is pointing at. At most one per view. */
  current?: boolean
  /** Roving tabindex: 0 on the current row's controls, -1 on every other row. */
  tabIndex?: 0 | -1
}

export function FeedRowItem({ row, current = false, tabIndex = 0 }: FeedRowItemProps) {
  const stateWord = FEEDBACK_STATE_WORDS[row.feedbackState]

  return (
    <li
      aria-current={current ? 'true' : undefined}
      className={current ? 'grind-mark-on' : undefined}
      data-row-id={row.id}
    >
      <span className="ws-thumb">
        {/* A project that has real artwork shows it. The generated mark is for
            projects that have none, which is most of them; it is a designed
            state rather than a placeholder, so the two sit together without
            one looking unfinished. `alt=""` because the title is the next
            thing a screen reader reads. */}
        {(() => {
          const art = artworkFor(row.slug)
          return art ? (
            <Image
              src={art.hero.src}
              alt=""
              width={48}
              height={48}
              sizes="48px"
              className="h-full w-full object-cover"
            />
          ) : (
            <CoverMark seed={row.slug} />
          )
        })()}
      </span>

      <div className="ws-row-body">
        <div className="ws-row-main">
          <h3 className="ws-row-title">
            <Link href={row.href} prefetch={false} tabIndex={tabIndex}>
              {row.title}
            </Link>
          </h3>
          <p className="ws-row-ask prose-human">{row.ask}</p>
        </div>

        <dl className="ws-meta">
          <div>
            <dt>Wants</dt>
            <dd>{stateWord ?? row.wants ?? 'Any read'}</dd>
          </div>
          <div>
            <dt>Type</dt>
            <dd>{row.typeLabel}</dd>
          </div>
          <div>
            <dt>Grit</dt>
            <dd>
              <Link href={row.gritHref} prefetch={false} tabIndex={tabIndex} className="ws-grit-link">
                <GritChip value={row.grit} size="sm" />
                <span className="sr-only">Show only projects at {row.grit} grit</span>
              </Link>
            </dd>
          </div>
          <div className="ws-meta-num">
            <dt>Notes</dt>
            <dd className="tnum">{row.feedbackCount.toLocaleString('en')}</dd>
          </div>
        </dl>
      </div>
    </li>
  )
}

export default FeedRowItem
