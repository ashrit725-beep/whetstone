/**
 * The homepage, on Paper & Ink.
 *
 * The page explains the product before it shows any data, and it shows the
 * artifact before it counts anything. That order is the argument: a stranger
 * arrives knowing nothing, so the four steps come first, then one whole review
 * so they can see what they would actually receive, then the reading no other
 * feedback product can give — every rating, not an average — and only then the
 * record of how fast and how hard this place reads work.
 *
 * Where boldness is spent, once: the honing word on “sharper”. Its letters run
 * from outline to solid across the word in the grit scale's own five
 * densities. Everything else on the page is rules, ink and real rows, and
 * nothing else moves.
 *
 *   1 hero            pt-12 pb-16    12 cols, 7 + 5
 *   2 how it works    py-16          a dl with visible terms, paper-sub
 *   3 what comes back py-24          one real review, and its parts named
 *   4 split decisions py-24          paper-sub, the unit chart
 *   5 the record      py-16          speed and severity, 6 + 6
 *   6 for reviewers   py-16          paper-sub
 *   7 closing         py-16
 *
 * Every number on the page is a count taken from the database, and the whole
 * reading arrives in one cached call, so a visitor costs one pass over the data
 * at worst and usually none.
 */

import type { Metadata } from 'next'
import type { CSSProperties } from 'react'
import NextLink from 'next/link'
import { ArrivalsChart } from '@/components/marketing/arrivals-chart'
import { CtaPair } from '@/components/marketing/cta-pair'
import { GritStrip } from '@/components/marketing/grit-strip'
import { Hone } from '@/components/marketing/hone'
import { ProofPanel } from '@/components/marketing/proof-panel'
import { ReviewSpecimen } from '@/components/marketing/review-specimen'
import { SectionLabel } from '@/components/marketing/section-label'
import { SplitFigure } from '@/components/marketing/split-figure'
import styles from '@/components/marketing/paper.module.css'
import { landingData } from './_data'

export const metadata: Metadata = {
  // Absolute, because the root template would append the brand a second time.
  title: { absolute: 'Whetstone: feedback that sharpens what you are building' },
  description:
    'Post the build, name the questions you need answered, and get structured notes back from people who used it. Sorted by category, severity and how finished the work is.',
  alternates: { canonical: '/' },
}

const WGHT_800 = { fontVariationSettings: '"wght" 800' } as const
const WGHT_700 = { fontVariationSettings: '"wght" 700' } as const
const WGHT_650 = { fontVariationSettings: '"wght" 650' } as const

/** How solid each severity is drawn, coarse to fine. The grit scale, reused. */
const SEVERITY_DENSITY: Record<string, number> = {
  blocker: 1,
  major: 0.74,
  minor: 0.48,
  nit: 0.26,
  praise: 0.1,
}

/**
 * Arms the honing word before the hero is parsed, so the finished word never
 * paints and then refills itself. It runs once per session, never under reduced
 * motion, and does nothing at all if storage throws.
 */
const HONE_BOOT = `(function(){try{if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;if(sessionStorage.getItem('ws-hone')!==null)return;sessionStorage.setItem('ws-hone','1');document.documentElement.dataset.hone=''}catch(e){}})()`

function pct(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10
}

export default async function LandingPage() {
  const { counts, typeLabels, proof, split, splitProjects, specimen, arrivals, taxonomy, bounties } =
    await landingData()

  const problems = taxonomy.universal.filter((category) => category.key !== 'delight')
  const praise = taxonomy.universal.find((category) => category.key === 'delight')
  const widestProblem = problems.reduce((most, row) => Math.max(most, row.count), 0)
  const gradedPoints = taxonomy.severities.reduce((sum, row) => sum + row.count, 0)

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: HONE_BOOT }} />

      {/* ------------------------------------------------------------ 1. hero */}
      <section className="pad-inline pt-12 pb-16 md:pt-16 md:pb-24">
        <div className="mx-auto grid max-w-page gap-16 md:grid-cols-12 md:gap-12">
          <div className="track-safe md:col-span-7">
            <h1 className={`${styles.heroTitle} text-ink`} style={WGHT_800}>
              Ship
              <br />
              <Hone word="sharper." />
            </h1>

            <p className={`voice ${styles.heroSub} mt-8 text-voice`}>
              Feedback on unfinished work from{' '}
              <span className="tnum">{counts.reviewers.toLocaleString('en')}</span> people who make
              things too. Post the build, ask the question you need answered, and get notes back
              already sorted by category, severity and version.
            </p>

            {typeLabels.length > 0 ? (
              <p className="measure-cap mt-4 text-sm text-ink-3">
                <span className="tnum">{counts.projectTypes}</span> kinds of work, each with its own
                five questions: {typeLabels.join(' · ')}.
              </p>
            ) : null}

            <div className="mt-12">
              <CtaPair large />
            </div>

            {counts.reviews > 0 ? (
              <ul className={`${styles.stats} mt-16`}>
                <li>
                  <span className="tnum block text-xl text-ink" style={WGHT_800}>
                    {counts.reviews.toLocaleString('en')}
                  </span>
                  <span className="mt-2 block text-2xs uppercase text-ink-3" style={WGHT_650}>
                    reviews written
                  </span>
                </li>
                {counts.firstReviewHours !== null ? (
                  <li>
                    <span className="tnum block text-xl text-ink" style={WGHT_800}>
                      {counts.firstReviewHours} h
                    </span>
                    <span className="mt-2 block text-2xs uppercase text-ink-3" style={WGHT_650}>
                      median wait for a first review
                    </span>
                  </li>
                ) : null}
                <li>
                  <span className="tnum block text-xl text-ink" style={WGHT_800}>
                    {counts.blockers.toLocaleString('en')}
                  </span>
                  <span className="mt-2 block text-2xs uppercase text-ink-3" style={WGHT_650}>
                    blockers caught before launch
                  </span>
                </li>
              </ul>
            ) : (
              <p className="measure-ui mt-16 text-sm text-ink-3">
                Nothing has been reviewed here yet. The first project posted sets the pace for the
                rest.
              </p>
            )}
          </div>

          <div className="track-safe md:col-span-5">
            {proof.length > 0 ? (
              <ProofPanel rows={proof} openTotal={counts.openProjects} />
            ) : (
              <div className="border border-rule-2 p-8">
                <h2 className="text-md">No project is taking feedback today</h2>
                <p className="voice mt-3 text-voice">
                  The feed fills from the first project somebody posts, and a project that names a
                  specific question gets read first.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------- 2. how it works */}
      <section
        aria-labelledby="loop-heading"
        className={`border-y border-rule bg-paper-sub pad-inline py-16 md:py-24 ${styles.groundSub}`}
      >
        <div className="mx-auto max-w-page">
          <SectionLabel>How it works</SectionLabel>

          <div className="mt-8 grid gap-8 md:grid-cols-12 md:gap-12">
            <h2
              id="loop-heading"
              className="track-safe text-xl sm:text-2xl text-ink md:col-span-6"
              style={WGHT_800}
            >
              Four steps, and the last one is the point.
            </h2>
            <p className="voice track-safe text-voice md:col-span-5 md:col-start-8">
              Every note arrives with a category, a severity and the version it was written against,
              so a pile of notes becomes a sorted list.
            </p>
          </div>

          <dl className={`${styles.terms} mt-16`}>
            <div className={styles.term}>
              <span aria-hidden="true" className={`${styles.termIndex} tnum`}>
                01
              </span>
              <dt>Post the build</dt>
              <dd>
                A link, a cut, a build or a draft, plus how finished it is. Grit, as on sandpaper:
                120 is rough, 8000 is a polish. The step and the kind of work decide which questions
                a reviewer is put in front of, so nobody sends a concept the notes a release
                candidate needs.
                <GritStrip />
              </dd>
            </div>

            <div className={styles.term}>
              <span aria-hidden="true" className={`${styles.termIndex} tnum`}>
                02
              </span>
              <dt>Name the ask</dt>
              <dd>
                You write the questions. A reviewer reads your ask before they open the build, which
                keeps the reply about the part you are unsure of rather than the part that is
                easiest to comment on.
              </dd>
            </div>

            <div className={styles.term}>
              <span aria-hidden="true" className={`${styles.termIndex} tnum`}>
                03
              </span>
              <dt>Read it by theme</dt>
              <dd>
                Each review is a set of separate points, every one carrying a category, a severity
                and the build it was written against.{' '}
                <span className="tnum text-ink">{counts.points.toLocaleString('en')}</span> points
                have been filed so far across{' '}
                <span className="tnum text-ink">{taxonomy.universal.length}</span> shared categories
                and about{' '}
                <span className="tnum text-ink">{taxonomy.typeSpecificPerType}</span> more for each
                kind of work, which is why an inbox groups instead of piling up.
              </dd>
            </div>

            <div className={styles.term}>
              <span aria-hidden="true" className={`${styles.termIndex} tnum`}>
                04
              </span>
              <dt>Answer or ship it</dt>
              <dd>
                Turn a point into a change and move it from open to planned to shipped. The reviewer
                who raised it is told when it moves.{' '}
                <span className="tnum text-ink">{counts.shipped.toLocaleString('en')}</span>{' '}
                {counts.shipped === 1
                  ? 'change built from a reviewer’s note has shipped.'
                  : 'changes built from reviewers’ notes have shipped.'}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------ 3. what comes back */}
      {specimen ? (
        <section aria-labelledby="specimen-heading" className="pad-inline py-24 md:py-32">
          <div className="mx-auto max-w-page">
            <SectionLabel>What comes back</SectionLabel>

            <div className="mt-8 grid gap-8 md:grid-cols-12 md:gap-12">
              <h2
                id="specimen-heading"
                className="track-safe text-xl sm:text-2xl text-ink md:col-span-6"
                style={WGHT_800}
              >
                One review, as it arrives.
              </h2>
              <p className="voice track-safe text-voice md:col-span-5 md:col-start-8">
                This is a real note on a real project, filed by the member who wrote it and rendered
                the way the project page renders it. The list names each part.
              </p>
            </div>

            <div className="mt-16">
              <ReviewSpecimen review={specimen} />
            </div>
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------------- 4. split decisions */}
      {split ? (
        <section
          aria-labelledby="split-heading"
          className="border-y border-rule bg-paper-sub pad-inline py-24 md:py-32"
        >
          <div className="mx-auto max-w-page">
            <SectionLabel>Split decisions</SectionLabel>

            <h2
              id="split-heading"
              className="track-safe mt-8 text-xl sm:text-2xl text-ink md:max-w-[22ch]"
              style={WGHT_800}
            >
              Every rating, not the average of them.
            </h2>
            <p className="voice measure mt-6 text-voice">
              An average of 3 hides the reviewer who gave it a 1 and the one who gave it a 5.
              Whetstone shows every rating, so you can see which part of your work splits the room.
              One square is one reviewer.
            </p>

            <SplitFigure plot={split} />

            {splitProjects > 0 ? (
              <p className="measure-cap mt-12 text-sm text-ink-3">
                <span className="tnum text-ink-2">{splitProjects.toLocaleString('en')}</span>{' '}
                projects taking feedback have an axis where the ratings run three steps or more.{' '}
                <NextLink href="/discover?open=1&sort=discussed" className="link text-ink">
                  Browse open projects
                </NextLink>
                .
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* -------------------------------------------------------- 5. the record */}
      <section aria-labelledby="record-heading" className="pad-inline py-16 md:py-24">
        <div className="mx-auto max-w-page">
          <SectionLabel>The record so far</SectionLabel>
          <h2 id="record-heading" className="sr-only">
            How fast and how hard Whetstone reads work
          </h2>

          <div className="mt-8 grid gap-16 md:grid-cols-12 md:gap-12">
            <div className="track-safe md:col-span-6">
              <h3 className="text-lg text-ink" style={WGHT_800}>
                {counts.firstReviewHours !== null ? (
                  <>
                    A first review in about{' '}
                    <span className="tnum">{counts.firstReviewHours}</span> hours.
                  </>
                ) : (
                  'Reviews filed, last four weeks.'
                )}
              </h3>
              <p className="voice mt-4 text-voice">
                {arrivals.total > 0 ? (
                  <>
                    <span className="tnum">{arrivals.total.toLocaleString('en')}</span> reviews in
                    the last four weeks,{' '}
                    <span className="tnum">{arrivals.medianDay.toLocaleString('en')}</span> on an
                    ordinary day. The open bar is today, still filling.
                  </>
                ) : (
                  'Nobody has submitted a review in the last four weeks. The first one written lands here the day it is sent.'
                )}
              </p>
              {arrivals.total > 0 ? <ArrivalsChart series={arrivals} /> : null}
            </div>

            <div className="track-safe md:col-span-6">
              <h3 className="text-lg text-ink" style={WGHT_800}>
                <span className="tnum">{counts.blockers.toLocaleString('en')}</span> blockers caught
                before anyone shipped them.
              </h3>
              <p className="voice mt-4 text-voice">
                Every point carries one of five severities, drawn here at the same five ink
                densities as the grit scale.
              </p>

              {gradedPoints > 0 ? (
                <>
                  <span aria-hidden="true" className={styles.sevBar}>
                    {taxonomy.severities.map((severity) => (
                      <i
                        key={severity.key}
                        style={{
                          '--w': `${String(pct(severity.count, gradedPoints))}%`,
                          '--d': String(SEVERITY_DENSITY[severity.key] ?? 0.1),
                        } as CSSProperties}
                      />
                    ))}
                  </span>

                  <ul className={styles.sevKey}>
                    {taxonomy.severities.map((severity) => (
                      <li key={severity.key}>
                        <span className="block text-2xs uppercase text-ink-3" style={WGHT_700}>
                          {severity.label}
                        </span>
                        <span className="tnum mt-1 block text-base text-ink" style={WGHT_700}>
                          {severity.count.toLocaleString('en')}
                        </span>
                        <span className="tnum block text-xs text-ink-3">
                          {pct(severity.count, gradedPoints)}%
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}

              <p className="mt-12 text-2xs uppercase text-ink-3" style={WGHT_700}>
                What the problems were filed as
              </p>
              <ul className={styles.cats}>
                {problems.map((category) => (
                  <li key={category.key} className={styles.catRow}>
                    <span className="track-safe text-sm text-ink">{category.label}</span>
                    <span className="tnum text-end text-sm text-ink" style={WGHT_700}>
                      {category.count.toLocaleString('en')}
                      <span className="sr-only"> points filed under {category.label}</span>
                    </span>
                    <span aria-hidden="true" className={styles.catBar}>
                      <i
                        style={{
                          '--w': `${String(widestProblem === 0 ? 0 : Math.round((category.count / widestProblem) * 100))}%`,
                        } as CSSProperties}
                      />
                    </span>
                  </li>
                ))}
              </ul>

              {praise && praise.count > 0 ? (
                <p className="measure-ui mt-8 text-sm text-ink-3">
                  One of the{' '}
                  <span className="tnum text-ink-2">{taxonomy.universal.length}</span> shared
                  categories is for things that already work:{' '}
                  <span className="tnum text-ink-2">{praise.count.toLocaleString('en')}</span> notes
                  tell a creator what not to cut in the next build.
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- 6. for reviewers */}
      <section
        aria-labelledby="reviewers-heading"
        className="border-y border-rule bg-paper-sub pad-inline py-16 md:py-24"
      >
        <div className="mx-auto grid max-w-page gap-8 md:grid-cols-12 md:gap-12">
          <h2
            id="reviewers-heading"
            className="track-safe text-xl sm:text-2xl text-ink md:col-span-6"
            style={WGHT_800}
          >
            Good reviews build a reputation, and some get paid.
          </h2>
          <div className="track-safe md:col-span-5 md:col-start-8">
            <p className="voice text-voice">
              Points a creator marks helpful raise your standing, which moves your own work up the
              feed.
              {bounties.openCount > 0 &&
              bounties.lowestOpenCents !== null &&
              bounties.highestOpenCents !== null ? (
                <>
                  {' '}
                  Listed experts take paid bounties:{' '}
                  <span className="tnum">{bounties.openCount.toLocaleString('en')}</span>{' '}
                  {bounties.openCount === 1 ? 'is' : 'are'} open now, from{' '}
                  <span className="tnum">
                    {money(bounties.lowestOpenCents, bounties.currency)}
                  </span>{' '}
                  to{' '}
                  <span className="tnum">
                    {money(bounties.highestOpenCents, bounties.currency)}
                  </span>
                  .
                </>
              ) : (
                ' Paid bounties open when a creator funds one; peer review is free and is where every review here has come from.'
              )}
            </p>
            <p className="mt-6">
              <NextLink
                href="/for-reviewers"
                className="link tap-44 inline-flex text-sm text-ink"
                style={WGHT_650}
              >
                How reviewing works
              </NextLink>
            </p>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- 7. the close */}
      <section
        aria-labelledby="close-heading"
        className={`${styles.close} pad-inline py-16 md:py-24`}
      >
        <div className="mx-auto grid max-w-page gap-8 md:grid-cols-12 md:gap-12">
          <h2
            id="close-heading"
            className="track-safe text-xl sm:text-2xl text-ink md:col-span-6"
            style={WGHT_800}
          >
            The next version is better because someone told you.
          </h2>
          <div className="track-safe md:col-span-5 md:col-start-8">
            <p className="voice text-voice">
              {counts.openProjects > 1 ? (
                <>
                  <span className="tnum">{counts.openProjects.toLocaleString('en')}</span> projects
                  are taking feedback right now.{' '}
                </>
              ) : null}
              Post the build, name the question, and read what comes back.
            </p>
            <div className="mt-8">
              <CtaPair large />
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

function money(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100)
}
