'use client'

/**
 * Below 60rem the filter rail lives in a left drawer, which is a native
 * <dialog>. Above it, the drawer is not rendered and the rail is persistent.
 *
 * Keyboard contract: the trigger is a real button; Enter or Space opens the
 * sheet. Escape closes it and focus returns to the trigger. Choosing any filter
 * navigates, so the sheet closes itself first rather than leaving a stale panel
 * over the new results.
 */

import { useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { Button, Drawer } from '@/components/ui'
import type { FacetCounts } from '@/lib/types'
import { FilterRail } from './filter-rail'
import type { SavedSearchItem } from './saved-searches'
import type { DiscoverState } from './filters'

export interface FilterDrawerProps {
  state: DiscoverState
  facets: FacetCounts
  savedSearches: readonly SavedSearchItem[]
  signedIn: boolean
  /** How many filters are narrowing the feed right now. */
  activeCount: number
}

export function FilterDrawer({
  state,
  facets,
  savedSearches,
  signedIn,
  activeCount,
}: FilterDrawerProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        iconLeading={<SlidersHorizontal size={20} strokeWidth={1.5} />}
      >
        Filters and sort
        {activeCount > 0 ? (
          <>
            {' '}
            <span className="tnum">{activeCount.toLocaleString('en')}</span>
            <span className="sr-only"> applied</span>
          </>
        ) : null}
      </Button>

      <Drawer
        open={open}
        onOpenChange={setOpen}
        side="left"
        size="lg"
        title="Filters and sort"
        description="Every choice here is written into the page address, so the view can be shared and Back returns to the previous one."
      >
        <FilterRail
          state={state}
          facets={facets}
          savedSearches={savedSearches}
          signedIn={signedIn}
          idPrefix="drawer"
          onNavigate={() => setOpen(false)}
        />
      </Drawer>
    </>
  )
}

export default FilterDrawer
