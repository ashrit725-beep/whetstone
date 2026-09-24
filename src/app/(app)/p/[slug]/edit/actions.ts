'use server'

/**
 * Editing a project that is already live.
 *
 * The wizard writes a draft and stops caring about it the moment it is
 * published, which left a creator with no way to fix a typo in a title, sharpen
 * an ask that was not landing, or change what kind of help they are asking for.
 * These are the same four steps, posted by the same four step components, with
 * two differences that matter:
 *
 *   - the row is already published, so every save is live immediately and the
 *     step returns to the project's own edit page rather than walking forward;
 *   - the slug is never recomputed. `/p/<slug>` is the address in every link,
 *     bookmark, notification and review permalink already written, so a project
 *     renamed here keeps the address it was published under.
 *
 * Authorisation is per call and from the session, not from the form: the
 * project id arrives in a hidden field like every other step, and
 * `updateProject` is `WHERE id = ?` with no owner predicate, so it is checked
 * against the caller before anything is written.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
// Authorises from `claims.uid`, so the claims must come from a session that is
// still live: a signature alone cannot tell a revoked cookie from a good one.
import { currentClaimsLive } from '@/server/queries/auth'
import { canManageProject, projectAccess } from '@/server/queries/access'
import { actionRefusal } from '@/server/actions/limits'
import { HttpsUrl } from '@/server/api/schema'
import type { FormState } from '@/components/ui/form'
import { GRIT_STAGES, NEED_KINDS, categoriesFor, categoryId } from '@/lib/taxonomy'
import { addVersion, getProjectById, updateProject } from '@/server/repos/projects'
import { ensureTags, recountTags, tagIdsForProject } from '@/server/repos/tags'
import { get, run } from '@/server/db/client'

/**
 * The field rules the wizard's steps hold, applied to the same components here.
 * They are written out rather than imported because the wizard's copies live
 * inside a `'use server'` module, which may only export functions. The two are
 * meant to stay identical: the messages are the ones the step prints.
 */
const Grit = z.coerce
  .number()
  .refine((n) => GRIT_STAGES.some((s) => s.grit === n), 'Pick the stage this build is actually at.')

const Basics = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Give the project a name of at least three characters.')
    .max(120, 'Keep the name to 120 characters. The Discover row prints it on one line.'),
  tagline: z.string().trim().max(140, 'Keep the line to 140 characters. It sits under the name on one row.').optional(),
  summary: z
    .string()
    .trim()
    .min(80, 'Write at least eighty characters. Reviewers decide from this whether they can help you.')
    .max(2000, 'Keep it to 2000 characters. The detail can go in the ask and the build notes.'),
  grit: Grit,
})

const Ask = z.object({
  ask: z
    .string()
    .trim()
    .min(30, 'Write the one question you most want answered. Thirty characters is the floor.')
    .max(600, 'Keep the question to 600 characters. One question, asked plainly, gets answered.'),
  ignore: z.string().trim().max(400, 'Keep this to 400 characters.').optional(),
})

const Build = z.object({
  versionLabel: z
    .string()
    .trim()
    .min(1, 'Name the build, the way you name it yourself.')
    .max(60, 'Keep the build name to 60 characters.'),
  buildUrl: HttpsUrl.or(z.literal('')).optional(),
  changelog: z.string().trim().max(2000, 'Keep the notes to 2000 characters.').optional(),
})

const NEED_KEYS: ReadonlySet<string> = new Set(NEED_KINDS.map((n) => n.key))
const TAGS_MAX = 8
const TAG_CHARS_MAX = 32

interface Editing {
  readonly id: string
  readonly slug: string
  readonly typeSlug: string
  readonly userId: string
}

/**
 * The project this step is editing, when the caller may change it.
 *
 * Collaborators are admitted alongside the owner, because they can already post
 * a build; a draft is turned away, because the posting steps own it until it is
 * published and two surfaces writing the same unfinished row would disagree.
 */
async function editable(formData: FormData): Promise<Editing | { error: FormState }> {
  const claims = await currentClaimsLive()
  if (!claims) return { error: { status: 'error', message: 'Sign in to edit this project.' } }

  const id = String(formData.get('draft') ?? '')
  const row = id ? getProjectById(id) : undefined
  const access = row ? projectAccess(String(row.id)) : undefined
  if (!row || !access || !canManageProject(access, claims.uid)) {
    return { error: { status: 'error', message: 'That project is not yours to edit.' } }
  }
  if (access.status === 'draft') {
    return {
      error: {
        status: 'error',
        message: 'This project is still a draft, so it is finished in the posting steps rather than here.',
      },
    }
  }
  // The row's kind, not the hidden field's: an edited `type` would file the ask
  // under another kind's areas.
  return {
    id: String(row.id),
    slug: String(row.slug),
    typeSlug: String(row.project_type_id),
    userId: claims.uid,
  }
}

/** Back to the page that lists every field, with the save named in the address. */
function done(slug: string, saved: string): never {
  revalidatePath(`/p/${slug}`)
  // The feed row prints the name, the line under it, the grit and what would
  // help, so an edit that leaves Discover holding the old words has only half
  // happened. Every step revalidates it rather than each one deciding.
  revalidatePath('/discover')
  redirect(`/p/${slug}/edit?saved=${saved}`)
}

function fieldErrorState(issues: readonly z.ZodIssue[], message: string): FormState {
  const fieldErrors: Record<string, string> = {}
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return { status: 'error', message, fieldErrors }
}

/* ------------------------------------------------------------ the basics -- */

export async function editBasics(_prev: FormState, formData: FormData): Promise<FormState> {
  const project = await editable(formData)
  if ('error' in project) return project.error

  const parsed = Basics.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorState(parsed.error.issues, 'These details were not saved.')
  const held = actionRefusal('project', project.userId)
  if (held) return { status: 'error', message: held }

  const { title, tagline, summary, grit } = parsed.data
  updateProject(project.id, {
    title,
    tagline: tagline && tagline.length > 0 ? tagline : null,
    summaryMd: summary,
    // The scale posts the numeral and the stage key is derived from it, so the
    // two cannot disagree on a published row any more than on a draft.
    stageKey: GRIT_STAGES.find((s) => s.grit === grit)?.key ?? 'concept',
  })
  done(project.slug, 'details')
}

/* --------------------------------------------------------------- the ask -- */

export async function editAsk(_prev: FormState, formData: FormData): Promise<FormState> {
  const project = await editable(formData)
  if ('error' in project) return project.error

  const parsed = Ask.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorState(parsed.error.issues, 'The ask was not saved.')

  const area = String(formData.get('askCategory') ?? '')
  if (area.length > 0 && !categoriesFor(project.typeSlug).some((c) => c.key === area)) {
    return {
      status: 'error',
      message: 'The ask was not saved.',
      fieldErrors: { askCategory: 'Pick one of the areas in the list, or no particular area.' },
    }
  }
  const held = actionRefusal('project', project.userId)
  if (held) return { status: 'error', message: held }

  // The ask is rewritten in place rather than deleted and reinserted: reviewers'
  // answers hang off `feedback`, not off this row, but the ask's own id is what
  // a category-scoped review was filed against.
  const existing = get<{ id: string }>(
    `SELECT id FROM project_asks WHERE project_id = ? ORDER BY sort_order, created_at LIMIT 1`,
    [project.id],
  )
  const category = area.length > 0 ? categoryId(project.typeSlug, area) : null
  const detail = parsed.data.ignore && parsed.data.ignore.length > 0 ? parsed.data.ignore : null
  if (existing) {
    run(`UPDATE project_asks SET category_id = ?, prompt = ?, detail_md = ? WHERE id = ?`, [
      category,
      parsed.data.ask,
      detail,
      existing.id,
    ])
  } else {
    run(
      `INSERT INTO project_asks (id, project_id, category_id, prompt, detail_md, is_required, sort_order, answer_count, created_at)
       VALUES (?, ?, ?, ?, ?, 1, 0, 0, ?)`,
      [crypto.randomUUID(), project.id, category, parsed.data.ask, detail, Date.now()],
    )
  }
  done(project.slug, 'ask')
}

/* ------------------------------------------------------- what would help -- */

export async function editNeeds(_prev: FormState, formData: FormData): Promise<FormState> {
  const project = await editable(formData)
  if ('error' in project) return project.error

  // Keys from the vocabulary only, once each. Anything else is not a box the
  // step offers, and `project_needs` would refuse it halfway through the write.
  const needs = [...new Set(formData.getAll('need').map(String))].filter((n) => NEED_KEYS.has(n))
  if (needs.length === 0) {
    return {
      status: 'error',
      message: 'This was not saved.',
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
  if (tagProblem) return { status: 'error', message: 'This was not saved.', fieldErrors: { tags: tagProblem } }
  const held = actionRefusal('project', project.userId)
  if (held) return { status: 'error', message: held }

  run(`DELETE FROM project_needs WHERE project_id = ?`, [project.id])
  for (const need of needs) {
    run(`INSERT INTO project_needs (project_id, need_key, detail, created_at) VALUES (?, ?, NULL, ?)`, [
      project.id,
      need,
      Date.now(),
    ])
  }

  const previousTags = tagIdsForProject(project.id)
  run(`DELETE FROM project_tags WHERE project_id = ?`, [project.id])
  const nextTags = tagLabels.length > 0 ? ensureTags(tagLabels) : []
  for (const tagId of nextTags) {
    run(`INSERT OR IGNORE INTO project_tags (project_id, tag_id, created_at) VALUES (?, ?, ?)`, [
      project.id,
      tagId,
      Date.now(),
    ])
  }
  // The tags it lost and the ones it gained both need their counts redone.
  recountTags([...previousTags, ...nextTags])
  done(project.slug, 'help')
}

/* ------------------------------------------------------------- the build -- */

export async function editBuild(_prev: FormState, formData: FormData): Promise<FormState> {
  const project = await editable(formData)
  if ('error' in project) return project.error

  const parsed = Build.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return fieldErrorState(parsed.error.issues, 'The build was not saved.')
  const held = actionRefusal('project', project.userId)
  if (held) return { status: 'error', message: held }

  const buildUrl = parsed.data.buildUrl && parsed.data.buildUrl.length > 0 ? parsed.data.buildUrl : null
  const changelog = parsed.data.changelog && parsed.data.changelog.length > 0 ? parsed.data.changelog : null

  // This corrects the build that is up, the way the wizard's step does. Posting
  // a *new* build is a different act with its own page: it reopens feedback and
  // tells every follower, and correcting a link should do neither.
  const current = get<{ id: string }>(
    `SELECT id FROM project_versions WHERE project_id = ? ORDER BY is_current DESC, created_at DESC LIMIT 1`,
    [project.id],
  )
  if (current) {
    run(`UPDATE project_versions SET version_label = ?, build_url = ?, changelog_md = ? WHERE id = ?`, [
      parsed.data.versionLabel,
      buildUrl,
      changelog,
      current.id,
    ])
  } else {
    addVersion({
      projectId: project.id,
      versionLabel: parsed.data.versionLabel,
      changelogMd: changelog,
      buildUrl,
      makeCurrent: true,
    })
  }
  revalidatePath(`/p/${project.slug}/versions`)
  done(project.slug, 'build')
}
