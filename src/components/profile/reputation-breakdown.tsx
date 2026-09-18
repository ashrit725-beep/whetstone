/**
 * Reputation, shown with its working.
 *
 * Expertise here is per domain by design, so the per-domain meters are the
 * headline and the single number is a footnote rather than the other way
 * round. Under them, every review this person wrote is listed with the terms
 * that produced its value, because a score nobody can audit is a score nobody
 * should trust.
 */

import {
  Meter,
  Table,
  THead,
  TBody,
  TR,
  TH,
  TD,
  TableEmpty,
} from '@/components/ui'
import { PROJECT_TYPES, REPUTATION } from '@/lib/taxonomy'
import type { ReputationComputation, ReviewValueBreakdown } from '@/lib/types'
import { ofCount, percent } from '@/components/marketplace/format'

export interface ReputationBreakdownProps {
  reputation: ReputationComputation
  reviews: readonly ReviewValueBreakdown[]
  displayName: string
}

export function ReputationBreakdown({ reputation, reviews, displayName }: ReputationBreakdownProps) {
  const { totals, domains } = reputation

  return (
    <div className="flex flex-col gap-2xl">
      <section aria-labelledby="rep-domains" className="flex flex-col gap-md">
        <h2 id="rep-domains" className="text-md">
          Credibility, by what they review
        </h2>
        <p className="measure-ui text-sm text-text-2">
          Each score is earned inside one project type and decays with a nine-month
          half-life, so a reviewer who knows games well is not thereby credible on
          hardware. The overall figure,{' '}
          <span className="tnum text-text-1">{reputation.displayScore}</span> of 1000 and in
          the {reputation.tierLabel} tier,{' '}
          {/* Past a peak the figure is the floor, not the mean, and the sentence
              says so rather than describing arithmetic the page did not do. */}
          {reputation.displayScore > reputation.score ? (
            <>
              is held up by the peak floor: the effective-count-weighted mean of the
              rows below is <span className="tnum">{reputation.score}</span>, and a record
              never shows below {percent(REPUTATION.peakFloorShare)} of its highest
              figure, <span className="tnum">{reputation.peakScore}</span>, a floor that
              itself halves every {REPUTATION.peakHalfLifeMonths} months.
            </>
          ) : domains.length === 0 ? (
            'has no scored project type to take a mean of yet.'
          ) : (
            'is the effective-count-weighted mean of the rows below.'
          )}{' '}
          Before a type’s mean value scores, its evidence
          is divided by the decayed review count plus {REPUTATION.shrinkK} rather than
          by the count alone, so a short record cannot outrank a long one.
        </p>

        {domains.length === 0 ? (
          <p className="measure-ui text-sm text-text-3">
            No domain has enough reviews behind it to score yet. Credibility starts
            at the first qualified review in a project type.
          </p>
        ) : (
          <ul className="flex flex-col gap-md">
            {domains.map((domain) => {
              // Two decimals, which is what the per-review table prints, so the
              // mean can be checked against it. The decayed count used to print
              // at one decimal, which rounded a single 0.95-weighted review up
              // to "worth 1.0 after time decay".
              const mean = domain.rawMean.toFixed(2)
              const scored = domain.meanValue.toFixed(2)
              return (
                <li key={domain.domain} className="flex flex-col gap-2xs">
                  <Meter
                    label={domain.label}
                    value={domain.score}
                    min={0}
                    max={1000}
                    valueText={`${domain.label}: ${String(domain.score)} of 1000, ${domain.tier}`}
                    tone={domain.isExpert ? 'positive' : 'accent'}
                  />
                  <p className="measure-ui text-xs text-text-3">
                    <span className="tnum">{domain.reviewCount}</span>{' '}
                    {domain.reviewCount === 1 ? 'review' : 'reviews'} written here, worth{' '}
                    <span className="tnum">{domain.effectiveReviews.toFixed(2)}</span> after
                    time decay. Mean value per review <span className="tnum">{mean}</span>
                    {scored === mean ? (
                      '.'
                    ) : (
                      <>
                        , scored as <span className="tnum">{scored}</span>.
                      </>
                    )}
                  </p>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="rep-totals" className="flex flex-col gap-md">
        <h2 id="rep-totals" className="text-md">
          What the score is made of
        </h2>
        <dl className="grid gap-md sm:grid-cols-2 lg:grid-cols-4">
          <Figure term="Reviews written" value={totals.reviews} />
          <Figure
            term="Marked helpful by a creator"
            value={totals.helpful}
            detail={ofCount(totals.helpful, totals.reviews)}
          />
          <Figure
            term="Notes a creator acted on"
            value={totals.adopted}
            detail={`${percent(totals.adoptionRate)} of reviews`}
          />
          <Figure term="Suggestions shipped from them" value={totals.shipped} />
          <Figure term="Peer upvotes" value={totals.peerVotes} />
          <Figure term="Creators reviewed for" value={totals.distinctCreators} />
          <Figure
            term="Creator concentration"
            value={Number(totals.creatorConcentration.toFixed(2))}
            detail="Lower is broader. A high figure means most reviews went to a few people."
          />
          <Figure
            term="Moderation strikes"
            value={totals.strikes}
            detail={totals.strikes === 0 ? 'None on record.' : 'Each one subtracts from every review.'}
          />
        </dl>
      </section>

      <section aria-labelledby="rep-reviews" className="flex flex-col gap-md">
        <h2 id="rep-reviews" className="text-md">
          Every review, and what it was worth
        </h2>
        <p className="measure-ui text-sm text-text-2">
          Specificity multiplies every positive term, so an unstructured note earns
          close to nothing however warmly it is received. A creator who marks
          everything helpful has their mark discounted, which is the κ column.
        </p>
        <Table
          caption={`Reviews written by ${displayName}, with the terms behind each value`}
          captionVisible={false}
        >
          <THead>
            <TR>
              <TH>Project</TH>
              <TH>Domain</TH>
              <TH numeric>Specificity</TH>
              <TH numeric>Helpful</TH>
              <TH numeric>Adoption</TH>
              <TH numeric>Peer votes</TH>
              <TH numeric>κ</TH>
              <TH numeric>Time weight</TH>
              <TH numeric>Value</TH>
            </TR>
          </THead>
          {reviews.length === 0 ? (
            <TableEmpty
              colSpan={9}
              title="No reviews on record"
              detail="Reputation here is built from reviews other people could read. There are none yet."
            />
          ) : (
            <TBody>
              {reviews.map((review) => (
                <TR key={review.feedbackId}>
                  <TD>{review.projectTitle}</TD>
                  <TD>{PROJECT_TYPES[review.domain].label}</TD>
                  <TD numeric>{review.specificity.toFixed(2)}</TD>
                  <TD numeric>{review.helpful === 1 ? 'yes' : 'no'}</TD>
                  <TD numeric>{review.adoption.toFixed(2)}</TD>
                  <TD numeric>{review.peerVotes.toFixed(2)}</TD>
                  <TD numeric>{review.kappa.toFixed(2)}</TD>
                  <TD numeric>{review.timeWeight.toFixed(2)}</TD>
                  <TD numeric>{review.value.toFixed(2)}</TD>
                </TR>
              ))}
            </TBody>
          )}
        </Table>
      </section>
    </div>
  )
}

function Figure({ term, value, detail }: { term: string; value: number; detail?: string }) {
  return (
    <div className="flex flex-col gap-3xs border-t border-border-hair pt-xs">
      <dt className="text-xs text-text-3">{term}</dt>
      <dd className="flex flex-col gap-3xs">
        <span className="tnum text-md text-text-1">{value.toLocaleString('en')}</span>
        {detail ? <span className="text-xs text-text-3">{detail}</span> : null}
      </dd>
    </div>
  )
}

export default ReputationBreakdown
