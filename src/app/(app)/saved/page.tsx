/**
 * The shelf: the projects this member pressed Save on.
 *
 * Save has always written a row and said "Saved to your list", and there was no
 * list — the one way back to a saved project was to already know its address,
 * which is the thing saving exists to avoid. This is that list, and nothing
 * more: it does not rank, it does not recommend, and it does not filter. Newest
 * save first, which is the order the shelf was built in.
 *
 * Reading order per row is the same as the feed's: what it is called, who is
 * asking, what they are asking for, and how far along it is. Save and unsave
 * both stay on the project page, where the button and its state already live.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { EmptyState } from '@/components/ui'
import { asksForProjects } from '@/server/queries/discover'
import { listBookmarks } from '@/server/repos/projects'
import { GritReading } from '@/components/project/paper'
import { ProjectStyles } from '@/components/project/styles'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Saved projects',
  robots: { index: false, follow: false },
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

const PAGE_SIZE = 24

export default async function SavedPage({ searchParams }: { searchParams: SearchParams }) {
  const claims = await currentClaimsLive()
  if (!claims) redirect(`/sign-in?next=${encodeURIComponent('/saved')}`)

  const sp = await searchParams
  const cursor = typeof sp['cursor'] === 'string' ? sp['cursor'] : null
  const page = listBookmarks(claims.uid, { cursor, limit: PAGE_SIZE })
  const asks = asksForProjects(page.items.map((card) => card.id))

  return (
    <div className="pad-inline mx-auto w-full max-w-detail py-xl">
      <ProjectStyles />
      <header className="mb-xl flex flex-col gap-xs">
        <h1>Saved projects</h1>
        <p className="measure-ui text-base text-text-2">
          Yours alone: nobody is told you saved their project, and the creator's follower count is a
          different number. Newest save first.
        </p>
      </header>

      {page.items.length === 0 ? (
        <EmptyState
          title="Nothing saved yet"
          body="Save is the bookmark on a project page, beside Follow. Save keeps a project on this list; Follow asks to be told when it moves."
          primaryAction={{ label: 'Find something to save', href: '/discover' }}
          headingLevel={2}
        />
      ) : (
        <>
          <ul className="m-0 flex list-none flex-col divide-y divide-rule border-y border-rule p-0">
            {page.items.map((card) => {
              const ask = asks.get(card.id) ?? card.tagline
              return (
                <li key={card.id} className="flex flex-col gap-3 py-6">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
                    <h2 className="text-md">
                      <Link href={`/p/${card.slug}`} className="link tap-44 inline-flex items-center text-ink">
                        {card.title}
                      </Link>
                    </h2>
                    <span className="tnum text-xs text-ink-3">
                      {card.counts.feedback === 0
                        ? 'No notes yet'
                        : `${String(card.counts.feedback)} ${card.counts.feedback === 1 ? 'note' : 'notes'}`}
                      {card.feedbackState === 'closed' ? ' · feedback closed' : ''}
                    </span>
                  </div>

                  {ask ? <p className="voice measure-ui text-base text-ink-2">{ask}</p> : null}

                  <p className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-3">
                    <Link href={`/u/${card.owner.handle}`} className="link tap-44 inline-flex items-center">
                      {card.owner.displayName}
                    </Link>
                    <span>{card.typeLabel}</span>
                    <GritReading grit={card.grit} />
                  </p>
                </li>
              )
            })}
          </ul>

          {page.nextCursor ? (
            <p className="mt-lg">
              <Link
                href={`/saved?cursor=${encodeURIComponent(page.nextCursor)}`}
                className="btn btn-secondary"
              >
                Older saves
              </Link>
            </p>
          ) : null}

          {cursor ? (
            <p className="mt-md">
              <Link href="/saved" className="link tap-44 inline-flex items-center text-sm">
                Back to the newest saves
              </Link>
            </p>
          ) : null}
        </>
      )}
    </div>
  )
}
