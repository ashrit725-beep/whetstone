/**
 * Which tags a generated project carries.
 *
 * A tag is only worth anything if it is true, so every tag here is read off
 * the project's own world (types/): a roguelike made in Godot is tagged
 * Roguelike and Godot because its tagline, its reviews and its changelog all
 * say so, not because a die landed on those two. The only tags added by
 * chance are the ones a creator adds by taste (Pixel art, Open source) and
 * they are kept to the types where they mean something.
 *
 * Every slug below must exist in TAGS in src/server/db/seed-data.ts, which is
 * the one vocabulary the product knows. populate.mjs refuses to run if one
 * does not, rather than inventing a tag the tag pages cannot label.
 */

import { createHash } from 'node:crypto'

/** Who a thing is for, read off its `who`, shared by the types that name one. */
const AUDIENCE = [
  [/freelanc|sole trader|contractor|translator|illustrator|editor/, 'freelancers'],
  [/café|cafe|bakeri|bar|restaurant|food truck|market|shop|trades|small office|small-business|hospitality|venue|landlord/, 'small-business'],
  [/teacher|tutor|coach|instructor/, 'teachers'],
  [/student|learner|school/, 'students'],
  [/parent|famil|childminder/, 'parents'],
  [/musician|choir|band|orchestra/, 'musicians'],
  [/charit|food bank|volunteer|community|tenants|co-op|allotment societ|club|youth/, 'community-groups'],
  [/photographer/, 'photographers'],
  [/carer|nurse|clinic|patient/, 'carers'],
  [/writer|magazine|newsletter/, 'writers'],
  [/commuter|rider|driver/, 'commuters'],
  [/climb|walker|birder|swimmer|surfer|kayak|angler|forager|runner|cyclist/, 'outdoors'],
  [/beginner|hobbyist|maker|makerspace|studio|ceramic|pottery/, 'makers'],
]

/** Text in the world that names a tag, per type. First match per rule wins. */
const RULES = {
  game: [
    ['genre', [
      [/roguelike/, 'roguelike'], [/deckbuilder/, 'deckbuilder'], [/metroidvania/, 'metroidvania'], [/platformer/, 'platformer'],
      [/puzzle/, 'puzzle'], [/city builder/, 'city-builder'], [/survival|digging/, 'survival'], [/narrative/, 'narrative'],
      [/tactics/, 'tactics'], [/rhythm/, 'rhythm'], [/racing/, 'racing'], [/fishing|farming/, 'cozy'], [/stealth/, 'stealth'],
      [/party/, 'party-game'], [/card game/, 'card-game'], [/shooter|bullet hell/, 'shooter'], [/detective/, 'mystery'],
      [/management/, 'management'], [/sailing/, 'exploration'],
    ]],
    ['engine', [
      [/^Godot$/, 'godot'], [/^Unity$/, 'unity'], [/^Unreal$/, 'unreal'], [/^GameMaker$/, 'gamemaker'], [/^PICO-8$/, 'pico-8'],
      [/^Bevy$/, 'bevy'], [/^LÖVE$/, 'love2d'], [/^Defold$/, 'defold'], [/^Raylib$/, 'raylib'], [/^MonoGame$/, 'monogame'],
      [/^Pyxel$/, 'pyxel'],
    ]],
  ],
  web_app: [
    ['stack', [
      [/Rails/, 'rails'], [/Django/, 'django'], [/SvelteKit/, 'sveltekit'], [/Phoenix|LiveView/, 'elixir'], [/Laravel|PHP/, 'php'],
      [/Next\.js/, 'nextjs'], [/Remix/, 'remix'], [/htmx/, 'htmx'], [/Flask/, 'flask'], [/Nuxt/, 'nuxt'], [/Deno/, 'deno'],
      [/Astro/, 'astro'],
    ]],
    ['who', AUDIENCE],
  ],
  mobile_app: [
    ['stack', [
      [/SwiftUI|UIKit/, 'swift'], [/Flutter/, 'flutter'], [/Kotlin/, 'kotlin'], [/React Native|Expo/, 'react-native'],
    ]],
    ['who', AUDIENCE],
    ['topic', [
      [/tide|bird|foraging|fishing|bouldering|cycle|run club/, 'outdoors'], [/medication|sleep|meditation|baby/, 'health'],
      [/sourdough|pantry/, 'food-and-drink'], [/guitar/, 'music'], [/bus|parking/, 'transit'], [/plant/, 'gardening'],
      [/flashcard/, 'education'], [/receipt/, 'finance'], [/sketch/, 'illustration'],
    ]],
  ],
  website: [
    ['stack', [
      [/Astro/, 'astro'], [/Eleventy/, 'eleventy'], [/hand-written/, 'html-and-css'], [/Webflow/, 'webflow'], [/WordPress/, 'wordpress'],
      [/Hugo/, 'hugo'], [/Next\.js/, 'nextjs'], [/Squarespace/, 'squarespace'], [/Kirby/, 'kirby'], [/Jekyll/, 'jekyll'],
      [/Framer/, 'framer'], [/Ghost/, 'ghost'],
    ]],
    ['topic', [
      [/ceramic|pottery|illustrator|tattoo|font foundry|design agency|design studio|design practice/, 'makers'],
      [/coffee|bakery/, 'food-and-drink'], [/dance|record label/, 'music'], [/physio/, 'health'], [/climbing|bicycle/, 'outdoors'],
      [/translation/, 'translators'], [/open-source/, 'open-source'], [/newspaper/, 'editorial'], [/language school/, 'education'],
      [/conference/, 'developers'], [/theatre/, 'community-groups'], [/zero-waste/, 'sustainability'], [/photographer/, 'photographers'],
      [/portfolio/, 'freelancers'],
    ]],
  ],
  api_tool: [
    ['lang', [
      [/^Rust$/, 'rust'], [/^Go$/, 'go'], [/^TypeScript$/, 'typescript'], [/^Python$/, 'python'], [/^Ruby$/, 'ruby'],
      [/^Elixir$/, 'elixir'], [/^Kotlin$/, 'kotlin'],
    ]],
    ['toolKind', [[/CLI|linter/, 'cli']]],
    ['topic', [
      [/migrations|SQL|job queues/, 'databases'], [/deploys|backups|Git hooks|webhooks|load generation|dotfiles/, 'devops'],
      [/secret|rate limiting/, 'security'], [/static sites|site search|image optimisation/, 'web'], [/translation/, 'translators'],
      [/PDF|CSV/, 'productivity'],
    ]],
  ],
  design: [
    ['briefKind', [
      [/identity|festival|menu/, 'branding'], [/typeface/, 'typography'], [/posters/, 'posters'], [/icons|appicon/, 'icons'],
      [/packaging/, 'packaging'], [/wayfinding/, 'wayfinding'], [/system/, 'design-system'], [/book|report/, 'editorial'],
      [/album/, 'music'], [/illustration/, 'illustration'],
    ]],
    ['tool', [
      [/Figma/, 'figma'], [/Glyphs|FontLab|RoboFont/, 'typography'], [/Procreate/, 'procreate'], [/risograph/, 'risograph'],
      [/InDesign/, 'print'],
    ]],
  ],
  hardware: [
    ['board', [
      [/ESP32/, 'esp32'], [/RP2040/, 'rp2040'], [/nRF52/, 'nrf52'], [/STM32/, 'stm32'], [/ATmega/, 'arduino'], [/Raspberry Pi/, 'raspberry-pi'],
    ]],
    ['tool', [[/KiCad/, 'kicad'], [/Fusion|Onshape|SolidWorks|FreeCAD/, 'cad'], [/Prusa/, '3d-printing']]],
    ['what', [
      [/keyboard|trackball/, 'keyboards'], [/soil|irrigation|watering|hive|weather/, 'gardening'], [/recorder|synth|pedal|audio player/, 'audio'],
      [/e-ink|bus|train|tram/, 'transit'], [/bike/, 'cyclists'], [/kitchen scale|coffee/, 'food-and-drink'], [/braille/, 'accessibility'],
      [/CO₂|lamp|doorbell/, 'smart-home'], [/camera slider/, 'photographers'], [/game console/, 'retro'],
    ]],
  ],
  video: [
    ['form', [
      [/documentary/, 'documentary'], [/music video/, 'music-video'], [/video essay/, 'video-essay'], [/short film|animated short/, 'short-film'],
      [/tutorial|cooking video|explainer/, 'tutorial'], [/travel/, 'travel'], [/product film|trailer/, 'short-form'],
    ]],
    ['tool', [[/Resolve/, 'davinci-resolve'], [/Premiere/, 'premiere'], [/Final Cut/, 'final-cut'], [/Avid/, 'avid']]],
    ['form', [[/animated/, 'animation'], [/YouTube/, 'youtube']]],
  ],
  writing: [
    ['form', [
      [/personal essay/, 'personal-essay'], [/essay|longform article/, 'essay'], [/short story|novel chapter|picture book/, 'fiction'],
      [/newsletter/, 'newsletter'], [/technical guide|manual/, 'technical-writing'], [/zine/, 'zines'], [/poetry/, 'poetry'],
      [/grant/, 'nonprofits'],
    ]],
    ['platform', [[/Substack/, 'substack'], [/Ghost/, 'ghost'], [/Buttondown/, 'newsletter'], [/zine|magazine|anthology|paper/, 'print']]],
    ['tool', [[/Scrivener/, 'scrivener'], [/Obsidian/, 'obsidian']]],
  ],
  business_idea: [
    ['model', [
      [/subscription|membership|retainer/, 'subscription'], [/commission|consignment|booking fee|per-booking/, 'marketplace'],
      [/rental|hire/, 'rental'], [/course fee/, 'education'], [/day rate|hourly margin|monthly fee/, 'services'],
    ]],
    ['who', AUDIENCE],
    ['idea', [
      [/co-op|cooperative|collective|buying club/, 'co-ops'], [/refill|zero-waste|repair|used-kit|second-hand/, 'sustainability'],
      [/kitchen|meal|lunch|food/, 'food-and-drink'], [/delivery|courier/, 'local-business'],
    ]],
  ],
}


/**
 * Tags a creator adds by taste, per type, with how often. Only where they are
 * a real choice the project could have made.
 */
const TASTE = {
  game: [['pixel-art', 0.34], ['steam', 0.52], ['co-op', 0.08], ['web', 0.14], ['hand-drawn', 0.1], ['accessibility', 0.04]],
  web_app: [['web', 0.7], ['open-source', 0.1], ['offline-first', 0.06], ['accessibility', 0.06], ['typescript', 0.22]],
  mobile_app: [['offline-first', 0.12], ['accessibility', 0.08]],
  website: [['web', 0.55], ['accessibility', 0.1]],
  api_tool: [['developer-tools', 0.78], ['open-source', 0.62], ['sqlite', 0.06]],
  design: [['accessibility', 0.06]],
  hardware: [['open-hardware', 0.3], ['energy', 0.08]],
  video: [],
  writing: [],
  business_idea: [['local-business', 0.3]],
}

/**
 * Tags that are true of most projects of a type say little about any one of
 * them: nearly every enclosure is drawn in some CAD package, and nearly half
 * of all writing ends up on paper somewhere. Tagged every time, CAD and Print
 * outranked whole genres on the tag index. Creators add them when the tool or
 * the medium is part of the pitch, which is about this often.
 */
const SOMETIMES = { cad: 0.3, print: 0.45 }
/**
 * That choice comes from a hash of the project rather than the caller's coin,
 * so tuning a rate here never shifts the structure stream everything after
 * the tags is drawn from.
 */
const byTaste = (key, slug) =>
  parseInt(createHash('sha1').update(`tag:${key}:${slug}`).digest('hex').slice(0, 8), 16) / 0x1_0000_0000 < SOMETIMES[slug]

/**
 * Platforms follow from the stack: a SwiftUI app is on iOS, a Kotlin and
 * Compose app is on Android, and a cross-platform one is on both.
 */
function platforms(typeSlug, world, chance) {
  if (typeSlug === 'mobile_app') {
    if (/SwiftUI|UIKit/.test(world.stack)) return ['ios']
    if (/Kotlin and Compose/.test(world.stack)) return ['android']
    return chance(0.8) ? ['ios', 'android'] : [chance(0.5) ? 'ios' : 'android']
  }
  if (typeSlug === 'game') {
    if (/PICO-8|Pyxel/.test(world.engine ?? '')) return ['web']
    return []
  }
  return []
}

/**
 * A project's tags, most specific first, capped at five. `chance` is the
 * caller's own seeded coin, so tags move with the rest of the structure;
 * `key` is the project's id, which the tags in SOMETIMES are decided from.
 */
export function tagsFor(typeSlug, world, chance, key) {
  const out = []
  const add = (slug) => {
    if (slug && !out.includes(slug)) out.push(slug)
  }
  for (const [field, table] of RULES[typeSlug] ?? []) {
    const value = String(world[field] ?? '')
    const hit = table.find(([re]) => re.test(value))
    if (hit && (!(hit[1] in SOMETIMES) || byTaste(key, hit[1]))) add(hit[1])
  }
  for (const slug of platforms(typeSlug, world, chance)) add(slug)
  for (const [slug, p] of TASTE[typeSlug] ?? []) {
    // A web-only engine is not on Steam, and a game on Steam is only on the
    // Deck if somebody checked.
    if (slug === 'steam' && out.includes('web')) continue
    if (chance(p)) add(slug)
  }
  if (out.includes('steam') && chance(0.3)) add('steam-deck')
  if (out.includes('pico-8') || out.includes('pyxel')) add('pixel-art')
  return out.slice(0, 5)
}

/** Every slug this module can hand out, so a missing tag fails loudly and early. */
export function everyTag() {
  const all = new Set()
  for (const rules of Object.values(RULES)) for (const [, table] of rules) for (const [, slug] of table) all.add(slug)
  for (const [, slug] of AUDIENCE) all.add(slug)
  for (const list of Object.values(TASTE)) for (const [slug] of list) all.add(slug)
  for (const slug of ['ios', 'android', 'web', 'steam-deck', 'pixel-art']) all.add(slug)
  return all
}
