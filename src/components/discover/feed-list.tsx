'use client'

/**
 * The Discover feed: a plain <ul> of links with a keyboard accelerator on top.
 *
 * Keyboard contract (the handler lives on the <ul>, so these keys are live only
 * while focus is inside the feed, which is how SC 2.1.4 is satisfied; binding
 * them to `document` would stomp on every textarea in the product):
 *   ArrowDown / j   move to the next row and focus its title link
 *   ArrowUp / k     move to the previous row
 *   Home / End      first row / last row
 *   Enter           the browser's own link activation
 *   Any modifier    passes straight through, so Cmd+J still reaches the browser
 * The list is a roving tabindex: Tab enters at the current row, reaches that
 * row's grit filter, then leaves the feed. It stays an ordinary list of links,
 * with no `role="grid"`, so screen-reader list and link navigation are
 * untouched (PLAYBOOK 2.5).
 *
 * The row is not clickable through a handler on the <li>: a delegated listener
 * on the <ul> forwards a bare click to the title link, which keeps
 * `jsx-a11y/click-events-have-key-events` satisfied and leaves text selection
 * working (MOVE 3).
 */

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown } from 'lucide-react'
import { Button, Link } from '@/components/ui'
import { FeedRowItem } from './feed-row'
import type { FeedRow } from './row-data'
import { loadMoreRows } from './actions'

const TITLE_LINK = '.ws-row-title a'

/** `incoming` appended to `current`, less any row `current` already holds. */
function appendUnseen(current: readonly FeedRow[], incoming: readonly FeedRow[]): readonly FeedRow[] {
  const seen = new Set(current.map((row) => row.id))
  return [...current, ...incoming.filter((row) => !seen.has(row.id))]
}

export interface FeedListProps {
  rows: readonly FeedRow[]
  /** Every project the filters match. */
  total: number
  /** How many of them this sort lists; below `total` only for the ranked feed. */
  listed: number
  /** The instant the first page was ranked against; every later page reuses it. */
  clock: number
  nextOffset: number | null
  /** The current filter state, serialised. The Server Action re-parses it. */
  queryString: string
  /** Feed rows per page. */
  pageSize: number
  /** The same filters sorted by newest, which lists every row. */
  everyRowHref: string
}

export function FeedList({
  rows: initialRows,
  total: initialTotal,
  listed: initialListed,
  clock,
  nextOffset,
  queryString,
  pageSize,
  everyRowHref,
}: FeedListProps) {
  const [rows, setRows] = useState<readonly FeedRow[]>(initialRows)
  const [offset, setOffset] = useState<number | null>(nextOffset)
  const [counts, setCounts] = useState({ total: initialTotal, listed: initialListed })
  const [activeIndex, setActiveIndex] = useState(0)
  const [engaged, setEngaged] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [failure, setFailure] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const listRef = useRef<HTMLUListElement>(null)
  const router = useRouter()

  /* Clicking anywhere on the row opens it, without a handler on the <li>. */
  useEffect(() => {
    const ul = listRef.current
    if (!ul) return
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('a, button')) return
      if ((window.getSelection()?.toString() ?? '').length > 0) return
      target.closest('li')?.querySelector<HTMLAnchorElement>(TITLE_LINK)?.click()
    }
    ul.addEventListener('click', onClick)
    return () => ul.removeEventListener('click', onClick)
  }, [])

  /* Prefetch on intent, never on viewport entry: a 200-row feed must not fire
     200 route fetches. 120ms of dwell means scrolling past never arms it. */
  useEffect(() => {
    const ul = listRef.current
    if (!ul) return
    const armed = new Set<string>()
    let timer: number | undefined

    const arm = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const link = target.closest<HTMLAnchorElement>(TITLE_LINK)
      if (!link) return
      const href = link.getAttribute('href')
      if (!href || armed.has(href)) return
      window.clearTimeout(timer)
      timer = window.setTimeout(() => {
        armed.add(href)
        router.prefetch(href)
      }, 120)
    }
    const disarm = () => window.clearTimeout(timer)

    ul.addEventListener('pointerover', arm)
    ul.addEventListener('pointerout', disarm)
    ul.addEventListener('focusin', arm)
    return () => {
      window.clearTimeout(timer)
      ul.removeEventListener('pointerover', arm)
      ul.removeEventListener('pointerout', disarm)
      ul.removeEventListener('focusin', arm)
    }
  }, [router])

  const moveTo = useCallback((index: number) => {
    const ul = listRef.current
    if (!ul) return
    const links = Array.from(ul.querySelectorAll<HTMLAnchorElement>(TITLE_LINK))
    const link = links[index]
    if (!link) return
    setActiveIndex(index)
    setEngaged(true)
    link.focus({ preventScroll: true })
    link.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
  }, [])

  const onKeyDown = (event: React.KeyboardEvent<HTMLUListElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    const target = event.target
    if (target instanceof Element && target.closest('input, textarea, select, [contenteditable]')) return

    const last = rows.length - 1
    let next: number | null = null
    if (event.key === 'ArrowDown' || event.key === 'j') next = Math.min(activeIndex + 1, last)
    else if (event.key === 'ArrowUp' || event.key === 'k') next = Math.max(activeIndex - 1, 0)
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = last
    if (next === null) return

    event.preventDefault()
    moveTo(next)
  }

  const onFocus = (event: React.FocusEvent<HTMLUListElement>) => {
    const target: Element = event.target
    const li = target.closest('li')
    const parent = li?.parentElement
    if (!li || !parent) return
    const index = Array.from(parent.children).indexOf(li)
    if (index < 0) return
    setActiveIndex(index)
    setEngaged(true)
  }

  const loadMore = () => {
    if (offset === null || pending) return
    const from = offset
    setFailure(null)
    startTransition(async () => {
      const result = await loadMoreRows({ queryString, offset: from, limit: pageSize, clock })
      if (!result.ok) {
        setFailure(result.message)
        setAnnouncement(result.message)
        return
      }
      // The clock is pinned, but the rows are live: a review landing between
      // two pages can move a project across the page boundary. A row already
      // on screen is never drawn twice.
      const added = appendUnseen(rows, result.rows).length - rows.length
      setRows((current) => appendUnseen(current, result.rows))
      setOffset(result.nextOffset)
      setCounts({ total: result.total, listed: result.listed })
      setAnnouncement(
        `${added.toLocaleString('en')} more loaded, ${(rows.length + added).toLocaleString('en')} of ${result.total.toLocaleString('en')}.`,
      )
    })
  }

  const exhausted = offset === null
  const shownCount = rows.length

  return (
    <>
      <ul
        ref={listRef}
        className="ws-feed ws-bench"
        aria-busy={pending || undefined}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
      >
        {rows.map((row, index) => (
          <FeedRowItem
            key={row.id}
            row={row}
            current={engaged && index === activeIndex}
            tabIndex={index === activeIndex ? 0 : -1}
          />
        ))}
      </ul>

      <div className="mt-lg flex flex-col items-start gap-xs">
        {!exhausted ? (
          <Button
            onClick={loadMore}
            loading={pending}
            loadingLabel="Loading more projects…"
            iconLeading={<ArrowDown size={20} strokeWidth={1.5} />}
          >
            Load more projects
          </Button>
        ) : counts.listed < counts.total ? (
          <p className="measure-ui text-xs text-text-3">
            That’s the top <span className="tnum">{shownCount.toLocaleString('en')}</span> of{' '}
            <span className="tnum">{counts.total.toLocaleString('en')}</span>, as deep as the ranked
            feed goes. <Link href={everyRowHref}>Sort by newest</Link> to page through
            every one of them, or narrow the feed with a filter.
          </p>
        ) : (
          <p className="text-xs text-text-3">
            That’s everything. <span className="tnum">{shownCount.toLocaleString('en')}</span> of{' '}
            <span className="tnum">{counts.total.toLocaleString('en')}</span> shown.
          </p>
        )}

        {failure ? (
          <p className="measure-ui text-xs text-critical">{failure}</p>
        ) : null}

        <p aria-live="polite" role="status" className="sr-only">
          {announcement}
        </p>
      </div>
    </>
  )
}

export default FeedList
