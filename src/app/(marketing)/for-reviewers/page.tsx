/**
 * For reviewers.
 *
 * The proof on this page is the board: real asks from the last fortnight,
 * ordered by how few answers they have and then by how new they are, so a
 * reader sees work they can still be first on. Money appears in one section and
 * nowhere else.
 *
 *   1 what it is     py-24    two columns
 *   2 the board      py-16    paper-sub, a register of real asks
 *   3 what counts    py-24    a dl with visible terms
 *   4 paid work      py-16    paper-sub, real rates
 *   5 closing        py-16
 */

import type { Metadata } from 'next'
import NextLink from 'next/link'
import { CtaPair } from '@/components/marketing/cta-pair'
import { GritReading } from '@/components/marketing/grit-reading'
import { InlineAsk } from '@/components/marketing/inline-ask'
import { SectionLabel } from '@/components/marketing/section-label'
import styles from '@/components/marketing/paper.module.css'
import { relativeTime } from '@/lib/utils'
import { reviewerData } from '../_data'

export const metadata: Metadata = {
  title: 'For reviewers',
  description:
    'What reviewing on Whetstone involves, what a review includes, how reputation is earned, and how paid review work is priced and settled.',
  alternates: { canonical: '/for-reviewers' },
}

const WGHT_800 = { fontVariationSettings: '"wght" 800' } as const
const WGHT_650 = { fontVariationSettings: '"wght" 650' } as const

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

/** Turnaround, in the units a person would use for it. */
function turnaround(hours: number): string {
  if (hours < 24) return `${String(hours)} hours`
  const days = Math.round(hours / 24)
  return `${String(days)} ${days === 1 ? 'day' : 'days'}`
}

/** "in the last two weeks", for whatever window the board actually needed. */
function windowPhrase(days: number): string {
  if (days <= 14) return 'the last two weeks'
  if (days <= 30) return 'the last month'
  if (days <= 90) return 'the last three months'
  return 'the whole run of the site'
}

export default async function ForReviewersPage() {
  const { counts, board, bounties, fees, experts } = await reviewerData()

  /* The worked example has to sit inside the range the next paragraph prints.
     It used to be the schedule's first entry, a $50 bounty, while every open
     bounty on the site started at $150, so two consecutive sentences used
     incompatible scales. The smallest scheduled amount at or above the real
     floor is the one that reads as the same conversation. */
  const worked =
    fees.examples.find(
      (example) =>
        bounties.lowestOpenCents === null || example.amountCents >= bounties.lowestOpenCents,
    ) ?? fees.examples.at(-1)

  return (
    <>
      {/* ------------------------------------------------------ 1. what it is */}
      <section className="pad-inline py-16 md:py-24">
        <div className="mx-auto max-w-page">
          <SectionLabel>For reviewers</SectionLabel>
          <div className="mt-8 grid gap-8 md:grid-cols-12 md:gap-12">
            <h1 className="track-safe text-2xl sm:text-3xl text-ink md:col-span-7" style={WGHT_800}>
              Review work you would have looked at anyway.
            </h1>
            <div className="track-safe md:col-span-5">
              <p className="voice text-voice">
                A Whetstone review answers the creator’s own question, rates five axes chosen for
                that kind of project, and writes each problem as a separate point with a severity
                and, where it applies, the exact moment it happened.
              </p>
              <div className="mt-8">
                <CtaPair
                  secondary={{ href: '/how-it-works', label: 'What a review includes' }}
                />
              </div>
            </div>
          </div>

          <ul className={`${styles.stats} mt-16`}>
            <li>
              <span className="tnum block text-xl text-ink" style={WGHT_800}>
                {board.unansweredTotal.toLocaleString('en')}
              </span>
              <span className="mt-2 block text-2xs uppercase text-ink-3" style={WGHT_650}>
                asks waiting for a first answer
              </span>
            </li>
            <li>
              <span className="tnum block text-xl text-ink" style={WGHT_800}>
                {bounties.openCount.toLocaleString('en')}
              </span>
              <span className="mt-2 block text-2xs uppercase text-ink-3" style={WGHT_650}>
                {bounties.openCount === 1 ? 'paid bounty open' : 'paid bounties open'}
              </span>
            </li>
            <li>
              <span className="tnum block text-xl text-ink" style={WGHT_800}>
                {counts.reviewers.toLocaleString('en')}
              </span>
              <span className="mt-2 block text-2xs uppercase text-ink-3" style={WGHT_650}>
                people have written a review here
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* -------------------------------------------------------- 2. the board */}
      <section
        aria-labelledby="board"
        className="border-y border-rule bg-paper-sub pad-inline py-16 md:py-24"
      >
        <div className="mx-auto max-w-page">
          <SectionLabel>Waiting for an answer</SectionLabel>
          <div className="mt-8 grid gap-8 md:grid-cols-12 md:gap-12">
            <h2
              id="board"
              className="track-safe text-xl sm:text-2xl text-ink md:col-span-6"
              style={WGHT_800}
            >
              Asks you can still be first on.
            </h2>
            <p className="voice track-safe text-voice md:col-span-5 md:col-start-8">
              Asks posted in {windowPhrase(board.windowDays)}, fewest answers first. One per project,
              so every row is a different piece of work.
            </p>
          </div>

          {board.rows.length > 0 ? (
            <ul
              className={`${styles.register} mt-16`}
              aria-label="Recently posted projects with the fewest answers"
            >
              {board.rows.map((ask) => (
                <li key={ask.slug} className={styles.registerItem}>
                  <div className={styles.registerHead}>
                    <p className="track-safe">
                      <NextLink href={`/p/${ask.slug}`} className="link text-md text-ink">
                        {ask.projectTitle}
                      </NextLink>
                      <span className="mt-1 block text-xs text-ink-3">
                        {ask.ownerName} · {ask.typeLabel}
                      </span>
                    </p>
                    <GritReading value={ask.grit} />
                  </div>

                  <p className="voice mt-3 text-voice italic">
                    “<InlineAsk text={ask.prompt} />”
                  </p>

                  <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-2xs uppercase text-ink-3">
                    <span className="tnum" style={WGHT_650}>
                      {ask.answers === 0
                        ? 'no answers yet'
                        : `${ask.answers.toLocaleString('en')} ${ask.answers === 1 ? 'answer' : 'answers'}`}
                    </span>
                    {/* The second key the board is sorted by, shown so the order
                        can be checked by eye rather than taken on trust. */}
                    {ask.askedAt !== null ? (
                      <span className="tnum">asked {relativeTime(ask.askedAt)}</span>
                    ) : null}
                    {ask.needs.map((need) => (
                      <span key={need} className="chip">
                        {need}
                      </span>
                    ))}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="voice mt-16 text-voice">
              Every open ask has been answered. That is rare, and it is the state this board is
              trying to reach.
            </p>
          )}
        </div>
      </section>

      {/* ------------------------------------------------------ 3. what counts */}
      <section aria-labelledby="counts" className="pad-inline py-24 md:py-32">
        <div className="mx-auto max-w-page">
          <SectionLabel>What a good review looks like</SectionLabel>
          <h2 id="counts" className="mt-8 text-xl sm:text-2xl text-ink" style={WGHT_800}>
            Specific beats long.
          </h2>

          <dl className={`${styles.terms} mt-16`}>
            <div className={styles.term}>
              <span aria-hidden="true" className={`${styles.termIndex} tnum`}>
                01
              </span>
              <dt>Answer the ask first</dt>
              <dd>
                The creator wrote a question before you arrived. Answering it is worth more than
                anything else you could say, and it is the part the composer puts at the top of your
                draft.
              </dd>
            </div>

            <div className={styles.term}>
              <span aria-hidden="true" className={`${styles.termIndex} tnum`}>
                02
              </span>
              <dt>One problem per point</dt>
              <dd>
                Each point takes a category and a severity of its own. Two problems in one paragraph
                cannot be triaged separately, which means one of them will be lost.{' '}
                <span className="tnum text-ink">{counts.points.toLocaleString('en')}</span> points
                have been filed across{' '}
                <span className="tnum text-ink">{counts.reviews.toLocaleString('en')}</span> reviews,
                which is about{' '}
                <span className="tnum text-ink">
                  {counts.reviews === 0 ? 0 : Math.round((counts.points / counts.reviews) * 10) / 10}
                </span>{' '}
                per review.
              </dd>
            </div>

            <div className={styles.term}>
              <span aria-hidden="true" className={`${styles.termIndex} tnum`}>
                03
              </span>
              <dt>Say where it happened</dt>
              <dd>
                A timecode, a route, a level or a screen. An anchor is the difference between a
                report a creator can reproduce and one they have to go looking for. Video reviews
                require one.
              </dd>
            </div>

            <div className={styles.term}>
              <span aria-hidden="true" className={`${styles.termIndex} tnum`}>
                04
              </span>
              <dt>Reputation follows</dt>
              <dd>
                Points that get marked helpful or turned into shipped changes raise your standing,
                which moves your own projects up the feed and opens the listing for paid work.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* --------------------------------------------------------- 4. paid work */}
      <section
        aria-labelledby="paid"
        className="border-y border-rule bg-paper-sub pad-inline py-16 md:py-24"
      >
        <div className="mx-auto max-w-page">
          <SectionLabel>When the work is paid</SectionLabel>
          <div className="mt-8 grid gap-8 md:grid-cols-12 md:gap-12">
            <div className="track-safe md:col-span-5">
              <h2 id="paid" className="text-xl sm:text-2xl text-ink" style={WGHT_800}>
                Bounties, when a creator opens one.
              </h2>
              <p className="voice mt-6 text-voice">
                A creator escrows an amount and names the scope. You apply, deliver a review against
                it, and the money releases when they accept.
                {worked ? (
                  <>
                    {' '}
                    Whetstone takes <span className="tnum">{fees.platformFeePercent}</span>%: on a{' '}
                    <span className="tnum">{money(worked.amountCents, bounties.currency)}</span>{' '}
                    bounty that is{' '}
                    <span className="tnum">{money(worked.feeCents, bounties.currency)}</span>,
                    leaving <span className="tnum">{money(worked.netCents, bounties.currency)}</span>
                    .
                  </>
                ) : null}
              </p>
              <p className="measure-ui mt-6 text-sm text-ink-3">
                {bounties.openCount > 0 &&
                bounties.lowestOpenCents !== null &&
                bounties.highestOpenCents !== null ? (
                  <>
                    <span className="tnum">{bounties.openCount.toLocaleString('en')}</span>{' '}
                    {bounties.openCount === 1 ? 'bounty is' : 'bounties are'} open right now, from{' '}
                    <span className="tnum">
                      {money(bounties.lowestOpenCents, bounties.currency)}
                    </span>{' '}
                    to{' '}
                    <span className="tnum">
                      {money(bounties.highestOpenCents, bounties.currency)}
                    </span>
                    . <span className="tnum">{bounties.settledCount.toLocaleString('en')}</span>{' '}
                    have been settled.
                  </>
                ) : (
                  'No bounty is open right now. Peer review is unaffected: it is free, and it is where every review here has come from so far.'
                )}
              </p>
            </div>

            <div className="track-safe md:col-span-6 md:col-start-7">
              {experts.length > 0 ? (
                <ul className={styles.register} aria-label="Listed reviewers and their minimum fee">
                  {experts.map((expert) => (
                    <li key={expert.handle} className={styles.registerItem}>
                      <div className={styles.registerHead}>
                        <p className="track-safe text-sm">
                          <NextLink
                            href={`/experts/${expert.handle}`}
                            className="link tap-44 text-ink"
                          >
                            {expert.displayName}
                          </NextLink>
                          <span className="block text-xs text-ink-3">{expert.headline}</span>
                        </p>
                        <dl className={`${styles.registerFacts} text-2xs uppercase text-ink-3`}>
                          <div>
                            <dt style={WGHT_650}>Minimum</dt>
                            <dd className="tnum m-0 text-md text-ink">
                              {expert.minBountyCents === null
                                ? 'By arrangement'
                                : money(expert.minBountyCents, expert.currency)}
                            </dd>
                          </div>
                          <div>
                            <dt style={WGHT_650}>Turnaround</dt>
                            <dd className="tnum m-0 text-sm text-ink-2">
                              {expert.turnaroundHours === null
                                ? 'Not stated'
                                : turnaround(expert.turnaroundHours)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="voice text-voice">
                  Nobody is listed for paid work yet. Peer review is free and it is where every
                  review on Whetstone has come from so far.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------- 5. closing */}
      <section aria-labelledby="begin" className="pad-inline py-16 md:py-24">
        <div className="mx-auto grid max-w-page gap-8 md:grid-cols-12 md:gap-12">
          <h2
            id="begin"
            className="track-safe text-xl sm:text-2xl text-ink md:col-span-6"
            style={WGHT_800}
          >
            Pick the ask you are qualified to answer.
          </h2>
          <div className="track-safe md:col-span-5 md:col-start-8">
            <p className="voice text-voice">
              Twenty minutes and one specific answer is worth more here than an hour of general
              impressions, and it is the thing creators come back for.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <NextLink href="/discover?open=1" className="btn">
                Browse open projects
              </NextLink>
              <NextLink href="/bounties" className="btn btn-secondary">
                See the paid bounties
              </NextLink>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
