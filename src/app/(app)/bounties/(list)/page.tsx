/**
 * The bounty list, open work by default.
 *
 * The same register grammar as the marketplace, with the amount as the straw
 * fill on the right. Work state and money state are separate chips on every
 * row, because a bounty can be funded and cancelled, or delivered and unpaid.
 *
 * Filters are URL state read in this Server Component: every chip is a link.
 * A parameter the rail could not have produced is ignored rather than echoed,
 * so a hand-edited `?min=abc` reads as the unfiltered list and not as a filter
 * nothing matches. The heading follows the state, so the closed list is not
 * titled "Open bounties".
 *
 * The container is the feed's 72rem, not the 80rem detail width. These are
 * rows, and the same rows the rest of the product scans; at 80rem the amount
 * on the right drifted a third of a screen away from the title it belongs to.
 */

import type { Metadata } from 'next'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { countBounties, getBountyFeeSchedule, listBounties } from '@/server/repos/bounties'
import { bountyAreaFacets } from '@/server/queries/marketplace'
import { BountyRow } from '@/components/marketplace/bounty-row'
import { settlementTerms } from '@/components/marketplace/bounty-state'
import { FilterGroup } from '@/components/marketplace/filter-rail'
import { EmptyState, Link } from '@/components/ui'
import { EXPERTISE_AREAS } from '@/lib/taxonomy'
import { inSentence } from '@/lib/utils'
import type { BountyStatus } from '@/lib/types'

const AMOUNT_BANDS = [
  { value: '150', label: '$150 and up' },
  { value: '250', label: '$250 and up' },
  { value: '400', label: '$400 and up' },
]

/** Every state a browsing reader can ask for. Open is the default, so it has no chip of its own. */
const STATUS_OPTIONS = [
  { value: 'in_progress', label: 'Awarded' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'closed', label: 'Closed' },
  { value: 'cancelled', label: 'Cancelled' },
] as const satisfies readonly { value: BountyStatus; label: string }[]

type ListedStatus = 'open' | (typeof STATUS_OPTIONS)[number]['value']

const HEADING: Record<ListedStatus, string> = {
  open: 'Open bounties',
  in_progress: 'Awarded bounties',
  delivered: 'Delivered bounties',
  closed: 'Closed bounties',
  cancelled: 'Cancelled bounties',
}

type SearchParams = Record<string, string | string[] | undefined>

function single(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.length > 0) return value
  if (Array.isArray(value)) return value[0] ?? null
  return null
}

/** The filters as the rail could have written them; anything else is dropped. */
function readFilters(sp: SearchParams) {
  const statusRaw = single(sp['status'])
  const status = STATUS_OPTIONS.find((option) => option.value === statusRaw)?.value ?? null
  const minRaw = single(sp['min'])
  const min = AMOUNT_BANDS.some((band) => band.value === minRaw) ? minRaw : null
  const areaRaw = single(sp['area'])
  const area = EXPERTISE_AREAS.find((a) => a.slug === areaRaw) ?? null
  return { status, min, area }
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}): Promise<Metadata> {
  const { status } = readFilters(await searchParams)
  return {
    title: HEADING[status ?? 'open'],
    description:
      'Paid review work posted by creators, with the amount, the escrow state and the brief behind each one.',
    alternates: { canonical: '/bounties' },
  }
}

export default async function BountiesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const claims = await currentClaimsLive()
  const viewerId = claims?.uid ?? null

  const { status, min, area } = readFilters(sp)
  const cursor = single(sp['cursor'])
  const listed: ListedStatus = status ?? 'open'
  const minAmountCents = min ? Number(min) * 100 : null

  const params: Record<string, string | undefined> = {
    area: area?.slug,
    min: min ?? undefined,
    status: status ?? undefined,
  }

  // The reader is part of the filter: a direct request is listed to the creator
  // who sent it and the reviewer it went to, and the count and the area chips
  // are taken over the same rows as the list.
  const filters = {
    expertiseSlug: area?.slug ?? null,
    minAmountCents,
    status: listed,
    viewerId,
  }
  const page = listBounties({ ...filters, cursor, limit: 20 })
  const total = countBounties(filters)

  // A selected area keeps its chip even when nothing in this state is in it,
  // so the rail still shows what is selected and how to step back out.
  const facets = bountyAreaFacets({ status: listed, minAmountCents, viewerId })
  const areaOptions = facets.map((facet) => ({
    value: facet.slug,
    label: facet.label,
    count: facet.count,
  }))
  if (area && !facets.some((facet) => facet.slug === area.slug)) {
    areaOptions.push({ value: area.slug, label: area.label, count: 0 })
  }

  const filtered = area !== null || min !== null || status !== null
  const stateWord = listed === 'in_progress' ? 'awarded' : listed

  return (
    <div
      className="pad-inline mx-auto flex w-full flex-col gap-xl py-xl"
      style={{ maxInlineSize: 'var(--container-feed)' }}
    >
      <header className="flex flex-col gap-sm">
        <h1 className="text-2xl">{HEADING[listed]}</h1>
        <p className="measure-ui text-sm text-text-2">
          Paid review work, posted by the creator who wants it.{' '}
          {settlementTerms(getBountyFeeSchedule().platformFeePercent)}
        </p>
        <p>
          <Link href="/bounties/new" variant="standalone">
            Post a bounty
          </Link>
        </p>
      </header>

      <nav
        aria-label="Bounty filters"
        className="flex flex-col gap-md border-y border-border-hair py-md"
      >
        <h2 className="sr-only">Filters</h2>
        <FilterGroup
          label="Area"
          param="area"
          basePath="/bounties"
          params={params}
          selected={area?.slug ?? null}
          anyLabel="Any area"
          options={areaOptions}
        />
        <FilterGroup
          label="Amount"
          param="min"
          basePath="/bounties"
          params={params}
          selected={min}
          anyLabel="Any amount"
          options={AMOUNT_BANDS}
        />
        <FilterGroup
          label="State"
          param="status"
          basePath="/bounties"
          params={params}
          selected={status}
          anyLabel="Open"
          options={STATUS_OPTIONS}
        />
      </nav>

      <p aria-live="polite" className="text-sm text-text-2">
        <span className="tnum">{total.toLocaleString('en')}</span> {stateWord}{' '}
        {total === 1 ? 'bounty' : 'bounties'}
        {area ? ` in ${inSentence(area.label)}` : ''}
        {min ? `, from $${min}` : ''}.
      </p>

      {page.items.length === 0 ? (
        <EmptyState
          variant={filtered ? 'filtered' : 'default'}
          title={filtered ? 'No bounty matches those filters' : 'No bounty is open right now'}
          body={
            min !== null
              ? 'Lowering the amount, or clearing it, brings back the smaller bounties.'
              : area !== null
                ? `No ${stateWord} bounty is in ${inSentence(area.label)} right now. Any area shows the rest.`
                : filtered
                  ? `No bounty is ${stateWord} right now. The open list is where new work appears.`
                  : 'A bounty is how a creator buys a specific piece of review work. When one is open it shows here with its amount and its brief.'
          }
          primaryAction={
            filtered
              ? { label: 'Clear the filters', href: '/bounties', primary: true }
              : { label: 'Post a bounty', href: '/bounties/new', primary: true }
          }
          secondaryAction={{ label: 'See reviewers taking paid work', href: '/experts' }}
        />
      ) : (
        <ul aria-label={HEADING[listed]}>
          {page.items.map((bounty) => (
            <BountyRow key={bounty.id} bounty={bounty} viewerId={viewerId} />
          ))}
        </ul>
      )}

      {page.hasMore && page.nextCursor ? (
        <p>
          <Link
            href={`/bounties?${new URLSearchParams({ ...clean(params), cursor: page.nextCursor }).toString()}`}
            variant="standalone"
          >
            Smaller bounties
          </Link>
        </p>
      ) : null}
    </div>
  )
}

function clean(params: Readonly<Record<string, string | undefined>>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(params)) {
    if (value) out[key] = value
  }
  return out
}
