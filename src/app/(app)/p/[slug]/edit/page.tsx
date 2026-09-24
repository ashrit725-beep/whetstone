/**
 * Edit a published project.
 *
 * The same four steps the project was posted with, in the same components, so a
 * creator is never asked a question in one vocabulary here and another one
 * there. The difference is the shape: a live project is not a queue of steps to
 * get through, it is a set of lines that are already right, one of which is
 * wrong. So the page opens on every value with an Edit link beside it — the
 * wizard's own last step — and a step is only rendered when one was asked for.
 *
 * Two promises the page keeps in writing, because both are things a creator
 * hesitates over before touching a live project: a save is live immediately, and
 * the address never changes, so every link, bookmark and notification already
 * written still lands here.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Banner } from '@/components/ui'
import { GRIT_STAGES, NEED_KINDS, categoriesFor, promptsFor, splitTaxonomyId } from '@/lib/taxonomy'
import { isGritValue } from '@/components/project/grit-values'
import { listPlaytestRounds, listVersionTimeline } from '@/server/queries/project-surface'
import { ProjectHeader } from '@/components/project/project-header'
import { ProjectShell, Wrap } from '@/components/project/project-shell'
import { AskStep, BasicsStep, BuildStep, NeedsStep } from '@/components/project/wizard/wizard-forms'
import { toggleFollowing, toggleSaved } from '../actions'
import { projectForViewer } from '../viewer-project'
import { editAsk, editBasics, editBuild, editNeeds } from './actions'

type Params = Promise<{ slug: string }>
type Search = Promise<Record<string, string | string[] | undefined>>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { project } = await projectForViewer((await params).slug)
  // Never indexed: the page 404s for everyone but the creator, and a title in a
  // search result for a page nobody else can open is a dead end.
  return { title: `Edit ${project.title}`, robots: { index: false, follow: false } }
}

const STEPS = ['basics', 'ask', 'needs', 'build'] as const
type StepKey = (typeof STEPS)[number]

function isStepKey(value: string): value is StepKey {
  return (STEPS as readonly string[]).includes(value)
}

/** What the last save changed, said back in the words the line uses. */
const SAVED_WORDS: Readonly<Record<string, string>> = {
  details: 'The details are saved and live on the project page.',
  ask: 'The ask is saved. Reviewers opening the project now see the new question.',
  help: 'What would help is saved, and the feed filters follow it from here.',
  build: 'The build is saved. Nobody was notified: posting a new build is what does that.',
}

export default async function EditProjectPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Search
}) {
  const { project, viewerId } = await projectForViewer((await params).slug)
  const sp = await searchParams

  // Owner-only, and a 404 rather than a refusal: a reader who cannot edit it has
  // no business learning that this address exists.
  if (!project.viewer.canEdit) notFound()
  // An unpublished draft belongs to the posting steps, which still have a
  // publish button at the end of them. Two surfaces writing one unfinished row
  // is how a creator ends up with two builds and one ask.
  if (project.status === 'draft') redirect(`/new?step=basics&type=${project.typeSlug}&draft=${project.id}`)

  const rawStep = typeof sp['step'] === 'string' ? sp['step'] : ''
  const step: StepKey | null = isStepKey(rawStep) ? rawStep : null
  const savedWord = typeof sp['saved'] === 'string' ? SAVED_WORDS[sp['saved']] : undefined

  const versions = listVersionTimeline(project.id)
  const rounds = listPlaytestRounds(project.id, viewerId)
  const currentVersion = versions[0] ?? null
  const ask = project.asks[0]

  const stepHref = (key: StepKey): string => `/p/${project.slug}/edit?step=${key}`

  return (
    <ProjectShell>
      <Wrap className="pt-12 pb-8 lg:pt-16">
        <ProjectHeader
          project={project}
          section="edit"
          versionCount={versions.length}
          roundCount={rounds.length}
          openRoundTitle={null}
          viewerSignedIn={viewerId !== null}
          saveAction={toggleSaved}
          followAction={toggleFollowing}
        />
      </Wrap>

      <Wrap className="pb-24 pt-4">
        <div className="flex w-full max-w-prose flex-col gap-lg">
          <div className="flex flex-col gap-2xs">
            <h2 className="text-lg text-ink">{step ? STEP_HEADINGS[step] : 'What reviewers see'}</h2>
            <p className="measure-ui text-sm text-ink-2">
              {step
                ? STEP_NOTES[step]
                : `Every line is live. Changing one saves it straight away, and the address stays /p/${project.slug}, so links, bookmarks and notifications already sent still land here. The kind is the one thing that does not change: it decides the categories every note on this project is filed under.`}
            </p>
          </div>

          {savedWord && !step ? <Banner title="Saved">{savedWord}</Banner> : null}

          {step === null ? (
            <>
              <dl className="m-0 flex flex-col">
                <Row label="Kind" value={project.typeLabel} />
                <Row label="Name" value={project.title} href={stepHref('basics')} />
                <Row label="One line" value={project.tagline ?? 'Not written'} href={stepHref('basics')} />
                <Row
                  label="Stage"
                  value={`${String(project.grit)} of 8000, ${stageWord(project.grit)}`}
                  href={stepHref('basics')}
                />
                <Row label="Summary" value={project.summaryMd ?? 'Not written'} href={stepHref('basics')} prose />
                <Row label="The ask" value={ask?.prompt ?? 'Not written'} href={stepHref('ask')} prose />
                <Row
                  label="Not worth their time"
                  value={ask?.detailMd ?? 'Nothing named'}
                  href={stepHref('ask')}
                  prose
                />
                <Row
                  label="What would help"
                  value={project.needs.length > 0 ? project.needs.map((n) => n.label).join(', ') : 'Nothing picked'}
                  href={stepHref('needs')}
                />
                <Row
                  label="Tags"
                  value={project.tags.length > 0 ? project.tags.map((t) => t.label).join(', ') : 'None'}
                  href={stepHref('needs')}
                />
                <Row
                  label="Current build"
                  value={
                    currentVersion
                      ? `${currentVersion.label}${currentVersion.buildUrl ? `, ${currentVersion.buildUrl}` : ''}`
                      : 'None yet'
                  }
                  href={stepHref('build')}
                />
              </dl>

              <div className="flex flex-wrap items-center gap-3">
                <Link href={`/p/${project.slug}`} className="btn">
                  Back to the project
                </Link>
                {/* The two acts this page deliberately does not do, each where it
                    already lives. A new build notifies every follower; closing
                    the project is on the account's own danger page. */}
                <Link href={`/p/${project.slug}/versions#new-build`} className="btn btn-secondary">
                  Post a new build instead
                </Link>
              </div>
            </>
          ) : null}

          {step === 'basics' ? (
            <BasicsStep
              type={project.typeSlug}
              draftId={project.id}
              then={null}
              action={editBasics}
              submitLabel="Save these details"
              defaults={{
                title: project.title,
                tagline: project.tagline ?? '',
                summary: project.summaryMd ?? '',
                grit: isGritValue(project.grit) ? project.grit : null,
              }}
            />
          ) : null}

          {step === 'ask' ? (
            <AskStep
              type={project.typeSlug}
              draftId={project.id}
              then={null}
              action={editAsk}
              submitLabel="Save the ask"
              categories={categoriesFor(project.typeSlug).map((c) => ({ key: c.key, label: c.label }))}
              prompts={promptsFor(project.typeSlug)}
              summary={project.summaryMd ?? ''}
              // What the row already knows, so the assistant does not guess the
              // stage from the summary and describe a shipped project back to
              // its creator as a prototype.
              stageKey={project.stageKey}
              buildLinks={currentVersion?.buildUrl ?? ''}
              defaults={{
                ask: ask?.prompt ?? '',
                ignore: ask?.detailMd ?? '',
                category: askAreaOf(ask?.categoryId ?? null, project.typeSlug),
              }}
            />
          ) : null}

          {step === 'needs' ? (
            <NeedsStep
              type={project.typeSlug}
              draftId={project.id}
              then={null}
              action={editNeeds}
              submitLabel="Save what would help"
              needs={NEED_KINDS.map((n) => ({ key: n.key, label: n.label, description: n.description }))}
              defaults={{
                selected: project.needs.map((n) => n.key),
                tags: project.tags.map((t) => t.label).join(', '),
              }}
            />
          ) : null}

          {step === 'build' ? (
            <BuildStep
              type={project.typeSlug}
              draftId={project.id}
              then={null}
              action={editBuild}
              submitLabel="Save the build"
              defaults={{
                versionLabel: currentVersion?.label ?? 'Build 1',
                buildUrl: currentVersion?.buildUrl ?? '',
                changelog: currentVersion?.changelogMd ?? '',
              }}
            />
          ) : null}

          {step ? (
            <p>
              <Link href={`/p/${project.slug}/edit`} className="link tap-44 inline-flex items-center text-sm">
                Back to every detail, without saving this one
              </Link>
            </p>
          ) : null}
        </div>
      </Wrap>
    </ProjectShell>
  )
}

const STEP_HEADINGS: Record<StepKey, string> = {
  basics: 'The details',
  ask: 'The ask',
  needs: 'What would help',
  build: 'The build that is up',
}

const STEP_NOTES: Record<StepKey, string> = {
  basics: 'The name, the line under it and how finished you are calling it. The address does not change with the name.',
  ask: 'The one question at the top of the project page. Reviewers answer this one first, so sharpening it changes what comes in.',
  needs: 'What kind of help you would act on, and the tags a stranger with the right expertise finds you by.',
  build:
    'The build reviewers are looking at now. This corrects it; posting a new one is a separate act, and that is what tells your followers.',
}

function Row({
  label,
  value,
  href,
  prose = false,
}: {
  label: string
  value: string
  /** Omitted for the one value that cannot change after the project exists. */
  href?: string
  prose?: boolean
}) {
  return (
    <div className="flex flex-col gap-2xs border-b border-border-hair py-sm sm:flex-row sm:items-baseline sm:gap-md">
      <dt className="text-2xs text-text-3 sm:w-40 sm:shrink-0">{label}</dt>
      <dd className={prose ? 'prose-human m-0 flex-1 text-text-1' : 'm-0 flex-1 text-sm text-text-1'}>{value}</dd>
      {href ? (
        // 44px tall in its own right: at `text-xs` alone it was a 17px target,
        // and ten of them stacked a row apart.
        <Link href={href} className="inline-flex min-h-11 items-center text-xs text-accent sm:shrink-0">
          Edit
          <span className="sr-only">{` ${label.toLowerCase()}`}</span>
        </Link>
      ) : null}
    </div>
  )
}

/** The area key of a saved ask, when it is filed under one of this kind's areas. */
function askAreaOf(id: string | null, typeSlug: string): string {
  const parts = id ? splitTaxonomyId(id) : undefined
  return parts && parts.slug === typeSlug ? parts.key : ''
}

function stageWord(grit: number): string {
  return GRIT_STAGES.find((s) => s.grit === grit)?.label.toLowerCase() ?? 'concept'
}
