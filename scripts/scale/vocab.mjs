/**
 * The structural half of the word stock: which needs a type plausibly has,
 * how each kind of work labels its builds, and which severities and
 * actionabilities agree with a point's tone. Everything a person reads is in
 * people.mjs, types/, kinds.mjs, stock.mjs and discourse.mjs, written through
 * writer.mjs.
 */

/**
 * Which kinds of help a project of each type plausibly wants. The feed prints
 * these as "Wants: …" and Discover filters on them, so drawing from the real
 * need_kinds rows matters more than the phrasing does.
 */
export const NEEDS_BY_TYPE = {
  game: ['playtesters', 'bug_hunt', 'usability', 'art_direction', 'technical_review'],
  web_app: ['usability', 'bug_hunt', 'copy_review', 'accessibility_audit', 'technical_review', 'pricing'],
  mobile_app: ['usability', 'bug_hunt', 'accessibility_audit', 'copy_review', 'art_direction'],
  website: ['copy_review', 'positioning', 'accessibility_audit', 'art_direction', 'usability'],
  video: ['art_direction', 'positioning', 'copy_review'],
  business_idea: ['pricing', 'positioning', 'copy_review'],
  hardware: ['technical_review', 'art_direction', 'pricing', 'usability'],
  design: ['art_direction', 'positioning', 'accessibility_audit', 'copy_review'],
  writing: ['copy_review', 'positioning', 'docs_review'],
  api_tool: ['docs_review', 'technical_review', 'bug_hunt', 'usability', 'copy_review'],
}

/**
 * Version labels, by the shape each kind of work actually uses. A film cut and
 * a CLI release are not both "v0.3.1", and calling them that is the sort of
 * detail that quietly tells a reader nobody real is here. Numbered releases
 * also follow the stage: a shipped game is past 1.0 and a release candidate
 * is at 0.9, so neither is labelled like a first prototype.
 */
const semver = (n, stage, patches) =>
  stage === 'shipped' ? `v1.${String(n - 1)}.${String(n % patches)}`
    : stage === 'release_candidate' ? `v0.9.${String(n)}`
      : `v0.${String((stage === 'beta' ? 4 : 0) + n)}.${String(n % patches)}`

export const VERSION_SHAPE = {
  game: (n, stage) => semver(n, stage, 3),
  web_app: (n, stage) => semver(n, stage, 4),
  mobile_app: (n) => `Build ${String(100 + n * 7)}`,
  website: (n) => `Revision ${String(n)}`,
  // A released film is a final cut and a published piece is published, not a draft.
  video: (n, stage) => (stage === 'shipped' ? (n === 1 ? 'Final cut' : `Final cut ${String(n)}`)
    : stage === 'release_candidate' ? `Locked cut ${String(n)}` : `Cut ${String(n)}`),
  business_idea: (n) => `Draft ${String(n)}`,
  hardware: (n) => `Rev ${String.fromCharCode(64 + n)}`,
  design: (n) => `Round ${String(n)}`,
  writing: (n, stage) => (stage === 'shipped' ? (n === 1 ? 'Published' : `Revision ${String(n - 1)}`)
    : stage === 'release_candidate' ? `Final draft ${String(n)}` : `Draft ${String(n)}`),
  api_tool: (n, stage) => semver(n, stage, 5),
}

/** Severity and actionability that agree with the tone of what was written. */
export const TONE_SEVERITY = {
  praise: ['praise', 'praise', 'nit'],
  issue: ['minor', 'minor', 'minor', 'major', 'major', 'blocker'],
  neutral: ['nit', 'nit', 'minor'],
}

export const TONE_ACTIONABILITY = {
  praise: ['observation', 'opinion'],
  issue: ['actionable', 'actionable', 'suggestion', 'opinion'],
  neutral: ['observation', 'observation', 'opinion', 'suggestion'],
}

/**
 * Which categories speak to which rating axis, per type. A rating is a verdict
 * between the axis's two written anchors, so a reviewer who filed a crash
 * rates "Performance & stability" towards "Crashed or stuttered", and one who
 * praised the controls rates "Game feel & controls" towards "Precise". A
 * category that bears on no axis in particular (Confusion, Missing, Copy, and
 * the like) is left out and moves nothing.
 */
export const AXIS_EVIDENCE = {
  game: {
    fun: ['core_loop', 'economy', 'narrative'], balance: ['difficulty_curve', 'combat', 'economy'],
    game_feel: ['controls', 'camera', 'combat'], onboarding: ['tutorial', 'hud', 'art_readability'],
    performance: ['performance', 'bug', 'save_loss', 'netcode'],
  },
  web_app: {
    job_fit: ['core_task', 'integrations', 'pricing'], time_to_value: ['signup', 'empty_state', 'import_export'],
    flow_friction: ['navigation', 'forms', 'friction', 'search', 'responsive'],
    trust_clarity: ['error_handling', 'permissions'], reliability: ['performance', 'bug'],
  },
  mobile_app: {
    first_session: ['install', 'store_listing', 'notifications'], thumb_ergonomics: ['gestures', 'layout_device', 'keyboard', 'haptics'],
    platform_fit: ['dark_mode', 'deep_links', 'nav_structure'], flow_friction: ['friction', 'offline', 'permissions'],
    battery: ['performance', 'crash', 'bug'],
  },
  website: {
    message_clarity: ['hero', 'value_prop', 'positioning'], credibility: ['social_proof', 'pricing_page'],
    scan_find: ['navigation', 'seo', 'mobile_layout', 'broken_link'], conversion_pull: ['cta', 'forms'],
    craft: ['visual_design', 'performance', 'bug'],
  },
  video: {
    hook: ['hook', 'thumbnail'], pacing: ['pacing', 'cut_timing'], story_clarity: ['script', 'vo', 'structure'],
    production_craft: ['audio_mix', 'music', 'color', 'framing', 'graphics', 'broll'], payoff: ['end_screen'],
  },
  business_idea: {
    problem_sharpness: ['problem_definition', 'target_customer'], insight: ['alternatives', 'moat', 'positioning'],
    willingness_to_pay: ['pricing_model', 'unit_economics'], path_to_100: ['gtm', 'timing', 'naming'],
    risk_honesty: ['assumptions', 'regulatory', 'founder_fit'],
  },
  hardware: {
    problem_form_fit: ['industrial_design', 'positioning'], ergonomics: ['ergonomics'],
    build_durability: ['materials', 'mechanism', 'thermals', 'safety'], manufacturability: ['dfm', 'bom', 'packaging', 'repairability'],
    daily_use: ['power', 'connectivity', 'firmware', 'documentation'],
  },
  design: {
    concept_strength: ['concept', 'imagery'], hierarchy: ['composition', 'typography', 'spacing'],
    craft: ['iconography', 'motion', 'file_hygiene'], tone_fit: ['brand_tone', 'color'],
    systemic_durability: ['component_consistency', 'states', 'localization'],
  },
  writing: {
    opening_pull: ['opening', 'title'], structure: ['structure', 'pacing', 'scannability'],
    line_quality: ['line_edit', 'voice', 'repetition', 'dialogue'], reader_clarity: ['jargon', 'argument', 'claim_check', 'tone_fit'],
    ending: ['ending'],
  },
  api_tool: {
    time_to_first_call: ['install', 'quickstart', 'auth'], ergonomics: ['naming', 'types', 'defaults', 'sdk', 'cli', 'pagination'],
    docs_quality: ['docs'], debuggability: ['error_messages', 'observability'],
    production_readiness: ['rate_limits', 'versioning', 'security', 'performance', 'bug'],
  },
}

/** How far one point moves the axis it speaks to, by what the point says. */
export const AXIS_PULL = { blocker: -0.9, major: -0.6, minor: -0.3, nit: -0.1, praise: 0.4 }
