/**
 * Post a project.
 *
 * Six steps, one column, 40rem. The step lives in `?step=` and the work lives
 * in a real `draft` project row from the second step onwards, so the back
 * button, a reload and a closed tab all behave: there is no client-side draft
 * store that can disagree with the server.
 *
 * SC 3.3.7, Redundant Entry: every field is prefilled from that row, and the
 * last step is a check-answers page with an Edit link per line rather than a
 * second pass through the same questions.
 *
 * The row outranks the address. Its kind is the kind, whatever `?type=` says,
 * and once it is published the wizard has nothing left to do with it.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
// Reads identity to decide what to render. It uses the revocation-aware check
// so a cookie that has been signed out elsewhere stops looking signed in here,
// rather than rendering a signed-in page whose every write would be refused.
import { currentClaimsLive } from '@/server/queries/auth'
import { Banner, EmptyState, StepIndicator, type Step } from '@/components/ui'
import {
  GRIT_STAGES,
  NEED_KINDS,
  categoriesFor,
  isProjectTypeSlug,
  projectType,
  promptsFor,
  splitTaxonomyId,
} from '@/lib/taxonomy'
import { isGritValue } from '@/components/project/grit-values'
import { getProjectById, getProjectBySlug, listMyProjects } from '@/server/repos/projects'
import { listVersionTimeline } from '@/server/queries/project-surface'
import { publishDraft, saveAsk, saveBasics, saveBuild, saveNeeds } from '@/server/actions/project'
import { ProjectStyles } from '@/components/project/styles'
import { TypePicker } from '@/components/project/wizard/type-picker'
import { AskStep, BasicsStep, BuildStep, NeedsStep, PublishForm } from '@/components/project/wizard/wizard-forms'
import { afterPublishNote, parseThen, thenParam } from '@/components/project/wizard/then'

export const metadata: Metadata = { title: 'Post a project' }

type Search = Promise<Record<string, string | string[] | undefined>>

const STEP_ORDER = ['type', 'basics', 'ask', 'needs', 'build', 'review'] as const
type StepKey = (typeof STEP_ORDER)[number]

/**
 * One word each, because the indicator divides 40rem by six: at "What would
 * help" the cell wrapped to three lines and the six labels stopped sharing a
 * baseline, which is the one job a step row has.
 */
const STEP_LABELS: Record<StepKey, string> = {
  type: 'Kind',
  basics: 'Basics',
  ask: 'The ask',
  needs: 'Needs',
  build: 'The build',
  review: 'Last look',
}

function isStepKey(value: string): value is StepKey {
  return (STEP_ORDER as readonly string[]).includes(value)
}

export default async function NewProjectPage({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams
  const then = parseThen(sp['then'])
  const carry = thenParam(then)
  const claims = await currentClaimsLive()
  if (!claims) redirect(`/sign-in?next=${encodeURIComponent(`/new?step=type${carry}`)}`)

  const rawStep = typeof sp['step'] === 'string' ? sp['step'] : 'type'
  const rawType = typeof sp['type'] === 'string' ? sp['type'] : ''
  const draftId = typeof sp['draft'] === 'string' ? sp['draft'] : ''

  const step: StepKey = isStepKey(rawStep) ? rawStep : 'type'

  const draftRow = draftId ? getProjectById(draftId) : undefined
  // Slugs are unique per owner, not globally, and a draft has no `published_at`
  // to sort on. Without the handle a bare slug would resolve to whichever
  // published project of that name someone else got there first with.
  const draft =
    draftRow && String(draftRow.owner_id) === claims.uid
      ? (getProjectBySlug(String(draftRow.slug), { viewerId: claims.uid, ownerHandle: claims.handle }) ?? null)
      : null

  if (draftId && !draft) {
    return (
      <Shell step={null} typeSlug="" draftId="" then={then}>
        <EmptyState
          title="That draft is not yours"
          body="The address carries a draft id that belongs to another account, or to a project that has since been deleted. Starting again keeps anything you already published untouched."
          primaryAction={{ label: 'Start a new project', href: `/new?step=type${carry}` }}
          headingLevel={2}
        />
      </Shell>
    )
  }

  // Reached with the back button after publishing, the last step offered to
  // publish a live project again. The server refuses that too; this says why.
  if (draft && draft.status !== 'draft') {
    return (
      <Shell step={null} typeSlug="" draftId="" then={then}>
        <EmptyState
          title={`${draft.title} is already published`}
          body="Everything these steps asked for is on its project page now, where reviewers can find it. A new project starts from the first step."
          primaryAction={{ label: `Open ${draft.title}`, href: `/p/${draft.slug}`, primary: true }}
          secondaryAction={{ label: 'Start a new project', href: `/new?step=type${carry}` }}
          headingLevel={2}
        />
      </Shell>
    )
  }

  // The draft's kind decides every later question, so an edited address cannot
  // relabel it: a game reached with `type=api_tool` read "Kind: API or dev tool".
  if (draft && step !== 'type' && draft.typeSlug !== rawType) {
    redirect(`/new?step=${step}&type=${draft.typeSlug}&draft=${draft.id}${carry}`)
  }

  const typeSlug = isProjectTypeSlug(rawType) ? rawType : ''
  const type = typeSlug ? projectType(typeSlug) : undefined

  // A step past the first needs a kind; a step past the second needs a draft.
  if (step !== 'type' && !type) redirect(`/new?step=type${carry}`)
  if (step !== 'type' && step !== 'basics' && !draftId) redirect(`/new?step=basics&type=${typeSlug}${carry}`)

  // Every draft, not the drafts among the five most recent projects: the banner
  // prints the count, and a creator with a published project on top was told
  // they had fewer than they do.
  const resumable =
    step === 'type' ? listMyProjects(claims.uid, { limit: 100 }).filter((p) => p.status === 'draft') : []
  const firstDraft = resumable[0]
  const firstDraftRow = firstDraft ? getProjectById(firstDraft.id) : undefined
  const resumeHref = firstDraft && firstDraftRow
    ? `/new?step=basics&type=${String(firstDraftRow.project_type_id)}&draft=${firstDraft.id}${carry}`
    : null
  const versions = draft ? listVersionTimeline(draft.id) : []
  const currentVersion = versions[0] ?? null

  return (
    <Shell step={step} typeSlug={typeSlug} draftId={draftId} then={then}>
      {step === 'type' ? (
        <>
          {firstDraft && resumeHref ? (
            <Banner
              title={
                resumable.length === 1
                  ? 'You have an unfinished draft'
                  : `You have ${resumable.length} unfinished drafts`
              }
              action={{ label: `Resume ${firstDraft.title}`, href: resumeHref }}
            >
              Nothing is lost while a project is a draft. Picking a kind below starts a new one.
            </Banner>
          ) : null}
          <TypePicker then={then} />
        </>
      ) : null}

      {step === 'basics' && type ? (
        <BasicsStep
          type={type.slug}
          draftId={draftId}
          then={then}
          action={saveBasics}
          defaults={{
            title: draft?.title ?? '',
            tagline: draft?.tagline ?? '',
            summary: draft?.summaryMd ?? '',
            grit: draft && isGritValue(draft.grit) ? draft.grit : null,
          }}
        />
      ) : null}

      {step === 'ask' && type && draft ? (
        <AskStep
          type={type.slug}
          draftId={draft.id}
          then={then}
          action={saveAsk}
          categories={categoriesFor(type.slug).map((c) => ({ key: c.key, label: c.label }))}
          prompts={promptsFor(type.slug)}
          summary={draft.summaryMd ?? ''}
          defaults={{
            ask: draft.asks[0]?.prompt ?? '',
            ignore: draft.asks[0]?.detailMd ?? '',
            // Saving the step again used to clear the area it was filed under,
            // because the select came back empty on every visit.
            category: askAreaOf(draft.asks[0]?.categoryId ?? null, type.slug),
          }}
        />
      ) : null}

      {step === 'needs' && type && draft ? (
        <NeedsStep
          type={type.slug}
          draftId={draft.id}
          then={then}
          action={saveNeeds}
          needs={NEED_KINDS.map((n) => ({ key: n.key, label: n.label, description: n.description }))}
          defaults={{
            selected: draft.needs.map((n) => n.key),
            tags: draft.tags.map((t) => t.label).join(', '),
          }}
        />
      ) : null}

      {step === 'build' && type && draft ? (
        <BuildStep
          type={type.slug}
          draftId={draft.id}
          then={then}
          action={saveBuild}
          defaults={{
            versionLabel: currentVersion?.label ?? 'Build 1',
            buildUrl: currentVersion?.buildUrl ?? '',
            changelog: currentVersion?.changelogMd ?? '',
          }}
        />
      ) : null}

      {step === 'review' && type && draft ? (
        <section aria-labelledby="review-heading" className="flex flex-col gap-lg">
          <div className="flex flex-col gap-2xs">
            <h2 id="review-heading" className="text-lg text-text-1">
              Check it over
            </h2>
            <p className="measure-ui text-sm text-text-2">
              This is what a reviewer sees. Nothing here is asked for twice: change a line by editing the step it came
              from.
            </p>
          </div>

          <dl className="m-0 flex flex-col">
            <Row label="Kind" value={type.label} />
            <Row label="Name" value={draft.title} href={`/new?step=basics&type=${type.slug}&draft=${draft.id}${carry}`} />
            <Row
              label="One line"
              value={draft.tagline ?? 'Not written'}
              href={`/new?step=basics&type=${type.slug}&draft=${draft.id}${carry}`}
            />
            <Row
              label="Stage"
              value={`${draft.grit} of 8000, ${stageWord(draft.grit)}`}
              href={`/new?step=basics&type=${type.slug}&draft=${draft.id}${carry}`}
            />
            <Row
              label="Summary"
              value={draft.summaryMd ?? 'Not written'}
              href={`/new?step=basics&type=${type.slug}&draft=${draft.id}${carry}`}
              prose
            />
            <Row
              label="The ask"
              value={draft.asks[0]?.prompt ?? 'Not written'}
              href={`/new?step=ask&type=${type.slug}&draft=${draft.id}${carry}`}
              prose
            />
            <Row
              label="What would help"
              value={draft.needs.length > 0 ? draft.needs.map((n) => n.label).join(', ') : 'Nothing picked'}
              href={`/new?step=needs&type=${type.slug}&draft=${draft.id}${carry}`}
            />
            <Row
              label="Tags"
              value={draft.tags.length > 0 ? draft.tags.map((t) => t.label).join(', ') : 'None'}
              href={`/new?step=needs&type=${type.slug}&draft=${draft.id}${carry}`}
            />
            <Row
              label="Build"
              value={currentVersion ? `${currentVersion.label}${currentVersion.buildUrl ? `, ${currentVersion.buildUrl}` : ''}` : 'None yet'}
              href={`/new?step=build&type=${type.slug}&draft=${draft.id}${carry}`}
            />
          </dl>

          <PublishForm draftId={draft.id} then={then} action={publishDraft} />
        </section>
      ) : null}
    </Shell>
  )
}

function Shell({
  step,
  typeSlug,
  draftId,
  then,
  children,
}: {
  /** Null when the page is refusing rather than asking, so there is no step to show. */
  step: StepKey | null
  typeSlug: string
  draftId: string
  then: string | null
  children: React.ReactNode
}) {
  const note = afterPublishNote(then)
  const currentIndex = step ? STEP_ORDER.indexOf(step) : -1
  const steps: Step[] = STEP_ORDER.map((key, index) => ({
    id: key,
    label: STEP_LABELS[key],
    status: index < currentIndex ? 'done' : index === currentIndex ? 'current' : 'ahead',
    href:
      index < currentIndex
        ? index === 0
          ? `/new?step=type${thenParam(then)}`
          : `/new?step=${key}&type=${typeSlug}${draftId ? `&draft=${draftId}` : ''}${thenParam(then)}`
        : undefined,
  }))

  // The padding sits outside the 42rem, not inside it: at 1440 the gutter took
  // 128px of the column and left the six steps 60px each, so every status word
  // broke onto a second line.
  return (
    <div className="pad-inline w-full">
      <div className="mx-auto flex w-full max-w-prose flex-col gap-xl py-xl">
        <ProjectStyles />
        <div className="flex flex-col gap-xs">
          <h1 className="text-2xl text-ink">Post a project</h1>
          <p className="measure-ui text-sm text-ink-2">
            Six short steps. Everything is saved as a private draft as you go, and nothing is public until you
            publish it yourself.{note ? ` ${note}` : ''}
          </p>
        </div>
        {step ? <StepIndicator label="Post a project" steps={steps} /> : null}
        {children}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  href,
  prose = false,
}: {
  label: string
  value: string
  /** Omitted for the one value that cannot be changed after the draft exists. */
  href?: string
  prose?: boolean
}) {
  return (
    <div className="flex flex-col gap-2xs border-b border-border-hair py-sm sm:flex-row sm:items-baseline sm:gap-md">
      <dt className="text-2xs text-text-3 sm:w-40 sm:shrink-0">{label}</dt>
      <dd className={prose ? 'prose-human m-0 flex-1 text-text-1' : 'm-0 flex-1 text-sm text-text-1'}>{value}</dd>
      {href ? (
        // 44px tall in its own right (§5.5): at `text-xs` alone the link was a
        // 17px target, and eight of them stacked a row apart.
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
