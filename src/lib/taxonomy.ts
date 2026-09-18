/**
 * Whetstone taxonomy — the product IP, encoded once.
 *
 * design/TAXONOMY.md is the prose source. This file is the machine source, and
 * both the seed script and the feedback composer import it, so a rating axis
 * that exists here exists in the database and in the UI with the same key, the
 * same label and the same one-line definition.
 *
 * Three things live here:
 *   1. The ten project types, each with five rating axes, a category vocabulary
 *      and the reviewer elicitation prompts the composer asks.
 *   2. The vocabularies a single feedback item is graded on: severity,
 *      actionability, effort, and the grit stage scale.
 *   3. The tuned constants behind the reputation algorithm and the Discover
 *      ranking formula, so those two implementations cannot drift apart from
 *      the document that specifies them.
 *
 * Identifier convention, relied on by the seed script and by every repository:
 *   project_type.id      = the type slug            ('game')
 *   rating_axis.id       = '<typeSlug>:<axisKey>'   ('game:fun')
 *   feedback_category.id = '<typeSlug>:<catKey>'    ('game:core_loop')
 * The schema's composite foreign keys already prove a category belongs to its
 * project's type; the prefix makes that readable in a shell as well.
 */

/* ------------------------------------------------------------------------- *
 * 0. The spine
 * ------------------------------------------------------------------------- */

export const AXIS_FAMILIES = [
  { key: 'value', label: 'Value', question: 'Is this worth someone’s time or money?' },
  { key: 'comprehension', label: 'Comprehension', question: 'Do I understand it without being told?' },
  { key: 'friction', label: 'Friction', question: 'What actively hurts?' },
  { key: 'execution', label: 'Execution', question: 'Is the craft there?' },
  { key: 'type_unique', label: 'Type-unique', question: 'The thing only this medium has.' },
] as const

export type AxisFamily = (typeof AXIS_FAMILIES)[number]['key']

export interface AxisDef {
  /** Stable within a project type. Combined with the slug it forms the row id. */
  readonly key: string
  readonly label: string
  /** One line, rendered under the label in the composer. */
  readonly definition: string
  readonly family: AxisFamily
  /** Written anchors for the endpoints. Bare stars are banned. */
  readonly lowLabel: string
  readonly highLabel: string
}

export interface CategoryDef {
  readonly key: string
  readonly label: string
  readonly description: string
}

export interface ProjectTypeDef {
  readonly slug: string
  readonly label: string
  readonly description: string
  /** lucide-react icon name. */
  readonly icon: string
  /** Drives how project_media renders on the detail page. */
  readonly embedKind: 'none' | 'iframe' | 'video' | 'gallery' | 'build_download'
  readonly sortOrder: number
  readonly axes: readonly AxisDef[]
  readonly categories: readonly CategoryDef[]
  /** Three to five questions the composer puts in front of a reviewer. */
  readonly prompts: readonly string[]
  /** Per-type wording for the five grit stages, keyed by GritStageKey. */
  readonly stageLabels: Readonly<Record<GritStageKey, string>>
  /**
   * The anchor the composer requires before an issue can be submitted.
   * `null` means an anchor is offered but never blocking.
   */
  readonly requiredAnchor: 'timecode' | null
}

export const PROJECT_TYPE_SLUGS = [
  'game',
  'web_app',
  'mobile_app',
  'website',
  'video',
  'business_idea',
  'hardware',
  'design',
  'writing',
  'api_tool',
] as const

export type ProjectTypeSlug = (typeof PROJECT_TYPE_SLUGS)[number]

/* ------------------------------------------------------------------------- *
 * 1. Grit stages
 * ------------------------------------------------------------------------- *
 * One scale across all ten types. The numeral is the product's organising data
 * structure: it is the Discover filter, the project-detail rail, the composer
 * selector and the profile history strip. Stroke and spacing are carried here
 * so the SVG hatch has exactly one source of truth.
 */

export const GRIT_STAGES = [
  {
    key: 'concept',
    grit: 120,
    label: 'Concept',
    definition: 'An idea written down. Nothing is built yet.',
    strokeWidth: 3,
    spacing: 16,
  },
  {
    key: 'prototype',
    grit: 400,
    label: 'Prototype',
    definition: 'Something runs. It proves one thing and breaks elsewhere.',
    strokeWidth: 2,
    spacing: 8,
  },
  {
    key: 'beta',
    grit: 1000,
    label: 'Beta',
    definition: 'Feature-complete enough that a stranger can use it unattended.',
    strokeWidth: 1.25,
    spacing: 4,
  },
  {
    key: 'release_candidate',
    grit: 3000,
    label: 'Release candidate',
    definition: 'Ship-shaped. Looking for the defect that would embarrass you.',
    strokeWidth: 0.75,
    spacing: 2,
  },
  {
    key: 'shipped',
    grit: 8000,
    label: 'Shipped',
    definition: 'Out in the world. Feedback now aims at the next version.',
    strokeWidth: 0.5,
    spacing: 1,
  },
] as const

export type GritStage = (typeof GRIT_STAGES)[number]
export type GritStageKey = GritStage['key']
export type GritValue = GritStage['grit']

export const GRIT_STAGE_KEYS = GRIT_STAGES.map((s) => s.key) as readonly GritStageKey[]

/* ------------------------------------------------------------------------- *
 * 2. Severity
 * ------------------------------------------------------------------------- *
 * The schema stores five values. design/TAXONOMY.md §2.1 names five levels
 * S0–S4 and carries praise outside the scale. The reconciliation, which the
 * repositories and the composer both honour:
 *
 *   blocker  S0    major  S1    minor  S2 (moderate and minor merged)
 *   nit      S3    praise no severity, the marker for kind = praise
 *
 * `weight` is the severity term used by the theme severity_score rollup.
 */

export const SEVERITY_LEVELS = [
  {
    key: 'blocker',
    code: 'S0',
    label: 'Blocker',
    definition: 'Prevents the core job entirely. No workaround.',
    weight: 8,
    rank: 0,
  },
  {
    key: 'major',
    code: 'S1',
    label: 'Major',
    definition: 'Core job completable, but badly damaged. The workaround costs real time.',
    weight: 4,
    rank: 1,
  },
  {
    key: 'minor',
    code: 'S2',
    label: 'Minor',
    definition: 'Noticeable defect or friction on a common path. A workaround exists.',
    weight: 1.5,
    rank: 2,
  },
  {
    key: 'nit',
    code: 'S3',
    label: 'Nit',
    definition: 'Cosmetic or taste. No functional impact.',
    weight: 0.5,
    rank: 3,
  },
  {
    key: 'praise',
    code: null,
    label: 'Keep this',
    definition: 'Something that works. Creators cut good things by accident between builds.',
    weight: 0,
    rank: 4,
  },
] as const

export type SeverityLevel = (typeof SEVERITY_LEVELS)[number]
export type SeverityKey = SeverityLevel['key']

export const SEVERITY_KEYS = SEVERITY_LEVELS.map((s) => s.key) as readonly SeverityKey[]

/* ------------------------------------------------------------------------- *
 * 3. Actionability
 * ------------------------------------------------------------------------- *
 * Orthogonal to severity and to specificity. A0 is not a lesser item: a
 * precisely located reaction is gold, and the reputation math treats it that
 * way. The schema's five values expand the document's four by splitting the
 * reaction level into an observation and a stated preference.
 */

export const ACTIONABILITY_LEVELS = [
  {
    key: 'observation',
    code: 'A0',
    label: 'Observation',
    definition: 'A located reaction. No change implied.',
    example: 'At 0:40 I lost the thread and checked my phone.',
    rank: 0,
  },
  {
    key: 'opinion',
    code: 'A1',
    label: 'Preference',
    definition: 'A judgment with a direction, but no named change.',
    example: 'The opening felt slower than the rest of the piece.',
    rank: 1,
  },
  {
    key: 'suggestion',
    code: 'A2',
    label: 'Directional',
    definition: 'Names what should change, not how.',
    example: 'Onboarding never teaches the dash.',
    rank: 2,
  },
  {
    key: 'actionable',
    code: 'A3',
    label: 'Specific change',
    definition: 'Names a concrete change a creator could make today.',
    example: 'Force a gap jump in room 2 so the dash is mandatory before the boss.',
    rank: 3,
  },
  {
    key: 'repro',
    code: 'A4',
    label: 'Prescription with an artifact',
    definition: 'A concrete change plus a usable artifact: steps, a patch, a redline.',
    example: 'Steps 1–4 below, plus the console output and a suggested diff.',
    rank: 4,
  },
] as const

export type ActionabilityLevel = (typeof ACTIONABILITY_LEVELS)[number]
export type ActionabilityKey = ActionabilityLevel['key']

export const ACTIONABILITY_KEYS = ACTIONABILITY_LEVELS.map((a) => a.key) as readonly ActionabilityKey[]

/* ------------------------------------------------------------------------- *
 * 4. Effort
 * ------------------------------------------------------------------------- *
 * Two independent estimates. The reviewer's guess is offered only above the
 * domain-credibility floor below; the creator sets theirs during triage, blind
 * to the reviewer's until they commit. The gap is the effort-calibration stat.
 */

export const EFFORT_LEVELS = [
  { key: 'xs', code: 'E0', label: 'Trivial', definition: 'Under 30 minutes. Copy, a constant, a toggle.', rank: 0 },
  { key: 's', code: 'E1', label: 'Small', definition: 'Hours. A local change.', rank: 1 },
  { key: 'm', code: 'E2', label: 'Medium', definition: 'Days. Touches several systems.', rank: 2 },
  { key: 'l', code: 'E3', label: 'Large', definition: 'Weeks. Structural.', rank: 3 },
  {
    key: 'xl',
    code: 'E4',
    label: 'Foundational',
    definition: 'Changes the premise: architecture, model, or business.',
    rank: 4,
  },
] as const

export type EffortLevel = (typeof EFFORT_LEVELS)[number]
export type EffortKey = EffortLevel['key']

/** Reviewers below this per-domain credibility are not offered an effort guess. */
export const EFFORT_GUESS_CREDIBILITY_FLOOR = 300

/* ------------------------------------------------------------------------- *
 * 5. Item kind and confidence
 * ------------------------------------------------------------------------- *
 * The schema has no `kind` column: kind is derivable from severity and
 * actionability, and a derived value cannot disagree with the row it came from.
 */

export const ITEM_KINDS = [
  { key: 'praise', label: 'Keep this', icon: 'BadgeCheck' },
  { key: 'bug', label: 'Bug', icon: 'Bug' },
  { key: 'issue', label: 'Issue', icon: 'TriangleAlert' },
  { key: 'idea', label: 'Idea', icon: 'Lightbulb' },
  { key: 'question', label: 'Question', icon: 'CircleQuestionMark' },
  { key: 'risk', label: 'Risk', icon: 'ShieldAlert' },
] as const

export type ItemKind = (typeof ITEM_KINDS)[number]['key']

export const REPRO_FREQUENCIES = [
  { key: 'always', label: 'Every time' },
  { key: 'often', label: 'Most times' },
  { key: 'once', label: 'Once' },
  { key: 'could-not-reproduce', label: 'Could not reproduce' },
] as const

export type ReproFrequency = (typeof REPRO_FREQUENCIES)[number]['key']

/* ------------------------------------------------------------------------- *
 * 6. Universal categories
 * ------------------------------------------------------------------------- *
 * Available on every project type, appended after the type-specific list. A
 * type that defines the same key keeps its own wording and the universal entry
 * is dropped, so no type ever offers two categories with one key.
 */

export const UNIVERSAL_CATEGORIES = [
  { key: 'bug', label: 'Bug or defect', description: 'It does the wrong thing, or stops doing anything.' },
  { key: 'confusion', label: 'Confusion', description: 'You could not tell what was happening or what to do next.' },
  { key: 'friction', label: 'Friction', description: 'It works, and it costs more than it should.' },
  { key: 'missing', label: 'Missing', description: 'The thing you reached for was not there.' },
  { key: 'delight', label: 'Delight, keep this', description: 'Something worth protecting from the next refactor.' },
  { key: 'positioning', label: 'Positioning', description: 'Who this is for, and how it says so.' },
  { key: 'accessibility', label: 'Accessibility', description: 'Contrast, targets, keyboard, captions, assistive tech.' },
  { key: 'performance', label: 'Performance', description: 'Speed, stability, and behaviour under bad conditions.' },
  { key: 'copy', label: 'Copy', description: 'The words: labels, errors, empty states, body text.' },
] as const

export type UniversalCategoryKey = (typeof UNIVERSAL_CATEGORIES)[number]['key']

/* ------------------------------------------------------------------------- *
 * 7. Need kinds — the Discover "needs" facet
 * ------------------------------------------------------------------------- *
 * Global rather than per-type: "needs playtesters" reads the same everywhere,
 * and a cross-type filter is the whole point of the facet.
 */

export const NEED_KINDS = [
  { key: 'playtesters', label: 'Playtesters', description: 'People to sit down with the build and report back.', icon: 'Gamepad2', sortOrder: 10 },
  { key: 'usability', label: 'Usability review', description: 'Watch someone try the main task and note where they stall.', icon: 'MousePointerClick', sortOrder: 20 },
  { key: 'copy_review', label: 'Copy review', description: 'Line edit on headlines, labels, errors and empty states.', icon: 'PenLine', sortOrder: 30 },
  { key: 'art_direction', label: 'Art direction', description: 'Composition, colour, type and whether the idea reads.', icon: 'Palette', sortOrder: 40 },
  { key: 'technical_review', label: 'Technical review', description: 'Architecture, API shape, failure modes, production readiness.', icon: 'Terminal', sortOrder: 50 },
  { key: 'pricing', label: 'Pricing', description: 'Would the stated buyer pay the stated price, and why not.', icon: 'Receipt', sortOrder: 60 },
  { key: 'positioning', label: 'Positioning', description: 'Who it is for, what it replaces, how it introduces itself.', icon: 'Target', sortOrder: 70 },
  { key: 'accessibility_audit', label: 'Accessibility audit', description: 'Keyboard, screen reader, contrast, targets, motion.', icon: 'Accessibility', sortOrder: 80 },
  { key: 'docs_review', label: 'Docs review', description: 'Can a stranger do the second and third thing unaided.', icon: 'BookOpen', sortOrder: 90 },
  { key: 'bug_hunt', label: 'Bug hunt', description: 'Break it on purpose and write down how.', icon: 'Bug', sortOrder: 100 },
] as const

export type NeedKey = (typeof NEED_KINDS)[number]['key']

/* ------------------------------------------------------------------------- *
 * 8. Expertise areas — the curated marketplace vocabulary
 * ------------------------------------------------------------------------- *
 * Deliberately separate from user tags: matching a paid request to a verified
 * expert must not be steerable by a tag anyone can create.
 */

export const EXPERTISE_AREAS = [
  { slug: 'game-design', label: 'Game design', parent: null, description: 'Core loops, progression, difficulty tuning.' },
  { slug: 'level-design', label: 'Level design', parent: 'game-design', description: 'Spatial pacing, encounter shape, guidance.' },
  { slug: 'game-feel', label: 'Game feel', parent: 'game-design', description: 'Input response, camera, readability of motion.' },
  { slug: 'product-design', label: 'Product design', parent: null, description: 'Flows, information architecture, interface craft.' },
  { slug: 'ux-research', label: 'UX research', parent: 'product-design', description: 'Study design, moderation, synthesis.' },
  { slug: 'accessibility', label: 'Accessibility', parent: 'product-design', description: 'WCAG conformance, assistive technology, inclusive patterns.' },
  { slug: 'brand-design', label: 'Brand and identity', parent: null, description: 'Marks, systems, tone, application.' },
  { slug: 'motion-design', label: 'Motion design', parent: 'brand-design', description: 'Timing, easing, transition grammar.' },
  { slug: 'frontend-engineering', label: 'Frontend engineering', parent: null, description: 'Performance, state, rendering, browser behaviour.' },
  { slug: 'backend-engineering', label: 'Backend engineering', parent: null, description: 'Data modelling, APIs, reliability, operations.' },
  { slug: 'api-design', label: 'API design', parent: 'backend-engineering', description: 'Naming, versioning, errors, ergonomics.' },
  { slug: 'security', label: 'Security', parent: 'backend-engineering', description: 'Authn, authz, data handling, abuse resistance.' },
  { slug: 'hardware-engineering', label: 'Hardware engineering', parent: null, description: 'Mechanism, thermals, power, manufacturability.' },
  { slug: 'industrial-design', label: 'Industrial design', parent: 'hardware-engineering', description: 'Form, ergonomics, materials, finish.' },
  { slug: 'video-editing', label: 'Video editing', parent: null, description: 'Structure, pacing, cut rhythm, sound.' },
  { slug: 'writing-editing', label: 'Writing and editing', parent: null, description: 'Structure, argument, line quality.' },
  { slug: 'technical-writing', label: 'Technical writing', parent: 'writing-editing', description: 'Quickstarts, references, error copy.' },
  { slug: 'growth-marketing', label: 'Growth and marketing', parent: null, description: 'Channels, messaging, conversion.' },
  { slug: 'pricing-strategy', label: 'Pricing strategy', parent: 'growth-marketing', description: 'Packaging, willingness to pay, unit economics.' },
  { slug: 'fundraising', label: 'Fundraising', parent: null, description: 'Narrative, diligence readiness, investor fit.' },
] as const

export type ExpertiseSlug = (typeof EXPERTISE_AREAS)[number]['slug']

/* ------------------------------------------------------------------------- *
 * 9. The ten project types
 * ------------------------------------------------------------------------- */

export const PROJECT_TYPES = {
  game: {
    slug: 'game',
    label: 'Game',
    description: 'A playable build: prototype, vertical slice, early access or release candidate.',
    icon: 'Gamepad2',
    embedKind: 'build_download',
    sortOrder: 10,
    requiredAnchor: null,
    stageLabels: {
      concept: 'Concept',
      prototype: 'Prototype',
      beta: 'Playable beta',
      release_candidate: 'Release candidate',
      shipped: 'Shipped',
    },
    axes: [
      { key: 'fun', label: 'Fun', definition: 'Did the core loop make you want another round?', family: 'value', lowLabel: 'Stopped early', highLabel: 'One more round' },
      { key: 'balance', label: 'Balance & difficulty', definition: 'Was the challenge tuned fairly, with no dead ends and no obviously dominant strategy?', family: 'friction', lowLabel: 'Unfair or trivial', highLabel: 'Tuned' },
      { key: 'game_feel', label: 'Game feel & controls', definition: 'Do inputs respond precisely and read the way they look?', family: 'execution', lowLabel: 'Mushy, mistimed', highLabel: 'Precise' },
      { key: 'onboarding', label: 'Onboarding & legibility', definition: 'How fast did you understand the goal, the rules and the current state without being told?', family: 'comprehension', lowLabel: 'Lost throughout', highLabel: 'Clear in a minute' },
      { key: 'performance', label: 'Performance & stability', definition: 'Frame pacing, load times and crashes on your actual hardware.', family: 'type_unique', lowLabel: 'Crashed or stuttered', highLabel: 'Solid throughout' },
    ],
    categories: [
      { key: 'core_loop', label: 'Core loop', description: 'The thing you do over and over.' },
      { key: 'difficulty_curve', label: 'Difficulty curve', description: 'Where it spikes, sags, or walls.' },
      { key: 'controls', label: 'Controls and input', description: 'Mapping, response, dead zones, remapping.' },
      { key: 'camera', label: 'Camera', description: 'Framing, follow, occlusion, motion comfort.' },
      { key: 'hud', label: 'UI and HUD', description: 'What the screen tells you, and when.' },
      { key: 'tutorial', label: 'Tutorial and onboarding', description: 'How the game teaches itself.' },
      { key: 'level_design', label: 'Level design', description: 'Space, pacing, guidance, encounter shape.' },
      { key: 'combat', label: 'Combat and mechanics', description: 'Verbs, counters, feedback on a hit.' },
      { key: 'economy', label: 'Economy and progression', description: 'Currencies, unlocks, pacing of reward.' },
      { key: 'audio', label: 'Audio', description: 'Mix, cues, music, silence.' },
      { key: 'art_readability', label: 'Art readability', description: 'Can you parse the scene at speed.' },
      { key: 'narrative', label: 'Narrative', description: 'Story, characters, delivery, skippability.' },
      { key: 'netcode', label: 'Multiplayer and netcode', description: 'Matchmaking, latency, desync, recovery.' },
      { key: 'save_loss', label: 'Save and progression loss', description: 'Anything that ate your progress.' },
      { key: 'accessibility', label: 'Accessibility', description: 'Remapping, colourblind support, subtitles, motion options.' },
    ],
    prompts: [
      'At what minute did you first know what you were supposed to do? What told you?',
      'Describe the last time you died or failed. Did it feel like your mistake, or the game’s?',
      'Was there a strategy you found that felt too strong or too safe? Name it.',
      'Name one input that felt off: the action, what you pressed, and what you expected to happen.',
      'If you stopped playing, give the exact moment and why.',
    ],
  },

  web_app: {
    slug: 'web_app',
    label: 'Web app',
    description: 'Software you sign into and get work done in.',
    icon: 'AppWindow',
    embedKind: 'iframe',
    sortOrder: 20,
    requiredAnchor: null,
    stageLabels: {
      concept: 'Concept',
      prototype: 'Prototype',
      beta: 'Private beta',
      release_candidate: 'Release candidate',
      shipped: 'Live',
    },
    axes: [
      { key: 'job_fit', label: 'Job fit', definition: 'Does it do the job you would actually hire it for, end to end?', family: 'value', lowLabel: 'Wrong job', highLabel: 'Finishes the job' },
      { key: 'time_to_value', label: 'Time to first value', definition: 'How long until you got a real result rather than a tour?', family: 'type_unique', lowLabel: 'Never got there', highLabel: 'Under a minute' },
      { key: 'flow_friction', label: 'Flow friction', definition: 'Dead ends, extra steps, re-entered data, states you could not read.', family: 'friction', lowLabel: 'Fought it', highLabel: 'Straight through' },
      { key: 'trust_clarity', label: 'Trust & clarity', definition: 'Do you understand what it did to your data, and whether it worked?', family: 'comprehension', lowLabel: 'Guessing', highLabel: 'Always certain' },
      { key: 'reliability', label: 'Performance & reliability', definition: 'Speed, errors, and behaviour on a slow or broken connection.', family: 'execution', lowLabel: 'Errored or hung', highLabel: 'Fast and predictable' },
    ],
    categories: [
      { key: 'signup', label: 'Signup and onboarding', description: 'Account creation through first real use.' },
      { key: 'empty_state', label: 'Empty state', description: 'What a brand-new account actually sees.' },
      { key: 'core_task', label: 'Core task flow', description: 'The path the product exists for.' },
      { key: 'navigation', label: 'Navigation and IA', description: 'Where things live and how you find them.' },
      { key: 'forms', label: 'Forms', description: 'Fields, validation, saving, recovery.' },
      { key: 'error_handling', label: 'Error handling', description: 'What happens when something fails.' },
      { key: 'import_export', label: 'Import and export', description: 'Getting data in, and back out.' },
      { key: 'permissions', label: 'Permissions and sharing', description: 'Roles, invites, visibility.' },
      { key: 'pricing', label: 'Pricing and paywall', description: 'Plans, limits, upgrade moments.' },
      { key: 'search', label: 'Search', description: 'Query handling, ranking, filters, zero results.' },
      { key: 'responsive', label: 'Responsive and mobile', description: 'Behaviour at small widths and on touch.' },
      { key: 'integrations', label: 'Integrations', description: 'Connections to the tools already in use.' },
      { key: 'copy', label: 'Microcopy', description: 'Labels, buttons, errors, helper text.' },
      { key: 'performance', label: 'Performance', description: 'Load, interaction latency, slow connections.' },
    ],
    prompts: [
      'What was the first thing you tried to do, and did you finish it? Say where you stalled.',
      'Name a screen where you did not know what would happen if you clicked the primary button.',
      'Where did you have to type something the app already knew?',
      'What did you expect to find in the navigation that was not there?',
      'If this replaced a tool you use today, what would still be missing on day one?',
    ],
  },

  mobile_app: {
    slug: 'mobile_app',
    label: 'Mobile app',
    description: 'An iOS or Android build, installed on a real device.',
    icon: 'Smartphone',
    embedKind: 'build_download',
    sortOrder: 30,
    requiredAnchor: null,
    stageLabels: {
      concept: 'Concept',
      prototype: 'Prototype',
      beta: 'Test-track beta',
      release_candidate: 'Release candidate',
      shipped: 'On the store',
    },
    axes: [
      { key: 'first_session', label: 'First-session payoff', definition: 'Did the first two minutes give you a reason to open it again tomorrow?', family: 'value', lowLabel: 'Deleted it', highLabel: 'Kept it' },
      { key: 'thumb_ergonomics', label: 'Thumb ergonomics', definition: 'Reach, target size and gesture comfort with one hand.', family: 'friction', lowLabel: 'Needed both hands', highLabel: 'One-handed throughout' },
      { key: 'platform_fit', label: 'Platform fit', definition: 'Does it behave like a native app: back, share, safe areas, haptics, system settings?', family: 'type_unique', lowLabel: 'Felt like a web page', highLabel: 'Native throughout' },
      { key: 'flow_friction', label: 'Flow friction', definition: 'Steps, interruptions and state loss on the main path.', family: 'comprehension', lowLabel: 'Lost my place', highLabel: 'Never lost state' },
      { key: 'battery', label: 'Performance & battery', definition: 'Launch time, scroll jank, heat, and what happens offline.', family: 'execution', lowLabel: 'Hot and janky', highLabel: 'Cool and smooth' },
    ],
    categories: [
      { key: 'install', label: 'Install and first run', description: 'From tap to first screen.' },
      { key: 'permissions', label: 'Permission prompts', description: 'What is asked, when, and whether it made sense.' },
      { key: 'nav_structure', label: 'Tab and nav structure', description: 'How the app is divided up.' },
      { key: 'gestures', label: 'Gestures', description: 'Swipes, long presses, edge conflicts.' },
      { key: 'notifications', label: 'Notifications', description: 'Frequency, timing, usefulness, opt-out.' },
      { key: 'offline', label: 'Offline and sync', description: 'Behaviour without a connection, and on return.' },
      { key: 'keyboard', label: 'Keyboard and input', description: 'Types, autofill, dismissal, obscured fields.' },
      { key: 'layout_device', label: 'Layout on my device', description: 'Your exact screen size, notch and scale.' },
      { key: 'dark_mode', label: 'Dark mode', description: 'Contrast and colour in the other theme.' },
      { key: 'haptics', label: 'Haptics and sound', description: 'Feedback you can feel and hear.' },
      { key: 'deep_links', label: 'Deep links', description: 'Arriving from outside the app.' },
      { key: 'crash', label: 'Crash', description: 'It closed. What you were doing when it did.' },
      { key: 'accessibility', label: 'Accessibility', description: 'Dynamic Type, VoiceOver and TalkBack, contrast, motion.' },
      { key: 'store_listing', label: 'Store listing', description: 'Icon, screenshots, description, first impression.' },
    ],
    prompts: [
      'Device and OS version, and anything that looked broken on your specific screen size.',
      'Which action needed two hands that should have needed one?',
      'When did it ask for a permission, and did you understand why at that moment?',
      'What happened when you backgrounded it mid-task and came back?',
      'Would you keep notifications on? One line on why.',
    ],
  },

  website: {
    slug: 'website',
    label: 'Website',
    description: 'Marketing or content pages, not an application you sign into.',
    icon: 'Globe',
    embedKind: 'iframe',
    sortOrder: 40,
    requiredAnchor: null,
    stageLabels: {
      concept: 'Wireframe',
      prototype: 'Draft build',
      beta: 'Staging',
      release_candidate: 'Launch candidate',
      shipped: 'Live',
    },
    axes: [
      { key: 'message_clarity', label: 'Message clarity', definition: 'Can you say what this is and who it is for after five seconds?', family: 'comprehension', lowLabel: 'Still unsure', highLabel: 'Instantly clear' },
      { key: 'credibility', label: 'Credibility', definition: 'Does it read like something you would trust with your money or your email address?', family: 'value', lowLabel: 'Would not trust it', highLabel: 'Would hand over a card' },
      { key: 'scan_find', label: 'Scan & find', definition: 'Could you locate the specific thing you came for?', family: 'friction', lowLabel: 'Gave up looking', highLabel: 'Found it at once' },
      { key: 'conversion_pull', label: 'Conversion pull', definition: 'Is the next action obvious, and worth taking?', family: 'type_unique', lowLabel: 'No reason to act', highLabel: 'Wanted to click' },
      { key: 'craft', label: 'Craft & responsiveness', definition: 'Type, spacing, imagery and behaviour across viewports.', family: 'execution', lowLabel: 'Rough or broken', highLabel: 'Considered throughout' },
    ],
    categories: [
      { key: 'hero', label: 'Hero and headline', description: 'The first screen and the sentence on it.' },
      { key: 'value_prop', label: 'Value proposition', description: 'What it claims to do for whom.' },
      { key: 'social_proof', label: 'Social proof', description: 'Evidence that anyone else uses it.' },
      { key: 'pricing_page', label: 'Pricing page', description: 'Plans, limits, what is unclear.' },
      { key: 'navigation', label: 'Navigation', description: 'Menu labels, depth, footer.' },
      { key: 'performance', label: 'Page speed', description: 'Load, layout shift, heavy media.' },
      { key: 'visual_design', label: 'Visual design', description: 'Composition, type, colour, imagery.' },
      { key: 'copy', label: 'Copy and tone', description: 'The words and the voice they are in.' },
      { key: 'cta', label: 'Calls to action', description: 'What you are asked to do, and where.' },
      { key: 'forms', label: 'Forms', description: 'Contact, signup, newsletter, validation.' },
      { key: 'seo', label: 'SEO and metadata', description: 'Titles, descriptions, structure, sharing cards.' },
      { key: 'mobile_layout', label: 'Mobile layout', description: 'The page at phone width.' },
      { key: 'broken_link', label: 'Broken link', description: 'A link that went nowhere or somewhere wrong.' },
    ],
    prompts: [
      'Without scrolling back: what does this do, and for whom? Quote the words that told you.',
      'What was the first thing you doubted or distrusted?',
      'You came to find the price. How long did it take, and what got in the way?',
      'Which call to action did you almost click, and what stopped you?',
      'Paste the sentence doing the most work, and the one you would delete.',
    ],
  },

  video: {
    slug: 'video',
    label: 'Video',
    description: 'A cut: short, long-form, trailer, or course module.',
    icon: 'Clapperboard',
    embedKind: 'video',
    sortOrder: 50,
    // The composer rejects an untimed issue on a video project. An observation
    // without a timecode is an observation nobody can act on.
    requiredAnchor: 'timecode',
    stageLabels: {
      concept: 'Outline',
      prototype: 'Rough cut',
      beta: 'Fine cut',
      release_candidate: 'Locked cut',
      shipped: 'Published',
    },
    axes: [
      { key: 'hook', label: 'Hook strength', definition: 'Do the first 15 seconds earn the next 60?', family: 'value', lowLabel: 'Skipped at once', highLabel: 'Held me' },
      { key: 'pacing', label: 'Pacing & retention', definition: 'Where does attention sag, and where does it spike?', family: 'friction', lowLabel: 'Sagged badly', highLabel: 'Never dragged' },
      { key: 'story_clarity', label: 'Clarity of story', definition: 'Can you follow the through-line without rewinding?', family: 'comprehension', lowLabel: 'Rewound often', highLabel: 'Followed it once through' },
      { key: 'production_craft', label: 'Production craft', definition: 'Audio, framing, lighting, edit rhythm and on-screen text legibility.', family: 'execution', lowLabel: 'Distracting', highLabel: 'Invisible craft' },
      { key: 'payoff', label: 'Payoff', definition: 'Does the ending justify the watch and land its ask?', family: 'type_unique', lowLabel: 'Just stopped', highLabel: 'Earned the ending' },
    ],
    categories: [
      { key: 'hook', label: 'Hook, first 15 seconds', description: 'The open, and whether it holds.' },
      { key: 'structure', label: 'Structure', description: 'The order of the parts.' },
      { key: 'pacing', label: 'Pacing', description: 'Where it drags and where it rushes.' },
      { key: 'script', label: 'Script', description: 'What is said, and what is cut.' },
      { key: 'audio_mix', label: 'Audio mix', description: 'Levels, room tone, clipping.' },
      { key: 'music', label: 'Music', description: 'Choice, placement, whether it fights the voice.' },
      { key: 'vo', label: 'Voiceover delivery', description: 'Pace, energy, diction, breath.' },
      { key: 'color', label: 'Colour and lighting', description: 'Exposure, grade, continuity.' },
      { key: 'framing', label: 'Framing', description: 'Composition, headroom, movement.' },
      { key: 'graphics', label: 'Graphics and captions', description: 'Legibility, timing, spelling.' },
      { key: 'broll', label: 'B-roll', description: 'Coverage, relevance, repetition.' },
      { key: 'cut_timing', label: 'Cut timing', description: 'Where the edit lands against the beat.' },
      { key: 'thumbnail', label: 'Thumbnail and title', description: 'The click, before the watch.' },
      { key: 'end_screen', label: 'End screen and ask', description: 'The last ten seconds.' },
      { key: 'platform_fit', label: 'Platform fit', description: 'Short against long, aspect ratio, sound-off viewing.' },
    ],
    prompts: [
      'Timecode where you first considered skipping, and what you would cut there.',
      'Timecode anywhere you had to rewind. What was unclear?',
      'Audio: any point where levels, room tone or music fought the voice? Timecode it.',
      'If you had to cut 20% of the runtime, which timecoded chunks go?',
      'Would this thumbnail and title make you click in a crowded feed? What would you change?',
    ],
  },

  business_idea: {
    slug: 'business_idea',
    label: 'Business idea',
    description: 'A thesis, a deck, or a pre-launch plan looking for its first holes.',
    icon: 'Lightbulb',
    embedKind: 'gallery',
    sortOrder: 60,
    requiredAnchor: null,
    stageLabels: {
      concept: 'Napkin',
      prototype: 'Written thesis',
      beta: 'Tested with buyers',
      release_candidate: 'Pre-launch',
      shipped: 'Trading',
    },
    axes: [
      { key: 'problem_sharpness', label: 'Problem sharpness', definition: 'Is a real, frequent, painful problem named for a person you could point at?', family: 'value', lowLabel: 'Vague', highLabel: 'Named and specific' },
      { key: 'insight', label: 'Differentiated insight', definition: 'Does this know something non-obvious about the market?', family: 'type_unique', lowLabel: 'Common knowledge', highLabel: 'Genuinely new to me' },
      { key: 'willingness_to_pay', label: 'Willingness to pay', definition: 'Would the stated buyer actually pay the stated price?', family: 'comprehension', lowLabel: 'No chance', highLabel: 'Would pay today' },
      { key: 'path_to_100', label: 'Path to first 100', definition: 'Is there a specific, credible way to reach the first hundred customers?', family: 'friction', lowLabel: 'No route named', highLabel: 'Concrete channel' },
      { key: 'risk_honesty', label: 'Risk honesty', definition: 'Are the real killers named, or dodged?', family: 'execution', lowLabel: 'Dodged them', highLabel: 'Named the worst one' },
    ],
    categories: [
      { key: 'problem_definition', label: 'Problem definition', description: 'What hurts, how often, for whom.' },
      { key: 'target_customer', label: 'Target customer', description: 'A person, not a segment.' },
      { key: 'alternatives', label: 'Alternatives and status quo', description: 'What they do today, including nothing.' },
      { key: 'pricing_model', label: 'Pricing and model', description: 'How money changes hands.' },
      { key: 'unit_economics', label: 'Unit economics', description: 'What one customer costs and returns.' },
      { key: 'gtm', label: 'Go-to-market', description: 'The first channel, not the category.' },
      { key: 'moat', label: 'Moat', description: 'Why the second mover loses.' },
      { key: 'regulatory', label: 'Regulatory and legal', description: 'What could stop this by law.' },
      { key: 'founder_fit', label: 'Founder fit', description: 'Why these people, for this.' },
      { key: 'timing', label: 'Timing', description: 'Why now, and not three years ago.' },
      { key: 'assumptions', label: 'Testable assumptions', description: 'What could be checked in two weeks.' },
      { key: 'naming', label: 'Naming and brand', description: 'What it is called and what that implies.' },
    ],
    prompts: [
      'Are you the customer? If yes, what do you do instead today, and what does it cost you?',
      'Name the strongest alternative, including “do nothing”, and say why it loses.',
      'At the stated price, would you buy? If not, at what price would you?',
      'Which single assumption, if false, kills this? How would you test it in two weeks?',
      'Where would you actually find the first 100 buyers? Name the channel, not the category.',
    ],
  },

  hardware: {
    slug: 'hardware',
    label: 'Hardware',
    description: 'A physical object: prototype, dev kit, or pre-production unit.',
    icon: 'CircuitBoard',
    embedKind: 'gallery',
    sortOrder: 70,
    requiredAnchor: null,
    stageLabels: {
      concept: 'Sketch',
      prototype: 'Breadboard',
      beta: 'Functional prototype',
      release_candidate: 'Pre-production',
      shipped: 'Shipping',
    },
    axes: [
      { key: 'problem_form_fit', label: 'Problem–form fit', definition: 'Does the physical form solve this better than software or an object you already own?', family: 'value', lowLabel: 'Should be software', highLabel: 'Has to be an object' },
      { key: 'ergonomics', label: 'Ergonomics & handling', definition: 'Grip, weight, reach, control placement and wear comfort.', family: 'friction', lowLabel: 'Awkward', highLabel: 'Disappears in the hand' },
      { key: 'build_durability', label: 'Build & durability read', definition: 'Materials, tolerances, and what you expect to break first.', family: 'execution', lowLabel: 'Feels fragile', highLabel: 'Feels like a tool' },
      { key: 'manufacturability', label: 'Manufacturability & cost realism', definition: 'Can this be built at the stated price and volume?', family: 'type_unique', lowLabel: 'Not at that price', highLabel: 'Credible at volume' },
      { key: 'daily_use', label: 'Setup & daily use', definition: 'Unboxing, pairing, power and maintenance over a week.', family: 'comprehension', lowLabel: 'Gave up on setup', highLabel: 'Lived with it easily' },
    ],
    categories: [
      { key: 'industrial_design', label: 'Industrial design', description: 'Form, proportion, finish, presence.' },
      { key: 'ergonomics', label: 'Ergonomics', description: 'Where hands go and what they hit.' },
      { key: 'materials', label: 'Materials and finish', description: 'Choice, texture, wear over time.' },
      { key: 'mechanism', label: 'Mechanism and moving parts', description: 'Hinges, switches, travel, play.' },
      { key: 'thermals', label: 'Thermals', description: 'Heat, airflow, surface temperature.' },
      { key: 'power', label: 'Power and battery', description: 'Charging, runtime, standby, routine.' },
      { key: 'connectivity', label: 'Connectivity and pairing', description: 'Getting it talking to something else.' },
      { key: 'firmware', label: 'Firmware and companion app', description: 'The software half of the object.' },
      { key: 'dfm', label: 'Design for manufacture', description: 'Assembly steps, tolerances, fixtures.' },
      { key: 'bom', label: 'Bill of materials and cost', description: 'What the parts cost at volume.' },
      { key: 'safety', label: 'Safety and compliance', description: 'Certification, hazards, labelling.' },
      { key: 'packaging', label: 'Packaging', description: 'Protection, unboxing, waste.' },
      { key: 'repairability', label: 'Repairability', description: 'Opening it, sourcing parts, replacing them.' },
      { key: 'documentation', label: 'Documentation', description: 'Quickstart, manual, troubleshooting.' },
    ],
    prompts: [
      'Which part would you expect to fail first, and why? Point at it.',
      'Where do your hands go, and what do they hit that they should not?',
      'What is the most expensive thing in this design that a user will never notice?',
      'Describe the charging or power routine in daily life. Is it acceptable?',
      'At 1,000 units, which production step would you expect to blow the schedule?',
    ],
  },

  design: {
    slug: 'design',
    label: 'Design',
    description: 'Interface, brand or graphic work, shown as frames or a prototype.',
    icon: 'Frame',
    embedKind: 'gallery',
    sortOrder: 80,
    requiredAnchor: null,
    stageLabels: {
      concept: 'Concept',
      prototype: 'Exploration',
      beta: 'Comprehensive draft',
      release_candidate: 'Final candidate',
      shipped: 'Handed off',
    },
    axes: [
      { key: 'concept_strength', label: 'Concept strength', definition: 'Is there an idea here, or only styling?', family: 'value', lowLabel: 'Styling only', highLabel: 'A real idea' },
      { key: 'hierarchy', label: 'Hierarchy & legibility', definition: 'Does the eye land in the right place, and does it read easily?', family: 'comprehension', lowLabel: 'Eye wanders', highLabel: 'Lands correctly' },
      { key: 'craft', label: 'Craft', definition: 'Spacing, alignment, type detail, colour handling and internal consistency.', family: 'execution', lowLabel: 'Unfinished', highLabel: 'Tight throughout' },
      { key: 'tone_fit', label: 'Tone fit', definition: 'Does it feel like the brand and audience it claims?', family: 'friction', lowLabel: 'Wrong register', highLabel: 'Exactly right' },
      { key: 'systemic_durability', label: 'Systemic durability', definition: 'Will it survive real content, long strings, edge states and other viewports?', family: 'type_unique', lowLabel: 'Breaks immediately', highLabel: 'Holds under load' },
    ],
    categories: [
      { key: 'concept', label: 'Concept', description: 'The idea under the surface.' },
      { key: 'composition', label: 'Composition', description: 'Balance, grid, negative space.' },
      { key: 'typography', label: 'Typography', description: 'Family, scale, measure, detail.' },
      { key: 'color', label: 'Colour', description: 'Palette, roles, contrast, restraint.' },
      { key: 'spacing', label: 'Spacing and rhythm', description: 'Scale discipline and vertical rhythm.' },
      { key: 'iconography', label: 'Iconography', description: 'Set consistency, weight, metaphor.' },
      { key: 'imagery', label: 'Imagery and illustration', description: 'Sourcing, treatment, fit.' },
      { key: 'motion', label: 'Motion', description: 'Duration, easing, purpose.' },
      { key: 'brand_tone', label: 'Brand tone', description: 'Voice carried by form.' },
      { key: 'component_consistency', label: 'Component consistency', description: 'The same thing looking the same way twice.' },
      { key: 'states', label: 'States', description: 'Empty, loading, error, disabled, success.' },
      { key: 'localization', label: 'Localisation and long strings', description: 'What happens in German, or at 200%.' },
      { key: 'accessibility', label: 'Contrast and accessibility', description: 'Ratios, targets, focus, motion safety.' },
      { key: 'file_hygiene', label: 'File hygiene', description: 'Naming, layers, components, handoff readiness.' },
    ],
    prompts: [
      'Where did your eye land first? Was that the intended first thing?',
      'Name one element you would remove entirely, and say what improves once it is gone.',
      'Which detail reads as unfinished? Give the exact element and the specific flaw.',
      'Imagine double the real content length. What breaks?',
      'Give three adjectives this evokes. Do they match the brief’s adjectives?',
    ],
  },

  writing: {
    slug: 'writing',
    label: 'Writing',
    description: 'An essay, chapter, script or long-form post looking for an editor.',
    icon: 'FileText',
    embedKind: 'none',
    sortOrder: 90,
    requiredAnchor: null,
    stageLabels: {
      concept: 'Outline',
      prototype: 'First draft',
      beta: 'Revised draft',
      release_candidate: 'Final draft',
      shipped: 'Published',
    },
    axes: [
      { key: 'opening_pull', label: 'Opening pull', definition: 'Does the first paragraph earn the second?', family: 'value', lowLabel: 'Put it down', highLabel: 'Read straight on' },
      { key: 'structure', label: 'Structure', definition: 'Does it move, and can you follow the spine?', family: 'comprehension', lowLabel: 'Lost the thread', highLabel: 'Always oriented' },
      { key: 'line_quality', label: 'Line quality', definition: 'Sentence rhythm, precision, and absence of filler.', family: 'execution', lowLabel: 'Padded', highLabel: 'Every line earns its place' },
      { key: 'reader_clarity', label: 'Clarity for the intended reader', definition: 'Assumed knowledge, jargon, and what goes undefined.', family: 'friction', lowLabel: 'Needed a glossary', highLabel: 'Pitched exactly right' },
      { key: 'ending', label: 'Ending landing', definition: 'Does it conclude, or just stop?', family: 'type_unique', lowLabel: 'Stopped', highLabel: 'Landed' },
    ],
    categories: [
      { key: 'opening', label: 'Opening', description: 'The first paragraph and its promise.' },
      { key: 'structure', label: 'Structure', description: 'Order, sections, transitions.' },
      { key: 'pacing', label: 'Pacing', description: 'Where it drags, where it rushes.' },
      { key: 'argument', label: 'Argument and evidence', description: 'Claims, support, counterarguments.' },
      { key: 'voice', label: 'Voice and character', description: 'Who is speaking, and consistently.' },
      { key: 'dialogue', label: 'Dialogue', description: 'Speech that sounds spoken.' },
      { key: 'jargon', label: 'Jargon and clarity', description: 'Terms used before they are earned.' },
      { key: 'line_edit', label: 'Line edit', description: 'Sentence-level fixes.' },
      { key: 'repetition', label: 'Repetition and filler', description: 'Words doing no work.' },
      { key: 'tone_fit', label: 'Tone fit', description: 'Register against venue and reader.' },
      { key: 'title', label: 'Title and subheads', description: 'The signposts.' },
      { key: 'scannability', label: 'Scannability', description: 'What a skimmer takes away.' },
      { key: 'claim_check', label: 'Claim check', description: 'A statement that needs a source.' },
      { key: 'ending', label: 'Ending', description: 'The last paragraph and what it leaves.' },
    ],
    prompts: [
      'Quote the last sentence you read before you wanted to stop.',
      'Say the thesis in your own words. If you cannot, say where it slipped.',
      'Mark the three paragraphs you would cut with no loss.',
      'Which claim needed evidence you did not get?',
      'Paste one sentence you would steal and one you would rewrite.',
    ],
  },

  api_tool: {
    slug: 'api_tool',
    label: 'API or dev tool',
    description: 'An SDK, CLI, library or service other engineers have to adopt.',
    icon: 'Terminal',
    embedKind: 'none',
    sortOrder: 100,
    requiredAnchor: null,
    stageLabels: {
      concept: 'Sketch',
      prototype: 'Alpha',
      beta: 'Public beta',
      release_candidate: 'Release candidate',
      shipped: 'Stable',
    },
    axes: [
      { key: 'time_to_first_call', label: 'Time to first successful call', definition: 'Minutes from landing page to a working response.', family: 'value', lowLabel: 'Never got one', highLabel: 'Under five minutes' },
      { key: 'ergonomics', label: 'API ergonomics', definition: 'Naming, consistency, defaults, ceremony and footguns.', family: 'friction', lowLabel: 'Fought the shape', highLabel: 'Guessed right every time' },
      { key: 'docs_quality', label: 'Docs quality', definition: 'Can you do the second and third thing without reading the source?', family: 'comprehension', lowLabel: 'Read the source', highLabel: 'Docs answered it' },
      { key: 'debuggability', label: 'Error & debuggability', definition: 'Do failures tell you what you did wrong and how to fix it?', family: 'execution', lowLabel: 'Silent or cryptic', highLabel: 'Errors taught me' },
      { key: 'production_readiness', label: 'Production readiness', definition: 'Auth, versioning, limits, idempotency and observability.', family: 'type_unique', lowLabel: 'Would not ship it', highLabel: 'Would ship Monday' },
    ],
    categories: [
      { key: 'install', label: 'Install and setup', description: 'Getting it onto a machine.' },
      { key: 'quickstart', label: 'Quickstart', description: 'The path to the first result.' },
      { key: 'auth', label: 'Auth', description: 'Keys, tokens, scopes, rotation.' },
      { key: 'naming', label: 'Naming and consistency', description: 'Words that mean the same thing everywhere.' },
      { key: 'types', label: 'Types and schema', description: 'Shapes, nullability, generated clients.' },
      { key: 'defaults', label: 'Defaults', description: 'What happens when you pass nothing.' },
      { key: 'error_messages', label: 'Error messages', description: 'What a failure says out loud.' },
      { key: 'pagination', label: 'Pagination', description: 'Cursors, limits, stability.' },
      { key: 'rate_limits', label: 'Rate limits', description: 'Headers, backoff, quota visibility.' },
      { key: 'versioning', label: 'Versioning and stability', description: 'Breaking changes and how they are announced.' },
      { key: 'sdk', label: 'SDK ergonomics', description: 'The idiomatic wrapper in your language.' },
      { key: 'cli', label: 'CLI experience', description: 'Flags, output, exit codes, help.' },
      { key: 'docs', label: 'Docs and examples', description: 'Reference, guides, runnable examples.' },
      { key: 'observability', label: 'Observability', description: 'Logs, traces, request ids, dashboards.' },
      { key: 'performance', label: 'Performance', description: 'Latency, throughput, cold starts.' },
      { key: 'security', label: 'Security', description: 'Secrets handling, scopes, data exposure.' },
    ],
    prompts: [
      'How many minutes and how many browser tabs to your first 200? Paste the snippet that finally worked.',
      'Paste an error verbatim. What did you think it meant, and what did it mean?',
      'Name a parameter or method whose name misled you.',
      'What did you have to read the source, or guess, to learn?',
      'What would stop you putting this into production on Monday?',
    ],
  },
} as const satisfies Record<ProjectTypeSlug, ProjectTypeDef>

export type ProjectTypes = typeof PROJECT_TYPES
export type AxisKeyOf<T extends ProjectTypeSlug> = ProjectTypes[T]['axes'][number]['key']
export type CategoryKeyOf<T extends ProjectTypeSlug> = ProjectTypes[T]['categories'][number]['key']
/** Every category key that can appear on any type, universal ones included. */
export type AnyCategoryKey = CategoryKeyOf<ProjectTypeSlug> | UniversalCategoryKey

/* ------------------------------------------------------------------------- *
 * 10. Rating scale
 * ------------------------------------------------------------------------- */

export const RATING_SCALE_MAX = 5

/**
 * Axis means are Bayesian-shrunk toward the project type's global mean, so one
 * enthusiastic review does not produce a headline 5.0. Below MIN_RATINGS the UI
 * shows the range and the individual ratings instead of a single number.
 */
export const AXIS_SHRINKAGE_K = 4
export const MIN_RATINGS_FOR_HEADLINE = 4
/** Prior used when a project type has no history of its own yet. */
export const AXIS_GLOBAL_PRIOR = 3.4

/**
 * "Not enough exposure to rate" is represented by the absence of a
 * feedback_ratings row, never by a stored 3. Excluding it is the point.
 */
export const NOT_ENOUGH_EXPOSURE = null

export function shrinkAxisMean(sum: number, count: number, typeMean = AXIS_GLOBAL_PRIOR): number {
  if (count <= 0) return typeMean
  return (sum + AXIS_SHRINKAGE_K * typeMean) / (count + AXIS_SHRINKAGE_K)
}

/* ------------------------------------------------------------------------- *
 * 11. Specificity — design/TAXONOMY.md §3.1
 * ------------------------------------------------------------------------- *
 * S = clamp01(0.30·s_struct + 0.25·s_evidence + 0.25·s_anchor + 0.20·s_lex)
 * S gates rewards. It never blocks posting: a low-specificity item still
 * appears in the thread, it just earns close to nothing.
 */

export const SPECIFICITY_WEIGHTS = {
  struct: 0.3,
  evidence: 0.25,
  anchor: 0.25,
  /** The only model-driven term, capped at 20% on purpose. It can nudge, never decide. */
  lex: 0.2,
} as const

/** Qualified review floor used by the Need term and by expert gating. */
export const QUALIFIED_SPECIFICITY = 0.5

/** Under 90 seconds with the artifact, or the build never opened, caps S here. */
export const DWELL_FLOOR_SECONDS = 90
export const DWELL_FLOOR_CAP = 0.4

/** Phrases that carry no information. `s_lex` is 1 minus their share of content tokens. */
export const GENERIC_PHRASES = [
  'looks good',
  'looks great',
  'nice work',
  'great work',
  'good job',
  'needs polish',
  'needs work',
  'just my opinion',
  'not sure',
  'pretty cool',
  'love it',
  'hate it',
  'keep it up',
  'overall solid',
  'in general',
  'some issues',
  'a bit off',
  'feels weird',
  'hard to say',
  'more polish',
] as const

/**
 * Single words that grade without naming anything: verdicts, hedges and filler.
 * The phrase list alone let "pretty nice overall, works well" read as fully
 * specific language, because none of its words is in a phrase. One of these in
 * a sentence that also names a place or a number costs almost nothing; a note
 * made of nothing else reads as generic, which is what it is.
 */
export const GENERIC_WORDS = [
  'nice', 'good', 'great', 'cool', 'awesome', 'amazing', 'fantastic', 'excellent', 'perfect',
  'lovely', 'beautiful', 'brilliant', 'wonderful', 'neat', 'impressive', 'promising', 'solid',
  'clean', 'easy', 'simple', 'polished', 'fun', 'enjoyed', 'enjoy', 'enjoyable', 'love', 'loved',
  'like', 'liked', 'fine', 'okay', 'ok', 'decent', 'interesting', 'bad', 'boring', 'weird',
  'better', 'worse', 'best', 'worst', 'overall', 'generally', 'pretty', 'quite', 'super',
  'definitely', 'honestly', 'basically', 'totally', 'stuff', 'thing', 'things', 'everything',
  'something', 'nothing', 'works', 'well', 'job', 'idea', 'experience', 'vibe', 'vibes', 'feel',
  'feels', 'felt', 'looks', 'seems', 'lot', 'lots', 'kinda', 'maybe', 'probably', 'guess',
  'recommend', 'potential', 'complain', 'issues', 'improve', 'improved', 'improvements', 'confusing',
  'clunky', 'intuitive', 'unintuitive', 'smooth', 'messy', 'useful', 'helpful', 'modern', 'sturdy',
  'clear', 'clearer', 'fair', 'professional',
] as const

/* ------------------------------------------------------------------------- *
 * 12. Reputation — design/TAXONOMY.md §3.2–§3.5
 * ------------------------------------------------------------------------- */

export const REPUTATION = {
  /** v_r term weights. Adoption beats applause beats peer approval. */
  weightHelpful: 1.0,
  weightAdoption: 1.8,
  weightPeerVotes: 0.8,
  weightNotApplicable: 0.6,
  weightModeration: 4.0,
  valueClamp: 4,

  /** Adoption credit by suggestion state. `planned` decays if it never ships. */
  adoptionShipped: 1.0,
  adoptionPlanned: 0.5,
  adoptionPlannedDecayed: 0.25,
  plannedDecayDays: 120,

  /** Peer votes saturate: û = log1p(max(u,0)) / log1p(25). */
  voteSaturation: 25,
  voterTrustDivisor: 500,
  voterTrustCap: 1.5,

  /** κ(c) = 0.4 + 0.6·D(c). A creator who marks everything helpful carries no signal. */
  kappaFloor: 0.4,
  kappaRange: 0.6,
  /** Beta(2,2) prior on p_helpful. */
  helpfulPriorSuccess: 2,
  helpfulPriorTotal: 4,

  /** ρ(u,c) = 1 / (1 + 2·min(x_u→c, x_c→u)) over a 180-day window. */
  reciprocityFactor: 2,
  reciprocityWindowDays: 180,

  /** Domain attribution weight: primary type, then cross-tagged types. */
  domainPrimary: 1.0,
  domainSecondary: 0.7,
  domainTertiary: 0.3,

  /** λ = ln2 / 270 — a nine-month half-life on evidence. */
  halfLifeDays: 270,
  /** Bayesian shrink toward zero: your first eight effective reviews count for little. */
  shrinkK: 8,
  /** V_d = n / (n + 20). Volume contributes at most 350 of the 1000 points. */
  volumeK: 20,
  qualityShare: 0.65,
  volumeShare: 0.35,
  scoreMax: 1000,
  /** norm(q̄) = clamp01((q̄ + 0.5) / 2.5). */
  normOffset: 0.5,
  normSpan: 2.5,

  /** Expertise does not vanish in a sabbatical. */
  peakFloorShare: 0.5,
  peakHalfLifeMonths: 24,

  /** Anti-grind: extras post normally and earn nothing. */
  repBearingReviewsPerDay: 6,
} as const

export const REPUTATION_TIERS = [
  { key: 'new', label: 'New', min: 0, max: 99, level: 1 },
  { key: 'contributor', label: 'Contributor', min: 100, max: 299, level: 3 },
  { key: 'trusted', label: 'Trusted', min: 300, max: 549, level: 5 },
  { key: 'signal', label: 'Signal', min: 550, max: 799, level: 7 },
  { key: 'sharpener', label: 'Sharpener', min: 800, max: 1000, level: 10 },
] as const

export type ReputationTier = (typeof REPUTATION_TIERS)[number]
export type ReputationTierKey = ReputationTier['key']

export function tierFor(score: number): ReputationTier {
  // Walk from the top so the highest satisfied floor wins.
  for (let i = REPUTATION_TIERS.length - 1; i >= 0; i--) {
    const t = REPUTATION_TIERS[i]
    if (t && score >= t.min) return t
  }
  // REPUTATION_TIERS is a non-empty literal tuple; the fallback satisfies
  // noUncheckedIndexedAccess without pretending the array might be empty.
  return { key: 'new', label: 'New', min: 0, max: 99, level: 1 }
}

/** Expert status is granted, not accumulated. Every gate must pass. */
export const EXPERT_GATES = {
  credibility: 650,
  effectiveReviews: 30,
  adoptionRateWindow: 40,
  adoptionRate: 0.2,
  helpfulRate: 0.55,
  distinctCreators: 12,
  /** Herfindahl concentration ceiling: no single-creator farm can qualify. */
  creatorConcentration: 0.15,
  cleanRecordDays: 180,
  expiresAfterMonths: 12,
  graceDays: 60,
} as const

/* ------------------------------------------------------------------------- *
 * 13. Discover ranking — design/TAXONOMY.md §4
 * ------------------------------------------------------------------------- *
 * Rank(p,u) = Quality(p)^0.8 · Need(p) · Freshness(p) · Urgency(p)
 *           · Fit(p,u) · Penalty(p)
 */

export const FEED = {
  qualityExponent: 0.8,

  /** Freshness = 1 / (1 + (hours_since_meaningful_update / 36)^1.4). */
  freshnessHalfLifeHours: 36,
  freshnessExponent: 1.4,

  /** Need = 1 + 1.6·exp(−R_eff / 3). Zero qualified reviews is a 2.6× boost. */
  needAmplitude: 1.6,
  needDecay: 3,
  /** Once the creator closed feedback, they got what they came for. */
  needSatisfied: 0.3,

  /** Urgency = 1 + 0.4·[deadline within 14 days]. */
  urgencyBonus: 0.4,
  urgencyWindowDays: 14,

  /** Quality = 0.5·Q_creator + 0.3·Q_brief + 0.2·Q_engagement. */
  qualityCreator: 0.5,
  qualityBrief: 0.3,
  qualityEngagement: 0.2,
  creatorScoreDivisor: 800,

  /** Fit multipliers. */
  fitDomainMatch: 0.5,
  fitTagOverlap: 0.3,
  fitExpertAxis: 0.2,
  fitAlreadyReviewed: 0.15,

  /** Penalties. The anti-extraction term is the ethical core of the ranking. */
  penaltyUnanswered: 0.3,
  unansweredThreshold: 5,
  unansweredAgeDays: 7,
  penaltyAuthorRepeat: 0.6,
  authorDiversityWindow: 20,

  /** Every 4th slot is reserved for the "needs eyes" pool. */
  reservedSlotEvery: 4,
  needsEyesMaxReviews: 1,
} as const

/* ------------------------------------------------------------------------- *
 * 14. Theme clustering
 * ------------------------------------------------------------------------- */

export const THEME = {
  /** Precision over recall: a wrong merge is worse than a missed one. */
  similarityThreshold: 0.62,
  /** Above this spread in sentiment, a theme is contested rather than agreed. */
  contestedSigma: 0.55,
  minReviewersForAgreement: 2,
} as const

/* ------------------------------------------------------------------------- *
 * 15. Lookups
 * ------------------------------------------------------------------------- */

const TYPE_BY_SLUG = new Map<string, ProjectTypeDef>(
  PROJECT_TYPE_SLUGS.map((s) => [s, PROJECT_TYPES[s] as ProjectTypeDef]),
)

export function isProjectTypeSlug(value: string): value is ProjectTypeSlug {
  return TYPE_BY_SLUG.has(value)
}

export function projectType(slug: string): ProjectTypeDef | undefined {
  return TYPE_BY_SLUG.get(slug)
}

export function allProjectTypes(): readonly ProjectTypeDef[] {
  return PROJECT_TYPE_SLUGS.map((s) => PROJECT_TYPES[s] as ProjectTypeDef)
}

export function axesFor(slug: string): readonly AxisDef[] {
  return TYPE_BY_SLUG.get(slug)?.axes ?? []
}

/**
 * Type-specific categories first, then every universal category the type has
 * not already defined under the same key. A type that redefines `accessibility`
 * keeps its own wording; the universal entry is dropped rather than duplicated.
 */
export function categoriesFor(slug: string): readonly CategoryDef[] {
  const def = TYPE_BY_SLUG.get(slug)
  if (!def) return []
  const seen = new Set(def.categories.map((c) => c.key))
  const extras = UNIVERSAL_CATEGORIES.filter((c) => !seen.has(c.key))
  return [...def.categories, ...extras]
}

export function promptsFor(slug: string): readonly string[] {
  return TYPE_BY_SLUG.get(slug)?.prompts ?? []
}

export function axisId(slug: string, axisKey: string): string {
  return `${slug}:${axisKey}`
}

export function categoryId(slug: string, categoryKey: string): string {
  return `${slug}:${categoryKey}`
}

/** Splits 'game:core_loop' back into its parts. Returns undefined on anything else. */
export function splitTaxonomyId(id: string): { slug: string; key: string } | undefined {
  const at = id.indexOf(':')
  if (at <= 0 || at === id.length - 1) return undefined
  return { slug: id.slice(0, at), key: id.slice(at + 1) }
}

const SEVERITY_BY_KEY = new Map<string, SeverityLevel>(SEVERITY_LEVELS.map((s) => [s.key, s]))
const ACTIONABILITY_BY_KEY = new Map<string, ActionabilityLevel>(ACTIONABILITY_LEVELS.map((a) => [a.key, a]))
const EFFORT_BY_KEY = new Map<string, EffortLevel>(EFFORT_LEVELS.map((e) => [e.key, e]))
const GRIT_BY_KEY = new Map<string, GritStage>(GRIT_STAGES.map((g) => [g.key, g]))

export function severity(key: string): SeverityLevel | undefined {
  return SEVERITY_BY_KEY.get(key)
}

export function severityWeight(key: string): number {
  return SEVERITY_BY_KEY.get(key)?.weight ?? 0
}

export function severityRank(key: string): number {
  return SEVERITY_BY_KEY.get(key)?.rank ?? SEVERITY_LEVELS.length
}

export function actionability(key: string): ActionabilityLevel | undefined {
  return ACTIONABILITY_BY_KEY.get(key)
}

export function effort(key: string): EffortLevel | undefined {
  return EFFORT_BY_KEY.get(key)
}

export function gritStage(key: string): GritStage | undefined {
  return GRIT_BY_KEY.get(key)
}

export function gritValue(key: string): number {
  return GRIT_BY_KEY.get(key)?.grit ?? 0
}

export function isGritStageKey(value: string): value is GritStageKey {
  return GRIT_BY_KEY.has(value)
}

/** Per-type wording for a stage, falling back to the canonical label. */
export function stageLabel(slug: string, stageKey: string): string {
  const def = TYPE_BY_SLUG.get(slug)
  if (def && isGritStageKey(stageKey)) return def.stageLabels[stageKey]
  return GRIT_BY_KEY.get(stageKey)?.label ?? stageKey
}

/**
 * The schema stores no `kind` column, because kind is a reading of severity and
 * actionability and a derived value cannot disagree with its own row.
 */
export function deriveItemKind(input: {
  severity: string
  actionability: string
  hasReproSteps: boolean
  sentiment: number
}): ItemKind {
  if (input.severity === 'praise' || input.sentiment > 0) return 'praise'
  if (input.actionability === 'repro' || input.hasReproSteps) return 'bug'
  if (input.severity === 'blocker' || input.severity === 'major') return 'issue'
  if (input.actionability === 'actionable' || input.actionability === 'suggestion') return 'idea'
  if (input.actionability === 'observation') return 'question'
  return 'issue'
}

/** Quadrant hint for the creator dashboard: severity against effort. */
export function priorityQuadrant(severityKey: string, effortKey: string | null): 'quick_win' | 'big_rock' | 'cheap_polish' | 'backlog' {
  const sev = severityRank(severityKey)
  const eff = effortKey ? (EFFORT_BY_KEY.get(effortKey)?.rank ?? 2) : 2
  const severe = sev <= 2
  const cheap = eff <= 1
  if (severe && cheap) return 'quick_win'
  if (severe && !cheap) return 'big_rock'
  if (!severe && cheap) return 'cheap_polish'
  return 'backlog'
}
