/**
 * The reviewer marketplace, surface 7.
 *
 * Bold element: straw as a fill. This is the only surface in Whetstone where
 * straw fills anything. In this list it fills one object, the amount, so the
 * column of prices is the one warm thing on the page and a creator can read it
 * at a glance; the straw-filled action lives on a reviewer's own page, where
 * there is exactly one of it.
 *
 * Grammar: a two-column list, like a rate card. Identity and depth on the left
 * in a `<dl>`, price on the right. No tier cards, no "most popular" ribbon, no
 * package ladder. The prices are the ones the reviewers set.
 *
 * With `?project=<slug>` the list becomes a ranked match for that project and
 * prints the terms behind the rank, so "good match" is an argument rather than
 * an assertion.
 *
 * Every count on the page is counted with the filters the list uses: the
 * result line is the whole match, not the first page of it, and each area chip
 * says how many reviewers it opens under the price and turnaround already set.
 * A parameter the rail could not have produced is ignored rather than echoed.
 */

import type { Metadata } from 'next'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { countExperts, getExpertByHandle, listExperts } from '@/server/repos/profiles'
import { reviewerDepth } from '@/server/queries/profile'
import {
  expertFacets,
  matchTargetBySlug,
  rankReviewersForProject,
} from '@/server/queries/marketplace'
import { ExpertRow } from '@/components/marketplace/expert-row'
import { FilterGroup } from '@/components/marketplace/filter-rail'
import { EmptyState, GritChip, Link } from '@/components/ui'
import { EXPERTISE_AREAS } from '@/lib/taxonomy'
import { inSentence } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Reviewers taking paid work',
  description:
    'Reviewers who take paid work, with the grit steps they review at, what has been verified about them, and their own prices.',
  alternates: { canonical: '/experts' },
}

const BUDGET_BANDS = [
  { value: '150', label: 'Up to $150' },
  { value: '250', label: 'Up to $250' },
  { value: '400', label: 'Up to $400' },
]

const TURNAROUND_BANDS = [
  { value: '48', label: 'Within 2 days' },
  { value: '72', label: 'Within 3 days' },
  { value: '120', label: 'Within 5 days' },
]

function single(value: string | string[] | undefined): string | null {
  if (typeof value === 'string' && value.length > 0) return value
  if (Array.isArray(value)) return value[0] ?? null
  return null
}

export default async function ExpertsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const claims = await currentClaimsLive()
  const viewerId = claims?.uid ?? null

  const areaRaw = single(sp['area'])
  const area = EXPERTISE_AREAS.find((a) => a.slug === areaRaw) ?? null
  const budgetRaw = single(sp['budget'])
  const budget = BUDGET_BANDS.some((band) => band.value === budgetRaw) ? budgetRaw : null
  const turnaroundRaw = single(sp['turnaround'])
  const turnaround = TURNAROUND_BANDS.some((band) => band.value === turnaroundRaw)
    ? turnaroundRaw
    : null
  const projectSlug = single(sp['project'])
  const cursor = single(sp['cursor'])

  const params: Record<string, string | undefined> = {
    area: area?.slug,
    budget: budget ?? undefined,
    turnaround: turnaround ?? undefined,
    project: projectSlug ?? undefined,
  }

  const target = projectSlug ? matchTargetBySlug(projectSlug) : undefined

  if (target) {
    const matches = rankReviewersForProject(target, { limit: 6 })
    return (
      <div
        className="pad-inline mx-auto flex w-full flex-col gap-xl py-xl"
        style={{ maxInlineSize: 'var(--container-feed)' }}
      >
        <header className="flex flex-col gap-sm">
          <h1 className="text-2xl break-words">Good matches for {target.title}</h1>
          <p className="measure-ui flex flex-wrap items-center gap-xs text-sm text-text-2">
            <span>
              {target.typeLabel} at {inSentence(target.stageLabel)}
            </span>
            <GritChip value={target.grit} size="sm" />
          </p>
          <p className="measure-ui text-sm text-text-2">
            Ranked on three things that are all countable: expertise this project type
            is actually about, credibility earned reviewing that type here, and how
            often a creator marked their reviews helpful. Each row prints its own
            reasons.
          </p>
          <p>
            <Link href="/experts" variant="standalone">
              See every reviewer instead
            </Link>
          </p>
        </header>

        {matches.length === 0 ? (
          <EmptyState
            variant="filtered"
            title={`No listed reviewer works on ${inSentence(target.typeLabel)} yet`}
            body="Matching needs at least one declared area in common with the project, and nobody listed has one. A bounty reaches reviewers who are not listed at a fixed rate."
            primaryAction={{ label: 'Post a bounty instead', href: '/bounties/new', primary: true }}
            secondaryAction={{ label: 'See every reviewer', href: '/experts' }}
          />
        ) : (
          <ul aria-label={`Reviewers matched to ${target.title}`}>
            {matches.map((match) => {
              const expert = getExpertByHandle(match.user.handle)
              if (!expert) return null
              return (
                <ExpertRow
                  key={match.user.id}
                  expert={expert}
                  depth={reviewerDepth(match.user.id)}
                  requestFor={target.slug}
                  match={{
                    areas: match.matchedAreas,
                    reviewsInType: match.reviewsInType,
                    typeLabel: target.typeLabel,
                    helpful: match.helpful,
                  }}
                />
              )
            })}
          </ul>
        )}
      </div>
    )
  }

  const narrowing = {
    maxBudgetCents: budget ? Number(budget) * 100 : null,
    maxTurnaroundHours: turnaround ? Number(turnaround) : null,
  }
  const filters = { ...narrowing, expertiseSlug: area?.slug ?? null }
  const page = listExperts(filters, { limit: 12, cursor })
  const total = countExperts(filters)

  // A selected area keeps its chip even when nobody under the other filters is
  // verified in it, so the rail still shows what is selected.
  const facets = expertFacets(narrowing)
  const areaOptions = facets.map((facet) => ({
    value: facet.slug,
    label: facet.label,
    count: facet.count,
  }))
  if (area && !facets.some((facet) => facet.slug === area.slug)) {
    areaOptions.push({ value: area.slug, label: area.label, count: 0 })
  }
  const areaLabel = area?.label ?? null

  return (
    <div
      className="pad-inline mx-auto flex w-full flex-col gap-xl py-xl"
      style={{ maxInlineSize: 'var(--container-feed)' }}
    >
      <header className="flex flex-col gap-sm">
        <h1 className="text-2xl">Reviewers taking paid work</h1>
        <p className="measure-ui text-sm text-text-2">
          Every price here is the reviewer’s own and every figure beside it is counted
          from reviews they wrote on Whetstone. Listing requires at least one verified
          area, and the badge says which one.
        </p>
        {viewerId ? (
          <p>
            <Link href="/bounties/new" variant="standalone">
              Post a bounty instead
            </Link>
          </p>
        ) : null}
      </header>

      <nav aria-label="Reviewer filters" className="flex flex-col gap-md border-y border-border-hair py-md">
        <h2 className="sr-only">Filters</h2>
        <FilterGroup
          label="Area"
          param="area"
          basePath="/experts"
          params={params}
          selected={area?.slug ?? null}
          anyLabel="Any area"
          options={areaOptions}
        />
        <FilterGroup
          label="Minimum they take"
          param="budget"
          basePath="/experts"
          params={params}
          selected={budget}
          anyLabel="Any amount"
          options={BUDGET_BANDS}
        />
        <FilterGroup
          label="Turnaround"
          param="turnaround"
          basePath="/experts"
          params={params}
          selected={turnaround}
          anyLabel="Any turnaround"
          options={TURNAROUND_BANDS}
        />
      </nav>

      <p aria-live="polite" className="text-sm text-text-2">
        <span className="tnum">{total.toLocaleString('en')}</span>{' '}
        {total === 1 ? 'reviewer' : 'reviewers'}
        {areaLabel ? ` verified in ${inSentence(areaLabel)}` : ''}
        {budget ? `, taking work at $${budget} or less` : ''}
        {turnaround
          ? `, turning it round ${TURNAROUND_BANDS.find((band) => band.value === turnaround)?.label.toLowerCase() ?? ''}`
          : ''}
        .
      </p>

      {page.items.length === 0 ? (
        <EmptyState
          variant="filtered"
          title="No reviewer matches those filters"
          body={
            areaLabel && (budget || turnaround)
              ? `Nobody verified in ${inSentence(areaLabel)} meets the price and turnaround you set. Dropping the area filter shows everyone who is listed.`
              : areaLabel
                ? `Nobody listed is verified in ${inSentence(areaLabel)} yet. A bounty tagged with it is seen by every reviewer who reads the bounty list.`
                : 'Nobody listed meets the price and turnaround you set. Widening either one brings the list back.'
          }
          primaryAction={{ label: 'Clear the filters', href: '/experts', primary: true }}
          secondaryAction={{ label: 'Post a bounty instead', href: '/bounties/new' }}
        />
      ) : (
        <ul aria-label="Reviewers taking paid work">
          {page.items.map((expert) => (
            <ExpertRow
              key={expert.user.id}
              expert={expert}
              depth={reviewerDepth(expert.user.id)}
            />
          ))}
        </ul>
      )}

      {page.hasMore && page.nextCursor ? (
        <p>
          <Link
            href={`/experts?${new URLSearchParams({ ...clean(params), cursor: page.nextCursor }).toString()}`}
            variant="standalone"
          >
            More reviewers
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
