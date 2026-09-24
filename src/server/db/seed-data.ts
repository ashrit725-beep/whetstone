/**
 * Whetstone seed content.
 *
 * Pure data. No database access, no Date.now(), no randomness. Every timestamp
 * is expressed as an offset in days before a base instant, so `scripts/seed.ts`
 * can resolve the whole dataset against the moment it runs, or against `--now`,
 * and produce the same rows for the same instant every time.
 *
 * Content rules that hold for every string in this file, because these strings
 * are rendered: curly quotes, ellipsis character, en dash for numeric ranges,
 * no em dash, no straight quotes, no all-caps emphasis.
 */

/* -------------------------------------------------------------------------- */
/* 1. Keys shared with the taxonomy                                           */
/* -------------------------------------------------------------------------- */

/**
 * The taxonomy itself lives in `src/lib/taxonomy.ts`: the ten project types,
 * their rating axes, their category vocabularies, the five grit stages, the
 * need kinds and the expertise areas. The seed script reads it directly, so
 * this file carries only the keys it needs to point at rows there, and there
 * is exactly one definition of each in the codebase.
 *
 * Every key below is checked against the taxonomy before the first insert.
 */

export type StageKey = 'concept' | 'prototype' | 'beta' | 'release_candidate' | 'shipped'

export type TypeSlug =
  | 'game'
  | 'web_app'
  | 'mobile_app'
  | 'website'
  | 'video'
  | 'business_idea'
  | 'hardware'
  | 'design'
  | 'writing'
  | 'api_tool'

/* -------------------------------------------------------------------------- */
/* 2. Vocabularies that belong to the seed alone                              */
/* -------------------------------------------------------------------------- */

export interface TagDef {
  readonly slug: string
  readonly label: string
  readonly kind: 'topic' | 'tech' | 'genre' | 'platform' | 'audience'
}

export const TAGS: readonly TagDef[] = [
  { slug: 'roguelike', label: 'Roguelike', kind: 'genre' },
  { slug: 'deckbuilder', label: 'Deckbuilder', kind: 'genre' },
  { slug: 'platformer', label: 'Platformer', kind: 'genre' },
  { slug: 'puzzle', label: 'Puzzle', kind: 'genre' },
  { slug: 'co-op', label: 'Co-op', kind: 'genre' },
  { slug: 'pixel-art', label: 'Pixel art', kind: 'topic' },
  { slug: 'godot', label: 'Godot', kind: 'tech' },
  { slug: 'unity', label: 'Unity', kind: 'tech' },
  { slug: 'rust', label: 'Rust', kind: 'tech' },
  { slug: 'typescript', label: 'TypeScript', kind: 'tech' },
  { slug: 'swift', label: 'Swift', kind: 'tech' },
  { slug: 'sqlite', label: 'SQLite', kind: 'tech' },
  { slug: 'steam', label: 'Steam', kind: 'platform' },
  { slug: 'ios', label: 'iOS', kind: 'platform' },
  { slug: 'android', label: 'Android', kind: 'platform' },
  { slug: 'web', label: 'Web', kind: 'platform' },
  { slug: 'steam-deck', label: 'Steam Deck', kind: 'platform' },
  { slug: 'freelancers', label: 'Freelancers', kind: 'audience' },
  { slug: 'small-business', label: 'Small business', kind: 'audience' },
  { slug: 'restaurants', label: 'Restaurants', kind: 'audience' },
  { slug: 'translators', label: 'Translators', kind: 'audience' },
  { slug: 'commuters', label: 'Commuters', kind: 'audience' },
  { slug: 'documentary', label: 'Documentary', kind: 'topic' },
  { slug: 'short-form', label: 'Short form', kind: 'topic' },
  { slug: 'music-video', label: 'Music video', kind: 'topic' },
  { slug: 'branding', label: 'Branding', kind: 'topic' },
  { slug: 'design-system', label: 'Design system', kind: 'topic' },
  { slug: 'keyboards', label: 'Keyboards', kind: 'topic' },
  { slug: 'camping', label: 'Camping', kind: 'topic' },
  { slug: 'fiction', label: 'Fiction', kind: 'topic' },
  { slug: 'essay', label: 'Essay', kind: 'topic' },
  { slug: 'developer-tools', label: 'Developer tools', kind: 'topic' },
  { slug: 'accessibility', label: 'Accessibility', kind: 'topic' },
  { slug: 'offline-first', label: 'Offline first', kind: 'topic' },
  { slug: 'energy', label: 'Energy', kind: 'topic' },
  { slug: 'city-builder', label: 'City builder', kind: 'genre' },
  { slug: 'survival', label: 'Survival', kind: 'genre' },
  { slug: 'narrative', label: 'Narrative', kind: 'genre' },
  { slug: 'tactics', label: 'Tactics', kind: 'genre' },
  { slug: 'rhythm', label: 'Rhythm', kind: 'genre' },
  { slug: 'racing', label: 'Racing', kind: 'genre' },
  { slug: 'metroidvania', label: 'Metroidvania', kind: 'genre' },
  { slug: 'cozy', label: 'Cozy', kind: 'genre' },
  { slug: 'stealth', label: 'Stealth', kind: 'genre' },
  { slug: 'party-game', label: 'Party game', kind: 'genre' },
  { slug: 'card-game', label: 'Card game', kind: 'genre' },
  { slug: 'shooter', label: 'Shooter', kind: 'genre' },
  { slug: 'mystery', label: 'Mystery', kind: 'genre' },
  { slug: 'management', label: 'Management', kind: 'genre' },
  { slug: 'exploration', label: 'Exploration', kind: 'genre' },
  { slug: 'video-essay', label: 'Video essay', kind: 'genre' },
  { slug: 'short-film', label: 'Short film', kind: 'genre' },
  { slug: 'tutorial', label: 'Tutorial', kind: 'genre' },
  { slug: 'travel', label: 'Travel', kind: 'genre' },
  { slug: 'animation', label: 'Animation', kind: 'genre' },
  { slug: 'personal-essay', label: 'Personal essay', kind: 'genre' },
  { slug: 'newsletter', label: 'Newsletter', kind: 'genre' },
  { slug: 'technical-writing', label: 'Technical writing', kind: 'genre' },
  { slug: 'zines', label: 'Zines', kind: 'genre' },
  { slug: 'poetry', label: 'Poetry', kind: 'genre' },
  { slug: 'unreal', label: 'Unreal', kind: 'tech' },
  { slug: 'gamemaker', label: 'GameMaker', kind: 'tech' },
  { slug: 'pico-8', label: 'PICO-8', kind: 'tech' },
  { slug: 'bevy', label: 'Bevy', kind: 'tech' },
  { slug: 'love2d', label: 'LÖVE', kind: 'tech' },
  { slug: 'defold', label: 'Defold', kind: 'tech' },
  { slug: 'raylib', label: 'raylib', kind: 'tech' },
  { slug: 'monogame', label: 'MonoGame', kind: 'tech' },
  { slug: 'pyxel', label: 'Pyxel', kind: 'tech' },
  { slug: 'rails', label: 'Rails', kind: 'tech' },
  { slug: 'django', label: 'Django', kind: 'tech' },
  { slug: 'sveltekit', label: 'SvelteKit', kind: 'tech' },
  { slug: 'elixir', label: 'Elixir', kind: 'tech' },
  { slug: 'php', label: 'PHP', kind: 'tech' },
  { slug: 'nextjs', label: 'Next.js', kind: 'tech' },
  { slug: 'remix', label: 'Remix', kind: 'tech' },
  { slug: 'htmx', label: 'htmx', kind: 'tech' },
  { slug: 'flask', label: 'Flask', kind: 'tech' },
  { slug: 'nuxt', label: 'Nuxt', kind: 'tech' },
  { slug: 'deno', label: 'Deno', kind: 'tech' },
  { slug: 'astro', label: 'Astro', kind: 'tech' },
  { slug: 'flutter', label: 'Flutter', kind: 'tech' },
  { slug: 'kotlin', label: 'Kotlin', kind: 'tech' },
  { slug: 'react-native', label: 'React Native', kind: 'tech' },
  { slug: 'eleventy', label: 'Eleventy', kind: 'tech' },
  { slug: 'html-and-css', label: 'HTML and CSS', kind: 'tech' },
  { slug: 'webflow', label: 'Webflow', kind: 'tech' },
  { slug: 'wordpress', label: 'WordPress', kind: 'tech' },
  { slug: 'hugo', label: 'Hugo', kind: 'tech' },
  { slug: 'squarespace', label: 'Squarespace', kind: 'tech' },
  { slug: 'kirby', label: 'Kirby', kind: 'tech' },
  { slug: 'jekyll', label: 'Jekyll', kind: 'tech' },
  { slug: 'framer', label: 'Framer', kind: 'tech' },
  { slug: 'ghost', label: 'Ghost', kind: 'tech' },
  { slug: 'go', label: 'Go', kind: 'tech' },
  { slug: 'python', label: 'Python', kind: 'tech' },
  { slug: 'ruby', label: 'Ruby', kind: 'tech' },
  { slug: 'cli', label: 'Command line', kind: 'tech' },
  { slug: 'figma', label: 'Figma', kind: 'tech' },
  { slug: 'procreate', label: 'Procreate', kind: 'tech' },
  { slug: 'risograph', label: 'Risograph', kind: 'tech' },
  { slug: 'esp32', label: 'ESP32', kind: 'tech' },
  { slug: 'rp2040', label: 'RP2040', kind: 'tech' },
  { slug: 'nrf52', label: 'nRF52', kind: 'tech' },
  { slug: 'stm32', label: 'STM32', kind: 'tech' },
  { slug: 'arduino', label: 'Arduino', kind: 'tech' },
  { slug: 'raspberry-pi', label: 'Raspberry Pi', kind: 'tech' },
  { slug: 'kicad', label: 'KiCad', kind: 'tech' },
  { slug: 'cad', label: 'CAD', kind: 'tech' },
  { slug: '3d-printing', label: '3D printing', kind: 'tech' },
  { slug: 'davinci-resolve', label: 'DaVinci Resolve', kind: 'tech' },
  { slug: 'premiere', label: 'Premiere', kind: 'tech' },
  { slug: 'final-cut', label: 'Final Cut', kind: 'tech' },
  { slug: 'avid', label: 'Avid', kind: 'tech' },
  { slug: 'scrivener', label: 'Scrivener', kind: 'tech' },
  { slug: 'obsidian', label: 'Obsidian', kind: 'tech' },
  { slug: 'substack', label: 'Substack', kind: 'platform' },
  { slug: 'print', label: 'Print', kind: 'platform' },
  { slug: 'youtube', label: 'YouTube', kind: 'platform' },
  { slug: 'teachers', label: 'Teachers', kind: 'audience' },
  { slug: 'students', label: 'Students', kind: 'audience' },
  { slug: 'parents', label: 'Parents', kind: 'audience' },
  { slug: 'musicians', label: 'Musicians', kind: 'audience' },
  { slug: 'community-groups', label: 'Community groups', kind: 'audience' },
  { slug: 'photographers', label: 'Photographers', kind: 'audience' },
  { slug: 'carers', label: 'Carers', kind: 'audience' },
  { slug: 'writers', label: 'Writers', kind: 'audience' },
  { slug: 'makers', label: 'Makers', kind: 'audience' },
  { slug: 'cyclists', label: 'Cyclists', kind: 'audience' },
  { slug: 'developers', label: 'Developers', kind: 'audience' },
  { slug: 'nonprofits', label: 'Nonprofits', kind: 'audience' },
  { slug: 'health', label: 'Health', kind: 'topic' },
  { slug: 'food-and-drink', label: 'Food and drink', kind: 'topic' },
  { slug: 'music', label: 'Music', kind: 'topic' },
  { slug: 'transit', label: 'Transit', kind: 'topic' },
  { slug: 'gardening', label: 'Gardening', kind: 'topic' },
  { slug: 'education', label: 'Education', kind: 'topic' },
  { slug: 'finance', label: 'Finance', kind: 'topic' },
  { slug: 'illustration', label: 'Illustration', kind: 'topic' },
  { slug: 'outdoors', label: 'Outdoors', kind: 'topic' },
  { slug: 'open-source', label: 'Open source', kind: 'topic' },
  { slug: 'editorial', label: 'Editorial', kind: 'topic' },
  { slug: 'sustainability', label: 'Sustainability', kind: 'topic' },
  { slug: 'databases', label: 'Databases', kind: 'topic' },
  { slug: 'devops', label: 'DevOps', kind: 'topic' },
  { slug: 'security', label: 'Security', kind: 'topic' },
  { slug: 'productivity', label: 'Productivity', kind: 'topic' },
  { slug: 'typography', label: 'Typography', kind: 'topic' },
  { slug: 'posters', label: 'Posters', kind: 'topic' },
  { slug: 'icons', label: 'Icons', kind: 'topic' },
  { slug: 'packaging', label: 'Packaging', kind: 'topic' },
  { slug: 'wayfinding', label: 'Wayfinding', kind: 'topic' },
  { slug: 'audio', label: 'Audio', kind: 'topic' },
  { slug: 'smart-home', label: 'Smart home', kind: 'topic' },
  { slug: 'retro', label: 'Retro', kind: 'topic' },
  { slug: 'subscription', label: 'Subscription', kind: 'topic' },
  { slug: 'marketplace', label: 'Marketplace', kind: 'topic' },
  { slug: 'rental', label: 'Rental', kind: 'topic' },
  { slug: 'services', label: 'Services', kind: 'topic' },
  { slug: 'co-ops', label: 'Co-ops', kind: 'topic' },
  { slug: 'local-business', label: 'Local business', kind: 'topic' },
  { slug: 'hand-drawn', label: 'Hand-drawn', kind: 'topic' },
  { slug: 'open-hardware', label: 'Open hardware', kind: 'topic' },
]

export interface BadgeDef {
  readonly slug: string
  readonly label: string
  readonly description: string
  readonly icon: string
  readonly tier: 'bronze' | 'silver' | 'gold' | 'special'
  readonly facet: 'reviewer' | 'creator' | 'community' | 'expert'
}

export const BADGES: readonly BadgeDef[] = [
  {
    slug: 'first-pass',
    label: 'First pass',
    description: 'Submitted a first structured review.',
    icon: 'flag',
    tier: 'bronze',
    facet: 'reviewer',
  },
  {
    slug: 'repro-writer',
    label: 'Repro writer',
    description: 'Three bug reports with steps, result and expectation filled in.',
    icon: 'list-checks',
    tier: 'silver',
    facet: 'reviewer',
  },
  {
    slug: 'blocker-finder',
    label: 'Blocker finder',
    description: 'Found two blockers a creator confirmed and acted on.',
    icon: 'octagon-alert',
    tier: 'gold',
    facet: 'reviewer',
  },
  {
    slug: 'shipped-it',
    label: 'Shipped it',
    description: 'A suggestion you wrote reached a released version.',
    icon: 'package-check',
    tier: 'silver',
    facet: 'reviewer',
  },
  {
    slug: 'answers-everyone',
    label: 'Answers everyone',
    description: 'Replied to every piece of feedback on a project.',
    icon: 'message-square-reply',
    tier: 'silver',
    facet: 'creator',
  },
  {
    slug: 'open-bench',
    label: 'Open bench',
    description: 'Published two projects with a written ask.',
    icon: 'layers',
    tier: 'bronze',
    facet: 'creator',
  },
  {
    slug: 'closed-the-loop',
    label: 'Closed the loop',
    description: 'Shipped two tracked suggestions and credited the reviewers.',
    icon: 'git-merge',
    tier: 'gold',
    facet: 'creator',
  },
  {
    slug: 'good-question',
    label: 'Good question',
    description: 'Asked a thread that earned an accepted answer.',
    icon: 'help-circle',
    tier: 'bronze',
    facet: 'community',
  },
  {
    slug: 'verified-expert',
    label: 'Verified expert',
    description: 'Credentials reviewed and confirmed by two existing experts.',
    icon: 'badge-check',
    tier: 'special',
    facet: 'expert',
  },
  {
    slug: 'on-time',
    label: 'On time',
    description: 'Delivered two paid reviews before the deadline.',
    icon: 'clock',
    tier: 'gold',
    facet: 'expert',
  },
]

export interface ChannelDef {
  readonly slug: string
  readonly label: string
  readonly description: string
  readonly icon: string
}

export const DISCUSSION_CHANNELS: readonly ChannelDef[] = [
  {
    slug: 'playtesting',
    label: 'Playtesting',
    description: 'Running sessions, recruiting testers, and reading what comes back.',
    icon: 'joystick',
  },
  {
    slug: 'giving-feedback',
    label: 'Giving feedback',
    description: 'How to say the hard thing so it gets used.',
    icon: 'message-square',
  },
  {
    slug: 'pricing',
    label: 'Pricing & money',
    description: 'Rates, bounties, and what work is worth.',
    icon: 'banknote',
  },
  {
    slug: 'craft',
    label: 'Craft',
    description: 'Type, sound, code, tolerance, the cut. The work itself.',
    icon: 'ruler',
  },
  {
    slug: 'show-your-work',
    label: 'Show your work',
    description: 'Post a build, a cut, a page, a board. Say what you are unsure about.',
    icon: 'image',
  },
  {
    slug: 'whetstone-meta',
    label: 'About Whetstone',
    description: 'Feature requests, bugs in the site itself, and moderation questions.',
    icon: 'settings',
  },
]

/* -------------------------------------------------------------------------- */
/* 4. People                                                                  */
/* -------------------------------------------------------------------------- */

export type PrimaryRole =
  | 'indie_dev'
  | 'game_dev'
  | 'founder'
  | 'designer'
  | 'video_creator'
  | 'reviewer'
  | 'other'

export type LinkPlatform =
  | 'website'
  | 'github'
  | 'gitlab'
  | 'steam'
  | 'itch'
  | 'appstore'
  | 'playstore'
  | 'youtube'
  | 'twitch'
  | 'x'
  | 'bluesky'
  | 'mastodon'
  | 'linkedin'
  | 'discord'
  | 'other'

export interface SeedExpertise {
  readonly area: string
  readonly level: 'familiar' | 'practitioner' | 'specialist'
}

export interface SeedExpert {
  readonly headline: string
  readonly pitch: string
  readonly hourlyRateCents: number
  readonly minBountyCents: number
  readonly turnaroundHours: number
  readonly capacityPerWeek: number
  readonly yearsExperience: number
  readonly listed: boolean
  readonly expertise: readonly SeedExpertise[]
  /** The credential chip. It says who they are; it never moves the score. */
  readonly credential: { readonly kind: string; readonly area: string; readonly claim: string }
  readonly verifiedDaysAgo: number
  readonly payout?: { readonly provider: 'stripe' | 'paypal' | 'wise'; readonly display: string }
}

export interface SeedUser {
  readonly handle: string
  readonly name: string
  readonly email: string
  readonly primaryRole: PrimaryRole
  readonly location: string
  readonly pronouns?: string
  readonly timezone: string
  /** Literata. One paragraph, written the way this particular person talks. */
  readonly bio: string
  readonly joinedDaysAgo: number
  readonly lastSeenDaysAgo: number
  readonly availability: 'open' | 'limited' | 'closed'
  readonly theme: 'system' | 'dark' | 'light'
  readonly role?: 'member' | 'moderator' | 'admin'
  readonly links: readonly { readonly label: string; readonly url: string; readonly platform: LinkPlatform }[]
  readonly expert?: SeedExpert
}

/**
 * The one seeded account that can sign in, which the verification scripts use.
 * Every other seeded or generated member has no password at all: they exist as
 * authors, not as logins, and a shared password on five thousand accounts is
 * five thousand ways in.
 *
 * The password is read from SEED_PASSWORD when the database is built. Outside
 * production it falls back to a local default so `npm run db:rebuild` works
 * with no setup; a production build without SEED_PASSWORD gets no password,
 * which leaves the account usable only through a reset link.
 */
export const SIGN_IN_HANDLE = 'mirasolvang'
export function seedPassword(): string | null {
  const configured = process.env.SEED_PASSWORD?.trim()
  if (configured) return configured
  return process.env.NODE_ENV === 'production' ? null : 'whetstone'
}

export const USERS: readonly SeedUser[] = [
  {
    handle: 'mirasolvang',
    name: 'Mira Solvang',
    email: 'mira@brinehollow.dev',
    primaryRole: 'game_dev',
    location: 'Oslo, Norway',
    pronouns: 'she/her',
    timezone: 'Europe/Oslo',
    bio: 'I make one game at a time and I make it slowly. Brinehollow is four years old, has been rebuilt twice, and is finally close enough that strangers can play it without me sitting next to them. I read every piece of feedback the week it arrives, and I write back even when the answer is that I disagree. Before this I spent nine years on other people’s combat systems, which is why I am so tedious about input buffers.',
    joinedDaysAgo: 612,
    lastSeenDaysAgo: 0,
    availability: 'limited',
    theme: 'dark',
    links: [
      { label: 'brinehollow.dev', url: 'https://brinehollow.dev', platform: 'website' },
      { label: 'Devlog', url: 'https://mirasolvang.itch.io/brinehollow', platform: 'itch' },
    ],
  },
  {
    handle: 'tobiadeyemi',
    name: 'Tobi Adeyemi',
    email: 'tobi@adeyemi.design',
    primaryRole: 'designer',
    location: 'Lagos, Nigeria',
    pronouns: 'he/him',
    timezone: 'Africa/Lagos',
    bio: 'Product designer, eleven years, most of them spent on the first five minutes of a product. I have watched about four hundred people open software for the first time, and the same six things go wrong every time. I review onboarding here because it is the cheapest thing to fix and the most expensive thing to get wrong. If you send me a build I will send you a timestamped session, not adjectives.',
    joinedDaysAgo: 548,
    lastSeenDaysAgo: 0,
    availability: 'open',
    theme: 'system',
    links: [
      { label: 'adeyemi.design', url: 'https://adeyemi.design', platform: 'website' },
      { label: 'Bluesky', url: 'https://bsky.app/profile/tobiadeyemi.design', platform: 'bluesky' },
    ],
    expert: {
      headline: 'Onboarding and first-session review for apps and games',
      pitch: 'You get a recorded run of your first session with a running commentary, then a written list of every place I hesitated, ordered by how many people I think will hesitate there too. I name the fix where I am confident and say so plainly where I am guessing. I do not review visual design unless you ask; there are better people for that on this site.',
      hourlyRateCents: 16000,
      minBountyCents: 24000,
      turnaroundHours: 72,
      capacityPerWeek: 3,
      yearsExperience: 11,
      listed: true,
      expertise: [
        { area: 'ux-research', level: 'specialist' },
        { area: 'product-design', level: 'specialist' },
        { area: 'game-design', level: 'practitioner' },
      ],
      credential: {
        kind: 'domain_expert',
        area: 'ux-research',
        claim: 'Led onboarding at two consumer products with more than a million installs, and published the session protocol used here.',
      },
      verifiedDaysAgo: 300,
      payout: { provider: 'stripe', display: 'Stripe, NGN payout' },
    },
  },
  {
    handle: 'priyaram',
    name: 'Priya Ramanathan',
    email: 'priya@tallyroot.co',
    primaryRole: 'founder',
    location: 'Bengaluru, India',
    pronouns: 'she/her',
    timezone: 'Asia/Kolkata',
    bio: 'I build Tallyroot, which is invoicing software for freelance translators, which is a smaller market than my last investor would have liked. Fourteen paying customers, all of whom have my phone number. I post here mostly to find out which parts of the product only make sense to me because I have stared at them for two years.',
    joinedDaysAgo: 421,
    lastSeenDaysAgo: 1,
    availability: 'open',
    theme: 'light',
    links: [
      { label: 'tallyroot.co', url: 'https://tallyroot.co', platform: 'website' },
      { label: 'Changelog', url: 'https://tallyroot.co/changelog', platform: 'other' },
    ],
  },
  {
    handle: 'casperlq',
    name: 'Casper Lindqvist',
    email: 'casper@lindqvist.film',
    primaryRole: 'video_creator',
    location: 'Gothenburg, Sweden',
    pronouns: 'he/him',
    timezone: 'Europe/Stockholm',
    bio: 'Documentary editor. Sixteen years in the room where a two hour interview becomes four minutes. I cut mostly archive-led work and I care too much about where a breath lands. When I review a cut I give you timecodes and nothing else, because an adjective has never once helped me in a suite.',
    joinedDaysAgo: 503,
    lastSeenDaysAgo: 0,
    availability: 'limited',
    theme: 'dark',
    links: [
      { label: 'lindqvist.film', url: 'https://lindqvist.film', platform: 'website' },
      { label: 'Selected work', url: 'https://vimeo.com/lindqvistfilm', platform: 'other' },
    ],
    expert: {
      headline: 'Cut review for documentary and long-form video',
      pitch: 'Send me a locked or unlocked cut and I return a timecoded pass: every place attention drops, every place the audio fights the picture, and the three chunks I would cut first with the runtime you get back. I have done this on about ninety broadcast cuts. I will not touch your colour; that is somebody else’s job.',
      hourlyRateCents: 21000,
      minBountyCents: 30000,
      turnaroundHours: 96,
      capacityPerWeek: 2,
      yearsExperience: 16,
      listed: true,
      expertise: [
        { area: 'video-editing', level: 'specialist' },
        { area: 'writing-editing', level: 'practitioner' },
      ],
      credential: {
        kind: 'shipped_titles',
        area: 'video-editing',
        claim: 'Lead editor on four broadcast documentaries, two of them archive-led feature length.',
      },
      verifiedDaysAgo: 268,
      payout: { provider: 'wise', display: 'Wise, SEK payout' },
    },
  },
  {
    handle: 'nkechiobi',
    name: 'Nkechi Obi',
    email: 'nkechi@obi.works',
    primaryRole: 'indie_dev',
    location: 'Manchester, United Kingdom',
    pronouns: 'she/her',
    timezone: 'Europe/London',
    bio: 'Accessibility engineer by day, maintainer of a small audit tool by night. I test with a screen reader because I use one for part of my work, not as a thought experiment. My reviews are unglamorous: focus order, names, contrast ratios, and the modal that traps you. Fixing those is usually two days of work and it is the difference between a product somebody can use and one they cannot.',
    joinedDaysAgo: 466,
    lastSeenDaysAgo: 0,
    availability: 'limited',
    theme: 'dark',
    links: [
      { label: 'obi.works', url: 'https://obi.works', platform: 'website' },
      { label: 'GitHub', url: 'https://github.com/nkechiobi', platform: 'github' },
    ],
    expert: {
      headline: 'WCAG 2.2 audits with a fix list, not a score',
      pitch: 'A written audit against WCAG 2.2 AA with every finding tied to a selector, a success criterion and a fix I would accept in review. Keyboard pass, screen reader pass on NVDA and VoiceOver, reflow at 320 px, and reduced motion. You get the failures ordered by how many people they lock out, and I will tell you which ones you can defer.',
      hourlyRateCents: 18000,
      minBountyCents: 20000,
      turnaroundHours: 96,
      capacityPerWeek: 2,
      yearsExperience: 9,
      listed: true,
      expertise: [
        { area: 'accessibility', level: 'specialist' },
        { area: 'product-design', level: 'practitioner' },
        { area: 'api-design', level: 'familiar' },
      ],
      credential: {
        kind: 'domain_expert',
        area: 'accessibility',
        claim: 'Runs accessibility for a public sector platform and maintains an open source audit tool.',
      },
      verifiedDaysAgo: 241,
      payout: { provider: 'stripe', display: 'Stripe, GBP payout' },
    },
  },
  {
    handle: 'danyero',
    name: 'Dan Yerofeyev',
    email: 'dan@lastlightferry.com',
    primaryRole: 'game_dev',
    location: 'Tallinn, Estonia',
    pronouns: 'he/him',
    timezone: 'Europe/Tallinn',
    bio: 'Two person studio, second game. I do combat and my partner does everything that looks nice. I am blunt in reviews and I have learned the hard way to say what I actually tried before I say what I think. If I tell you your parry window is wrong I will give you the frame count I measured it at.',
    joinedDaysAgo: 389,
    lastSeenDaysAgo: 1,
    availability: 'open',
    theme: 'dark',
    links: [{ label: 'Steam page', url: 'https://store.steampowered.com/app/lastlightferry', platform: 'steam' }],
  },
  {
    handle: 'hanakuro',
    name: 'Hana Kurosawa',
    email: 'hana@kurosawa.studio',
    primaryRole: 'designer',
    location: 'Kyoto, Japan',
    pronouns: 'she/her',
    timezone: 'Asia/Tokyo',
    bio: 'Brand and type. I work mostly with transport and civic clients, which means my work gets read at four metres in the rain by somebody who is late. That constraint has made me impatient with decoration. I post my own work here because in-house review had stopped disagreeing with me.',
    joinedDaysAgo: 357,
    lastSeenDaysAgo: 2,
    availability: 'open',
    theme: 'light',
    links: [{ label: 'kurosawa.studio', url: 'https://kurosawa.studio', platform: 'website' }],
  },
  {
    handle: 'marcusweill',
    name: 'Marcus Weill',
    email: 'marcus@weillindustrial.com',
    primaryRole: 'other',
    location: 'Austin, United States',
    pronouns: 'he/him',
    timezone: 'America/Chicago',
    bio: 'Industrial designer, twenty two years, most of it in consumer electronics and the last six in small-run manufacturing. I have watched more good designs die at the tooling quote than at the concept review, so that is where I push hardest. I answer hardware questions here for free and take paid work when the brief is honest about volume.',
    joinedDaysAgo: 591,
    lastSeenDaysAgo: 1,
    availability: 'limited',
    theme: 'system',
    links: [
      { label: 'weillindustrial.com', url: 'https://weillindustrial.com', platform: 'website' },
      { label: 'LinkedIn', url: 'https://www.linkedin.com/in/marcusweill', platform: 'linkedin' },
    ],
    expert: {
      headline: 'Design for manufacture review before you cut tooling',
      pitch: 'Send me CAD, photos of the current print, and your target price at your target volume. I come back with the parts that will not mould, the tolerances that will fight assembly, and a cost read per part with the steps I would change first. Twenty two years of doing this, six of them on runs under ten thousand units.',
      hourlyRateCents: 25000,
      minBountyCents: 45000,
      turnaroundHours: 120,
      capacityPerWeek: 2,
      yearsExperience: 22,
      listed: true,
      expertise: [
        { area: 'hardware-engineering', level: 'specialist' },
        { area: 'industrial-design', level: 'specialist' },
      ],
      credential: {
        kind: 'employer',
        area: 'hardware-engineering',
        claim: 'Twenty two years in consumer hardware, including six years running small-batch production for three shipped products.',
      },
      verifiedDaysAgo: 380,
      payout: { provider: 'stripe', display: 'Stripe, USD payout' },
    },
  },
  {
    handle: 'fenelladoyle',
    name: 'Fenella Doyle',
    email: 'fenella@doyle.ink',
    primaryRole: 'reviewer',
    location: 'Dublin, Ireland',
    pronouns: 'she/her',
    timezone: 'Europe/Dublin',
    bio: 'Copy editor. I spent a decade on newspaper deadlines and now I edit product writing, which is the same job with smaller boxes. My reviews are line edits: I quote your sentence, I give you mine, and I tell you what changed. I am not interested in tone documents. I am interested in the button that says one thing and does another.',
    joinedDaysAgo: 470,
    lastSeenDaysAgo: 0,
    availability: 'open',
    theme: 'light',
    links: [{ label: 'doyle.ink', url: 'https://doyle.ink', platform: 'website' }],
    expert: {
      headline: 'Line edits on product copy, in your voice',
      pitch: 'Every string you send comes back marked up: the original, my replacement, and one line on what changed and why. Buttons, errors, empty states, onboarding, pricing tables. I work in your voice, not mine, and I will tell you when a copy problem is actually a design problem so you do not pay me to paper over it.',
      hourlyRateCents: 13000,
      minBountyCents: 15000,
      turnaroundHours: 48,
      capacityPerWeek: 4,
      yearsExperience: 14,
      listed: true,
      expertise: [
        { area: 'writing-editing', level: 'specialist' },
        { area: 'product-design', level: 'familiar' },
      ],
      credential: {
        kind: 'shipped_titles',
        area: 'writing-editing',
        claim: 'Ten years on daily newspaper copy desks, then in-house product writing for two software companies.',
      },
      verifiedDaysAgo: 210,
      payout: { provider: 'paypal', display: 'PayPal, EUR payout' },
    },
  },
  {
    handle: 'ruitavares',
    name: 'Rui Tavares',
    email: 'rui@ledgerline.dev',
    primaryRole: 'indie_dev',
    location: 'Porto, Portugal',
    pronouns: 'he/him',
    timezone: 'Europe/Lisbon',
    bio: 'I write developer tools and I have opinions about error messages that I can no longer keep to myself. Currently building Ledgerline, which diffs database schemas and tells you which migration will lock a table. I review APIs by trying to get to a first successful call with a timer running, then writing down every tab I had to open.',
    joinedDaysAgo: 512,
    lastSeenDaysAgo: 0,
    availability: 'open',
    theme: 'dark',
    links: [
      { label: 'ledgerline.dev', url: 'https://ledgerline.dev', platform: 'website' },
      { label: 'GitHub', url: 'https://github.com/ruitavares', platform: 'github' },
    ],
    expert: {
      headline: 'API and CLI review, timed from cold start',
      pitch: 'I set a timer, follow your quickstart on a clean machine, and record everything: the tabs I opened, the errors I hit, the point where I guessed. Then a written pass over naming, defaults, pagination, versioning and error text, with the exact strings I would ship instead. I do not review your marketing site.',
      hourlyRateCents: 17000,
      minBountyCents: 22000,
      turnaroundHours: 72,
      capacityPerWeek: 3,
      yearsExperience: 12,
      listed: true,
      expertise: [
        { area: 'api-design', level: 'specialist' },
        { area: 'frontend-engineering', level: 'practitioner' },
      ],
      credential: {
        kind: 'domain_expert',
        area: 'api-design',
        claim: 'Maintains two developer tools with more than eight thousand weekly installs between them.',
      },
      verifiedDaysAgo: 190,
      payout: { provider: 'wise', display: 'Wise, EUR payout' },
    },
  },
  {
    handle: 'sofiabrandao',
    name: 'Sofia Brandão',
    email: 'sofia@standingorder.co',
    primaryRole: 'founder',
    location: 'São Paulo, Brazil',
    pronouns: 'she/her',
    timezone: 'America/Sao_Paulo',
    bio: 'My family ran a bakery for thirty years and lost money on guesswork every single week. I am trying to fix that with software, which is either the obvious solution or the reason nobody has fixed it. I post early and I want the version of the feedback you would give a friend, not the version you would give a stranger.',
    joinedDaysAgo: 208,
    lastSeenDaysAgo: 1,
    availability: 'open',
    theme: 'system',
    links: [{ label: 'standingorder.co', url: 'https://standingorder.co', platform: 'website' }],
  },
  {
    handle: 'aleksynowak',
    name: 'Aleksy Nowak',
    email: 'aleksy@nowak.games',
    primaryRole: 'game_dev',
    location: 'Kraków, Poland',
    pronouns: 'he/him',
    timezone: 'Europe/Warsaw',
    bio: 'Netcode, mostly. I spend my days making sure two people in different countries agree about where a box is. I prototype puzzle games in the evenings as a break from that, and they are usually about circuits because I cannot help myself. I test builds on a nine year old laptop on purpose.',
    joinedDaysAgo: 334,
    lastSeenDaysAgo: 3,
    availability: 'limited',
    theme: 'dark',
    links: [{ label: 'GitHub', url: 'https://github.com/aleksynowak', platform: 'github' }],
  },
  {
    handle: 'imanifrazier',
    name: 'Imani Frazier',
    email: 'imani@frazier.tv',
    primaryRole: 'video_creator',
    location: 'Atlanta, United States',
    pronouns: 'she/her',
    timezone: 'America/New_York',
    bio: 'I make short video about sport, mostly the parts nobody films. Nine hundred thousand people watched a three minute piece I cut on a train once, and I have been chasing that feeling since. I am good at hooks and bad at endings, and I say so at the top of every review I ask for.',
    joinedDaysAgo: 245,
    lastSeenDaysAgo: 0,
    availability: 'open',
    theme: 'dark',
    links: [{ label: 'YouTube', url: 'https://www.youtube.com/@imanifrazier', platform: 'youtube' }],
  },
  {
    handle: 'joonhobaek',
    name: 'Joon-ho Baek',
    email: 'joonho@baek.design',
    primaryRole: 'designer',
    location: 'Seoul, South Korea',
    pronouns: 'he/him',
    timezone: 'Asia/Seoul',
    bio: 'I build design systems and then watch engineers work around them, which has taught me more than any conference talk. Understudy is my attempt to write down what survived. I review interface work by loading it with the worst real content I can find: a forty character name, an empty list, a failed request.',
    joinedDaysAgo: 398,
    lastSeenDaysAgo: 0,
    availability: 'open',
    theme: 'system',
    links: [
      { label: 'baek.design', url: 'https://baek.design', platform: 'website' },
      { label: 'GitHub', url: 'https://github.com/joonhobaek', platform: 'github' },
    ],
  },
  {
    handle: 'gretalind',
    name: 'Greta Lindholm',
    email: 'greta@lindholm.qa',
    primaryRole: 'reviewer',
    location: 'Helsinki, Finland',
    pronouns: 'she/her',
    timezone: 'Europe/Helsinki',
    bio: 'Eleven years in quality assurance, six of them on games. I keep a matrix of my own devices and I test in the order most likely to break things, which is rarely the order the creator expects. Every report I file has steps, a result, an expectation, and a note about how often it happened. If I cannot reproduce it I say that too, because a report you cannot reproduce is still evidence.',
    joinedDaysAgo: 445,
    lastSeenDaysAgo: 0,
    availability: 'open',
    theme: 'dark',
    links: [{ label: 'lindholm.qa', url: 'https://lindholm.qa', platform: 'website' }],
    expert: {
      headline: 'Structured bug hunts across a real device matrix',
      pitch: 'A timed hunt on the devices you actually ship to, with every finding written as steps, result, expectation and frequency. You get a severity and reach grade per item and a short list of the three I would fix before you ship. Six of my eleven years are on games; the rest is web and mobile.',
      hourlyRateCents: 12000,
      minBountyCents: 18000,
      turnaroundHours: 72,
      capacityPerWeek: 4,
      yearsExperience: 11,
      listed: true,
      expertise: [
        { area: 'frontend-engineering', level: 'specialist' },
        { area: 'game-design', level: 'practitioner' },
        { area: 'accessibility', level: 'familiar' },
      ],
      credential: {
        kind: 'employer',
        area: 'frontend-engineering',
        claim: 'Led quality assurance on three shipped console titles and two banking apps.',
      },
      verifiedDaysAgo: 160,
      payout: { provider: 'wise', display: 'Wise, EUR payout' },
    },
  },
  {
    handle: 'omarhaddad',
    name: 'Omar Haddad',
    email: 'omar@coldframe.app',
    primaryRole: 'founder',
    location: 'Amman, Jordan',
    pronouns: 'he/him',
    timezone: 'Asia/Amman',
    bio: 'I write software for people who grow things in unheated tunnels, which is a job I fell into after two seasons of doing it badly myself. The hard part is not the routing. The hard part is that everybody I am building for is outside with cold hands and a cracked phone screen.',
    joinedDaysAgo: 187,
    lastSeenDaysAgo: 2,
    availability: 'open',
    theme: 'light',
    links: [{ label: 'coldframe.app', url: 'https://coldframe.app', platform: 'website' }],
  },
  {
    handle: 'elowenprice',
    name: 'Elowen Price',
    email: 'elowen@harrowgatepress.com',
    primaryRole: 'other',
    location: 'Cardiff, Wales',
    pronouns: 'they/them',
    timezone: 'Europe/London',
    bio: 'I run a two person press that publishes six books a year and loses money on four of them. I also write essays about why nobody reads documentation, which is the only subject I am qualified to be angry about. I ask for line edits here because my co-editor has stopped being honest with me.',
    joinedDaysAgo: 301,
    lastSeenDaysAgo: 1,
    availability: 'open',
    theme: 'light',
    links: [{ label: 'harrowgatepress.com', url: 'https://harrowgatepress.com', platform: 'website' }],
  },
  {
    handle: 'vikramsahni',
    name: 'Vikram Sahni',
    email: 'vikram@ferryman.app',
    primaryRole: 'indie_dev',
    location: 'Toronto, Canada',
    pronouns: 'he/him',
    timezone: 'America/Toronto',
    bio: 'Ferryman is a transit app that works in a tunnel, which sounds like a small promise until you have stood on a platform watching a spinner. Shipped two years ago, forty thousand people use it, and I still do support myself on Sunday evenings. I review mobile work with the screen brightness down and one hand on a coffee.',
    joinedDaysAgo: 623,
    lastSeenDaysAgo: 0,
    availability: 'limited',
    theme: 'dark',
    links: [
      { label: 'ferryman.app', url: 'https://ferryman.app', platform: 'website' },
      { label: 'App Store', url: 'https://apps.apple.com/app/ferryman-transit/id1552390118', platform: 'appstore' },
    ],
  },
  {
    handle: 'beatricer',
    name: 'Béatrice Rousseau',
    email: 'beatrice@rousseau.cc',
    primaryRole: 'designer',
    location: 'Lyon, France',
    pronouns: 'she/her',
    timezone: 'Europe/Paris',
    bio: 'Twelve years of brand work for businesses with fewer than ten staff. A bike shop, a dentist, two bakeries, a mountain rescue charity. The budgets are small and the stakes are somebody’s livelihood, which is a better teacher than any agency I worked at. I review marketing pages by reading them once, quickly, the way a customer would.',
    joinedDaysAgo: 372,
    lastSeenDaysAgo: 2,
    availability: 'open',
    theme: 'light',
    links: [{ label: 'rousseau.cc', url: 'https://rousseau.cc', platform: 'website' }],
  },
  {
    handle: 'tayobalogun',
    name: 'Tayo Balogun',
    email: 'tayo@kilnandkin.games',
    primaryRole: 'game_dev',
    location: 'Bristol, United Kingdom',
    pronouns: 'he/him',
    timezone: 'Europe/London',
    bio: 'Level designer for eight years at two studios, now making a co-op game about running a forge with somebody who will not stop hammering. I think in sightlines and I cannot stop critiquing rooms. My reviews are long because I walk the space twice: once as a player and once as somebody looking for the seams.',
    joinedDaysAgo: 292,
    lastSeenDaysAgo: 1,
    availability: 'open',
    theme: 'dark',
    links: [{ label: 'kilnandkin.games', url: 'https://kilnandkin.games', platform: 'website' }],
  },
  {
    handle: 'suvikallio',
    name: 'Suvi Kallio',
    email: 'suvi@emberlantern.fi',
    primaryRole: 'other',
    location: 'Tampere, Finland',
    pronouns: 'she/her',
    timezone: 'Europe/Helsinki',
    bio: 'Firmware, mostly for things that run on batteries in the cold. I am building a camping lantern because every one I have owned has failed at minus fifteen and I got tired of complaining about it. I test hardware the way I use it, which means outdoors, in gloves, in the dark.',
    joinedDaysAgo: 264,
    lastSeenDaysAgo: 1,
    availability: 'limited',
    theme: 'dark',
    links: [{ label: 'emberlantern.fi', url: 'https://emberlantern.fi', platform: 'website' }],
  },
  {
    handle: 'noorfarhat',
    name: 'Noor Farhat',
    email: 'noor@meterwise.io',
    primaryRole: 'founder',
    location: 'Dubai, United Arab Emirates',
    pronouns: 'she/her',
    timezone: 'Asia/Dubai',
    bio: 'Eight years auditing commercial energy bills for a firm that charged a percentage of what it saved. I left to build the tool I was doing by hand in spreadsheets. I know the numbers in this market better than I know how to sell software, and that is exactly the gap I am asking about here.',
    joinedDaysAgo: 173,
    lastSeenDaysAgo: 3,
    availability: 'open',
    theme: 'light',
    links: [{ label: 'meterwise.io', url: 'https://meterwise.io', platform: 'website' }],
  },
  {
    handle: 'emmettquill',
    name: 'Emmett Quill',
    email: 'emmett.quill@fastmail.com',
    primaryRole: 'reviewer',
    location: 'Portland, United States',
    pronouns: 'he/him',
    timezone: 'America/Los_Angeles',
    bio: 'I try a lot of things and I am enthusiastic about most of them. I know my feedback is not as sharp as the people I read here, so I am working on it: writing down what I actually did before I write down what I thought. I mostly play games and use small apps on an old laptop.',
    joinedDaysAgo: 156,
    lastSeenDaysAgo: 1,
    availability: 'open',
    theme: 'system',
    links: [],
  },
  {
    handle: 'lenahavel',
    name: 'Lena Havel',
    email: 'lena@stagehand.tools',
    primaryRole: 'indie_dev',
    location: 'Prague, Czechia',
    pronouns: 'she/her',
    timezone: 'Europe/Prague',
    bio: 'I make a tool for annotating charts, which I started because I kept exporting images into a drawing app to add one arrow. Six years in data teams before that, so I know exactly which arrow. I review software by trying to do one real task from my own week with it, and I write down where I gave up.',
    joinedDaysAgo: 338,
    lastSeenDaysAgo: 0,
    availability: 'open',
    theme: 'dark',
    links: [
      { label: 'stagehand.tools', url: 'https://stagehand.tools', platform: 'website' },
      { label: 'GitHub', url: 'https://github.com/lenahavel', platform: 'github' },
    ],
  },
  {
    handle: 'kwamemensah',
    name: 'Kwame Mensah',
    email: 'kwame@mensah.film',
    primaryRole: 'video_creator',
    location: 'Accra, Ghana',
    pronouns: 'he/him',
    timezone: 'Africa/Accra',
    bio: 'Colourist and occasional director. Most of my week is other people’s music videos, graded in a room with the blinds taped shut. I post my own directing work here because the people who hire me are too polite to tell me when a cut is not working.',
    joinedDaysAgo: 229,
    lastSeenDaysAgo: 2,
    availability: 'limited',
    theme: 'dark',
    links: [{ label: 'mensah.film', url: 'https://mensah.film', platform: 'website' }],
  },
  {
    handle: 'ingridvos',
    name: 'Ingrid Vos',
    email: 'ingrid@saltbox.work',
    primaryRole: 'founder',
    location: 'Rotterdam, Netherlands',
    pronouns: 'she/her',
    timezone: 'Europe/Amsterdam',
    bio: 'I waited tables for six years and then designed services for eleven, and the second job keeps sending me back to the first. Saltbox is shift swapping for restaurant staff, built on the observation that the group chat is already the system and everybody hates it. I ask for feedback from people who have worked a close.',
    joinedDaysAgo: 281,
    lastSeenDaysAgo: 1,
    availability: 'open',
    theme: 'system',
    links: [{ label: 'saltbox.work', url: 'https://saltbox.work', platform: 'website' }],
  },
  {
    handle: 'petranilsen',
    name: 'Petra Nilsen',
    email: 'petra@nilsen.works',
    primaryRole: 'other',
    location: 'Malmö, Sweden',
    pronouns: 'she/her',
    timezone: 'Europe/Stockholm',
    bio: 'I write fiction in the mornings and run a small web studio the rest of the day, and the two have started to bleed into each other in ways I do not mind. First novel is out with agents and the first chapter has been rewritten eleven times. I read carefully and I quote the sentence where I stopped.',
    joinedDaysAgo: 312,
    lastSeenDaysAgo: 0,
    availability: 'open',
    theme: 'light',
    links: [{ label: 'nilsen.works', url: 'https://nilsen.works', platform: 'website' }],
  },
  {
    handle: 'hugobitt',
    name: 'Hugo Bittencourt',
    email: 'hugo.bittencourt@hey.com',
    primaryRole: 'indie_dev',
    location: 'Lisbon, Portugal',
    pronouns: 'he/him',
    timezone: 'Europe/Lisbon',
    bio: 'Three months into making things on purpose instead of just reading about it. First app is a focus timer, which I know is the most crowded shelf there is, and I am building it anyway because I want to learn the whole loop from idea to store listing.',
    joinedDaysAgo: 74,
    lastSeenDaysAgo: 0,
    availability: 'open',
    theme: 'dark',
    links: [],
  },
]

/* -------------------------------------------------------------------------- */
/* 5. Projects                                                                */
/* -------------------------------------------------------------------------- */

export interface SeedVersion {
  readonly label: string
  readonly changelog: string
  readonly platforms: readonly string[]
  readonly daysAgo: number
  readonly current: boolean
  readonly buildUrl?: string
  readonly embedUrl?: string
}

export interface SeedAsk {
  /** The ask. Specific enough that a reviewer knows whether they can answer it. */
  readonly prompt: string
  readonly detail?: string
  readonly category?: string
  readonly required: boolean
}

export interface SeedUpdate {
  readonly title: string
  readonly body: string
  readonly daysAgo: number
  readonly versionLabel?: string
}

export type LinkKind = 'demo' | 'download' | 'repo' | 'store' | 'docs' | 'devlog' | 'discord' | 'other'

export interface SeedProject {
  readonly slug: string
  readonly title: string
  readonly tagline: string
  readonly ownerHandle: string
  readonly type: TypeSlug
  readonly stage: StageKey
  /** Literata. What this is, in the creator’s own words. */
  readonly summary: string
  /**
   * Cover art is generated from this string, not fetched. The UI renders a grit
   * hatch composition from the seed; nothing here points at an image host.
   */
  readonly coverSeed: string
  readonly coverAlt: string
  readonly asks: readonly SeedAsk[]
  readonly needs: readonly string[]
  readonly tags: readonly string[]
  readonly versions: readonly SeedVersion[]
  readonly links: readonly { readonly kind: LinkKind; readonly label: string; readonly url: string }[]
  readonly createdDaysAgo: number
  readonly publishedDaysAgo: number
  readonly feedbackState: 'open' | 'invite_only' | 'closed'
  readonly views: number
  readonly updates?: readonly SeedUpdate[]
}

export const PROJECTS: readonly SeedProject[] = [
  {
    slug: 'brinehollow',
    title: 'Brinehollow',
    tagline: 'A deckbuilding roguelike about salvaging a drowned town, one tide at a time.',
    ownerHandle: 'mirasolvang',
    type: 'game',
    stage: 'beta',
    summary:
      'You have twelve hours before the tide comes back, a boat that leaks, and a deck of salvage tools that get heavier as they get better. Every run is one descent into the flooded streets of Brinehollow, and everything you carry out becomes part of the town you rebuild between runs. Four years of work, rebuilt twice, and this is the first build I have let people play without me in the room.',
    coverSeed: 'hatch-brinehollow-tide-06',
    coverAlt: 'Grit hatch cover in cold blue-green, dense at the waterline and open above it.',
    asks: [
      {
        prompt:
          'The tutorial is 90 seconds and 40 per cent of testers quit inside it. I need to know which beat loses them.',
        detail:
          'There are four beats: the boat, the first card, the tide meter, and the first choice between two doors. Tell me which one you were on when you stopped reading, and what you were looking at on screen.',
        category: 'tutorial',
        required: true,
      },
      {
        prompt: 'Is the tide meter legible at a glance, or are you reading the number every time?',
        category: 'hud',
        required: false,
      },
    ],
    needs: ['playtesters', 'usability'],
    tags: ['roguelike', 'deckbuilder', 'pixel-art', 'godot', 'steam'],
    versions: [
      {
        label: 'v0.7.2',
        changelog:
          'Tutorial beat three now waits for input before the tide meter moves. Salvage crash on sort then drop fixed. Ballast renamed to Jettison. Keyboard focus returns from the remap panel and Escape closes it.',
        platforms: ['win', 'mac', 'linux'],
        daysAgo: 3,
        current: true,
        buildUrl: 'https://mirasolvang.itch.io/brinehollow',
      },
      {
        label: 'v0.7.1',
        changelog:
          'Tide meter moved to the top right and given a numeral. Second tutorial beat now waits for input instead of auto-advancing. Two crash fixes on the salvage screen.',
        platforms: ['win', 'mac', 'linux'],
        daysAgo: 30,
        current: false,
        buildUrl: 'https://mirasolvang.itch.io/brinehollow',
      },
      {
        label: 'v0.7.0',
        changelog: 'New tutorial, four beats instead of seven. Rebalanced the first three salvage tools.',
        platforms: ['win', 'mac', 'linux'],
        daysAgo: 40,
        current: false,
        buildUrl: 'https://mirasolvang.itch.io/brinehollow',
      },
      {
        label: 'v0.6.4',
        changelog: 'Save corruption fix on quit during a descent. Audio ducking while the tide alarm plays.',
        platforms: ['win', 'mac'],
        daysAgo: 71,
        current: false,
      },
    ],
    links: [
      { kind: 'demo', label: 'Play the beta build', url: 'https://mirasolvang.itch.io/brinehollow' },
      { kind: 'devlog', label: 'Devlog', url: 'https://brinehollow.dev/devlog' },
      { kind: 'discord', label: 'Playtest channel', url: 'https://discord.gg/brinehollow' },
    ],
    createdDaysAgo: 88,
    publishedDaysAgo: 84,
    feedbackState: 'open',
    views: 4821,
    updates: [
      {
        title: 'The tutorial is four beats now, not seven',
        body:
          'You told me the same thing in three weeks, in five different sets of words: the tutorial talks while you are trying to look at the boat. Beats three, five and six are gone. The tide meter waits for you to move before it starts counting. If you played v0.6.4 and stopped inside the first minute, this is the build worth trying again.',
        daysAgo: 40,
        versionLabel: 'v0.7.0',
      },
      {
        title: 'Tide meter has a number on it',
        body:
          'Nine separate reports said the tide bar was unreadable in the bottom left, and four people said they never saw it at all. It is top right now, it has a numeral, and the alarm ducks the music instead of fighting it. Greta Lindholm found the salvage screen crash that came with the move; that is fixed too.',
        daysAgo: 29,
        versionLabel: 'v0.7.1',
      },
      {
        title: 'Beat three waits for you now',
        body:
          'Tobi Adeyemi timed the exact moment: at 0:38 the meter starts moving while the text is still on screen, and the text loses. Beat two already waited for input, which is why nobody has ever complained about beat two. Beat three waits now too. Greta Lindholm’s salvage crash is fixed in the same build, and Ballast is called Jettison, because Fenella Doyle pointed out that it has been named after the opposite of what it does for three years.',
        daysAgo: 3,
        versionLabel: 'v0.7.2',
      },
    ],
  },
  {
    slug: 'lastlight-ferry',
    title: 'Lastlight Ferry',
    tagline: 'A two hour action game about ferrying the dead across a flooded border.',
    ownerHandle: 'danyero',
    type: 'game',
    stage: 'release_candidate',
    summary:
      'You row. Things come out of the water. You have one oar, which is also the only weapon, and a parry window of eight frames that we have moved eleven times. Two hours long on a first run, no upgrades, no shop, nothing to grind. We lock content at the end of the month and after that only crash fixes go in.',
    coverSeed: 'hatch-lastlight-oar-11',
    coverAlt: 'Grit hatch cover, fine horizontal strokes broken by one vertical stroke.',
    asks: [
      {
        prompt:
          'Does the 8 frame parry window read as generous or as cheap? I need this from people who do not normally play action games.',
        detail:
          'Play to the second crossing, which is about 25 minutes. Tell me what you thought the parry timing was, then check the trainer in the options menu and tell me how far off you were.',
        category: 'controls',
        required: true,
      },
      {
        prompt: 'Is there a point in the second hour where you thought the game was over and it was not?',
        category: 'level_design',
        required: false,
      },
    ],
    needs: ['playtesters', 'bug_hunt'],
    tags: ['unity', 'steam', 'steam-deck', 'pixel-art'],
    versions: [
      {
        label: 'RC 4',
        changelog:
          'Parry window held at 8 frames, with a 2 frame input buffer added on the oar. Steam Deck default control scheme. Fixed the audio cut on the second crossing.',
        platforms: ['win', 'linux'],
        daysAgo: 6,
        current: true,
        buildUrl: 'https://store.steampowered.com/app/lastlightferry',
      },
      {
        label: 'RC 3',
        changelog: 'Parry window 8 frames, down from 10. Rowing animation re-timed to match.',
        platforms: ['win', 'linux'],
        daysAgo: 27,
        current: false,
      },
    ],
    links: [
      { kind: 'store', label: 'Steam page', url: 'https://store.steampowered.com/app/lastlightferry' },
      { kind: 'download', label: 'Reviewer build', url: 'https://lastlightferry.com/rc4' },
    ],
    createdDaysAgo: 63,
    publishedDaysAgo: 58,
    feedbackState: 'open',
    views: 3107,
  },
  {
    slug: 'kiln-and-kin',
    title: 'Kiln & Kin',
    tagline: 'Two people, one forge, and a hammer that only works if you both stop talking.',
    ownerHandle: 'tayobalogun',
    type: 'game',
    stage: 'prototype',
    summary:
      'A local co-op game about running a smithy where every tool needs two pairs of hands and no tool tells you what the other person is doing. The prototype is one forge, four commissions and about forty minutes. I am testing one idea: that a game can teach two people to work in silence, and that the silence is the good part.',
    coverSeed: 'hatch-kilnkin-anvil-03',
    coverAlt: 'Grit hatch cover, two coarse hatched blocks meeting at a diagonal seam.',
    asks: [
      {
        prompt:
          'Play it with somebody in the same room. Tell me the minute you stopped narrating to each other, and whether that silence felt earned or like the game stopped teaching you.',
        detail: 'If you never stopped talking, that is the answer I actually need. Say what you were still negotiating.',
        category: 'core_loop',
        required: true,
      },
    ],
    needs: ['playtesters', 'usability'],
    tags: ['co-op', 'godot', 'pixel-art'],
    versions: [
      {
        label: 'Build 37',
        changelog:
          'Three commissions. On-screen hints still in, single bellows, no deadline on any job.',
        platforms: ['win', 'mac'],
        daysAgo: 30,
        current: false,
      },
      {
        label: 'Build 41',
        changelog: 'Fourth commission added. Bellows now show the other player’s grip. Removed the on-screen hints.',
        platforms: ['win', 'mac'],
        daysAgo: 13,
        current: true,
        buildUrl: 'https://kilnandkin.games/build41',
      },
    ],
    links: [{ kind: 'download', label: 'Playtest build', url: 'https://kilnandkin.games/build41' }],
    createdDaysAgo: 41,
    publishedDaysAgo: 38,
    feedbackState: 'open',
    views: 1284,
  },
  {
    slug: 'paperweight-circuit',
    title: 'Paperweight Circuit',
    tagline: 'A puzzle game where the wire is the piece you move, not the thing you connect.',
    ownerHandle: 'aleksynowak',
    type: 'game',
    stage: 'concept',
    summary:
      'Eleven paper boards, photographed, plus one clickable prototype of board three. The rule is that wires push each other: laying a new wire displaces every wire it crosses, and the puzzle is the order you lay them in. I want to know if that rule survives being read, because if it needs a tutorial it is the wrong rule.',
    coverSeed: 'hatch-paperweight-grid-02',
    coverAlt: 'Grit hatch cover, widely spaced coarse strokes crossing at right angles.',
    asks: [
      {
        prompt:
          'Read the rule once, then look at board three. Is it obvious that wires displace each other, or did you have to be told?',
        detail: 'If you had to be told, say which image made you understand it. That image is the tutorial.',
        category: 'core_loop',
        required: true,
      },
    ],
    needs: ['usability', 'playtesters'],
    tags: ['puzzle', 'web'],
    versions: [
      {
        label: 'Paper 11',
        changelog: 'Eleven boards photographed. Board three playable in the browser.',
        platforms: ['web'],
        daysAgo: 17,
        current: true,
        embedUrl: 'https://paperweightcircuit.nowak.games/board-3',
      },
    ],
    links: [{ kind: 'demo', label: 'Board three, playable', url: 'https://paperweightcircuit.nowak.games/board-3' }],
    createdDaysAgo: 22,
    publishedDaysAgo: 19,
    feedbackState: 'open',
    views: 612,
  },
  {
    slug: 'tallyroot',
    title: 'Tallyroot',
    tagline: 'Invoicing for freelance translators, priced per word and per language pair.',
    ownerHandle: 'priyaram',
    type: 'web_app',
    stage: 'beta',
    summary:
      'Translators bill by the word, in the client’s currency, at a rate that changes per language pair and sometimes per document type. Every general invoicing tool makes you rebuild that by hand every month. Tallyroot stores the rate card, does the arithmetic, and sends something a Dutch accounts department will accept. Fourteen paying customers, all of whom have my phone number.',
    coverSeed: 'hatch-tallyroot-ledger-08',
    coverAlt: 'Grit hatch cover, evenly ruled fine lines with one open band across the middle.',
    asks: [
      {
        prompt:
          'Six of my fourteen customers sent their first invoice in the wrong currency. Walk from signup to a sent invoice in a second currency and tell me where you decided the currency, versus where I put the control.',
        detail:
          'The shared reviewer account has one client in euro and one in yen. Do not read the help text unless you get stuck, and tell me if you did.',
        category: 'core_task',
        required: true,
      },
      {
        prompt: 'Is the rate card screen legible before you have any rates in it?',
        category: 'empty_state',
        required: false,
      },
    ],
    needs: ['usability', 'copy_review'],
    tags: ['typescript', 'web', 'freelancers', 'translators'],
    versions: [
      {
        label: 'v1.4.0',
        changelog:
          'Currency now chosen on the client, not the invoice. Rate card gets a worked example in the empty state. Invoice preview renders before send.',
        platforms: ['web'],
        daysAgo: 5,
        current: true,
        embedUrl: 'https://try.tallyroot.co',
      },
      {
        label: 'v1.3.2',
        changelog: 'Per-pair rates, CSV export, and a fix for rounding on invoices over ten thousand words.',
        platforms: ['web'],
        daysAgo: 40,
        current: false,
      },
    ],
    links: [
      { kind: 'demo', label: 'Shared reviewer account', url: 'https://try.tallyroot.co' },
      { kind: 'docs', label: 'Rate card guide', url: 'https://tallyroot.co/docs/rate-cards' },
    ],
    createdDaysAgo: 79,
    publishedDaysAgo: 76,
    feedbackState: 'open',
    views: 2643,
    updates: [
      {
        title: 'Currency lives on the client now',
        body:
          'Eleven of you said the same thing in different words: currency is a property of who you are billing, not of the invoice you are writing. It was on the invoice because that is how my first customer described it to me two years ago, and I never questioned it again. It is on the client record now, and existing invoices keep their currency.',
        daysAgo: 5,
        versionLabel: 'v1.4.0',
      },
    ],
  },
  {
    slug: 'stagehand',
    title: 'Stagehand',
    tagline: 'Annotate a chart where it lives, instead of exporting it to a drawing app.',
    ownerHandle: 'lenahavel',
    type: 'web_app',
    stage: 'release_candidate',
    summary:
      'Paste a chart from anywhere, draw the arrow, write the one sentence that explains it, and share a link that keeps the annotation attached to the data point rather than to a pixel position. Built because I spent six years in data teams exporting images into a drawing app to add one arrow, and then losing the arrow when the numbers updated.',
    coverSeed: 'hatch-stagehand-mark-05',
    coverAlt: 'Grit hatch cover, fine ruled field with one heavier stroke angled across it.',
    asks: [
      {
        prompt:
          'Paste a chart, add one annotation, share it. If that takes more than 90 seconds, tell me the moment you hesitated.',
        detail: 'I do not need a rating. I need the thing you were looking for when you stopped moving the mouse.',
        category: 'core_task',
        required: true,
      },
      {
        prompt: 'The share dialog has four options. Which one did you expect to be the default?',
        category: 'navigation',
        required: false,
      },
    ],
    needs: ['usability', 'accessibility_audit'],
    tags: ['typescript', 'web', 'developer-tools'],
    versions: [
      {
        label: 'v0.9.3',
        changelog:
          'Annotations bound to pixel coordinates rather than data points. No keyboard path. Share dialog with two options.',
        platforms: ['web'],
        daysAgo: 30,
        current: false,
      },
      {
        label: 'v0.9.6',
        changelog:
          'Annotations bind to data points rather than coordinates. Keyboard path for placing a marker. Share dialog defaults to a read-only link.',
        platforms: ['web'],
        daysAgo: 11,
        current: true,
        embedUrl: 'https://try.stagehand.tools',
      },
    ],
    links: [
      { kind: 'demo', label: 'Try it without an account', url: 'https://try.stagehand.tools' },
      { kind: 'repo', label: 'Source', url: 'https://github.com/lenahavel/stagehand' },
    ],
    createdDaysAgo: 52,
    publishedDaysAgo: 49,
    feedbackState: 'open',
    views: 1978,
  },
  {
    slug: 'coldframe',
    title: 'Coldframe',
    tagline: 'Planting and harvest scheduling for growers with three tunnels and no office.',
    ownerHandle: 'omarhaddad',
    type: 'web_app',
    stage: 'concept',
    summary:
      'Three wireframes and two seasons of real harvest data from farms outside Amman. The problem: a grower decides what to sow in March based on what they think they will be able to sell in July, and right now that decision lives in a notebook that gets rained on. Everything I have drawn so far is a calendar, and every grower I show it to reads it as a to-do list.',
    coverSeed: 'hatch-coldframe-rows-01',
    coverAlt: 'Grit hatch cover, coarse widely spaced strokes in three uneven bands.',
    asks: [
      {
        prompt:
          'Is a calendar the wrong shape for this entirely? Every grower reads my calendar as a list of chores rather than a plan.',
        detail:
          'The second wireframe is a list instead. Tell me which one you would trust in March, and say what you do for a living first.',
        category: 'navigation',
        required: true,
      },
    ],
    needs: ['usability', 'positioning'],
    tags: ['web', 'small-business'],
    versions: [
      {
        label: 'Wireframe 2',
        changelog:
          'Calendar only, with one season of harvest data behind it.',
        platforms: ['web'],
        daysAgo: 18,
        current: false,
      },
      {
        label: 'Wireframe 3',
        changelog: 'Calendar, list and a third view that is a season on one line. Real 2025 harvest data behind all three.',
        platforms: ['web'],
        daysAgo: 8,
        current: true,
      },
    ],
    links: [{ kind: 'other', label: 'Wireframes and the data behind them', url: 'https://coldframe.app/wireframes' }],
    createdDaysAgo: 15,
    publishedDaysAgo: 12,
    feedbackState: 'open',
    views: 418,
  },
  {
    slug: 'ferryman',
    title: 'Ferryman',
    tagline: 'Transit times that still work when the tunnel eats your signal.',
    ownerHandle: 'vikramsahni',
    type: 'mobile_app',
    stage: 'shipped',
    summary:
      'A transit app built around the minute you have no signal. Schedules and your three saved lines are on the device, predictions update when there is a connection and degrade honestly when there is not. Forty thousand people use it, mostly on one commute each, and version 3 is the first time I have moved anything they touch every day.',
    coverSeed: 'hatch-ferryman-tunnel-12',
    coverAlt: 'Grit hatch cover, very fine parallel strokes with a dark unruled gap through the centre.',
    asks: [
      {
        prompt:
          'Version 3 moves the line picker into a bottom sheet. Tell me honestly whether the new placement reads as obvious, or as something you eventually found.',
        detail:
          'If you have used Ferryman before, say so. I need both answers and I need to be able to tell them apart.',
        category: 'nav_structure',
        required: true,
      },
      {
        prompt: 'Put the phone in airplane mode mid-journey. Is it clear what the app knows and what it is guessing?',
        category: 'offline',
        required: false,
      },
    ],
    needs: ['usability', 'accessibility_audit', 'playtesters'],
    tags: ['ios', 'android', 'swift', 'commuters', 'offline-first'],
    versions: [
      {
        label: '3.0.2',
        changelog:
          'Offline banner now names the last successful update time. Dynamic Type up to the largest accessibility size.',
        platforms: ['ios', 'android'],
        daysAgo: 16,
        current: true,
      },
      {
        label: '3.0.0',
        changelog:
          'Line picker moved to a bottom sheet, within reach of a thumb. Background location updates reworked around it.',
        platforms: ['ios', 'android'],
        daysAgo: 31,
        current: false,
      },
      {
        label: '2.9.4',
        changelog: 'Last of the version 2 line. Crash fix on line change during a live journey.',
        platforms: ['ios', 'android'],
        daysAgo: 64,
        current: false,
      },
    ],
    links: [
      { kind: 'store', label: 'App Store', url: 'https://apps.apple.com/app/ferryman-transit/id1552390118' },
      { kind: 'store', label: 'Play Store', url: 'https://play.google.com/store/apps/details?id=app.ferryman' },
    ],
    createdDaysAgo: 70,
    publishedDaysAgo: 66,
    feedbackState: 'open',
    views: 5390,
    updates: [
      {
        title: 'What the offline banner says now',
        body:
          'It used to say that you were offline, which you already knew, because you were the one in the tunnel. It now says when the last successful update was and which of the three numbers on screen are from that update. Nkechi Obi pointed out that the old banner also disappeared for screen reader users entirely, which is why this shipped in a patch rather than waiting for 3.1.',
        daysAgo: 16,
        versionLabel: '3.0.2',
      },
    ],
  },
  {
    slug: 'saltbox',
    title: 'Saltbox',
    tagline: 'Shift swaps for restaurant floors, without the group chat.',
    ownerHandle: 'ingridvos',
    type: 'mobile_app',
    stage: 'beta',
    summary:
      'Post the shift you cannot work, let somebody claim it, and let the manager approve it in one tap instead of scrolling back through ninety messages. Built with two restaurants in Rotterdam who are still using it, and designed for the moment it actually gets used: eleven at night, one hand, phone at four per cent.',
    coverSeed: 'hatch-saltbox-shift-07',
    coverAlt: 'Grit hatch cover, medium strokes in two interlocking columns.',
    asks: [
      {
        prompt:
          'Post a shift and claim somebody else’s, one handed, at the end of a long day. Does the confirm step feel like protection or like an obstacle?',
        detail: 'Tell me if you have ever worked a close. Both answers are useful, they are just different answers.',
        category: 'gestures',
        required: true,
      },
    ],
    needs: ['playtesters', 'accessibility_audit'],
    tags: ['ios', 'android', 'restaurants'],
    versions: [
      {
        label: '0.8.0',
        changelog:
          'Claim flow with a two step confirmation. English strings only. Manager approval by email.',
        platforms: ['ios', 'android'],
        daysAgo: 30,
        current: false,
      },
      {
        label: '0.8.3',
        changelog: 'Claim confirmation reduced to one step with an undo. Larger targets on the shift list. Dutch strings.',
        platforms: ['ios', 'android'],
        daysAgo: 10,
        current: true,
      },
    ],
    links: [{ kind: 'demo', label: 'TestFlight build', url: 'https://testflight.apple.com/join/saltbox' }],
    createdDaysAgo: 46,
    publishedDaysAgo: 43,
    feedbackState: 'open',
    views: 1122,
  },
  {
    slug: 'harrowgate-press',
    title: 'Harrowgate Press',
    tagline: 'A two person press that sells six books a year to people who found one essay.',
    ownerHandle: 'elowenprice',
    type: 'website',
    stage: 'release_candidate',
    summary:
      'The site is the shop, the catalogue and the reason anybody trusts us with eighteen pounds for a paperback from a press they have never heard of. Most of our traffic arrives on one essay from 2023 and leaves from the same page. This rebuild puts the books in front of that essay instead of behind it, and I am not sure it works.',
    coverSeed: 'hatch-harrowgate-spine-04',
    coverAlt: 'Grit hatch cover, fine vertical strokes grouped like the spines on a shelf.',
    asks: [
      {
        prompt: 'Read the homepage once, at normal speed, then close it. Tell me what you think we sell.',
        detail: 'Please do not scroll back before you answer. The wrong answer is the useful one.',
        category: 'hero',
        required: true,
      },
      {
        prompt: 'The shop is two clicks from every page and almost nobody uses it. Where did you expect to buy a book?',
        category: 'navigation',
        required: false,
      },
    ],
    needs: ['usability', 'copy_review'],
    tags: ['web', 'fiction', 'small-business'],
    versions: [
      {
        label: 'Staging 9',
        changelog:
          'Essay archive first, books below it, shop link in the footer.',
        platforms: ['web'],
        daysAgo: 26,
        current: false,
      },
      {
        label: 'Staging 12',
        changelog: 'Books above the essay archive. Shop link in the header. New homepage copy, third pass.',
        platforms: ['web'],
        daysAgo: 7,
        current: true,
        embedUrl: 'https://staging.harrowgatepress.com',
      },
    ],
    links: [{ kind: 'demo', label: 'Staging site', url: 'https://staging.harrowgatepress.com' }],
    createdDaysAgo: 35,
    publishedDaysAgo: 31,
    feedbackState: 'open',
    views: 903,
  },
  {
    slug: 'bellweather-cycles',
    title: 'Bellweather Cycles',
    tagline: 'A bike shop that does repairs in a day, saying so above the fold.',
    ownerHandle: 'beatricer',
    type: 'website',
    stage: 'shipped',
    summary:
      'A single page for a two mechanic shop in Lyon whose entire advantage is that they will fix your bike today. Live since March. Phone calls went up by about a third, which the owner is happy about, and online bookings did not move at all, which I am not.',
    coverSeed: 'hatch-bellweather-spoke-09',
    coverAlt: 'Grit hatch cover, fine radial strokes converging toward one point.',
    asks: [
      {
        prompt:
          'The booking form is the last section on the page. Would you have scrolled that far, and what did you expect the big button at the top to do?',
        detail: 'The button says Book a repair and it scrolls. I think that is the whole problem, but I want to be wrong in a specific way.',
        category: 'cta',
        required: true,
      },
    ],
    needs: ['usability', 'copy_review'],
    tags: ['web', 'small-business'],
    versions: [
      {
        label: 'Live, March',
        changelog: 'Launched. Repairs-in-a-day promise moved above the fold, opening hours in the header.',
        platforms: ['web'],
        daysAgo: 183,
        current: true,
        embedUrl: 'https://bellweathercycles.fr',
      },
    ],
    links: [{ kind: 'demo', label: 'bellweathercycles.fr', url: 'https://bellweathercycles.fr' }],
    createdDaysAgo: 29,
    publishedDaysAgo: 26,
    feedbackState: 'open',
    views: 1341,
  },
  {
    slug: 'the-last-loom',
    title: 'The Last Loom',
    tagline: 'Twenty two minutes on the last working jacquard loom in the valley.',
    ownerHandle: 'casperlq',
    type: 'video',
    stage: 'beta',
    summary:
      'A documentary short about a mill that has one loom left and one person who knows how to thread it. Fine cut, twenty two minutes, archive from the mill’s own collection and one interview shot over two days. The middle nine minutes are that interview almost uncut, and that is the decision I need argued with.',
    coverSeed: 'hatch-lastloom-warp-10',
    coverAlt: 'Grit hatch cover, fine vertical strokes crossed by a coarser horizontal weave.',
    asks: [
      {
        prompt:
          'The middle section is nine minutes of one interview. I think it earns it, three people say it does not. Give me the timecode where you first looked away.',
        detail: 'Watch it once, at full size, with sound. If you did not look away, say where you almost did.',
        category: 'pacing',
        required: true,
      },
      {
        prompt: 'Does the archive at 03:10 read as the same mill, or as stock footage?',
        category: 'structure',
        required: false,
      },
    ],
    needs: ['usability', 'art_direction'],
    tags: ['documentary'],
    versions: [
      {
        label: 'Fine cut 1',
        changelog:
          'First assembly at twenty six minutes. Interview completely uncut, no archive grade.',
        platforms: ['web'],
        daysAgo: 44,
        current: false,
      },
      {
        label: 'Fine cut 3',
        changelog: 'Interview tightened by 40 seconds. Archive at 03:10 regraded. Room tone rebuilt under the opening.',
        platforms: ['web'],
        daysAgo: 12,
        current: true,
        embedUrl: 'https://lindqvist.film/lastloom/finecut3',
      },
      {
        label: 'Fine cut 2',
        changelog: 'First pass with the new opening. Interview still full length.',
        platforms: ['web'],
        daysAgo: 33,
        current: false,
      },
    ],
    links: [{ kind: 'demo', label: 'Watch the fine cut', url: 'https://lindqvist.film/lastloom/finecut3' }],
    createdDaysAgo: 57,
    publishedDaysAgo: 54,
    feedbackState: 'open',
    views: 2216,
  },
  {
    slug: 'six-minutes-on-the-ice',
    title: 'Six Minutes on the Ice',
    tagline: 'A short about the grounds crew who rebuild a rink between periods.',
    ownerHandle: 'imanifrazier',
    type: 'video',
    stage: 'prototype',
    summary:
      'Six minutes, scratch audio, no music yet. The crew get seventeen minutes to resurface an arena that fourteen thousand people are watching, and nobody films them. I shot two nights with a single camera and I have cut it the way I cut everything, which is hook first and hope the ending arrives.',
    coverSeed: 'hatch-sixminutes-blade-13',
    coverAlt: 'Grit hatch cover, medium strokes swept into one long curve.',
    asks: [
      {
        prompt: 'I think this just stops at 5:40 instead of ending. Tell me what the last shot is saying, in your words.',
        detail: 'If your answer is that it says nothing, that is what I expect and I would still like to hear it said.',
        category: 'structure',
        required: true,
      },
    ],
    needs: ['usability'],
    tags: ['short-form'],
    versions: [
      {
        label: 'Rough cut 1',
        changelog:
          'First assembly, seven minutes, single night of footage, forty second opening.',
        platforms: ['web'],
        daysAgo: 28,
        current: false,
      },
      {
        label: 'Rough cut 2',
        changelog: 'Opening trimmed to 11 seconds. Second night footage cut in from 02:20.',
        platforms: ['web'],
        daysAgo: 15,
        current: true,
        embedUrl: 'https://frazier.tv/ice/rough2',
      },
    ],
    links: [{ kind: 'demo', label: 'Rough cut', url: 'https://frazier.tv/ice/rough2' }],
    createdDaysAgo: 24,
    publishedDaysAgo: 21,
    feedbackState: 'open',
    views: 1476,
  },
  {
    slug: 'ashfall',
    title: 'Ashfall',
    tagline: 'A one take music video shot at the edge of a controlled burn.',
    ownerHandle: 'kwamemensah',
    type: 'video',
    stage: 'release_candidate',
    summary:
      'Three minutes fifty, one take, shot at dusk beside a managed burn with a crew of five and a fire service liaison who was not enjoying himself. Locked cut, delivery Friday. Graded warm on purpose, which is the opposite of what I usually argue for.',
    coverSeed: 'hatch-ashfall-ember-14',
    coverAlt: 'Grit hatch cover, dense fine strokes thinning toward the upper edge.',
    asks: [
      {
        prompt: 'Does the cut at 1:12 read as intentional, or as a mistake? Watch it once at full size before you read anything else.',
        detail: 'It is the only cut in the film. If you did not notice it, say that, that is the best possible answer.',
        category: 'color',
        required: true,
      },
    ],
    needs: ['art_direction', 'usability'],
    tags: ['music-video'],
    versions: [
      {
        label: 'Grade 2',
        changelog:
          'Second grade pass, warmer. The join at 1:12 is still visible against the sky.',
        platforms: ['web'],
        daysAgo: 16,
        current: false,
      },
      {
        label: 'Locked cut',
        changelog: 'Final grade. One cut retained at 1:12. Delivery master at 4K, review link at 1080.',
        platforms: ['web'],
        daysAgo: 4,
        current: true,
        embedUrl: 'https://mensah.film/ashfall/review',
      },
    ],
    links: [{ kind: 'demo', label: 'Review link', url: 'https://mensah.film/ashfall/review' }],
    createdDaysAgo: 18,
    publishedDaysAgo: 14,
    feedbackState: 'open',
    views: 1893,
  },
  {
    slug: 'standing-order',
    title: 'Standing Order',
    tagline: 'Standing weekly pre-orders for neighbourhood bakeries, priced against waste.',
    ownerHandle: 'sofiabrandao',
    type: 'business_idea',
    stage: 'concept',
    summary:
      'Customers commit to a standing weekly order, the bakery bakes to that number instead of to a guess, and the price sits between retail and wholesale because the risk moved. My family ran a bakery for thirty years and threw away money every Monday. The whole thing rests on one claim I cannot test from here.',
    coverSeed: 'hatch-standingorder-loaf-15',
    coverAlt: 'Grit hatch cover, coarse strokes in a repeating stacked pattern.',
    asks: [
      {
        prompt:
          'Would a bakery change its Monday production plan for 11 confirmed orders? If you have run a kitchen, give me the number where you would actually change the plan.',
        detail: 'I picked eleven because that is what my father would have said. I have no evidence beyond that.',
        category: 'assumptions',
        required: true,
      },
      {
        prompt: 'Who copies this in a weekend, and what stops them?',
        category: 'moat',
        required: false,
      },
    ],
    needs: ['positioning', 'pricing'],
    tags: ['small-business'],
    versions: [
      {
        label: 'Memo 1',
        changelog:
          'First memo. The claim, the price, and no waste numbers behind either of them.',
        platforms: ['web'],
        daysAgo: 22,
        current: false,
      },
      {
        label: 'Memo 2',
        changelog: 'Second memo. Adds waste numbers from two bakeries and a worked unit economics table.',
        platforms: ['web'],
        daysAgo: 9,
        current: true,
      },
    ],
    links: [{ kind: 'other', label: 'The two page memo', url: 'https://standingorder.co/memo' }],
    createdDaysAgo: 20,
    publishedDaysAgo: 17,
    feedbackState: 'open',
    views: 731,
  },
  {
    slug: 'meterwise',
    title: 'Meterwise',
    tagline: 'Audit commercial energy bills the way a consultant does, in an afternoon.',
    ownerHandle: 'noorfarhat',
    type: 'business_idea',
    stage: 'prototype',
    summary:
      'Upload twelve months of bills, get back the same findings I used to produce by hand over three days: wrong tariff, reactive power penalties, meters billed on estimates for a year. I did this for eight years and charged a share of what I saved. The tool works. The business model is the part I am asking about.',
    coverSeed: 'hatch-meterwise-load-16',
    coverAlt: 'Grit hatch cover, medium strokes stepping in a rising staircase.',
    asks: [
      {
        prompt:
          'The pricing page says 400 a month. My old clients paid a third of what I saved them. Which model would you have signed, and what stopped you signing the other one?',
        detail: 'Answer as a buyer if you can, and say what you buy for your company today.',
        category: 'pricing_model',
        required: true,
      },
    ],
    needs: ['pricing', 'positioning'],
    tags: ['energy', 'small-business'],
    versions: [
      {
        label: 'Prototype 4',
        changelog:
          'One tariff format. Findings report names the problem without citing the clause.',
        platforms: ['web'],
        daysAgo: 24,
        current: false,
      },
      {
        label: 'Prototype 5',
        changelog: 'Handles three tariff formats. Findings report now cites the clause it is disputing.',
        platforms: ['web'],
        daysAgo: 14,
        current: true,
        embedUrl: 'https://meterwise.io/findings-report',
      },
    ],
    links: [{ kind: 'other', label: 'A redacted findings report', url: 'https://meterwise.io/findings-report' }],
    createdDaysAgo: 27,
    publishedDaysAgo: 23,
    feedbackState: 'open',
    views: 664,
  },
  {
    slug: 'kestrel-deck',
    title: 'Kestrel Deck',
    tagline: 'A split keyboard with a hinge, for people who travel with one bag.',
    ownerHandle: 'marcusweill',
    type: 'hardware',
    stage: 'release_candidate',
    summary:
      'Two halves, one hinge, folds to the size of a paperback. Aluminium frame, hot swap sockets, forty two days on a charge. DVT units are with eight people and the tooling quote is due in three weeks, which is the last moment anything about the hinge can change.',
    coverSeed: 'hatch-kestrel-hinge-17',
    coverAlt: 'Grit hatch cover, two fine hatched panels meeting along a central seam.',
    asks: [
      {
        prompt:
          'The hinge is rated for 20 000 cycles and I think that is the wrong number. If you have carried the unit for a week, tell me what you do with it when you are not typing.',
        detail: 'I care about the bag, the desk edge, and whether you fold it one handed. That is what kills hinges, not typing.',
        category: 'mechanism',
        required: true,
      },
      {
        prompt: 'Does the unit feel like it costs what it costs, before I tell you the price?',
        category: 'industrial_design',
        required: false,
      },
    ],
    needs: ['playtesters', 'technical_review'],
    tags: ['keyboards'],
    versions: [
      {
        label: 'DVT 2',
        changelog: 'Hinge detent softened. Case wall thickened at the fold. Battery moved to the left half.',
        platforms: ['hardware'],
        daysAgo: 21,
        current: true,
      },
      {
        label: 'EVT 4',
        changelog: 'Last engineering build. Two hinge variants tested side by side.',
        platforms: ['hardware'],
        daysAgo: 62,
        current: false,
      },
    ],
    links: [
      { kind: 'other', label: 'Dimensions, materials and the current bill of materials', url: 'https://weillindustrial.com/kestrel' },
    ],
    createdDaysAgo: 68,
    publishedDaysAgo: 65,
    feedbackState: 'open',
    views: 2884,
  },
  {
    slug: 'ember-lantern',
    title: 'Ember Lantern',
    tagline: 'A camping lantern that still turns on at minus twenty.',
    ownerHandle: 'suvikallio',
    type: 'hardware',
    stage: 'beta',
    summary:
      'Every lantern I have owned has failed in the cold, usually because the battery chemistry gave up and the firmware did not admit it. This one warms its own cell before it draws from it, runs for eleven hours at the middle detent, and has a dial instead of a screen. Twelve working prototypes exist and six of them are outdoors right now.',
    coverSeed: 'hatch-ember-detent-18',
    coverAlt: 'Grit hatch cover, concentric hatched rings with three notches.',
    asks: [
      {
        prompt:
          'Use it in a tent, in gloves, in the dark. Did you ever need to know the exact battery percentage, or was the third detent enough?',
        detail:
          'The dial has three detents and no display. I have been told this is confident and also that it is unreadable. Both from people who camp.',
        category: 'power',
        required: true,
      },
    ],
    needs: ['playtesters', 'technical_review'],
    tags: ['camping'],
    versions: [
      {
        label: 'Proto 9',
        changelog:
          'First cold-start firmware. Smooth dial with no detents, hook without a stop.',
        platforms: ['hardware'],
        daysAgo: 34,
        current: false,
      },
      {
        label: 'Proto 12',
        changelog: 'Cell pre-warm below minus five. Detent force raised for gloved hands. Hook reinforced.',
        platforms: ['hardware'],
        daysAgo: 19,
        current: true,
      },
    ],
    links: [{ kind: 'other', label: 'Cold chamber test log', url: 'https://emberlantern.fi/testlog' }],
    createdDaysAgo: 44,
    publishedDaysAgo: 40,
    feedbackState: 'open',
    views: 1207,
  },
  {
    slug: 'coastline-rebrand',
    title: 'Coastline Rebrand',
    tagline: 'Wayfinding and identity for a ferry operator with nine terminals and bad weather.',
    ownerHandle: 'hanakuro',
    type: 'design',
    stage: 'beta',
    summary:
      'Nine terminals, four of them open to the sea, and a timetable that changes with the tide. The identity is secondary. The real work is a departure board somebody can read at four metres in the rain while running. Applied draft: board, ticket, hull livery and the app header, all from one grid.',
    coverSeed: 'hatch-coastline-board-19',
    coverAlt: 'Grit hatch cover, fine ruled bands broken by three heavier markers.',
    asks: [
      {
        prompt:
          'Read the terminal board proof at 40 pt from four metres, in poor light. Which element do you read first? If it is not the departure time, the system has failed.',
        detail: 'The board proof is the second image. Please answer before you look at the third.',
        category: 'composition',
        required: true,
      },
      {
        prompt: 'Does the livery still read as the same family at 200 metres?',
        category: 'brand_tone',
        required: false,
      },
    ],
    needs: ['art_direction', 'accessibility_audit'],
    tags: ['branding'],
    versions: [
      {
        label: 'Applied draft 2',
        changelog:
          'Identity applied to the board and the ticket. Departure time at the same weight as the destination.',
        platforms: ['web'],
        daysAgo: 30,
        current: false,
      },
      {
        label: 'Applied draft 4',
        changelog: 'Departure time promoted two steps. Destination set in the condensed width. Livery applied to two hull shapes.',
        platforms: ['web'],
        daysAgo: 13,
        current: true,
      },
    ],
    links: [{ kind: 'other', label: 'Full board of applied work', url: 'https://kurosawa.studio/coastline' }],
    createdDaysAgo: 50,
    publishedDaysAgo: 47,
    feedbackState: 'open',
    views: 2044,
  },
  {
    slug: 'understudy',
    title: 'Understudy',
    tagline: 'A component set that assumes your content is longer and uglier than the design file.',
    ownerHandle: 'joonhobaek',
    type: 'design',
    stage: 'shipped',
    summary:
      'Thirty one components, each one specified against the worst real content I could find rather than the tidy content that makes it look good. Every component ships its empty, loading, error and overflow state in the same file as its default. Rolled out to three teams over the last year and rewritten once because of what they did to the table.',
    coverSeed: 'hatch-understudy-frame-20',
    coverAlt: 'Grit hatch cover, very fine even strokes with one panel left blank.',
    asks: [
      {
        prompt:
          'Load the table with a 40 character name, an empty state and a failed request at the same time. Send me the screenshot of the first thing that breaks.',
        detail: 'The playground link has the three switches wired up. I want the screenshot more than the description.',
        category: 'states',
        required: true,
      },
    ],
    needs: ['technical_review', 'accessibility_audit'],
    tags: ['design-system', 'typescript', 'web'],
    versions: [
      {
        label: '2.0.3',
        changelog:
          'Last of the 2.0 line. Table before the rewrite, and no documented overflow states.',
        platforms: ['web'],
        daysAgo: 33,
        current: false,
      },
      {
        label: '2.1.0',
        changelog: 'Table rewritten around content that does not fit. Empty and error states documented per component.',
        platforms: ['web'],
        daysAgo: 25,
        current: true,
        embedUrl: 'https://understudy.baek.design/playground',
      },
    ],
    links: [
      { kind: 'docs', label: 'Component playground', url: 'https://understudy.baek.design/playground' },
      { kind: 'repo', label: 'Source', url: 'https://github.com/joonhobaek/understudy' },
    ],
    createdDaysAgo: 61,
    publishedDaysAgo: 59,
    feedbackState: 'open',
    views: 3312,
  },
  {
    slug: 'the-salt-line',
    title: 'The Salt Line',
    tagline: 'First chapter of a novel about a woman who inherits a lighthouse and its debts.',
    ownerHandle: 'petranilsen',
    type: 'writing',
    stage: 'prototype',
    summary:
      'Four thousand words. A woman comes back to a coast she left at nineteen to sign for a building nobody wants and a loan nobody mentioned. Eleven rewrites, and the opening has been a different sentence in every one of them. With agents now, which is why I would like to know where people stop.',
    coverSeed: 'hatch-saltline-tide-21',
    coverAlt: 'Grit hatch cover, horizontal strokes fading from dense to sparse.',
    asks: [
      {
        prompt: 'Quote the last sentence you read before you wanted to stop, even if it is the first one.',
        detail: 'I do not need encouragement. I need the stopping point and one line on what was happening in your head there.',
        category: 'opening',
        required: true,
      },
    ],
    needs: ['copy_review', 'usability'],
    tags: ['fiction'],
    versions: [
      {
        label: 'Draft 9',
        changelog:
          'Before the solicitor scene moved forward. Original opening paragraph, harbour walk first.',
        platforms: ['web'],
        daysAgo: 30,
        current: false,
      },
      {
        label: 'Draft 11',
        changelog: 'New opening paragraph. The solicitor scene moved ahead of the harbour walk.',
        platforms: ['web'],
        daysAgo: 11,
        current: true,
      },
    ],
    links: [{ kind: 'other', label: 'Read the chapter', url: 'https://nilsen.works/saltline' }],
    createdDaysAgo: 33,
    publishedDaysAgo: 30,
    feedbackState: 'open',
    views: 987,
  },
  {
    slug: 'nobody-reads-the-manual',
    title: 'Nobody Reads the Manual',
    tagline: 'An essay arguing that documentation fails at the sentence level, not the structural one.',
    ownerHandle: 'elowenprice',
    type: 'writing',
    stage: 'concept',
    summary:
      'The received wisdom is that documentation fails because it is badly organised. I think it fails because each individual sentence assumes a reader who already knows the answer. Outline plus two written sections, about eighteen hundred words of the eventual four thousand.',
    coverSeed: 'hatch-manual-index-22',
    coverAlt: 'Grit hatch cover, coarse strokes arranged as an uneven index.',
    asks: [
      {
        prompt: 'Say the argument back to me in one sentence. If you cannot, name the section where you lost it.',
        required: true,
      },
    ],
    needs: ['copy_review'],
    tags: ['essay'],
    versions: [
      {
        label: 'Outline 2',
        changelog:
          'Outline with section one written out and two of the three manuals chosen.',
        platforms: ['web'],
        daysAgo: 14,
        current: false,
      },
      {
        label: 'Outline 3',
        changelog: 'Sections two and four written out. The examples now come from three real manuals.',
        platforms: ['web'],
        daysAgo: 6,
        current: true,
      },
    ],
    links: [{ kind: 'other', label: 'Outline and two sections', url: 'https://harrowgatepress.com/manual-essay' }],
    createdDaysAgo: 13,
    publishedDaysAgo: 10,
    feedbackState: 'open',
    views: 522,
  },
  {
    slug: 'ledgerline',
    title: 'Ledgerline',
    tagline: 'Diff two database schemas and see which migration will lock a table.',
    ownerHandle: 'ruitavares',
    type: 'api_tool',
    stage: 'release_candidate',
    summary:
      'Point it at two schemas and it prints the migration between them, annotated with which statements take a lock, for how long, and on which engine. Postgres and MySQL. It exists because I once locked a table for forty minutes during a sale and would prefer that nobody repeat it.',
    coverSeed: 'hatch-ledgerline-diff-23',
    coverAlt: 'Grit hatch cover, two fine hatched columns offset against each other.',
    asks: [
      {
        prompt:
          'Install it on a clean machine and diff two schemas with a timer running. I want the number of minutes, the number of tabs, and the exact text of any error.',
        detail: 'The quickstart claims four minutes. I have never been able to reproduce four minutes on a machine that was not mine.',
        category: 'install',
        required: true,
      },
      {
        prompt: 'Is the lock annotation legible if you have never thought about lock modes?',
        category: 'docs',
        required: false,
      },
    ],
    needs: ['technical_review', 'usability'],
    tags: ['rust', 'sqlite', 'developer-tools'],
    versions: [
      {
        label: '0.13.4',
        changelog:
          'Postgres only. Lock annotations without the engine citations, and the old connection error text.',
        platforms: ['mac', 'linux', 'win'],
        daysAgo: 34,
        current: false,
      },
      {
        label: '0.14.0-rc2',
        changelog: 'MySQL 8 support. Lock annotations cite the engine documentation. New error text on a failed connection.',
        platforms: ['mac', 'linux', 'win'],
        daysAgo: 8,
        current: true,
      },
    ],
    links: [
      { kind: 'repo', label: 'Source', url: 'https://github.com/ruitavares/ledgerline' },
      { kind: 'docs', label: 'Quickstart', url: 'https://ledgerline.dev/quickstart' },
    ],
    createdDaysAgo: 39,
    publishedDaysAgo: 36,
    feedbackState: 'open',
    views: 2391,
  },
  {
    slug: 'cairn',
    title: 'Cairn',
    tagline: 'A command line accessibility audit that tells you which rule you broke and where.',
    ownerHandle: 'nkechiobi',
    type: 'api_tool',
    stage: 'shipped',
    summary:
      'Runs the WCAG 2.2 rules it can check mechanically against a real page and prints each failure with a selector, a success criterion and the source line. Version 2 changed the output from a flat table to findings grouped by criterion, which was either the best decision I have made this year or the reason three people pinned version 1.',
    coverSeed: 'hatch-cairn-stack-24',
    coverAlt: 'Grit hatch cover, fine strokes stacked in graduated bands.',
    asks: [
      {
        prompt:
          'Run version 2 on a real project, not the bundled fixture. Did the grouped output make you fix more findings than the old table, or fewer?',
        detail: 'If you pinned version 1, I especially want to hear from you, and I would like the reason in one sentence.',
        category: 'docs',
        required: true,
      },
    ],
    needs: ['technical_review', 'accessibility_audit'],
    tags: ['accessibility', 'typescript', 'developer-tools'],
    versions: [
      {
        label: '2.0.1',
        changelog: 'Grouped output by success criterion. JSON output stable. Exit code 2 reserved for configuration errors.',
        platforms: ['mac', 'linux', 'win'],
        daysAgo: 22,
        current: true,
      },
      {
        label: '1.9.3',
        changelog: 'Final version 1 release. Table output, still supported behind a flag.',
        platforms: ['mac', 'linux', 'win'],
        daysAgo: 90,
        current: false,
      },
    ],
    links: [
      { kind: 'repo', label: 'Source', url: 'https://github.com/nkechiobi/cairn' },
      { kind: 'docs', label: 'Rule reference', url: 'https://obi.works/cairn/rules' },
    ],
    createdDaysAgo: 55,
    publishedDaysAgo: 52,
    feedbackState: 'open',
    views: 3760,
  },
]

/* -------------------------------------------------------------------------- */
/* 6. Feedback                                                                */
/* -------------------------------------------------------------------------- */

export type Severity = 'praise' | 'nit' | 'minor' | 'major' | 'blocker'
export type Actionability = 'observation' | 'opinion' | 'suggestion' | 'actionable' | 'repro'
export type AnchorKind = 'timecode' | 'route' | 'screen' | 'level' | 'selector'

/** The bug triple. Required whenever a point is filed as a reproduction. */
export interface SeedRepro {
  readonly steps: string
  readonly result: string
  readonly expected: string
  readonly frequency: 'always' | 'often' | 'once' | 'could-not-reproduce'
}

export interface SeedPoint {
  readonly category: string
  /** Literata. One observation, in one category, written by a person. */
  readonly body: string
  readonly severity: Severity
  readonly actionability: Actionability
  readonly sentiment: -1 | 0 | 1
  readonly anchorKind?: AnchorKind
  readonly anchorValue?: string
  readonly timecodeMs?: number
  readonly repro?: SeedRepro
  /** Index into the project’s asks, when this point answers one. */
  readonly askIndex?: number
  /** Clustering key. Points sharing one are the same complaint from many people. */
  readonly theme?: string
  readonly upvotes?: number
  readonly resolved?: boolean
}

export interface SeedReply {
  readonly author: string
  readonly body: string
  readonly daysAfter: number
  readonly pointIndex?: number
  /** Index of an earlier reply in the same array, for one level of nesting. */
  readonly parent?: number
}

export interface SeedFeedback {
  readonly key: string
  readonly project: string
  readonly reviewer: string
  readonly versionLabel?: string
  readonly headline: string
  /** Literata. The reviewer’s overall read, before the individual points. */
  readonly summary?: string
  readonly timeSpentMinutes: number
  readonly environment?: Readonly<Record<string, string>>
  readonly daysAgo: number
  readonly origin?: 'organic' | 'invited' | 'bounty'
  readonly bounty?: string
  readonly visibility?: 'public' | 'creator_only'
  readonly ratings: Readonly<Record<string, number>>
  readonly points: readonly SeedPoint[]
  readonly replies?: readonly SeedReply[]
  readonly creatorMarkedHelpful?: boolean
  readonly inboxState: 'new' | 'read' | 'triaged' | 'actioned' | 'archived'
  /** Community upvotes on the whole submission. */
  readonly votes?: number
}

export const FEEDBACK: readonly SeedFeedback[] = [
  /* ---------------------------- Brinehollow ------------------------------ */
  {
    key: 'bh-greta-1',
    project: 'brinehollow',
    reviewer: 'gretalind',
    versionLabel: 'v0.7.1',
    headline: 'Four runs, one crash, and the tide meter is still winning',
    summary:
      'Four full runs on the current build, about eighty minutes. The tutorial change worked on me: I knew what the boat was for by the second beat, which was not true when I played v0.6.4. The tide meter is a different story. I can tell you the number now because it has a numeral, but I only ever read it when the alarm plays, and by then the decision I would have used it for is already made.',
    timeSpentMinutes: 82,
    environment: { os: 'Windows 11', device: 'Desktop, RTX 3060', build: 'v0.7.1', resolution: '2560×1440' },
    daysAgo: 6,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 3, performance: 3 },
    points: [
      {
        category: 'hud',
        body:
          'I never looked at the tide meter on my own. Not once in four runs. I looked at it when the alarm played, which is about eleven seconds before the tide arrives, and at that point the only decision left is whether to drop something. The meter is in the top right, which is correct, but nothing on screen ever points at it until it is too late to act on it.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Descent, top right HUD',
        askIndex: 1,
        theme: 'tide-meter-invisible',
        upvotes: 14,
      },
      {
        category: 'bug',
        body:
          'Crash on the salvage screen, reproducible. It only happens if you sort by weight and then drop the last item in the list, which is why I think it survived the 0.7.1 fix.',
        severity: 'blocker',
        actionability: 'repro',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Salvage, post-run',
        repro: {
          steps:
            '1. Finish a run with at least four items. 2. On the salvage screen, sort by weight. 3. Drop the last item in the sorted list.',
          result: 'The game closes to desktop with no dialog. The run is not saved and the items are gone.',
          expected:
            'The item is dropped and the list re-sorts. The 0.7.1 notes say the salvage screen crash was fixed, which is where the expectation came from.',
          frequency: 'always',
        },
        theme: 'salvage-sort-crash',
        upvotes: 9,
      },
      {
        category: 'difficulty_curve',
        body:
          'The second descent is harder than the third and the fourth. I died twice on the second and then walked the rest of the run. If that is deliberate, the game does not say so anywhere.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: 0,
        anchorKind: 'level',
        anchorValue: 'Descent 2',
      },
      {
        category: 'delight',
        body:
          'The sound the boat makes when it is overloaded is the best teaching tool in the game. I changed my behaviour because of it before I understood the weight system at all. Please do not smooth that out.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        theme: 'boat-sound-keep',
        upvotes: 7,
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'The sort-then-drop path is real and I can reproduce it here. It is a different code path from the one I fixed, which is embarrassing but useful. Fix is in for v0.7.2. On the tide meter: you are the ninth person to say a version of this, so it is not the position, it is that nothing pulls your eye to it. I am trying a version where the boat itself reacts.',
        daysAfter: 1,
        pointIndex: 1,
      },
      {
        author: 'gretalind',
        body:
          'If the boat reacts, please make the reaction readable in peripheral vision. Colour alone will not reach me while I am looking at a card.',
        daysAfter: 1,
        parent: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 18,
  },
  {
    key: 'bh-tobi-1',
    project: 'brinehollow',
    reviewer: 'tobiadeyemi',
    versionLabel: 'v0.7.1',
    headline: 'The first ninety seconds, narrated beat by beat',
    summary:
      'I recorded my first session and wrote this against the recording, so every time below is a real timestamp rather than an impression. Short version: beat three is where you lose people, and it is not because it is confusing. It is because it is the first moment the game asks you to read while something is moving.',
    timeSpentMinutes: 46,
    environment: { os: 'macOS 15.2', device: 'MacBook Pro M2', build: 'v0.7.1' },
    daysAgo: 11,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 2, performance: 4 },
    points: [
      {
        category: 'tutorial',
        body:
          'Beat three is the failure. At 0:38 the tide meter fills for the first time and the text box explaining the meter appears at the same moment. I watched the meter, missed the text, and then the text was gone. I did not know what the meter meant until my second run.\n\nThe fix I would try first is not rewriting the text. It is holding the meter still until the text is dismissed. You already do exactly this on beat two, and beat two worked on me perfectly.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '0:38',
        timecodeMs: 38000,
        askIndex: 0,
        theme: 'tutorial-beat-three',
        upvotes: 21,
      },
      {
        category: 'tutorial',
        body:
          'Beat one is genuinely good. You put the player in the boat before you explain the boat, and the first card is placed under the cursor rather than in a panel. I have watched four hundred people open software and that specific move works nearly every time.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        anchorKind: 'timecode',
        anchorValue: '0:04',
        timecodeMs: 4000,
      },
      {
        category: 'copy',
        body:
          'The line on beat four reads “Choose a door. Choose carefully.” The second sentence adds nothing except pressure, and pressure at the moment of a first choice is what makes people click away rather than think. I would cut it and let the tide meter do that job.',
        severity: 'nit',
        actionability: 'suggestion',
        sentiment: 0,
        anchorKind: 'timecode',
        anchorValue: '1:12',
        timecodeMs: 72000,
      },
      {
        category: 'confusion',
        body:
          'I could not tell whether the tutorial was a real run. When it ended and dropped me at the town I assumed I had failed. A single line at the end saying what just happened would settle it.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: -1,
        theme: 'tutorial-beat-three',
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'Holding the meter until the text is dismissed is obviously right and I am annoyed I did not see it, because you are correct that beat two already does it. That is in the next build. The pressure line is cut.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 26,
  },
  {
    key: 'bh-dan-1',
    project: 'brinehollow',
    reviewer: 'danyero',
    versionLabel: 'v0.7.1',
    headline: 'Weight is the best idea in here and the least explained',
    summary:
      'Six runs. I am the wrong audience in that I will tolerate a lot of opacity to find a system, so weight me accordingly. The weight rule is excellent and I found it by accident on run three.',
    timeSpentMinutes: 104,
    environment: { os: 'Windows 11', device: 'Desktop', build: 'v0.7.1' },
    daysAgo: 14,
    ratings: { fun: 5, balance: 4, game_feel: 4, onboarding: 2, performance: 4 },
    points: [
      {
        category: 'economy',
        body:
          'Better tools weigh more, and weight costs you time on the way out. That is the whole game and I had to derive it. The card text says the weight number but nothing ever says that weight is time. Once I understood it, every decision got interesting. Before that I was picking the highest number.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: 0,
        anchorKind: 'screen',
        anchorValue: 'Card panel, weight line',
        theme: 'salvage-weight-unclear',
        upvotes: 16,
      },
      {
        category: 'controls',
        body:
          'The oar input eats a press if you buffer it during the drop animation. I measured it at roughly 7 frames where the input goes nowhere. Not fatal, but you notice it once and then you notice it every time.',
        severity: 'minor',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Descent, drop animation',
      },
      {
        category: 'difficulty_curve',
        body:
          'Run four onwards I had a dominant strategy: take nothing heavier than 3, never go past the second street, cash out. It is boring and it wins. Worth a look before you tune anything else.',
        severity: 'major',
        actionability: 'suggestion',
        sentiment: -1,
        anchorKind: 'level',
        anchorValue: 'Street 2',
        upvotes: 11,
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'The cash-out strategy is real and I have been avoiding it because the fix is either a tide penalty or a town cost, and I dislike both. Filing it rather than arguing with you about it.',
        daysAfter: 3,
        pointIndex: 2,
      },
    ],
    inboxState: 'triaged',
    votes: 15,
  },
  {
    key: 'bh-tayo-1',
    project: 'brinehollow',
    reviewer: 'tayobalogun',
    versionLabel: 'v0.7.1',
    headline: 'Walked the second street twice looking for a door that was behind me',
    summary:
      'Two runs, forty minutes, playing as a level designer which means I am looking at the space rather than the cards. The streets read beautifully in silhouette. The problem is that the exits do not.',
    timeSpentMinutes: 41,
    environment: { os: 'Windows 11', device: 'Desktop', build: 'v0.7.1' },
    daysAgo: 19,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'level_design',
        body:
          'On the second street the exit is behind the player’s start position. Every visual line in that room points forward: the lamps, the boat wake, the debris. I walked the whole street twice before I turned around, and when I did turn around it was because the tide alarm made me panic, not because anything told me.\n\nThe cheapest fix is one lamp turned the other way. You do not need signage in a game that reads this well in silhouette.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'level',
        anchorValue: 'Street 2',
        upvotes: 12,
      },
      {
        category: 'delight',
        body:
          'The silhouette work is the strongest thing here. I could identify every salvage type at distance by shape alone, in the dark, underwater. That is hard and you have done it.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        upvotes: 6,
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'One lamp turned the other way is exactly the size of fix I can make in an afternoon. It is turned in my working copy, and the next person I watched play the street turned round inside ten seconds. Thank you for the silhouette note too. That took two years and nobody had mentioned it.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 11,
  },
  {
    key: 'bh-emmett-1',
    project: 'brinehollow',
    reviewer: 'emmettquill',
    versionLabel: 'v0.7.1',
    headline: 'Really enjoyed this',
    summary: 'Played for a bit and had a good time. The art is great and the vibe is strong. Looking forward to the full thing.',
    timeSpentMinutes: 9,
    environment: { os: 'Windows 10', device: 'Laptop', build: 'v0.7.1' },
    daysAgo: 21,
    ratings: { fun: 5, balance: 4, game_feel: 5, onboarding: 4, performance: 4 },
    points: [
      {
        category: 'core_loop',
        body: 'The loop is fun and I wanted to keep going. Nothing really to complain about.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
      },
    ],
    inboxState: 'read',
    votes: 1,
  },
  {
    key: 'bh-nkechi-1',
    project: 'brinehollow',
    reviewer: 'nkechiobi',
    versionLabel: 'v0.7.1',
    headline: 'Colour is carrying the tide state alone, and the remap screen drops focus',
    summary:
      'Thirty five minutes with the keyboard only, then a pass with the colour filters on. Two things block play rather than annoy, and one of them is a ten minute fix.',
    timeSpentMinutes: 35,
    environment: { os: 'Windows 11', device: 'Desktop', build: 'v0.7.1', assistive: 'Keyboard only, deuteranopia filter' },
    daysAgo: 24,
    ratings: { fun: 4, balance: 3, game_feel: 3, onboarding: 2, performance: 4 },
    points: [
      {
        category: 'accessibility',
        body:
          'The tide meter goes from blue to red and nothing else changes. Under a deuteranopia filter those two states are nearly the same value, so the meter reads as full the whole time. You already have a numeral there, so the fix might be as small as making the numeral change weight or adding a fill pattern. This is the same finding as the people telling you they never notice the meter, incidentally. For me it is not that I do not notice it. It is that it never appears to change.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Descent, top right HUD',
        askIndex: 1,
        theme: 'tide-meter-invisible',
        upvotes: 19,
      },
      {
        category: 'bug',
        body: 'Keyboard focus is lost when the remap screen opens, and Escape does not close it. That is a trap: on a keyboard there is no way out except Alt and F4.',
        severity: 'blocker',
        actionability: 'repro',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Options, Remap controls',
        repro: {
          steps: '1. Open Options from the title screen with Tab and Enter. 2. Tab to Remap controls and press Enter.',
          result:
            'The remap panel opens but focus stays on the button behind it. Tab cycles the options list underneath. Escape does nothing.',
          expected:
            'Focus moves into the panel and Escape closes it. Every other panel in the game does exactly that, which is where the expectation came from.',
          frequency: 'always',
        },
        upvotes: 13,
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'The focus trap is fixed in my working copy and will go out with v0.7.2. Thank you for writing the tide meter finding the way you did. I had two piles of feedback that I thought were different problems and they are the same problem.',
        daysAfter: 2,
        pointIndex: 1,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 22,
  },
  {
    key: 'bh-aleksy-1',
    project: 'brinehollow',
    reviewer: 'aleksynowak',
    versionLabel: 'v0.7.1',
    headline: 'Nine year old laptop: fine until the third street, then not',
    timeSpentMinutes: 38,
    environment: { os: 'Windows 10', device: 'Laptop, Intel UHD 620', build: 'v0.7.1', resolution: '1366×768' },
    daysAgo: 27,
    ratings: { fun: 4, balance: 3, game_feel: 3, onboarding: 3, performance: 2 },
    points: [
      {
        category: 'performance',
        body:
          'Holds 60 on the first two streets, drops to about 22 on the third and stays there. The drop coincides with the water reflection layer appearing, which I can confirm because turning reflections off in options restores it completely. A preset that switches reflections off on integrated graphics would fix this for a lot of people quietly.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'level',
        anchorValue: 'Street 3',
        upvotes: 8,
      },
      {
        category: 'hud',
        body: 'At 1366 by 768 the card text clips on the third line. Not unreadable, but the last word goes under the frame.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Card panel at 1366×768',
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'The reflection layer is the one part of the renderer I never profiled on integrated graphics, and you found it through the options menu in one evening. I am adding a graphics preset that leaves it off on integrated graphics. The clipped card text at 1366 by 768 is a layout bug, and I can reproduce it here.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 7,
  },
  {
    key: 'bh-hugo-1',
    project: 'brinehollow',
    reviewer: 'hugobitt',
    versionLabel: 'v0.7.0',
    headline: 'Got lost in the tutorial, came back and loved it',
    summary:
      'First time I played I quit after about a minute because I did not understand what the meter was doing. Came back a week later, read the devlog first, and then had a great two hours. I am not sure what that says except that the devlog is doing work the game should be doing.',
    timeSpentMinutes: 118,
    environment: { os: 'macOS 14.6', device: 'MacBook Air M1', build: 'v0.7.0' },
    daysAgo: 31,
    ratings: { fun: 5, balance: 3, game_feel: 4, onboarding: 2, performance: 5 },
    points: [
      {
        category: 'tutorial',
        body:
          'The thing that made me quit the first time was the meter filling while text was on screen. I did not know which one to look at, so I looked at neither and then felt stupid, and then closed it.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        askIndex: 0,
        theme: 'tutorial-beat-three',
        upvotes: 9,
      },
      {
        category: 'core_loop',
        body: 'Once it clicked, two hours went. The cash-out decision at the end of each descent is the good part.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        anchorKind: 'screen',
        anchorValue: 'Descent, cash-out',
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'You are not stupid, the beat is badly built and you are the fourth person to describe that exact moment. It is being rebuilt. I am glad you came back.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    inboxState: 'actioned',
    votes: 12,
  },
  {
    key: 'bh-lena-1',
    project: 'brinehollow',
    reviewer: 'lenahavel',
    versionLabel: 'v0.7.1',
    headline: 'I read the number and then ignored the number',
    timeSpentMinutes: 28,
    environment: { os: 'Linux, Fedora 41', device: 'Desktop', build: 'v0.7.1' },
    daysAgo: 16,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'hud',
        body:
          'I looked at the tide number once per descent, at the start, and then made my whole plan from it and never checked again. So the numeral works, and the live state does not. That may be fine. I am not sure it is a problem that you have to decide to look at it.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: 0,
        anchorKind: 'screen',
        anchorValue: 'Descent, top right HUD',
        askIndex: 1,
        theme: 'tide-meter-invisible',
        upvotes: 5,
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'Planning from the number once and never checking again is a real way to play, and it may be the right one for some people. It does mean the live state has to reach you without being looked at, which is where the work on the boat is heading.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'read',
    votes: 4,
  },
  {
    key: 'bh-vikram-1',
    project: 'brinehollow',
    reviewer: 'vikramsahni',
    versionLabel: 'v0.7.1',
    headline: 'Steam Deck: runs well, text does not',
    timeSpentMinutes: 52,
    environment: { device: 'Steam Deck OLED', build: 'v0.7.1', resolution: '1280×800' },
    daysAgo: 23,
    ratings: { fun: 4, balance: 4, game_feel: 4, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'hud',
        body:
          'Card body text measures about 11 px on the Deck. I was holding it at normal distance and squinting. The tide numeral is fine; it is the card text that is the problem, and there are a lot of words on those cards.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Card panel, handheld',
        upvotes: 10,
      },
      {
        category: 'controls',
        body: 'Default Deck mapping puts drop on the right stick click, which I hit twice by accident while looking around.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: -1,
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'Eleven pixels is below anything I would accept on a monitor, never mind a handheld, and I had only ever checked the Deck docked. Card text gets its own size for handhelds. Drop is coming off the stick click as well; nobody presses it on purpose.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 9,
  },
  {
    key: 'bh-petra-1',
    project: 'brinehollow',
    reviewer: 'petranilsen',
    versionLabel: 'v0.7.1',
    headline: 'The town writing is doing more than the town screen is',
    timeSpentMinutes: 44,
    daysAgo: 29,
    environment: { os: 'macOS 15.1', device: 'iMac', build: 'v0.7.1' },
    ratings: { fun: 4, balance: 3, game_feel: 3, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'copy',
        body:
          'The two lines of text that appear when a building comes back are the most affecting thing in the game and they are on screen for about three seconds. I missed two of them entirely because I was already clicking. Let me read them at my own pace, or put them somewhere I can return to.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: 0,
        anchorKind: 'screen',
        anchorValue: 'Town, rebuild confirmation',
        upvotes: 8,
      },
      {
        category: 'delight',
        body: 'The line about the baker’s window is the reason I did a fourth run. Keep it.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'Three seconds was a guess I never went back to. The rebuild lines will stay until you dismiss them, and every one you have seen will be kept in the town hall so you can read it again. The line about the baker’s window is not changing.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 6,
  },
  {
    key: 'bh-fenella-1',
    project: 'brinehollow',
    reviewer: 'fenelladoyle',
    versionLabel: 'v0.7.1',
    headline: 'Line edits on the tutorial and the four cards that mislead',
    summary:
      'I do not play many games so take the play notes lightly. The words I will stand behind. Four card names describe the wrong thing, and one of them is the reason I misplayed for an hour.',
    timeSpentMinutes: 33,
    environment: { os: 'macOS 15.2', device: 'MacBook Pro', build: 'v0.7.1' },
    daysAgo: 26,
    ratings: { fun: 3, balance: 3, game_feel: 3, onboarding: 2, performance: 4 },
    points: [
      {
        category: 'copy',
        body:
          'The card called Ballast is not ballast, it removes weight. I spent an hour thinking it added weight for some later benefit. Yours: “Ballast”. Mine: “Jettison”. What changed: the word now names what the card does to the boat rather than what it is made of.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Card: Ballast',
        upvotes: 15,
      },
      {
        category: 'copy',
        body:
          'Tutorial beat two says “Take what the water will let you.” It is a lovely line and it is doing no instructional work at all. I would keep it and add a plain second line underneath, because at that moment the player needs a verb.',
        severity: 'nit',
        actionability: 'suggestion',
        sentiment: 0,
        anchorKind: 'screen',
        anchorValue: 'Tutorial, beat two',
        askIndex: 0,
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body: 'Ballast becomes Jettison in the next build. That name has been wrong for three years and nobody had put it that plainly.',
        daysAfter: 4,
        pointIndex: 0,
      },
    ],
    inboxState: 'actioned',
    votes: 14,
  },
  {
    key: 'bh-ingrid-1',
    project: 'brinehollow',
    reviewer: 'ingridvos',
    versionLabel: 'v0.7.0',
    headline: 'I did not know the run had ended',
    timeSpentMinutes: 22,
    environment: { os: 'Windows 11', device: 'Laptop', build: 'v0.7.0' },
    daysAgo: 37,
    ratings: { fun: 3, balance: 3, game_feel: 4, onboarding: 2, performance: 4 },
    points: [
      {
        category: 'confusion',
        body:
          'The transition from the descent to the town is instant and silent. I thought the game had crashed and I alt-tabbed out to check. A half second of the water closing over would solve it.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Descent to town',
        theme: 'tutorial-beat-three',
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'You are the second person to alt-tab out at exactly that moment, so it is not you. The cut from the water to the town is going to hold for a beat before the town loads. I have not built it yet, but it is written down where I will trip over it.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    inboxState: 'archived',
    votes: 3,
  },
  {
    key: 'bh-imani-1',
    project: 'brinehollow',
    reviewer: 'imanifrazier',
    versionLabel: 'v0.7.1',
    headline: 'Sound design is carrying the tension, music is fighting it',
    timeSpentMinutes: 31,
    environment: { os: 'macOS 15.2', device: 'MacBook Pro', build: 'v0.7.1', audio: 'Headphones' },
    daysAgo: 18,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'audio',
        body:
          'The music swells at the same moment the tide alarm plays, so the two are competing at the exact second you need the alarm to be the loudest thing in the room. Duck the music harder, or drop it out entirely for those eleven seconds. In a cut I would drop it out.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Descent, tide alarm',
        upvotes: 11,
      },
      {
        category: 'delight',
        body: 'Underwater muffling on the salvage sounds is excellent and I noticed it in the first ten seconds.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        anchorKind: 'screen',
        anchorValue: 'Descent, salvage pickup',
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'The duck has been there since v0.6.4, but it only takes the music down six decibels, and the cue swells at that moment because I wrote it to, which cancels the duck out. I tried your version and dropped the music entirely for the eleven seconds. It is much better. The muffling stays.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 9,
  },
  {
    key: 'bh-joonho-1',
    project: 'brinehollow',
    reviewer: 'joonhobaek',
    versionLabel: 'v0.7.1',
    headline: 'Salvage list breaks with long item names',
    timeSpentMinutes: 26,
    environment: { os: 'macOS 15.2', device: 'Studio Display', build: 'v0.7.1' },
    daysAgo: 20,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'hud',
        body:
          'Two of the late items have names long enough to push the weight column off the right edge of the salvage panel. The weight number is the only thing on that screen that matters, and it is the thing that disappears.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Salvage panel',
        theme: 'salvage-weight-unclear',
        upvotes: 7,
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'Both of those names arrived after I laid out the panel, and I never went back to it. The weight column gets a fixed width and long names truncate instead, because you are right that the weight is the only number on that screen that matters.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 6,
  },
  {
    key: 'bh-kwame-1',
    project: 'brinehollow',
    reviewer: 'kwamemensah',
    versionLabel: 'v0.7.1',
    headline: 'Two runs from somebody who does not play these',
    summary:
      'I am not a roguelike player, so this is a first impressions report and nothing more. I understood the boat, I never understood the cards, and I enjoyed myself anyway for about half an hour.',
    timeSpentMinutes: 34,
    environment: { os: 'Windows 11', device: 'Desktop', build: 'v0.7.1' },
    daysAgo: 13,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 2, performance: 4 },
    points: [
      {
        category: 'core_loop',
        body:
          'I played it as a game about a boat and mostly ignored the deck. That worked for two runs, which suggests the cards are optional longer than you probably want them to be.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: 0,
      },
      {
        category: 'delight',
        body:
          'The colour of the water at the moment the tide turns is the single best frame in the game. It is the only time the palette goes warm, and it lands.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        anchorKind: 'screen',
        anchorValue: 'Descent, tide turn',
        upvotes: 5,
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'Two runs on the boat alone tells me the deck becomes necessary later than I thought, which is a balance problem I would not have found by myself. And the warm frame is deliberate, so I am very glad it landed.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    inboxState: 'read',
    votes: 5,
  },
  {
    key: 'bh-sofia-1',
    project: 'brinehollow',
    reviewer: 'sofiabrandao',
    versionLabel: 'v0.7.1',
    headline: 'Never saw the meter until the alarm',
    timeSpentMinutes: 24,
    environment: { os: 'Windows 11', device: 'Laptop', build: 'v0.7.1' },
    daysAgo: 12,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'hud',
        body:
          'Three runs and I could not have told you there was a tide meter until the alarm went off. I was watching the water, which is the prettiest thing on screen.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        askIndex: 1,
        theme: 'tide-meter-invisible',
        upvotes: 4,
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'Watching the water is exactly the right thing to be doing, and it is where the tide state is going: onto the boat, where your eye already is.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'read',
    votes: 3,
  },
  {
    key: 'bh-omar-1',
    project: 'brinehollow',
    reviewer: 'omarhaddad',
    versionLabel: 'v0.7.1',
    headline: 'Two runs before I understood the meter was a timer',
    timeSpentMinutes: 29,
    environment: { os: 'Windows 10', device: 'Laptop', build: 'v0.7.1' },
    daysAgo: 15,
    ratings: { fun: 4, balance: 3, game_feel: 3, onboarding: 2, performance: 4 },
    points: [
      {
        category: 'hud',
        body:
          'I thought the meter in the corner was a score. It looked like a score: it went up. It took two runs and a death for me to work out it was counting down my time, which is a different thing entirely.',
        severity: 'major',
        actionability: 'suggestion',
        sentiment: -1,
        askIndex: 1,
        theme: 'tide-meter-invisible',
        upvotes: 8,
      },
      {
        category: 'tutorial',
        body: 'Beat three went past me. I read the text after the meter had already moved, which made the text about something I had missed.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: -1,
        askIndex: 0,
        theme: 'tutorial-beat-three',
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'A score rather than a timer is a reading I had not considered, and it explains two other reports I could not make sense of. It is going to count down visibly rather than fill. Beat three is being rebuilt for the same reason you describe in your second point.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 6,
  },
  {
    key: 'bh-beatrice-1',
    project: 'brinehollow',
    reviewer: 'beatricer',
    versionLabel: 'v0.7.1',
    headline: 'The meter is the right idea in the wrong place in the visual order',
    timeSpentMinutes: 27,
    environment: { os: 'macOS 15.2', device: 'MacBook Pro', build: 'v0.7.1' },
    daysAgo: 17,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'hud',
        body:
          'The meter sits top right in a scene whose whole composition runs bottom left to centre. The boat is bottom left, the cards are bottom centre, the salvage is mid screen. There is no reason for my eye to ever travel to that corner, and it never did. I would put it on the boat.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 1,
        theme: 'tide-meter-invisible',
        upvotes: 12,
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'You are the fourth person to say put it on the boat and the first to explain why in terms of the composition, which is the argument I needed to stop defending the corner. The tide state is moving onto the boat. The numeral stays in the corner for anybody who wants to read it.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 10,
  },
  {
    key: 'bh-suvi-1',
    project: 'brinehollow',
    reviewer: 'suvikallio',
    versionLabel: 'v0.7.1',
    headline: 'Quit at the tutorial the first time, stayed the second',
    timeSpentMinutes: 47,
    environment: { os: 'Linux, Arch', device: 'Desktop', build: 'v0.7.1' },
    daysAgo: 22,
    ratings: { fun: 4, balance: 4, game_feel: 4, onboarding: 2, performance: 5 },
    points: [
      {
        category: 'tutorial',
        body:
          'First attempt I closed it at about forty seconds. The meter started moving and I did not know whether I was supposed to be doing something about it, so I sat there doing nothing and then felt like the game had already started without me.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Tutorial, beat three',
        askIndex: 0,
        theme: 'tutorial-beat-three',
        upvotes: 7,
      },
      {
        category: 'hud',
        body: 'Second session I found the meter and then used it constantly. So it works once you know it is there.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: 0,
        askIndex: 1,
        theme: 'tide-meter-invisible',
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'Forty seconds in is where the meter starts moving while the tutorial is still talking, and you are the third person to close the game at that moment. It is being rebuilt. The second session is the most hopeful thing anybody has told me about that meter.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 6,
  },
  {
    key: 'bh-marcus-1',
    project: 'brinehollow',
    reviewer: 'marcusweill',
    versionLabel: 'v0.7.1',
    headline: 'One run, from somebody who has not played a roguelike since 2011',
    timeSpentMinutes: 19,
    environment: { os: 'Windows 11', device: 'Desktop', build: 'v0.7.1' },
    daysAgo: 25,
    ratings: { fun: 3, balance: 3, game_feel: 4, onboarding: 2, performance: 4 },
    points: [
      {
        category: 'hud',
        body:
          'I did not see the meter. I am told it is important. I looked at the cards and the boat and nothing else for nineteen minutes.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: -1,
        askIndex: 1,
        theme: 'tide-meter-invisible',
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'Nineteen minutes without once looking at it is the most useful version of this answer, because it rules out everything except where the meter is and what draws the eye there. Thank you for playing something so far outside your habits.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    inboxState: 'read',
    votes: 2,
  },
  {
    key: 'bh-casper-1',
    project: 'brinehollow',
    reviewer: 'casperlq',
    versionLabel: 'v0.7.1',
    headline: 'Pacing note from an editor, take it or leave it',
    summary:
      'I cut film for a living and I play maybe four games a year, so treat this as a pacing note rather than a design one. The descent has a rhythm and the town does not, and the join between them is abrupt in a way I do not think you intend.',
    timeSpentMinutes: 36,
    environment: { os: 'macOS 15.2', device: 'MacBook Pro', build: 'v0.7.1' },
    daysAgo: 28,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'core_loop',
        body:
          'In a cut I would hold the moment the water closes for about a second and a half before the town appears. Right now it is a hard cut on a match that does not match, and it flattens the end of a run that was otherwise building nicely.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: 0,
        anchorKind: 'screen',
        anchorValue: 'Descent to town',
        upvotes: 9,
      },
      {
        category: 'hud',
        body: 'I never once used the meter in the corner. My eye lives at the bottom of the frame in this game.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Descent, top right HUD',
        askIndex: 1,
        theme: 'tide-meter-invisible',
      },
    ],
    replies: [
      {
        author: 'mirasolvang',
        body:
          'A second and a half is a number I can build to, which nobody had given me before. It is on the roadmap as its own item now, next to Ingrid’s note about the same cut. The meter note is the same as everybody’s, and I am starting to think the answer is to stop asking anybody to look up there at all.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 8,
  },

  {
    key: 'bh-rui-1',
    project: 'brinehollow',
    reviewer: 'ruitavares',
    versionLabel: 'v0.7.2',
    headline: 'Linux build: controller works, keyboard rebinding does not persist',
    summary:
      'Two runs on Linux, about fifty minutes. The game itself gave me no trouble at all, which is rarer than it should be. One settings bug, and one note about the salvage screen that is probably a matter of taste.',
    timeSpentMinutes: 49,
    environment: { os: 'Linux, Fedora 41', device: 'Desktop, Steam controller and keyboard', build: 'v0.7.2' },
    daysAgo: 2,
    ratings: { fun: 4, balance: 4, game_feel: 4, onboarding: 3, performance: 5 },
    points: [
      {
        category: 'bug',
        body: 'Keyboard rebindings are forgotten between sessions on Linux. The controller bindings persist correctly.',
        severity: 'major',
        actionability: 'repro',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Options, Remap controls',
        repro: {
          steps: '1. Rebind drop from Q to E. 2. Confirm the change and quit to desktop. 3. Relaunch.',
          result: 'Drop is back on Q. The controller remap I made in the same session survived.',
          expected:
            'Both survive. The options file is written on quit, so I would look at whether the keyboard map is written before the file is flushed.',
          frequency: 'always',
        },
        upvotes: 4,
      },
      {
        category: 'hud',
        body:
          'On the salvage screen the weight column is right aligned and the name column is left aligned, so on a wide window the two are half a screen apart and I lost track of which weight belonged to which item.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: -1,
        theme: 'salvage-weight-unclear',
        upvotes: 3,
      },
    ],
    inboxState: 'new',
    votes: 3,
  },
  {
    key: 'bh-noor-1',
    project: 'brinehollow',
    reviewer: 'noorfarhat',
    versionLabel: 'v0.7.2',
    headline: 'First twenty minutes from somebody who plays one game a year',
    summary:
      'I am not a player and I went in cold on a friend’s recommendation. The tutorial was fine for me, which I mention because I gather it has not been for everybody. What stopped me was the town.',
    timeSpentMinutes: 23,
    environment: { os: 'Windows 11', device: 'Laptop', build: 'v0.7.2' },
    daysAgo: 1,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 4, performance: 4 },
    points: [
      {
        category: 'confusion',
        body:
          'After my first run I was dropped into the town with four buildings and no idea whether I was supposed to be spending, saving, or choosing. I clicked the first thing, it took my salvage, and I still do not know whether that was a good trade.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Town, first visit',
        upvotes: 5,
      },
    ],
    inboxState: 'new',
    votes: 2,
  },

  /* --------------------------- Lastlight Ferry --------------------------- */
  {
    key: 'llf-greta-1',
    project: 'lastlight-ferry',
    reviewer: 'gretalind',
    versionLabel: 'RC 4',
    headline: 'Parry reads as cheap on a controller and fair on a keyboard',
    summary:
      'Two full runs, one on each input, both to the second crossing and one to the end. The window is not the problem. The problem is that the wind-up animation is four frames longer on the controller build, so the same eight frame window arrives later than your hands expect.',
    timeSpentMinutes: 137,
    environment: { os: 'Windows 11', device: 'Desktop, Xbox controller and keyboard', build: 'RC 4' },
    daysAgo: 4,
    ratings: { fun: 4, balance: 3, game_feel: 3, onboarding: 4, performance: 4 },
    points: [
      {
        category: 'controls',
        body:
          'I recorded both and stepped through. On keyboard the oar wind-up is 11 frames and the parry lands where I expect it. On controller it is 15, and I ate three hits in a row on the second crossing doing exactly what had worked twenty minutes earlier. I do not think you need to change the window. I think the two builds disagree.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'level',
        anchorValue: 'Second crossing',
        askIndex: 0,
        theme: 'parry-input-lag',
        upvotes: 17,
      },
      {
        category: 'bug',
        body: 'Audio drops out entirely after a death on the second crossing, until the next loading screen.',
        severity: 'major',
        actionability: 'repro',
        sentiment: -1,
        repro: {
          steps: '1. Reach the second crossing. 2. Die to the thing in the water rather than by drowning. 3. Continue from the checkpoint.',
          result: 'All audio is gone. Music, effects, ambience. It returns at the next loading screen.',
          expected: 'Audio continues. It behaves correctly when you die by drowning, which is why I think it is the death path and not the checkpoint.',
          frequency: 'often',
        },
        upvotes: 8,
      },
    ],
    replies: [
      {
        author: 'danyero',
        body:
          'The frame difference is real. The controller build has an extra animation blend that I added in RC 2 and never removed. That is a two line fix and it is the best thing anybody has told me this month.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 21,
  },
  {
    key: 'llf-emmett-1',
    project: 'lastlight-ferry',
    reviewer: 'emmettquill',
    versionLabel: 'RC 3',
    headline: 'Parry felt cheap',
    summary: 'I died a lot and it felt unfair. Might just be me though, I am not great at these.',
    timeSpentMinutes: 14,
    environment: { os: 'Windows 10', device: 'Laptop, controller', build: 'RC 3' },
    daysAgo: 9,
    ratings: { fun: 3, balance: 2, game_feel: 2, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'controls',
        body: 'The parry felt cheap. I could not get the timing at all.',
        severity: 'major',
        // Directional, not a preference: the card prints 'opinion' as
        // "Preference", which reads as a matter of taste, and this one names
        // the thing that has to change — the parry timing — without naming how.
        // A major stamped "Preference" says "this is serious" and "no change
        // implied" in one block, which is the contradiction the audit's
        // 'faults the same card calls a matter of preference' check is for.
        actionability: 'suggestion',
        sentiment: -1,
        askIndex: 0,
        theme: 'parry-input-lag',
      },
    ],
    replies: [
      {
        author: 'danyero',
        body:
          'Which input were you on? Greta found a four frame difference between controller and keyboard and if you were on a controller you were probably right and not bad at it.',
        daysAfter: 2,
        pointIndex: 0,
      },
      {
        author: 'emmettquill',
        body: 'Controller. That would explain it, I thought I was losing my mind.',
        daysAfter: 3,
        parent: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 4,
  },
  {
    key: 'llf-tayo-1',
    project: 'lastlight-ferry',
    reviewer: 'tayobalogun',
    versionLabel: 'RC 3',
    headline: 'The second hour has a false ending at the lantern',
    timeSpentMinutes: 118,
    environment: { os: 'Windows 11', device: 'Desktop', build: 'RC 3' },
    daysAgo: 11,
    ratings: { fun: 4, balance: 4, game_feel: 4, onboarding: 4, performance: 4 },
    points: [
      {
        category: 'level_design',
        body:
          'When you reach the lantern at roughly the ninety minute mark, everything reads as an ending. The music resolves, the water goes flat, the camera pulls back, and there is a long walk to the boat. I put the controller down. Then there is another twenty five minutes, and they are good minutes, but I spent the first five of them confused rather than present.\n\nIf the lantern is not the end, it should not be shot like the end. Either move the resolve to the actual ending or give the player one clear beat at the lantern that says the work is not finished.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'level',
        anchorValue: 'The lantern, ~1:30',
        askIndex: 1,
        upvotes: 13,
      },
      {
        category: 'delight',
        body: 'The rowing animation on the long crossings is worth the price on its own. Nothing else does that.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
      },
    ],
    replies: [
      {
        author: 'danyero',
        body:
          'I shot the lantern as an ending because for most of development it was one. The last act came a year later and I never re-cut the moment before it. The music will not resolve there any more.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 12,
  },
  {
    key: 'llf-mira-1',
    project: 'lastlight-ferry',
    reviewer: 'mirasolvang',
    versionLabel: 'RC 3',
    headline: 'Eight frames is fine. The tell is not.',
    timeSpentMinutes: 96,
    environment: { os: 'Windows 11', device: 'Desktop, keyboard', build: 'RC 3' },
    daysAgo: 13,
    ratings: { fun: 5, balance: 4, game_feel: 4, onboarding: 4, performance: 4 },
    points: [
      {
        category: 'controls',
        body:
          'I have been building an input buffer for four years so I will say this precisely: your window is generous, your tell is not. The enemy wind-up reads at about 60 per cent of its animation, which means the visual cue and the mechanical cue are out of step by three or four frames. Players will describe that as an unfair window even though the window is fine. Frame the tell earlier and leave the eight frames alone.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: 0,
        askIndex: 0,
        theme: 'parry-input-lag',
        upvotes: 19,
      },
    ],
    replies: [
      {
        author: 'danyero',
        body: 'This and Greta’s report are the same bug seen from two angles. Tell is being reframed for RC 5.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 20,
  },
  {
    key: 'llf-vikram-1',
    project: 'lastlight-ferry',
    reviewer: 'vikramsahni',
    versionLabel: 'RC 3',
    headline: 'Steam Deck default mapping puts parry on the wrong shoulder',
    timeSpentMinutes: 63,
    environment: { device: 'Steam Deck OLED', build: 'RC 3' },
    daysAgo: 8,
    ratings: { fun: 4, balance: 3, game_feel: 3, onboarding: 4, performance: 4 },
    points: [
      {
        category: 'controls',
        body:
          'Parry defaults to the left trigger, which is also row-left on the Deck layout, so during a turn you have to release a direction to defend. Twenty minutes in I remapped it and the game got noticeably better. Most people will not remap.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        upvotes: 9,
      },
    ],
    replies: [
      {
        author: 'danyero',
        body:
          'Parry was on the left trigger because that is where it sits on my own controller, which is not a reason. The Deck default going into RC 4 puts it on the right bumper, clear of both rowing directions.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 8,
  },
  {
    key: 'llf-nkechi-1',
    project: 'lastlight-ferry',
    reviewer: 'nkechiobi',
    versionLabel: 'RC 3',
    headline: 'No remapping on the keyboard build, and the parry cue is audio only',
    timeSpentMinutes: 44,
    environment: { os: 'Windows 11', device: 'Desktop', build: 'RC 3', assistive: 'Keyboard only' },
    daysAgo: 16,
    ratings: { fun: 3, balance: 3, game_feel: 3, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'accessibility',
        body:
          'The keyboard build has no remapping at all, and parry is on a key I cannot comfortably reach while holding a direction. You ship remapping on the controller build, so the plumbing exists.',
        severity: 'blocker',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Options, keyboard controls',
        upvotes: 11,
      },
      {
        category: 'accessibility',
        body:
          'The parry cue is a sound with no visual equivalent. With sound off I could not parry at all. A two frame flash on the oar would cover it and would also help the players who say the timing feels cheap.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Crossing, parry',
        askIndex: 0,
        theme: 'parry-input-lag',
        upvotes: 14,
      },
    ],
    replies: [
      {
        author: 'danyero',
        body:
          'Keyboard remapping goes in before content lock. You are right that the plumbing exists; I was treating it as a controller feature. The flash on the oar is going in too, and it helps the people who find the timing cheap as much as it helps anybody playing with the sound off.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 15,
  },
  {
    key: 'llf-aleksy-1',
    project: 'lastlight-ferry',
    reviewer: 'aleksynowak',
    versionLabel: 'RC 3',
    headline: 'Load times on a hard drive are five times the quoted number',
    timeSpentMinutes: 51,
    environment: { os: 'Windows 10', device: 'Laptop, mechanical hard drive', build: 'RC 3' },
    daysAgo: 24,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 3, performance: 2 },
    points: [
      {
        category: 'performance',
        body:
          'The store page says under five seconds. On a spinning drive the first crossing takes fifty one seconds and every checkpoint reload takes about twenty. I timed six of them. If your minimum spec allows a hard drive then the number on the page is wrong.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'level',
        anchorValue: 'First crossing',
        upvotes: 10,
      },
    ],
    replies: [
      {
        author: 'danyero',
        body:
          'Five seconds is the number from my own machine, which has an SSD, and I never questioned it. The store page will give the hard drive figure as well, and the first crossing is being split so it streams in rather than loading in one piece.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 9,
  },
  {
    key: 'llf-petra-1',
    project: 'lastlight-ferry',
    reviewer: 'petranilsen',
    versionLabel: 'RC 3',
    headline: 'The writing on the manifest is better than the writing in the cutscenes',
    timeSpentMinutes: 72,
    environment: { os: 'macOS 15.1', device: 'iMac', build: 'RC 3' },
    daysAgo: 18,
    ratings: { fun: 4, balance: 4, game_feel: 4, onboarding: 4, performance: 4 },
    points: [
      {
        category: 'copy',
        body:
          'Every passenger has one line on the manifest and those lines are the best writing in the game. The cutscenes then explain what the lines already said. I would cut two of the three cutscenes and trust the manifest.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: 0,
        anchorKind: 'screen',
        anchorValue: 'Passenger manifest',
        upvotes: 8,
      },
      {
        category: 'delight',
        body: 'The manifest entry for the child with the dog is the reason I finished it. Keep every word of that.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        anchorKind: 'screen',
        anchorValue: 'Passenger manifest',
      },
    ],
    inboxState: 'read',
    votes: 7,
  },
  /* ----------------------------- Kiln & Kin ------------------------------ */
  {
    key: 'kk-mira-1',
    project: 'kiln-and-kin',
    reviewer: 'mirasolvang',
    versionLabel: 'Build 41',
    headline: 'We went quiet at eighteen minutes and it was the best part',
    summary:
      'Played with my partner on one keyboard and one controller, about fifty minutes. The silence you are looking for did arrive, at roughly eighteen minutes, on the third commission. What got us there was not the design of the forge. It was that the third commission has a deadline and the first two do not.',
    timeSpentMinutes: 52,
    environment: { os: 'Windows 11', device: 'Desktop, two players local', build: 'Build 41' },
    daysAgo: 7,
    ratings: { fun: 5, balance: 3, game_feel: 4, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'core_loop',
        body:
          'The silence arrived when the pressure did. Commissions one and two we narrated constantly because there was no cost to talking. On three there is a timer and we both shut up and just watched each other’s hands. If the silence is the thing you are designing for, the timer is the mechanism, not the bellows.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: 1,
        anchorKind: 'level',
        anchorValue: 'Commission 3',
        askIndex: 0,
        theme: 'silence-needs-pressure',
        upvotes: 16,
      },
      {
        category: 'confusion',
        body:
          'Removing the on-screen hints was right but it took us four minutes to work out that the bellows grip indicator was a grip indicator and not a heat gauge. We both thought it was heat. We were both wrong in the same way, which probably means the icon is the problem.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Forge, grip indicator',
        upvotes: 6,
      },
    ],
    replies: [
      {
        author: 'tayobalogun',
        body:
          'The timer read is the thing I needed and I did not want to hear it, because I have been trying to get the silence out of the tools rather than out of the pressure. Commission one gets a soft deadline in the next build so I can test your claim.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'actioned',
    votes: 14,
  },
  {
    key: 'kk-dan-1',
    project: 'kiln-and-kin',
    reviewer: 'danyero',
    versionLabel: 'Build 41',
    headline: 'Never went quiet. We argued for forty minutes and enjoyed it.',
    timeSpentMinutes: 43,
    environment: { os: 'Windows 11', device: 'Desktop, two players local', build: 'Build 41' },
    daysAgo: 12,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 2, performance: 4 },
    points: [
      {
        category: 'core_loop',
        body:
          'You asked for the minute we stopped talking. We never did. What we were still negotiating at minute forty was whose job the quench was, because the game never assigns roles and we kept both reaching for it. That might be the design, but it is the opposite of silence.',
        severity: 'major',
        actionability: 'observation',
        sentiment: 0,
        askIndex: 0,
        theme: 'silence-needs-pressure',
        upvotes: 11,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 9,
  },
  {
    key: 'kk-ingrid-1',
    project: 'kiln-and-kin',
    reviewer: 'ingridvos',
    versionLabel: 'Build 37',
    headline: 'This is a kitchen and I have worked a kitchen',
    summary:
      'Played with my flatmate. I have spent six years in restaurant kitchens and this is the closest thing I have played to a service. That is a compliment and also a warning about where the fun stops.',
    timeSpentMinutes: 38,
    environment: { os: 'macOS 15.2', device: 'MacBook Pro, two players local', build: 'Build 37' },
    daysAgo: 16,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'core_loop',
        body:
          'In a real kitchen the silence comes from knowing the other person’s next three moves, not from concentration. Right now your game makes us concentrate. It does not yet let us predict. The difference is whether the tools have a rhythm you can learn.',
        severity: 'major',
        actionability: 'suggestion',
        sentiment: 0,
        askIndex: 0,
        theme: 'silence-needs-pressure',
        upvotes: 14,
      },
      {
        category: 'delight',
        body: 'The moment the metal changes colour and you both reach at once is genuinely lovely. That is the game.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        anchorKind: 'screen',
        anchorValue: 'Forge, heating',
      },
    ],
    inboxState: 'triaged',
    votes: 12,
  },
  {
    key: 'kk-hugo-1',
    project: 'kiln-and-kin',
    reviewer: 'hugobitt',
    versionLabel: 'Build 37',
    headline: 'Could not get the second controller working',
    timeSpentMinutes: 11,
    environment: { os: 'macOS 14.6', device: 'MacBook Air M1', build: 'Build 37' },
    daysAgo: 20,
    ratings: { fun: 3, balance: 3, game_feel: 3, onboarding: 2, performance: 3 },
    points: [
      {
        category: 'bug',
        body: 'Second controller was never picked up, so we played one player on a two player game and gave up.',
        severity: 'blocker',
        actionability: 'repro',
        sentiment: -1,
        repro: {
          steps: '1. Connect two identical controllers over Bluetooth before launching. 2. Start Build 41. 3. Press start on both.',
          result: 'Only the first controller registers. The second shows as connected in system settings but nothing happens in game.',
          expected: 'Both register and the second player joins. The itch page says two controllers are supported.',
          frequency: 'always',
        },
        upvotes: 5,
      },
    ],
    replies: [
      {
        author: 'tayobalogun',
        body:
          'Two identical controllers on macOS is a known hole and it is my fault for not saying so on the build page. Fixed in 42. Sorry you lost the evening to it.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 4,
  },
  {
    key: 'kk-joonho-1',
    project: 'kiln-and-kin',
    reviewer: 'joonhobaek',
    versionLabel: 'Build 37',
    headline: 'The grip icon is a thermometer to anybody who has seen a thermometer',
    timeSpentMinutes: 26,
    environment: { os: 'macOS 15.2', device: 'Desktop, two players local', build: 'Build 37' },
    daysAgo: 22,
    ratings: { fun: 4, balance: 3, game_feel: 4, onboarding: 2, performance: 4 },
    points: [
      {
        category: 'hud',
        body:
          'A vertical bar that fills from the bottom, in orange, next to a forge, is a thermometer. It does not matter what you intended. Both of us read it as heat within a second and neither of us reconsidered for ten minutes.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Forge, grip indicator',
        upvotes: 9,
      },
    ],
    inboxState: 'triaged',
    votes: 8,
  },

  /* ------------------------- Paperweight Circuit ------------------------- */
  {
    key: 'pc-lena-1',
    project: 'paperweight-circuit',
    reviewer: 'lenahavel',
    versionLabel: 'Paper 11',
    headline: 'I read the rule and got it backwards',
    timeSpentMinutes: 17,
    environment: { os: 'Linux, Fedora 41', device: 'Desktop, browser', build: 'Paper 11' },
    daysAgo: 5,
    ratings: { fun: 4, balance: 3, game_feel: 3, onboarding: 2, performance: 4 },
    points: [
      {
        category: 'core_loop',
        body:
          'I read “wires push each other” and assumed the new wire gets pushed aside by existing ones, which is the opposite. The photo of board three did not correct me because in that photo both readings produce the same result. Board seven is the image that fixed it, because there the two readings diverge.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'displacement-direction',
        upvotes: 12,
      },
    ],
    replies: [
      {
        author: 'aleksynowak',
        body: 'Board seven becomes the first board. That is exactly the kind of answer I was hoping for and I would not have found it myself.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 11,
  },
  {
    key: 'pc-tayo-1',
    project: 'paperweight-circuit',
    reviewer: 'tayobalogun',
    versionLabel: 'Paper 11',
    headline: 'The rule reads. The verb does not.',
    timeSpentMinutes: 21,
    environment: { os: 'Windows 11', device: 'Desktop, browser', build: 'Paper 11' },
    daysAgo: 8,
    ratings: { fun: 4, balance: 4, game_feel: 3, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'core_loop',
        body:
          'I understood displacement immediately from the still image, so the rule survives being read. What did not survive is what I am doing: “lay a wire” sounds additive and the interesting part is subtractive. You are not connecting things, you are evicting them. I would find a verb that admits that.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: 0,
        askIndex: 0,
        theme: 'displacement-direction',
        upvotes: 9,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 8,
  },
  {
    key: 'pc-emmett-1',
    project: 'paperweight-circuit',
    reviewer: 'emmettquill',
    versionLabel: 'Paper 11',
    headline: 'Looks cool',
    summary: 'Nice concept. The paper thing is a neat idea. Would play it.',
    timeSpentMinutes: 3,
    environment: { os: 'Windows 10', device: 'Laptop, browser', build: 'Paper 11' },
    daysAgo: 11,
    ratings: { fun: 4, balance: 3, game_feel: 3, onboarding: 3, performance: 4 },
    points: [
      {
        category: 'core_loop',
        body: 'Seems like a cool idea, I would definitely try the full version.',
        severity: 'praise',
        actionability: 'opinion',
        sentiment: 1,
      },
    ],
    inboxState: 'new',
    votes: 0,
  },
  {
    key: 'pc-suvi-1',
    project: 'paperweight-circuit',
    reviewer: 'suvikallio',
    versionLabel: 'Paper 11',
    headline: 'As somebody who lays out boards for a living, this is a real problem',
    timeSpentMinutes: 24,
    environment: { os: 'Linux, Arch', device: 'Desktop, browser', build: 'Paper 11' },
    daysAgo: 14,
    ratings: { fun: 5, balance: 4, game_feel: 3, onboarding: 4, performance: 4 },
    points: [
      {
        category: 'core_loop',
        body:
          'Routing order mattering is the actual daily pain of board layout, and you have turned it into a puzzle without any of the vocabulary. I got it from the image with no explanation. The people who will not get it are the ones who have never routed anything, and that might be most of your audience.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: 1,
        askIndex: 0,
        upvotes: 7,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'read',
    votes: 6,
  },

  /* ------------------------------ Tallyroot ------------------------------ */
  {
    key: 'tr-tobi-1',
    project: 'tallyroot',
    reviewer: 'tobiadeyemi',
    versionLabel: 'v1.4.0',
    headline: 'I decided the currency before I created the client, and the product decided it after',
    summary:
      'Recorded session, twenty eight minutes from signup to a sent invoice in yen. The currency question is not a control placement problem. It is that you ask for the currency at a point where I have already stopped thinking about it.',
    timeSpentMinutes: 28,
    environment: { os: 'macOS 15.2', device: 'MacBook Pro', browser: 'Safari 18', build: 'v1.4.0' },
    daysAgo: 3,
    ratings: { job_fit: 4, time_to_value: 3, flow_friction: 3, trust_clarity: 3, reliability: 4 },
    points: [
      {
        category: 'core_task',
        body:
          'At 4:10 in my recording I typed the client name and, in my head, I had already decided this was a Japanese client billed in yen. That decision arrived with the name. The currency field appears three screens later, next to the rate card, by which point I am thinking about words per hour and I picked the default without reading it.\n\nPutting currency on the client record was the right move. Putting it next to the client name would finish the job.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'route',
        anchorValue: '/clients/new',
        askIndex: 0,
        theme: 'currency-decided-early',
        upvotes: 18,
      },
      {
        category: 'empty_state',
        body:
          'The rate card empty state has a worked example now and it is good. I read it, understood it, and filled the card in about ninety seconds. That was the fastest part of the whole session.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        askIndex: 1,
        upvotes: 6,
      },
      {
        category: 'copy',
        body:
          'The send button says “Finish”. It sends an email to a client. I hesitated for about four seconds trying to work out whether it would send or save.',
        severity: 'minor',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'route',
        anchorValue: '/invoices/new',
        upvotes: 9,
      },
    ],
    replies: [
      {
        author: 'priyaram',
        body:
          'The moment-of-decision framing is the thing I have been missing for two years. I moved the control and the problem got smaller but did not go away, and now I know why. Currency moves next to the client name this week.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 24,
  },
  {
    key: 'tr-fenella-1',
    project: 'tallyroot',
    reviewer: 'fenelladoyle',
    versionLabel: 'v1.3.2',
    headline: 'Eleven strings, marked up',
    summary:
      'A copy pass from signup to sent. Format is yours, mine, what changed. I have not commented on anything visual.',
    timeSpentMinutes: 41,
    environment: { os: 'macOS 15.2', device: 'MacBook Pro', browser: 'Firefox 132', build: 'v1.3.2' },
    daysAgo: 6,
    ratings: { job_fit: 4, time_to_value: 4, flow_friction: 3, trust_clarity: 3, reliability: 4 },
    points: [
      {
        category: 'copy',
        body:
          'Yours: “Finish”. Mine: “Send invoice”. What changed: the button now names the irreversible thing it does. “Finish” describes the form, not the consequence, and the consequence here is an email to somebody who pays you.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        upvotes: 13,
      },
      {
        category: 'copy',
        body:
          'Yours: “No clients yet. Add one to begin.” Mine: “No clients yet. A client holds the currency and the rate card, so add one before your first invoice.” What changed: the empty state now says why the thing matters, which is the only part a reader needs.',
        severity: 'minor',
        actionability: 'actionable',
        sentiment: 0,
        upvotes: 8,
      },
      {
        category: 'error_handling',
        body:
          'The validation message on the rate field reads “Invalid value.” That is three words that tell the reader nothing. It fires when you type a comma as a decimal separator, which every one of your European customers will do. Mine: “Use a full stop for decimals. 0.12 rather than 0,12.”',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'route',
        anchorValue: '/clients/:id/rates',
        theme: 'decimal-comma',
        upvotes: 17,
      },
    ],
    replies: [
      {
        author: 'priyaram',
        body:
          'The comma one is worse than a copy problem, it is a data problem: we were silently rejecting the value and leaving the old rate in place. Both the message and the parsing are fixed.',
        daysAfter: 2,
        pointIndex: 2,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 19,
  },
  {
    key: 'tr-greta-1',
    project: 'tallyroot',
    reviewer: 'gretalind',
    versionLabel: 'v1.3.2',
    headline: 'The comma bug eats your rate and does not tell you',
    timeSpentMinutes: 37,
    environment: { os: 'Windows 11', device: 'Desktop', browser: 'Chrome 131', build: 'v1.3.2' },
    daysAgo: 9,
    ratings: { job_fit: 4, time_to_value: 3, flow_friction: 2, trust_clarity: 2, reliability: 3 },
    points: [
      {
        category: 'bug',
        body: 'Entering a rate with a comma decimal separator silently discards the edit and keeps the previous rate.',
        severity: 'blocker',
        actionability: 'repro',
        sentiment: -1,
        anchorKind: 'route',
        anchorValue: '/clients/:id/rates',
        repro: {
          steps: '1. Open a client rate card with an existing rate of 0.10. 2. Change it to 0,12 using a comma. 3. Save.',
          result: 'The form closes, a success toast appears, and the rate is still 0.10. No error anywhere.',
          expected:
            'Either the comma is parsed as a decimal separator, or the save fails loudly. A success toast over a discarded edit is the worst of the three options.',
          frequency: 'always',
        },
        theme: 'decimal-comma',
        upvotes: 21,
      },
      {
        category: 'forms',
        body:
          'The invoice line editor loses the cursor position after every keystroke in the quantity field once the number is over four digits. Reproduced on Chrome and Firefox, not on Safari.',
        severity: 'major',
        actionability: 'repro',
        sentiment: -1,
        repro: {
          steps: '1. Add an invoice line. 2. Type 12000 into the quantity field, one digit at a time.',
          result: 'After the fourth digit the cursor jumps to the start of the field, so you end up with 0 1 2 0 0 in the wrong order.',
          expected: 'The cursor stays where I put it. This is the formatting running on every keystroke.',
          frequency: 'always',
        },
        upvotes: 12,
      },
    ],
    replies: [
      {
        author: 'priyaram',
        body:
          'The comma one is a data bug and the worst kind, because the old rate stays and looks correct. The parsing is being fixed and it will fail loudly when a rate cannot be read. The cursor jump in the quantity field reproduces for me on Chrome; looking at it next.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 20,
  },
  {
    key: 'tr-lena-1',
    project: 'tallyroot',
    reviewer: 'lenahavel',
    versionLabel: 'v1.3.2',
    headline: 'Wrong currency, and I knew it was wrong while I was doing it',
    timeSpentMinutes: 19,
    environment: { os: 'Linux, Fedora 41', device: 'Desktop', browser: 'Firefox 132', build: 'v1.3.2' },
    daysAgo: 12,
    ratings: { job_fit: 4, time_to_value: 4, flow_friction: 3, trust_clarity: 3, reliability: 4 },
    points: [
      {
        category: 'core_task',
        body:
          'I sent the practice invoice in euro when I meant yen, and the thing is I saw the euro symbol on the preview and my brain read it as a default. Currency symbols in previews look like filler. Maybe show the currency name in words once, on the preview, before the send.',
        severity: 'major',
        actionability: 'suggestion',
        sentiment: -1,
        askIndex: 0,
        theme: 'currency-decided-early',
        upvotes: 11,
      },
    ],
    replies: [
      {
        author: 'priyaram',
        body:
          'A currency symbol reading as filler is exactly what the preview has to fix. The preview will name the currency in words above the total, once, before you send.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 9,
  },
  {
    key: 'tr-omar-1',
    project: 'tallyroot',
    reviewer: 'omarhaddad',
    versionLabel: 'v1.3.2',
    headline: 'Signup to sent invoice in eleven minutes, one wrong turn',
    timeSpentMinutes: 23,
    environment: { os: 'Windows 10', device: 'Laptop', browser: 'Chrome 131', build: 'v1.3.2' },
    daysAgo: 14,
    ratings: { job_fit: 4, time_to_value: 4, flow_friction: 4, trust_clarity: 3, reliability: 4 },
    points: [
      {
        category: 'core_task',
        body:
          'Eleven minutes including reading. The wrong turn was that I looked for currency on the invoice, found nothing, went back to settings, found a company currency, and set that instead. So I had it in two places and neither was the one you meant.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        askIndex: 0,
        theme: 'currency-decided-early',
        upvotes: 10,
      },
    ],
    replies: [
      {
        author: 'priyaram',
        body:
          'Two places and neither of them the right one is the most exact description of this I have had. The company currency in settings is only a default for new clients, and nothing on the screen says so. Currency is moving onto the client, where the decision is actually made.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 7,
  },
  {
    key: 'tr-nkechi-1',
    project: 'tallyroot',
    reviewer: 'nkechiobi',
    versionLabel: 'v1.3.2',
    headline: 'The rate table is not reachable with a keyboard',
    timeSpentMinutes: 46,
    environment: { os: 'Windows 11', device: 'Desktop', browser: 'Chrome 131', build: 'v1.3.2', assistive: 'NVDA 2024.4' },
    daysAgo: 17,
    ratings: { job_fit: 3, time_to_value: 3, flow_friction: 2, trust_clarity: 3, reliability: 4 },
    points: [
      {
        category: 'accessibility',
        body:
          'The rate card rows use a click handler on a div, so nothing in the table is focusable and NVDA announces the whole thing as one block of text. Nobody using a keyboard can edit a rate, which means nobody using a keyboard can use the product, because the rate card is the product.\n\nThis is a small fix. Rows become buttons, or the edit control becomes a real input. An afternoon at most.',
        severity: 'blocker',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'selector',
        anchorValue: '.rate-row',
        upvotes: 22,
      },
      {
        category: 'accessibility',
        body:
          'The invoice total updates with no announcement. For a sighted user the number changes in place, which is fine. With a screen reader I had no idea anything had happened until I navigated back up. A polite live region on the total would cover it.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        upvotes: 13,
      },
    ],
    replies: [
      {
        author: 'priyaram',
        body:
          'The rate row is a div with an onClick and it has been since the first week. I did not know that made it unreachable, which is exactly the kind of thing I need told to me. It is a real table with real buttons now, and the live region shipped with it.',
        daysAfter: 3,
        pointIndex: 0,
      },
      {
        author: 'nkechiobi',
        body:
          'I checked the new build. Rows are reachable and the total announces. The one thing left is that the delete button in each row has no accessible name, it reads as “button”.',
        daysAfter: 6,
        parent: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 26,
  },
  {
    key: 'tr-ingrid-1',
    project: 'tallyroot',
    reviewer: 'ingridvos',
    versionLabel: 'v1.3.2',
    headline: 'I have run invoices for a restaurant and this is missing the resend',
    timeSpentMinutes: 21,
    environment: { os: 'macOS 15.2', device: 'MacBook Pro', browser: 'Safari 18', build: 'v1.3.2' },
    daysAgo: 34,
    ratings: { job_fit: 3, time_to_value: 4, flow_friction: 3, trust_clarity: 3, reliability: 4 },
    points: [
      {
        category: 'missing',
        body:
          'There is no resend. Half of invoicing is sending the same invoice again in three weeks with a politely worded note. I looked in three places for it and then assumed I was missing something.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'route',
        anchorValue: '/invoices/:id',
        theme: 'resend-missing',
        upvotes: 15,
      },
    ],
    replies: [
      {
        author: 'priyaram',
        body:
          'No resend is a gap I stopped seeing because I resend from my own mail client. Two of my customers do the same and neither had told me. It is going on the roadmap with room for the note.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 12,
  },
  {
    key: 'tr-sofia-1',
    project: 'tallyroot',
    reviewer: 'sofiabrandao',
    versionLabel: 'v1.3.2',
    headline: 'Second invoice to the same client took forty seconds and that is the whole pitch',
    timeSpentMinutes: 16,
    environment: { os: 'Windows 11', device: 'Laptop', browser: 'Edge 131', build: 'v1.3.2' },
    daysAgo: 19,
    ratings: { job_fit: 5, time_to_value: 5, flow_friction: 4, trust_clarity: 4, reliability: 4 },
    points: [
      {
        category: 'core_task',
        body:
          'First invoice took nine minutes because I was learning. The second one to the same client took forty seconds. That contrast is the thing your homepage should be about, and it currently is not.',
        severity: 'praise',
        actionability: 'suggestion',
        sentiment: 1,
        anchorKind: 'route',
        anchorValue: '/invoices/new',
        upvotes: 11,
      },
    ],
    inboxState: 'read',
    votes: 9,
  },
  {
    key: 'tr-hugo-1',
    project: 'tallyroot',
    reviewer: 'hugobitt',
    versionLabel: 'v1.3.2',
    headline: 'Clean and easy to use',
    summary: 'Signed up and made an invoice, no problems. Looks good on mobile too.',
    timeSpentMinutes: 6,
    environment: { os: 'iOS 18.2', device: 'iPhone 14', browser: 'Safari', build: 'v1.3.2' },
    daysAgo: 24,
    ratings: { job_fit: 4, time_to_value: 5, flow_friction: 4, trust_clarity: 4, reliability: 5 },
    points: [
      {
        category: 'signup',
        body: 'Signup was quick and the interface is clean. No complaints from me.',
        severity: 'praise',
        actionability: 'opinion',
        sentiment: 1,
      },
    ],
    inboxState: 'read',
    votes: 1,
  },
  {
    key: 'tr-beatrice-1',
    project: 'tallyroot',
    reviewer: 'beatricer',
    versionLabel: 'v1.3.2',
    headline: 'The invoice a client receives looks like a different product',
    timeSpentMinutes: 27,
    environment: { os: 'macOS 15.2', device: 'MacBook Pro', browser: 'Safari 18', build: 'v1.3.2' },
    daysAgo: 21,
    ratings: { job_fit: 4, time_to_value: 4, flow_friction: 4, trust_clarity: 2, reliability: 4 },
    points: [
      {
        category: 'core_task',
        body:
          'The app is careful and quiet and the PDF it produces is a different personality entirely: heavy rules, centred header, two typefaces that are not yours. Your customers are freelancers whose invoice is the only document their client ever sees. That PDF is the product for them.',
        severity: 'major',
        actionability: 'suggestion',
        sentiment: -1,
        anchorKind: 'route',
        anchorValue: '/invoices/:id/pdf',
        upvotes: 14,
      },
    ],
    replies: [
      {
        author: 'priyaram',
        body:
          'The PDF template is two years older than the app and I have been treating it as plumbing. You are right that it is the only part of Tallyroot most of my customers’ clients ever see. It is on the roadmap now.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 11,
  },
  {
    key: 'tr-petra-1',
    project: 'tallyroot',
    reviewer: 'petranilsen',
    versionLabel: 'v1.3.2',
    headline: 'A translator would want the source language pair on the line, not in the description',
    timeSpentMinutes: 18,
    environment: { os: 'macOS 15.1', device: 'iMac', browser: 'Safari 18', build: 'v1.3.2' },
    daysAgo: 26,
    ratings: { job_fit: 4, time_to_value: 4, flow_friction: 4, trust_clarity: 4, reliability: 4 },
    points: [
      {
        category: 'core_task',
        body:
          'I do occasional Swedish to English work. The line item asks for a description and I typed the pair into it, because there is nowhere else. Then the rate card matched nothing and I had to set the rate by hand. The pair is structured data and you already store it once.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'route',
        anchorValue: '/invoices/new',
        upvotes: 12,
      },
    ],
    replies: [
      {
        author: 'priyaram',
        body:
          'The pair is already stored on the rate card, so the line should take it from there rather than asking you to type it into the description. That is also why the rate matched nothing: the lookup never reads the description. Fixing both together.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 10,
  },
  {
    key: 'tr-vikram-1',
    project: 'tallyroot',
    reviewer: 'vikramsahni',
    versionLabel: 'v1.3.2',
    headline: 'On a phone the rate card scrolls sideways and I lost the column headers',
    timeSpentMinutes: 14,
    environment: { os: 'Android 15', device: 'Pixel 8', browser: 'Chrome', build: 'v1.3.2' },
    daysAgo: 29,
    ratings: { job_fit: 4, time_to_value: 4, flow_friction: 2, trust_clarity: 3, reliability: 4 },
    points: [
      {
        category: 'core_task',
        body:
          'The rate table is six columns wide on a 412 px screen. It scrolls sideways, the headers scroll with it, and by the third column I could not tell which number I was editing. On a phone I would show one pair per card instead.',
        severity: 'major',
        actionability: 'suggestion',
        sentiment: -1,
        anchorKind: 'route',
        anchorValue: '/clients/:id/rates',
        askIndex: 1,
        upvotes: 10,
      },
    ],
    replies: [
      {
        author: 'priyaram',
        body:
          'Six columns on a phone was never going to work and I knew it. I was hoping nobody would edit rates on a bus. One pair per card on small screens is written up now.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 8,
  },
  {
    key: 'tr-tayo-1',
    project: 'tallyroot',
    reviewer: 'tayobalogun',
    versionLabel: 'v1.4.0',
    headline: 'Signed up as a hobbyist translator and stalled on the rate card',
    summary:
      'I translate the occasional Yoruba subtitle track for friends, which makes me the smallest customer you will ever have. Signup was quick. I stalled on the rate card because I have one pair and one rate and the screen is built for somebody with twelve.',
    timeSpentMinutes: 17,
    environment: { os: 'Windows 11', device: 'Desktop', browser: 'Chrome 131', build: 'v1.4.0' },
    daysAgo: 2,
    ratings: { job_fit: 3, time_to_value: 3, flow_friction: 3, trust_clarity: 4, reliability: 4 },
    points: [
      {
        category: 'empty_state',
        body:
          'The empty rate card asks for a pair, a rate, a document type and a minimum, and I only have two of those. I filled in what I had, left two blank, and then could not tell whether the card was saved or waiting for me.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'route',
        anchorValue: '/clients/:id/rates',
        askIndex: 1,
        upvotes: 6,
      },
    ],
    inboxState: 'new',
    votes: 4,
  },

  /* ------------------------------ Stagehand ------------------------------ */
  {
    key: 'sh-tobi-1',
    project: 'stagehand',
    reviewer: 'tobiadeyemi',
    versionLabel: 'v0.9.6',
    headline: 'Ninety four seconds, and the hesitation was the share dialog',
    summary:
      'Timed run, recorded. Paste to shared link in ninety four seconds, so you are four seconds over your own target and the four seconds are all in one place.',
    timeSpentMinutes: 24,
    environment: { os: 'macOS 15.2', device: 'MacBook Pro', browser: 'Chrome 131', build: 'v0.9.6' },
    daysAgo: 4,
    ratings: { job_fit: 5, time_to_value: 4, flow_friction: 4, trust_clarity: 3, reliability: 4 },
    points: [
      {
        category: 'core_task',
        body:
          'Paste took six seconds, annotation took thirty one, and the share dialog took fifty seven. I stopped moving the mouse at 1:02 because the dialog offers four options and three of them mention permissions I had not thought about yet. I was looking for the word “link”.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '1:02',
        timecodeMs: 62000,
        askIndex: 0,
        theme: 'share-dialog-choices',
        upvotes: 13,
      },
      {
        category: 'delight',
        body:
          'Annotations surviving a data update is the entire reason to use this and you demonstrate it in the first thirty seconds without a word of explanation. That is very good product design.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        upvotes: 8,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 15,
  },
  {
    key: 'sh-nkechi-1',
    project: 'stagehand',
    reviewer: 'nkechiobi',
    versionLabel: 'v0.9.6',
    headline: 'Keyboard path exists, and then stops at the marker',
    timeSpentMinutes: 38,
    environment: { os: 'Windows 11', device: 'Desktop', browser: 'Firefox 132', build: 'v0.9.6', assistive: 'NVDA 2024.4' },
    daysAgo: 7,
    ratings: { job_fit: 4, time_to_value: 3, flow_friction: 3, trust_clarity: 4, reliability: 4 },
    points: [
      {
        category: 'accessibility',
        body:
          'You added a keyboard path for placing a marker, which most tools of this kind never do, so thank you. It stops one step short: once the marker is placed there is no way to reach its text field without a mouse. Tab skips it entirely because the field is rendered inside a canvas overlay.',
        severity: 'blocker',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'selector',
        anchorValue: '.marker-overlay input',
        upvotes: 14,
      },
      {
        category: 'accessibility',
        body:
          'The share dialog returns focus to the body rather than the trigger when it closes. Small, but it means every share sends a keyboard user back to the top of the page.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        theme: 'share-dialog-choices',
        upvotes: 9,
      },
    ],
    replies: [
      {
        author: 'lenahavel',
        body: 'Both fixed in my branch. The overlay input is now a real input outside the canvas, which also fixed a zoom bug I did not know I had.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 16,
  },
  {
    key: 'sh-priya-1',
    project: 'stagehand',
    reviewer: 'priyaram',
    versionLabel: 'v0.9.6',
    headline: 'Would pay for this today, and the share dialog nearly stopped me',
    timeSpentMinutes: 17,
    environment: { os: 'macOS 15.1', device: 'MacBook Air', browser: 'Safari 18', build: 'v0.9.6' },
    daysAgo: 10,
    ratings: { job_fit: 5, time_to_value: 4, flow_friction: 3, trust_clarity: 3, reliability: 5 },
    points: [
      {
        category: 'core_task',
        body:
          'Four share options and I could not tell which one my colleague would be able to open without an account. I picked the second and guessed. The default should be the one that always works.',
        severity: 'major',
        actionability: 'suggestion',
        sentiment: -1,
        askIndex: 1,
        theme: 'share-dialog-choices',
        upvotes: 10,
      },
    ],
    replies: [
      {
        author: 'lenahavel',
        body:
          'The one that always works is the read-only link, and it has been the default since v0.9.6. If you still had to guess, the default is not saying what it is. It will say who can open it.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 9,
  },
  {
    key: 'sh-joonho-1',
    project: 'stagehand',
    reviewer: 'joonhobaek',
    versionLabel: 'v0.9.3',
    headline: 'Annotation text overflows on a long sentence and clips rather than wraps',
    timeSpentMinutes: 22,
    environment: { os: 'macOS 15.2', device: 'Studio Display', browser: 'Chrome 131', build: 'v0.9.3' },
    daysAgo: 13,
    ratings: { job_fit: 4, time_to_value: 4, flow_friction: 3, trust_clarity: 4, reliability: 4 },
    points: [
      {
        category: 'bug',
        body: 'Annotation labels longer than about sixty characters are clipped with no indication that text is missing.',
        severity: 'major',
        actionability: 'repro',
        sentiment: -1,
        repro: {
          steps: '1. Place a marker. 2. Type a ninety character sentence. 3. Click away.',
          result: 'The label shows the first sixty characters or so and simply ends. No ellipsis, no tooltip, no wrap.',
          expected:
            'It wraps, or truncates visibly and shows the rest on hover and focus. Real annotations are sentences, not labels.',
          frequency: 'always',
        },
        upvotes: 11,
      },
    ],
    replies: [
      {
        author: 'lenahavel',
        body:
          'Clipping with no sign that anything is missing is a bug, not a style. Labels wrap to three lines, and anything longer says it is cut and shows the full text on focus.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 9,
  },
  {
    key: 'sh-omar-1',
    project: 'stagehand',
    reviewer: 'omarhaddad',
    versionLabel: 'v0.9.3',
    headline: 'Pasted a screenshot rather than a chart and it quietly did nothing',
    timeSpentMinutes: 12,
    environment: { os: 'Windows 10', device: 'Laptop', browser: 'Chrome 131', build: 'v0.9.3' },
    daysAgo: 16,
    ratings: { job_fit: 3, time_to_value: 2, flow_friction: 2, trust_clarity: 2, reliability: 4 },
    points: [
      {
        category: 'error_handling',
        body:
          'I pasted a screenshot of a chart, because that is what I have. Nothing happened at all. No message, no spinner, no error. I assumed the paste had failed and tried three more times before I read the docs and learned it wants the data.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'New chart, paste step',
        askIndex: 0,
        upvotes: 12,
      },
    ],
    replies: [
      {
        author: 'lenahavel',
        body:
          'A screenshot is what most people will paste first, and doing nothing in reply is the worst possible answer. The paste step will say that it needs the chart’s data, and how to copy it out of the tools people paste from most.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 10,
  },
  {
    key: 'sh-fenella-1',
    project: 'stagehand',
    reviewer: 'fenelladoyle',
    versionLabel: 'v0.9.3',
    headline: 'Four share options, four nouns, no verbs',
    timeSpentMinutes: 15,
    environment: { os: 'macOS 15.2', device: 'MacBook Pro', browser: 'Firefox 132', build: 'v0.9.3' },
    daysAgo: 19,
    ratings: { job_fit: 4, time_to_value: 4, flow_friction: 3, trust_clarity: 3, reliability: 4 },
    points: [
      {
        category: 'copy',
        body:
          'Yours: “Public link”, “Workspace link”, “Embed”, “Export”. Mine: “Anyone with the link can view”, “Only people in your workspace”, “Paste into a page”, “Download a file”. What changed: each option now says what happens to the reader rather than naming a category.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Share dialog',
        askIndex: 1,
        theme: 'share-dialog-choices',
        upvotes: 15,
      },
    ],
    replies: [
      {
        author: 'lenahavel',
        body:
          'Your four labels are going in word for word. I named the options after the permission model because that is how I think about them, which is exactly the problem.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'actioned',
    votes: 13,
  },
  {
    key: 'sh-emmett-1',
    project: 'stagehand',
    reviewer: 'emmettquill',
    versionLabel: 'v0.9.3',
    headline: 'Works well',
    summary: 'Tried it out and it worked. Would use again.',
    timeSpentMinutes: 4,
    environment: { os: 'Windows 10', device: 'Laptop', browser: 'Chrome 131', build: 'v0.9.3' },
    daysAgo: 22,
    ratings: { job_fit: 4, time_to_value: 4, flow_friction: 4, trust_clarity: 4, reliability: 4 },
    points: [
      {
        category: 'core_task',
        body: 'It did what it said it would do. No issues.',
        severity: 'praise',
        actionability: 'opinion',
        sentiment: 1,
      },
    ],
    inboxState: 'read',
    votes: 0,
  },

  /* ------------------------------ Coldframe ------------------------------ */
  {
    key: 'cf-ingrid-1',
    project: 'coldframe',
    reviewer: 'ingridvos',
    versionLabel: 'Wireframe 3',
    headline: 'The list is the plan. The calendar is the consequence.',
    summary:
      'I design services for a living and I spent twenty minutes with all three wireframes. The reason everybody reads your calendar as chores is that a calendar answers “when”, and the decision you are supporting answers “whether”.',
    timeSpentMinutes: 21,
    environment: { device: 'Desktop', browser: 'Firefox 132', build: 'Wireframe 3' },
    daysAgo: 3,
    ratings: { job_fit: 3, time_to_value: 3, flow_friction: 3, trust_clarity: 4, reliability: 4 },
    points: [
      {
        category: 'navigation',
        body:
          'In March a grower is choosing between crops, not scheduling a day. A calendar cannot show a choice between two things that occupy the same square. The third wireframe, the season on one line, is the only one that can, and it is the one you have buried.\n\nI would keep the calendar and demote it to the view you open once a plan exists.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: 0,
        askIndex: 0,
        theme: 'calendar-wrong-shape',
        upvotes: 16,
      },
    ],
    replies: [
      {
        author: 'omarhaddad',
        body:
          'That is the clearest statement of my own problem I have read, including the ones I wrote. The season line goes first and the calendar becomes a detail view.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 14,
  },
  {
    key: 'cf-suvi-1',
    project: 'coldframe',
    reviewer: 'suvikallio',
    versionLabel: 'Wireframe 3',
    headline: 'My aunt grows under plastic and would not open a calendar in March',
    timeSpentMinutes: 14,
    environment: { device: 'Phone', browser: 'Safari', build: 'Wireframe 3' },
    daysAgo: 6,
    ratings: { job_fit: 3, time_to_value: 3, flow_friction: 3, trust_clarity: 3, reliability: 4 },
    points: [
      {
        category: 'navigation',
        body:
          'She plans in the kitchen with a pencil and a seed catalogue, in January, for the whole year at once. A screen showing one month is the wrong size of decision. This is a second vote for the season on one line.',
        severity: 'major',
        actionability: 'observation',
        sentiment: 0,
        askIndex: 0,
        theme: 'calendar-wrong-shape',
        upvotes: 9,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 7,
  },
  {
    key: 'cf-sofia-1',
    project: 'coldframe',
    reviewer: 'sofiabrandao',
    versionLabel: 'Wireframe 2',
    headline: 'The data is more convincing than the wireframes',
    timeSpentMinutes: 18,
    environment: { device: 'Laptop', browser: 'Chrome 131', build: 'Wireframe 2' },
    daysAgo: 9,
    ratings: { job_fit: 4, time_to_value: 3, flow_friction: 3, trust_clarity: 5, reliability: 4 },
    points: [
      {
        category: 'navigation',
        body:
          'Two seasons of real harvest numbers from two farms is the most persuasive thing on this page, and it is at the bottom under the wireframes. If you are showing this to a grower, lead with their neighbour’s numbers.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: 1,
        anchorKind: 'route',
        anchorValue: '/wireframes',
        upvotes: 8,
      },
    ],
    inboxState: 'triaged',
    votes: 6,
  },
  {
    key: 'cf-emmett-1',
    project: 'coldframe',
    reviewer: 'emmettquill',
    versionLabel: 'Wireframe 2',
    headline: 'Calendar seems fine to me',
    timeSpentMinutes: 5,
    environment: { device: 'Laptop', browser: 'Chrome 131', build: 'Wireframe 2' },
    daysAgo: 11,
    ratings: { job_fit: 3, time_to_value: 3, flow_friction: 3, trust_clarity: 3, reliability: 3 },
    points: [
      {
        category: 'navigation',
        body: 'I think the calendar works. Most apps use a calendar for this kind of thing.',
        severity: 'nit',
        actionability: 'opinion',
        sentiment: 0,
        askIndex: 0,
      },
    ],
    inboxState: 'read',
    votes: 0,
  },

  /* ------------------------------ Ferryman ------------------------------- */
  {
    key: 'fm-tobi-1',
    project: 'ferryman',
    reviewer: 'tobiadeyemi',
    versionLabel: '3.0.2',
    headline: 'New user found it in four seconds. I had to tell my colleague where it went.',
    summary:
      'I ran this with two people: my partner, who has never used Ferryman, and a colleague who has used it daily for a year. The results were opposite, which I think is the honest answer to your question.',
    timeSpentMinutes: 33,
    environment: { os: 'iOS 18.2', device: 'iPhone 15', build: '3.0.2' },
    daysAgo: 5,
    ratings: { first_session: 5, thumb_ergonomics: 5, platform_fit: 4, flow_friction: 4, battery: 4 },
    points: [
      {
        category: 'nav_structure',
        body:
          'The new user reached for the bottom of the screen immediately and found the sheet in about four seconds without being prompted. That is as good as this gets.\n\nThe existing user spent twenty two seconds looking at the top of the screen, then asked me where it was. He was not confused by the sheet once he found it; he was confused because the thing he does without thinking stopped working. That cost is real and it is temporary, and you should probably eat it. One-time coach marks would shorten it.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: 0,
        anchorKind: 'screen',
        anchorValue: 'Line picker sheet',
        askIndex: 0,
        theme: 'bottom-sheet-relearn',
        upvotes: 22,
      },
      {
        category: 'delight',
        body:
          'The offline banner naming the last update time is the best change in the release. My partner read it, understood it, and trusted the numbers less, which is correct behaviour.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        anchorKind: 'screen',
        anchorValue: 'Offline banner',
        askIndex: 1,
        upvotes: 9,
      },
    ],
    replies: [
      {
        author: 'vikramsahni',
        body:
          'Two opposite answers is exactly what I was afraid of and exactly what I needed. A one-time card for existing users ships in 3.0.3.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'actioned',
    votes: 24,
  },
  {
    key: 'fm-greta-1',
    project: 'ferryman',
    reviewer: 'gretalind',
    versionLabel: '3.0.2',
    headline: 'Sheet does not survive a rotation mid-journey',
    timeSpentMinutes: 42,
    environment: { os: 'Android 15', device: 'Pixel 8', build: '3.0.2' },
    daysAgo: 8,
    ratings: { first_session: 4, thumb_ergonomics: 4, platform_fit: 3, flow_friction: 3, battery: 4 },
    points: [
      {
        category: 'bug',
        body: 'Rotating the device while the line picker sheet is open loses the selection and closes the sheet.',
        severity: 'major',
        actionability: 'repro',
        sentiment: -1,
        repro: {
          steps: '1. Start a journey on a saved line. 2. Open the line picker sheet. 3. Rotate to landscape.',
          result: 'The sheet closes and the app returns to the previously active line. The journey timer resets to the old line.',
          expected: 'The sheet stays open with my selection intact. Every other sheet in the app survives rotation.',
          frequency: 'always',
        },
        upvotes: 12,
      },
      {
        category: 'offline',
        body:
          'Airplane mode test, six minutes. The banner appeared within two seconds and named the last update. One number on the screen, the platform number, kept updating while offline, which made me trust the banner less.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 1,
        theme: 'offline-honesty',
        upvotes: 14,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 17,
  },
  {
    key: 'fm-nkechi-1',
    project: 'ferryman',
    reviewer: 'nkechiobi',
    versionLabel: '3.0.2',
    headline: 'VoiceOver reaches the sheet, and then the sheet reaches back',
    timeSpentMinutes: 47,
    environment: { os: 'iOS 18.2', device: 'iPhone 13', build: '3.0.2', assistive: 'VoiceOver' },
    daysAgo: 12,
    ratings: { first_session: 4, thumb_ergonomics: 4, platform_fit: 4, flow_friction: 3, battery: 4 },
    points: [
      {
        category: 'accessibility',
        body:
          'The sheet itself is well built: it is announced, it traps focus correctly, and the dismiss gesture works. The problem is that content behind it is still reachable by swiping past the last element, so a VoiceOver user can walk out of the sheet into a map they cannot see and then cannot get back without closing the app.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Line picker sheet',
        upvotes: 15,
      },
      {
        category: 'accessibility',
        body:
          'At the largest Dynamic Type size the line name truncates to two characters. Every line in the city becomes a pair of letters, which is not a name, it is a code.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Line list, largest text size',
        upvotes: 11,
      },
    ],
    replies: [
      {
        author: 'vikramsahni',
        body:
          'Swiping out of the sheet into the map is a bug in how I hide the content behind it, and it is the kind I would never find myself. Fixing it for 3.0.3, together with line names that wrap instead of truncating at the largest sizes.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 16,
  },
  {
    key: 'fm-emmett-1',
    project: 'ferryman',
    reviewer: 'emmettquill',
    versionLabel: '3.0.2',
    headline: 'Prefer the old version honestly',
    summary: 'The new bottom thing is annoying. The old one was easier. Not sure why it changed.',
    timeSpentMinutes: 8,
    environment: { os: 'iOS 18.1', device: 'iPhone 12', build: '3.0.2' },
    daysAgo: 14,
    ratings: { first_session: 3, thumb_ergonomics: 3, platform_fit: 3, flow_friction: 2, battery: 4 },
    points: [
      {
        category: 'nav_structure',
        body: 'The old line picker was better. I keep reaching for the top of the screen.',
        severity: 'minor',
        actionability: 'opinion',
        sentiment: -1,
        askIndex: 0,
        theme: 'bottom-sheet-relearn',
        upvotes: 3,
      },
    ],
    replies: [
      {
        author: 'vikramsahni',
        body:
          'That is useful even in this form, and you are the fourth long-time user to say it. Can you tell me whether you found it on your own or whether somebody told you where it was?',
        daysAfter: 2,
        pointIndex: 0,
      },
      {
        author: 'emmettquill',
        body: 'Found it myself but it took a while. Maybe a minute of hunting on the first day.',
        daysAfter: 3,
        parent: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 3,
  },
  {
    key: 'fm-ingrid-1',
    project: 'ferryman',
    reviewer: 'ingridvos',
    versionLabel: '3.0.0',
    headline: 'Reached it one handed on a tram with a bag on my shoulder, which is the test',
    timeSpentMinutes: 26,
    environment: { os: 'Android 15', device: 'Samsung Galaxy S23', build: '3.0.0' },
    daysAgo: 17,
    ratings: { first_session: 5, thumb_ergonomics: 5, platform_fit: 4, flow_friction: 4, battery: 4 },
    points: [
      {
        category: 'gestures',
        body:
          'Bottom sheet is unambiguously better for the actual posture people use this app in. I could reach it with the phone low and one hand full. The old top control needed a grip shuffle and I used to drop the phone doing it.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        askIndex: 0,
        theme: 'bottom-sheet-relearn',
        upvotes: 13,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'read',
    votes: 11,
  },
  {
    key: 'fm-aleksy-1',
    project: 'ferryman',
    reviewer: 'aleksynowak',
    versionLabel: '3.0.0',
    headline: 'Battery drain on a two hour journey is noticeably worse than 2.9',
    timeSpentMinutes: 128,
    environment: { os: 'Android 15', device: 'Pixel 6a', build: '3.0.0' },
    daysAgo: 20,
    ratings: { first_session: 4, thumb_ergonomics: 4, platform_fit: 4, flow_friction: 4, battery: 2 },
    points: [
      {
        category: 'performance',
        body:
          'Two hour intercity journey, screen off, app in the background. Version 2.9.4 cost me about 6 per cent. Version 3.0.0 cost 14 per cent on the same route on the same phone a week apart. The only thing I changed was the version.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Live journey, in the background',
        upvotes: 16,
      },
    ],
    replies: [
      {
        author: 'vikramsahni',
        body:
          'That is a real regression and I can see it in my own numbers now that I know to look. The location update interval changed with the sheet work. Investigating.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    inboxState: 'actioned',
    votes: 14,
  },
  {
    key: 'fm-dan-1',
    project: 'ferryman',
    reviewer: 'danyero',
    versionLabel: '3.0.2',
    headline: 'Offline banner is honest, the map is not',
    timeSpentMinutes: 19,
    environment: { os: 'iOS 18.2', device: 'iPhone SE', build: '3.0.2' },
    daysAgo: 11,
    ratings: { first_session: 4, thumb_ergonomics: 3, platform_fit: 4, flow_friction: 4, battery: 4 },
    points: [
      {
        category: 'offline',
        body:
          'The banner says the data is nine minutes old, which is good. The map underneath keeps animating a vehicle along the line as though it knows where it is. It does not. That animation is a lie told confidently and it is more persuasive than the banner.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 1,
        theme: 'offline-honesty',
        upvotes: 18,
      },
    ],
    replies: [
      {
        author: 'vikramsahni',
        body:
          'A confident animation over stale data is worse than no animation, and I had not seen it that way. When the data is more than a minute old the vehicle will stop where it was last seen and say so.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 15,
  },
  {
    key: 'fm-hugo-1',
    project: 'ferryman',
    reviewer: 'hugobitt',
    versionLabel: '3.0.0',
    headline: 'Small thing on the SE',
    timeSpentMinutes: 7,
    environment: { os: 'iOS 18.1', device: 'iPhone SE, second generation', build: '3.0.0' },
    daysAgo: 26,
    ratings: { first_session: 4, thumb_ergonomics: 4, platform_fit: 4, flow_friction: 4, battery: 4 },
    points: [
      {
        category: 'layout_device',
        body: 'On the small SE screen the sheet covers the next departure time when it is open. You have to close it to see the thing you just chose.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Line picker sheet',
        askIndex: 0,
        upvotes: 6,
      },
    ],
    inboxState: 'triaged',
    votes: 5,
  },
  {
    key: 'fm-beatrice-1',
    project: 'ferryman',
    reviewer: 'beatricer',
    versionLabel: '3.0.0',
    headline: 'The sheet handle does not look like a handle',
    timeSpentMinutes: 15,
    environment: { os: 'iOS 18.2', device: 'iPhone 14', build: '3.0.0' },
    daysAgo: 29,
    ratings: { first_session: 4, thumb_ergonomics: 4, platform_fit: 4, flow_friction: 4, battery: 4 },
    points: [
      {
        category: 'nav_structure',
        body:
          'The grab handle is the same grey as the divider two rows above it and the same weight. I read it as decoration for about ten seconds. Making it shorter and darker would say “pull me” without a word.',
        severity: 'minor',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'bottom-sheet-relearn',
        upvotes: 8,
      },
    ],
    replies: [
      {
        author: 'vikramsahni',
        body:
          'The same grey and the same weight as the divider is a very precise diagnosis. The handle gets shorter and darker, and it sits on the sheet rather than on the list.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 7,
  },
  /* ------------------------------- Saltbox ------------------------------- */
  {
    key: 'sb-greta-1',
    project: 'saltbox',
    reviewer: 'gretalind',
    versionLabel: '0.8.3',
    headline: 'One handed at eleven at night: the claim worked, the undo did not',
    timeSpentMinutes: 29,
    environment: { os: 'Android 15', device: 'Pixel 8', build: '0.8.3' },
    daysAgo: 5,
    ratings: { first_session: 4, thumb_ergonomics: 4, platform_fit: 3, flow_friction: 3, battery: 4 },
    points: [
      {
        category: 'bug',
        body: 'The undo toast on a claimed shift does nothing if the app loses focus before you tap it.',
        severity: 'major',
        actionability: 'repro',
        sentiment: -1,
        repro: {
          steps: '1. Claim a shift. 2. While the undo toast is visible, pull down the notification shade and close it again. 3. Tap undo.',
          result: 'The toast dismisses and the shift stays claimed. No error, no second chance.',
          expected: 'Undo works for its full five seconds regardless of what the system does over the top of it.',
          frequency: 'often',
        },
        upvotes: 9,
      },
      {
        category: 'gestures',
        body:
          'The confirm step felt like protection rather than an obstacle, and I say that as somebody tired and irritable at the time. One extra tap for a thing that affects somebody else’s evening is correct.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        askIndex: 0,
        theme: 'confirm-is-protection',
        upvotes: 7,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 11,
  },
  {
    key: 'sb-tobi-1',
    project: 'saltbox',
    reviewer: 'tobiadeyemi',
    versionLabel: '0.8.3',
    headline: 'The confirm is fine. The thing before it is not.',
    timeSpentMinutes: 27,
    environment: { os: 'iOS 18.2', device: 'iPhone 15', build: '0.8.3' },
    daysAgo: 9,
    ratings: { first_session: 4, thumb_ergonomics: 4, platform_fit: 4, flow_friction: 3, battery: 4 },
    points: [
      {
        category: 'gestures',
        body:
          'Nobody in my test hesitated at the confirm. Two of three hesitated at the step before it, because the shift card does not show who currently has the shift until you have already tapped claim. You are asking people to commit before you tell them whose evening they are taking.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'confirm-is-protection',
        upvotes: 14,
      },
    ],
    replies: [
      {
        author: 'ingridvos',
        body: 'The name goes on the card. That is obvious now that somebody has said it and it was invisible to me for six months.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 12,
  },
  {
    key: 'sb-vikram-1',
    project: 'saltbox',
    reviewer: 'vikramsahni',
    versionLabel: '0.8.0',
    headline: 'Targets are good, the list is doing too much scrolling',
    timeSpentMinutes: 21,
    environment: { os: 'Android 15', device: 'Pixel 8', build: '0.8.0' },
    daysAgo: 13,
    ratings: { first_session: 4, thumb_ergonomics: 5, platform_fit: 4, flow_friction: 3, battery: 4 },
    points: [
      {
        category: 'nav_structure',
        body:
          'Every shift in the next fortnight is in one list, newest first, so the thing I want, which is tomorrow, is nine screens down. A sticky day header or a jump to today would save the whole interaction.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Shift list',
        askIndex: 0,
        upvotes: 10,
      },
    ],
    replies: [
      {
        author: 'ingridvos',
        body:
          'Tomorrow nine screens down is the right way to put it. The list is getting a sticky day header and it will open on today.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 8,
  },
  {
    key: 'sb-hugo-1',
    project: 'saltbox',
    reviewer: 'hugobitt',
    versionLabel: '0.8.0',
    headline: 'Nice, simple',
    timeSpentMinutes: 5,
    environment: { os: 'iOS 18.2', device: 'iPhone 14', build: '0.8.0' },
    daysAgo: 16,
    ratings: { first_session: 4, thumb_ergonomics: 4, platform_fit: 4, flow_friction: 4, battery: 4 },
    points: [
      {
        category: 'install',
        body: 'Easy to understand. I have not worked in a restaurant so I cannot say much more than that.',
        severity: 'praise',
        actionability: 'opinion',
        sentiment: 1,
      },
    ],
    inboxState: 'read',
    votes: 0,
  },
  {
    key: 'sb-nkechi-1',
    project: 'saltbox',
    reviewer: 'nkechiobi',
    versionLabel: '0.8.0',
    headline: 'Dutch strings break the button at large text sizes',
    timeSpentMinutes: 24,
    environment: { os: 'iOS 18.2', device: 'iPhone 13', build: '0.8.0', assistive: 'Dynamic Type, largest' },
    daysAgo: 19,
    ratings: { first_session: 3, thumb_ergonomics: 4, platform_fit: 3, flow_friction: 3, battery: 4 },
    points: [
      {
        category: 'accessibility',
        body:
          'At the largest accessibility text size the Dutch label on the claim button clips to “Dienst overne”. English fits, Dutch does not, and Dutch is the language most of your users read. The button needs to wrap or the label needs to be shorter in that locale.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Shift detail, claim button',
        upvotes: 11,
      },
    ],
    replies: [
      {
        author: 'ingridvos',
        body:
          'Dutch is what most of the staff read, so this is not an edge case. The button will wrap at the large sizes, and the label is being shortened with the two restaurants rather than by me.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 9,
  },
  {
    key: 'sb-sofia-1',
    project: 'saltbox',
    reviewer: 'sofiabrandao',
    versionLabel: '0.8.0',
    headline: 'The manager approval is the part that will decide whether this survives',
    timeSpentMinutes: 17,
    environment: { os: 'Android 15', device: 'Samsung Galaxy A54', build: '0.8.0' },
    daysAgo: 22,
    ratings: { first_session: 4, thumb_ergonomics: 4, platform_fit: 4, flow_friction: 3, battery: 4 },
    points: [
      {
        category: 'missing',
        body:
          'In my family’s business the swap was never the hard part. The hard part was the manager finding out about it in time to not schedule around the old plan. Your approval screen is one tap, which is good, but nothing tells the manager it is waiting except a notification they will be too busy to read.',
        severity: 'major',
        actionability: 'suggestion',
        sentiment: 0,
        anchorKind: 'screen',
        anchorValue: 'Manager approval',
        upvotes: 12,
      },
    ],
    replies: [
      {
        author: 'ingridvos',
        body:
          'The manager finding out in time is the whole job, and one tap does not help if nobody taps. Pending approvals will stay at the top of the manager’s screen until somebody deals with them, instead of living in a notification.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 10,
  },

  /* -------------------------- Harrowgate Press --------------------------- */
  {
    key: 'hp-beatrice-1',
    project: 'harrowgate-press',
    reviewer: 'beatricer',
    versionLabel: 'Staging 12',
    headline: 'I thought you sold essays',
    summary:
      'Read it once at normal speed and closed the tab, as asked. What I would have told a friend afterwards is that you are a magazine that also has some books.',
    timeSpentMinutes: 13,
    environment: { device: 'MacBook Pro', browser: 'Safari 18', build: 'Staging 12' },
    daysAgo: 4,
    ratings: { message_clarity: 2, credibility: 4, scan_find: 3, conversion_pull: 2, craft: 4 },
    points: [
      {
        category: 'hero',
        body:
          'The first thing on the page is an essay title in the largest type on the site. The books are below it, smaller, in a grid that reads as related reading. I closed the tab believing you were a publication. The type size is doing the whole argument and it is arguing for the essays.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'reads-as-magazine',
        upvotes: 16,
      },
      {
        category: 'cta',
        body:
          'I did not see a way to buy anything on the homepage. I know you said the shop is two clicks away. I did not find the first click.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        askIndex: 1,
        upvotes: 11,
      },
    ],
    replies: [
      {
        author: 'elowenprice',
        body:
          'That is painful and correct. The essay is the biggest type on the page because the essay is what I am proudest of, which is not the same as what the page is for.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 15,
  },
  {
    key: 'hp-fenella-1',
    project: 'harrowgate-press',
    reviewer: 'fenelladoyle',
    versionLabel: 'Staging 12',
    headline: 'The homepage never says the word books until the fourth screen',
    timeSpentMinutes: 19,
    environment: { device: 'MacBook Pro', browser: 'Firefox 132', build: 'Staging 12' },
    daysAgo: 7,
    ratings: { message_clarity: 2, credibility: 4, scan_find: 3, conversion_pull: 2, craft: 4 },
    points: [
      {
        category: 'value_prop',
        body:
          'Yours: “Harrowgate Press. Writing from the edge of things.” Mine: “Harrowgate Press publishes six books a year. We print small, we pay properly, and we post on Thursdays.” What changed: the reader now knows what they can buy, how many exist, and that a person posts them.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'reads-as-magazine',
        upvotes: 17,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 14,
  },
  {
    key: 'hp-petra-1',
    project: 'harrowgate-press',
    reviewer: 'petranilsen',
    versionLabel: 'Staging 9',
    headline: 'As a reader who buys from small presses, I would have bought and did not',
    timeSpentMinutes: 16,
    environment: { device: 'iMac', browser: 'Safari 18', build: 'Staging 9' },
    daysAgo: 11,
    ratings: { message_clarity: 3, credibility: 5, scan_find: 2, conversion_pull: 2, craft: 5 },
    points: [
      {
        category: 'navigation',
        body:
          'I expected to buy from the book itself. I clicked a cover, got a beautifully set page about the author, read to the bottom, and there was no price and no button. I went back and clicked two more covers to check I had not missed it.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'route',
        anchorValue: '/books/:slug',
        askIndex: 1,
        upvotes: 15,
      },
      {
        category: 'delight',
        body: 'The author pages are the best thing on the site. Genuinely better than most presses ten times your size.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        anchorKind: 'route',
        anchorValue: '/authors/:slug',
      },
    ],
    inboxState: 'actioned',
    votes: 13,
  },
  {
    key: 'hp-hana-1',
    project: 'harrowgate-press',
    reviewer: 'hanakuro',
    versionLabel: 'Staging 9',
    headline: 'Two typefaces doing the same job',
    timeSpentMinutes: 21,
    environment: { device: 'Desktop', browser: 'Chrome 131', build: 'Staging 9' },
    daysAgo: 14,
    ratings: { message_clarity: 3, credibility: 4, scan_find: 3, conversion_pull: 3, craft: 3 },
    points: [
      {
        category: 'visual_design',
        body:
          'The book titles and the essay titles are set in two different serifs at nearly the same size. Neither wins, so the page has no first thing. Pick one for titles and let the other carry the body, and the hierarchy problem everybody else is describing partly solves itself.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'route',
        anchorValue: '/',
        theme: 'reads-as-magazine',
        upvotes: 12,
      },
    ],
    inboxState: 'triaged',
    votes: 10,
  },
  {
    key: 'hp-emmett-1',
    project: 'harrowgate-press',
    reviewer: 'emmettquill',
    versionLabel: 'Staging 9',
    headline: 'Looks nice',
    timeSpentMinutes: 3,
    environment: { device: 'Laptop', browser: 'Chrome 131', build: 'Staging 9' },
    daysAgo: 18,
    ratings: { message_clarity: 4, credibility: 4, scan_find: 4, conversion_pull: 3, craft: 5 },
    points: [
      {
        category: 'visual_design',
        body: 'The design is nice and it loads fast. Books I think.',
        severity: 'praise',
        actionability: 'opinion',
        sentiment: 1,
      },
    ],
    inboxState: 'new',
    votes: 0,
  },

  /* ------------------------- Bellweather Cycles -------------------------- */
  {
    key: 'bc-tobi-1',
    project: 'bellweather-cycles',
    reviewer: 'tobiadeyemi',
    versionLabel: 'Live, March',
    headline: 'I expected the button to book. It scrolled. I left.',
    timeSpentMinutes: 11,
    environment: { device: 'iPhone 15', browser: 'Safari', build: 'Live, March' },
    daysAgo: 6,
    ratings: { message_clarity: 5, credibility: 4, scan_find: 3, conversion_pull: 2, craft: 4 },
    points: [
      {
        category: 'cta',
        body:
          'I tapped “Book a repair” expecting a form or a phone number. The page moved and I was somewhere in the middle of a section about the workshop. On a phone the scroll animation is fast enough that it reads as a page load that went wrong. I thought the site was broken and closed it.\n\nOn a phone specifically, that button should open the form, not travel to it.',
        severity: 'blocker',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'cta-scrolls-not-books',
        upvotes: 19,
      },
    ],
    replies: [
      {
        author: 'beatricer',
        body:
          'I have watched the owner’s phone calls go up and the bookings stay flat for six months and I could not explain it. This is the explanation. Thank you.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 18,
  },
  {
    key: 'bc-fenella-1',
    project: 'bellweather-cycles',
    reviewer: 'fenelladoyle',
    versionLabel: 'Live, March',
    headline: 'The promise is above the fold and it is the best sentence on the site',
    timeSpentMinutes: 9,
    environment: { device: 'MacBook Pro', browser: 'Safari 18', build: 'Live, March' },
    daysAgo: 10,
    ratings: { message_clarity: 5, credibility: 4, scan_find: 4, conversion_pull: 3, craft: 4 },
    points: [
      {
        category: 'value_prop',
        body:
          '“Bring it in before ten, ride it home tonight.” That is a complete business model in nine words and I would not change a syllable. The rest of the page does not live up to it.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        anchorKind: 'route',
        anchorValue: '/',
        upvotes: 13,
      },
      {
        category: 'copy',
        body:
          'The booking form header says “Get in touch”. It is a repair booking. Yours: “Get in touch”. Mine: “Book your repair”. What changed: it now names the same action as the button that brought you here, so the reader knows they arrived.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'selector',
        anchorValue: '#booking h2',
        askIndex: 0,
        theme: 'cta-scrolls-not-books',
        upvotes: 11,
      },
    ],
    inboxState: 'actioned',
    votes: 12,
  },
  {
    key: 'bc-ingrid-1',
    project: 'bellweather-cycles',
    reviewer: 'ingridvos',
    versionLabel: 'Live, March',
    headline: 'I would have phoned, and I think most people do',
    timeSpentMinutes: 8,
    environment: { device: 'Android phone', browser: 'Chrome', build: 'Live, March' },
    daysAgo: 15,
    ratings: { message_clarity: 5, credibility: 5, scan_find: 4, conversion_pull: 3, craft: 4 },
    points: [
      {
        category: 'cta',
        body:
          'The phone number is in the header, large, tappable, next to the opening hours. The form is at the bottom behind a scroll. The site is working exactly as built; it is just built to generate phone calls.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: 0,
        askIndex: 0,
        theme: 'cta-scrolls-not-books',
        upvotes: 14,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 12,
  },
  {
    key: 'bc-nkechi-1',
    project: 'bellweather-cycles',
    reviewer: 'nkechiobi',
    versionLabel: 'Live, March',
    headline: 'The form has no labels, only hint text inside the fields',
    timeSpentMinutes: 17,
    environment: { device: 'Desktop', browser: 'Chrome 131', build: 'Live, March', assistive: 'NVDA 2024.4' },
    daysAgo: 20,
    ratings: { message_clarity: 4, credibility: 4, scan_find: 3, conversion_pull: 2, craft: 3 },
    points: [
      {
        category: 'accessibility',
        body:
          'Every field in the booking form puts its hint text inside the box instead of in a label, so the moment you start typing you can no longer see what the field was for, and a screen reader announces four fields called “edit”. There is also no error text when a required field is empty; the form simply does not submit.',
        severity: 'blocker',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'selector',
        anchorValue: '#booking form',
        upvotes: 16,
      },
    ],
    inboxState: 'actioned',
    votes: 14,
  },
  {
    key: 'bc-omar-1',
    project: 'bellweather-cycles',
    reviewer: 'omarhaddad',
    versionLabel: 'Live, March',
    headline: 'Opening hours are the second thing I looked for and the last thing I found',
    timeSpentMinutes: 7,
    environment: { device: 'Laptop', browser: 'Firefox 132', build: 'Live, March' },
    daysAgo: 24,
    ratings: { message_clarity: 5, credibility: 4, scan_find: 2, conversion_pull: 3, craft: 4 },
    points: [
      {
        category: 'navigation',
        body:
          'Hours are in the header on desktop and in the footer on a phone. I was on a phone. Given that the entire promise is about bringing the bike in before ten, the hours should be next to the promise on every screen size.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'route',
        anchorValue: '/',
        upvotes: 10,
      },
    ],
    inboxState: 'triaged',
    votes: 8,
  },
  /* ----------------------------- The Last Loom --------------------------- */
  {
    key: 'll-imani-1',
    project: 'the-last-loom',
    reviewer: 'imanifrazier',
    versionLabel: 'Fine cut 3',
    headline: 'Looked away at 11:40, came back at 13:05, and did not feel I had missed anything',
    summary:
      'Watched once, full size, headphones, no scrubbing. The nine minute interview does earn about six of its nine minutes. The section from 11:40 to 13:05 is where I lost contact, and I think it is because the visual has nothing new in it for eighty five seconds.',
    timeSpentMinutes: 34,
    environment: { device: 'Desktop, 27 inch', audio: 'Headphones', build: 'Fine cut 3' },
    daysAgo: 5,
    ratings: { hook: 5, pacing: 3, story_clarity: 4, production_craft: 5, payoff: 4 },
    points: [
      {
        category: 'pacing',
        body:
          'At 11:40 he starts the second explanation of the punch card system. It is the same information as 07:20 with better wording. I looked at my phone at about 11:55 and looked back at 13:05, when the loom noise comes back in.\n\nCutting from 11:40 to 12:50 would cost you one good line and buy back seventy seconds in the exact place the film is asking most of the audience.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '11:40',
        timecodeMs: 700000,
        askIndex: 0,
        theme: 'middle-interview-sag',
        upvotes: 17,
      },
      {
        category: 'hook',
        body:
          'The first fifteen seconds are the best documentary hook I have seen on this site. The sound arriving before the picture is the whole reason I stayed, and it would work as a thirty second cut for social almost unchanged.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        anchorKind: 'timecode',
        anchorValue: '0:00',
        timecodeMs: 0,
        upvotes: 12,
      },
    ],
    replies: [
      {
        author: 'casperlq',
        body:
          'The second punch card explanation is there because I was afraid the first one was too fast. Three of you have now put the drop in the same ninety second window, so the fear was wrong and the repetition is the cost.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 19,
  },
  {
    key: 'll-kwame-1',
    project: 'the-last-loom',
    reviewer: 'kwamemensah',
    versionLabel: 'Fine cut 3',
    headline: 'Drop at 12:10, and the regrade at 03:10 is now too clean',
    timeSpentMinutes: 31,
    environment: { device: 'Grading suite, calibrated', build: 'Fine cut 3' },
    daysAgo: 8,
    ratings: { hook: 5, pacing: 3, story_clarity: 4, production_craft: 4, payoff: 4 },
    points: [
      {
        category: 'pacing',
        body: 'I went at 12:10. Same stretch everybody else is naming. It is not the length, it is that the camera does not move for four minutes.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '12:10',
        timecodeMs: 730000,
        askIndex: 0,
        theme: 'middle-interview-sag',
        upvotes: 11,
      },
      {
        category: 'color',
        body:
          'The archive at 03:10 now matches the modern footage too well. It reads as a reconstruction rather than as the mill’s own film. I would put some of the grain and the green back. Archive should look like archive or the audience quietly stops believing it.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '03:10',
        timecodeMs: 190000,
        askIndex: 1,
        upvotes: 15,
      },
    ],
    replies: [
      {
        author: 'casperlq',
        body:
          'You are right and I knew it while I was doing it. I regraded it because a broadcaster note said it looked inconsistent, which is exactly the wrong reason.',
        daysAfter: 2,
        pointIndex: 1,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 16,
  },
  {
    key: 'll-petra-1',
    project: 'the-last-loom',
    reviewer: 'petranilsen',
    versionLabel: 'Fine cut 3',
    headline: 'Never looked away, and I think the nine minutes are the film',
    timeSpentMinutes: 28,
    environment: { device: 'iMac', audio: 'Speakers', build: 'Fine cut 3' },
    daysAgo: 12,
    ratings: { hook: 5, pacing: 5, story_clarity: 5, production_craft: 5, payoff: 5 },
    points: [
      {
        category: 'pacing',
        body:
          'I did not look away once, and the place where I almost did was around twelve minutes, which I notice is where everyone else went. I stayed because of what he does with his hands while he is talking. If you cut that section, cut the words and keep the hands.',
        severity: 'praise',
        actionability: 'suggestion',
        sentiment: 1,
        anchorKind: 'timecode',
        anchorValue: '12:00',
        timecodeMs: 720000,
        askIndex: 0,
        theme: 'middle-interview-sag',
        upvotes: 18,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 16,
  },
  {
    key: 'll-fenella-1',
    project: 'the-last-loom',
    reviewer: 'fenelladoyle',
    versionLabel: 'Fine cut 2',
    headline: 'The captions are a paragraph behind the speech twice',
    timeSpentMinutes: 26,
    environment: { device: 'MacBook Pro', build: 'Fine cut 2', assistive: 'Captions on' },
    daysAgo: 15,
    ratings: { hook: 5, pacing: 4, story_clarity: 3, production_craft: 4, payoff: 4 },
    points: [
      {
        category: 'graphics',
        body:
          'At 06:48 and again at 17:20 the caption is showing the previous sentence while he says the next one. Both times it is during dialect, which is exactly where somebody would be relying on the caption.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '06:48',
        timecodeMs: 408000,
        upvotes: 12,
      },
      {
        category: 'script',
        body:
          'The narration line at 02:05 says the mill “once employed four hundred people”. He says eleven hundred at 09:30. One of them is wrong and a viewer will notice.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '02:05',
        timecodeMs: 125000,
        upvotes: 14,
      },
    ],
    replies: [
      {
        author: 'casperlq',
        body:
          'Both caption slips are in dialect, which is the worst place for them, and I would not have caught either. The four hundred is the narration’s mistake: the mill employed eleven hundred at its peak, and he is right.',
        daysAfter: 1,
        pointIndex: 1,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 15,
  },
  {
    key: 'll-mira-1',
    project: 'the-last-loom',
    reviewer: 'mirasolvang',
    versionLabel: 'Fine cut 2',
    headline: 'The sound of the loom is doing the structural work',
    timeSpentMinutes: 24,
    environment: { device: 'Desktop', audio: 'Headphones', build: 'Fine cut 2' },
    daysAgo: 18,
    ratings: { hook: 5, pacing: 4, story_clarity: 4, production_craft: 5, payoff: 4 },
    points: [
      {
        category: 'audio_mix',
        body:
          'Every time I lost the thread, the loom came back and I re-oriented. It is functioning as a chapter marker. During the long interview it is absent for nearly four minutes, which is the longest the film goes without its own clock.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: 0,
        anchorKind: 'timecode',
        anchorValue: '10:30',
        timecodeMs: 630000,
        theme: 'middle-interview-sag',
        upvotes: 13,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 11,
  },
  {
    key: 'll-nkechi-1',
    project: 'the-last-loom',
    reviewer: 'nkechiobi',
    versionLabel: 'Fine cut 2',
    headline: 'No captions on the archive section at all',
    timeSpentMinutes: 22,
    environment: { device: 'Desktop', build: 'Fine cut 2', assistive: 'Captions on, sound off' },
    daysAgo: 21,
    ratings: { hook: 4, pacing: 4, story_clarity: 2, production_craft: 4, payoff: 4 },
    points: [
      {
        category: 'accessibility',
        body:
          'From 03:10 to 04:50 there are no captions. There is speech in the archive audio. With sound off that ninety seconds is silent picture, and it is the section that establishes the scale of the place.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '03:10',
        timecodeMs: 190000,
        upvotes: 14,
      },
      {
        category: 'graphics',
        body: 'The lower third at 01:12 is white on a pale wall for about two seconds before the shot darkens. Unreadable in that window.',
        severity: 'minor',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '01:12',
        timecodeMs: 72000,
        upvotes: 7,
      },
    ],
    replies: [
      {
        author: 'casperlq',
        body:
          'The archive audio was never transcribed, and I had convinced myself the pictures carried it. They do not. The ninety seconds are being captioned, and the lower third at 01:12 will wait for the shot to darken.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 13,
  },
  {
    key: 'll-elowen-1',
    project: 'the-last-loom',
    reviewer: 'elowenprice',
    versionLabel: 'Fine cut 2',
    headline: 'I could not tell whose film this is until eighteen minutes in',
    timeSpentMinutes: 27,
    environment: { device: 'Laptop', build: 'Fine cut 2' },
    daysAgo: 25,
    ratings: { hook: 4, pacing: 3, story_clarity: 3, production_craft: 5, payoff: 3 },
    points: [
      {
        category: 'structure',
        body:
          'For the first eighteen minutes I thought this was about the loom. At 18:20 it becomes clear it is about him, and specifically about the fact that nobody is coming after him. That is a better film and it starts too late. One line in the first two minutes would reframe the whole middle.',
        severity: 'major',
        actionability: 'suggestion',
        sentiment: 0,
        anchorKind: 'timecode',
        anchorValue: '18:20',
        timecodeMs: 1100000,
        upvotes: 16,
      },
    ],
    replies: [
      {
        author: 'casperlq',
        body:
          'Eighteen minutes is a long time to wait for the subject of your own film. I have been protecting a reveal, and you are right that it is not a reveal, it is just late. Looking for the line in the first two minutes.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 14,
  },
  {
    key: 'll-emmett-1',
    project: 'the-last-loom',
    reviewer: 'emmettquill',
    versionLabel: 'Fine cut 2',
    headline: 'Beautiful film',
    summary: 'Really enjoyed this, the photography is lovely. Maybe slightly long in the middle but I did not mind.',
    timeSpentMinutes: 12,
    environment: { device: 'Laptop', build: 'Fine cut 2' },
    daysAgo: 28,
    ratings: { hook: 5, pacing: 4, story_clarity: 4, production_craft: 5, payoff: 4 },
    points: [
      {
        category: 'pacing',
        body: 'Bit long in the middle but it is a nice film.',
        severity: 'nit',
        actionability: 'opinion',
        sentiment: 0,
        askIndex: 0,
      },
    ],
    inboxState: 'read',
    votes: 1,
  },
  {
    key: 'll-hana-1',
    project: 'the-last-loom',
    reviewer: 'hanakuro',
    versionLabel: 'Fine cut 1',
    headline: 'The titles are set in a face that is fighting the archive',
    timeSpentMinutes: 23,
    environment: { device: 'Desktop', build: 'Fine cut 1' },
    daysAgo: 35,
    ratings: { hook: 4, pacing: 3, story_clarity: 4, production_craft: 3, payoff: 4 },
    points: [
      {
        category: 'graphics',
        body:
          'The titles are a modern geometric sans over 1950s film. Every other decision in this cut respects the period and that one does not. A transitional serif or even a plain grotesque with real weight would disappear, which is what you want.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '0:22',
        timecodeMs: 22000,
        upvotes: 9,
      },
    ],
    replies: [
      {
        author: 'casperlq',
        body:
          'The titles went in on the first day as a stand-in and stayed because I stopped seeing them. A grotesque with real weight is the right call. I am trying two this week.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 8,
  },
  {
    key: 'll-tobi-1',
    project: 'the-last-loom',
    reviewer: 'tobiadeyemi',
    versionLabel: 'Fine cut 3',
    headline: 'Attention log, thirty second intervals',
    summary:
      'I logged my own attention every thirty seconds because you asked for a timecode rather than an opinion. Two dips: a small one at 05:30 and a real one from 11:30 to 13:00.',
    timeSpentMinutes: 29,
    environment: { device: 'MacBook Pro', audio: 'Headphones', build: 'Fine cut 3' },
    daysAgo: 10,
    ratings: { hook: 5, pacing: 3, story_clarity: 4, production_craft: 5, payoff: 4 },
    points: [
      {
        category: 'pacing',
        body:
          'The 11:30 to 13:00 dip is the one that matters. The 05:30 one recovers on its own within twenty seconds because the picture changes. In the later dip the picture does not change, so nothing pulls me back except my own discipline.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '11:30',
        timecodeMs: 690000,
        askIndex: 0,
        theme: 'middle-interview-sag',
        upvotes: 14,
      },
    ],
    replies: [
      {
        author: 'casperlq',
        body:
          'An attention log at thirty second intervals is the most useful thing anybody has sent me about this film. The late dip lines up with the stretch where the picture does not change, so that is where the cut goes.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 12,
  },

  /* ------------------------ Six Minutes on the Ice ----------------------- */
  {
    key: 'sm-casper-1',
    project: 'six-minutes-on-the-ice',
    reviewer: 'casperlq',
    versionLabel: 'Rough cut 2',
    headline: 'The last shot says “that is all the footage I had”',
    summary:
      'Watched twice. The first four minutes are genuinely excellent and the last ninety seconds are a different film that has not been made yet. You asked what the last shot is saying, in my words: it is saying the shoot ended.',
    timeSpentMinutes: 26,
    environment: { device: 'Grading suite', build: 'Rough cut 2' },
    daysAgo: 4,
    ratings: { hook: 5, pacing: 4, story_clarity: 3, production_craft: 4, payoff: 2 },
    points: [
      {
        category: 'structure',
        body:
          'The wide of the empty rink at 5:32 is a beautiful shot with nothing to say, because nothing in the preceding six minutes set up absence as a theme. You have an ending already, at 4:10, when the older one checks the younger one’s edge without being asked. That is your last shot. Everything after it is footage.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '5:32',
        timecodeMs: 332000,
        askIndex: 0,
        theme: 'ending-is-earlier',
        upvotes: 21,
      },
      {
        category: 'hook',
        body: 'The scrape at 0:00 before any picture is the correct decision and you should not let anybody talk you out of it.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        anchorKind: 'timecode',
        anchorValue: '0:00',
        timecodeMs: 0,
        upvotes: 9,
      },
    ],
    replies: [
      {
        author: 'imanifrazier',
        body:
          'I have watched 4:10 twenty times since reading this and you are right. I was saving it as a mid-point because it felt too good for an ending, which is a bad reason.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 22,
  },
  {
    key: 'sm-kwame-1',
    project: 'six-minutes-on-the-ice',
    reviewer: 'kwamemensah',
    versionLabel: 'Rough cut 2',
    headline: 'Second night footage does not match and you can use that',
    timeSpentMinutes: 19,
    environment: { device: 'Grading suite, calibrated', build: 'Rough cut 2' },
    daysAgo: 7,
    ratings: { hook: 5, pacing: 4, story_clarity: 3, production_craft: 3, payoff: 3 },
    points: [
      {
        category: 'color',
        body:
          'From 2:20 the arena lights are noticeably greener and the whites are two stops hotter. In a documentary that could read as two different nights, which it is. I would lean into it rather than match it: title the nights.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: 0,
        anchorKind: 'timecode',
        anchorValue: '2:20',
        timecodeMs: 140000,
        upvotes: 10,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 9,
  },
  {
    key: 'sm-elowen-1',
    project: 'six-minutes-on-the-ice',
    reviewer: 'elowenprice',
    versionLabel: 'Rough cut 2',
    headline: 'It ends at 4:10 and then keeps going',
    timeSpentMinutes: 14,
    environment: { device: 'Laptop', build: 'Rough cut 2' },
    daysAgo: 11,
    ratings: { hook: 5, pacing: 4, story_clarity: 4, production_craft: 4, payoff: 2 },
    points: [
      {
        category: 'structure',
        body:
          'I felt the film finish at about four minutes and then sat through another ninety seconds waiting for a reason. The last shot said nothing to me except that we were looking at an empty rink.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '4:10',
        timecodeMs: 250000,
        askIndex: 0,
        theme: 'ending-is-earlier',
        upvotes: 12,
      },
    ],
    replies: [
      {
        author: 'imanifrazier',
        body:
          'Feeling it finish at 4:10 is the answer I was half hoping for and half dreading. The ninety seconds after it may be there for me rather than for anybody watching.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 10,
  },
  {
    key: 'sm-mira-1',
    project: 'six-minutes-on-the-ice',
    reviewer: 'mirasolvang',
    versionLabel: 'Rough cut 2',
    headline: 'Scratch audio is doing you a favour',
    timeSpentMinutes: 16,
    environment: { device: 'Desktop', audio: 'Headphones', build: 'Rough cut 2' },
    daysAgo: 14,
    ratings: { hook: 5, pacing: 5, story_clarity: 4, production_craft: 4, payoff: 3 },
    points: [
      {
        category: 'audio_mix',
        body:
          'With no music, the machine noise carries the rhythm from the first scrape at 0:00, and it is hypnotic. When you add a score, please try a version that does not. I suspect the temp track you eventually drop in will be the thing that makes this ordinary.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: 1,
        anchorKind: 'timecode',
        anchorValue: '0:00',
        timecodeMs: 0,
        upvotes: 11,
      },
    ],
    inboxState: 'triaged',
    votes: 9,
  },
  {
    key: 'sm-hugo-1',
    project: 'six-minutes-on-the-ice',
    reviewer: 'hugobitt',
    versionLabel: 'Rough cut 1',
    headline: 'I liked the ending',
    timeSpentMinutes: 6,
    environment: { device: 'Laptop', build: 'Rough cut 1' },
    daysAgo: 17,
    ratings: { hook: 4, pacing: 4, story_clarity: 4, production_craft: 4, payoff: 4 },
    points: [
      {
        category: 'structure',
        body: 'The empty rink at the end felt peaceful to me. I thought it worked.',
        severity: 'praise',
        actionability: 'opinion',
        sentiment: 1,
        askIndex: 0,
      },
    ],
    inboxState: 'read',
    votes: 2,
  },
  {
    key: 'sm-nkechi-1',
    project: 'six-minutes-on-the-ice',
    reviewer: 'nkechiobi',
    versionLabel: 'Rough cut 1',
    headline: 'No captions at all, and the two voices sound alike',
    timeSpentMinutes: 13,
    environment: { device: 'Desktop', build: 'Rough cut 1', assistive: 'Sound off' },
    daysAgo: 20,
    ratings: { hook: 4, pacing: 3, story_clarity: 2, production_craft: 3, payoff: 3 },
    points: [
      {
        category: 'accessibility',
        body:
          'With sound off I could not follow who was speaking from the first exchange at 0:48 onward, and the two crew members are never on screen when they talk. Captions with speaker labels would fix both problems at once, and you need them for the platform anyway.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '0:48',
        timecodeMs: 48000,
        upvotes: 12,
      },
    ],
    replies: [
      {
        author: 'imanifrazier',
        body:
          'Captions with speaker labels are going in. You have also told me why the two of them blur together: I never show either of them speaking. Naming them on screen once, early, will help everybody.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 10,
  },

  /* ------------------------------- Ashfall ------------------------------- */
  {
    key: 'af-casper-1',
    project: 'ashfall',
    reviewer: 'casperlq',
    versionLabel: 'Locked cut',
    headline: 'I did not notice the cut',
    summary: 'Watched once at full size as asked. I did not see a cut at 1:12. On the second watch, looking for it, I found it, and it is invisible because the smoke covers the join.',
    timeSpentMinutes: 18,
    environment: { device: 'Grading suite', build: 'Locked cut' },
    daysAgo: 2,
    ratings: { hook: 5, pacing: 5, story_clarity: 4, production_craft: 5, payoff: 5 },
    points: [
      {
        category: 'color',
        body:
          'First watch: no cut noticed. Second watch: found at 1:12, the smoke pass hides the join completely and the exposure matches within a stop. Ship it.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        anchorKind: 'timecode',
        anchorValue: '1:12',
        timecodeMs: 72000,
        askIndex: 0,
        theme: 'cut-at-112',
        upvotes: 15,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 13,
  },
  {
    key: 'af-imani-1',
    project: 'ashfall',
    reviewer: 'imanifrazier',
    versionLabel: 'Locked cut',
    headline: 'Saw it, and it read as a mistake for about a second',
    timeSpentMinutes: 15,
    environment: { device: 'Desktop, 27 inch', build: 'Locked cut' },
    daysAgo: 4,
    ratings: { hook: 5, pacing: 4, story_clarity: 4, production_craft: 4, payoff: 4 },
    points: [
      {
        category: 'color',
        body:
          'I saw it. What made it read as a mistake was not the picture, it was that the camera movement changes speed across the join. Before the cut you are drifting left at a constant rate, after it you are slightly faster. My eye read that as a dropped frame before it read it as an edit.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '1:12',
        timecodeMs: 72000,
        askIndex: 0,
        theme: 'cut-at-112',
        upvotes: 17,
      },
    ],
    replies: [
      {
        author: 'kwamemensah',
        body:
          'Speed change across the join is something I can actually fix before Friday, unlike the thing I was worried about. Retiming the second half now.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 16,
  },
  {
    key: 'af-hana-1',
    project: 'ashfall',
    reviewer: 'hanakuro',
    versionLabel: 'Grade 2',
    headline: 'Did not see the cut, did see the title card',
    timeSpentMinutes: 12,
    environment: { device: 'Desktop', build: 'Grade 2' },
    daysAgo: 6,
    ratings: { hook: 5, pacing: 5, story_clarity: 4, production_craft: 4, payoff: 4 },
    points: [
      {
        category: 'graphics',
        body:
          'The end title sits in the lower third over the brightest part of the frame for the last four seconds and I could barely read the artist name. Move it up or wait two seconds for the exposure to drop.',
        severity: 'minor',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'timecode',
        anchorValue: '3:46',
        timecodeMs: 226000,
        upvotes: 8,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 7,
  },
  {
    key: 'af-tayo-1',
    project: 'ashfall',
    reviewer: 'tayobalogun',
    versionLabel: 'Grade 2',
    headline: 'No cut seen, but the geography goes at 2:30',
    timeSpentMinutes: 11,
    environment: { device: 'Desktop', build: 'Grade 2' },
    daysAgo: 8,
    ratings: { hook: 5, pacing: 4, story_clarity: 3, production_craft: 5, payoff: 4 },
    points: [
      {
        category: 'structure',
        body:
          'I never saw a cut. What I did lose is where anybody is relative to the fire. From 2:30 the smoke is thick enough that the frame could be anywhere, and the tension drops because I no longer know how close is close.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: 0,
        anchorKind: 'timecode',
        anchorValue: '2:30',
        timecodeMs: 150000,
        askIndex: 0,
        theme: 'cut-at-112',
        upvotes: 9,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 8,
  },
  {
    key: 'af-emmett-1',
    project: 'ashfall',
    reviewer: 'emmettquill',
    versionLabel: 'Grade 2',
    headline: 'Amazing',
    timeSpentMinutes: 4,
    environment: { device: 'Laptop', build: 'Grade 2' },
    daysAgo: 9,
    ratings: { hook: 5, pacing: 5, story_clarity: 5, production_craft: 5, payoff: 5 },
    points: [
      {
        category: 'color',
        body: 'Did not notice any cut. Looks amazing.',
        severity: 'praise',
        actionability: 'opinion',
        sentiment: 1,
        askIndex: 0,
        theme: 'cut-at-112',
      },
    ],
    inboxState: 'read',
    votes: 2,
  },
  /* --------------------------- Standing Order ---------------------------- */
  {
    key: 'so-ingrid-1',
    project: 'standing-order',
    reviewer: 'ingridvos',
    versionLabel: 'Memo 2',
    headline: 'The number is not eleven, it is whether the eleven are the same people every week',
    summary:
      'I have ordered for a kitchen and I have been the person deciding the Monday number. Eleven confirmed orders would not change my plan. Eleven confirmed orders from the same eleven people for six weeks running absolutely would, and that is a different product.',
    timeSpentMinutes: 24,
    environment: { device: 'Desktop', build: 'Memo 2' },
    daysAgo: 3,
    ratings: { problem_sharpness: 4, insight: 4, willingness_to_pay: 3, path_to_100: 3, risk_honesty: 4 },
    points: [
      {
        category: 'assumptions',
        body:
          'A one off order of eleven is noise. A standing order is a promise, and a promise only changes behaviour once it has survived a few weeks. So the real assumption is not about the number, it is about retention: what share of standing orders are still standing in week six? That is the thing to test, and you could test it with a spreadsheet and one bakery.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: 0,
        askIndex: 0,
        theme: 'retention-not-volume',
        upvotes: 19,
      },
      {
        category: 'unit_economics',
        body:
          'Your waste table assumes waste is thrown away. In every kitchen I have worked in, day-old goes to staff, to a discount shelf, or to a charity collection, all of which recover some value. The saving is real but it is smaller than the table says.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        upvotes: 14,
      },
    ],
    replies: [
      {
        author: 'sofiabrandao',
        body:
          'Week six retention is the right question and I did not have it until now. I am going to run exactly that spreadsheet with the bakery on Rua Aurora before I write another line of code.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'actioned',
    votes: 18,
  },
  {
    key: 'so-priya-1',
    project: 'standing-order',
    reviewer: 'priyaram',
    versionLabel: 'Memo 2',
    headline: 'Who is the buyer, the bakery or the customer? The memo answers both.',
    timeSpentMinutes: 19,
    environment: { device: 'MacBook Air', build: 'Memo 2' },
    daysAgo: 6,
    ratings: { problem_sharpness: 4, insight: 3, willingness_to_pay: 2, path_to_100: 2, risk_honesty: 3 },
    points: [
      {
        category: 'target_customer',
        body:
          'Page one says bakeries save money. Page two says customers get a better price. Those are two different businesses with two different sales motions, and the one you build determines everything else. I sell to fourteen freelancers and it took me a year to learn that the answer cannot be both at the start.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        upvotes: 16,
      },
      {
        category: 'gtm',
        body:
          'Name the channel. “Neighbourhood bakeries” is a category. The channel is something like: walk into forty bakeries in one district over two weeks with a printed sheet. Say the thing you will actually do on Monday.',
        severity: 'major',
        actionability: 'suggestion',
        sentiment: 0,
        upvotes: 12,
      },
    ],
    inboxState: 'triaged',
    votes: 14,
  },
  {
    key: 'so-noor-1',
    project: 'standing-order',
    reviewer: 'noorfarhat',
    versionLabel: 'Memo 1',
    headline: 'The risk you have not named is the week somebody does not collect',
    timeSpentMinutes: 16,
    environment: { device: 'Laptop', build: 'Memo 1' },
    daysAgo: 10,
    ratings: { problem_sharpness: 4, insight: 3, willingness_to_pay: 3, path_to_100: 3, risk_honesty: 2 },
    points: [
      {
        category: 'problem_definition',
        body:
          'You have moved the risk from the bakery to the customer and the memo never says what happens when the customer does not turn up. Do they pay? Does the bakery eat it? Whoever holds that risk is the one who will quit first, and right now the memo is silent about it.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        upvotes: 15,
      },
    ],
    inboxState: 'triaged',
    votes: 13,
  },
  {
    key: 'so-omar-1',
    project: 'standing-order',
    reviewer: 'omarhaddad',
    versionLabel: 'Memo 1',
    headline: 'Three confirmed orders would change my aunt’s plan, not eleven',
    timeSpentMinutes: 12,
    environment: { device: 'Laptop', build: 'Memo 1' },
    daysAgo: 13,
    ratings: { problem_sharpness: 4, insight: 4, willingness_to_pay: 4, path_to_100: 3, risk_honesty: 3 },
    points: [
      {
        category: 'assumptions',
        body:
          'For a very small producer the number is tiny. Three orders of something specific is enough to bake a tray you would not otherwise bake. Eleven might be the right number for a bakery with staff; it is much too high for the ones who need this most.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: 0,
        askIndex: 0,
        theme: 'retention-not-volume',
        upvotes: 11,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 9,
  },
  {
    key: 'so-emmett-1',
    project: 'standing-order',
    reviewer: 'emmettquill',
    versionLabel: 'Memo 1',
    headline: 'Would use this',
    timeSpentMinutes: 4,
    environment: { device: 'Laptop', build: 'Memo 1' },
    daysAgo: 15,
    ratings: { problem_sharpness: 4, insight: 4, willingness_to_pay: 4, path_to_100: 3, risk_honesty: 3 },
    points: [
      {
        category: 'problem_definition',
        body: 'I would sign up for this at my local bakery. Seems like a good idea.',
        severity: 'praise',
        actionability: 'opinion',
        sentiment: 1,
      },
    ],
    inboxState: 'read',
    votes: 1,
  },

  /* ------------------------------ Meterwise ------------------------------ */
  {
    key: 'mw-priya-1',
    project: 'meterwise',
    reviewer: 'priyaram',
    versionLabel: 'Prototype 5',
    headline: 'Neither. Charge for the audit, not the month and not the share.',
    summary:
      'I have sold both models badly. A monthly fee for a tool that finds a thing once is a churn machine, and a share of savings makes every buyer suspect your numbers. The thing you actually sell is an afternoon of an expert’s judgement.',
    timeSpentMinutes: 27,
    environment: { device: 'MacBook Air', build: 'Prototype 5' },
    daysAgo: 4,
    ratings: { problem_sharpness: 5, insight: 4, willingness_to_pay: 3, path_to_100: 3, risk_honesty: 4 },
    points: [
      {
        category: 'pricing_model',
        body:
          'Four hundred a month assumes I have a bill problem every month. I do not. I have one in March when the tariff changes and one when somebody notices the meter has been estimated for a year.\n\nCharge for the audit. A fixed fee per building per year, priced against what an hour of your old firm’s time cost. The subscription can come later when you have something that watches continuously, and you do not have that yet.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'price-the-audit',
        upvotes: 21,
      },
    ],
    replies: [
      {
        author: 'noorfarhat',
        body:
          'This is the answer I did not want and have been circling for two months. The per-building annual number is easy for me to price because I know what my old firm charged. Rewriting the page.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 20,
  },
  {
    key: 'mw-sofia-1',
    project: 'meterwise',
    reviewer: 'sofiabrandao',
    versionLabel: 'Prototype 5',
    headline: 'I would have paid the share model and I would have hated it',
    timeSpentMinutes: 18,
    environment: { device: 'Laptop', build: 'Prototype 5' },
    daysAgo: 8,
    ratings: { problem_sharpness: 5, insight: 4, willingness_to_pay: 4, path_to_100: 3, risk_honesty: 4 },
    points: [
      {
        category: 'pricing_model',
        body:
          'A share of savings is easy to say yes to and horrible to live with, because every month you are reminded of what you are paying. The bakery had a card processor on that model and my father talked about it for years. He never cancelled, and he never recommended them to anybody.',
        severity: 'major',
        actionability: 'observation',
        sentiment: 0,
        askIndex: 0,
        theme: 'price-the-audit',
        upvotes: 14,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 12,
  },
  {
    key: 'mw-fenella-1',
    project: 'meterwise',
    reviewer: 'fenelladoyle',
    versionLabel: 'Prototype 5',
    headline: 'The findings report is doing the selling and the pricing page is undoing it',
    timeSpentMinutes: 21,
    environment: { device: 'MacBook Pro', build: 'Prototype 5' },
    daysAgo: 12,
    ratings: { problem_sharpness: 5, insight: 4, willingness_to_pay: 3, path_to_100: 3, risk_honesty: 4 },
    points: [
      {
        category: 'pricing_model',
        body:
          'The redacted report cites the clause it is disputing, in the supplier’s own words, with the number. That is the most convincing document I have read on this site. Then the pricing page says “From 400 a month” with no mention of what a month contains. Yours: “From 400 a month”. Mine: “400 a month covers every meter in one building, audited monthly, with a written dispute letter for each finding.”',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'route',
        anchorValue: '/pricing',
        askIndex: 0,
        upvotes: 13,
      },
    ],
    inboxState: 'triaged',
    votes: 11,
  },
  {
    key: 'mw-lena-1',
    project: 'meterwise',
    reviewer: 'lenahavel',
    versionLabel: 'Prototype 4',
    headline: 'Upload failed silently on a scanned PDF',
    timeSpentMinutes: 15,
    environment: { os: 'Linux, Fedora 41', device: 'Desktop', browser: 'Firefox 132', build: 'Prototype 4' },
    daysAgo: 16,
    ratings: { problem_sharpness: 4, insight: 4, willingness_to_pay: 3, path_to_100: 3, risk_honesty: 4 },
    points: [
      {
        category: 'bug',
        body: 'A scanned bill, which is what most small buildings have, uploads and then produces an empty report with no explanation.',
        severity: 'major',
        actionability: 'repro',
        sentiment: -1,
        repro: {
          steps: '1. Upload a scanned PDF with no text layer. 2. Wait for processing to finish.',
          result: 'The report renders with zero findings and no message. It looks identical to a clean bill with nothing wrong.',
          expected:
            'It says it could not read the document and offers a path. A clean bill and an unreadable bill must not look the same, because one of them is a lie.',
          frequency: 'always',
        },
        upvotes: 17,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 15,
  },

  /* ----------------------------- Kestrel Deck ---------------------------- */
  {
    key: 'kd-greta-1',
    project: 'kestrel-deck',
    reviewer: 'gretalind',
    versionLabel: 'DVT 2',
    headline: 'Ten days in a bag: the hinge is fine, the bag is not',
    summary:
      'Ten days carrying it daily, four flights, one bike commute in rain. You asked what I do with it when I am not typing, so this is mostly about that. The hinge is not what will fail. The corner of the left half is.',
    timeSpentMinutes: 214,
    environment: { device: 'Kestrel DVT 2', usage: '10 days, daily carry' },
    daysAgo: 5,
    origin: 'bounty',
    bounty: 'b-kestrel-qa',
    ratings: { problem_form_fit: 5, ergonomics: 4, build_durability: 3, manufacturability: 4, daily_use: 4 },
    points: [
      {
        category: 'mechanism',
        body:
          'I fold it one handed about six times a day, always the same way: thumb on the right half, swing the left one up. That is an off-axis load on the hinge every single time, and it is nothing like the cycle test. After ten days there is about a millimetre of lateral play that was not there on day one.\n\nTwenty thousand cycles on axis is not the number. The number you need is how many off-axis folds it survives, and I would guess most owners will do exactly what I do because the device invites it.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'hinge-off-axis',
        upvotes: 23,
      },
      {
        category: 'materials',
        body:
          'The anodising on the front left corner has worn through to bare aluminium. That is the corner that sits against the zip in my bag. Ten days.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        askIndex: 1,
        upvotes: 14,
      },
      {
        category: 'delight',
        body: 'It survived the rain commute with no ingress at all and I did not baby it. Whatever you did around the seam is working.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        askIndex: 0,
        upvotes: 8,
      },
    ],
    replies: [
      {
        author: 'marcusweill',
        body:
          'The off-axis point is worth the fee on its own. I have been testing the thing the way it was designed to be used rather than the way it will be used, which is the oldest mistake there is. Adding an off-axis fixture this week.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'actioned',
    votes: 24,
  },
  {
    key: 'kd-suvi-1',
    project: 'kestrel-deck',
    reviewer: 'suvikallio',
    versionLabel: 'DVT 2',
    headline: 'Firmware pairing needs a display it does not have',
    timeSpentMinutes: 96,
    environment: { device: 'Kestrel DVT 2', os: 'Linux and Android' },
    daysAgo: 9,
    ratings: { problem_form_fit: 4, ergonomics: 4, build_durability: 4, manufacturability: 4, daily_use: 3 },
    points: [
      {
        category: 'connectivity',
        body:
          'Pairing to a second device requires holding a key combination for five seconds, and the only feedback is one LED that blinks the same way for pairing, low battery and firmware update. I got it wrong three times before I read the manual on my phone.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        repro: {
          steps:
            '1. Pair the deck with one computer. 2. Hold the pairing combination for five seconds to add a phone. 3. Watch the status LED.',
          result: 'The LED blinks slowly, exactly as it does for low battery and during a firmware update.',
          expected: 'A pattern that belongs to pairing alone, so the one light can say which of the three is happening.',
          frequency: 'always',
        },
        upvotes: 12,
      },
      {
        category: 'power',
        body:
          'Forty two days claimed. I got thirty one with backlight on at the lowest setting, which is still very good, but if the number on the box is forty two somebody will feel lied to.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: 0,
        upvotes: 9,
      },
    ],
    inboxState: 'triaged',
    votes: 11,
  },
  {
    key: 'kd-dan-1',
    project: 'kestrel-deck',
    reviewer: 'danyero',
    versionLabel: 'DVT 2',
    headline: 'I throw it in a bag with a laptop and no sleeve, like everybody will',
    timeSpentMinutes: 68,
    environment: { device: 'Kestrel DVT 2', usage: '6 days' },
    daysAgo: 13,
    ratings: { problem_form_fit: 5, ergonomics: 4, build_durability: 3, manufacturability: 4, daily_use: 4 },
    points: [
      {
        category: 'mechanism',
        body:
          'Between typing sessions it goes in a bag, folded, pressed against a laptop. The halves rub. There are already fine scratches on the inner faces of the keys after six days, from each other.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        askIndex: 0,
        theme: 'hinge-off-axis',
        upvotes: 13,
      },
      {
        category: 'industrial_design',
        body:
          'Before you told me the price I would have guessed two hundred. The weight is what does it. It feels like a more expensive object than it looks like.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        askIndex: 1,
        upvotes: 10,
      },
    ],
    replies: [
      {
        author: 'marcusweill',
        body:
          'The keys on the two halves meet when it folds, and I had only ever carried it in a sleeve. A raised lip on the frame keeps the keycaps apart. It costs a millimetre of thickness and I think it is worth it. Thank you for the price guess, too.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 12,
  },
  {
    key: 'kd-joonho-1',
    project: 'kestrel-deck',
    reviewer: 'joonhobaek',
    versionLabel: 'DVT 2',
    headline: 'It lives folded on a desk, standing up, and it does not like that',
    timeSpentMinutes: 54,
    environment: { device: 'Kestrel DVT 2', usage: '8 days' },
    daysAgo: 16,
    ratings: { problem_form_fit: 4, ergonomics: 5, build_durability: 4, manufacturability: 4, daily_use: 4 },
    points: [
      {
        category: 'mechanism',
        body:
          'When I am not typing I stand it on edge next to the monitor, because folded it looks like a book and books stand up. It falls over about once a day. The detent holds the fold but nothing holds it upright, and I suspect a lot of people will do what I do.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: 0,
        askIndex: 0,
        theme: 'hinge-off-axis',
        upvotes: 11,
      },
    ],
    replies: [
      {
        author: 'marcusweill',
        body:
          'Standing it on edge like a book is something two of the eight testers do, and I had never thought of it as a use. A flat on the hinge side so it stands up is going into the next frame.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 9,
  },
  {
    key: 'kd-vikram-1',
    project: 'kestrel-deck',
    reviewer: 'vikramsahni',
    versionLabel: 'DVT 2',
    headline: 'Thumb cluster is one key too far at the outer edge',
    timeSpentMinutes: 72,
    environment: { device: 'Kestrel DVT 2', usage: '5 days' },
    daysAgo: 20,
    ratings: { problem_form_fit: 4, ergonomics: 3, build_durability: 4, manufacturability: 4, daily_use: 4 },
    points: [
      {
        category: 'ergonomics',
        body:
          'Three keys in the thumb cluster and I can comfortably reach two. The outer one needs a wrist rotation that I stopped doing on day two, so I remapped it to something I never press. Small hands will lose that key entirely.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        theme: 'thumb-cluster-reach',
        upvotes: 15,
      },
    ],
    replies: [
      {
        author: 'marcusweill',
        body:
          'Two of three is not good enough for a cluster that only has three keys. The outer key moves in by four millimetres on the next frame revision, and I am testing it with the smallest hands I can borrow.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 13,
  },
  {
    key: 'kd-hana-1',
    project: 'kestrel-deck',
    reviewer: 'hanakuro',
    versionLabel: 'EVT 4',
    headline: 'The legends are lovely and will be gone in a year',
    timeSpentMinutes: 41,
    environment: { device: 'Kestrel EVT 4', usage: '4 days' },
    daysAgo: 24,
    ratings: { problem_form_fit: 4, ergonomics: 4, build_durability: 3, manufacturability: 4, daily_use: 4 },
    points: [
      {
        category: 'materials',
        body:
          'The key legends are printed rather than moulded, and on E, A and the spacebar there is already a faint shine after four days. At this price people keep these for five years and will notice the day the E goes.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 1,
        upvotes: 16,
      },
    ],
    replies: [
      {
        author: 'marcusweill',
        body:
          'Four days to a shine on the E is faster than anything I saw in testing. Double shot legends cost more per board, and that trade is on the roadmap now.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 14,
  },
  {
    key: 'kd-ruitavares-1',
    project: 'kestrel-deck',
    reviewer: 'ruitavares',
    versionLabel: 'EVT 4',
    headline: 'The configurator writes a file I cannot version control',
    timeSpentMinutes: 63,
    environment: { device: 'Kestrel EVT 4', os: 'macOS 15.2' },
    daysAgo: 27,
    ratings: { problem_form_fit: 4, ergonomics: 4, build_durability: 4, manufacturability: 4, daily_use: 3 },
    points: [
      {
        category: 'connectivity',
        body:
          'The layout is stored as a binary blob in the companion app. I want my keymap in a repository, as text, because I have three machines and a habit. Every keyboard in this category that gets adopted by developers exports a readable file.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Companion app, saved layouts',
        upvotes: 13,
      },
    ],
    replies: [
      {
        author: 'marcusweill',
        body:
          'A keymap you cannot put in a repository is a keymap you cannot trust, and I use three machines myself. A readable text export is on the roadmap.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 11,
  },
  {
    key: 'kd-aleksy-1',
    project: 'kestrel-deck',
    reviewer: 'aleksynowak',
    versionLabel: 'DVT 2',
    headline: 'Hinge detent was too strong on EVT 4 and is right on DVT 2',
    timeSpentMinutes: 38,
    environment: { device: 'Kestrel EVT 4 and DVT 2' },
    daysAgo: 18,
    ratings: { problem_form_fit: 4, ergonomics: 4, build_durability: 4, manufacturability: 4, daily_use: 4 },
    points: [
      {
        category: 'mechanism',
        body: 'For the record, since I complained about it last time: the softer detent is correct. I can open it one handed now without the whole thing jumping.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        askIndex: 0,
        upvotes: 7,
      },
    ],
    inboxState: 'archived',
    votes: 6,
  },
  {
    key: 'kd-emmett-1',
    project: 'kestrel-deck',
    reviewer: 'emmettquill',
    versionLabel: 'EVT 4',
    headline: 'Looks great, want one',
    timeSpentMinutes: 3,
    environment: { device: 'Photos only' },
    daysAgo: 30,
    ratings: { problem_form_fit: 5, ergonomics: 4, build_durability: 4, manufacturability: 3, daily_use: 4 },
    points: [
      {
        category: 'industrial_design',
        body: 'From the photos it looks really well made. I would buy this.',
        severity: 'praise',
        actionability: 'opinion',
        sentiment: 1,
        askIndex: 1,
      },
    ],
    inboxState: 'read',
    votes: 1,
  },

  /* ---------------------------- Ember Lantern ---------------------------- */
  {
    key: 'el-marcus-1',
    project: 'ember-lantern',
    reviewer: 'marcusweill',
    versionLabel: 'Proto 12',
    headline: 'Three detents is right. The dial is in the wrong place.',
    summary:
      'Two nights out with it, one of them cold enough to matter. I never wanted a percentage. What I wanted twice was to know whether it was on at all, from inside a sleeping bag, without sitting up.',
    timeSpentMinutes: 142,
    environment: { device: 'Ember Proto 12', usage: 'Two nights, minus 6 and minus 14' },
    daysAgo: 6,
    ratings: { problem_form_fit: 5, ergonomics: 3, build_durability: 5, manufacturability: 4, daily_use: 4 },
    points: [
      {
        category: 'power',
        body:
          'You are right that nobody needs a percentage. I never once wanted the number. What I wanted was confidence that the next detent had more left in it, which is a different question and a much easier one. A detent that feels different at low charge would answer it without a screen.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: 0,
        askIndex: 0,
        theme: 'dial-not-display',
        upvotes: 18,
      },
      {
        category: 'ergonomics',
        body:
          'The dial is on the base. In a tent the lantern hangs from the ridge line, so the dial is above my head and facing away. I had to unhook it to change the setting, twice, in the cold, in the dark. That is the whole daily use problem in one sentence.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        upvotes: 21,
      },
    ],
    replies: [
      {
        author: 'suvikallio',
        body:
          'The hanging orientation is the thing I have been blind to because I test it on a table. The dial is moving to the collar so it works in both orientations. That is a real redesign and I would rather do it now.',
        daysAfter: 2,
        pointIndex: 1,
      },
    ],
    inboxState: 'actioned',
    votes: 20,
  },
  {
    key: 'el-greta-1',
    project: 'ember-lantern',
    reviewer: 'gretalind',
    versionLabel: 'Proto 12',
    headline: 'Cold start works. The hook does not.',
    timeSpentMinutes: 88,
    environment: { device: 'Ember Proto 12', usage: 'One night, minus 11' },
    daysAgo: 10,
    ratings: { problem_form_fit: 5, ergonomics: 3, build_durability: 4, manufacturability: 4, daily_use: 3 },
    points: [
      {
        category: 'bug',
        body: 'The hook rotates freely under load and the lantern spins slowly all night if there is any air movement.',
        severity: 'major',
        actionability: 'repro',
        sentiment: -1,
        repro: {
          steps: '1. Hang the lantern from a ridge line by the hook. 2. Leave it for an hour with a vent open.',
          result: 'It rotates continuously, about one turn a minute, and the light sweeps around the tent.',
          expected: 'It hangs still. The hook has a detent in the photos on the site, which is where the expectation came from.',
          frequency: 'always',
        },
        upvotes: 14,
      },
      {
        category: 'power',
        body: 'Cold start at minus eleven after a night outside: first press, on, no hesitation. That is the promise and it kept it.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        askIndex: 0,
        upvotes: 11,
      },
    ],
    replies: [
      {
        author: 'suvikallio',
        body:
          'The hook was reinforced for strength and I never thought about rotation. A stop on the swivel costs almost nothing and goes into the next batch.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 15,
  },
  {
    key: 'el-tayo-1',
    project: 'ember-lantern',
    reviewer: 'tayobalogun',
    versionLabel: 'Proto 12',
    headline: 'Could not find the middle detent in gloves',
    timeSpentMinutes: 51,
    environment: { device: 'Ember Proto 12', usage: 'One night, minus 2' },
    daysAgo: 15,
    ratings: { problem_form_fit: 4, ergonomics: 2, build_durability: 4, manufacturability: 4, daily_use: 3 },
    points: [
      {
        category: 'ergonomics',
        body:
          'With thick gloves I could feel the ends of the dial but not the middle stop. I overshot it every time and ended up on full, which then ruined my night vision. Making the middle detent physically deeper than the others would solve it.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'dial-not-display',
        upvotes: 15,
      },
    ],
    replies: [
      {
        author: 'suvikallio',
        body:
          'Proto 12 raised the force on every detent, which is the wrong fix for what you found. The middle stop has to feel different from the ends, not just firmer. Trying a deeper notch for the middle only.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 12,
  },
  {
    key: 'el-omar-1',
    project: 'ember-lantern',
    reviewer: 'omarhaddad',
    versionLabel: 'Proto 12',
    headline: 'I use these in a tunnel, not a tent, and the magnet is missing',
    timeSpentMinutes: 44,
    environment: { device: 'Ember Proto 12', usage: 'Four evenings in polytunnels' },
    daysAgo: 19,
    ratings: { problem_form_fit: 4, ergonomics: 3, build_durability: 5, manufacturability: 4, daily_use: 3 },
    points: [
      {
        category: 'missing',
        body:
          'Every work light I own has a magnet on the base because there is always a steel hoop or a frame to stick it to. I ended up balancing this on a crate. I know camping is the market, but the magnet costs almost nothing and opens a second one.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: 0,
        upvotes: 10,
      },
    ],
    inboxState: 'triaged',
    votes: 8,
  },
  {
    key: 'el-aleksy-1',
    project: 'ember-lantern',
    reviewer: 'aleksynowak',
    versionLabel: 'Proto 9',
    headline: 'Eleven hours claimed, I measured nine and a half at the middle setting',
    timeSpentMinutes: 62,
    environment: { device: 'Ember Proto 9', usage: 'Bench test at minus 5' },
    daysAgo: 23,
    ratings: { problem_form_fit: 4, ergonomics: 4, build_durability: 4, manufacturability: 4, daily_use: 4 },
    points: [
      {
        category: 'power',
        body:
          'Two runs from full at the middle setting, ambient minus five: nine hours forty and nine hours twenty five. Your page says eleven. Either the page is at room temperature, in which case say so, or something changed since you measured.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        upvotes: 13,
      },
    ],
    replies: [
      {
        author: 'suvikallio',
        body:
          'Eleven hours is at room temperature and the page does not say so, which is the part I am embarrassed about. The pre-warm in the next prototype spends battery below minus five, so the cold figure will go on the page next to the warm one.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 11,
  },
  {
    key: 'el-hugo-1',
    project: 'ember-lantern',
    reviewer: 'hugobitt',
    versionLabel: 'Proto 9',
    headline: 'Looks good, cannot test the cold part in Lisbon',
    timeSpentMinutes: 22,
    environment: { device: 'Ember Proto 9', usage: 'Two evenings, mild' },
    daysAgo: 26,
    ratings: { problem_form_fit: 4, ergonomics: 4, build_durability: 4, manufacturability: 3, daily_use: 4 },
    points: [
      {
        category: 'industrial_design',
        body: 'It is a nice object and the light is soft. I cannot say anything useful about the cold because it does not get cold here.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
      },
    ],
    inboxState: 'read',
    votes: 3,
  },
  /* -------------------------- Coastline Rebrand -------------------------- */
  {
    key: 'cr-joonho-1',
    project: 'coastline-rebrand',
    reviewer: 'joonhobaek',
    versionLabel: 'Applied draft 4',
    headline: 'I read the destination first, then the time',
    summary:
      'Printed the board proof at 40 pt, put it at four metres, dimmed the room. Read it six times over two days so I would not just be reporting my first guess. It is the destination first, every time, and I think I know why.',
    timeSpentMinutes: 47,
    environment: { device: 'Printed at A2, 4 m, low light', build: 'Applied draft 4' },
    daysAgo: 4,
    ratings: { concept_strength: 4, hierarchy: 3, craft: 5, tone_fit: 5, systemic_durability: 4 },
    points: [
      {
        category: 'composition',
        body:
          'The destination is set in the condensed width, which makes it darker on the page than the time even though the time is larger. At four metres in poor light, value beats size. You have promoted the time in point size and demoted it in colour weight at the same moment.\n\nEither set the time in the same condensed width, or drop the destination to a regular width and let size do its job.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'time-loses-to-destination',
        upvotes: 22,
      },
    ],
    replies: [
      {
        author: 'hanakuro',
        body:
          'Value beating size at distance is correct and it is exactly the mistake I would have caught in somebody else’s work. The time goes condensed in the next pass.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 21,
  },
  {
    key: 'cr-beatrice-1',
    project: 'coastline-rebrand',
    reviewer: 'beatricer',
    versionLabel: 'Applied draft 4',
    headline: 'Destination first, and the platform number is invisible',
    timeSpentMinutes: 33,
    environment: { device: 'Screen at 4 m, dimmed', build: 'Applied draft 4' },
    daysAgo: 7,
    ratings: { concept_strength: 4, hierarchy: 2, craft: 5, tone_fit: 5, systemic_durability: 4 },
    points: [
      {
        category: 'composition',
        body: 'Destination, then time, then nothing. I did not see the platform number at all until I walked to two metres.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        askIndex: 0,
        theme: 'time-loses-to-destination',
        upvotes: 14,
      },
      {
        category: 'color',
        body:
          'The delay state is a colour change on the time and nothing else. In rain, at distance, on a board that is already grey, a late departure and an on-time one look identical. It needs a shape or a word as well.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Terminal board, delay state',
        upvotes: 17,
      },
    ],
    inboxState: 'actioned',
    votes: 16,
  },
  {
    key: 'cr-nkechi-1',
    project: 'coastline-rebrand',
    reviewer: 'nkechiobi',
    versionLabel: 'Applied draft 4',
    headline: 'The delay colour fails contrast, and the app header inherits it',
    timeSpentMinutes: 39,
    environment: { device: 'Desktop and phone', build: 'Applied draft 4' },
    daysAgo: 11,
    ratings: { concept_strength: 4, hierarchy: 3, craft: 4, tone_fit: 5, systemic_durability: 3 },
    points: [
      {
        category: 'color',
        body:
          'The amber for delays measures 2.6 to 1 against the board background. On a physical board in daylight that is borderline; in the app header, where the same pairing is reused at 14 px, it fails outright. The board and the screen need different values even though they are the same brand colour.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'App header',
        upvotes: 16,
      },
    ],
    replies: [
      {
        author: 'hanakuro',
        body:
          'Two point six to one is worse than I measured, because I measured on the screen proof and not the printed board. The board and the app get separate values for the same colour, and the delay state gets a word as well as a colour.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    inboxState: 'actioned',
    votes: 14,
  },
  {
    key: 'cr-fenella-1',
    project: 'coastline-rebrand',
    reviewer: 'fenelladoyle',
    versionLabel: 'Applied draft 2',
    headline: 'Cancelled and Not sailing are both on the same board',
    timeSpentMinutes: 26,
    environment: { device: 'Desktop', build: 'Applied draft 2' },
    daysAgo: 15,
    ratings: { concept_strength: 4, hierarchy: 3, craft: 5, tone_fit: 4, systemic_durability: 4 },
    points: [
      {
        category: 'copy',
        body:
          'Two states mean the same thing to a passenger and they are worded differently in two places. Pick one. I would pick “Not sailing” because it says what the boat is doing rather than what the company has decided.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'screen',
        anchorValue: 'Terminal board',
        upvotes: 13,
      },
    ],
    replies: [
      {
        author: 'hanakuro',
        body:
          'Not sailing, everywhere. The two came from two teams’ old boards, which is exactly how a system ends up saying one thing two ways.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 11,
  },
  {
    key: 'cr-casper-1',
    project: 'coastline-rebrand',
    reviewer: 'casperlq',
    versionLabel: 'Applied draft 2',
    headline: 'The livery reads at distance. The name does not.',
    timeSpentMinutes: 21,
    environment: { device: 'Desktop, images at full size', build: 'Applied draft 2' },
    daysAgo: 19,
    ratings: { concept_strength: 5, hierarchy: 4, craft: 5, tone_fit: 5, systemic_durability: 4 },
    points: [
      {
        category: 'brand_tone',
        body:
          'The hull band is unmistakable at two hundred metres and I could pick it out of a harbour immediately. The wordmark on the bow disappears at about eighty. If the band is the identity, and I think it is, then the wordmark can be smaller and you lose nothing.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: 1,
        askIndex: 1,
        upvotes: 12,
      },
    ],
    replies: [
      {
        author: 'hanakuro',
        body:
          'The band is the identity and the wordmark is a habit carried over from the old livery. Smaller on the bow, and full size on the terminals, where people actually read it.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 10,
  },
  {
    key: 'cr-emmett-1',
    project: 'coastline-rebrand',
    reviewer: 'emmettquill',
    versionLabel: 'Applied draft 2',
    headline: 'Very clean',
    timeSpentMinutes: 4,
    environment: { device: 'Laptop', build: 'Applied draft 2' },
    daysAgo: 22,
    ratings: { concept_strength: 5, hierarchy: 4, craft: 5, tone_fit: 5, systemic_durability: 4 },
    points: [
      {
        category: 'composition',
        body: 'Looks very clean and professional. I read the time first I think.',
        severity: 'praise',
        actionability: 'opinion',
        sentiment: 1,
        askIndex: 0,
      },
    ],
    inboxState: 'read',
    votes: 1,
  },

  /* ------------------------------ Understudy ----------------------------- */
  {
    key: 'us-lena-1',
    project: 'understudy',
    reviewer: 'lenahavel',
    versionLabel: '2.1.0',
    headline: 'Three switches on: the table holds, the toolbar above it does not',
    summary:
      'Screenshot attached in the thread. The table itself survives everything you asked me to throw at it. The thing that broke is the toolbar, which is not in your component list but is in every screenshot on your docs site.',
    timeSpentMinutes: 38,
    environment: { os: 'Linux, Fedora 41', browser: 'Firefox 132', build: '2.1.0' },
    daysAgo: 3,
    ratings: { concept_strength: 5, hierarchy: 4, craft: 5, tone_fit: 4, systemic_durability: 4 },
    points: [
      {
        category: 'states',
        body:
          'Forty character name, empty state and failed request all at once: the table renders correctly, truncates properly, and the error row is announced. Genuinely impressive.\n\nThe toolbar above it collapses. The filter chips wrap to a third line and push the table below the fold, and the error banner then renders under the toolbar rather than over it, so on a laptop screen you see a wrapped mess of chips and no error at all.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'selector',
        anchorValue: '.us-toolbar',
        askIndex: 0,
        theme: 'toolbar-not-table',
        upvotes: 19,
      },
    ],
    replies: [
      {
        author: 'joonhobaek',
        body:
          'The toolbar is not a component, it is an example, and it is in every screenshot, which means it is a component and I have been lying to myself. It gets specified in 2.2.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 18,
  },
  {
    key: 'us-nkechi-1',
    project: 'understudy',
    reviewer: 'nkechiobi',
    versionLabel: '2.1.0',
    headline: 'The empty state is announced twice',
    timeSpentMinutes: 34,
    environment: { os: 'Windows 11', browser: 'Chrome 131', build: '2.1.0', assistive: 'NVDA 2024.4' },
    daysAgo: 6,
    ratings: { concept_strength: 5, hierarchy: 4, craft: 4, tone_fit: 4, systemic_durability: 4 },
    points: [
      {
        category: 'states',
        body:
          'The empty state has both an aria-live region and a role of status on the same node, so NVDA reads it twice, back to back. Small, and very annoying if you hit it on every filter change.',
        severity: 'minor',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'selector',
        anchorValue: '.us-empty[role="status"]',
        upvotes: 11,
      },
      {
        category: 'delight',
        body:
          'Every component shipping its error and empty states in the same file is the correct decision and almost nobody does it. It is the reason I would adopt this over three better funded alternatives.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        upvotes: 14,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 16,
  },
  {
    key: 'us-hana-1',
    project: 'understudy',
    reviewer: 'hanakuro',
    versionLabel: '2.1.0',
    headline: 'The type scale has two steps that are three quarters of a pixel apart',
    timeSpentMinutes: 29,
    environment: { browser: 'Safari 18', build: '2.1.0' },
    daysAgo: 10,
    ratings: { concept_strength: 5, hierarchy: 3, craft: 3, tone_fit: 4, systemic_durability: 5 },
    points: [
      {
        category: 'typography',
        body:
          'Steps four and five in your scale are 20.25 and 21 px. Nobody can see that difference, so in practice you have one step with two names, and two teams will pick different ones for the same job. Collapse them.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'route',
        anchorValue: '/playground/type',
        upvotes: 15,
      },
    ],
    inboxState: 'triaged',
    votes: 13,
  },
  {
    key: 'us-rui-1',
    project: 'understudy',
    reviewer: 'ruitavares',
    versionLabel: '2.1.0',
    headline: 'Tree shaking pulls the whole icon set in',
    timeSpentMinutes: 44,
    environment: { os: 'macOS 15.2', build: '2.1.0', tooling: 'Vite 6' },
    daysAgo: 14,
    ratings: { concept_strength: 5, hierarchy: 4, craft: 4, tone_fit: 4, systemic_durability: 4 },
    points: [
      {
        category: 'bug',
        body: 'Importing one component pulls the entire icon set into the bundle, about 180 kB before compression.',
        severity: 'major',
        actionability: 'repro',
        sentiment: -1,
        repro: {
          steps: '1. New Vite project. 2. Import only the Table component. 3. Build and inspect the bundle.',
          result: 'Every icon in the set is present in the output. Bundle is 214 kB where the docs claim 34 kB.',
          expected: 'Only the icons the Table uses. The side effects field in package.json is missing, which I think is the cause.',
          frequency: 'always',
        },
        upvotes: 17,
      },
    ],
    replies: [
      {
        author: 'joonhobaek',
        body: 'Missing sideEffects field, confirmed. That is a one line fix and it has been wrong since the first release.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 15,
  },
  {
    key: 'us-priya-1',
    project: 'understudy',
    reviewer: 'priyaram',
    versionLabel: '2.1.0',
    headline: 'Adopted two components in an afternoon, and the third needed a rewrite of my form layer',
    timeSpentMinutes: 156,
    environment: { browser: 'Chrome 131', build: '2.1.0' },
    daysAgo: 18,
    ratings: { concept_strength: 5, hierarchy: 4, craft: 4, tone_fit: 4, systemic_durability: 3 },
    points: [
      {
        category: 'states',
        body:
          'Table and Empty dropped straight in. The form field assumes it owns its own label and error rendering, which means adopting it requires giving up whatever form library you already use. That is a big ask and it is not mentioned anywhere in the docs.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        anchorKind: 'selector',
        anchorValue: '.us-field',
        upvotes: 13,
      },
    ],
    inboxState: 'triaged',
    votes: 11,
  },
  {
    key: 'us-tobi-1',
    project: 'understudy',
    reviewer: 'tobiadeyemi',
    versionLabel: '2.1.0',
    headline: 'The docs bury the thing that makes this different',
    timeSpentMinutes: 26,
    environment: { browser: 'Safari 18', build: '2.1.0' },
    daysAgo: 22,
    ratings: { concept_strength: 5, hierarchy: 3, craft: 4, tone_fit: 4, systemic_durability: 5 },
    points: [
      {
        category: 'concept',
        body:
          'The idea, that every component is specified against hostile content, is on the fourth tab of each component page, under Edge cases. It should be the first thing on the home page and the first tab on every component. Right now your docs look like every other component set and the thing that is actually different is hidden.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: 0,
        anchorKind: 'route',
        anchorValue: '/components/table',
        upvotes: 16,
      },
    ],
    inboxState: 'triaged',
    votes: 14,
  },
  {
    key: 'us-emmett-1',
    project: 'understudy',
    reviewer: 'emmettquill',
    versionLabel: '2.1.0',
    headline: 'Could not get the playground to load',
    timeSpentMinutes: 7,
    environment: { browser: 'Chrome 131', os: 'Windows 10', build: '2.1.0' },
    daysAgo: 25,
    ratings: { concept_strength: 4, hierarchy: 3, craft: 4, tone_fit: 4, systemic_durability: 3 },
    points: [
      {
        category: 'bug',
        body: 'The playground page was blank for me. Maybe my extensions, I did not investigate.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: -1,
      },
    ],
    replies: [
      {
        author: 'joonhobaek',
        body:
          'If you get a moment, could you open the console and tell me what the first error says? Blank page with no error on my side usually means a blocked worker.',
        daysAfter: 3,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 2,
  },

  /* ----------------------------- The Salt Line --------------------------- */
  {
    key: 'sl-elowen-1',
    project: 'the-salt-line',
    reviewer: 'elowenprice',
    versionLabel: 'Draft 11',
    headline: 'Stopped at the solicitor’s second speech, and I can tell you exactly why',
    summary:
      'Read it twice. The opening is strong and the harbour walk is the best writing in the chapter. I stopped, both times, in the same place, at the solicitor.',
    timeSpentMinutes: 42,
    environment: { device: 'Print out' },
    daysAgo: 4,
    ratings: { opening_pull: 4, structure: 3, line_quality: 5, reader_clarity: 4, ending: 3 },
    points: [
      {
        category: 'opening',
        body:
          'The sentence I stopped on: “He explained the terms again, more slowly, as though slowness were a kind of mercy.” It is a good line. The problem is that it is the fourth consecutive paragraph in which somebody explains something to her, and by then I had stopped being in the room and started being in a meeting.\n\nWhat is happening in my head at that point is that I want her to do something. Anything. She has been receiving information for two pages.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'passive-protagonist',
        upvotes: 17,
      },
      {
        category: 'line_edit',
        body:
          'The sentence I would steal: “The harbour had the particular silence of a place that used to be loud.” That is the whole book in eleven words and it is on page three where nobody will find it.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        upvotes: 14,
      },
    ],
    replies: [
      {
        author: 'petranilsen',
        body:
          'Four consecutive paragraphs of being told things. I have read this chapter two hundred times and never counted them. That is the note.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'actioned',
    votes: 16,
  },
  {
    key: 'sl-fenella-1',
    project: 'the-salt-line',
    reviewer: 'fenelladoyle',
    versionLabel: 'Draft 11',
    headline: 'Stopped on the same page, for a different reason',
    timeSpentMinutes: 36,
    environment: { device: 'Screen' },
    daysAgo: 8,
    ratings: { opening_pull: 4, structure: 3, line_quality: 4, reader_clarity: 3, ending: 3 },
    points: [
      {
        category: 'jargon',
        body:
          'I stopped at “the deeds were subject to a charge”. I do not know what that means in Swedish or English property law, and the chapter assumes I do. Three sentences later there is another one. A reader who does not know is now guessing at the stakes of the whole book.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'passive-protagonist',
        upvotes: 12,
      },
      {
        category: 'line_edit',
        body:
          'Yours: “She did not say anything for a long moment.” Mine: “She did not say anything.” What changed: the long moment is doing nothing that the silence was not already doing, and you use this construction four times in four thousand words.',
        severity: 'nit',
        actionability: 'actionable',
        sentiment: 0,
        upvotes: 9,
      },
    ],
    replies: [
      {
        author: 'petranilsen',
        body:
          'A charge on the deeds means the building is security for somebody else’s loan, which is the whole plot, and I never say so in plain words. Both of those sentences are getting a plain version, and the long moments are going.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'actioned',
    votes: 12,
  },
  {
    key: 'sl-casper-1',
    project: 'the-salt-line',
    reviewer: 'casperlq',
    versionLabel: 'Draft 9',
    headline: 'Read to the end without stopping, which surprised me',
    timeSpentMinutes: 28,
    environment: { device: 'Screen' },
    daysAgo: 12,
    ratings: { opening_pull: 5, structure: 4, line_quality: 5, reader_clarity: 4, ending: 4 },
    points: [
      {
        category: 'structure',
        body:
          'I read it straight through. If I had to name a soft spot it is the solicitor, but I did not stop there, I sped up. Reading faster and stopping are different failures and I am not sure they have the same fix.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: 0,
        askIndex: 0,
        theme: 'passive-protagonist',
        upvotes: 11,
      },
    ],
    replies: [
      {
        author: 'petranilsen',
        body:
          'Speeding up and stopping being different failures is going to stay with me. The solicitor gets shorter either way.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    inboxState: 'triaged',
    votes: 9,
  },
  {
    key: 'sl-hana-1',
    project: 'the-salt-line',
    reviewer: 'hanakuro',
    versionLabel: 'Draft 9',
    headline: 'Read it in translation in my head and the first line still worked',
    timeSpentMinutes: 24,
    environment: { device: 'Screen' },
    daysAgo: 17,
    ratings: { opening_pull: 5, structure: 3, line_quality: 4, reader_clarity: 3, ending: 3 },
    points: [
      {
        category: 'opening',
        body:
          'English is my third language and the opening paragraph was completely clear to me. The legal section was not, and I put that down to my English until I saw somebody else say the same thing.',
        severity: 'minor',
        actionability: 'observation',
        sentiment: 0,
        askIndex: 0,
        upvotes: 8,
      },
    ],
    inboxState: 'read',
    votes: 7,
  },
  {
    key: 'sl-imani-1',
    project: 'the-salt-line',
    reviewer: 'imanifrazier',
    versionLabel: 'Draft 9',
    headline: 'Stopped at the top of page two',
    timeSpentMinutes: 11,
    environment: { device: 'Phone' },
    daysAgo: 21,
    ratings: { opening_pull: 3, structure: 3, line_quality: 4, reader_clarity: 3, ending: 3 },
    points: [
      {
        category: 'opening',
        body:
          'Last sentence I read: “The bus took the coast road because there is no other road.” I liked it, and then the next paragraph went back in time and I lost the thread and did not pick it up again. On a phone, on a bus, that is where you lost me.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        askIndex: 0,
        upvotes: 10,
      },
    ],
    replies: [
      {
        author: 'petranilsen',
        body:
          'Page two going back in time is the problem three drafts have tried to hide. The next draft starts in the present and stays there until the harbour.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 8,
  },
  {
    key: 'sl-hugo-1',
    project: 'the-salt-line',
    reviewer: 'hugobitt',
    versionLabel: 'Draft 9',
    headline: 'Really good writing',
    timeSpentMinutes: 9,
    environment: { device: 'Laptop' },
    daysAgo: 24,
    ratings: { opening_pull: 5, structure: 4, line_quality: 5, reader_clarity: 4, ending: 4 },
    points: [
      {
        category: 'opening',
        body: 'I enjoyed it and did not want to stop. Sorry, that is not the answer you asked for.',
        severity: 'praise',
        actionability: 'opinion',
        sentiment: 1,
        askIndex: 0,
      },
    ],
    inboxState: 'read',
    votes: 3,
  },

  /* ----------------------- Nobody Reads the Manual ----------------------- */
  {
    key: 'nm-rui-1',
    project: 'nobody-reads-the-manual',
    reviewer: 'ruitavares',
    versionLabel: 'Outline 3',
    headline: 'Documentation fails because each sentence assumes you already know the answer',
    summary:
      'That is the argument in one sentence, and I could say it after section two, so the thing you are asking about works. Section four is where I lost it and I think section four is a different essay.',
    timeSpentMinutes: 31,
    environment: { device: 'Desktop' },
    daysAgo: 3,
    ratings: { opening_pull: 4, structure: 3, line_quality: 4, reader_clarity: 4, ending: 2 },
    points: [
      {
        category: 'structure',
        body:
          'Sections one to three are about sentences. Section four is about information architecture, which is the thing you spend the introduction arguing is not the problem. It reads as though you got nervous and hedged.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'section-four-hedges',
        upvotes: 14,
      },
      {
        category: 'argument',
        body:
          'The three real manuals are the best evidence in here and there are only three. I maintain two tools and I can send you six more examples of exactly the failure you are naming, if that is useful.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: 1,
        upvotes: 9,
      },
    ],
    replies: [
      {
        author: 'elowenprice',
        body: 'Section four is a hedge and you are the second person to name it as one. It is being cut. And yes, please send the six.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    inboxState: 'actioned',
    votes: 13,
  },
  {
    key: 'nm-fenella-1',
    project: 'nobody-reads-the-manual',
    reviewer: 'fenelladoyle',
    versionLabel: 'Outline 3',
    headline: 'I can say the argument. Section four made me doubt that I could.',
    timeSpentMinutes: 24,
    environment: { device: 'Desktop' },
    daysAgo: 5,
    ratings: { opening_pull: 5, structure: 3, line_quality: 5, reader_clarity: 4, ending: 3 },
    points: [
      {
        category: 'structure',
        body:
          'Manuals fail one sentence at a time, not one chapter at a time. That is the argument, and it is a good one. Section four then spends nine hundred words on navigation, which concedes the opposite. Cut it or turn it into the counterargument you are dismissing.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'section-four-hedges',
        upvotes: 13,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 11,
  },
  {
    key: 'nm-nkechi-1',
    project: 'nobody-reads-the-manual',
    reviewer: 'nkechiobi',
    versionLabel: 'Outline 2',
    headline: 'The argument holds and it has a missing half about who is reading',
    timeSpentMinutes: 27,
    environment: { device: 'Desktop' },
    daysAgo: 9,
    ratings: { opening_pull: 4, structure: 4, line_quality: 4, reader_clarity: 3, ending: 3 },
    points: [
      {
        category: 'argument',
        body:
          'Your argument, as I would say it back: manuals fail sentence by sentence, because each one assumes a reader who already knows the answer. It holds. But every example is a person reading with their eyes, at a desk, in English, unhurried. The sentence-level failure you are describing gets much worse when somebody is reading with a screen reader, or in a second language, or on a phone in a server room. That is not a different essay, it is the strongest version of yours.',
        severity: 'major',
        actionability: 'suggestion',
        sentiment: 0,
        askIndex: 0,
        upvotes: 15,
      },
    ],
    inboxState: 'triaged',
    votes: 13,
  },
  {
    key: 'nm-emmett-1',
    project: 'nobody-reads-the-manual',
    reviewer: 'emmettquill',
    versionLabel: 'Outline 2',
    headline: 'Agree with all of this',
    timeSpentMinutes: 5,
    environment: { device: 'Laptop' },
    daysAgo: 7,
    ratings: { opening_pull: 4, structure: 4, line_quality: 4, reader_clarity: 4, ending: 3 },
    points: [
      {
        category: 'argument',
        body: 'Documentation is bad, agreed. Good essay.',
        severity: 'praise',
        actionability: 'opinion',
        sentiment: 1,
        askIndex: 0,
      },
    ],
    inboxState: 'read',
    votes: 0,
  },

  /* ------------------------------ Ledgerline ----------------------------- */
  {
    key: 'lg-greta-1',
    project: 'ledgerline',
    reviewer: 'gretalind',
    versionLabel: '0.14.0-rc2',
    headline: 'Nineteen minutes, seven tabs, one error I had to search for',
    summary:
      'Clean Windows machine, timer running, no prior knowledge of the tool. Nineteen minutes to a working diff against two Postgres schemas. Your quickstart claims four. The gap is almost entirely one error message.',
    timeSpentMinutes: 41,
    environment: { os: 'Windows 11', build: '0.14.0-rc2', db: 'Postgres 16' },
    daysAgo: 3,
    ratings: {
      time_to_first_call: 3,
      ergonomics: 4,
      docs_quality: 3,
      debuggability: 2,
      production_readiness: 4,
    },
    points: [
      {
        category: 'error_messages',
        body:
          'Verbatim: `error: could not negotiate a connection (code 7)`. I thought it meant a network problem and spent eleven minutes on my firewall. It means the connection string has no sslmode and the server requires one. Those are very different problems and the message points at the wrong one.\n\nMine would be: `Connection refused: the server requires SSL. Add ?sslmode=require to your connection string.`',
        severity: 'blocker',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'error-code-7',
        upvotes: 22,
      },
      {
        category: 'install',
        body:
          'Seven tabs: the quickstart, the install page, two search results for code 7, a Postgres docs page about sslmode, your GitHub issues, and a blog post from somebody with the same problem in 2024. The blog post is what solved it.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        askIndex: 0,
        theme: 'error-code-7',
        upvotes: 15,
      },
    ],
    replies: [
      {
        author: 'ruitavares',
        body:
          'Code 7 is the oldest error in the tool and I have read it a thousand times without seeing it. Nineteen minutes against a claimed four is the number I needed. The message is rewritten and the quickstart now says sslmode in the first snippet.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 23,
  },
  {
    key: 'lg-lena-1',
    project: 'ledgerline',
    reviewer: 'lenahavel',
    versionLabel: '0.14.0-rc2',
    headline: 'Six minutes on macOS, and the lock annotation is the reason I would keep it',
    timeSpentMinutes: 34,
    environment: { os: 'macOS 15.2', build: '0.14.0-rc2', db: 'Postgres 16' },
    daysAgo: 6,
    ratings: {
      time_to_first_call: 5,
      ergonomics: 5,
      docs_quality: 4,
      debuggability: 4,
      production_readiness: 4,
    },
    points: [
      {
        category: 'quickstart',
        body:
          'Six minutes, two tabs, no errors, on a Mac with Homebrew. Your four minute claim is close enough on this path. The Windows path is clearly a different experience and the docs do not say so.',
        severity: 'minor',
        actionability: 'suggestion',
        sentiment: 1,
        askIndex: 0,
        upvotes: 11,
      },
      {
        category: 'docs',
        body:
          'The lock annotation is legible to me and I have never thought about lock modes in my life. “This statement blocks writes to orders for the duration” is a sentence anybody can act on. Keep that wording exactly.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        askIndex: 1,
        upvotes: 13,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 14,
  },
  {
    key: 'lg-aleksy-1',
    project: 'ledgerline',
    reviewer: 'aleksynowak',
    versionLabel: '0.13.4',
    headline: 'MySQL path silently ignores generated columns',
    timeSpentMinutes: 52,
    environment: { os: 'Linux, Debian 13', build: '0.13.4', db: 'MySQL 8.4' },
    daysAgo: 10,
    ratings: {
      time_to_first_call: 4,
      ergonomics: 4,
      docs_quality: 3,
      debuggability: 3,
      production_readiness: 3,
    },
    points: [
      {
        category: 'bug',
        body: 'Generated columns are absent from the diff entirely, in both directions, with no warning.',
        severity: 'major',
        actionability: 'repro',
        sentiment: -1,
        repro: {
          steps:
            '1. Create a MySQL 8.4 table with a stored generated column. 2. Drop that column in the second schema. 3. Diff the two.',
          result: 'The diff is empty. Exit code 0. The tool reports the schemas as identical.',
          expected:
            'Either the column appears in the diff or the tool says it does not support generated columns on MySQL. Reporting identical is the dangerous option.',
          frequency: 'always',
        },
        upvotes: 18,
      },
    ],
    replies: [
      {
        author: 'ruitavares',
        body:
          'Reporting identical when it cannot see something is the worst behaviour available and you are right to call it out. It now refuses and names what it could not read.',
        daysAfter: 2,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 17,
  },
  {
    key: 'lg-nkechi-1',
    project: 'ledgerline',
    reviewer: 'nkechiobi',
    versionLabel: '0.13.4',
    headline: 'Colour is the only thing separating a lock from a warning in the output',
    timeSpentMinutes: 26,
    environment: { os: 'Linux, Ubuntu 24.04', build: '0.13.4' },
    daysAgo: 15,
    ratings: {
      time_to_first_call: 4,
      ergonomics: 4,
      docs_quality: 4,
      debuggability: 3,
      production_readiness: 3,
    },
    points: [
      {
        category: 'error_messages',
        body:
          'In a terminal without colour, or for anybody who cannot separate red from amber, a blocking lock and a non blocking warning are the same line of text with a different tint. A one character prefix would fix it for everybody and would also survive being pasted into a chat window.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 1,
        upvotes: 16,
      },
    ],
    inboxState: 'actioned',
    votes: 14,
  },
  {
    key: 'lg-joonho-1',
    project: 'ledgerline',
    reviewer: 'joonhobaek',
    versionLabel: '0.13.4',
    headline: 'Fourteen minutes and I never found out where the config lives',
    timeSpentMinutes: 29,
    environment: { os: 'macOS 15.2', build: '0.13.4', db: 'Postgres 15' },
    daysAgo: 19,
    ratings: {
      time_to_first_call: 4,
      ergonomics: 3,
      docs_quality: 2,
      debuggability: 3,
      production_readiness: 4,
    },
    points: [
      {
        category: 'docs',
        body:
          'The docs mention a config file four times and never say where it goes. I guessed the working directory, which was wrong, and then found the answer in a GitHub issue. One line in the quickstart would do it.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'error-code-7',
        upvotes: 12,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'triaged',
    votes: 10,
  },
  {
    key: 'lg-dan-1',
    project: 'ledgerline',
    reviewer: 'danyero',
    versionLabel: '0.13.4',
    headline: 'The flag names disagree with each other',
    timeSpentMinutes: 22,
    environment: { os: 'Windows 11', build: '0.13.4' },
    daysAgo: 23,
    ratings: {
      time_to_first_call: 4,
      ergonomics: 2,
      docs_quality: 3,
      debuggability: 3,
      production_readiness: 4,
    },
    points: [
      {
        category: 'naming',
        body:
          'You have --from and --target, then --source-url and --dest-url, then --left and --right in the JSON output keys. Three vocabularies for two things. I got it wrong twice and diffed a schema against itself without noticing.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        upvotes: 15,
      },
    ],
    inboxState: 'actioned',
    votes: 13,
  },
  {
    key: 'lg-hugo-1',
    project: 'ledgerline',
    reviewer: 'hugobitt',
    versionLabel: '0.13.4',
    headline: 'Could not install it',
    timeSpentMinutes: 18,
    environment: { os: 'macOS 14.6', device: 'MacBook Air M1', build: '0.13.4' },
    daysAgo: 27,
    ratings: {
      time_to_first_call: 1,
      ergonomics: 3,
      docs_quality: 2,
      debuggability: 2,
      production_readiness: 3,
    },
    points: [
      {
        category: 'install',
        body: 'The install command failed and I could not work out why, so I gave up after about twenty minutes.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        askIndex: 0,
      },
    ],
    replies: [
      {
        author: 'ruitavares',
        body:
          'I would like to fix this rather than lose you. Could you paste the exact output of the install command? Even the first two lines would help.',
        daysAfter: 1,
        pointIndex: 0,
      },
      {
        author: 'hugobitt',
        body: 'It said no prebuilt binary for arm64 darwin and then tried to build from source and stopped at a missing compiler.',
        daysAfter: 2,
        parent: 0,
      },
      {
        author: 'ruitavares',
        body: 'That is a missing build in the release, not your machine. Apple silicon binaries are in the next tag. Thank you.',
        daysAfter: 2,
        parent: 1,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 6,
  },

  /* -------------------------------- Cairn -------------------------------- */
  {
    key: 'cn-rui-1',
    project: 'cairn',
    reviewer: 'ruitavares',
    versionLabel: '2.0.1',
    headline: 'Grouped output: fixed more, scrolled worse',
    summary:
      'Ran both versions on the same real project, two hundred and six findings. I fixed more with version 2, and I also spent longer looking for a specific finding I already knew about.',
    timeSpentMinutes: 68,
    environment: { os: 'macOS 15.2', build: '2.0.1', project: 'Internal dashboard, 40 routes' },
    daysAgo: 4,
    ratings: {
      time_to_first_call: 5,
      ergonomics: 4,
      docs_quality: 5,
      debuggability: 5,
      production_readiness: 4,
    },
    points: [
      {
        category: 'docs',
        body:
          'More, clearly. Grouping by criterion meant I fixed twelve label problems in one pass instead of hopping around a table. That is a real gain and I would not go back.\n\nThe cost is that when I know what I am looking for, the grouped view has no index. With the table I could search the output. Now I scroll through nine groups. A summary line per group at the top, with counts, would give me both.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: 1,
        askIndex: 0,
        theme: 'grouped-needs-index',
        upvotes: 18,
      },
    ],
    replies: [
      {
        author: 'nkechiobi',
        body: 'A summary index above the groups is the obvious answer and nobody had said it in those words. It is in 2.1.',
        daysAfter: 1,
        pointIndex: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 17,
  },
  {
    key: 'cn-lena-1',
    project: 'cairn',
    reviewer: 'lenahavel',
    versionLabel: '2.0.1',
    headline: 'I pinned version 1 and here is the one sentence reason',
    timeSpentMinutes: 37,
    environment: { os: 'Linux, Fedora 41', build: '2.0.1' },
    daysAgo: 8,
    ratings: {
      time_to_first_call: 5,
      ergonomics: 3,
      docs_quality: 4,
      debuggability: 4,
      production_readiness: 4,
    },
    points: [
      {
        category: 'pagination',
        body:
          'I pinned version 1 because my continuous integration step parses the table with a small script, and the grouped output broke it. That is my fault for parsing human output, and it is also what half your users are doing.',
        severity: 'major',
        actionability: 'actionable',
        sentiment: -1,
        askIndex: 0,
        theme: 'grouped-needs-index',
        upvotes: 16,
      },
    ],
    replies: [
      {
        author: 'nkechiobi',
        body:
          'The JSON output is stable in 2.0 and is the right thing for a pipeline. That is on me for not putting it at the top of the upgrade notes rather than at the bottom.',
        daysAfter: 2,
        pointIndex: 0,
      },
      {
        author: 'lenahavel',
        body: 'Switched to JSON, took four minutes. Unpinned.',
        daysAfter: 4,
        parent: 0,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 15,
  },
  {
    key: 'cn-joonho-1',
    project: 'cairn',
    reviewer: 'joonhobaek',
    versionLabel: '2.0.1',
    headline: 'Fixed fewer, because the groups hid how bad one route was',
    timeSpentMinutes: 44,
    environment: { os: 'macOS 15.2', build: '2.0.1' },
    daysAgo: 12,
    ratings: {
      time_to_first_call: 5,
      ergonomics: 3,
      docs_quality: 4,
      debuggability: 4,
      production_readiness: 4,
    },
    points: [
      {
        category: 'docs',
        body:
          'Honest answer: fewer. Grouped by criterion, I could not see that one page accounted for sixty per cent of the findings. In the table that jumped out because the same path repeated down the column. I fixed rules instead of fixing the worst page.',
        severity: 'major',
        actionability: 'observation',
        sentiment: -1,
        askIndex: 0,
        theme: 'grouped-needs-index',
        upvotes: 19,
      },
    ],
    creatorMarkedHelpful: true,
    inboxState: 'actioned',
    votes: 16,
  },
  {
    key: 'cn-greta-1',
    project: 'cairn',
    reviewer: 'gretalind',
    versionLabel: '2.0.1',
    headline: 'Exit code 2 collides with a common runner convention',
    timeSpentMinutes: 31,
    environment: { os: 'Linux, Ubuntu 24.04', build: '2.0.1' },
    daysAgo: 16,
    ratings: {
      time_to_first_call: 5,
      ergonomics: 4,
      docs_quality: 4,
      debuggability: 4,
      production_readiness: 3,
    },
    points: [
      {
        category: 'error_messages',
        body:
          'Reserving exit code 2 for configuration errors is reasonable in isolation and it collides with two popular test runners that use 2 for “tests failed”. Our pipeline treated a missing config file as a failing audit for three days before anybody looked.',
        severity: 'major',
        actionability: 'suggestion',
        sentiment: -1,
        askIndex: 0,
        upvotes: 13,
      },
    ],
    inboxState: 'triaged',
    votes: 11,
  },
  {
    key: 'cn-priya-1',
    project: 'cairn',
    reviewer: 'priyaram',
    versionLabel: '2.0.1',
    headline: 'First run on a real product, and it found the thing a person had already told me about',
    timeSpentMinutes: 26,
    environment: { os: 'macOS 15.1', build: '2.0.1' },
    daysAgo: 20,
    ratings: {
      time_to_first_call: 5,
      ergonomics: 4,
      docs_quality: 5,
      debuggability: 5,
      production_readiness: 4,
    },
    points: [
      {
        category: 'quickstart',
        body:
          'Ran it on my app on the strength of a review Nkechi left me. It found the div rows she had reported by hand, plus nineteen things she had not had time to mention. Four minutes from install to output.',
        severity: 'praise',
        actionability: 'observation',
        sentiment: 1,
        askIndex: 0,
        upvotes: 14,
      },
    ],
    inboxState: 'read',
    votes: 12,
  },
  {
    key: 'cn-emmett-1',
    project: 'cairn',
    reviewer: 'emmettquill',
    versionLabel: '2.0.1',
    headline: 'Ran it on the bundled fixture',
    summary: 'I do not have a real project to run it on so I used the fixture that ships with it. Output looked good.',
    timeSpentMinutes: 6,
    environment: { os: 'Windows 10', build: '2.0.1' },
    daysAgo: 20,
    ratings: {
      time_to_first_call: 4,
      ergonomics: 4,
      docs_quality: 4,
      debuggability: 4,
      production_readiness: 4,
    },
    points: [
      {
        category: 'quickstart',
        body: 'Ran fine on the bundled fixture project. Output was easy to read.',
        severity: 'praise',
        actionability: 'opinion',
        sentiment: 1,
        askIndex: 0,
      },
    ],
    inboxState: 'read',
    votes: 1,
  },
]

/* -------------------------------------------------------------------------- */
/* 7. Themes                                                                  */
/* -------------------------------------------------------------------------- */

export interface SeedTheme {
  readonly key: string
  readonly project: string
  readonly label: string
  readonly summary: string
  readonly category: string
  readonly source: 'auto' | 'manual' | 'confirmed'
}

/**
 * One row per cluster. Membership comes from the `theme` field on each feedback
 * point, so `point_count` and `reviewer_count` are counted from real rows rather
 * than asserted here.
 */
export const THEMES: readonly SeedTheme[] = [
  {
    key: 'tide-meter-invisible',
    project: 'brinehollow',
    label: 'Nobody looks at the tide meter until the alarm',
    summary:
      'Reviewers describe the same failure in four different vocabularies: they never notice it, they read it once and stop, it reads as a score rather than a timer, or it is invisible under a colour filter. One fix, four symptoms.',
    category: 'hud',
    source: 'confirmed',
  },
  {
    key: 'tutorial-beat-three',
    project: 'brinehollow',
    label: 'Beat three moves the meter while the text is still on screen',
    summary:
      'Every report of quitting inside the tutorial lands in the same eight seconds. The complaint is not that the text is unclear; it is that it competes with motion.',
    category: 'tutorial',
    source: 'confirmed',
  },
  {
    key: 'salvage-weight-unclear',
    project: 'brinehollow',
    label: 'Weight is time, and nothing says so',
    summary: 'The central economy rule is discovered by accident, and the salvage panel hides the number that carries it.',
    category: 'economy',
    source: 'confirmed',
  },
  {
    key: 'salvage-sort-crash',
    project: 'brinehollow',
    label: 'Salvage screen crash after sorting by weight',
    summary: 'One reproduction, always repeatable, on a code path the v0.7.1 fix did not cover.',
    category: 'bug',
    source: 'manual',
  },
  {
    key: 'boat-sound-keep',
    project: 'brinehollow',
    label: 'Keep the overloaded boat sound',
    summary: 'Named unprompted as the thing that taught the weight rule before the rule was understood.',
    category: 'delight',
    source: 'auto',
  },
  {
    key: 'parry-input-lag',
    project: 'lastlight-ferry',
    label: 'Parry reads as cheap on a controller',
    summary:
      'Four reports, two of them measured. The window is the same on both inputs; the wind-up animation is four frames longer on the controller build, and the tell fires late.',
    category: 'controls',
    source: 'confirmed',
  },
  {
    key: 'silence-needs-pressure',
    project: 'kiln-and-kin',
    label: 'The silence comes from the deadline, not the tools',
    summary: 'Pairs went quiet only on the commission that has a timer. Pairs with no timer negotiated out loud for the whole session.',
    category: 'core_loop',
    source: 'confirmed',
  },
  {
    key: 'displacement-direction',
    project: 'paperweight-circuit',
    label: 'Readers get the displacement direction backwards',
    summary: 'Board three cannot distinguish the two readings of the rule. Board seven can, and it is eleventh in the sequence.',
    category: 'core_loop',
    source: 'confirmed',
  },
  {
    key: 'currency-decided-early',
    project: 'tallyroot',
    label: 'The currency decision happens at the client name',
    summary:
      'Reviewers report choosing the currency in their head as they type the client name, then accepting the default three screens later without reading it.',
    category: 'core_task',
    source: 'confirmed',
  },
  {
    key: 'decimal-comma',
    project: 'tallyroot',
    label: 'Comma decimals are discarded silently',
    summary: 'A success toast over a rejected edit. Two independent reports, one of them a full reproduction.',
    category: 'bug',
    source: 'confirmed',
  },
  {
    key: 'resend-missing',
    project: 'tallyroot',
    label: 'There is no way to resend an invoice',
    summary: 'Named by a reviewer who has run invoicing for a small business, where chasing is half the job.',
    category: 'missing',
    source: 'manual',
  },
  {
    key: 'share-dialog-choices',
    project: 'stagehand',
    label: 'Four share options, none of them obviously the safe one',
    summary: 'The single longest pause in every timed run. Reviewers are looking for the option that always works and cannot identify it.',
    category: 'core_task',
    source: 'confirmed',
  },
  {
    key: 'calendar-wrong-shape',
    project: 'coldframe',
    label: 'A calendar cannot hold the choice being made',
    summary: 'Two reviewers with direct growing experience independently reached for the season-on-one-line view.',
    category: 'navigation',
    source: 'confirmed',
  },
  {
    key: 'bottom-sheet-relearn',
    project: 'ferryman',
    label: 'New users find the sheet, existing users hunt for it',
    summary:
      'The split is clean and it is not a design failure: first-time users reach the bottom of the screen immediately, long-time users look at the top for about twenty seconds.',
    category: 'nav_structure',
    source: 'confirmed',
  },
  {
    key: 'offline-honesty',
    project: 'ferryman',
    label: 'The banner is honest and the map is not',
    summary: 'Offline, the banner names its last update while the map keeps animating a vehicle it cannot see. Two reports, one of them from a creator who builds transit software.',
    category: 'offline',
    source: 'confirmed',
  },
  {
    key: 'confirm-is-protection',
    project: 'saltbox',
    label: 'The confirm is fine, the card before it is not',
    summary: 'Nobody hesitated at the confirmation. Two of three hesitated one step earlier, because the card does not name whose shift it is.',
    category: 'gestures',
    source: 'confirmed',
  },
  {
    key: 'reads-as-magazine',
    project: 'harrowgate-press',
    label: 'The homepage reads as a magazine, not a press',
    summary: 'Three readers closed the page believing the product was essays. In every case the largest type on the page was an essay title.',
    category: 'hero',
    source: 'confirmed',
  },
  {
    key: 'cta-scrolls-not-books',
    project: 'bellweather-cycles',
    label: 'The primary button scrolls instead of booking',
    summary: 'On a phone the scroll reads as a failed page load. One reviewer closed the site believing it was broken.',
    category: 'cta',
    source: 'confirmed',
  },
  {
    key: 'middle-interview-sag',
    project: 'the-last-loom',
    label: 'Attention drops between 11:30 and 13:05',
    summary:
      'Five reviewers, five timecodes, all inside a ninety second window where the picture does not change and the punch card explanation repeats.',
    category: 'pacing',
    source: 'confirmed',
  },
  {
    key: 'ending-is-earlier',
    project: 'six-minutes-on-the-ice',
    label: 'The film ends at 4:10',
    summary: 'Two reviewers independently named the same earlier shot as the real ending, and neither could say what the final shot was for.',
    category: 'structure',
    source: 'confirmed',
  },
  {
    key: 'cut-at-112',
    project: 'ashfall',
    label: 'The cut at 1:12 is invisible, the speed change is not',
    summary:
      'Three of four reviewers did not notice the cut. The one who did located the tell precisely: camera speed changes across the join.',
    category: 'color',
    source: 'confirmed',
  },
  {
    key: 'retention-not-volume',
    project: 'standing-order',
    label: 'The number is not eleven, it is week six',
    summary: 'Two reviewers with kitchen experience reframed the assumption from order volume to how long a standing order survives.',
    category: 'assumptions',
    source: 'confirmed',
  },
  {
    key: 'price-the-audit',
    project: 'meterwise',
    label: 'Sell the audit, not the month',
    summary: 'Two founders independently rejected both proposed models and named a third. One of them has lived with the revenue-share model as a buyer.',
    category: 'pricing_model',
    source: 'confirmed',
  },
  {
    key: 'hinge-off-axis',
    project: 'kestrel-deck',
    label: 'Off-axis folding, not typing, is what will kill the hinge',
    summary:
      'Three reviewers describe three different resting states: folded in a bag against a laptop, standing on edge beside a monitor, folded one handed six times a day. None of them are the cycle test.',
    category: 'mechanism',
    source: 'confirmed',
  },
  {
    key: 'thumb-cluster-reach',
    project: 'kestrel-deck',
    label: 'The outer thumb key is out of reach',
    summary: 'Remapped away by the reviewer on day two, which means it is effectively a two key cluster for some hands.',
    category: 'ergonomics',
    source: 'manual',
  },
  {
    key: 'dial-not-display',
    project: 'ember-lantern',
    label: 'The dial is right, its position and detents are not',
    summary:
      'Nobody wanted a percentage, which answers the ask. Two reviewers could not operate the dial in the situation the product is for: hanging, in gloves, in the dark.',
    category: 'power',
    source: 'confirmed',
  },
  {
    key: 'time-loses-to-destination',
    project: 'coastline-rebrand',
    label: 'The destination beats the time at four metres',
    summary: 'The time is larger and the destination is darker. At distance, in poor light, value wins over size.',
    category: 'composition',
    source: 'confirmed',
  },
  {
    key: 'toolbar-not-table',
    project: 'understudy',
    label: 'The table holds, the toolbar collapses',
    summary: 'The component under test survived every hostile content switch. The example around it, which appears in every docs screenshot, did not.',
    category: 'states',
    source: 'confirmed',
  },
  {
    key: 'passive-protagonist',
    project: 'the-salt-line',
    label: 'Four consecutive paragraphs of being told things',
    summary: 'Three readers stopped or sped up in the same scene. The clearest diagnosis: the protagonist receives information for two pages without acting.',
    category: 'opening',
    source: 'confirmed',
  },
  {
    key: 'section-four-hedges',
    project: 'nobody-reads-the-manual',
    label: 'Section four argues against the thesis',
    summary: 'Two readers could state the argument, and both named section four as the place it wobbles.',
    category: 'structure',
    source: 'confirmed',
  },
  {
    key: 'error-code-7',
    project: 'ledgerline',
    label: 'Error code 7 points at the wrong problem',
    summary:
      'The gap between the claimed four minute quickstart and the measured nineteen is almost entirely one error message that names a network fault for an SSL configuration problem.',
    category: 'error_messages',
    source: 'confirmed',
  },
  {
    key: 'grouped-needs-index',
    project: 'cairn',
    label: 'Grouped output needs an index above it',
    summary:
      'Three answers to the same question: more fixed, fewer fixed, and a pinned old version. All three point at the same missing summary line.',
    category: 'docs',
    source: 'confirmed',
  },
]

/* -------------------------------------------------------------------------- */
/* 8. Suggestion tracker                                                      */
/* -------------------------------------------------------------------------- */

export type SuggestionStatus =
  | 'open'
  | 'under_review'
  | 'planned'
  | 'in_progress'
  | 'shipped'
  | 'declined'
  | 'duplicate'
  | 'wont_fix'

export interface SeedSuggestionEvent {
  readonly to: SuggestionStatus
  readonly note?: string
  readonly daysAgo: number
  readonly actor: string
}

export interface SeedSuggestion {
  readonly key: string
  readonly project: string
  readonly theme?: string
  readonly title: string
  readonly body: string
  readonly createdBy: string
  readonly status: SuggestionStatus
  readonly statusNote?: string
  readonly priority: 'low' | 'normal' | 'high' | 'critical'
  readonly effort: 'xs' | 's' | 'm' | 'l' | 'xl'
  readonly duplicateOf?: string
  readonly shippedVersionLabel?: string
  readonly createdDaysAgo: number
  readonly events: readonly SeedSuggestionEvent[]
  readonly voters: readonly string[]
}

export const SUGGESTIONS: readonly SeedSuggestion[] = [
  {
    key: 'sg-bh-meter-on-boat',
    project: 'brinehollow',
    theme: 'tide-meter-invisible',
    title: 'Move the tide state onto the boat',
    body:
      'Nine reviewers describe the same failure from four directions. The meter is in a corner nobody looks at, it reads as a score rather than a timer, and under a colour filter it never appears to change. Putting the state on the boat itself puts it where every reviewer says their eye already is, and lets the numeral stay in the corner for people who want to read it.',
    createdBy: 'mirasolvang',
    status: 'in_progress',
    priority: 'critical',
    effort: 'm',
    createdDaysAgo: 20,
    events: [
      { to: 'open', daysAgo: 20, actor: 'mirasolvang' },
      { to: 'under_review', daysAgo: 18, actor: 'mirasolvang', note: 'Waiting to see whether the colour report and the position reports are one problem.' },
      { to: 'planned', daysAgo: 12, actor: 'mirasolvang', note: 'They are one problem. Nkechi Obi’s report made that clear.' },
      { to: 'in_progress', daysAgo: 5, actor: 'mirasolvang' },
    ],
    voters: ['gretalind', 'nkechiobi', 'lenahavel', 'beatricer', 'omarhaddad', 'suvikallio', 'casperlq', 'marcusweill', 'sofiabrandao'],
  },
  {
    key: 'sg-bh-beat-three',
    project: 'brinehollow',
    theme: 'tutorial-beat-three',
    title: 'Hold the tide meter still until beat three is dismissed',
    body:
      'Beat two already waits for input before anything moves, and no reviewer has ever reported a problem with beat two. Beat three does not wait. Make it behave like its neighbour.',
    createdBy: 'tobiadeyemi',
    status: 'shipped',
    shippedVersionLabel: 'v0.7.2',
    priority: 'critical',
    effort: 's',
    createdDaysAgo: 11,
    events: [
      { to: 'open', daysAgo: 11, actor: 'tobiadeyemi' },
      { to: 'planned', daysAgo: 9, actor: 'mirasolvang', note: 'Obviously right. Annoyed I did not see it.' },
      { to: 'in_progress', daysAgo: 6, actor: 'mirasolvang' },
      { to: 'shipped', daysAgo: 3, actor: 'mirasolvang', note: 'Shipped in v0.7.2, with the crash fix and the Jettison rename.' },
    ],
    voters: ['hugobitt', 'ingridvos', 'gretalind', 'suvikallio', 'omarhaddad', 'fenelladoyle'],
  },
  {
    key: 'sg-bh-jettison',
    project: 'brinehollow',
    title: 'Rename Ballast to Jettison',
    body:
      'The card removes weight and is named after the thing that adds it. One reviewer misplayed for an hour on the strength of the name.',
    createdBy: 'mirasolvang',
    status: 'shipped',
    shippedVersionLabel: 'v0.7.2',
    priority: 'high',
    effort: 'xs',
    createdDaysAgo: 24,
    events: [
      { to: 'open', daysAgo: 24, actor: 'mirasolvang' },
      { to: 'planned', daysAgo: 22, actor: 'mirasolvang', note: 'Going out with the next card text pass.' },
      { to: 'shipped', daysAgo: 3, actor: 'mirasolvang', note: 'Shipped in v0.7.2 with the card text pass.' },
    ],
    voters: ['fenelladoyle', 'danyero', 'petranilsen'],
  },
  {
    key: 'sg-bh-salvage-crash',
    project: 'brinehollow',
    theme: 'salvage-sort-crash',
    title: 'Fix the salvage crash on sort then drop',
    body: 'Reproducible every time: sort by weight, drop the last item, the process exits and the run is lost.',
    createdBy: 'mirasolvang',
    status: 'shipped',
    shippedVersionLabel: 'v0.7.2',
    priority: 'critical',
    effort: 's',
    createdDaysAgo: 5,
    events: [
      { to: 'open', daysAgo: 5, actor: 'mirasolvang' },
      { to: 'in_progress', daysAgo: 4, actor: 'mirasolvang', note: 'Different code path from the 0.7.1 fix. Reproduced here.' },
      { to: 'shipped', daysAgo: 3, actor: 'mirasolvang', note: 'Fixed in v0.7.2. Greta Lindholm found it and gave me the exact path.' },
    ],
    voters: ['gretalind', 'aleksynowak'],
  },
  {
    key: 'sg-bh-cashout',
    project: 'brinehollow',
    title: 'Do something about the cash-out strategy',
    body:
      'Take nothing over weight three, never pass the second street, leave. It wins and it is dull. The two obvious fixes are a tide penalty for leaving early or a town cost, and I dislike both.',
    createdBy: 'mirasolvang',
    status: 'under_review',
    priority: 'high',
    effort: 'l',
    createdDaysAgo: 13,
    events: [
      { to: 'open', daysAgo: 13, actor: 'mirasolvang' },
      { to: 'under_review', daysAgo: 11, actor: 'mirasolvang', note: 'Filing rather than arguing. I want two more reports before I touch the economy.' },
    ],
    voters: ['danyero', 'tayobalogun'],
  },
  {
    key: 'sg-bh-deck-text',
    project: 'brinehollow',
    title: 'Raise card body text for handhelds',
    body: 'Card text measures about 11 px on a Steam Deck, and the cards are where all the words are.',
    createdBy: 'vikramsahni',
    status: 'open',
    priority: 'normal',
    effort: 's',
    createdDaysAgo: 22,
    events: [{ to: 'open', daysAgo: 22, actor: 'vikramsahni' }],
    voters: ['aleksynowak', 'nkechiobi', 'gretalind'],
  },
  {
    key: 'sg-bh-slow-town',
    project: 'brinehollow',
    title: 'Hold the water for a beat before the town appears',
    body: 'An editor and two players describe the same abrupt join. A second and a half of the water closing would carry the end of a run.',
    createdBy: 'casperlq',
    status: 'planned',
    priority: 'low',
    effort: 'xs',
    createdDaysAgo: 27,
    events: [
      { to: 'open', daysAgo: 27, actor: 'casperlq' },
      { to: 'planned', daysAgo: 24, actor: 'mirasolvang' },
    ],
    voters: ['ingridvos', 'petranilsen', 'imanifrazier'],
  },
  {
    key: 'sg-bh-reflections',
    project: 'brinehollow',
    title: 'Preset that disables water reflections on integrated graphics',
    body: 'Street three drops to about 22 frames on integrated graphics, and turning reflections off restores it completely.',
    createdBy: 'aleksynowak',
    status: 'open',
    priority: 'normal',
    effort: 's',
    createdDaysAgo: 26,
    events: [{ to: 'open', daysAgo: 26, actor: 'aleksynowak' }],
    voters: ['vikramsahni', 'hugobitt'],
  },
  {
    key: 'sg-tr-currency-client',
    project: 'tallyroot',
    theme: 'currency-decided-early',
    title: 'Put the currency field next to the client name',
    body:
      'Moving currency from the invoice to the client record was right and did not finish the job. Reviewers decide the currency as they type the name, three screens before the control appears.',
    createdBy: 'priyaram',
    status: 'in_progress',
    priority: 'critical',
    effort: 's',
    createdDaysAgo: 3,
    events: [
      { to: 'open', daysAgo: 3, actor: 'priyaram' },
      { to: 'in_progress', daysAgo: 2, actor: 'priyaram', note: 'Shipping this week.' },
    ],
    voters: ['tobiadeyemi', 'lenahavel', 'omarhaddad'],
  },
  {
    key: 'sg-tr-comma',
    project: 'tallyroot',
    theme: 'decimal-comma',
    title: 'Parse comma decimals and fail loudly when a rate cannot be read',
    body:
      'A success toast over a discarded edit is the worst of the three available behaviours. Parse the comma, and if a value cannot be read, say so in the field.',
    createdBy: 'priyaram',
    status: 'shipped',
    shippedVersionLabel: 'v1.4.0',
    priority: 'critical',
    effort: 's',
    createdDaysAgo: 8,
    events: [
      { to: 'open', daysAgo: 8, actor: 'priyaram' },
      { to: 'in_progress', daysAgo: 7, actor: 'priyaram' },
      { to: 'shipped', daysAgo: 5, actor: 'priyaram', note: 'Parsing and the message both went out in v1.4.0.' },
    ],
    voters: ['gretalind', 'fenelladoyle', 'lenahavel', 'omarhaddad'],
  },
  {
    key: 'sg-tr-keyboard-rates',
    project: 'tallyroot',
    title: 'Make the rate card a real table with real controls',
    body:
      'Rows are divs with click handlers, so nobody using a keyboard can edit a rate. The rate card is the product, so this is the whole product for those users.',
    createdBy: 'nkechiobi',
    status: 'shipped',
    shippedVersionLabel: 'v1.4.0',
    priority: 'critical',
    effort: 'm',
    createdDaysAgo: 17,
    events: [
      { to: 'open', daysAgo: 17, actor: 'nkechiobi' },
      { to: 'planned', daysAgo: 15, actor: 'priyaram' },
      { to: 'in_progress', daysAgo: 12, actor: 'priyaram' },
      { to: 'shipped', daysAgo: 6, actor: 'priyaram', note: 'Real table, real buttons, and a live region on the total.' },
    ],
    voters: ['nkechiobi', 'gretalind', 'joonhobaek', 'lenahavel', 'tobiadeyemi'],
  },
  {
    key: 'sg-tr-resend',
    project: 'tallyroot',
    theme: 'resend-missing',
    title: 'Add resend with a chaser note',
    body: 'Chasing is half of invoicing and there is currently no way to do it from inside the product.',
    createdBy: 'ingridvos',
    status: 'planned',
    priority: 'high',
    effort: 'm',
    createdDaysAgo: 30,
    events: [
      { to: 'open', daysAgo: 30, actor: 'ingridvos' },
      { to: 'under_review', daysAgo: 26, actor: 'priyaram' },
      { to: 'planned', daysAgo: 19, actor: 'priyaram', note: 'After the currency work.' },
    ],
    voters: ['ingridvos', 'sofiabrandao', 'petranilsen', 'omarhaddad', 'beatricer'],
  },
  {
    key: 'sg-tr-pdf',
    project: 'tallyroot',
    title: 'Redesign the invoice PDF to match the product',
    body: 'The document the client receives is the only part of Tallyroot most people will ever see, and it looks like a different company made it.',
    createdBy: 'beatricer',
    status: 'open',
    priority: 'normal',
    effort: 'l',
    createdDaysAgo: 20,
    events: [{ to: 'open', daysAgo: 20, actor: 'beatricer' }],
    voters: ['beatricer', 'hanakuro', 'fenelladoyle'],
  },
  {
    key: 'sg-tr-mobile-rates',
    project: 'tallyroot',
    title: 'One rate per card on small screens',
    body: 'Six columns at 412 px scrolls sideways and the headers go with it.',
    createdBy: 'vikramsahni',
    status: 'duplicate',
    duplicateOf: 'sg-tr-keyboard-rates',
    priority: 'normal',
    effort: 's',
    createdDaysAgo: 28,
    events: [
      { to: 'open', daysAgo: 28, actor: 'vikramsahni' },
      { to: 'duplicate', daysAgo: 24, actor: 'priyaram', note: 'Folding into the rate table rebuild, which is changing the markup anyway.' },
    ],
    voters: ['vikramsahni'],
  },
  {
    key: 'sg-fm-coach-mark',
    project: 'ferryman',
    theme: 'bottom-sheet-relearn',
    title: 'One-time card for existing users showing where the line picker went',
    body:
      'New users find the sheet in about four seconds. Long-time users spend twenty looking at the top of the screen. The cost is real and temporary, and a single card removes it.',
    createdBy: 'vikramsahni',
    status: 'in_progress',
    priority: 'high',
    effort: 's',
    createdDaysAgo: 5,
    events: [
      { to: 'open', daysAgo: 5, actor: 'vikramsahni' },
      { to: 'in_progress', daysAgo: 3, actor: 'vikramsahni', note: 'Going out in 3.0.3.' },
    ],
    voters: ['tobiadeyemi', 'emmettquill', 'beatricer', 'ingridvos'],
  },
  {
    key: 'sg-fm-map-lies',
    project: 'ferryman',
    theme: 'offline-honesty',
    title: 'Freeze the vehicle animation when the data is stale',
    body:
      'The banner says the data is nine minutes old while the map animates a vehicle along the line. The animation is more persuasive than the banner and it is not telling the truth.',
    createdBy: 'danyero',
    status: 'planned',
    priority: 'high',
    effort: 'm',
    createdDaysAgo: 10,
    events: [
      { to: 'open', daysAgo: 10, actor: 'danyero' },
      { to: 'planned', daysAgo: 7, actor: 'vikramsahni', note: 'Agreed. Freezing and greying, with the stale time on the vehicle itself.' },
    ],
    voters: ['gretalind', 'danyero', 'nkechiobi'],
  },
  {
    key: 'sg-fm-revert',
    project: 'ferryman',
    title: 'Add a setting to put the line picker back at the top',
    body: 'Long-time users would like the old placement as an option.',
    createdBy: 'emmettquill',
    status: 'declined',
    statusNote:
      'Two placements means two layouts to test on every release, and the evidence says the new one is better for one handed use. The relearning cost is real, so a one-time card ships instead.',
    priority: 'low',
    effort: 'm',
    createdDaysAgo: 13,
    events: [
      { to: 'open', daysAgo: 13, actor: 'emmettquill' },
      {
        to: 'declined',
        daysAgo: 9,
        actor: 'vikramsahni',
        note: 'Two placements means two layouts to test forever. Shipping a one-time card instead.',
      },
    ],
    voters: ['emmettquill'],
  },
  {
    key: 'sg-kd-hinge-test',
    project: 'kestrel-deck',
    theme: 'hinge-off-axis',
    title: 'Add an off-axis fold fixture before the tooling quote',
    body:
      'The cycle test folds the way the hinge was designed to fold. Every reviewer folds it some other way: one handed, against a laptop in a bag, standing on edge beside a monitor.',
    createdBy: 'marcusweill',
    status: 'in_progress',
    priority: 'critical',
    effort: 'm',
    createdDaysAgo: 4,
    events: [
      { to: 'open', daysAgo: 4, actor: 'marcusweill' },
      { to: 'in_progress', daysAgo: 3, actor: 'marcusweill', note: 'Fixture on the bench this week. Tooling quote is in three weeks.' },
    ],
    voters: ['gretalind', 'danyero', 'joonhobaek', 'suvikallio'],
  },
  {
    key: 'sg-kd-legends',
    project: 'kestrel-deck',
    title: 'Move key legends from printed to double shot',
    body: 'Shine on E, A and the spacebar after four days of use. At this price the legends need to outlive the warranty.',
    createdBy: 'hanakuro',
    status: 'under_review',
    priority: 'high',
    effort: 'l',
    createdDaysAgo: 23,
    events: [
      { to: 'open', daysAgo: 23, actor: 'hanakuro' },
      { to: 'under_review', daysAgo: 20, actor: 'marcusweill', note: 'Getting a quote. This changes the key supplier, so it is not a small decision this late.' },
    ],
    voters: ['hanakuro', 'danyero', 'vikramsahni', 'ruitavares'],
  },
  {
    key: 'sg-kd-keymap-text',
    project: 'kestrel-deck',
    title: 'Export the keymap as a text file',
    body: 'The layout is a binary blob in the companion app. Developers want it in a repository.',
    createdBy: 'ruitavares',
    status: 'planned',
    priority: 'normal',
    effort: 'm',
    createdDaysAgo: 26,
    events: [
      { to: 'open', daysAgo: 26, actor: 'ruitavares' },
      { to: 'planned', daysAgo: 21, actor: 'marcusweill', note: 'Firmware side, so it can land after the hardware is frozen.' },
    ],
    voters: ['ruitavares', 'aleksynowak', 'lenahavel'],
  },
  {
    key: 'sg-ll-trim-middle',
    project: 'the-last-loom',
    theme: 'middle-interview-sag',
    title: 'Cut 11:40 to 12:50',
    body:
      'Five attention reports inside one ninety second window. The section repeats the punch card explanation from 07:20 with better wording, and the picture does not change for four minutes.',
    createdBy: 'casperlq',
    status: 'in_progress',
    priority: 'high',
    effort: 's',
    createdDaysAgo: 4,
    events: [
      { to: 'open', daysAgo: 4, actor: 'casperlq' },
      { to: 'in_progress', daysAgo: 2, actor: 'casperlq', note: 'Cutting the words and keeping the hands, as Petra suggested.' },
    ],
    voters: ['imanifrazier', 'kwamemensah', 'tobiadeyemi', 'mirasolvang', 'petranilsen'],
  },
  {
    key: 'sg-ll-archive-grain',
    project: 'the-last-loom',
    title: 'Put the grain back into the 03:10 archive',
    body: 'The regrade made the archive match the modern footage so well that it reads as a reconstruction.',
    createdBy: 'kwamemensah',
    status: 'planned',
    priority: 'normal',
    effort: 's',
    createdDaysAgo: 7,
    events: [
      { to: 'open', daysAgo: 7, actor: 'kwamemensah' },
      { to: 'planned', daysAgo: 6, actor: 'casperlq', note: 'Reverting most of it. The broadcaster note was the wrong reason.' },
    ],
    voters: ['kwamemensah', 'hanakuro', 'imanifrazier'],
  },
  {
    key: 'sg-us-toolbar',
    project: 'understudy',
    theme: 'toolbar-not-table',
    title: 'Specify the toolbar as a component',
    body: 'It is in every screenshot on the docs site and it is the only thing that collapsed under the hostile content test.',
    createdBy: 'joonhobaek',
    status: 'planned',
    priority: 'high',
    effort: 'm',
    createdDaysAgo: 3,
    events: [
      { to: 'open', daysAgo: 3, actor: 'joonhobaek' },
      { to: 'planned', daysAgo: 2, actor: 'joonhobaek', note: 'Landing in 2.2 with its own edge case set.' },
    ],
    voters: ['lenahavel', 'priyaram', 'nkechiobi'],
  },
  {
    key: 'sg-us-side-effects',
    project: 'understudy',
    title: 'Add the sideEffects field so the icon set shakes out',
    body: 'One component import pulls 180 kB of icons. One line in the package manifest.',
    createdBy: 'ruitavares',
    status: 'shipped',
    shippedVersionLabel: '2.1.0',
    priority: 'high',
    effort: 'xs',
    createdDaysAgo: 14,
    events: [
      { to: 'open', daysAgo: 14, actor: 'ruitavares' },
      { to: 'in_progress', daysAgo: 13, actor: 'joonhobaek' },
      { to: 'shipped', daysAgo: 12, actor: 'joonhobaek', note: 'Patched into 2.1.0. Bundle for the table alone is now 31 kB.' },
    ],
    voters: ['ruitavares', 'lenahavel', 'priyaram'],
  },
  {
    key: 'sg-us-scale',
    project: 'understudy',
    title: 'Collapse type scale steps four and five',
    body: '20.25 px and 21 px is one step with two names, and two teams will pick differently for the same job.',
    createdBy: 'hanakuro',
    status: 'wont_fix',
    statusNote:
      'Three teams have shipped against both names and a rename costs them a codemod each. The docs now say which one to reach for and the next major collapses them.',
    priority: 'low',
    effort: 'm',
    createdDaysAgo: 10,
    events: [
      { to: 'open', daysAgo: 10, actor: 'hanakuro' },
      {
        to: 'wont_fix',
        daysAgo: 7,
        actor: 'joonhobaek',
        note: 'Not in a minor version. Documented now, collapsed in 3.0.',
      },
    ],
    voters: ['hanakuro'],
  },
  {
    key: 'sg-lg-code7',
    project: 'ledgerline',
    theme: 'error-code-7',
    title: 'Rewrite error code 7 to name the SSL requirement',
    body:
      'Eleven of the nineteen minutes in a timed cold start went to one error message that describes a network failure for an SSL configuration problem.',
    createdBy: 'ruitavares',
    status: 'shipped',
    shippedVersionLabel: '0.14.0-rc2',
    priority: 'critical',
    effort: 'xs',
    createdDaysAgo: 3,
    events: [
      { to: 'open', daysAgo: 3, actor: 'ruitavares' },
      { to: 'in_progress', daysAgo: 2, actor: 'ruitavares' },
      { to: 'shipped', daysAgo: 1, actor: 'ruitavares', note: 'New message names sslmode and the quickstart shows it in the first snippet.' },
    ],
    voters: ['gretalind', 'joonhobaek', 'aleksynowak', 'lenahavel'],
  },
  {
    key: 'sg-cn-index',
    project: 'cairn',
    theme: 'grouped-needs-index',
    title: 'Summary index above the grouped output',
    body:
      'Three reviewers gave three different answers about whether grouping helped, and all three describe the same missing thing: a count per group at the top, and a count per page.',
    createdBy: 'nkechiobi',
    status: 'planned',
    priority: 'high',
    effort: 's',
    createdDaysAgo: 4,
    events: [
      { to: 'open', daysAgo: 4, actor: 'nkechiobi' },
      { to: 'planned', daysAgo: 3, actor: 'nkechiobi', note: 'In 2.1, with the worst page named in the first line.' },
    ],
    voters: ['ruitavares', 'joonhobaek', 'lenahavel', 'gretalind', 'priyaram'],
  },
]

/* -------------------------------------------------------------------------- */
/* 9. Bounties, applications, awards and the escrow ledger                    */
/* -------------------------------------------------------------------------- */

export interface SeedApplication {
  readonly applicant: string
  readonly pitch: string
  readonly quotedCents?: number
  readonly etaHours?: number
  readonly status: 'pending' | 'shortlisted' | 'accepted' | 'declined' | 'withdrawn' | 'expired'
  readonly daysAgo: number
}

export interface SeedAward {
  readonly expert: string
  readonly feedbackKey?: string
  readonly status:
    | 'assigned'
    | 'in_progress'
    | 'delivered'
    | 'accepted'
    | 'revision_requested'
    | 'disputed'
    | 'cancelled'
    | 'expired'
  readonly payoutState: 'pending' | 'scheduled' | 'paid' | 'refunded' | 'failed'
  readonly dueDaysAgo: number
  readonly deliveredDaysAgo?: number
  readonly acceptedDaysAgo?: number
  readonly paidDaysAgo?: number
  readonly creatorRating?: number
  readonly creatorReview?: string
}

export interface SeedEscrowEvent {
  readonly kind:
    | 'authorize'
    | 'capture'
    | 'hold'
    | 'release'
    | 'partial_release'
    | 'refund'
    | 'chargeback'
    | 'dispute_open'
    | 'dispute_resolve'
    | 'fee'
  readonly to: 'unfunded' | 'authorized' | 'held' | 'released' | 'refunded' | 'disputed'
  readonly amountCents: number
  readonly daysAgo: number
  /**
   * Only for a row that needs more than the application would write. Release,
   * fee and refund rows otherwise get the bounty actions' own wording.
   */
  readonly note?: string
}

export interface SeedBounty {
  readonly key: string
  readonly project: string
  readonly title: string
  readonly brief: string
  readonly createdBy: string
  readonly expertise: string
  readonly amountCents: number
  readonly seats: number
  readonly turnaroundHours: number
  readonly status: 'draft' | 'open' | 'in_progress' | 'delivered' | 'closed' | 'cancelled'
  readonly escrowState: 'unfunded' | 'authorized' | 'held' | 'released' | 'refunded' | 'disputed'
  readonly visibility: 'public' | 'invite_only'
  /** The one reviewer an invite-only bounty was sent to. Public bounties name nobody. */
  readonly invitee?: string
  readonly createdDaysAgo: number
  readonly closesInDays?: number
  readonly applications: readonly SeedApplication[]
  readonly award?: SeedAward
  readonly escrow: readonly SeedEscrowEvent[]
}

export const BOUNTIES: readonly SeedBounty[] = [
  {
    key: 'b-brinehollow-onboarding',
    project: 'brinehollow',
    title: 'Recorded first-session review of the new tutorial',
    brief:
      'I need somebody who does this professionally to record a first run and tell me, beat by beat, where a new player loses the thread. Four beats, ninety seconds. Please do not read the devlog first. I want the version of you that has never heard of this game.',
    createdBy: 'mirasolvang',
    expertise: 'game-design',
    amountCents: 24000,
    seats: 1,
    turnaroundHours: 72,
    status: 'closed',
    escrowState: 'released',
    visibility: 'public',
    createdDaysAgo: 17,
    applications: [
      {
        applicant: 'tobiadeyemi',
        pitch:
          'I will record the session with running commentary and return a timestamped list of every hesitation, ordered by how many players I expect to hesitate there. Three days.',
        quotedCents: 24000,
        etaHours: 72,
        status: 'accepted',
        daysAgo: 16,
      },
      {
        applicant: 'gretalind',
        pitch: 'I can do this, though onboarding is not my strongest area. My reports lean toward defects rather than hesitation.',
        quotedCents: 20000,
        etaHours: 48,
        status: 'declined',
        daysAgo: 16,
      },
    ],
    award: {
      expert: 'tobiadeyemi',
      feedbackKey: 'bh-tobi-1',
      status: 'accepted',
      payoutState: 'paid',
      dueDaysAgo: 9,
      deliveredDaysAgo: 11,
      acceptedDaysAgo: 10,
      paidDaysAgo: 8,
      creatorRating: 5,
      creatorReview:
        'Beat three, with a timestamp and a fix I could ship the same week. Worth more than I paid and I will book again before the next build.',
    },
    escrow: [
      { kind: 'authorize', to: 'authorized', amountCents: 24000, daysAgo: 17 },
      { kind: 'hold', to: 'held', amountCents: 24000, daysAgo: 16 },
      { kind: 'release', to: 'released', amountCents: 21600, daysAgo: 8 },
      { kind: 'fee', to: 'released', amountCents: 2400, daysAgo: 8 },
    ],
  },
  {
    key: 'b-tallyroot-a11y',
    project: 'tallyroot',
    title: 'WCAG 2.2 AA audit of the rate card and invoice flow',
    brief:
      'Signup through a sent invoice, keyboard and screen reader. I would rather have ten findings I can fix than a score. If something is unusable rather than merely awkward, please say so plainly and put it first.',
    createdBy: 'priyaram',
    expertise: 'accessibility',
    amountCents: 20000,
    seats: 1,
    turnaroundHours: 96,
    status: 'closed',
    escrowState: 'released',
    visibility: 'public',
    createdDaysAgo: 23,
    applications: [
      {
        applicant: 'nkechiobi',
        pitch:
          'Keyboard pass, NVDA and VoiceOver pass, reflow at 320 px, reduced motion. Findings tied to a selector and a success criterion, ordered by how many people they lock out.',
        quotedCents: 20000,
        etaHours: 96,
        status: 'accepted',
        daysAgo: 22,
      },
    ],
    award: {
      expert: 'nkechiobi',
      feedbackKey: 'tr-nkechi-1',
      status: 'accepted',
      payoutState: 'paid',
      dueDaysAgo: 15,
      deliveredDaysAgo: 17,
      acceptedDaysAgo: 16,
      paidDaysAgo: 14,
      creatorRating: 5,
      creatorReview:
        'Found the thing that made my product unusable for keyboard users, explained why in a sentence I understood, and told me it was an afternoon of work. It was.',
    },
    escrow: [
      { kind: 'authorize', to: 'authorized', amountCents: 20000, daysAgo: 23 },
      { kind: 'hold', to: 'held', amountCents: 20000, daysAgo: 22 },
      { kind: 'release', to: 'released', amountCents: 18000, daysAgo: 14 },
      { kind: 'fee', to: 'released', amountCents: 2000, daysAgo: 14 },
    ],
  },
  {
    key: 'b-ashfall-cut',
    project: 'ashfall',
    title: 'Second opinion on one cut, before Friday delivery',
    brief:
      'One question, one timecode. I need an editor who has cut long form to tell me whether the join at 1:12 reads as a decision or as a fault. Watch once at full size before reading anything.',
    createdBy: 'kwamemensah',
    expertise: 'video-editing',
    amountCents: 30000,
    seats: 1,
    turnaroundHours: 48,
    status: 'closed',
    escrowState: 'released',
    visibility: 'public',
    createdDaysAgo: 6,
    applications: [
      {
        applicant: 'casperlq',
        pitch: 'Two watches: one cold, one looking for it. I will tell you what I saw the first time before I tell you what I found the second.',
        quotedCents: 30000,
        etaHours: 24,
        status: 'accepted',
        daysAgo: 5,
      },
    ],
    award: {
      expert: 'casperlq',
      feedbackKey: 'af-casper-1',
      status: 'accepted',
      payoutState: 'paid',
      dueDaysAgo: 1,
      deliveredDaysAgo: 3,
      acceptedDaysAgo: 2,
      paidDaysAgo: 1,
      creatorRating: 5,
      creatorReview: 'Answered the question I asked, in the order I asked it, in under a day. That is the job.',
    },
    escrow: [
      { kind: 'authorize', to: 'authorized', amountCents: 30000, daysAgo: 6 },
      { kind: 'hold', to: 'held', amountCents: 30000, daysAgo: 5 },
      { kind: 'release', to: 'released', amountCents: 27000, daysAgo: 1 },
      { kind: 'fee', to: 'released', amountCents: 3000, daysAgo: 1 },
    ],
  },
  {
    key: 'b-harrowgate-copy',
    project: 'harrowgate-press',
    title: 'Homepage copy: line edits, not a tone document',
    brief:
      'Every string above the fold, plus the shop navigation. I want your sentence next to mine and one line on what changed. Please be blunt about the essay archive; I know it is the problem and I need to be told again.',
    createdBy: 'elowenprice',
    expertise: 'writing-editing',
    amountCents: 18000,
    seats: 1,
    turnaroundHours: 48,
    status: 'closed',
    escrowState: 'released',
    visibility: 'public',
    createdDaysAgo: 10,
    applications: [
      {
        applicant: 'fenelladoyle',
        pitch: 'Yours, mine, what changed. Every string above the fold plus the nav labels. Two days.',
        quotedCents: 18000,
        etaHours: 48,
        status: 'accepted',
        daysAgo: 9,
      },
      {
        applicant: 'petranilsen',
        pitch: 'I write and I buy from small presses, so I can give you a reader’s read as well as a writer’s. I am slower than Fenella and cheaper.',
        quotedCents: 12000,
        etaHours: 96,
        status: 'declined',
        daysAgo: 9,
      },
    ],
    award: {
      expert: 'fenelladoyle',
      feedbackKey: 'hp-fenella-1',
      status: 'accepted',
      payoutState: 'paid',
      dueDaysAgo: 5,
      deliveredDaysAgo: 7,
      acceptedDaysAgo: 6,
      paidDaysAgo: 4,
      creatorRating: 5,
      creatorReview: 'Gave me the sentence I should have written two years ago and explained why mine was not it.',
    },
    escrow: [
      { kind: 'authorize', to: 'authorized', amountCents: 18000, daysAgo: 10 },
      { kind: 'hold', to: 'held', amountCents: 18000, daysAgo: 9 },
      { kind: 'release', to: 'released', amountCents: 16200, daysAgo: 4 },
      { kind: 'fee', to: 'released', amountCents: 1800, daysAgo: 4 },
    ],
  },
  {
    key: 'b-kestrel-qa',
    project: 'kestrel-deck',
    title: 'Ten days of daily carry, written up as a defect list',
    brief:
      'Carry a DVT unit every day for ten days. Bag it, fly with it, get it wet. I want a written list of what wore, what loosened and what you stopped doing because it was awkward, with photographs. Do not baby it.',
    createdBy: 'marcusweill',
    expertise: 'frontend-engineering',
    amountCents: 45000,
    seats: 1,
    turnaroundHours: 336,
    status: 'delivered',
    escrowState: 'held',
    visibility: 'public',
    createdDaysAgo: 20,
    applications: [
      {
        applicant: 'gretalind',
        pitch:
          'Ten days of daily carry on my usual routine, which includes four flights and a bike commute. Steps, result, expectation and frequency for every finding, plus photographs of wear.',
        quotedCents: 45000,
        etaHours: 288,
        status: 'accepted',
        daysAgo: 19,
      },
      {
        applicant: 'suvikallio',
        pitch: 'I can do the firmware and power side properly but I cannot commit ten days of carry this month.',
        quotedCents: 30000,
        etaHours: 336,
        status: 'withdrawn',
        daysAgo: 18,
      },
    ],
    award: {
      expert: 'gretalind',
      feedbackKey: 'kd-greta-1',
      status: 'delivered',
      payoutState: 'pending',
      dueDaysAgo: 3,
      deliveredDaysAgo: 5,
    },
    escrow: [
      { kind: 'authorize', to: 'authorized', amountCents: 45000, daysAgo: 20 },
      { kind: 'hold', to: 'held', amountCents: 45000, daysAgo: 19 },
    ],
  },
  {
    key: 'b-ferryman-a11y',
    project: 'ferryman',
    title: 'VoiceOver and TalkBack pass on the 3.0 line picker',
    brief:
      'The sheet is new and it is the control forty thousand people touch every day. I need both platforms, at the largest text sizes, with the findings ordered by how many people they stop.',
    createdBy: 'vikramsahni',
    expertise: 'accessibility',
    amountCents: 35000,
    seats: 1,
    turnaroundHours: 120,
    status: 'in_progress',
    escrowState: 'held',
    visibility: 'public',
    createdDaysAgo: 6,
    applications: [
      {
        applicant: 'nkechiobi',
        pitch: 'Both platforms, both screen readers, largest Dynamic Type, plus a reflow check at 320 px. Five days.',
        quotedCents: 35000,
        etaHours: 120,
        status: 'accepted',
        daysAgo: 5,
      },
      {
        applicant: 'gretalind',
        pitch: 'I can cover the device matrix and the state loss cases but I am not the right person for the screen reader pass.',
        quotedCents: 28000,
        etaHours: 96,
        status: 'declined',
        daysAgo: 5,
      },
    ],
    award: {
      expert: 'nkechiobi',
      status: 'in_progress',
      payoutState: 'pending',
      dueDaysAgo: -2,
    },
    escrow: [
      { kind: 'authorize', to: 'authorized', amountCents: 35000, daysAgo: 6 },
      { kind: 'hold', to: 'held', amountCents: 35000, daysAgo: 5 },
    ],
  },
  {
    key: 'b-understudy-a11y',
    project: 'understudy',
    title: 'Audit the table, form field and dialog against WCAG 2.2 AA',
    brief:
      'Three components, each with its empty, loading, error and overflow state. I want the findings written as a specification change, not as a bug list, because whatever you find goes into the component contract.',
    createdBy: 'joonhobaek',
    expertise: 'accessibility',
    amountCents: 26000,
    seats: 1,
    turnaroundHours: 120,
    status: 'open',
    escrowState: 'held',
    visibility: 'public',
    createdDaysAgo: 4,
    closesInDays: 6,
    applications: [
      {
        applicant: 'nkechiobi',
        pitch: 'I can start a week on Monday. Findings written as contract clauses with a test for each, which is how I would want to receive them.',
        quotedCents: 26000,
        etaHours: 120,
        status: 'shortlisted',
        daysAgo: 3,
      },
      {
        applicant: 'gretalind',
        pitch: 'Keyboard and state coverage across the three components on four browsers, with a matrix. I would not attempt the screen reader naming work.',
        quotedCents: 22000,
        etaHours: 96,
        status: 'pending',
        daysAgo: 2,
      },
      {
        applicant: 'tobiadeyemi',
        pitch: 'Not my specialism, but I can cover the dialog focus and dismissal behaviour if you want that split out.',
        quotedCents: 12000,
        etaHours: 72,
        status: 'pending',
        daysAgo: 1,
      },
    ],
    escrow: [
      { kind: 'authorize', to: 'authorized', amountCents: 26000, daysAgo: 4 },
      { kind: 'hold', to: 'held', amountCents: 26000, daysAgo: 4 },
    ],
  },
  {
    key: 'b-saltbox-copy',
    project: 'saltbox',
    title: 'Dutch and English strings for the claim and approve flow',
    brief:
      'Eleven strings in two languages. The Dutch ones are mine and they are the ones most people read, so please be harder on those. Context is a tired person on a phone at the end of a shift.',
    createdBy: 'ingridvos',
    expertise: 'writing-editing',
    amountCents: 15000,
    seats: 1,
    turnaroundHours: 72,
    status: 'open',
    escrowState: 'held',
    visibility: 'public',
    createdDaysAgo: 7,
    closesInDays: 3,
    applications: [
      {
        applicant: 'fenelladoyle',
        pitch:
          'I work in English and I read Dutch well enough to catch a label that will not fit. I would want a native speaker to sign off my Dutch rewrites, and I will say which ones need it.',
        quotedCents: 15000,
        etaHours: 48,
        status: 'pending',
        daysAgo: 5,
      },
      {
        applicant: 'beatricer',
        pitch: 'I have written short-form interface copy for two multilingual clients. Not a Dutch speaker either, so the same caveat applies.',
        quotedCents: 11000,
        etaHours: 96,
        status: 'pending',
        daysAgo: 4,
      },
    ],
    escrow: [
      { kind: 'authorize', to: 'authorized', amountCents: 15000, daysAgo: 7 },
      { kind: 'hold', to: 'held', amountCents: 15000, daysAgo: 7 },
    ],
  },
  {
    key: 'b-meterwise-pricing',
    project: 'meterwise',
    title: 'Pricing and packaging review for a single-building audit product',
    brief: 'Two models on the table, a monthly fee and a share of savings. I want somebody who has sold both to tell me which one to run.',
    createdBy: 'noorfarhat',
    expertise: 'pricing-strategy',
    amountCents: 50000,
    seats: 1,
    turnaroundHours: 120,
    status: 'cancelled',
    escrowState: 'refunded',
    visibility: 'public',
    createdDaysAgo: 12,
    applications: [
      {
        applicant: 'priyaram',
        pitch: 'I have sold both models badly and can tell you exactly how each one failed. I would rather answer this in the open thread than take money for it.',
        status: 'withdrawn',
        daysAgo: 10,
      },
    ],
    escrow: [
      { kind: 'authorize', to: 'authorized', amountCents: 50000, daysAgo: 12 },
      { kind: 'hold', to: 'held', amountCents: 50000, daysAgo: 12 },
      {
        kind: 'refund',
        to: 'refunded',
        amountCents: 50000,
        daysAgo: 4,
        note: 'Cancelled by the creator after the question was answered in a public review.',
      },
    ],
  },
]

/* -------------------------------------------------------------------------- */
/* 10. Community discussions                                                  */
/* -------------------------------------------------------------------------- */

export interface SeedPost {
  readonly author: string
  readonly body: string
  readonly daysAgo: number
  /** Index of the parent post in this thread’s array. Nesting is capped at 3 levels. */
  readonly parent?: number
  readonly accepted?: boolean
  readonly score: number
}

export interface SeedThread {
  readonly key: string
  readonly channel: string
  readonly title: string
  readonly body: string
  readonly author: string
  readonly kind: 'discussion' | 'question' | 'showcase' | 'announcement'
  readonly status: 'open' | 'answered' | 'locked' | 'archived'
  readonly project?: string
  readonly pinned?: boolean
  readonly createdDaysAgo: number
  readonly views: number
  readonly posts: readonly SeedPost[]
}

export const THREADS: readonly SeedThread[] = [
  {
    key: 'th-ask-specific',
    channel: 'giving-feedback',
    title: 'The ask is the whole product and most of us write it last',
    body:
      'I have been reading the asks on Discover for a month and there is an obvious split. The projects that get long, specific reviews wrote a question somebody can fail to answer. The ones that say “let me know what you think” get a paragraph of politeness.\n\nMy own ask was “feedback welcome” for the first three weeks and I got eleven reviews that all said the art was nice. I changed it to a question about one tutorial beat and the next four reviews all answered that question, two of them with timestamps. Same project, same week, different question.',
    author: 'mirasolvang',
    kind: 'discussion',
    status: 'open',
    pinned: true,
    createdDaysAgo: 21,
    views: 1840,
    posts: [
      {
        author: 'tobiadeyemi',
        body:
          'The mechanism is that a specific ask gives the reviewer permission to be narrow. Without one, a reviewer feels obliged to have an opinion about everything, and the fastest way to have an opinion about everything is to say the art is nice.',
        daysAgo: 21,
        score: 31,
      },
      {
        author: 'fenelladoyle',
        body:
          'It is also a writing problem. “Let me know what you think” is not a question, it is a sign-off. Every good ask I have answered here has a verb and a number in it.',
        daysAgo: 20,
        parent: 0,
        score: 22,
      },
      {
        author: 'hugobitt',
        body:
          'As somebody who writes the bad kind: it is not laziness, it is that by the time I post I have stopped being able to see which part is uncertain. Everything feels equally unfinished.',
        daysAgo: 20,
        parent: 1,
        score: 28,
      },
      {
        author: 'gretalind',
        body:
          'That is the most useful thing in this thread. A prompt at posting time that asks “what would you be upset to hear on launch day” might get at it, because it is a fear question rather than a design question.',
        daysAgo: 19,
        parent: 1,
        score: 19,
      },
      {
        author: 'emmettquill',
        body: 'I definitely write better feedback when there is a question. Without one I do not know where to start and I end up writing something vague.',
        daysAgo: 18,
        score: 9,
      },
    ],
  },
  {
    key: 'th-blunt-without-cruel',
    channel: 'giving-feedback',
    title: 'How blunt is too blunt when the creator has clearly worked on it for years',
    body:
      'I reviewed a first novel chapter last week and my honest reading was that the first two pages were doing nothing. The author has rewritten it eleven times. I wrote the note anyway, and I have been uneasy about it since.\n\nWhere is the line between useful and cruel, and does it move depending on how long somebody has been working?',
    author: 'elowenprice',
    kind: 'question',
    status: 'answered',
    createdDaysAgo: 15,
    views: 1216,
    posts: [
      {
        author: 'casperlq',
        body:
          'The line is not how hard it lands, it is whether it is about the work or the person. “These two pages are doing nothing” is about the work. “You do not know how to open a chapter” is about the person, and it also tells them nothing they can act on.\n\nThe other half is that you owe them the location. A blunt note with a timecode is a gift. A blunt note without one is just a mood.',
        daysAgo: 15,
        accepted: true,
        score: 41,
      },
      {
        author: 'petranilsen',
        body:
          'As the person on the other side of notes like that: the eleven rewrites are irrelevant and it is not your job to account for them. What I cannot use is a note that softens the finding until I cannot find it. I would rather be told plainly and be annoyed for a day.',
        daysAgo: 14,
        parent: 0,
        score: 34,
      },
      {
        author: 'elowenprice',
        body: 'That helps, and it is close to what I did. I gave the location and the sentence I stopped on, which turned out to be the part they used.',
        daysAgo: 14,
        parent: 1,
        score: 12,
      },
      {
        author: 'danyero',
        body:
          'I am blunt by default and the thing I had to learn was to write what I tried before I write what I think. “I died twice on the second crossing and quit” lands very differently from “the difficulty is broken”, and it is the same note.',
        daysAgo: 13,
        score: 27,
      },
    ],
  },
  {
    key: 'th-dwell-time',
    channel: 'whetstone-meta',
    title: 'Can we see how long a reviewer actually spent with the build',
    body:
      'Two of the reviews on my project last week were clearly written without opening the build. They are not offensive, they are just empty, and they sit in the same list as a report somebody spent two hours on.\n\nI am not asking for punishment. I am asking whether the time spent could be visible, so I can read in the right order.',
    author: 'tayobalogun',
    kind: 'question',
    status: 'answered',
    createdDaysAgo: 12,
    views: 1493,
    posts: [
      {
        author: 'nkechiobi',
        body:
          'Time spent is already on every submission, under the headline. It is self-reported, which is worth knowing, but in practice people are honest about it because there is no reward for inflating it.\n\nThe thing that actually sorts your inbox is specificity: whether the note has a location, a reproduction or an artifact. A ten minute review with a timecode beats a two hour one without.',
        daysAgo: 12,
        accepted: true,
        score: 39,
      },
      {
        author: 'tayobalogun',
        body: 'I had not noticed it was there, which probably says something about where it sits.',
        daysAgo: 12,
        parent: 0,
        score: 8,
      },
      {
        author: 'emmettquill',
        body:
          'Speaking as somebody whose reviews are probably in the empty pile: seeing the time next to mine has actually changed how I write them. Four minutes looks like what it is.',
        daysAgo: 11,
        parent: 0,
        score: 26,
      },
      {
        author: 'gretalind',
        body:
          'This is the honest version of the argument for showing it. Not as a punishment, as a mirror.',
        daysAgo: 11,
        parent: 2,
        score: 21,
      },
    ],
  },
  {
    key: 'th-price-a-review',
    channel: 'pricing',
    title: 'What is a four hour review actually worth',
    body:
      'I have been quoting between one and two hundred for a written review that takes me three to five hours including the session. That feels low against my consulting rate and high against what people expect to pay here.\n\nWhat are other people charging, and how do you explain the number to somebody who has never bought a review before?',
    author: 'tobiadeyemi',
    kind: 'question',
    status: 'answered',
    createdDaysAgo: 18,
    views: 2107,
    posts: [
      {
        author: 'marcusweill',
        body:
          'Price it against the cost of the mistake, not against your hourly rate. A design for manufacture review costs me a day and saves somebody a tooling change, which is twenty thousand and six weeks. I charge four hundred and fifty and it is obviously cheap, and saying that out loud is how you explain it.',
        daysAgo: 18,
        accepted: true,
        score: 48,
      },
      {
        author: 'fenelladoyle',
        body:
          'I charge less than everybody in this thread and I take more work than I can do, which suggests I am underpriced. The thing that moved my rate was showing the work: yours, mine, what changed. Once somebody sees that format they stop comparing you to a comment box.',
        daysAgo: 17,
        parent: 0,
        score: 33,
      },
      {
        author: 'noorfarhat',
        body:
          'From the buyer side: what stops me is not the number, it is not knowing what I get. Four hundred and fifty with a named deliverable is easier to approve than one hundred and fifty with “a review”.',
        daysAgo: 17,
        parent: 0,
        score: 37,
      },
      {
        author: 'casperlq',
        body:
          'Agreed on the deliverable. My listing says timecoded pass, three chunks I would cut, runtime recovered. Nobody has ever asked me what they were buying.',
        daysAgo: 16,
        parent: 2,
        score: 24,
      },
      {
        author: 'ruitavares',
        body: 'I raised mine fifty per cent in June and the only thing that changed is that I stopped getting requests I did not want.',
        daysAgo: 15,
        score: 19,
      },
    ],
  },
  {
    key: 'th-recruit-testers',
    channel: 'playtesting',
    title: 'Recruiting testers who are not already people like you',
    body:
      'Every person who has played my co-op prototype so far designs games for a living. They all found the same interesting things and none of them found the thing my partner’s brother found in four minutes, which is that you cannot tell whose hand is whose.\n\nHow do you find testers outside your own field without it becoming a full time job?',
    author: 'tayobalogun',
    kind: 'discussion',
    status: 'open',
    createdDaysAgo: 9,
    views: 934,
    posts: [
      {
        author: 'ingridvos',
        body:
          'Ask people with a relevant job rather than a relevant hobby. For a co-op game about coordination under pressure, that is kitchen staff, theatre crew, anybody who works a service. They will not describe it in your vocabulary and that is the point.',
        daysAgo: 9,
        score: 31,
      },
      {
        author: 'mirasolvang',
        body:
          'I put a line in my ask saying I specifically want people who do not play this genre, and it worked better than I expected. Three of my most useful reviews start with a sentence apologising for not being the audience.',
        daysAgo: 8,
        parent: 0,
        score: 26,
      },
      {
        author: 'kwamemensah',
        body: 'I reviewed a roguelike last week having not played one since university, on exactly that invitation. It was oddly freeing to be told my ignorance was the deliverable.',
        daysAgo: 7,
        parent: 1,
        score: 22,
      },
      {
        author: 'suvikallio',
        body: 'Same for hardware. I want people who will use it badly, not people who will use it correctly.',
        daysAgo: 7,
        score: 14,
      },
    ],
  },
  {
    key: 'th-repro-template',
    channel: 'playtesting',
    title: 'The three line bug report, and why the third line is the one that matters',
    body:
      'What I tried, what happened, what I expected. Everybody knows the first two. The third is the one people skip and it is the one that turns a preference into a defect.\n\nWhen somebody writes what they expected, they usually also reveal where the expectation came from: a tooltip, a store page, the behaviour of the screen before. Half the time the fix is in that source rather than in the code.',
    author: 'gretalind',
    kind: 'discussion',
    status: 'open',
    createdDaysAgo: 26,
    views: 1677,
    posts: [
      {
        author: 'ruitavares',
        body:
          'This is why I ask for the expectation source in my reviews now. The last three API bugs I filed turned out to be documentation bugs, and I only found that out because I wrote down where I got the idea.',
        daysAgo: 26,
        score: 28,
      },
      {
        author: 'priyaram',
        body:
          'From the receiving end, the expectation line is the only part I can disagree with productively. If somebody tells me what happened, I fix it or I do not. If they tell me what they expected, we can have an actual conversation about which of us is wrong.',
        daysAgo: 25,
        parent: 0,
        score: 33,
      },
      {
        author: 'hugobitt',
        body: 'I have started copying these three lines into a note before I even start testing. It stops me writing “it broke”.',
        daysAgo: 24,
        parent: 1,
        score: 15,
      },
      {
        author: 'aleksynowak',
        body: 'A fourth line worth adding: how often. Once, often, always, or could not reproduce. “Could not reproduce” is still data and people are embarrassed to file it.',
        daysAgo: 23,
        score: 25,
      },
    ],
  },
  {
    key: 'th-contested-themes',
    channel: 'whetstone-meta',
    title: 'A contested theme and an agreed theme should not look the same',
    body:
      'On my dashboard, “five reviewers said the ending does not land” and “three said it lands, two said it does not” render identically: a bar with five points on it.\n\nThose are opposite instructions. One says fix it, the other says you have made a decision some people will dislike, which is often the correct outcome.',
    author: 'imanifrazier',
    kind: 'discussion',
    status: 'open',
    createdDaysAgo: 7,
    views: 812,
    posts: [
      {
        author: 'casperlq',
        body:
          'This is the thing I most want from the rollup. In a cutting room a split reaction is the most valuable signal there is, because it means the film is doing something. Averaging it away turns every film into the same film.',
        daysAgo: 7,
        score: 30,
      },
      {
        author: 'joonhobaek',
        body:
          'Same in design review. A contested theme is a decision surfaced. It should render as two numbers facing each other, not as one bar.',
        daysAgo: 6,
        parent: 0,
        score: 24,
      },
      {
        author: 'nkechiobi',
        body: 'And it needs to survive greyscale and a screen reader, which two facing numbers do and a coloured bar does not.',
        daysAgo: 6,
        parent: 1,
        score: 18,
      },
    ],
  },
  {
    key: 'th-hostile-content',
    channel: 'craft',
    title: 'Design your components against the ugliest real content you can find',
    body:
      'I spent a year watching three teams work around a component set I built, and almost every workaround was about content: a name too long, a list that was empty, a request that failed while something else was loading.\n\nSo Understudy specifies every component against hostile content first and pretty content second. It has made the screenshots worse and the products better.',
    author: 'joonhobaek',
    kind: 'showcase',
    status: 'open',
    project: 'understudy',
    createdDaysAgo: 24,
    views: 2288,
    posts: [
      {
        author: 'hanakuro',
        body:
          'The typographic version of this is to set your specimen in the worst string the system will ever hold, not in a word you chose. I use a real German compound noun and a real Thai sentence.',
        daysAgo: 24,
        score: 34,
      },
      {
        author: 'nkechiobi',
        body:
          'Add a failed state to the list. Almost nobody designs the error and then almost everybody ships it, so the error is the one screen in the product nobody has looked at.',
        daysAgo: 23,
        parent: 0,
        score: 29,
      },
      {
        author: 'lenahavel',
        body:
          'I ran the three switch test on Understudy this week and the table held. The toolbar around it did not, which is a funny and useful result: the specified thing survived and the unspecified thing did not.',
        daysAgo: 3,
        parent: 1,
        score: 26,
      },
      {
        author: 'priyaram',
        body: 'Adopting two components took an afternoon. The third one wanted to own my form layer, which is a bigger decision than the docs suggest.',
        daysAgo: 18,
        score: 17,
      },
    ],
  },
  {
    key: 'th-cold-start',
    channel: 'craft',
    title: 'Time your own quickstart on a machine that is not yours',
    body:
      'My quickstart claimed four minutes for two years. A reviewer timed it at nineteen on a clean Windows machine, and eleven of those minutes were one error message that describes a network failure for an SSL configuration problem.\n\nI had read that message a thousand times. I could not see it. Borrow somebody else’s machine, or borrow somebody else.',
    author: 'ruitavares',
    kind: 'discussion',
    status: 'open',
    project: 'ledgerline',
    createdDaysAgo: 2,
    views: 704,
    posts: [
      {
        author: 'gretalind',
        body:
          'The tab count is the number I would put on a quickstart page, not the minutes. Minutes vary by person. Tabs opened is a measure of how many questions your documentation failed to answer.',
        daysAgo: 2,
        score: 27,
      },
      {
        author: 'lenahavel',
        body: 'Six minutes and two tabs on a Mac, for the same tool. The platform gap is the real finding and it is not in the docs anywhere.',
        daysAgo: 1,
        parent: 0,
        score: 19,
      },
      {
        author: 'aleksynowak',
        body: 'I keep a nine year old laptop specifically for this. It is the most useful piece of hardware I own.',
        daysAgo: 1,
        score: 22,
      },
    ],
  },
  {
    key: 'th-show-brinehollow',
    channel: 'show-your-work',
    title: 'Four years, two rebuilds, and a tutorial that still loses four in ten',
    body:
      'Brinehollow is in open beta. The build is honest about what it is: the third street runs badly on integrated graphics, the salvage screen has a crash I am fixing this week, and the tutorial loses about forty per cent of first-time players inside ninety seconds.\n\nThat last number is the reason I posted it here rather than anywhere else. I know it is happening. I could not tell you which of the four beats does it, and I have watched the recording too many times to see it.',
    author: 'mirasolvang',
    kind: 'showcase',
    status: 'open',
    project: 'brinehollow',
    createdDaysAgo: 20,
    views: 3104,
    posts: [
      {
        author: 'tobiadeyemi',
        body:
          'Beat three. The meter moves while the text is on screen and the text loses, every time, for everybody. Beat two already waits for input and nobody has ever reported a problem with beat two.',
        daysAgo: 19,
        score: 44,
      },
      {
        author: 'mirasolvang',
        body: 'Shipped the fix in v0.7.1. Beat three now waits like its neighbour. Early numbers say the drop moved from forty per cent to about eighteen.',
        daysAgo: 9,
        parent: 0,
        score: 38,
      },
      {
        author: 'hugobitt',
        body:
          'I was one of the forty per cent. Quit at about forty seconds, came back a week later after reading the devlog, then played for two hours. The devlog was doing work the game should have been doing.',
        daysAgo: 9,
        parent: 1,
        score: 31,
      },
      {
        author: 'gretalind',
        body: 'Four runs on 0.7.1 and the tutorial held. The tide meter is still winning though, and that is a separate problem.',
        daysAgo: 6,
        score: 20,
      },
    ],
  },
  {
    key: 'th-nda-rounds',
    channel: 'playtesting',
    title: 'Is a non-disclosure agreement worth it for a twelve person round',
    body:
      'Publisher wants one on our next round. Twelve testers, two weeks, an unannounced game. My instinct is that it will cost me the honest testers and gain me nothing, because the people who would leak are the people who will sign anything.',
    author: 'danyero',
    kind: 'question',
    status: 'open',
    createdDaysAgo: 16,
    views: 1043,
    posts: [
      {
        author: 'marcusweill',
        body:
          'In hardware we sign them constantly and they are worth exactly what the relationship is worth. What they do buy you is a clear line about photographs, which matters more than you think when somebody posts a picture of an unannounced object.',
        daysAgo: 16,
        score: 24,
      },
      {
        author: 'gretalind',
        body:
          'I sign them and I have turned down two rounds where the agreement also claimed ownership of the findings. Read the clause about who owns the report. That is the one that should make you walk away, not the confidentiality.',
        daysAgo: 15,
        parent: 0,
        score: 29,
      },
      {
        author: 'danyero',
        body: 'The ownership clause is in ours. I had read past it twice.',
        daysAgo: 15,
        parent: 1,
        score: 17,
      },
    ],
  },
  {
    key: 'th-what-shipped',
    channel: 'whetstone-meta',
    title: 'Tell reviewers when their note ships, and tell them which build',
    body:
      'The single thing that has made me write more reviews here is the notification that says a note I wrote is in a released version, with the version number. It is a small message and it is the only proof that any of this is real.\n\nTwo requests. Show the changelog line, not just the version. And send it even when the creator forgot to credit anybody, because the link is already in the tracker.',
    author: 'fenelladoyle',
    kind: 'discussion',
    status: 'open',
    createdDaysAgo: 5,
    views: 621,
    posts: [
      {
        author: 'nkechiobi',
        body:
          'Agreed, and it should also work in the other direction. When a creator declines something of mine with a reason, that is useful and I would rather be told than discover it three weeks later.',
        daysAgo: 5,
        score: 27,
      },
      {
        author: 'priyaram',
        body:
          'As a creator I want the prompt at ship time, listing the notes the release closes. I have forgotten to credit people twice and both times it was because the tracker and the release were separate acts.',
        daysAgo: 4,
        parent: 0,
        score: 23,
      },
      {
        author: 'vikramsahni',
        body: 'Same. I ship from a terminal at eleven at night and the crediting step happens the next morning, if at all.',
        daysAgo: 4,
        parent: 1,
        score: 16,
      },
    ],
  },
]

/* -------------------------------------------------------------------------- */
/* 11. Test rounds                                                            */
/* -------------------------------------------------------------------------- */

export interface SeedRoundTask {
  readonly title: string
  readonly instructions: string
  readonly successHint: string
  readonly required: boolean
}

export interface SeedTaskResult {
  /** Index into the round’s task list. */
  readonly task: number
  readonly outcome: 'completed' | 'completed_with_help' | 'failed' | 'skipped' | 'blocked'
  readonly durationMs?: number
  readonly difficulty?: number
  readonly note?: string
}

export interface SeedInvitation {
  readonly user: string
  readonly source: 'invite' | 'applied' | 'open_link' | 'matched'
  readonly status: 'pending' | 'accepted' | 'declined' | 'started' | 'completed' | 'expired' | 'revoked'
  readonly daysAgo: number
  readonly startedDaysAgo?: number
  readonly completedDaysAgo?: number
  readonly results?: readonly SeedTaskResult[]
}

export interface SeedRound {
  readonly key: string
  readonly project: string
  readonly versionLabel: string
  readonly title: string
  readonly brief: string
  readonly status: 'draft' | 'recruiting' | 'running' | 'closed' | 'cancelled'
  readonly seats: number
  readonly isNda: boolean
  readonly reward: 'none' | 'credit' | 'key' | 'cash' | 'reputation'
  readonly startsDaysAgo: number
  readonly endsInDays: number
  readonly tasks: readonly SeedRoundTask[]
  readonly invitations: readonly SeedInvitation[]
}

export const ROUNDS: readonly SeedRound[] = [
  {
    key: 'rd-brinehollow-tutorial',
    project: 'brinehollow',
    versionLabel: 'v0.7.1',
    title: 'Tutorial round: first ninety seconds, nothing else',
    brief:
      'Play until the tutorial ends, then stop. Do not continue into a run, and please do not read the devlog first. I want the four beats and where you were looking during each of them. Twelve seats, one week.',
    status: 'running',
    seats: 12,
    isNda: false,
    reward: 'credit',
    startsDaysAgo: 8,
    endsInDays: 3,
    tasks: [
      {
        title: 'Reach the first card',
        instructions: 'Start a new game and stop when the first salvage card appears under your cursor.',
        successHint: 'You have the card and you know what it does.',
        required: true,
      },
      {
        title: 'Watch the tide meter fill once',
        instructions: 'Stay still and let the meter fill for the first time. Say what you thought it was measuring.',
        successHint: 'You can name what the meter counts.',
        required: true,
      },
      {
        title: 'Choose a door',
        instructions: 'Take either door and say why you chose it before you see what is behind it.',
        successHint: 'You made a choice for a reason you can state.',
        required: true,
      },
    ],
    invitations: [
      {
        user: 'tobiadeyemi',
        source: 'invite',
        status: 'completed',
        daysAgo: 8,
        startedDaysAgo: 7,
        completedDaysAgo: 7,
        results: [
          { task: 0, outcome: 'completed', durationMs: 22000, difficulty: 1 },
          {
            task: 1,
            outcome: 'failed',
            durationMs: 41000,
            difficulty: 4,
            note: 'Said it was a score. Corrected himself on the second run, unprompted.',
          },
          { task: 2, outcome: 'completed', durationMs: 15000, difficulty: 2, note: 'Chose the left door because the lamp was lit.' },
        ],
      },
      {
        user: 'gretalind',
        source: 'invite',
        status: 'completed',
        daysAgo: 8,
        startedDaysAgo: 6,
        completedDaysAgo: 6,
        results: [
          { task: 0, outcome: 'completed', durationMs: 19000, difficulty: 1 },
          { task: 1, outcome: 'failed', durationMs: 38000, difficulty: 4, note: 'Could not say what the meter counted until the alarm played.' },
          { task: 2, outcome: 'completed', durationMs: 12000, difficulty: 1 },
        ],
      },
      {
        user: 'suvikallio',
        source: 'applied',
        status: 'completed',
        daysAgo: 7,
        startedDaysAgo: 5,
        completedDaysAgo: 5,
        results: [
          { task: 0, outcome: 'completed_with_help', durationMs: 46000, difficulty: 3, note: 'Needed a second look at the boat before the card made sense.' },
          { task: 1, outcome: 'failed', durationMs: 52000, difficulty: 5 },
          { task: 2, outcome: 'skipped', difficulty: 3, note: 'Closed the game before the doors.' },
        ],
      },
      { user: 'hugobitt', source: 'open_link', status: 'started', daysAgo: 6, startedDaysAgo: 2 },
      { user: 'omarhaddad', source: 'matched', status: 'accepted', daysAgo: 5 },
      { user: 'beatricer', source: 'matched', status: 'pending', daysAgo: 4 },
      { user: 'emmettquill', source: 'open_link', status: 'declined', daysAgo: 6 },
    ],
  },
  {
    key: 'rd-kestrel-carry',
    project: 'kestrel-deck',
    versionLabel: 'DVT 2',
    title: 'Ten day carry round, eight units',
    brief:
      'Carry the unit daily for ten days and record what you do with it when you are not typing. Photographs of any wear, please, with a date. Units come back at the end of the round.',
    status: 'closed',
    seats: 8,
    isNda: true,
    reward: 'cash',
    startsDaysAgo: 24,
    endsInDays: -4,
    tasks: [
      {
        title: 'Daily carry log',
        instructions: 'One line a day: where it travelled, what it was next to, and how you folded it.',
        successHint: 'Ten lines at the end of ten days.',
        required: true,
      },
      {
        title: 'Wear photographs',
        instructions: 'Photograph the hinge, the front corners and the key legends on day one and day ten.',
        successHint: 'Two sets of photographs, same angles.',
        required: true,
      },
      {
        title: 'Fold count',
        instructions: 'Estimate how many times a day you fold it and describe the motion you use.',
        successHint: 'A number and a sentence about your hands.',
        required: false,
      },
    ],
    invitations: [
      {
        user: 'gretalind',
        source: 'invite',
        status: 'completed',
        daysAgo: 24,
        startedDaysAgo: 23,
        completedDaysAgo: 6,
        results: [
          { task: 0, outcome: 'completed', difficulty: 1, note: 'Ten lines, four flights, one wet commute.' },
          { task: 1, outcome: 'completed', difficulty: 2, note: 'Anodising worn through on the front left corner by day ten.' },
          { task: 2, outcome: 'completed', difficulty: 1, note: 'Six folds a day, always one handed, always the same direction.' },
        ],
      },
      {
        user: 'danyero',
        source: 'invite',
        status: 'completed',
        daysAgo: 24,
        startedDaysAgo: 22,
        completedDaysAgo: 14,
        results: [
          { task: 0, outcome: 'completed', difficulty: 1 },
          { task: 1, outcome: 'completed', difficulty: 2, note: 'Fine scratches on the inner key faces after six days.' },
          { task: 2, outcome: 'completed_with_help', difficulty: 3, note: 'Could not count folds. Estimated four a day.' },
        ],
      },
      {
        user: 'joonhobaek',
        source: 'invite',
        status: 'completed',
        daysAgo: 24,
        startedDaysAgo: 23,
        completedDaysAgo: 17,
        results: [
          { task: 0, outcome: 'completed', difficulty: 1, note: 'Stands it on edge beside the monitor. Falls over about once a day.' },
          { task: 1, outcome: 'completed', difficulty: 2 },
          { task: 2, outcome: 'completed', difficulty: 1, note: 'Two folds a day, both handed.' },
        ],
      },
      {
        user: 'vikramsahni',
        source: 'invite',
        status: 'completed',
        daysAgo: 24,
        startedDaysAgo: 22,
        completedDaysAgo: 21,
        results: [
          { task: 0, outcome: 'completed', difficulty: 1 },
          { task: 1, outcome: 'skipped', note: 'No camera that week.' },
          { task: 2, outcome: 'completed', difficulty: 2, note: 'Remapped the outer thumb key on day two and stopped reaching for it.' },
        ],
      },
      {
        user: 'hanakuro',
        source: 'invite',
        status: 'completed',
        daysAgo: 24,
        startedDaysAgo: 21,
        completedDaysAgo: 12,
        results: [
          { task: 0, outcome: 'completed', difficulty: 1 },
          { task: 1, outcome: 'completed', difficulty: 1, note: 'Shine on E, A and the spacebar after four days.' },
          { task: 2, outcome: 'completed', difficulty: 2 },
        ],
      },
      {
        user: 'ruitavares',
        source: 'applied',
        status: 'completed',
        daysAgo: 23,
        startedDaysAgo: 21,
        completedDaysAgo: 11,
        results: [
          { task: 0, outcome: 'completed', difficulty: 1 },
          { task: 1, outcome: 'completed', difficulty: 2 },
          { task: 2, outcome: 'blocked', note: 'Stopped carrying it after the configurator lost his layout.' },
        ],
      },
      { user: 'suvikallio', source: 'invite', status: 'expired', daysAgo: 24 },
      {
        user: 'aleksynowak',
        source: 'applied',
        status: 'completed',
        daysAgo: 23,
        startedDaysAgo: 20,
        completedDaysAgo: 10,
        results: [
          { task: 0, outcome: 'completed', difficulty: 1 },
          { task: 1, outcome: 'completed', difficulty: 1 },
          { task: 2, outcome: 'completed', difficulty: 1, note: 'Three folds a day, two handed, on a desk.' },
        ],
      },
    ],
  },
]

/* -------------------------------------------------------------------------- */
/* 12. Social graph                                                           */
/* -------------------------------------------------------------------------- */

/** follower → the people they follow. */
export const USER_FOLLOWS: Readonly<Record<string, readonly string[]>> = {
  mirasolvang: ['tobiadeyemi', 'gretalind', 'nkechiobi', 'danyero', 'casperlq', 'fenelladoyle'],
  tobiadeyemi: ['mirasolvang', 'priyaram', 'nkechiobi', 'joonhobaek', 'vikramsahni'],
  priyaram: ['nkechiobi', 'fenelladoyle', 'tobiadeyemi', 'lenahavel', 'joonhobaek'],
  casperlq: ['imanifrazier', 'kwamemensah', 'mirasolvang', 'petranilsen'],
  nkechiobi: ['ruitavares', 'joonhobaek', 'gretalind', 'vikramsahni', 'lenahavel'],
  danyero: ['mirasolvang', 'tayobalogun', 'gretalind', 'aleksynowak'],
  hanakuro: ['joonhobaek', 'beatricer', 'casperlq'],
  marcusweill: ['suvikallio', 'gretalind', 'joonhobaek'],
  fenelladoyle: ['elowenprice', 'petranilsen', 'priyaram', 'beatricer'],
  ruitavares: ['nkechiobi', 'lenahavel', 'aleksynowak', 'joonhobaek'],
  sofiabrandao: ['priyaram', 'ingridvos', 'noorfarhat'],
  aleksynowak: ['danyero', 'mirasolvang', 'ruitavares'],
  imanifrazier: ['casperlq', 'kwamemensah', 'mirasolvang'],
  joonhobaek: ['hanakuro', 'nkechiobi', 'lenahavel', 'ruitavares'],
  gretalind: ['mirasolvang', 'danyero', 'ruitavares', 'marcusweill', 'vikramsahni'],
  omarhaddad: ['priyaram', 'ingridvos', 'sofiabrandao'],
  elowenprice: ['petranilsen', 'fenelladoyle'],
  vikramsahni: ['nkechiobi', 'tobiadeyemi', 'ingridvos'],
  beatricer: ['hanakuro', 'fenelladoyle', 'elowenprice'],
  tayobalogun: ['mirasolvang', 'danyero', 'ingridvos'],
  suvikallio: ['marcusweill', 'aleksynowak'],
  noorfarhat: ['priyaram', 'sofiabrandao', 'fenelladoyle'],
  emmettquill: ['mirasolvang', 'danyero', 'gretalind', 'casperlq', 'tobiadeyemi'],
  lenahavel: ['ruitavares', 'joonhobaek', 'nkechiobi'],
  kwamemensah: ['casperlq', 'imanifrazier'],
  ingridvos: ['sofiabrandao', 'tobiadeyemi', 'vikramsahni'],
  petranilsen: ['elowenprice', 'fenelladoyle', 'casperlq'],
  hugobitt: ['mirasolvang', 'tobiadeyemi', 'ruitavares', 'gretalind', 'priyaram', 'nkechiobi'],
}

/** Extra project follows beyond the automatic “I reviewed it, I follow it” rule. */
export const PROJECT_FOLLOWS: Readonly<Record<string, readonly string[]>> = {
  brinehollow: ['emmettquill', 'hugobitt', 'imanifrazier', 'petranilsen', 'sofiabrandao', 'kwamemensah'],
  'lastlight-ferry': ['gretalind', 'emmettquill', 'tayobalogun'],
  tallyroot: ['sofiabrandao', 'omarhaddad', 'noorfarhat', 'fenelladoyle'],
  ferryman: ['nkechiobi', 'ingridvos', 'tobiadeyemi'],
  'kestrel-deck': ['ruitavares', 'suvikallio', 'danyero', 'lenahavel'],
  'the-last-loom': ['imanifrazier', 'petranilsen', 'elowenprice'],
  understudy: ['priyaram', 'hanakuro', 'lenahavel', 'nkechiobi'],
  cairn: ['ruitavares', 'lenahavel', 'priyaram', 'joonhobaek'],
  ledgerline: ['aleksynowak', 'lenahavel', 'gretalind'],
  'coastline-rebrand': ['beatricer', 'joonhobaek'],
  'the-salt-line': ['elowenprice', 'fenelladoyle'],
  'standing-order': ['ingridvos', 'omarhaddad'],
}

/** Bookmarks are private shelves, with a private note. */
export const BOOKMARKS: readonly { readonly user: string; readonly project: string; readonly note?: string }[] = [
  { user: 'gretalind', project: 'ferryman', note: 'Retest the rotation bug when 3.0.3 lands.' },
  { user: 'gretalind', project: 'tallyroot', note: 'Check the comma fix on a fresh account.' },
  { user: 'tobiadeyemi', project: 'kiln-and-kin', note: 'Two player onboarding is a different problem. Worth writing up properly.' },
  { user: 'nkechiobi', project: 'understudy', note: 'Candidate for the audit tool’s example fixtures.' },
  { user: 'priyaram', project: 'stagehand', note: 'Would pay for this. Revisit when they charge.' },
  { user: 'lenahavel', project: 'ledgerline', note: 'Ask Rui about the JSON schema before I build on it.' },
  { user: 'marcusweill', project: 'ember-lantern', note: 'Cold chamber numbers are worth reading properly.' },
  { user: 'hugobitt', project: 'brinehollow', note: 'Come back to this when I have two hours.' },
  { user: 'hugobitt', project: 'tallyroot' },
  { user: 'sofiabrandao', project: 'meterwise', note: 'Same pricing question as mine, different market.' },
  { user: 'petranilsen', project: 'harrowgate-press' },
  { user: 'emmettquill', project: 'lastlight-ferry', note: 'Try again on keyboard.' },
]

/** Tag follows drive a new reviewer’s Discover feed before they follow anybody. */
export const TAG_FOLLOWS: Readonly<Record<string, readonly string[]>> = {
  mirasolvang: ['roguelike', 'godot', 'pixel-art'],
  gretalind: ['steam-deck', 'ios', 'android', 'accessibility'],
  nkechiobi: ['accessibility', 'web', 'typescript'],
  ruitavares: ['developer-tools', 'rust', 'sqlite'],
  tobiadeyemi: ['ios', 'web', 'design-system'],
  hugobitt: ['ios', 'swift', 'developer-tools', 'roguelike'],
  emmettquill: ['roguelike', 'puzzle', 'co-op'],
  lenahavel: ['typescript', 'developer-tools', 'web'],
  joonhobaek: ['design-system', 'web', 'accessibility'],
  casperlq: ['documentary', 'short-form'],
  imanifrazier: ['short-form', 'music-video'],
  marcusweill: ['keyboards', 'camping'],
  suvikallio: ['camping', 'keyboards'],
  petranilsen: ['fiction', 'essay'],
  priyaram: ['freelancers', 'translators', 'web'],
}
