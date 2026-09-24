'use server'

/**
 * Mutations for posting a project, shipping a build, and running a playtest.
 *
 * The wizard writes a real `draft` project row at the end of the second step
 * and patches it after that, so the work survives a reload, the back button and
 * a closed tab. There is no client-side draft store to fall out of sync.
 */

import { actionRefusal } from './limits'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { HttpsUrl } from '@/server/api/schema'
// Every write below authorises from `claims.uid`, so the claims must come from
// a session that is still live. A signature proves the cookie is authentic and
// nothing more: a JWT stays valid until it expires, so a cookie revoked by a
// sign-out or a password reset would otherwise keep authorising writes for up
// to thirty days. `currentClaimsLive()` puts the revocation check in front.
import { currentClaimsLive } from '@/server/queries/auth'
import type { FormState } from '@/components/ui/form'
import { GRIT_STAGES, NEED_KINDS, categoriesFor, categoryId, isProjectTypeSlug, projectType } from '@/lib/taxonomy'
import {
  addVersion,
  createProject,
  getProjectById,
  getProjectForEdit,
  publishProject,
  updateProject,
} from '@/server/repos/projects'
import { ensureTags, recountTags, tagIdsForProject } from '@/server/repos/tags'
import { all, get, run, tx } from '@/server/db/client'
import { notifyMany } from '@/server/repos/notifications'
import { generate as generateIntake, heuristic as intakeHeuristic, intakeLabel } from '@/server/ai/intake'
import type { IntakeSuggestion } from '@/server/ai/intake'
import type { ProjectStage } from '@/server/ai'
import type { AiResult } from '@/server/ai/types'
import {
  createPlaytestRound,
  isTaskOutcome,
  joinRound,
  recordTaskResult,
} from '@/server/queries/project-surface'
import { afterPublish, parseThen, thenParam } from '@/components/project/wizard/then'

/** The wizard posts the grit numeral; the stage key is derived from it. */
const Grit = z.coerce
  .number()
  .refine((n) => GRIT_STAGES.some((s) => s.grit === n), 'Pick the stage this build is actually at.')

function stageKeyFor(grit: number): string {
  return GRIT_STAGES.find((s) => s.grit === grit)?.key ?? 'concept'
}

const PUBLISHED = 'That project is already published, so these steps can no longer change it.'

/** The `then` a step was posted with, to put back on the next step's address. */
function carried(formData: FormData): string {
  return thenParam(parseThen(formData.get('then')))
}

/* ------------------------------------------------------------ step: basics -- */

const Basics = z.object({
  type: z.string().refine(isProjectTypeSlug, 'Pick the kind of thing you are building.'),
  draft: z.string().optional(),
  title: z
    .string()
    .trim()
    .min(3, 'Give the project a name of at least three characters.')
    .max(120, 'Keep the name to 120 characters. The Discover row prints it on one line.'),
  tagline: z.string().trim().max(140, 'Keep the line to 140 characters. It sits under the name on one row.').optional(),
  // The summary's counter says 2000, so that is the limit that holds.
  summary: z
    .string()
    .trim()
    .min(80, 'Write at least eighty characters. Reviewers decide from this whether they can help you.')
    .max(2000, 'Keep it to 2000 characters. The detail can go in the ask and the build notes.'),
  grit: Grit,
})

export async function saveBasics(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return { status: 'error', message: 'Sign in to post a project.' }
  const held = actionRefusal('project', claims.uid)
  if (held) return { status: 'error', message: held }

  const parsed = Basics.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorState(parsed.error.issues, 'This step was not saved.')

  const { type, title, tagline, summary, grit } = parsed.data
  const stage = stageKeyFor(grit)
  let draftId = parsed.data.draft ?? ''

  // The draft id arrives in a hidden field, so it is caller-supplied and has to
  // be checked against the caller. Every other step of this wizard goes through
  // `ownedDraft()`; this one did not, and `updateProject` is `WHERE id = ?`
  // with no owner predicate, so any signed-in account could overwrite the
  // title, tagline, summary and stage of any project in the database by putting
  // its id in that field. Project ids are public: they are in every
  // /api/projects/[projectId]/… URL the page emits.
  const existing = draftId.length > 0 ? getProjectById(draftId) : undefined
  if (existing && String(existing.owner_id) !== claims.uid) {
    return { status: 'error', message: 'That draft belongs to someone else.' }
  }
  if (existing && existing.status !== 'draft') return { status: 'error', message: PUBLISHED }

  if (existing) {
    updateProject(draftId, {
      title,
      tagline: tagline && tagline.length > 0 ? tagline : null,
      summaryMd: summary,
      stageKey: stage,
    })
  } else {
    draftId = createProject({
      ownerId: claims.uid,
      projectTypeId: type,
      title,
      tagline: tagline && tagline.length > 0 ? tagline : null,
      summaryMd: summary,
      stageKey: stage,
      visibility: 'private',
    })
  }

  // A draft keeps the kind it was started as; the hidden field only names it.
  const kind = existing ? String(existing.project_type_id) : type
  redirect(`/new?step=ask&type=${kind}&draft=${draftId}${carried(formData)}`)
}

/* --------------------------------------------------------------- step: ask -- */

const Ask = z.object({
  type: z.string().refine(isProjectTypeSlug),
  draft: z.string().min(1),
  ask: z
    .string()
    .trim()
    .min(30, 'Write the one question you most want answered. Thirty characters is the floor.')
    .max(600, 'Keep the question to 600 characters. One question, asked plainly, gets answered.'),
  ignore: z.string().trim().max(400, 'Keep this to 400 characters.').optional(),
})

export async function saveAsk(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await ownedDraft(formData)
  if ('error' in guard) return guard.error

  const parsed = Ask.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorState(parsed.error.issues, 'This step was not saved.')

  // One of the areas the select offers for this kind, or none. Anything else
  // failed the foreign key after the old ask was already deleted, so the step
  // answered with an error page and the question the creator had saved was gone.
  const category = String(formData.get('askCategory') ?? '')
  if (category.length > 0 && !categoriesFor(guard.typeSlug).some((c) => c.key === category)) {
    return {
      status: 'error',
      message: 'This step was not saved.',
      fieldErrors: { askCategory: 'Pick one of the areas in the list, or no particular area.' },
    }
  }
  tx(() => {
    run(`DELETE FROM project_asks WHERE project_id = ?`, [guard.draftId])
    run(
      `INSERT INTO project_asks (id, project_id, category_id, prompt, detail_md, is_required, sort_order, answer_count, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 0, 0, ?)`,
      [
        crypto.randomUUID(),
        guard.draftId,
        category.length > 0 ? categoryId(guard.typeSlug, category) : null,
        parsed.data.ask,
        parsed.data.ignore && parsed.data.ignore.length > 0 ? parsed.data.ignore : null,
        Date.now(),
      ],
    )
  })

  redirect(`/new?step=needs&type=${guard.typeSlug}&draft=${guard.draftId}${carried(formData)}`)
}

/* ------------------------------------------------------------- step: needs -- */

const NEED_KEYS: ReadonlySet<string> = new Set(NEED_KINDS.map((n) => n.key))
const TAGS_MAX = 8
const TAG_CHARS_MAX = 32

export async function saveNeeds(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await ownedDraft(formData)
  if ('error' in guard) return guard.error

  const draftId = guard.draftId
  // Keys from the vocabulary only, once each. Anything else is not a box the
  // step offers, and `project_needs` would refuse it halfway through the write.
  const needs = [...new Set(formData.getAll('need').map(String))].filter((n) => NEED_KEYS.has(n))
  if (needs.length === 0) {
    return {
      status: 'error',
      message: 'This step was not saved.',
      fieldErrors: {
        need: 'Pick at least one kind of help. Reviewers filter the feed by this, so a project with none is invisible to them.',
      },
    }
  }

  // A tag is created site-wide the first time anyone uses it, and every project
  // row and profile that carries it prints it, so its length is bounded here.
  const tagLabels = String(formData.get('tags') ?? '')
    .split(',')
    .map((t) => t.trim().replace(/\s+/g, ' '))
    .filter((t) => t.length > 0)
  const tagProblem =
    tagLabels.length > TAGS_MAX
      ? `Keep it to ${String(TAGS_MAX)} tags. The ones a stranger would search for are enough.`
      : tagLabels.some((t) => t.length > TAG_CHARS_MAX)
        ? `Keep each tag to ${String(TAG_CHARS_MAX)} characters. A tag is a word or two, not a sentence.`
        : tagLabels.some((t) => !/[a-z0-9]/i.test(t.normalize('NFKD')))
          ? 'Each tag needs at least one letter or number.'
          : null
  if (tagProblem) {
    return { status: 'error', message: 'This step was not saved.', fieldErrors: { tags: tagProblem } }
  }

  run(`DELETE FROM project_needs WHERE project_id = ?`, [draftId])
  for (const need of needs) {
    run(`INSERT INTO project_needs (project_id, need_key, detail, created_at) VALUES (?, ?, NULL, ?)`, [
      draftId,
      need,
      Date.now(),
    ])
  }

  const previousTags = tagIdsForProject(draftId)
  run(`DELETE FROM project_tags WHERE project_id = ?`, [draftId])
  const nextTags = tagLabels.length > 0 ? ensureTags(tagLabels) : []
  for (const tagId of nextTags) {
    run(`INSERT OR IGNORE INTO project_tags (project_id, tag_id, created_at) VALUES (?, ?, ?)`, [
      draftId,
      tagId,
      Date.now(),
    ])
  }
  // The tags it lost and the ones it gained both need their counts redone.
  recountTags([...previousTags, ...nextTags])

  redirect(`/new?step=build&type=${guard.typeSlug}&draft=${draftId}${carried(formData)}`)
}

/* ------------------------------------------------------------- step: build -- */

const Build = z.object({
  type: z.string(),
  draft: z.string().min(1),
  versionLabel: z
    .string()
    .trim()
    .min(1, 'Name the build, the way you name it yourself.')
    .max(60, 'Keep the build name to 60 characters.'),
  buildUrl: HttpsUrl.or(z.literal('')).optional(),
  changelog: z.string().trim().max(2000, 'Keep the notes to 2000 characters.').optional(),
})

export async function saveBuild(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await ownedDraft(formData)
  if ('error' in guard) return guard.error

  const parsed = Build.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorState(parsed.error.issues, 'This step was not saved.')

  const buildUrl = parsed.data.buildUrl && parsed.data.buildUrl.length > 0 ? parsed.data.buildUrl : null
  const changelog = parsed.data.changelog && parsed.data.changelog.length > 0 ? parsed.data.changelog : null

  // A draft has one build, and this step edits it. It used to look the build up
  // by its name, so renaming it on a second pass added another build beside
  // the first and the project went live with two, one of them never posted.
  const existing =
    get<{ id: string }>(`SELECT id FROM project_versions WHERE project_id = ? AND version_label = ?`, [
      guard.draftId,
      parsed.data.versionLabel,
    ]) ??
    get<{ id: string }>(
      `SELECT id FROM project_versions WHERE project_id = ? ORDER BY is_current DESC, created_at DESC LIMIT 1`,
      [guard.draftId],
    )

  if (existing) {
    tx(() => {
      run(`UPDATE project_versions SET is_current = 0 WHERE project_id = ? AND id <> ? AND is_current = 1`, [
        guard.draftId,
        existing.id,
      ])
      run(
        `UPDATE project_versions SET version_label = ?, build_url = ?, changelog_md = ?, is_current = 1 WHERE id = ?`,
        [parsed.data.versionLabel, buildUrl, changelog, existing.id],
      )
    })
  } else {
    addVersion({
      projectId: guard.draftId,
      versionLabel: parsed.data.versionLabel,
      changelogMd: changelog,
      buildUrl,
      makeCurrent: true,
    })
  }

  redirect(`/new?step=review&type=${guard.typeSlug}&draft=${guard.draftId}${carried(formData)}`)
}

/* ------------------------------------------------------------ step: review -- */

export async function publishDraft(_prev: FormState, formData: FormData): Promise<FormState> {
  const guard = await ownedDraft(formData)
  if ('error' in guard) return guard.error
  const held = actionRefusal('publish', guard.ownerId)
  if (held) return { status: 'error', message: held }

  const project = getProjectById(guard.draftId)
  if (!project) return { status: 'error', message: 'That draft is no longer here.' }

  // The ask and the needs are the two steps a reviewer finds the project by and
  // answers to. The steps require them, and an edited address that jumped
  // straight to the last one could publish without either.
  const missing = [
    get(`SELECT 1 AS hit FROM project_asks WHERE project_id = ?`, [guard.draftId]) ? null : 'the ask',
    get(`SELECT 1 AS hit FROM project_needs WHERE project_id = ?`, [guard.draftId]) ? null : 'what would help',
  ].filter((step): step is string => step !== null)
  if (missing.length > 0) {
    return {
      status: 'error',
      message: `This project was not published. Fill in ${missing.join(' and ')} first, with the Edit link on ${missing.length === 1 ? 'its line' : 'their lines'} above.`,
    }
  }

  // `publishProject` writes `published_at` and promotes a private draft to
  // public in one statement. Setting visibility first would break the schema's
  // "a public row has a published_at" check.
  publishProject(guard.draftId)
  revalidatePath('/discover')
  redirect(afterPublish(parseThen(formData.get('then')), String(project.slug)))
}

/* ------------------------------------------------------- the intake assist -- */

export interface IntakeSuggestionResult {
  readonly askHeadline: string
  readonly askBody: string
  readonly ignoreList: readonly string[]
  readonly tags: readonly string[]
  readonly typeLabel: string
  readonly source: 'ai' | 'cached' | 'heuristic'
  readonly label: string
}

/**
 * The grit scale's stages in the assistant's vocabulary. The two ladders are
 * nearly the same and not quite: the scale has no alpha, and the assistant's
 * `launch_ready` is the release candidate rather than the shipped build.
 */
const INTAKE_STAGE: Readonly<Record<string, ProjectStage>> = {
  concept: 'concept',
  prototype: 'prototype',
  beta: 'beta',
  release_candidate: 'launch_ready',
  shipped: 'shipped',
}

/** The deterministic answer, in the shape the caller expects. */
function heuristicResult(input: {
  description: string
  links: readonly string[]
  stage?: ProjectStage
}): IntakeSuggestionResult {
  const result = intakeHeuristic(input)
  const type = projectType(result.data.projectType.value)
  return {
    askHeadline: result.data.ask.headline,
    askBody: result.data.ask.body,
    ignoreList: result.data.ask.ignoreList,
    tags: result.data.tags.map((t) => t.value),
    typeLabel: type?.label ?? result.data.projectType.value,
    source: result.source,
    label: intakeLabel(result),
  }
}

/**
 * Explicit, never automatic: the creator presses a button, reads the suggestion
 * and types over it. Nothing here writes to the form on its own.
 */
export async function suggestAsk(
  description: string,
  links: string,
  stageKey?: string,
): Promise<IntakeSuggestionResult> {
  // The arguments arrive from the network whatever their types say, and a
  // number where a string belongs used to throw before anything was checked.
  const text = typeof description === 'string' ? description.slice(0, 8_000) : ''
  const linkText = typeof links === 'string' ? links.slice(0, 4_000) : ''
  // The answer the creator gave one step earlier, in the assistant's words.
  // Without it the assistant guessed from the description and fell through to
  // "This is a prototype." for everyone, including a creator who had just
  // marked the project shipped.
  const stage = typeof stageKey === 'string' ? INTAKE_STAGE[stageKey] : undefined

  // This reaches a paid provider. It had no authentication and passed no user
  // id, so an anonymous caller could run it in a loop and the per-user daily
  // ceiling had nobody to count against. Both halves matter: the check keeps
  // strangers out, and the id is what makes the ceiling apply.
  const claims = await currentClaimsLive()
  // Signed out, or past the hourly allowance for model calls: the heuristic
  // still answers, it just does not spend a provider request.
  if (!claims || actionRefusal('aiIntake', claims.uid)) {
    return heuristicResult({ description: text, links: [], ...(stage ? { stage } : {}) })
  }

  const linkList = linkText
    .split(/\s+/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('https://'))
    .slice(0, 4)

  const input = { description: text, links: linkList, userId: claims.uid, ...(stage ? { stage } : {}) }
  let result: AiResult<IntakeSuggestion>
  try {
    result = await generateIntake(input)
  } catch {
    result = intakeHeuristic(input)
  }

  const type = projectType(result.data.projectType.value)
  return {
    askHeadline: result.data.ask.headline,
    askBody: result.data.ask.body,
    ignoreList: result.data.ask.ignoreList,
    tags: result.data.tags.map((t) => t.value),
    typeLabel: type?.label ?? result.data.projectType.value,
    source: result.source,
    label: intakeLabel(result),
  }
}

/* -------------------------------------------- taking notes, on one project -- */

/**
 * Stop, or start again, taking notes on one project.
 *
 * The publish step promises the creator they can close feedback whenever they
 * like, and the danger zone's account-wide button tells them each project can
 * be reopened from its own page. Neither sentence had a control behind it: the
 * only writer of `closed` was that account-wide button, and the only writer of
 * `open` was posting a build — so a creator who wanted to pause one project had
 * to pause all of them, and reopening meant shipping a build they may not have.
 *
 * Reversible on purpose, and so with no confirmation step: the button that
 * undoes it is the same button, in the same place, with the other label.
 */
export async function setFeedbackState(formData: FormData): Promise<void> {
  const claims = await currentClaimsLive()
  if (!claims) return
  if (actionRefusal('mark', claims.uid)) return
  const slug = String(formData.get('slug') ?? '')
  const open = String(formData.get('open') ?? '') === 'true'
  if (!slug) return
  // Owner-scoped by the query itself, as every other write on a live project
  // here is: the slug arrives from a form and authorises nothing on its own.
  const project = getProjectForEdit(slug, claims.uid)
  if (!project) return
  updateProject(project.id, { feedbackState: open ? 'open' : 'closed' })
  revalidatePath(`/p/${slug}`)
  revalidatePath(`/p/${slug}/versions`)
  revalidatePath(`/p/${slug}/playtest`)
  revalidatePath('/discover')
}

/* --------------------------------------------------------- versions on a live project */

const NewVersion = z.object({
  slug: z.string().min(1),
  versionLabel: z.string().trim().min(1, 'Name the build.').max(60, 'Keep the build name to 60 characters.'),
  // The changelog's counter says 2000, so that is the limit that holds.
  changelog: z
    .string()
    .trim()
    .min(20, 'Say what changed. A build with no changelog costs every past reviewer a re-read.')
    .max(2000, 'Keep the changelog to 2000 characters. Past reviewers read it before they look again.'),
  buildUrl: HttpsUrl.or(z.literal('')).optional(),
})

export async function postVersion(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return { status: 'error', message: 'Sign in first.' }
  const held = actionRefusal('version', claims.uid)
  if (held) return { status: 'error', message: held }

  const parsed = NewVersion.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorState(parsed.error.issues, 'This build was not posted.')

  const project = getProjectForEdit(parsed.data.slug, claims.uid)
  if (!project) return { status: 'error', message: 'Only the creator can post a build here.' }

  const versionId = addVersion({
    projectId: project.id,
    versionLabel: parsed.data.versionLabel,
    changelogMd: parsed.data.changelog,
    buildUrl: parsed.data.buildUrl && parsed.data.buildUrl.length > 0 ? parsed.data.buildUrl : null,
    makeCurrent: true,
  })

  // No `project_updates` row is written here. One used to be, with the build's
  // own name as its title and its changelog as its body, and the timeline
  // renders a version's updates nested under the version — so a build posted
  // from this form printed its name twice and its changelog twice, while a
  // build posted through the wizard printed each once. A devlog entry is a
  // second thing to say about a build, and it belongs to a field a creator
  // fills in, not to a copy of the field beside it.

  // Closed means closed on a build. The project header tells readers that a
  // new build reopens it, and this is the line that makes that true.
  const reopened = project.feedbackState === 'closed'
  if (reopened) updateProject(project.id, { feedbackState: 'open' })

  // Follow is the promise to hear about the next build. Nothing sent it, so a
  // follower's only way to learn about one was to come back and look.
  const followers = all<{ user_id: string }>(
    `SELECT user_id FROM project_follows WHERE project_id = ? AND notify IN ('all', 'versions')`,
    [project.id],
  ).map((row) => row.user_id)
  const told = notifyMany(followers, {
    kind: 'new_version',
    actorId: claims.uid,
    subjectType: 'project_version',
    subjectId: versionId,
    title: `${project.title} has a new build: ${parsed.data.versionLabel}`,
    url: `/p/${project.slug}/versions`,
  })

  revalidatePath(`/p/${parsed.data.slug}/versions`)
  revalidatePath(`/p/${parsed.data.slug}`)
  const sentences = [
    'Build posted.',
    reopened ? 'Feedback is open again, on this build.' : null,
    told > 0 ? `${String(told)} ${told === 1 ? 'follower was' : 'followers were'} told.` : null,
    'Everyone who reviewed an earlier build can now see what changed.',
  ]
  return { status: 'success', message: sentences.filter((line) => line !== null).join(' ') }
}

/* ------------------------------------------------------------------ playtest */

const Round = z.object({
  slug: z.string().min(1),
  title: z
    .string()
    .trim()
    .min(6, 'Name the round, so a tester knows what they are signing up for.')
    .max(120, 'Keep the round name to 120 characters.'),
  brief: z.string().trim().max(2000, 'Keep the brief to 2000 characters.').optional(),
  // "Leave it blank for an open round", the field says. A blank field posts an
  // empty string, which coerced to 0 and failed the minimum, so an open round
  // could not be created at all.
  seats: z.preprocess(
    (value) => (typeof value === 'string' && value.trim().length === 0 ? undefined : value),
    z.coerce
      .number({ invalid_type_error: 'Seats is a whole number, or blank for an open round.' })
      .int('Seats is a whole number, or blank for an open round.')
      .min(1, 'A round needs at least one seat, or leave it blank for an open round.')
      .max(200, 'Two hundred seats is the most one round can hold.')
      .optional(),
  ),
})

const ROUND_TASK_MAX = 200

export async function createRound(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return { status: 'error', message: 'Sign in first.' }
  const held = actionRefusal('round', claims.uid)
  if (held) return { status: 'error', message: held }

  const parsed = Round.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorState(parsed.error.issues, 'This round was not created.')

  const project = getProjectForEdit(parsed.data.slug, claims.uid)
  if (!project) return { status: 'error', message: 'Only the creator can open a round here.' }

  const tasks = formData
    .getAll('task')
    .map(String)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .slice(0, 10)

  if (tasks.length === 0) {
    return {
      status: 'error',
      message: 'This round was not created.',
      fieldErrors: {
        task: 'Write at least one task. Testers report per task, and a round with no tasks collects opinions rather than outcomes.',
      },
    }
  }
  if (tasks.some((task) => task.length > ROUND_TASK_MAX)) {
    return {
      status: 'error',
      message: 'This round was not created.',
      fieldErrors: {
        task: `Keep each task to ${String(ROUND_TASK_MAX)} characters. A task is one thing to try; the brief carries the context.`,
      },
    }
  }

  createPlaytestRound({
    projectId: project.id,
    createdBy: claims.uid,
    versionId: project.currentVersion?.id ?? null,
    title: parsed.data.title,
    briefMd: parsed.data.brief && parsed.data.brief.length > 0 ? parsed.data.brief : null,
    seats: parsed.data.seats ?? null,
    tasks: tasks.map((title) => ({ title, instructions: null, successHint: null, isRequired: true })),
  })

  revalidatePath(`/p/${parsed.data.slug}/playtest`)
  return { status: 'success', message: 'Round opened. Share the project link and testers can join it.' }
}

export async function joinPlaytestRound(formData: FormData): Promise<void> {
  const claims = await currentClaimsLive()
  if (!claims) return
  if (actionRefusal('mark', claims.uid)) return
  const roundId = String(formData.get('roundId') ?? '')
  const slug = String(formData.get('slug') ?? '')
  if (!roundId) return
  // joinRound refuses a closed or full round rather than silently seating an
  // extra tester. This action has no form state to report into, so the refusal
  // is swallowed and the revalidate shows the round as it really is.
  try {
    joinRound(roundId, claims.uid)
  } catch {
    // The page re-renders with the seat count and status that caused the refusal.
  }
  if (slug) revalidatePath(`/p/${slug}/playtest`)
}

/** The report form's limits: the minutes field's `max` and the note's counter. */
const REPORT_MINUTES_MAX = 600
const REPORT_NOTE_MAX = 600

export async function reportTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const claims = await currentClaimsLive()
  if (!claims) return { status: 'error', message: 'Sign in first.' }
  const held = actionRefusal('report', claims.uid)
  if (held) return { status: 'error', message: held }

  const roundId = String(formData.get('roundId') ?? '')
  const taskId = String(formData.get('taskId') ?? '')
  const slug = String(formData.get('slug') ?? '')
  const outcome = String(formData.get('outcome') ?? '')
  const note = String(formData.get('note') ?? '').trim()
  const minutesRaw = String(formData.get('minutes') ?? '').trim()

  if (!roundId || !taskId) return { status: 'error', message: 'That task is no longer here.' }
  // The two ids arrive separately, so they are checked against each other: a
  // task from another round would be tallied under this one's protocol.
  if (!get(`SELECT 1 AS hit FROM test_round_tasks WHERE id = ? AND round_id = ?`, [taskId, roundId])) {
    return { status: 'error', message: 'That task is not part of this round. Reload the page to see the round as it is now.' }
  }
  if (!isTaskOutcome(outcome)) {
    return {
      status: 'error',
      message: 'This report was not saved.',
      fieldErrors: { outcome: 'Say how the task went. That answer is what makes results comparable across testers.' },
    }
  }
  // The field's own limits, which the browser does not enforce on a form that
  // shows its own errors.
  const minutes = minutesRaw.length > 0 ? Number(minutesRaw) : null
  if (minutes !== null && !(Number.isFinite(minutes) && minutes >= 0 && minutes <= REPORT_MINUTES_MAX)) {
    return {
      status: 'error',
      message: `This report was not saved. Minutes it took is a number from 0 to ${String(REPORT_MINUTES_MAX)}; leave it blank if you did not time it.`,
    }
  }
  if (note.length > REPORT_NOTE_MAX) {
    return {
      status: 'error',
      message: `This report was not saved. Keep what happened to ${String(REPORT_NOTE_MAX)} characters: where you got stuck and what you expected is enough.`,
    }
  }

  let invitationId: string
  try {
    invitationId = joinRound(roundId, claims.uid)
  } catch (error) {
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'That round is not taking reports.',
    }
  }
  recordTaskResult({
    invitationId,
    taskId,
    outcome,
    durationMs: minutes !== null && minutes > 0 ? Math.round(minutes * 60_000) : null,
    difficulty: null,
    note: note.length > 0 ? note : null,
  })

  if (slug) revalidatePath(`/p/${slug}/playtest`)
  return { status: 'success', message: 'Report saved.' }
}

/* -------------------------------------------------------------------- shared */

function fieldErrorState(issues: readonly z.ZodIssue[], message: string): FormState {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return { status: 'error', message, fieldErrors }
}

/**
 * The wizard writes drafts and nothing else. The page stops rendering its steps
 * once a project is live, and this is where that is true: the back button used
 * to reach a last step that offered to publish a live project a second time.
 */
async function ownedDraft(
  formData: FormData,
): Promise<{ draftId: string; ownerId: string; typeSlug: string } | { error: FormState }> {
  const claims = await currentClaimsLive()
  if (!claims) return { error: { status: 'error', message: 'Sign in to post a project.' } }
  const draftId = String(formData.get('draft') ?? '')
  if (!draftId) return { error: { status: 'error', message: 'That draft is no longer here. Start again from the first step.' } }
  const project = getProjectById(draftId)
  if (!project || String(project.owner_id) !== claims.uid) {
    return { error: { status: 'error', message: 'That draft belongs to someone else.' } }
  }
  if (project.status !== 'draft') return { error: { status: 'error', message: PUBLISHED } }
  // The row's kind, not the hidden field's: the page holds the same rule, and a
  // step posted with another `type` would file the ask under that kind's areas.
  return { draftId, ownerId: claims.uid, typeSlug: String(project.project_type_id) }
}
