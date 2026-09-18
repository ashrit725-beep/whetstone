/**
 * Discover, loading.
 *
 * The chrome that is derivable from the URL alone is drawn for real; only the
 * rows are placeholders, and they are the same `<ul class="ws-feed">` at the
 * same `--row-h-feed`, with the same column template and the same four metadata
 * slots. Nothing moves when the data lands.
 *
 * Box-for-box means the whole column, not only the rows: the rail carries the
 * real group counts (five sorts, five grit cells, ten project types, ten needs,
 * one feedback state, then saved searches) with the explanatory notes that sit
 * between them, and the results column carries the search field at `Field`'s
 * full height, the sticky result line, the accelerator hint slot and the
 * "Load more" slot. The aside is the same `.ws-aside`, so above 60rem it is the
 * same one-viewport scroll region and the page is the same height in both
 * states.
 */

import { DiscoverStyles } from '@/components/discover/discover-styles'
import {
  FeedFooterSkeleton,
  FeedSkeleton,
  GritRailSkeleton,
  RailGroupSkeleton,
  ResultLineSkeleton,
  SearchFormSkeleton,
  ShortcutHintSkeleton,
} from '@/components/discover/feed-skeleton'

export default function DiscoverLoading() {
  return (
    <div className="pad-inline mx-auto w-full max-w-detail py-xl">
      <DiscoverStyles />

      <header className="mb-xl flex flex-col gap-xs">
        <h1>Projects open for feedback</h1>
        <p className="measure-ui text-base text-text-2">
          Every project here is asking for something specific. Pick the stage you are useful at,
          read the ask, and answer that.
        </p>
      </header>

      <div className="ws-shell" aria-busy="true">
        <aside className="ws-aside" tabIndex={0} aria-label="Filters, loading">
          <div className="flex flex-col gap-xl">
            <RailGroupSkeleton rows={5} note={2} />
            <GritRailSkeleton />
            <RailGroupSkeleton rows={10} />
            <RailGroupSkeleton rows={10} />
            <RailGroupSkeleton rows={1} />
            <RailGroupSkeleton rows={0} note={3} />
          </div>
        </aside>

        <section className="track-safe">
          <div className="mb-md">
            <SearchFormSkeleton />
          </div>
          <ResultLineSkeleton />
          <ShortcutHintSkeleton />
          <FeedSkeleton count={8} label="Loading projects." />
          <FeedFooterSkeleton />
        </section>
      </div>
    </div>
  )
}
