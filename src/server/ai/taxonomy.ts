import './guard'

/**
 * The fixed vocabulary both paths classify into.
 *
 * The AI intake assistant is handed this verbatim so it labels into the product
 * ontology rather than inventing its own, and the deterministic path scores
 * against the same table. One source of truth, two consumers.
 */

export const PROJECT_TYPES = [
  'game',
  'web_app',
  'mobile_app',
  'website',
  'video',
  'business_idea',
  'hardware',
  'design',
  'writing',
  'devtool',
] as const

export type ProjectType = (typeof PROJECT_TYPES)[number]

// `shipped` is the last step of the grit scale a creator answers in the wizard
// ("Out in the world. Feedback now aims at the next version"), and the ladder
// ended one rung below it, so a shipped project could only be described as
// close to launch.
export const PROJECT_STAGES = ['concept', 'prototype', 'alpha', 'beta', 'launch_ready', 'shipped'] as const
export type ProjectStage = (typeof PROJECT_STAGES)[number]

export type AxisSpec = {
  key: string
  label: string
  description: string
}

/**
 * The curated default axes per type, taken from the taxonomy spec. With no
 * provider configured a creator still gets these, which is most of the value
 * the intake assistant offers.
 */
export const DEFAULT_AXES: Record<ProjectType, readonly AxisSpec[]> = {
  game: [
    { key: 'fun', label: 'Fun', description: 'Did the core loop make you want another round?' },
    { key: 'balance', label: 'Balance & difficulty', description: 'Was the challenge tuned fairly, with no dead ends and no dominant strategy?' },
    { key: 'game_feel', label: 'Game feel & controls', description: 'Do inputs respond precisely and read the way they look?' },
    { key: 'onboarding', label: 'Onboarding & legibility', description: 'How fast did you understand the goal, the rules and the current state?' },
    { key: 'performance', label: 'Performance & stability', description: 'Frame pacing, load times and crashes on your actual hardware.' },
  ],
  web_app: [
    { key: 'job_fit', label: 'Job fit', description: 'Does it do the job you would actually hire it for, end to end?' },
    { key: 'time_to_value', label: 'Time to first value', description: 'How long until you got a real result rather than a tour?' },
    { key: 'flow_friction', label: 'Flow friction', description: 'Dead ends, extra steps, re-entered data, states you could not read.' },
    { key: 'trust', label: 'Trust & clarity', description: 'Do you understand what it did to your data, and whether it worked?' },
    { key: 'performance', label: 'Performance & reliability', description: 'Speed, errors and behaviour on a slow or broken connection.' },
  ],
  mobile_app: [
    { key: 'first_session', label: 'First-session payoff', description: 'Did the first two minutes give you a reason to open it again tomorrow?' },
    { key: 'ergonomics', label: 'Thumb ergonomics', description: 'Reach, target size and gesture comfort with one hand.' },
    { key: 'platform_fit', label: 'Platform fit', description: 'Back, share, safe areas, haptics and system settings.' },
    { key: 'flow_friction', label: 'Flow friction', description: 'Steps, interruptions and state loss on the main path.' },
    { key: 'performance', label: 'Performance & battery', description: 'Launch time, scroll behaviour, heat and what happens offline.' },
  ],
  website: [
    { key: 'message_clarity', label: 'Message clarity', description: 'Can you say what this is and who it is for after five seconds?' },
    { key: 'credibility', label: 'Credibility', description: 'Does it read like something you would trust with your money?' },
    { key: 'scan_find', label: 'Scan & find', description: 'Could you locate the specific thing you came for?' },
    { key: 'conversion', label: 'Conversion pull', description: 'Is the next action obvious, and worth taking?' },
    { key: 'craft', label: 'Craft & responsiveness', description: 'Type, spacing, imagery and behaviour across viewports.' },
  ],
  video: [
    { key: 'hook', label: 'Hook strength', description: 'Do the first fifteen seconds earn the next sixty?' },
    { key: 'pacing', label: 'Pacing & retention', description: 'Where does attention sag, and where does it spike?' },
    { key: 'clarity', label: 'Clarity of story', description: 'Can you follow the through-line without rewinding?' },
    { key: 'production', label: 'Production craft', description: 'Audio, framing, lighting, edit rhythm, on-screen text legibility.' },
    { key: 'payoff', label: 'Payoff', description: 'Does the ending justify the watch and land its ask?' },
  ],
  business_idea: [
    { key: 'problem', label: 'Problem sharpness', description: 'Is a real, frequent, painful problem named for a person you could point at?' },
    { key: 'insight', label: 'Differentiated insight', description: 'Does this know something non-obvious about the market?' },
    { key: 'willingness_to_pay', label: 'Willingness to pay', description: 'Would the stated buyer actually pay the stated price?' },
    { key: 'first_hundred', label: 'Path to first 100', description: 'Is there a credible way to reach the first hundred customers?' },
    { key: 'risk_honesty', label: 'Risk honesty', description: 'Are the real killers named, or dodged?' },
  ],
  hardware: [
    { key: 'form_fit', label: 'Problem–form fit', description: 'Does the physical form solve this better than software or an object you own?' },
    { key: 'ergonomics', label: 'Ergonomics & handling', description: 'Grip, weight, reach, control placement, wear comfort.' },
    { key: 'durability', label: 'Build & durability read', description: 'Materials, tolerances and what you expect to break first.' },
    { key: 'manufacturability', label: 'Manufacturability & cost realism', description: 'Can this be built at the stated price and volume?' },
    { key: 'daily_use', label: 'Setup & daily use', description: 'Unboxing, pairing, power and maintenance over a week.' },
  ],
  design: [
    { key: 'concept', label: 'Concept strength', description: 'Is there an idea here, or only styling?' },
    { key: 'hierarchy', label: 'Hierarchy & legibility', description: 'Does the eye land in the right place, and does it read easily?' },
    { key: 'craft', label: 'Craft', description: 'Spacing, alignment, type detail, colour handling, internal consistency.' },
    { key: 'tone_fit', label: 'Tone fit', description: 'Does it feel like the brand and audience it claims?' },
    { key: 'durability', label: 'Systemic durability', description: 'Will it survive real content, long strings, edge states, other viewports?' },
  ],
  writing: [
    { key: 'opening', label: 'Opening pull', description: 'Does the first paragraph earn the second?' },
    { key: 'structure', label: 'Structure', description: 'Does it move, and can you follow the spine?' },
    { key: 'line_quality', label: 'Line quality', description: 'Sentence rhythm, precision and absence of filler.' },
    { key: 'clarity', label: 'Clarity for the intended reader', description: 'Assumed knowledge, jargon and what goes undefined.' },
    { key: 'ending', label: 'Ending landing', description: 'Does it conclude, or just stop?' },
  ],
  devtool: [
    { key: 'time_to_call', label: 'Time to first successful call', description: 'Minutes from landing page to a working response.' },
    { key: 'ergonomics', label: 'API ergonomics', description: 'Naming, consistency, defaults, ceremony and footguns.' },
    { key: 'docs', label: 'Docs quality', description: 'Can you do the second and third thing without reading the source?' },
    { key: 'errors', label: 'Error & debuggability', description: 'Do failures tell you what you did wrong and how to fix it?' },
    { key: 'production', label: 'Production readiness', description: 'Auth, versioning, limits, idempotency, observability.' },
  ],
}

/** Optional axes a creator can swap in. The picker draws from this list. */
export const OPTIONAL_AXES: readonly AxisSpec[] = [
  { key: 'accessibility', label: 'Accessibility', description: 'Keyboard, contrast, captions, remapping, screen reader support.' },
  { key: 'replayability', label: 'Replayability', description: 'Is there a reason to come back after the first run?' },
  { key: 'run_variety', label: 'Run variety', description: 'Do successive runs feel meaningfully different?' },
  { key: 'art_readability', label: 'Art readability', description: 'Can you tell what matters at a glance?' },
  { key: 'audio', label: 'Audio', description: 'Mix, levels, music fit and sound feedback.' },
  { key: 'narrative', label: 'Narrative', description: 'Does the story earn its screen time?' },
  { key: 'pricing', label: 'Pricing', description: 'Is the price legible and defensible for the value shown?' },
  { key: 'setup', label: 'Setup friction', description: 'Install, configuration and the first ten minutes.' },
  { key: 'docs', label: 'Docs quality', description: 'Coverage, accuracy and examples that run as written.' },
  { key: 'mobile_layout', label: 'Mobile layout', description: 'Behaviour at small widths and when the device is rotated.' },
  { key: 'empty_states', label: 'Empty states', description: 'What a new account sees before any data exists.' },
  { key: 'error_handling', label: 'Error handling', description: 'What happens when the network, the input or the service fails.' },
  { key: 'security', label: 'Security posture', description: 'Auth, permissions and what a hostile user could reach.' },
  { key: 'localisation', label: 'Localisation', description: 'Long strings, right-to-left, number and date formats.' },
  { key: 'offline', label: 'Offline behaviour', description: 'What survives a lost connection, and what is lost.' },
  { key: 'multiplayer', label: 'Multiplayer & netcode', description: 'Latency, desync and what happens when a peer drops.' },
  { key: 'thumbnail', label: 'Thumbnail & title', description: 'Would this earn a click in a crowded feed?' },
  { key: 'unit_economics', label: 'Unit economics', description: 'Do the numbers survive contact with real costs?' },
  { key: 'repairability', label: 'Repairability', description: 'Can a user open it, replace a part and close it again?' },
  { key: 'observability', label: 'Observability', description: 'Logs, metrics and traces when something goes wrong in production.' },
]

/** Weighted keyword evidence for the deterministic type classifier. */
export const TYPE_KEYWORDS: Record<ProjectType, ReadonlyArray<[string, number]>> = {
  game: [['godot', 3], ['unity', 3], ['unreal', 3], ['bevy', 3], ['roguelike', 3], ['platformer', 3], ['deckbuilder', 3], ['playtest', 2.5], ['gameplay', 2.5], ['level', 1.5], ['player', 1.5], ['enemy', 1.5], ['boss', 2], ['loot', 2], ['fps', 1], ['rpg', 2.5], ['metroidvania', 3], ['pixel art', 2], ['steam', 2], ['itch', 3]],
  web_app: [['saas', 3], ['dashboard', 2], ['web app', 3], ['nextjs', 2.5], ['react', 1.5], ['rails', 2], ['django', 2], ['supabase', 2], ['onboarding flow', 2], ['sign up', 1.5], ['workspace', 1.5], ['crud', 2], ['subscription', 1.5], ['browser', 1.5]],
  mobile_app: [['ios', 3], ['android', 3], ['swiftui', 3], ['react native', 3], ['flutter', 3], ['expo', 2.5], ['app store', 3], ['play store', 3], ['testflight', 3], ['iphone', 2], ['tablet', 1.5], ['push notification', 2]],
  website: [['landing page', 3], ['marketing site', 3], ['portfolio', 2.5], ['blog', 2], ['homepage', 2.5], ['hero section', 2.5], ['copywriting', 2], ['seo', 2], ['webflow', 2.5], ['framer', 2]],
  video: [['youtube', 3], ['video essay', 3], ['edit', 1.5], ['footage', 2.5], ['b roll', 3], ['voiceover', 3], ['thumbnail', 2.5], ['premiere', 2], ['davinci', 2.5], ['short film', 3], ['trailer', 2.5], ['runtime', 1.5]],
  business_idea: [['business model', 3], ['pitch deck', 3], ['market', 1.5], ['customers', 1.5], ['pricing model', 2], ['go to market', 3], ['startup idea', 3], ['revenue', 1.5], ['founder', 2], ['tam', 2.5], ['validate', 2]],
  hardware: [['pcb', 3], ['3d print', 3], ['enclosure', 3], ['bom', 3], ['injection mold', 3], ['firmware', 2], ['prototype board', 2.5], ['esp32', 3], ['arduino', 3], ['cad', 2.5], ['tolerance', 2]],
  design: [['figma', 3], ['brand', 2], ['logo', 2.5], ['typography', 2.5], ['design system', 3], ['wireframe', 2.5], ['mockup', 2.5], ['palette', 2], ['illustration', 2], ['ui kit', 3]],
  writing: [['short story', 3], ['novel', 3], ['chapter', 2.5], ['essay', 2.5], ['manuscript', 3], ['draft', 1], ['prose', 3], ['newsletter', 2], ['screenplay', 3], ['poem', 3]],
  devtool: [['cli', 3], ['sdk', 3], ['npm', 3], ['api', 2], ['library', 2.5], ['open source', 2], ['typescript', 1.5], ['rust crate', 3], ['package', 1.5], ['developer experience', 3], ['docs site', 2], ['github', 1.5], ['pip install', 3]],
}

/** Host rules. Often decisive on their own, so they score above any keyword. */
export const HOST_RULES: ReadonlyArray<[RegExp, ProjectType, number]> = [
  [/(^|\.)itch\.io$/i, 'game', 6],
  [/(^|\.)steampowered\.com$/i, 'game', 6],
  [/(^|\.)npmjs\.com$/i, 'devtool', 6],
  [/(^|\.)crates\.io$/i, 'devtool', 6],
  [/(^|\.)pypi\.org$/i, 'devtool', 6],
  [/(^|\.)youtube\.com$/i, 'video', 6],
  [/(^|\.)youtu\.be$/i, 'video', 6],
  [/(^|\.)vimeo\.com$/i, 'video', 6],
  [/(^|\.)figma\.com$/i, 'design', 6],
  [/(^|\.)dribbble\.com$/i, 'design', 5],
  [/(^|\.)behance\.net$/i, 'design', 5],
  [/(^|\.)apps\.apple\.com$/i, 'mobile_app', 6],
  [/(^|\.)play\.google\.com$/i, 'mobile_app', 6],
  [/(^|\.)testflight\.apple\.com$/i, 'mobile_app', 6],
  [/(^|\.)substack\.com$/i, 'writing', 5],
  [/(^|\.)medium\.com$/i, 'writing', 4],
  [/(^|\.)notion\.so$/i, 'writing', 3],
  [/(^|\.)github\.com$/i, 'devtool', 3],
  [/(^|\.)gitlab\.com$/i, 'devtool', 3],
]

/** Stage vocabulary, most advanced first so the strongest signal wins. */
export const STAGE_KEYWORDS: ReadonlyArray<[ProjectStage, RegExp]> = [
  ['shipped', /\b(shipped|released|out in the world|in production|live on the|on the store)\b/i],
  [
    'launch_ready',
    /\b(launch(?:ing)?|shipping|release candidate|rc\d|go[- ]live|store page|1\.0|v1\b|submitting to)\b/i,
  ],
  ['beta', /\b(beta|open beta|closed beta|public test|preview release|testflight|early access)\b/i],
  ['alpha', /\b(alpha|vertical slice|feature complete|internal test)\b/i],
  ['prototype', /\b(prototype|wip|work in progress|first playable|rough cut|early build|mvp|demo build)\b/i],
  ['concept', /\b(concept|idea|exploring|considering|before i build|paper|pitch|thinking about)\b/i],
]

/** Canonical tag vocabulary, kept small on purpose so it stays curatable. */
export const TAG_VOCABULARY: readonly string[] = [
  'roguelike', 'platformer', 'puzzle', 'deckbuilder', 'metroidvania', 'shooter', 'rpg', 'strategy',
  'simulation', 'narrative', 'pixel-art', 'low-poly', 'multiplayer', 'singleplayer', 'mobile',
  'desktop', 'web', 'console', 'unity', 'godot', 'unreal', 'react', 'nextjs', 'typescript', 'rust',
  'python', 'go', 'swift', 'kotlin', 'flutter', 'cli', 'sdk', 'api', 'developer-tools', 'open-source',
  'saas', 'b2b', 'b2c', 'marketplace', 'productivity', 'education', 'health', 'finance', 'creative-tools',
  'branding', 'typography', 'design-system', 'illustration', 'motion', 'video-essay', 'documentary',
  'tutorial', 'short-form', 'newsletter', 'fiction', 'non-fiction', 'screenplay', 'hardware', 'iot',
  'robotics', '3d-printing', 'accessibility', 'localisation', 'performance', 'security',
]

/**
 * Scaffolds the coach offers, keyed by the check that failed.
 *
 * Every scaffold is an opener that ends where the reviewer starts typing, and
 * never a frame around an empty slot. The composer appends the string and puts
 * the caret at the end of it, so a frame like `I expected , but got ` was
 * published verbatim — stranded punctuation and all — in the reviewer's note.
 */
export type CoachCheck = 'specific' | 'reproducible' | 'contrastive' | 'scoped' | 'onAsk'

type Scaffold = { prompt: string; scaffold: string }

const GENERIC_SCAFFOLDS: Record<CoachCheck, Scaffold> = {
  specific: { prompt: 'Which part of it?', scaffold: 'Specifically, in ' },
  reproducible: { prompt: 'When did this happen?', scaffold: 'This happened when I ' },
  contrastive: { prompt: 'What did you expect instead?', scaffold: 'I expected ' },
  scoped: { prompt: 'Split these into separate points?', scaffold: 'Second point: ' },
  onAsk: { prompt: 'Does this answer the ask?', scaffold: 'On the question you asked: ' },
}

const TYPE_SCAFFOLDS: Partial<Record<ProjectType, Partial<Record<CoachCheck, Scaffold>>>> = {
  game: {
    specific: { prompt: 'Which level or moment?', scaffold: 'In level ' },
    reproducible: { prompt: 'When did this happen?', scaffold: 'In level 2, after the first checkpoint, I ' },
    contrastive: { prompt: 'What did you expect the input to do?', scaffold: 'I pressed ' },
  },
  web_app: {
    specific: { prompt: 'Which screen were you on?', scaffold: 'On the ' },
    reproducible: { prompt: 'What were the steps?', scaffold: 'Steps: 1) ' },
  },
  mobile_app: {
    specific: { prompt: 'Which device and screen?', scaffold: 'On my ' },
    reproducible: { prompt: 'What were you doing?', scaffold: 'After I backgrounded it during ' },
  },
  video: {
    specific: { prompt: 'Which timecode?', scaffold: 'At 0:' },
    reproducible: { prompt: 'Where exactly?', scaffold: 'Between 0:' },
  },
  devtool: {
    specific: { prompt: 'Which call or command?', scaffold: 'Running ' },
    contrastive: { prompt: 'What did the error make you think?', scaffold: 'The error said ' },
  },
  writing: {
    specific: { prompt: 'Which paragraph?', scaffold: 'In the paragraph beginning “' },
  },
  design: {
    specific: { prompt: 'Which element?', scaffold: 'The ' },
  },
}

export function scaffoldFor(check: CoachCheck, projectType?: ProjectType): Scaffold {
  const specific = projectType ? TYPE_SCAFFOLDS[projectType]?.[check] : undefined
  return specific ?? GENERIC_SCAFFOLDS[check]
}

export function isProjectType(value: string): value is ProjectType {
  return (PROJECT_TYPES as readonly string[]).includes(value)
}

export function isProjectStage(value: string): value is ProjectStage {
  return (PROJECT_STAGES as readonly string[]).includes(value)
}
