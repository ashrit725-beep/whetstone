/**
 * How it works.
 *
 * Nothing bold is spent here: this page inherits the homepage's system and its
 * job is to be read. The centre of it is the matrix, which is the product's
 * real taxonomy rather than a diagram of one: ten kinds of project against the
 * five questions every review answers, read straight out of `src/lib/taxonomy`.
 *
 *   1 what it is    py-16    one column
 *   2 the loop      py-32   a dl with visible terms
 *   3 the matrix    py-12    one table, scrolling inside its own region
 *   4 the scale     py-24    full bleed, five columns
 *   5 closing       py-16    two columns
 */

import type { Metadata } from 'next'
import NextLink from 'next/link'
import { ScaleStrip } from '@/components/marketing/scale-strip'
import { SectionLabel } from '@/components/marketing/section-label'
import styles from '@/components/marketing/paper.module.css'
import {
  AXIS_FAMILIES,
  PROJECT_TYPES,
  PROJECT_TYPE_SLUGS,
  SEVERITY_LEVELS,
  type AxisDef,
  type AxisFamily,
  type ProjectTypeSlug,
} from '@/lib/taxonomy'
import { categoryTaxonomy, scaleSteps, siteCounts } from '../_data'

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'What you post, what a reviewer is asked, how the notes come back, and what the 120 to 8000 grit scale changes about the questions.',
  alternates: { canonical: '/how-it-works' },
}

const WGHT_800 = { fontVariationSettings: '"wght" 800' } as const
const WGHT_650 = { fontVariationSettings: '"wght" 650' } as const

function axisFor(slug: ProjectTypeSlug, family: AxisFamily): AxisDef | undefined {
  return PROJECT_TYPES[slug].axes.find((axis) => axis.family === family)
}

export default function HowItWorksPage() {
  const counts = siteCounts()
  const steps = scaleSteps()
  const taxonomy = categoryTaxonomy()

  return (
    <>
      {/* ------------------------------------------------------ 1. what it is */}
      <section className="pad-inline py-16">
        <div className="mx-auto max-w-page">
          <SectionLabel>How it works</SectionLabel>
          <div className="mt-8 grid gap-8 md:grid-cols-12 md:gap-12">
            <h1 className="track-safe text-3xl text-ink md:col-span-7" style={WGHT_800}>
              The week before you show it to strangers.
            </h1>
            <p className="voice track-safe text-voice md:col-span-5">
              You post the work, say how finished it is, and write the questions you want answered.
              Reviewers answer those questions against a fixed set of axes for your kind of project,
              so the replies can be compared, counted and sorted instead of only read.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- 2. the loop */}
      <section
        aria-labelledby="loop"
        className={`border-y border-rule bg-paper-sub pad-inline py-32 ${styles.groundSub}`}
      >
        <div className="mx-auto max-w-page">
          <SectionLabel>The loop</SectionLabel>
          <h2 id="loop" className="mt-8 text-2xl text-ink" style={WGHT_800}>
            Four steps, and the last one is the point.
          </h2>

          <dl className={`${styles.terms} mt-16`}>
            <div className={styles.term}>
              <span aria-hidden="true" className={`${styles.termIndex} tnum`}>
                01
              </span>
              <dt>Post the build</dt>
              <dd>
                A link, a build, a cut or a draft, plus the grit step it is at. The step and the kind
                of project decide which questions the composer puts in front of a reviewer.
                Whetstone knows <span className="tnum text-ink">{counts.projectTypes}</span> kinds,
                each with its own five axes.
              </dd>
            </div>

            <div className={styles.term}>
              <span aria-hidden="true" className={`${styles.termIndex} tnum`}>
                02
              </span>
              <dt>Name the ask</dt>
              <dd>
                You write the questions. A reviewer reads your ask before they open the build, which
                is what keeps the reply about the part you are unsure of rather than the part that is
                easiest to comment on.
              </dd>
            </div>

            <div className={styles.term}>
              <span aria-hidden="true" className={`${styles.termIndex} tnum`}>
                03
              </span>
              <dt>Read it by theme</dt>
              <dd>
                Every note is a set of separate points, each with a category, a severity and the
                version it was written against.{' '}
                <span className="tnum text-ink">{counts.points.toLocaleString('en')}</span> points
                have been filed so far across{' '}
                <span className="tnum text-ink">{taxonomy.universal.length}</span> shared categories
                and <span className="tnum text-ink">{taxonomy.typeSpecific}</span> type-specific
                ones, which is why an inbox groups instead of piling up.
              </dd>
            </div>

            <div className={styles.term}>
              <span aria-hidden="true" className={`${styles.termIndex} tnum`}>
                04
              </span>
              <dt>Answer or ship it</dt>
              <dd>
                Turn a point into a suggestion and move it from open to planned to shipped. The
                reviewer who raised it is told when it moves.{' '}
                <span className="tnum text-ink">{counts.shipped.toLocaleString('en')}</span>{' '}
                {counts.shipped === 1 ? 'has' : 'have'} been marked shipped so far.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* ------------------------------------------------------- 3. the matrix */}
      <section aria-labelledby="matrix" className="pad-inline py-12">
        <div className="mx-auto max-w-page">
          <SectionLabel>What a reviewer is asked</SectionLabel>
          <div className="mt-8 grid gap-8 md:grid-cols-12 md:gap-12">
            <h2 id="matrix" className="track-safe text-2xl text-ink md:col-span-6" style={WGHT_800}>
              Five questions, asked in the language of the work.
            </h2>
            <p className="voice track-safe text-voice md:col-span-5 md:col-start-8">
              Every review answers the same five questions. What changes between a game and an API
              is what those questions are called and what a high mark means, which is how a rating
              stays comparable without becoming generic.
            </p>
          </div>

          <div
            className={`${styles.tableWrap} mt-16`}
            tabIndex={0}
            role="region"
            aria-label="Rating axes by kind of project, scrollable"
          >
            <table className={styles.table}>
              <caption className="sr-only">
                The five rating axes each kind of project asks about.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Kind of project</th>
                  {AXIS_FAMILIES.map((family) => (
                    <th key={family.key} scope="col">
                      {family.label}
                      <span className="sr-only">. {family.question}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PROJECT_TYPE_SLUGS.map((slug) => (
                  <tr key={slug}>
                    <th scope="row">{PROJECT_TYPES[slug].label}</th>
                    {AXIS_FAMILIES.map((family) => {
                      const axis = axisFor(slug, family.key)
                      return (
                        <td key={family.key}>
                          {axis ? (
                            <>
                              <span className="block text-ink">{axis.label}</span>
                              <span className="block text-xs text-ink-3">
                                {axis.lowLabel} to {axis.highLabel}
                              </span>
                            </>
                          ) : (
                            <span className="text-ink-3">Not asked</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 flex flex-wrap items-center gap-3 text-xs text-ink-3">
            <span className="text-2xs uppercase" style={WGHT_650}>
              Every point also carries a severity
            </span>
            {SEVERITY_LEVELS.map((level) => (
              <span key={level.key} className="chip">
                {level.label}
              </span>
            ))}
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------- 4. the scale */}
      <section aria-labelledby="scale" className="border-y border-rule bg-paper-sub py-24">
        <div className="pad-inline">
          <div className="mx-auto max-w-page">
            <SectionLabel>One scale, 120 to 8000</SectionLabel>
            <div className="mt-8 grid gap-8 md:grid-cols-12 md:gap-12">
              <h2 id="scale" className="track-safe text-2xl text-ink md:col-span-6" style={WGHT_800}>
                Grit is how finished it is, not how good.
              </h2>
              <p className="voice track-safe text-voice md:col-span-5 md:col-start-8">
                A reviewer reads the number before they open anything, so a concept gets asked
                whether the idea holds and a release candidate gets asked what would embarrass you.
                Same scale for all {counts.projectTypes} kinds of project.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-16">
          <ScaleStrip steps={steps} />
        </div>
      </section>

      {/* ---------------------------------------------------------- 5. closing */}
      <section aria-labelledby="start" className="pad-inline py-16">
        <div className="mx-auto grid max-w-page gap-8 md:grid-cols-12 md:gap-12">
          <h2 id="start" className="track-safe text-2xl text-ink md:col-span-6" style={WGHT_800}>
            Start with the ask.
          </h2>
          <div className="track-safe md:col-span-5 md:col-start-8">
            <p className="voice text-voice">
              The question you write is the part that decides what comes back. Everything else on
              this page is machinery built to protect it.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <NextLink href="/sign-up?next=%2Fnew" className="btn">
                Post a project
              </NextLink>
              <NextLink href="/for-reviewers" className="btn btn-secondary">
                Review something first
              </NextLink>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
