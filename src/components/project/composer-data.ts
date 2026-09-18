/**
 * Builds the composer's props from the taxonomy and the project row, with any
 * notes the reviewer wrote and has not posted yet, and says who may open it.
 *
 * Server-only helper, shared by the project page (which opens the composer in a
 * dialog) and the composer route (which renders the same form as a page), so
 * the two can never ask a reviewer different questions. The composer's actions
 * read the same gate and the same filing defaults, so the form and the server
 * cannot disagree about either.
 */

import { z } from 'zod'
import {
  ACTIONABILITY_KEYS,
  ACTIONABILITY_LEVELS,
  RATING_SCALE_MAX,
  SEVERITY_KEYS,
  SEVERITY_LEVELS,
  axesFor,
  categoriesFor,
  categoryId,
  isProjectTypeSlug,
  promptsFor,
  type AxisDef,
  type AxisFamily,
  type ProjectTypeSlug,
} from '@/lib/taxonomy'
import type { ProjectAskView, ProjectDetail } from '@/lib/types'
import { safeHref } from '@/lib/utils'
import { overlapCount } from '@/server/ai/text'
import { getBlindDraft } from '@/server/queries/project-surface'
import { DRAFT_SCHEMA_VERSION, getComposerDraft } from '@/server/queries/drafts'
import { SAVED_NOTE_MAX, type ComposerAxis, type ComposerData, type SavedNote } from '@/components/composer/types'

/* ------------------------------------------------------------- the gate --- */

/** Why a viewer may not write a review of a project. */
export type ReviewRefusal = 'own' | 'closed' | 'invite'

/**
 * Why this viewer cannot review the project, or null when they can.
 *
 * `invite_only` means what the project header says it means, "Invited
 * reviewers only": the composer opens for the reviewers the creator chose
 * (`viewer.invitedToReview`) and for nobody else. It used to be treated
 * exactly like `open`, so the label promised a closed door that anyone with
 * the link could walk through.
 */
export function reviewRefusal(project: ProjectDetail): ReviewRefusal | null {
  if (project.viewer.isOwner || project.viewer.canEdit) return 'own'
  if (project.feedbackState === 'closed') return 'closed'
  if (project.feedbackState === 'invite_only' && !project.viewer.invitedToReview) return 'invite'
  return null
}

/* --------------------------------------------------- where a note files --- */

/**
 * The category a note under each area is filed in until the reviewer moves it.
 *
 * Written out per type, because one family means different things in
 * different media: friction on a game is the difficulty curve, on a web app
 * it is the flow. Every area used to start on the type's first category, so
 * all five areas of a web app opened on "Signup and onboarding" and every note
 * nobody re-filed was counted there.
 */
const AREA_CATEGORY: Readonly<Record<ProjectTypeSlug, Readonly<Record<string, string>>>> = {
  game: {
    fun: 'core_loop',
    balance: 'difficulty_curve',
    game_feel: 'controls',
    onboarding: 'tutorial',
    performance: 'performance',
  },
  web_app: {
    job_fit: 'core_task',
    time_to_value: 'signup',
    flow_friction: 'friction',
    trust_clarity: 'confusion',
    reliability: 'performance',
  },
  mobile_app: {
    first_session: 'install',
    thumb_ergonomics: 'gestures',
    platform_fit: 'nav_structure',
    flow_friction: 'friction',
    battery: 'performance',
  },
  website: {
    message_clarity: 'hero',
    credibility: 'social_proof',
    scan_find: 'navigation',
    conversion_pull: 'cta',
    craft: 'visual_design',
  },
  video: {
    hook: 'hook',
    pacing: 'pacing',
    story_clarity: 'structure',
    production_craft: 'audio_mix',
    payoff: 'end_screen',
  },
  business_idea: {
    problem_sharpness: 'problem_definition',
    insight: 'moat',
    willingness_to_pay: 'pricing_model',
    path_to_100: 'gtm',
    risk_honesty: 'assumptions',
  },
  hardware: {
    problem_form_fit: 'industrial_design',
    ergonomics: 'ergonomics',
    build_durability: 'materials',
    manufacturability: 'dfm',
    daily_use: 'power',
  },
  design: {
    concept_strength: 'concept',
    hierarchy: 'composition',
    craft: 'spacing',
    tone_fit: 'brand_tone',
    systemic_durability: 'states',
  },
  writing: {
    opening_pull: 'opening',
    structure: 'structure',
    line_quality: 'line_edit',
    reader_clarity: 'jargon',
    ending: 'ending',
  },
  api_tool: {
    time_to_first_call: 'quickstart',
    ergonomics: 'naming',
    docs_quality: 'docs',
    debuggability: 'error_messages',
    production_readiness: 'versioning',
  },
}

/**
 * For an area the table does not name: the universal category that carries
 * the same question on every type. `type_unique` has no universal twin, so it
 * falls through to the type's own first category.
 */
const FAMILY_CATEGORY: Readonly<Partial<Record<AxisFamily, string>>> = {
  value: 'missing',
  comprehension: 'confusion',
  friction: 'friction',
  execution: 'bug',
}

/** The category a note on `axis` is filed in when the reviewer does not choose one. */
export function defaultCategoryFor(typeSlug: string, axis: AxisDef): string {
  const offered = new Set(categoriesFor(typeSlug).map((c) => c.key))
  const named = isProjectTypeSlug(typeSlug) ? AREA_CATEGORY[typeSlug][axis.key] : undefined
  if (named && offered.has(named)) return named
  const family = FAMILY_CATEGORY[axis.family]
  if (family && offered.has(family)) return family
  return categoriesFor(typeSlug)[0]?.key ?? 'confusion'
}

/* -------------------------------------- what a posted note carries --- */

/**
 * The ask a note answers, by the test the coach already shows the reviewer
 * under the note: it shares at least two content words with the ask's
 * question. Among several asks, the one it shares most with, and on a tie the
 * one filed under the note's category. The category on its own is not an
 * answer: the composer preselects one for every area, so a match there says
 * what the form chose, not what the reviewer wrote.
 */
export function askAnsweredBy(
  asks: readonly Pick<ProjectAskView, 'id' | 'prompt' | 'categoryId'>[],
  typeSlug: string,
  categoryKey: string,
  body: string,
): string | null {
  const filedUnder = categoryId(typeSlug, categoryKey)
  let best: { id: string; shared: number; filed: boolean } | null = null
  for (const ask of asks) {
    const shared = overlapCount(body, ask.prompt)
    if (shared < 2) continue
    const filed = ask.categoryId === filedUnder
    if (!best || shared > best.shared || (shared === best.shared && filed && !best.filed)) {
      best = { id: ask.id, shared, filed }
    }
  }
  return best?.id ?? null
}

/**
 * The numbered or bulleted steps in a note, when there are at least two. The
 * composer has one box per area, so a reviewer who marks a note "Prescription
 * with an artifact" writes the steps in it, and without them stored beside the
 * note the label was quietly downgraded on the way in.
 */
export function stepsIn(body: string): string | null {
  const steps = body
    .split('\n')
    .filter((line) => /^\s*(?:\d+[.)]|[-*•])\s+\S/.test(line))
    .map((line) => line.trim())
  return steps.length >= 2 ? steps.join('\n') : null
}

/** The build the composer offers to open, exactly as the form is given it. */
function buildUrlFor(project: ProjectDetail): string | null {
  return project.currentVersion?.buildUrl ?? project.links[0]?.url ?? null
}

/**
 * Whether the composer has a build to open at all. The dwell floor caps a
 * review whose build was never opened, and the composer can only record the
 * opening from its own link. With no build there is no link and nothing to
 * have opened: the work is on the project page, and only the time half of the
 * floor can apply. Read from the URL and the check the form renders the link
 * with, so the form and the action cannot disagree.
 */
export function hasBuildToOpen(project: ProjectDetail): boolean {
  return safeHref(buildUrlFor(project)) !== null
}

/* ------------------------------------------ notes kept between visits --- */

/**
 * What the composer saves while a reviewer writes, and what it gets back.
 * The store keeps it as an opaque blob (see `@/server/queries/drafts`), so it
 * is checked on the way in and again on the way out.
 */
export const SavedNotesPayload = z.object({
  seconds: z.number().int().min(0).max(60 * 60 * 8),
  notes: z
    .record(
      z.string().max(64),
      z.object({
        body: z.string().max(SAVED_NOTE_MAX),
        rating: z.number().int().min(1).max(RATING_SCALE_MAX).nullable(),
        category: z.string().max(64),
        severity: z.string().max(32),
        actionability: z.string().max(32),
      }),
    )
    .refine((notes) => Object.keys(notes).length <= 12, 'More areas than any kind of project has.'),
})

export type SavedNotesPayload = z.infer<typeof SavedNotesPayload>

/** Nothing typed and nothing rated: not worth keeping, or bringing back. */
export function isEmptyNotes(notes: SavedNotesPayload['notes']): boolean {
  return Object.values(notes).every((note) => note.body.trim().length === 0 && note.rating === null)
}

/**
 * The reviewer's unposted notes on this project, fitted to the form as it is
 * now: an area the type no longer has is dropped, and a filing choice it no
 * longer offers falls back to that area's default.
 */
function savedNotesFor(
  project: ProjectDetail,
  viewerId: string,
  axes: readonly ComposerAxis[],
): { notes: Record<string, SavedNote>; seconds: number; savedAt: number } | null {
  const draft = getComposerDraft(viewerId, project.id)
  if (!draft || draft.schemaVersion !== DRAFT_SCHEMA_VERSION) return null
  const parsed = SavedNotesPayload.safeParse(draft.payload)
  if (!parsed.success || isEmptyNotes(parsed.data.notes)) return null

  const offered = new Set(categoriesFor(project.typeSlug).map((c) => c.key))
  const notes: Record<string, SavedNote> = {}
  for (const axis of axes) {
    const saved = parsed.data.notes[axis.key]
    if (!saved) continue
    notes[axis.key] = {
      body: saved.body,
      rating: saved.rating,
      category: offered.has(saved.category) ? saved.category : axis.defaultCategory,
      severity: (SEVERITY_KEYS as readonly string[]).includes(saved.severity) ? saved.severity : 'minor',
      actionability: (ACTIONABILITY_KEYS as readonly string[]).includes(saved.actionability)
        ? saved.actionability
        : 'suggestion',
    }
  }
  return Object.keys(notes).length > 0 ? { notes, seconds: parsed.data.seconds, savedAt: draft.savedAt } : null
}

/* ------------------------------------------------------- the form's data --- */

export function buildComposerData(project: ProjectDetail, viewerId: string | null): ComposerData {
  const categories = categoriesFor(project.typeSlug)
  const prompts = promptsFor(project.typeSlug)

  const axes: ComposerAxis[] = axesFor(project.typeSlug).map((axis, index) => ({
    key: axis.key,
    label: axis.label,
    definition: axis.definition,
    lowLabel: axis.lowLabel,
    highLabel: axis.highLabel,
    prompt: prompts[index] ?? null,
    defaultCategory: defaultCategoryFor(project.typeSlug, axis),
  }))

  const draft = viewerId ? getBlindDraft(project.id, viewerId) : undefined
  const saved = viewerId ? savedNotesFor(project, viewerId, axes) : null

  return {
    project: {
      id: project.id,
      slug: project.slug,
      title: project.title,
      typeLabel: project.typeLabel,
      ownerName: project.owner.displayName,
      askPrompt: project.asks[0]?.prompt ?? null,
      askDetail: project.asks[0]?.detailMd ?? null,
      buildUrl: buildUrlFor(project),
      versionLabel: project.currentVersion?.label ?? null,
    },
    axes,
    categories: categories.map((c) => ({ key: c.key, label: c.label, definition: c.description })),
    severities: SEVERITY_LEVELS.map((s) => ({ key: s.key, label: s.label, definition: s.definition })),
    actionabilities: ACTIONABILITY_LEVELS.map((a) => ({
      key: a.key,
      label: a.label,
      definition: a.definition,
    })),
    impression: draft?.headline ?? null,
    // The clock carries on from wherever it stopped last, on either step.
    secondsSoFar: Math.max(draft?.dwellSeconds ?? 0, saved?.seconds ?? 0),
    ratingScale: RATING_SCALE_MAX,
    savedNotes: saved?.notes ?? null,
    savedAt: saved?.savedAt ?? null,
  }
}
