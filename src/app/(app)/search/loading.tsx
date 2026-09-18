/**
 * Search, loading. The heading and the field are drawn for real; only the
 * result registers are placeholders, at the row geometry they will become.
 *
 * The scope selector, the result sentence and the first register heading are
 * placeholders at their real heights too, so the first row lands where it will
 * sit rather than 120px above it.
 */

import { DiscoverStyles } from '@/components/discover/discover-styles'
import { FeedSkeleton, SearchFormSkeleton } from '@/components/discover/feed-skeleton'
import { Skeleton } from '@/components/ui'

const SCOPES = ['5.5rem', '5rem', '6.5rem', '5.5rem'] as const

export default function SearchLoading() {
  return (
    <div className="pad-inline mx-auto w-full max-w-detail py-xl">
      <DiscoverStyles />

      <header className="mb-lg flex flex-col gap-xs">
        <h1>Search</h1>
        <p className="measure-ui text-base text-text-2">
          Projects, discussions and the people who review them. Press the slash key to come back to
          the field.
        </p>
      </header>

      <div className="mb-md">
        <SearchFormSkeleton />
      </div>

      <div className="mb-md" aria-hidden="true">
        <ul className="ws-active-filters">
          {SCOPES.map((w, i) => (
            <li key={i}>
              <Skeleton w={w} h="2.75rem" radius="xs" />
            </li>
          ))}
        </ul>
      </div>

      <p className="measure-ui mt-sm text-sm" aria-hidden="true">
        <Skeleton w="11rem" h="1lh" />
      </p>

      <div className="mt-lg flex flex-col gap-xl" aria-busy="true">
        <section>
          <div className="mb-sm" aria-hidden="true">
            <Skeleton w="6rem" h="1.75rem" />
          </div>
          <FeedSkeleton count={6} label="Running the search." />
        </section>
      </div>
    </div>
  )
}
