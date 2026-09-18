/**
 * The forum: six channels, seven hundred threads, a few thousand replies.
 *
 * Titles are written per channel because a question about kerning does not
 * belong under Pricing. Bodies and replies are assembled from a stance, a
 * piece of experience and a piece of advice, each drawn from the channel's own
 * vocabulary and filled with the medium, the numbers and the tools the thread
 * is about. A thread in Show your work is about a real project in the index,
 * by title, and its replies talk about that project's own screens and parts.
 *
 * The old stock was thirty-six reply sentences for 3,605 posts, so the same
 * "I would not change anything until somebody complains twice" turned up
 * fifty-two times.
 */

/**
 * What a thread is about, as a coherent set: a kind of work, the parts of it
 * people argue about, and the tools they use. Drawing the three independently
 * put "the mix" in Figma and "kerning" in a CLI.
 */
const PROFILES = [
  { medium: 'game', media: 'games', things: ['the tutorial', 'the difficulty curve', 'the save system', 'the first level', 'controller support',
    'the store page', 'the trailer', 'the HUD', 'the first ten minutes', 'the death screen', 'the sound mix', 'the pause menu'],
    tools: ['Godot', 'Unity', 'a spreadsheet', 'OBS', 'itch.io', 'Discord', 'a paper notebook', 'Steam playtest'] },
  { medium: 'web app', media: 'web apps', things: ['onboarding', 'the empty state', 'error copy', 'the settings screen', 'form validation',
    'the pricing page', 'navigation', 'the sign-up flow', 'the dashboard', 'the import step', 'search'],
    tools: ['Figma', 'a spreadsheet', 'Notion', 'Loom', 'Google Forms', 'a Trello board', 'Airtable'] },
  { medium: 'mobile app', media: 'mobile apps', things: ['onboarding', 'notifications', 'the tap targets', 'offline mode', 'the paywall',
    'permission prompts', 'the tab bar', 'dark mode', 'the store screenshots', 'the widget'],
    tools: ['TestFlight', 'Figma', 'Xcode', 'a spreadsheet', 'Loom', 'the Play Console'] },
  { medium: 'short film', media: 'short films', things: ['the cold open', 'the mix', 'the colour grade', 'the second act', 'subtitles',
    'the thumbnail', 'the ending', 'the title card', 'the pacing', 'the score', 'the interview framing'],
    tools: ['Resolve', 'Premiere', 'a shared doc', 'Final Cut', 'a paper notebook', 'Frame.io'] },
  { medium: 'essay', media: 'essays', things: ['the opening paragraph', 'the title', 'the ending', 'the argument', 'footnotes',
    'the second section', 'the examples', 'paragraph length', 'the first line', 'the subheads'],
    tools: ['a shared doc', 'Scrivener', 'Obsidian', 'a paper notebook', 'Google Docs', 'iA Writer'] },
  { medium: 'newsletter', media: 'newsletters', things: ['the subject line', 'the intro', 'the links section', 'the sign-off', 'send time',
    'the welcome email', 'issue length', 'the archive page'], tools: ['Buttondown', 'Substack', 'a shared doc', 'Ghost', 'a spreadsheet'] },
  { medium: 'website', media: 'websites', things: ['the landing page', 'the hero', 'navigation', 'load times', 'the contact form',
    'the pricing page', 'the about page', 'the footer', 'the case studies', 'mobile layout'],
    tools: ['Figma', 'Webflow', 'Astro', 'a spreadsheet', 'WordPress', 'Eleventy'] },
  { medium: 'identity', media: 'identities', things: ['kerning', 'the grid', 'the logo at small sizes', 'the colour palette', 'the type pairing',
    'the icon set', 'the presentation deck', 'the secondary colours', 'the wordmark'], tools: ['Figma', 'Glyphs', 'Illustrator', 'a risograph', 'InDesign', 'pencil and paper'] },
  { medium: 'typeface', media: 'typefaces', things: ['spacing', 'kerning', 'the italic', 'the figures', 'the bold weight', 'the specimen',
    'the lowercase g', 'the punctuation'], tools: ['Glyphs', 'FontLab', 'a proofing sheet', 'InDesign', 'pencil and paper'] },
  { medium: 'CLI', media: 'CLIs', things: ['the README', 'error messages', 'the flag names', 'the install step', 'the default output',
    'the config file', 'exit codes', 'the help text', 'the changelog'], tools: ['a shared doc', 'GitHub issues', 'a spreadsheet', 'asciinema', 'a Makefile'] },
  { medium: 'board game', media: 'board games', things: ['the rulebook', 'the first turn', 'the scoring', 'the card layout', 'the box',
    'player count', 'setup time', 'the endgame'], tools: ['a print-and-play PDF', 'a spreadsheet', 'paper prototypes', 'Discord', 'a notebook'] },
  { medium: 'hardware prototype', media: 'hardware prototypes', things: ['the enclosure', 'battery life', 'the buttons', 'the BOM', 'the packaging',
    'the charging port', 'the firmware updates', 'the manual'], tools: ['KiCad', 'Fusion 360', 'a spreadsheet', 'a Prusa', 'a notebook'] },
  { medium: 'pitch deck', media: 'pitch decks', things: ['the pricing slide', 'the first slide', 'the market sizing', 'the ask', 'the competitor slide',
    'the traction slide', 'the team slide'], tools: ['a spreadsheet', 'Keynote', 'Notion', 'Google Slides', 'Pitch'] },
  { medium: 'podcast', media: 'podcasts', things: ['the intro', 'the edit', 'the mix', 'episode length', 'the show notes', 'the cold open',
    'the trailer', 'the ad reads'], tools: ['Audacity', 'Descript', 'Reaper', 'Riverside', 'a shared doc'] },
]
/** What playtests actually run on, whatever is being tested. */
const TEST_TOOLS = ['OBS', 'Zoom', 'Discord', 'Google Meet', 'a phone on a tripod', 'Lookback', 'a screen recorder', 'Microsoft Teams', 'a webcam']
const SITE_THINGS = ['the inbox', 'the note composer', 'the Discover filters', 'notifications', 'the reputation page', 'the project page',
  'bounties', 'the roadmap board', 'search', 'the feed', 'the ask field', 'the profile page', 'the reply threading', 'the build timeline']
const PLAYABLE = new Set(['game', 'web app', 'mobile app', 'board game', 'hardware prototype', 'website', 'CLI'])
const ROLE = ['tester', 'reviewer', 'client', 'first-time player', 'friend', 'stranger', 'regular', 'colleague', 'reader', 'user']
const TIME = ['a week', 'two weeks', 'a month', 'a weekend', 'three sprints', 'a season', 'six weeks', 'an afternoon', 'two evenings']
const ADJ = ['small', 'rough', 'early', 'nearly finished', 'second', 'first public', 'very early', 'text-heavy', 'short', 'long']
const NEED = ['need type', 'stage', 'project type', 'how many reviews it has', 'the ask', 'last update', 'grit level', 'time needed']
const CURRENCY = ['£', '$', '€']
const MONTH = ['January', 'March', 'May', 'June', 'September', 'October', 'November', 'February', 'April', 'August']

/** Everything a thread's title, body and replies can refer to. */
export function threadContext(R, channel, project) {
  // Playtests are run on things people play or operate.
  const pool = channel === 'playtesting' ? PROFILES.filter((x) => PLAYABLE.has(x.medium)) : PROFILES
  const prof = R.pick(pool)
  // A thread is mostly about one thing, so its title, opening post and replies keep returning to it.
  const main = R.pick(prof.things)
  const ctx = {
    medium: prof.medium, media: prof.media, thing: () => (R.chance(0.72) ? main : R.pick(prof.things)), thing2: () => R.pick(prof.things),
    tool: () => R.pick(prof.tools),
    role: () => R.pick(ROLE), roles: () => `${R.pick(ROLE)}s`, time: () => R.pick(TIME), adj: () => R.pick(ADJ), need: () => R.pick(NEED),
    few: () => String(R.between(3, 12)), n: () => String(R.between(3, 40)), k: () => String(R.between(2, 6)),
    ord: () => R.pick(['second', 'third', 'fourth', 'fifth']), year: () => String(R.between(2016, 2025)),
    ...(channel === 'playtesting' ? { tool: () => R.pick(TEST_TOOLS) } : {}),
    pct: () => String(R.between(12, 70)), price: () => `${R.pick(CURRENCY)}${R.pick([5, 10, 15, 20, 25, 30, 40, 50, 60, 80, 100, 150])}`,
    hours: () => String(R.between(2, 12)), month: () => R.pick(MONTH),
  }
  // Meta threads are about the site itself, whatever the poster makes.
  if (channel === 'whetstone-meta') {
    const site = R.pick(SITE_THINGS)
    ctx.thing = () => (R.chance(0.75) ? site : R.pick(SITE_THINGS))
    ctx.thing2 = () => R.pick(SITE_THINGS)
  }
  if (project) {
    const w = project.ctx
    Object.assign(ctx, {
      title: project.title, work: w.work, unit: w.unit, units: w.units, spot: w.spot, spot2: w.spot2, feature: w.feature,
      feature2: w.feature2, device: w.device, audience: w.audience, verb: w.verb,
      spotPlural: w.spotPlural, spot2Plural: w.spot2Plural, featurePlural: w.featurePlural, feature2Plural: w.feature2Plural,
      medium: w.work, media: w.works,
    })
  }
  return ctx
}

export const TITLE = {
  playtesting: [
    'How many {roles} before the results stop changing?', 'Recruiting {few} testers for a {adj} {medium}, no NDA',
    'What do you ask a {role} to do first?', 'Do you watch the session or read the notes afterwards?',
    'Testers keep telling me about {thing} and I asked about something else', 'Paying testers: flat fee or per session?',
    'How long is too long for a first session on a {medium}?', 'Nobody finishes the build. Is that the build or the ask?',
    'Do you tell testers what the {medium} is before they open it?', 'Session notes: transcript, summary, or both?',
    'What do you do with a tester who is too kind?', 'Running a session with {few} people at once, worth it?',
    'Remote versus in the room, for a {adj} {medium}', 'How do you stop a session running long?',
    'Testers who ask what you wanted them to say', 'The second session is always worse. Why?',
    'Do you rerun the same testers on the next build?', 'Screen recording without making people self-conscious',
    'When do you stop testing {thing} and ship?', '{Thing} [keeps|keep] coming up and I do not believe it', 'Getting testers outside your own circle',
    'One-hour sessions are too long, change my mind', 'What counts as a finished session?', 'Testing a {medium} on hardware you do not own',
    'Do you brief testers on what is unfinished?', 'A tester found the problem in ninety seconds. Now what?',
    'Using {tool} to run playtests: good idea?', '{Few} sessions in and every tester stalls at {thing}', 'Testing {thing} with people who hate {media}',
    'How do you write a playtest script for a {medium}?', 'Is {n} minutes enough for a first session?', 'First playtest with strangers next week. Advice?',
    'Silent sessions versus think-aloud', 'When a tester says it is “fine”', 'Recording sessions in {tool}: consent and storage',
    'How do you pick which note to act on first?', 'Testers for a {medium} aimed at children', 'Asking testers to break {thing} on purpose',
  ],
  'giving-feedback': [
    'How do you say the hard thing without losing the person?', 'Is “I would cut it” useful or lazy?', 'Reviewing {media} when you do not make them',
    'When the creator argues back, what do you do?', 'Do you soften the first note on purpose?', 'How specific is too specific?',
    'Saying nothing is worse than saying it badly', 'Reviewing a friend’s {medium}', 'What makes a note actionable rather than an opinion?',
    'Do you read the other reviews before you write yours?', 'The creator asked about {thing} and the problem is elsewhere',
    'How long should a review of a {medium} take?', 'Praise: how much, and where?', 'When you cannot tell whether {thing} [is|are] deliberate',
    'Reviewing a {medium} you would never use', 'Do you rewrite a note before you send it?', 'How do you handle a review you got wrong?',
    'Blunt is not the same as unkind', 'A review that is all blockers', 'What do you owe somebody who asked for help?',
    'Reviewing a {adj} {medium}', 'Do you say what you liked, or only what to change?', 'The note nobody wants to write',
    'How many points is a good review?', 'When the ask is wrong, do you answer it anyway?', 'Notes on {thing}: how technical should you get?',
    'I spent {hours} hours on one review. Too much?', 'Reviewing in a second language', 'How do you review {thing} without redesigning it?',
    'The difference between a bug report and a review', 'When a creator thanks you and changes nothing', 'Feedback on {media} from non-experts',
    'Should reviews include a suggested fix?', 'My most useful review was three sentences', 'Reviewing the same {medium} twice',
  ],
  pricing: [
    'What do you charge for a review of a {medium}?', 'Bounties: what is a fair number for {few} hours?', 'Free feedback or paid feedback, which gets used?',
    'Charging for a second look', 'Rate for a first-time client versus a returning one', 'Do you price by the hour or by the job?',
    'Nobody pays for {thing}. Should they?', 'Subscription or one-off, for a {adj} {medium}', 'How do you say no to a low offer?',
    'Pricing when you are the only one doing it', 'Raising my rate after two years. How?', 'What does a review actually cost you to write?',
    'Bounty went unclaimed. Was the number wrong?', 'Does a low price signal low quality here?', 'Splitting a bounty between reviewers',
    'What is an expert review of a {medium} worth?', 'Charging friends', 'Invoicing across currencies for small amounts',
    'The first time you charged, what did you pick?', 'Why is everyone pricing at the same number?', 'Should bounties expire?',
    'Discounting for early builds', 'Is {price} a month a business or a hobby?', 'Pricing a {medium} for {pct} per cent of my audience',
    'I charged {price} and felt bad. Should I?', 'Pay-what-you-want for {media}: does it work?', 'Pricing a commission you have never done before',
    'Tips versus fees for reviewers', 'Launch discount or no launch discount?', 'How much should a first {medium} cost?',
    'Refund policy for a {medium}', 'Charging for {thing} separately',
  ],
  craft: [
    '{Thing} at small sizes', 'When is a grid worth the constraint?', 'How do you know when {thing} [is|are] finished?', 'Kerning by eye or by number',
    'The cut nobody notices is the one that works', 'Tolerance stack-up on a first prototype', 'Why [does|do] {thing} look wrong at 2x?',
    'Writing error messages people read', 'How much sound is too much sound?', 'Naming things: how long do you spend?',
    'Do you build the hard part first?', 'The {adj} version is always better and I do not know why', 'When to stop refactoring',
    'Drawing at nine pixels', 'What makes a transition feel fast?', 'Colour that survives greyscale', 'Line length on a phone',
    'How do you test contrast properly?', 'The difference between sparse and empty', 'Do you design the failure state first?',
    'When a constraint stops helping', 'Typography for interfaces versus typography for reading', 'Making something feel heavy',
    'One weight or three?', 'How do you handle {thing} when the content is user-written?', 'The last ten per cent takes as long as the first ninety',
    'Getting {thing} right in a {medium}', 'Is {tool} good enough for {thing}?', 'Rebuilding {thing} for the third time',
    'What does good {thing} look like to you?', 'Learning {thing} from {media} you love', 'Constraints I set myself for a {adj} {medium}',
    'The smallest change that improved my {medium} most', 'How do you keep {thing} consistent across a whole {medium}?',
    'Reference collections: how do you keep them?', 'Doing {thing} without a designer',
  ],
  'show-your-work': [
    '{Title}: be blunt about {spot}', '{Title}, second round. Is {spot2} clearer?', 'First time showing {title}', '{Title}: rebuilt {spot} twice',
    'Three months into {title}', '{Title} has no tutorial on purpose', 'Killed my favourite part of {title}. Was I right?',
    '{Title}: is {feature} doing anything?', 'Showing {title} before it is ready', '{Title} after a month of notes',
    '{Title}: two directions for {spot2} and I cannot choose', 'Made {title} in a weekend and cannot tell if it is any good',
    '{Title}, version four', 'Six people have seen {title}. Now you.', '{Title}: shipped it, here is what broke', '{Title} and the trouble with {spot}',
    'Looking for one honest opinion on {title}', '{Title}: too plain?', 'Is {spot2} in {title} too long?',
  ],
  // Show your work without a project attached: the thread is the work.
  'show-your-work-plain': [
    '{Adj} {medium}, first time showing it', 'Rebuilt this {medium} twice. Is the third version better?', 'A {adj} {medium}. Be blunt.',
    'First build after a long break', 'Cut this from eleven minutes to six. Too far?', 'Showing the prototype before the render',
    'Two directions and I cannot choose', 'This is the ugly version that works', 'Redesigned the first screen. Better or busier?',
    'Killed my favourite feature. Was I right?', 'A one-page site for something that does not exist yet', 'Sound pass on a build nobody has heard',
    'Version four. The first three are not worth showing.', 'Made this in a weekend and cannot tell if it is any good',
    '{Thing} [is|are] the part I keep changing', 'Small, offline, and probably too plain', 'Before and after a month of notes',
    'First paid project, and I am terrified', 'My first {medium} in {time}', 'Is {thing} too much for a {adj} {medium}?',
  ],
  'whetstone-meta': [
    'Can we filter Discover by {need}?', 'A way to mark a note as already actioned', 'Feature request: saved searches that notify',
    'The grit scale needs an explanation on the card', 'Reporting a thread versus blocking a person', 'Can reviewers see what changed since their note?',
    'Bug: {thing} on a narrow window', 'Should expert reviews be visibly separate?', 'A digest instead of individual notifications',
    'Can we see who marked a note helpful?', 'Sorting Discover by what nobody has answered', 'Why does the feed show me the same projects?',
    'Draft state for a review in progress', 'Can bounties be split?', 'Moderation: what happens after a report?', 'Keyboard shortcuts for the inbox',
    'Would anyone use a weekly review quota?', 'Export my own notes', 'The reputation number needs a breakdown', 'Can we mute a channel?',
    'Threading on feedback replies', 'A public changelog for the site itself', 'Tags are getting messy', 'Can I hide a project without deleting it?',
    'Search finds the project but not the note', 'Notifications for replies to my notes only', 'Linking a thread to a build',
    'A “not for me” button on Discover', 'Let creators pin one note', 'Show time spent on the review card', 'Filter the inbox by {need}',
    'Timestamps on points for {media}', 'Asks with a word limit?', 'Can I follow a reviewer?', 'Dark mode contrast on the inbox',
  ],
}

const OPEN = {
  default: ['Asking because I have done this with two {media} now and got a different answer each time.', '{Thing} has been bothering me for {time}.',
    '<Short version|In short|Basically>: I do not know what <normal looks like|is normal|people usually do> for {media}.', 'I have read the obvious advice about {thing} and it did not help.',
    'Genuine question about {thing}, not a rhetorical one.', 'I <have a view|have an opinion|have thoughts> on {thing} but I want to hear <yours|other people’s> first.',
    'I have handled {thing} <the same way|one way> since my first {medium} and <never checked|never questioned it>.', '<Somebody|A reviewer|A friend> told me the opposite about {thing} <last {month}|recently|this week>.',
    'Small thing, but {thing} [keeps|keep] coming up.', 'Not urgent, <just curious|mostly curious|but I am curious> how <other people|others|you all> handle {thing}.', 'Second time I have run into this with a {medium}.',
    'I got {thing} wrong on my last {medium} and want to understand why.', 'Asking after a <conversation|call|review> about {thing} went badly.',
    '<Probably|Possibly|Maybe> a beginner question about {thing}.', 'I have changed my mind about {thing} twice this {month}.', 'Writing this <down|up> <mostly|partly> to work out what I think about {thing}.',
    '{Few} people, {few} answers, so I am asking here.', 'Context: {medium}, <small team|two of us|just me>, <no budget|tiny budget|some savings>, <long timeline|no deadline|a deadline in {month}>.', 'I work <alone|solo|on my own> on {media}, so I have <nobody|no one> to <check this against|sanity-check this with>.',
    'I have been avoiding this decision for {time}.', 'It happened again <yesterday|this week|on Friday> with {thing}.', 'I make {media}, <mostly on my own|usually solo>, <mostly|largely> in {tool}.',
    '{K} {media} in, and I still have not settled this.', 'I keep <a spreadsheet|notes|a log> of this <stuff|kind of thing> and the numbers are not helping with {thing}.',
    'Following on from a <review|note|comment> I got on {thing}.', '{Thing} came up in a <session|call|review> last {month}.'],
  'show-your-work': ['Posting {title} here because I have stopped being able to see it.', 'This is {title}, and {spot} [is|are:spot] new.',
    '{Title} has been in progress for {time} and this is the first time strangers will see {spot}.', 'Here is where {title} is at after {time}.',
    'I have been quiet about {title} for too long.', 'Sharing {title} after a round of notes about {feature}.', '{Title} is a {work} I have been making on and off for {time}.',
    'I rebuilt {spot} in {title} this {month}.', 'First post about {title}; {feature} [is|are:feature] the part I am proudest of.'],
}
OPEN['whetstone-meta'] = ['Small request about {thing}.', 'Something I keep running into with {thing}.', 'Not sure if this is a bug or intended: {thing}.',
  'Feature request, and I know there are bigger things on the list.', 'I use {thing} every day and this keeps coming up.', 'Following on from the last thread about {thing}.']
const MID = {
  default: ['My instinct is to do the <simplest|smallest|cheapest> thing with {thing} and see what breaks.', 'The last time I <tried this|changed {thing}> it cost me {time}.',
    'What I <have been doing|do now> with {thing} works, but I cannot <defend|explain> it.', 'The advice I can find assumes a <team|studio|budget>, and there is one of me.',
    'I can see <the argument|the case> both ways for {thing} and neither is winning.', 'The constraint <on {thing}|here> is <time rather than money|time, not money>, if that changes <the answer|anything>.',
    'It matters because <the next decision|what I do with {thing2}> depends on it.', 'I have a workaround in {tool}, which is how I know <it is a problem|something is off>.',
    'Every example I <can find|have seen> is a much bigger {medium}.', 'The version of {thing} I have now is fine, and fine is not <what I want|enough>.',
    'Nobody has complained about {thing}, which is not the same as it being right.', 'The people I would ask are all doing something different with {thing}.',
    'It is cheap to change {thing} now and <expensive|painful> later.', 'I tried {thing} the obvious way and it <felt wrong|did not work|made {thing2} worse>.',
    'Half of me thinks {thing} [is|are] a real problem and half thinks it is nerves.', 'I have a deadline <in {month}|next {month}|at the end of {month}>, which is probably clouding this.',
    'The thing I am <optimising for|chasing> <might be|may well be> the wrong thing.', 'It went fine on my last {medium}, which makes me <suspicious|nervous>.',
    'I would rather hear one specific experience <than a principle|with {thing} than general advice>.', 'At the moment I use {tool} for <it|{thing}> and it is <creaking|not coping|getting in the way>.',
    'My last {medium} got {n} reviews and {k} of them mentioned {thing}.', 'I spent {hours} hours on {thing} last week and I am not sure it <moved|helped>.',
    'The {roles} I asked split roughly {pct} per cent one way.', 'For {media} specifically, I have not found a good answer <on {thing}|yet>.',
    'I suspect the answer for a {adj} {medium} is different.', 'Two {roles} have told me {thing} [is|are] fine and one has told me [it is|they are] not.',
    'I have rebuilt {thing} {k} times now.', '{Thing} [is|are] the last big decision before I ship.', 'I keep going back and forth between {thing} and {thing2}.',
    'In {tool} it looks fine; with real {roles} it does not.', 'Changing {thing} would push everything back {time}.'],
  'whetstone-meta': ['At the moment I work around it with a browser bookmark.', 'On a phone it is worse.', 'It is small, but I hit it several times a day.',
    'I checked the help page and could not find anything.', 'Other people have mentioned {thing} in passing.', 'It would mostly help people reviewing a lot.'],
  'show-your-work': ['The part I trust least is {spot}.', 'I rebuilt {spot2} after the last round and I cannot tell if it is better.',
    '{Feature} [is|are:feature] new and I am not sure it earns its place.', 'Everyone who tries it stalls somewhere around {spot}.',
    'I am about to spend {time} on {spot2} and want to know if that is the right place.', 'The notes so far have mostly been about {feature}.',
    'I think {spot2} [is|are:spot2] too long, but I have lost the ability to tell.', '{Feature2} [was|were:feature2] the last thing I added and it might be the first to go.'],
}
const ASK = {
  default: ['What do you do about {thing}?', 'How do you decide on {thing}?', 'Has anyone found a rule for {thing} that holds?', 'Tell me I am wrong about {thing}.',
    'What am I missing about {thing}?', 'How do you handle {thing} on a {adj} {medium}?', 'What did you do with {thing} on your last {medium}?',
    'Is there a number people use for {media}?', 'What would you do with {thing} in my place?', 'Anyone got a counter-example from a {medium}?',
    'Where is the line on {thing} for you?', 'What did you settle on for {thing}, and did it hold?', 'Am I solving the wrong problem with {thing}?', 'Does anybody handle {thing} differently on purpose?',
    'How do you know when {thing} [is|are] done?', 'What changed your mind about {thing}?', '[Has|Have] {thing} ever gone badly for you?',
    'Is the obvious answer the right one for a {medium}?', 'What do you wish somebody had told you about {thing}?', 'Anything worth reading on {thing}?',
    'How do you handle it with {media}?', 'Does it change for a {adj} {medium}?', 'How would you explain {thing} to a new {role}?',
    'What would you try first with {thing}?', 'Is {tool} the wrong tool for {thing}?', 'Would you change {thing} or {thing2} first?',
    'How long do you give {thing} before moving on?', 'Is this a {medium} problem or a me problem?'],
  'show-your-work': ['Be blunt about {spot}.', 'What would you cut from {spot2}?', 'Does {spot} make sense without me explaining it?',
    'Where did you stop?', 'Is {feature} worth keeping?', 'What would you change first?', 'Would you {verb} it again?', 'Is {spot2} too long?'],
  'whetstone-meta': ['Would anyone else use this?', 'Is this already possible and I missed it?', 'Or is there a reason it works this way?',
    'Happy to be told this is a bad idea.', 'Curious if others hit this too.', 'Would this help anyone else reviewing {media}?'],
}

/** Lower-case a template's first word when something is joined in front of it; names and "I" stay as they are. */
function lower(tpl) {
  if (/^\{Thing2?\}/.test(tpl)) return `{t${tpl.slice(2)}`
  if (/^(I\b|I’|\{)/.test(tpl)) return tpl
  return tpl[0].toLowerCase() + tpl.slice(1)
}

/** Sometimes a sentence is joined on rather than started cold. */
const LEADS = ['For context, ', 'Honestly, ', 'Also, ', 'To be fair, ', 'The thing is, ', 'Right now, ', 'In practice, ', 'Part of it: ']
function leadIn(R, tpl) {
  if (!R.chance(0.45)) return tpl
  return R.pick(LEADS) + lower(tpl)
}

/** Context sentences built from parts, so seven hundred opening posts do not share their middles. */
const CTX = {
  state: ['[has|have] been rewritten {k} times', '[is|are] the part {roles} mention most', '[works|work], but I cannot defend [it|them]',
    '[looks|look] fine in {tool} and wrong in practice', '[is|are] holding up everything else', '[has|have] not changed since {month}',
    '[is|are] where most of my notes land', '[feels|feel] finished to me and to nobody else', '[is|are] the one thing two {roles} disagreed about',
    '[keeps|keep] growing', '[is|are] the oldest part of the {medium}', 'took {time} and still [is|are] not right'],
  deadline: ['a launch', 'a festival deadline', 'the next build', 'a client review', 'the end of {month}', 'a talk in {month}', 'a funding deadline'],
  constraint: ['no budget', 'one pair of hands', 'a day job', 'two collaborators who disagree', 'a very patient partner', 'a laptop that is falling apart'],
  approach: ['cutting it back', 'moving it earlier', 'asking {few} {roles}', 'copying what bigger {media} do', 'leaving it alone for {time}',
    'rebuilding it in {tool}', 'removing it entirely', 'splitting it in two', 'doing the opposite of my instinct'],
  outcome: ['it made {thing2} worse', 'nobody noticed', 'it helped a little', 'I am back where I started', 'the {roles} split down the middle',
    'it fixed one thing and broke another', 'I could not tell the difference', 'it took far longer than I planned'],
}
function builtMid(R) {
  switch (R.between(0, 2)) {
    case 0: return `{Thing} on my {medium} ${R.pick(CTX.state)}.`
    case 1: return `I have {time} before ${R.pick(CTX.deadline)}, and ${R.pick(CTX.constraint)}.`
    default: return `I tried ${R.pick(CTX.approach)}, and ${R.pick(CTX.outcome)}.`
  }
}

/** A thread's body: an opening, some context, a question. Returned as templates. */
export function threadBody(R, channel, attempt) {
  const open = OPEN[channel] ?? OPEN.default
  const mid = MID[channel] ?? MID.default
  const ask = ASK[channel] ?? ASK.default
  // Plenty of people skip the preamble, and not every post ends in a question,
  // but every opening post says at least two things.
  const parts = []
  const meta = channel === 'whetstone-meta'
  if (R.chance(0.65) || channel === 'show-your-work' || meta) parts.push(R.pick(open))
  parts.push(leadIn(R, !meta && channel !== 'show-your-work' && R.chance(0.55) ? builtMid(R) : R.pick(mid)))
  if (!meta && (parts.length < 2 || (R.chance(0.3) && attempt < 20))) parts.push(R.chance(0.5) ? builtMid(R) : R.pick(MID.default))
  if (R.chance(0.85) || parts.length < 2) parts.push('\n\n' + R.pick(ask))
  return parts
}

/* ----------------------------------------------------------------- posts */

/** Lead-ins that join onto the sentence after them, so they never stand alone as a repeated line. */
const POST_LEAD = ['Late to this, but ', 'For what it is worth, ', 'Honestly, ', 'From the {role} side, ', 'In my experience, ',
  'Speaking as someone who got {thing} wrong, ', 'Short version: ', 'Counterpoint: ', 'One data point: ', 'Mild disagreement: ',
  'Having done this with {k} {media}, ', 'Same here, and ', 'I used to think the opposite, but ', 'Small caveat: ']

/**
 * Sentences built from parts rather than picked whole: when, what somebody
 * did to which part of their work, how, and what came of it.
 */
const EXP = {
  when: ['On my last {medium}', 'Last {month}', 'Two {media} ago', 'When I started out', 'On a {adj} {medium} last year',
    'The first time I tried this', 'Early on', 'On the {medium} I am making now', 'A couple of {media} back', 'Last time round',
    'On my {ord} {medium}', 'In {year}', 'Back in {month}', 'On a client {medium} last {month}', 'For a {adj} {medium} I made in {year}',
    'Halfway through my last {medium}', 'The week before a launch', 'On a {medium} I have since abandoned', 'Years ago',
    'On a {medium} with {few} people involved', 'The last time I had a deadline', 'On my first paid {medium}'],
  did: ['rebuilt', 'cut', 'tested', 'rewrote', 'ignored', 'moved', 'simplified', 'redid', 'agonised over', 'shipped without',
    'paid someone to look at', 'asked {few} {roles} about', 'started with', 'overhauled', 'second-guessed', 'threw away', 'reworked',
    'split up', 'tidied up', 'rushed', 'polished', 'fought with', 'argued about'],
  how: ['from scratch', 'in {tool}', 'twice', 'over {time}', 'in a weekend', 'without telling anyone', 'after a {role} complained',
    'at the last possible moment', 'with {few} {roles} watching', 'three days before launch', 'in one long evening', 'with a friend', '', ''],
  result: ['it took {time}', 'nobody noticed', 'every {role} noticed', 'it was worth it', 'I regretted it within {time}',
    'it paid off within {time}', 'the {roles} stopped mentioning it', 'I still am not sure it helped', 'it saved the whole thing',
    'I learned to do it earlier next time',
    'it fixed more than I expected', 'it made {thing2} worse', 'the reviews got kinder', 'I would do it again', 'it changed very little',
    'it was the best decision on that {medium}', 'I learned more from that than from anything else', 'it cost me {time} I did not have'],
}
const ADVICE = {
  lead: ['I would', 'Personally I would', 'If it were mine I would', 'My advice: ', 'I think you should', 'I would probably',
    'In your place I would', 'Honestly, just', 'I would try to', 'What I would do is', 'For a {medium} like this I would'],
  verb: ['leave {thing} alone', 'fix {thing}', 'test {thing} with strangers', 'simplify {thing}', 'ship {thing} as it is',
    'redo {thing} from scratch', 'time-box {thing} to {time}', 'cut {thing} in half', 'get {thing} in front of {few} {roles}',
    'write down why {thing} [is|are] the way [it is|they are]', 'move {thing} earlier', 'drop {thing}'],
  when: ['before anything else', 'after the next build', 'until somebody complains', 'for {time}', 'and see what happens',
    'rather than the other way round', 'before you touch {thing2}', 'and stop there', 'this week', ''],
}
const OPINION = ['{Thing} [matters|matter] more than {thing2} for a {medium}.', 'Most {media} lose people at {thing}, not {thing2}.',
  'For {media}, {thing} [is|are] usually the problem rather than {thing2}.', 'People underrate {thing} on a {adj} {medium}.',
  '{Thing} [is|are] where I would spend {time}.', 'Nobody outside the project cares about {thing2} as much as you do.',
  'The {roles} I trust all say {thing} first.', 'On a {medium}, {thing} [tells|tell] you more than {thing2} does.']

function experience(R) {
  return `${R.pick(EXP.when)}, I ${R.pick(EXP.did)} {thing} ${R.pick(EXP.how)}, and ${R.pick(EXP.result)}.`
}
function advice(R) {
  const lead = R.pick(ADVICE.lead)
  const joiner = lead.endsWith(' ') ? lead : `${lead} `
  return `${joiner}${R.pick(ADVICE.verb)} ${R.pick(ADVICE.when)}.`
}

const POST_A = {
  playtesting: ['I stopped at {few} testers on my last {medium} and the results had settled by the fourth.',
    'I watch live and take notes in {tool}; reading notes afterwards loses the pauses.', 'My first sessions were <75|90|100|two hours|an hour and a half> and far too long.',
    'Paying a flat fee got me better {roles} than paying per session.', 'I tell testers nothing beyond the genre and it has worked for {k} {media}.',
    'The second session is worse because you are testing whether they remember {thing}, not whether it works.',
    'I rerun one tester from the last round and bring in new ones for the rest.', 'Testers who are too kind usually give themselves away by saying “fine” about {thing}.',
    'I record the screen in {tool} and never the face, and people relax.', 'Silent sessions taught me more about {thing} than think-aloud, oddly.',
    'Every tester stalling at {thing} is the result; the build is telling you something.', 'I ask them to break {thing} and they suddenly get honest.',
    'Strangers from a {medium} Discord were far more useful than friends.', 'I schedule <thirty|forty|forty-five|fifty> minutes and stop <on time|when the timer goes>, even mid-sentence.',
    'On my {medium} the first {few} sessions all got stuck on {thing}.', 'I brief testers on {thing} only when it is obviously unfinished.',
    'I use {tool} for sign-ups and it cut no-shows by about {pct} per cent.', 'Remote sessions work fine for a {medium} if you can see their hands or screen.'],
  'giving-feedback': ['I lead with the one thing I would change and put the praise after it.', 'I spend about {n} minutes on a review, longer only if the ask needs it.',
    'I read the other reviews after writing mine, never before.', 'The notes I have seen acted on all named a place and a thing, usually {thing}.',
    'When a creator argues back I ask what they expected {thing} to do instead.', 'Three points is my usual; more and the important one gets lost.',
    'I review {media} I would never make, and I say so at the top.', 'I soften the tone, never the content.',
    'I rewrote a note on {thing} three times last week and the first version was the right one.', 'I say what I liked when it is specific enough to keep.',
    'If the ask is wrong I answer it in one line and then say what I would ask instead.', 'I got a review of a {medium} badly wrong once and said so in the replies.',
    'The most useful note I ever received was about {thing} and was two sentences long.', 'I keep a note of how long each review takes me; it averages {n} minutes.',
    'For {media} I try to separate taste from defects in the first line.', 'I mention my setup whenever it might matter to {thing}.'],
  pricing: ['I charge {price} for a first look and more for a second, since the second takes longer.', 'Hourly for anything open-ended, fixed for anything with an ask.',
    'My first paid review was {price} and I undercharged by half.', 'The bounties that go unclaimed here are usually vague, not cheap.',
    'I raised my rate by {pct} per cent and lost one client out of {few}.', 'Friends pay, but less, and I tell them the real number.',
    'Paid feedback on {media} gets acted on more in my experience, possibly because it cost something.', 'I invoice in the client’s currency and eat the conversion.',
    'Everyone prices at the same number because nobody wants to be the one who asked for more.', 'A low price on a {medium} reads as “early” rather than “bad”.',
    'Bounties should expire after <a month|six weeks|a fortnight>, otherwise they sit there looking abandoned.', 'I discount early builds and say why on the invoice.',
    'For a {medium} I price by the hour, capped at {hours} hours.', 'I charged {price} for my last {medium} review and it felt about right.'],
  craft: ['I test {thing} at the smallest size first and work up.', 'A grid has earned its keep on every {medium} I have made longer than a page.',
    'I build the hard part first so the easy parts can bend around it.', 'For {thing}, I trust my eye first, then check the numbers, then my eye again.',
    'A transition feels fast when it starts fast, whatever the total time.', 'Greyscale is the most honest test of {thing} I know.',
    'I design the failure state first now; it tells me what the happy path is for.', 'I spend longer naming things than I would admit at work.',
    'Constraints help until you start designing around them rather than with them.', 'User-written content breaks {thing} every time; plan for the longest name you can find.',
    'I stopped refactoring when I noticed I was doing it to avoid {thing}.', 'The last ten per cent of {thing} took me {time} on my last {medium}.',
    'I keep references for {thing} in {tool} and look at them before I start, never during.', 'I rebuilt {thing} three times and the second version was best.',
    'In {tool} I keep a page per {medium} with every {thing} decision and why.', 'Most of the problems I had with {thing} turned out to be spacing problems.'],
  'show-your-work': ['I got stuck at {spot} too, about a minute in.', 'Got through to {spot2}; {feature} [is|are:feature] the best thing in it.',
    '{Spot} made sense to me, but only on the second {unit}.', 'I would keep {feature} and cut {spot2} in half.',
    'On a {device}, {spot} [was|were:spot] hard to read.', 'The first minute of {title} is stronger than you are letting on.',
    'I did not notice {feature} until someone in this thread mentioned it.', '{Spot2} [is|are:spot2] where I stopped, if that helps.',
    '{Title} is further along than the post makes it sound.', 'I bounced at {spot} the first time and came back later.',
    'I like it, and I would not change {feature} at all.', '{Title} reminds me of a {medium} I loved, in a good way.',
    '{Feature2} confused me until I reached {spot2}.', 'I think {spot} [is|are:spot] the strongest part, not {spot2}.'],
  'whetstone-meta': ['+1, I would use this every week.', 'I asked for this last {month} as well.', 'This would save me a lot of scrolling in {thing}.',
    'I hit the same thing with {thing} on a phone last {month}.', 'I think part of this exists in {thing}, but it is well hidden.', 'I would use it, but only if it is opt-in.',
    'Not sure about this one; it could make {thing} noisier.', 'This would help reviewers more than creators, I think.', 'Yes, and let us sort {thing} by it too.',
    'I would rather have this than another change to {thing}.', 'Counterpoint: the way {thing} works now stops people gaming it.',
    'I reported something last {month} and heard back within a day, for what it is worth.', 'For reviewers this matters more than for most.',
    'Same here with {thing}, most days.', 'I would use it for {thing} straight away.', 'Seconding this; {thing} is where I feel it most.',
    'I had assumed {thing} already did this.', 'It has bitten me twice this {month}.', 'A small version of this in {thing} would already help.'],
}

const POST_B = {
  default: ['Whatever you choose for {thing}, write down why; you will want it in six months.', 'The specific number I use is {n}, and I got there by being wrong twice.',
    'Do the smallest version of {thing} and let people complain.', 'I would do the opposite of what you describe, and I could be wrong.',
    'Watch out for {thing}; [it gets|they get] much worse on a bigger {medium}.', 'The answer changed for me when I started working alone.',
    'What helped was asking somebody outside the work about {thing}.', 'The question is not which, it is when.',
    'It takes about twice as long as you think, and it is worth it.', 'I stopped worrying about {thing} and nothing bad happened.',
    'The mistake I made was treating {thing} as permanent.', 'Try it for {time} and see; that is cheaper than deciding.',
    'The deciding factor is usually {thing}.', 'You will know within {time}; just start.', 'Careful: {thing} [looks|look] reversible and [is|are] not.',
    'Pick the version of {thing} you will still maintain when you are tired.', 'I would not change {thing} until somebody complains twice.',
    'Decide fast; the cost is the deciding, not the doing.', 'Ask the next {few} {roles} and go with the majority.',
    'I tried {tool} for this and went back to a notebook.', 'For a {medium} this size I would not bother yet.',
    'The {roles} will tell you, if you let them finish.', 'I keep a list of these and the simple option wins about {pct} per cent of the time.',
    'Put {thing} in front of {few} strangers before you decide.', 'I would split the difference and revisit {thing} in {month}.'],
  'show-your-work': ['I would move {spot2} earlier and see what happens.', 'Could {feature} appear before {spot}?',
    'If you only fix one thing, make it {spot}.', 'Honestly I would ship this version and learn from real {audience}s.',
    'Maybe try it on a {device}; that is where {spot} fell apart for me.', 'Would {verb} it again after the next build.',
    'Keep going; this is better than the notes suggest.', 'I would cut {feature2} and see if anyone notices.', 'Try {spot} without {feature2} for a week.'],
  'whetstone-meta': ['Even a simple version would help.', 'An opt-out would cover the people who hate it.',
    'Would be good to hear from a moderator on this.', 'Happy to try it if it gets built.', 'Maybe start with it in {thing} only.',
    'A setting would do; it does not need to be the default.', 'I would keep {thing} as it is and add this beside it.',
    'Start small: {thing} first, then see.', 'Whatever happens, please do not make {thing} slower.'],
}

const POST_CLOSE = ['Good luck with the {medium}.', 'Curious what you settle on for {thing}.', 'Report back?', 'Hope that helps.', 'Your call, though.',
  'That is my experience, anyway.', 'Could be wrong.', 'Might be different for {media}.', 'Happy to go into more detail on {thing}.', 'Worked for me on {k} {media}.']

/** A reply: something from experience, a piece of advice or an opinion, maybe a sign-off, and sometimes a lead-in. */
export function postParts(R, channel, attempt) {
  const A = POST_A[channel] ?? POST_A.craft
  const B = POST_B[channel] ?? POST_B.default
  const project = channel === 'show-your-work'
  const meta = channel === 'whetstone-meta'
  const built = !project && !meta
  const say = () => (built && R.chance(0.55) ? experience(R) : R.pick(A))
  const tell = () => (built && R.chance(0.5) ? (R.chance(0.6) ? advice(R) : R.pick(OPINION)) : R.pick(meta || project || R.chance(0.6) ? B : POST_B.default))
  const parts = []
  const shape = R.rnd()
  if (shape < 0.45) {
    parts.push(say())
    if (attempt < 30) parts.push(tell())
  } else if (shape < 0.75) {
    parts.push(say())
  } else {
    parts.push(tell())
    if (R.chance(0.5)) parts.push(say())
  }
  if (built && R.chance(0.28) && attempt < 30) {
    parts[0] = R.pick(POST_LEAD) + lower(parts[0])
  }
  if (R.chance(0.14) && attempt < 20) parts.push(R.pick(meta || project ? POST_CLOSE.filter((c) => !/\{(media|medium|thing|k)\}/.test(c)) : POST_CLOSE))
  return parts
}
