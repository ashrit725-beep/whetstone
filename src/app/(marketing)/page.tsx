/**
 * The homepage, on Paper & Ink.
 *
 * Composition: eyebrow, a tight headline, a narrow supporting line, two ranked
 * actions, one line of real proof. The hero visual is structural rather than
 * decorative: it is the live feed, rendered.
 *
 * Where boldness is spent, once: the honing word on “sharper”. Its letters run
 * from outline to solid across the word, which is the grit scale drawn as type.
 * Everything else on the page is rules, ink and real rows, and nothing else
 * moves.
 *
 * The section order is an argument, not a list. The disagreement index sits
 * second because it is the thing no other feedback product can show: reviewers
 * ranked by how far apart they landed, not by score.
 *
 *   1 hero              pt-16  pb-32   12 cols, 7 + 5
 *   2 disagreement      py-24            paper-sub, ruled top and bottom
 *   3 what arrived      py-16            5 + 6, a four-week bar chart
 *   4 the scale         py-12            full bleed, 5 cols
 *   5 how it works      py-32           a dl with visible terms
 *   6 the taxonomy      py-16            paper-sub
 *   7 closing           py-24            paper-deep
 *
 * No section is a row of cards, and every number on the page is a count taken
 * at render time.
 */

import type { Metadata } from 'next'
import NextLink from 'next/link'
import { ArrivalsChart } from '@/components/marketing/arrivals-chart'
import { SpreadFigure, SpreadIndex } from '@/components/marketing/disagreement'
import { Hone } from '@/components/marketing/hone'
import { ProofPanel } from '@/components/marketing/proof-panel'
import { ScaleStrip } from '@/components/marketing/scale-strip'
import { SectionLabel } from '@/components/marketing/section-label'
import styles from '@/components/marketing/paper.module.css'
import {
  arrivalSeries,
  categoryTaxonomy,
  proofRows,
  scaleSteps,
  siteCounts,
  spreadPlot,
  spreadRanking,
} from './_data'

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

export default function LandingPage() {
  const counts = siteCounts()
  const rows = proofRows(3)
  const ranking = spreadRanking(5)
  const leader = ranking[0]
  // The section is about disagreement. If the widest split anywhere is none at
  // all, its heading would be false, so it is left out rather than hedged.
  const plot = leader && leader.spread > 0 ? spreadPlot(leader) : null
  const steps = scaleSteps()
  const taxonomy = categoryTaxonomy()
  const arrivals = arrivalSeries(28)

  const topCategory = taxonomy.universal[0]
  const widest = taxonomy.universal.reduce((most, row) => Math.max(most, row.count), 0)

  return (
    <>
      {/* ------------------------------------------------------------ 1. hero */}
      <section className="pad-inline pt-16 pb-32">
        <div className="mx-auto grid max-w-page gap-16 md:grid-cols-12 md:gap-12">
          <div className="track-safe md:col-span-7">
            {counts.openProjects > 0 ? (
              <p className={styles.eyebrowRule}>
                <span className="tnum">{counts.openProjects.toLocaleString('en')}</span> projects
                taking feedback right now
              </p>
            ) : (
              <p className={styles.eyebrowRule}>Whetstone is open for its first project</p>
            )}

            <h1 className="mt-6 text-hero text-ink" style={WGHT_800}>
              Ship
              <br />
              <Hone word="sharper." />
            </h1>

            <p className={`voice ${styles.heroSub} mt-6 text-voice`}>
              Post the build. Name the questions you need answered. Get notes back carrying a
              category, a severity and the version they were written against.
            </p>

            <div className="mt-12 flex flex-wrap items-center gap-4">
              <NextLink href="/sign-up?next=%2Fnew" className="btn">
                Post a project
              </NextLink>
              <NextLink href="/discover?open=1" className="btn btn-secondary">
                Read the open asks
              </NextLink>
            </div>

            {counts.reviews > 0 ? (
              <ul className={`${styles.stats} mt-16`}>
                <li>
                  <span className="tnum block text-xl text-ink" style={WGHT_800}>
                    {counts.openProjects.toLocaleString('en')}
                  </span>
                  <span className="mt-2 block text-2xs uppercase text-ink-3" style={WGHT_650}>
                    projects taking feedback
                  </span>
                </li>
                <li>
                  <span className="tnum block text-xl text-ink" style={WGHT_800}>
                    {counts.reviews.toLocaleString('en')}
                  </span>
                  <span className="mt-2 block text-2xs uppercase text-ink-3" style={WGHT_650}>
                    reviews written by{' '}
                    <span className="tnum">{counts.reviewers.toLocaleString('en')}</span> people
                  </span>
                </li>
                <li>
                  <span className="tnum block text-xl text-ink" style={WGHT_800}>
                    {counts.points.toLocaleString('en')}
                  </span>
                  <span className="mt-2 block text-2xs uppercase text-ink-3" style={WGHT_650}>
                    separate points raised inside them
                  </span>
                </li>
                <li>
                  <span className="tnum block text-xl text-ink" style={WGHT_800}>
                    {counts.shipped.toLocaleString('en')}
                  </span>
                  <span className="mt-2 block text-2xs uppercase text-ink-3" style={WGHT_650}>
                    changes shipped from reviews
                  </span>
                </li>
              </ul>
            ) : (
              <p className="mt-16 text-sm text-ink-3">
                Nothing has been reviewed here yet. The first project posted sets the pace for the
                rest.
              </p>
            )}
          </div>

          <div className="track-safe md:col-span-5">
            {rows.length > 0 ? (
              <ProofPanel rows={rows} openTotal={counts.openProjects} />
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

      {/* -------------------------------------------------- 2. disagreement */}
      {leader && plot ? (
        <section
          aria-labelledby="spread-heading"
          className="border-y border-rule bg-paper-sub pad-inline py-24"
        >
          <div className="mx-auto max-w-page">
            <SectionLabel>Taking feedback this week</SectionLabel>

            <div className="mt-8 grid gap-8 md:grid-cols-12 md:gap-12">
              <h2
                id="spread-heading"
                className="track-safe text-2xl text-ink md:col-span-6"
                style={WGHT_800}
              >
                Where reviewers do not agree yet.
              </h2>
              <p className="voice track-safe text-voice md:col-span-5 md:col-start-8">
                Sorted by spread, not by score. A project where{' '}
                <span className="tnum">{leader.raters}</span> people landed{' '}
                <span className="tnum">{leader.spread}</span> steps apart is the one worth twenty
                minutes of your evening.
              </p>
            </div>

            <SpreadFigure plot={plot} />

            <div className="mt-32">
              <SectionLabel>Ranked by spread</SectionLabel>
              <div className="mt-6">
                <SpreadIndex rows={ranking} />
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* --------------------------------------------------- 3. what arrived */}
      <section aria-labelledby="arrivals-heading" className="pad-inline py-16">
        <div className="mx-auto grid max-w-page gap-8 md:grid-cols-12 md:gap-12">
          <div className="track-safe md:col-span-5">
            <SectionLabel>Reviews filed, last four weeks</SectionLabel>
            <h2 id="arrivals-heading" className="mt-8 text-2xl text-ink" style={WGHT_800}>
              {arrivals.total > 0 ? (
                <>
                  <span className="tnum">{arrivals.total.toLocaleString('en')}</span>{' '}
                  {arrivals.total === 1 ? 'review' : 'reviews'} in four weeks.
                </>
              ) : (
                'A quiet four weeks.'
              )}
            </h2>
            <p className="voice mt-6 text-voice">
              {arrivals.total > 0
                ? 'Each bar is a day, and the last is today. It is drawn open because the day is still filling, not because it has been quiet.'
                : 'Nobody has submitted a review in the last four weeks. The first one written lands here the day it is sent.'}
            </p>
          </div>
          {arrivals.total > 0 ? (
            <div className="track-safe md:col-span-6 md:col-start-7">
              <ArrivalsChart series={arrivals} />
            </div>
          ) : null}
        </div>
      </section>

      {/* ---------------------------------------------------- 4. the scale */}
      <section aria-labelledby="scale-heading" className="py-12">
        <div className="pad-inline">
          <div className="mx-auto max-w-page">
            <SectionLabel>One scale, 120 to 8000</SectionLabel>
            <div className="mt-8 grid gap-8 md:grid-cols-12 md:gap-12">
              <h2
                id="scale-heading"
                className="track-safe text-2xl text-ink md:col-span-6"
                style={WGHT_800}
              >
                How finished it is, before anyone reviews it.
              </h2>
              <p className="voice track-safe text-voice md:col-span-5 md:col-start-8">
                The number a creator sets decides which questions a reviewer is asked, so nobody
                sends a concept the notes a release candidate needs. It is one scale, and it reads
                as ink: faint at the start, solid when it ships.
              </p>
            </div>
          </div>
        </div>

        {/* Full bleed: the strip carries its own inline padding on the first
            and last step, so the five steps span the page edge to edge. */}
        <div className="mt-16">
          <ScaleStrip steps={steps} />
        </div>
      </section>

      {/* ----------------------------------------------- 5. how it works, dl */}
      <section aria-labelledby="loop-heading" className="pad-inline py-32">
        <div className="mx-auto max-w-page">
          <SectionLabel>How it works</SectionLabel>

          <div className="mt-8 grid gap-8 md:grid-cols-12 md:gap-12">
            <h2
              id="loop-heading"
              className="track-safe text-2xl text-ink md:col-span-6"
              style={WGHT_800}
            >
              Three moves, then the note ships.
            </h2>
            <p className="voice track-safe text-voice md:col-span-5 md:col-start-8">
              Nothing here is a star rating. Every note carries a category, a severity and the
              version it was written against, which is what lets a creator sort them instead of
              read them.
            </p>
          </div>

          <dl className={`${styles.terms} mt-16`}>
            <div className={styles.term}>
              <span aria-hidden="true" className={`${styles.termIndex} tnum`}>
                01
              </span>
              <dt>Post the build</dt>
              <dd>
                A link, a cut, a build or a draft, plus the grit step it is at. Whetstone knows{' '}
                <span className="tnum text-ink">{counts.projectTypes}</span> kinds of project, and
                each one asks its reviewers about five axes chosen for that kind of work.
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
              <dt>Ship it, then say so</dt>
              <dd>
                Turn a note into a change and move it from open to shipped. The reviewer who raised
                it is told when it moves.{' '}
                <span className="tnum text-ink">{counts.shipped.toLocaleString('en')}</span>{' '}
                {counts.shipped === 1
                  ? 'suggestion built from reviewers’ notes has shipped.'
                  : 'suggestions built from reviewers’ notes have shipped.'}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* -------------------------------------------------- 6. the taxonomy */}
      <section
        aria-labelledby="cats-heading"
        className="border-y border-rule bg-paper-sub pad-inline py-16"
      >
        <div className="mx-auto max-w-page">
          <SectionLabel>What a note is filed as</SectionLabel>

          <div className="mt-8 grid gap-8 md:grid-cols-12 md:gap-12">
            <h2
              id="cats-heading"
              className="track-safe text-2xl text-ink md:col-span-6"
              style={WGHT_800}
            >
              <span className="tnum">{counts.points.toLocaleString('en')}</span> points, filed on
              arrival.
            </h2>
            <p className="voice track-safe text-voice md:col-span-5 md:col-start-8">
              Nine categories every kind of project carries, plus{' '}
              <span className="tnum">{taxonomy.typeSpecific}</span> more that belong to one kind of
              work alone. A note written against v3 stays attached to v3 after you ship v4.
            </p>
          </div>

          <ul className={`${styles.cats} mt-16`}>
            {taxonomy.universal.map((category) => (
              <li key={category.key} className={styles.catRow}>
                <span className="track-safe">
                  <span className="block text-base text-ink" style={WGHT_650}>
                    {category.label}
                  </span>
                  <span className="block text-xs text-ink-3">{category.description}</span>
                </span>
                <span aria-hidden="true" className={styles.catBar}>
                  <i
                    style={{
                      inlineSize: `${String(widest === 0 ? 0 : Math.round((category.count / widest) * 100))}%`,
                    }}
                  />
                </span>
                <span className="tnum text-end text-base text-ink" style={WGHT_700}>
                  {category.count.toLocaleString('en')}
                  <span className="sr-only"> points filed under {category.label}</span>
                </span>
              </li>
            ))}
          </ul>

          {topCategory ? (
            <p className="mt-8 text-sm text-ink-3">
              Every point also carries a severity. The largest category on Whetstone right now is{' '}
              <span className="text-ink-2">{topCategory.label.toLowerCase()}</span>, with{' '}
              <span className="tnum text-ink-2">{topCategory.count.toLocaleString('en')}</span>{' '}
              points filed under it.
            </p>
          ) : null}
        </div>
      </section>

      {/* ----------------------------------------------------- 7. the close */}
      <section aria-labelledby="close-heading" className="bg-paper-deep pad-inline py-24">
        <div className="mx-auto grid max-w-page gap-8 md:grid-cols-12 md:gap-12">
          <h2
            id="close-heading"
            className="track-safe text-2xl text-ink md:col-span-6"
            style={WGHT_800}
          >
            The next version is better because someone told you.
          </h2>
          <div className="track-safe md:col-span-5 md:col-start-8">
            <p className="voice text-voice">
              {counts.openProjects > 1 && counts.reviews > 1 ? (
                <>
                  <span className="tnum">{counts.openProjects.toLocaleString('en')}</span> projects
                  are taking feedback right now, and{' '}
                  <span className="tnum">{counts.reviews.toLocaleString('en')}</span> reviews have
                  already been written.{' '}
                </>
              ) : null}
              Post the build, name the question, and read what comes back.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <NextLink href="/sign-up?next=%2Fnew" className="btn">
                Post a project
              </NextLink>
              <NextLink href="/discover?open=1" className="btn btn-secondary">
                Read the open asks
              </NextLink>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
