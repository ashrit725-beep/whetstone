/**
 * The prose and evidence sections of a project page, in the order the argument
 * runs: the ask, then what the creator said about the build, then what they
 * still need, then the close-the-loop ledger, then the scale the whole product
 * is measured on.
 *
 * Every one of them is the same shape: a ruled label in a narrow left column
 * and the content in a wide right one, so the page has a spine and the eye
 * always knows where a section starts. Server-safe throughout.
 */

import Link from 'next/link'
import { Check, ExternalLink } from 'lucide-react'
import { safeHref } from '@/lib/utils'
import { NEED_KINDS } from '@/lib/taxonomy'
import type { ProjectAskView, ProjectDetail } from '@/lib/types'
import type { LoopLedger } from '@/server/queries/project-surface'
import { GRIT_SCALE } from './grit-values'
import { INK_DENSITY, gritIndex, plural } from './paper'

/* ------------------------------------------------------------------ layout */

/** The spine: a ruled label on the left, the content on the right. */
export function Spine({
  label,
  note,
  labelId,
  children,
}: {
  label: string
  note?: string
  labelId?: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-x-16 gap-y-4 lg:grid-cols-[180px_1fr]">
      <div>
        <span id={labelId} className="eyebrow text-ink-3">
          {label}
        </span>
        {note ? <p className="mt-3 max-w-[22ch] text-xs text-ink-3">{note}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

/* --------------------------------------------------------------- the ask */

/**
 * The subject of the page. One question, in the human face, at the top of the
 * reading order, with the mark on its leading edge: the only element in this
 * viewport wearing the mark, because the mark means “this is the ask”.
 *
 * Only the first ask is printed here. The others are printed once, in the
 * checklist below with whether anyone has answered them; listing them here as
 * well put every ask on the page twice.
 */
export function TheAsk({ project }: { project: ProjectDetail }) {
  const ask = project.asks[0] ?? null
  if (!ask) {
    return (
      <section aria-labelledby="ask-heading">
        <Spine label="The ask" labelId="ask-heading">
          <p className="voice text-md text-ink-3">
            The creator has not written an ask for this build yet, so a reviewer is choosing what to
            look at. Say what you looked at first, and why.
          </p>
        </Spine>
      </section>
    )
  }

  return (
    <section id="the-ask" aria-labelledby="ask-heading" className="scroll-mt-24">
      <Spine
        label="The ask"
        labelId="ask-heading"
        note="What the creator wants answered, written before anyone opened the file."
      >
        <div className="marked bg-paper-hi py-8 pl-6 pr-6">
          <p className="voice text-md lg:text-lg">{ask.prompt}</p>
          {ask.detailMd ? <p className="voice mt-6 text-base text-ink-3">{ask.detailMd}</p> : null}
        </div>
      </Spine>
    </section>
  )
}

/* ------------------------------------------------------------- about it */

export function AboutBuild({ project }: { project: ProjectDetail }) {
  if (!project.summaryMd) return null
  return (
    <section aria-labelledby="about-heading">
      <Spine label="About this build" labelId="about-heading">
        <p className="voice">{project.summaryMd}</p>
      </Spine>
    </section>
  )
}

/* ------------------------------------------- what they need help with */

/**
 * The checklist. Adopted from the owner's reference and rewritten in our own
 * language: it shows which of the creator's asks have been answered and which
 * are still open, so a reader can see where their evening would actually help.
 *
 * The state is never colour alone. Answered carries a filled box AND the word;
 * open carries an empty box AND the word.
 *
 * `printedAskId` is the ask `TheAsk` already set at the top of the page. Its
 * row prints the same question as the others and links up to the copy above
 * rather than standing in for it, so the two rows read as one kind of object.
 */
export function HelpChecklist({
  project,
  printedAskId = null,
  headingId = 'help-heading',
}: {
  project: ProjectDetail
  printedAskId?: string | null
  headingId?: string
}) {
  const asks = project.asks
  const needs = project.needs
  if (asks.length === 0 && needs.length === 0) return null

  const open = asks.filter((a) => a.answerCount === 0).length

  return (
    <section aria-labelledby={headingId}>
      <Spine
        label="What would help"
        labelId={headingId}
        note={
          asks.length === 0
            ? undefined
            : open === 0
              ? 'Every ask has at least one answer against it.'
              : `${String(open)} of ${String(asks.length)} still ${plural(open, 'has', 'have')} nobody on it.`
        }
      >
        {asks.length > 0 ? (
          <ul className="ws-rule-list m-0 flex list-none flex-col border-t border-rule p-0">
            {asks.map((ask) => (
              <AskRow key={ask.id} ask={ask} printed={ask.id === printedAskId} />
            ))}
          </ul>
        ) : null}

        {needs.length > 0 ? (
          <div className={asks.length > 0 ? 'mt-8' : ''}>
            <span className="eyebrow text-ink-3">The kind of eyes wanted</span>
            <dl className="m-0 mt-3 flex flex-col gap-3">
              {needs.map((need) => (
                <div key={need.key} className="flex flex-col gap-1 sm:flex-row sm:gap-6">
                  <dt className="text-sm font-bold text-ink sm:w-44 sm:shrink-0">{need.label}</dt>
                  <dd className="m-0 max-w-[62ch] text-sm text-ink-3">
                    {need.detail && need.detail.trim().length > 0
                      ? need.detail
                      : (NEED_KINDS.find((k) => k.key === need.key)?.description ??
                        'No note from the creator on this one.')}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ) : null}
      </Spine>
    </section>
  )
}

function AskRow({ ask, printed }: { ask: ProjectAskView; printed: boolean }) {
  const answered = ask.answerCount > 0
  return (
    <li className="flex items-start gap-4 border-b border-rule py-4 last:border-b-0">
      <span
        aria-hidden="true"
        className={`mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-xs border-[1.5px] ${
          answered ? 'border-ink bg-ink text-paper-hi' : 'border-rule-2 bg-transparent'
        }`}
      >
        {answered ? <Check size={14} strokeWidth={2.5} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        {/* Both rows carry their own question, in the same face. The printed
            one used to swap its text for "The ask at the top of the page",
            which changed the row's type, face and link state at once: side by
            side the pair read as one link working and one broken, and the row
            that was a link was the only one that did not say what was asked.
            `printed` now decides only whether the prompt is a link up to the
            copy already quoted at the top. */}
        {printed ? (
          <a href="#the-ask" className="voice link block text-base text-ink">
            {ask.prompt}
          </a>
        ) : (
          <span className="voice block text-base text-ink">{ask.prompt}</span>
        )}
        <span className="mt-1 block text-xs text-ink-3">
          {answered
            ? // answer_count is incremented once per point that names this ask,
              // not once per note, so a project with 25 notes can legitimately
              // carry 42 answers. Calling them notes made the number look wrong.
              `Answered · ${String(ask.answerCount)} ${plural(ask.answerCount, 'point', 'points')} written against it`
            : ask.isRequired
              ? 'Still open · the creator asked every reviewer to answer this one'
              : 'Still open · nobody has written against it yet'}
        </span>
      </span>
      <span className="eyebrow shrink-0 pt-1 text-ink-3">{answered ? 'Answered' : 'Open'}</span>
    </li>
  )
}

/* ------------------------------------------------------ the progress ladder */

/**
 * Close the loop, made visible: notes in, issues named, changes out, and how
 * far along the thing is. Four rungs, every number a COUNT over real rows, and
 * the last rung is the grit scale so the ladder and the identity are the same
 * measure.
 */
export function ProgressLadder({
  project,
  ledger,
  headingId = 'ladder-heading',
  blind = false,
}: {
  project: ProjectDetail
  ledger: LoopLedger
  headingId?: string
  /**
   * True while this reader is behind the blind gate. Only one rung changes: the
   * issue count is an aggregate of the notes they have not read, and a project
   * announced as having seventeen problems has already made their first
   * impression for them. The other three are either the veil's own numbers or
   * public history.
   */
  blind?: boolean
}) {
  const here = gritIndex(project.grit)
  const toGo = GRIT_SCALE.length - 1 - here

  const rungs: readonly { key: string; label: string; value: string; note: string }[] = [
    {
      key: 'received',
      label: 'Feedback received',
      value: String(ledger.notesReceived),
      note: `${plural(ledger.notesReceived, 'note', 'notes')} from ${String(ledger.reviewers)} ${plural(ledger.reviewers, 'reviewer', 'reviewers')}.`,
    },
    {
      key: 'issues',
      label: 'Issues identified',
      value: blind ? 'Held' : String(ledger.issuesRaised),
      note: blind
        ? 'Counted from the notes above, which open once you have written your own first impression.'
        : ledger.issuesRaised === 0
          ? 'Nothing filed as a problem yet. Everything written so far reads as praise.'
          : `${String(ledger.issuesAnswered)} of them already answered by a change.`,
    },
    {
      key: 'shipped',
      label: 'Changes shipped',
      value: String(ledger.changesShipped),
      note:
        ledger.changesShipped === 0
          ? 'Nothing has gone out on the back of a note on this project yet.'
          : `Across ${String(ledger.shippedBuilds)} ${plural(ledger.shippedBuilds, 'build', 'builds')}, each one traceable to the note that caused it.`,
    },
    {
      key: 'readiness',
      label: 'Launch readiness',
      value: String(project.grit),
      note:
        toGo === 0
          ? 'Shipped. The top of the scale, declared by the creator.'
          : `${GRIT_SCALE[here]?.label ?? ''}. ${String(toGo)} ${plural(toGo, 'step', 'steps')} from shipped.`,
    },
  ]

  return (
    <section aria-labelledby={headingId}>
      <Spine
        label="Closing the loop"
        labelId={headingId}
        note="What came in, what it named, and what went out because of it."
      >
        <ol className="m-0 flex list-none flex-col border-t-[1.5px] border-ink p-0">
          {rungs.map((rung, i) => (
            <li
              key={rung.key}
              className="grid grid-cols-[3rem_1fr] items-baseline gap-x-6 gap-y-1 border-b border-rule py-6 sm:grid-cols-[3rem_12rem_1fr]"
            >
              <span
                aria-hidden="true"
                className="ws-outline ws-outline-thin tnum text-lg leading-none"
              >
                {i + 1}
              </span>
              <span className="text-md font-bold text-ink">{rung.label}</span>
              <span className="col-start-2 sm:col-start-3">
                <span className="tnum text-lg font-bold text-ink">{rung.value}</span>
                <span className="mt-1 block max-w-[52ch] text-sm text-ink-3">{rung.note}</span>
              </span>
            </li>
          ))}
        </ol>
      </Spine>
    </section>
  )
}

/* ----------------------------------------------------------- the grit scale */

/** The five steps as ink density, with this project's own step picked out. */
export function GritStrip({ project, headingId = 'scale-heading' }: { project: ProjectDetail; headingId?: string }) {
  const here = gritIndex(project.grit)

  return (
    <section aria-labelledby={headingId}>
      <div className="grid gap-x-16 gap-y-4 pb-8 lg:grid-cols-[1.1fr_1fr] lg:items-end">
        <h2 id={headingId} className="max-w-[20ch] text-lg lg:text-xl">
          How finished it is, said out loud before anyone reviews it.
        </h2>
        <p className="voice text-base">
          Ink density is the scale. A concept is an outline; a shipped build is solid. Reviewers read
          the step before they open the file, so a concept never gets the notes a release candidate
          needs.
        </p>
      </div>

      <ol className="m-0 grid list-none grid-cols-2 border-l border-rule border-t-[1.5px] border-t-ink p-0 sm:grid-cols-5">
        {GRIT_SCALE.map((rung, i) => (
          <li key={rung.key} className="border-r border-b border-rule pb-6 sm:border-b-0">
            <div
              className={`relative h-24 border-b border-rule sm:h-32 ${i === here ? 'bg-paper-hi outline-[1.5px] -outline-offset-[1.5px] outline-ink' : ''}`}
            >
              <span
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 block bg-ink"
                style={{ height: `${String((INK_DENSITY[i] ?? 0.1) * 100)}%` }}
              />
            </div>
            <span className="tnum mt-4 block px-4 text-md font-bold text-ink">{rung.value}</span>
            <span className="eyebrow mt-1 block px-4 text-ink-3">{rung.label}</span>
            {i === here ? (
              <span className="eyebrow mt-2 block px-4 text-mark">{project.title} is here</span>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ------------------------------------------------------------------ links */

/**
 * Where a reader goes to try the thing.
 *
 * Whatever the creator linked, plus the current build's own address when no
 * link already carries it. Most projects link nothing, and when this section
 * simply vanished a reviewer was left looking for a download that does not
 * exist. They get a sentence saying so instead, and a way to what the project
 * does have here: its builds, each with the creator's changelog and the notes
 * written against it.
 */
export function WhereToGetIt({ project, buildCount }: { project: ProjectDetail; buildCount: number }) {
  // Creator-supplied, so every address goes through the allowlist before it
  // becomes an href. One the rule refuses is not shown at all, rather than
  // shown as something that does nothing.
  const links = project.links.flatMap((link) => {
    const href = safeHref(link.url)
    return href === null ? [] : [{ key: link.id, label: link.label, href }]
  })
  const current = project.currentVersion
  const buildHref = safeHref(current?.buildUrl)
  const entries =
    current && buildHref && !links.some((link) => link.href === buildHref)
      ? [{ key: `build-${current.id}`, label: `Open ${current.label}`, href: buildHref }, ...links]
      : links

  return (
    <section aria-labelledby="links-heading">
      <Spine label="Where to get it" labelId="links-heading">
        {entries.length > 0 ? (
          <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
            {entries.map((entry) => (
              <li key={entry.key} className="min-w-0 max-w-full">
                <a
                  className="ws-scaffold ws-scaffold-wrap"
                  href={entry.href}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink size={16} strokeWidth={1.5} aria-hidden="true" className="shrink-0" />
                  {entry.label}
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-start gap-4">
            <p className="max-w-[58ch] text-sm text-ink-2">
              {buildCount > 0
                ? `The creator has not linked a download, a store page or a hosted build, so there is nothing here to open. What they have posted is the build history: ${String(buildCount)} ${plural(buildCount, 'build', 'builds')}, with what changed in each and the notes written against it.`
                : 'The creator has not posted a build or linked one yet, so there is nothing to open. A review of it is a review of what this page describes.'}
            </p>
            {buildCount > 0 ? (
              <Link href={`/p/${project.slug}/versions`} className="ws-scaffold">
                {buildCount === 1 ? 'See the build' : `See the ${String(buildCount)} builds`}
              </Link>
            ) : null}
          </div>
        )}
      </Spine>
    </section>
  )
}
