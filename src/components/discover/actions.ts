'use server'

/**
 * Discover's mutations and its one incremental read.
 *
 * Nothing here trusts its input: the filter set arrives as a query string and is
 * re-parsed by the same pure module the page used, so a hand-edited request can
 * only ever produce a filter the rail could also have produced.
 */

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
// Authorises from `claims.uid`, so the claims must come from a session that is
// still live: a signature alone cannot tell a revoked cookie from a good one.
import { currentClaimsLive } from '@/server/queries/auth'
import type { FormState } from '@/components/ui'
import {
  asksForProjects,
  createSavedSearch,
  countSavedSearches,
  deleteSavedSearch,
  loadFeedSlice,
  savedSearchNameTaken,
} from '@/server/queries/discover'
import { parseQueryString, toQueryString } from './filters'
import { toFeedRow, type FeedRow } from './row-data'
import { toProjectFilters } from './query'

const MAX_SAVED_SEARCHES = 20

/* --------------------------------------------------------------- paging -- */

export type LoadMoreResult =
  | {
      readonly ok: true
      readonly rows: readonly FeedRow[]
      readonly nextOffset: number | null
      readonly total: number
      readonly listed: number
    }
  | { readonly ok: false; readonly message: string }

/** A feed's clock is the moment its first page rendered, so it is never far off now. */
const CLOCK_TOLERANCE_MS = 24 * 60 * 60 * 1000

export async function loadMoreRows(input: {
  queryString: string
  offset: number
  limit: number
  clock: number
}): Promise<LoadMoreResult> {
  const parsed = z
    .object({
      queryString: z.string().max(600),
      // No ceiling: the plain orderings page every matching row, however many.
      offset: z.number().int().min(0).safe(),
      limit: z.number().int().min(1).max(50),
      clock: z
        .number()
        .int()
        .refine((clock) => Math.abs(Date.now() - clock) <= CLOCK_TOLERANCE_MS),
    })
    .safeParse(input)

  if (!parsed.success) {
    return { ok: false, message: 'That request was not understood. Reload the page and try again.' }
  }

  const claims = await currentClaimsLive()
  const state = parseQueryString(parsed.data.queryString)

  try {
    // The first page's clock, so the ranked feed is composed against the same
    // instant and this offset lands where the page above left off.
    const slice = loadFeedSlice(toProjectFilters(state), {
      sort: state.sort,
      viewerId: claims?.uid ?? null,
      offset: parsed.data.offset,
      limit: parsed.data.limit,
      clock: parsed.data.clock,
    })
    const asks = asksForProjects(slice.items.map((c) => c.id))
    return {
      ok: true,
      rows: slice.items.map((card) => toFeedRow(card, asks.get(card.id), state)),
      nextOffset: slice.nextOffset,
      total: slice.total,
      listed: slice.listed,
    }
  } catch {
    return {
      ok: false,
      message: 'The next page did not load. The projects already on screen are still here; press the button again.',
    }
  }
}

/* -------------------------------------------------------- saved searches -- */

const SaveSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Give the search a name of at least two characters, so you can tell it from the others.')
    .max(48, 'Keep the name to 48 characters or fewer, so it fits the rail.'),
  queryString: z.string().max(600),
})

export async function saveSearchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) {
    return {
      status: 'error',
      message: 'Saved searches belong to an account. Sign in, then save this filter set.',
    }
  }

  const parsed = SaveSchema.safeParse({
    name: formData.get('name'),
    queryString: formData.get('queryString'),
  })
  if (!parsed.success) {
    const first = parsed.error.issues[0]
    return {
      status: 'error',
      message: 'This search was not saved.',
      fieldErrors: {
        'saved-search-name': first?.message ?? 'Give the search a name before you save it.',
      },
    }
  }

  const state = parseQueryString(parsed.data.queryString)
  const canonical = toQueryString(state)
  if (canonical.length === 0) {
    return {
      status: 'error',
      message: 'This search was not saved.',
      fieldErrors: {
        'saved-search-name': 'Pick at least one filter first. An empty search is the feed you already see.',
      },
    }
  }

  if (savedSearchNameTaken(claims.uid, parsed.data.name)) {
    return {
      status: 'error',
      message: 'This search was not saved.',
      fieldErrors: {
        'saved-search-name': 'You already have a saved search with that name. Pick another one.',
      },
    }
  }

  if (countSavedSearches(claims.uid) >= MAX_SAVED_SEARCHES) {
    return {
      status: 'error',
      message: 'This search was not saved.',
      fieldErrors: {
        'saved-search-name': `You have ${String(MAX_SAVED_SEARCHES)} saved searches, which is the limit. Remove one from the rail first.`,
      },
    }
  }

  createSavedSearch({ userId: claims.uid, name: parsed.data.name, queryString: canonical })
  revalidatePath('/discover')
  return { status: 'success', message: `Saved as “${parsed.data.name}”.` }
}

export async function deleteSavedSearchAction(formData: FormData): Promise<void> {
  const claims = await currentClaimsLive()
  if (!claims) return
  const id = formData.get('id')
  if (typeof id !== 'string' || id.length === 0) return
  deleteSavedSearch(claims.uid, id)
  revalidatePath('/discover')
}
