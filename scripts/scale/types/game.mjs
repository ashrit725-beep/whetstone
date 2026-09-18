/**
 * Games. Every project gets a genre, a unit of play (a run, a level, a
 * season), two named places, two mechanics and a resource, and everything
 * written about it draws on those, so twelve reviewers of one game all talk
 * about the same Drowned Market and the same grapple.
 */

const GENRES = [
  { g: 'roguelike', unit: 'run', mech: 'action', res: ['salt', 'scrap', 'embers', 'bone', 'coin'] },
  { g: 'deckbuilder', unit: 'run', mech: 'cards', res: ['coin', 'favour', 'ink', 'gold'] },
  { g: 'platformer', unit: 'level', mech: 'action', res: ['shards', 'feathers', 'coins'] },
  { g: 'puzzle game', unit: 'puzzle', mech: 'puzzle', res: ['moves', 'keys', 'hints'] },
  { g: 'city builder', unit: 'season', mech: 'sim', res: ['timber', 'grain', 'stone', 'coal'] },
  { g: 'survival game', unit: 'night', mech: 'survival', res: ['firewood', 'food', 'warmth', 'oil'] },
  { g: 'narrative adventure', unit: 'chapter', mech: 'story', res: ['trust', 'letters', 'memories'] },
  { g: 'tactics game', unit: 'battle', mech: 'tactics', res: ['supplies', 'morale', 'ammunition'] },
  { g: 'rhythm game', unit: 'track', mech: 'rhythm', res: ['combo', 'stars'] },
  { g: 'racing game', unit: 'race', mech: 'racing', res: ['boost', 'fuel'] },
  { g: 'metroidvania', unit: 'session', mech: 'action', res: ['shards', 'ore', 'charges'] },
  { g: 'fishing game', unit: 'trip', mech: 'fishing', res: ['bait', 'ice', 'coin'] },
  { g: 'farming sim', unit: 'season', mech: 'sim', res: ['seeds', 'water', 'coin', 'compost'] },
  { g: 'stealth game', unit: 'mission', mech: 'stealth', res: ['noise', 'lockpicks', 'light'] },
  { g: 'party game', unit: 'round', mech: 'party', res: ['points', 'tokens'] },
  { g: 'card game', unit: 'match', mech: 'cards', res: ['mana', 'favour', 'tokens'] },
  { g: 'twin-stick shooter', unit: 'run', mech: 'action', res: ['ammo', 'scrap', 'charge'] },
  { g: 'detective game', unit: 'case', mech: 'story', res: ['clues', 'leads', 'time'] },
  { g: 'management sim', unit: 'week', mech: 'sim', res: ['cash', 'staff', 'stock'] },
  { g: 'sailing game', unit: 'voyage', mech: 'sailing', res: ['rations', 'rope', 'fresh water'] },
  { g: 'bullet hell', unit: 'stage', mech: 'action', res: ['bombs', 'lives', 'graze points'] },
  { g: 'digging game', unit: 'dive', mech: 'survival', res: ['fuel', 'ore', 'oxygen'] },
]

const MECHS = {
  action: ['the dash', 'the parry', 'the grapple', 'the double jump', 'the wall-run', 'the charge shot', 'the dodge roll',
    'the ground pound', 'the tether', 'the lantern', 'the shield bash', 'the rewind', 'the slide', 'the throw',
    'the blink', 'the heavy attack', 'the hook', 'the glide'],
  cards: ['the card draw', 'the discard', 'the exhaust mechanic', 'the combo counter', 'the reroll', 'the upgrade forge',
    'the hand limit', 'the mulligan', 'the curse cards', 'the shop reroll'],
  puzzle: ['the swap', 'the rotate', 'the undo', 'the hint system', 'the colour mixing', 'the push blocks',
    'the mirror tiles', 'the time loop', 'the gravity flip', 'the wire routing'],
  sim: ['the zoning tool', 'the build queue', 'the trade screen', 'the crop rotation', 'the road tool', 'the upgrade tree',
    'the weather forecast', 'the worker assignment', 'the budget screen', 'the market prices'],
  survival: ['the crafting', 'the campfire', 'the stamina system', 'the inventory weight', 'the torch', 'the shelter building',
    'the hunger timer', 'the map drawing'],
  story: ['the dialogue wheel', 'the evidence board', 'the notebook', 'the journal', 'the interrogation', 'the letter writing',
    'the memory scenes', 'the choice timer'],
  tactics: ['the overwatch', 'the cover system', 'the initiative order', 'the flanking bonus', 'the retreat order',
    'the unit swap', 'the terrain height bonus'],
  rhythm: ['the hold notes', 'the timing window', 'the calibration', 'the double taps', 'the slide notes', 'the fever mode'],
  racing: ['the drift', 'the boost', 'the handbrake', 'the slipstream', 'the pit stop', 'the rewind'],
  fishing: ['the cast', 'the reel-in', 'the line tension', 'the depth finder', 'the lure swap', 'the net'],
  stealth: ['the lean', 'the distraction throw', 'the takedown', 'the light meter', 'the noise ring', 'the disguise'],
  party: ['the buzzer', 'the drawing tool', 'the voting round', 'the team shuffle', 'the sabotage cards'],
  sailing: ['the sail trim', 'the tacking', 'the anchor', 'the compass', 'the rigging repair', 'the chart table'],
}

const AREA_ADJ = ['Drowned', 'Lower', 'Salt', 'Ash', 'Sunken', 'Upper', 'Old', 'Burnt', 'Flooded', 'Silent', 'Copper',
  'Frozen', 'Glass', 'Hollow', 'Iron', 'Last', 'Long', 'North', 'Quiet', 'Red', 'Sour', 'Tangled', 'Weeping', 'White',
  'Black', 'Broken', 'Rusted', 'Painted', 'Grey', 'Green']
const AREA_NOUN = ['Market', 'Stacks', 'Orchard', 'Kiln', 'Quarry', 'Docks', 'Terraces', 'Archive', 'Mines', 'Chapel',
  'Vaults', 'Gardens', 'Causeway', 'Foundry', 'Mill', 'Bridge', 'Marsh', 'Wharf', 'Library', 'Tunnels', 'Canal',
  'Lighthouse', 'Greenhouse', 'Observatory', 'Barracks', 'Sewers', 'Rooftops', 'Harbour', 'Forest', 'Steppes']
const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth']
const CHARACTER = ['the Ferryman', 'the Cartographer', 'the Warden', 'the Tinker', 'the Lamplighter', 'the Archivist',
  'the Harbourmaster', 'the Glassblower', 'the Surveyor', 'the Beekeeper', 'the Magistrate', 'the Salt Widow',
  'the Keeper', 'the Postmistress', 'the Diver', 'the Collector', 'the Mayor', 'the Cook']
const ENGINES = ['Godot', 'Unity', 'Bevy', 'PICO-8', 'LÖVE', 'GameMaker', 'Unreal', 'Defold', 'MonoGame', 'Raylib',
  'Heaps', 'Pyxel']

const TOPICS = ['salvaging a drowned town', 'running a night ferry', 'keeping a lighthouse lit', 'mapping caves that move',
  'repairing radios for a village', 'herding goats across a glacier', 'delivering post in a flooded city',
  'rebuilding a burnt orchard', 'smuggling seeds past a border', 'running a bell foundry', 'tending a roadside café',
  'restoring a canal', 'surveying an island chain', 'a dying mining town', 'the last train out of the valley',
  'a lighthouse keeper’s final winter', 'bookbinding for a secret library', 'beekeeping on rooftops',
  'a travelling circus in debt', 'salt farming', 'a cartographer who is losing her sight', 'mending fishing nets',
  'running a pawn shop after the flood', 'a moth that hates light', 'digging for a lost bell', 'ferrying the dead',
  'building a raft from wreckage', 'haunted allotments', 'a city of stairs', 'pigeon racing', 'glassblowing',
  'a detective who cannot read', 'night shifts at a sorting office', 'a greenhouse on a comet', 'tidying a haunted house',
  'a kiln that remembers what it fired', 'the ice harvest', 'sheepdog trials', 'a chess club at the end of the world']
const PREMISE = ['the tide takes back whatever you do not carry out', 'the map redraws itself each night',
  'you can only move when the music plays', 'the city votes on your plans', 'you have one light and it is running out',
  'time only moves when you do', 'the weather decides your route', 'your tools get heavier as they improve',
  'you play both sides of the argument', 'nobody speaks your language', 'the villagers remember every lie',
  'the soundtrack is the difficulty setting', 'every mistake stays on the map', 'the day is exactly twelve minutes long',
  'you inherit the last player’s mess']
const PREMISE_BY = {
  cards: ['every card you play is gone for good', 'your deck is also your health'],
  action: ['enemies copy your last move', 'failing a run opens a new shortcut', 'you can only attack while moving'],
  puzzle: ['every room is a single-screen puzzle', 'the level is the controller', 'each solution breaks the next room'],
  fishing: ['the fish learn from you'],
  sailing: ['you steer by the stars and nothing else'],
  racing: ['the track is built by the player in front'],
  sim: ['the town remembers every road you tear up'],
}
const TWIST = ['one tide at a time', 'played with one hand', 'told through letters', 'with one rule change each night',
  'for two players on one keyboard', 'without a single line of text', 'in black and white', 'on a single screen',
  'in real time, very slowly', 'in under an hour', 'with no menus at all', 'drawn entirely in ink']
const TWIST_BY = {
  action: ['with no jump button', 'in ten-minute runs'],
  cards: ['with a deck of twelve cards'],
  puzzle: ['with no undo'],
}
const SETTING = ['a flooded market town', 'a mining village in winter', 'a chain of lighthouses', 'an orbital scrapyard',
  'a railway that never stops', 'a salt marsh', 'a city built on a glacier', 'a sinking library', 'a border checkpoint',
  'a greenhouse colony', 'a fog-bound harbour', 'the roofs of an old city', 'a canal town in the 1920s',
  'an abandoned theme park', 'a monastery on a cliff', 'a desert post office']
const GENRE_ADJ = ['small', 'short', 'slow', 'turn-based', 'hand-drawn', 'one-screen', 'pixel-art', 'low-poly',
  'two-player', 'wordless', 'grid-based', 'cosy', 'hard', 'tiny', 'melancholy', 'noisy', 'quiet', 'chunky']

const plural = (u) => (/(ch|sh|s|x)$/.test(u) ? `${u}es` : `${u}s`)

export default {
  slug: 'game',
  work: 'game', works: 'games', audience: 'player', verbed: 'played', verb: 'play',
  digital: true, interactive: true, next: 'build',
  devices: ['Steam Deck', 'mid-range laptop', 'desktop with a 3060', 'PC with an Xbox pad', 'PC with keyboard and mouse', 'MacBook Air',
    'PC with a Switch Pro controller', 'ultrawide monitor', 'Linux desktop', 'handheld at 800p', 'ten-year-old PC',
    'PC with a DualSense', 'laptop on battery', '4K TV', 'work laptop with integrated graphics'],

  world(R) {
    const genre = R.pick(GENRES)
    const mechs = R.some(MECHS[genre.mech], 3)
    const named = !['puzzle game', 'rhythm game', 'party game', 'card game', 'racing game'].includes(genre.g)
    const area = () => `the ${R.pick(AREA_ADJ)} ${R.pick(AREA_NOUN)}`
    const spots = named
      ? [area(), area(), area()]
      : R.some(ORDINAL, 3).map((o) => `the ${o} ${genre.unit}`)
    const res = R.pick(genre.res)
    return {
      genre: genre.g, unit: genre.unit, units: plural(genre.unit),
      spot: spots[0], spot2: spots[1], spot3: spots[2],
      feature: mechs[0], feature2: mechs[1], feature3: mechs[2],
      res, character: R.pick(CHARACTER), engine: R.pick(ENGINES),
      topic: R.pick(TOPICS), premise: R.pick(PREMISE.concat(PREMISE_BY[genre.mech] ?? [])),
      twist: R.pick(TWIST.concat(TWIST_BY[genre.mech] ?? [])), setting: R.pick(SETTING),
      genreAdj: R.pick(GENRE_ADJ),
    }
  },

  places: ['in {spot}', 'in {spot2}', 'on my {ord} {unit}', 'right after the tutorial', 'about {m} minutes in',
    'in the pause menu', 'on the results screen', 'on the upgrade screen', 'on the map', 'at the start of {spot2}',
    'on the way out of {spot}', 'the first time I used {feature}', 'during my longest {unit}', 'near the end of {spot}',
    'in the settings menu', 'on the title screen'],

  cats: {
    'Accessibility': ['access', ['the subtitle size', 'the colour-coded {res} markers', 'the screen shake', 'the flashing on hits',
      'the default text speed', 'the remapping screen', 'the audio cue for danger', 'the contrast on the map', '+the button prompts',
      'the hold-to-confirm inputs', 'the menu font']],
    'Art readability': ['visual', ['+the enemy silhouettes', 'the foreground clutter in {spot}', '+the pickup sprites', '+the projectiles',
      'the palette in {spot2}', 'the player against dark floors', '+the hazard tiles', 'the particle effects', 'the damage flash',
      'the lighting in {spot}', '+the interactable objects', 'the background parallax']],
    'Audio': ['audio', ['+the footstep sounds', 'the music in {spot}', 'the hit sound', 'the low-health warning', 'the ambient bed in {spot2}',
      '+the menu clicks', 'the pickup chime', 'the {res} sound', 'the sound on {feature}', 'the title music', 'the mix during busy moments',
      'the ending sting']],
    'Bug or defect': ['bug', ['{feature} sometimes fires twice on one press', 'the pause menu stays open behind the map',
      'the {res} counter resets when you quit to the menu', 'the controller prompts switch to keyboard icons at random',
      'the last checkpoint loads without the upgrade I had just bought', 'the camera clips into the wall in {spot}',
      'opening the inventory during a cutscene soft-locks the game', 'the music stops after the first {unit} and never comes back',
      'the settings do not save on exit', 'the tooltip sticks to the cursor after closing the shop',
      'an enemy spawned inside the scenery in {spot2}', 'alt-tabbing out turns the screen black on return',
      'the achievement for finishing {spot} fired at the start of it', 'rebinding {feature} unbinds the jump as well']],
    'Camera': ['feel', ['the camera in {spot}', 'the default zoom', 'the camera lag', 'the lookahead when moving fast',
      'the camera shake on landing', 'the framing during {feature}', 'the camera transitions between rooms',
      'the vertical framing in {spot2}', 'the camera when the screen gets busy']],
    'Combat and mechanics': ['feel', ['{feature}', '{feature2}', 'the timing on {feature}', 'the cooldown on {feature2}',
      'the way {feature} combines with {feature2}', 'the knockback', 'the recovery after {feature}', '+the hitboxes on larger enemies',
      'the {res} cost of {feature}']],
    'Controls and input': ['feel', ['the input buffer', '+the default bindings', 'the controller dead zone', 'the input on {feature}',
      'the mouse sensitivity', 'the menu navigation on a pad', 'the interact button', 'the double-tap for {feature2}',
      'the hold versus tap distinction', 'the control scheme on a {device}']],
    'Copy': ['copy', ['+the tooltips', '+the item descriptions', 'the line on the game over screen', '+the upgrade names', '+the menu labels',
      'the quest log wording', 'the text explaining {feature}', 'the {res} description', 'the tutorial prompts']],
    'Core loop': ['pacing', ['the loop between {units}', 'the rebuild phase', 'the minute-to-minute loop', 'the reward after each {unit}',
      'the risk of carrying more {res}', 'the choice at the end of each {unit}', 'the upgrade cadence', 'the downtime between {units}',
      'the first full loop']],
    'Difficulty curve': ['pacing', ['{spot2}', 'the jump from {spot} to {spot2}', 'the early {units}', 'the ramp in {spot3}',
      'the first ten minutes', 'the {ord} {unit}', 'the difficulty after the first upgrade', 'the final stretch of {spot}']],
    'Economy and progression': ['balance', ['the {res} economy', '+the upgrade costs', '+the shop prices', 'the unlock pace',
      'the meta-progression', '+the drop rates', 'the {res} income in {spot2}', 'the cost of respeccing']],
    'UI and HUD': ['visual', ['the health display', 'the {res} meter', 'the minimap', 'the inventory grid', '+the damage numbers',
      'the objective marker', 'the pause menu', '+the cooldown icons', 'the HUD in {spot}', 'the {unit} summary screen']],
    'Level design': ['pacing', ['{spot}', 'the layout of {spot2}', 'the shortcut back to the start', 'the first vertical section',
      '+the secret rooms', 'the signposting in {spot3}', 'the route through {spot}', 'the first open area', 'the last room of {spot2}']],
    'Missing': ['missing', ['a way to skip cutscenes', 'an option to remap keys', 'a restart button on the results screen',
      'a quick-save', 'a marker I could place on the map', 'a separate volume slider for music', 'a log of what the last upgrade did',
      'a practice mode', 'an undo on the last move', 'a way to see my {res} total outside the shop', 'a colourblind mode',
      'a pause during {feature}']],
    'Narrative': ['story', ['the opening scene', '{character}', '+the lore notes', 'the ending of {spot}',
      'the dialogue with {character}', 'the environmental storytelling in {spot2}', 'the premise', 'the last line of the {ord} {unit}',
      '+the letters you find']],
    'Multiplayer and netcode': ['perf', ['the rollback', 'the lobby', 'the sync on hits', 'the invite link', 'the rubber-banding',
      'the matchmaking wait', 'the co-op revive', 'the reconnect after a drop']],
    'Performance': ['perf', ['the frame rate in {spot}', '+the load times', 'the stutter entering {spot2}', 'the shader compile on first launch',
      'the memory use after an hour', 'the battery drain on a Steam Deck', 'the frame pacing', 'the load into each {unit}']],
    'Positioning': ['pitch', ['the store page', 'the trailer', 'the capsule art', 'the one-line pitch', '+the genre tags',
      'the first screenshot', 'the title', 'the short description']],
    'Save and progression loss': ['bug', ['quitting mid-{unit} loses the whole {unit}', 'the autosave does not fire after {spot}',
      'my settings reset after the update', 'a crash during saving wiped the slot', 'loading a save puts me back two {units}',
      'cloud saves overwrite the newer local save']],
    'Tutorial and onboarding': ['flow', ['the tutorial', 'the first {feature} prompt', 'the opening five minutes', '+the tutorial text boxes',
      'the practice area', 'the first time you lose', 'the introduction of {feature2}', 'the first shop visit']],
  },

  tagline: [
    'A {genreAdj} {genre} about {topic}.', 'A {genre} where {premise}.', 'A {genre} about {topic}, {twist}.',
    'A {genreAdj} {genre} set in {setting}.', 'A {genre} set in {setting}, {twist}.', 'A {genre} where {premise}, {twist}.',
    '{Topic}, as a {genreAdj} {genre}.', 'A {genreAdj} {genre} where {premise}.',
  ],

  summary: {
    origin: ['Started as a game jam entry about {topic} and kept going.', 'I have been building this on and off for {k} years.',
      'It began as a one-screen prototype of {feature}.', 'The first version was a paper prototype my partner hated.',
      'This grew out of a {genre} I abandoned in {year}.', 'I wanted a {genre} that respected an hour a night.',
      'The idea came from a week spent {hobby}.', 'Two of us, evenings and weekends, since {year}.'],
    how: ['Built in {engine}, solo.', 'Made in {engine}; music by a friend.', 'Written in {engine} with hand-drawn art.',
      '{Engine} for the game, a spreadsheet for everything else.', 'All the art is mine and all the bugs are too.',
      'Built in {engine} over {k} rewrites.', 'Made in {engine} by a team of {k2}.'],
    state: {
      concept: ['Nothing is playable yet; this is the pitch and some sketches of {spot}.', 'I have a design document and a paper version of {feature}.'],
      prototype: ['The first {k} {units} are playable; the rest is grey boxes.', 'Only {spot} [exists|exist:spot] so far, and {feature} [is|are:feature] still rough.',
        'Rough prototype: {feature} [works|work:feature], nothing else is final.'],
      beta: ['Content-complete up to {spot2}.', 'Beta: every {unit} is in, balance is not.', 'Everything through {spot3} [is|are:spot3] in and roughly balanced.'],
      release_candidate: ['Aiming to ship in {month}.', 'Release candidate; I am mostly fixing bugs now.', 'The build you see is close to what ships in {month}.'],
      shipped: ['Out on itch since {month}; working on the first update.', 'Released in {month}. Planning a free update around {spot2}.',
        'Shipped on Steam in {month}; this is the post-launch patch.'],
    },
    why: ['I am posting because {feature} [has|have:feature] split every tester so far.', 'I need fresh eyes on {spot2} before I build more of it.',
      'The first ten minutes are the part I can no longer see clearly.', 'Most testers stop in {spot}, and I want to know why.',
      'I am unsure whether the {res} economy is fun or just busy.'],
  },

  session: [
    '{K} {units} on a {device}, about {n} minutes.', 'Played for {n} minutes on a {device}.', '{N} minutes, {k} {units}, {device}.',
    'Got to {spot2} in about {n} minutes.', 'About {n} minutes on the current build, {device}.', 'Played {k} {units} over {n} minutes.',
    'Two sittings, {n} minutes in total, on a {device}.', 'Went in blind for {n} minutes.', '{N} minutes with a {device}, sound on.',
    'Played until my {ord} {unit} ended, roughly {n} minutes.', '{N} minutes on a {device}, no guide, no tutorial skips.',
  ],

  ask: {
    task: ['Start a {unit} and stop at {spot}.', 'Play {spot2} on a {device}.', 'Spend a {unit} using only {feature}.', 'Play until {spot3}, then stop.',
      'Play until you finish your {ord} {unit}.', 'Play the first fifteen minutes cold, no tutorial from me.',
      'Get to {spot2}, however long that takes.', 'Play one {unit} with the sound off.', 'Start a {unit}, quit halfway, and come back to it tomorrow.',
      'Play it on a controller if you have one.', 'Do the tutorial and stop there.', 'Lose on purpose once, then try to win.',
      'Play with somebody watching over your shoulder.', 'Play for twenty minutes and stop wherever you are.',
      'Skip everything optional and rush to {spot2}.', 'Read none of the text. Just play.', 'Use {feature} as much as you can.',
      'Try to finish a {unit} without using {feature}.', 'Play {spot} twice.', 'Play on a {device} if you have one.'],
    probe: ['Tell me whether {spot} was clear on first sight.', 'Say whether {feature} and {feature2} felt like they belong together.', 'Name the moment in {spot2} you nearly quit.', 'Tell me how {res} felt by the end of {spot}.', 'Say whether {character} made sense to you.',
      'Tell me whether your first loss felt like your fault or mine.', 'Name the exact spot where it stopped being fun.',
      'Tell me what you thought the goal was, in your own words.', 'Say whether the art reads as deliberate or unfinished.',
      'Tell me the first thing you did that the game did not expect.', 'Tell me when you stopped reading the tooltips.',
      'Tell me whether {feature} made sense without explanation.', 'Tell me whether you would have started another {unit} without me asking.',
      'Name the button you kept pressing that does nothing.', 'Tell me whether you ever used {feature2}, and why or why not.',
      'Say where the difficulty turned from a challenge into a wall.', 'Tell me whether {spot2} [holds|hold:spot2] its pace.',
      'Say whether the results screen made you want to retry or quit.', 'Name the thing you assumed was a bug and was not.',
      'Tell me whether the {res} economy felt tight or just stingy.', 'Tell me what you expected {character} to do.',
      'Say whether {spot} [is|are:spot] readable at a glance.'],
  },

  changelog: ['{Feature} now has a short buffer, so early presses count.', 'Rebalanced {res} costs in {spot2}.',
    'The tutorial explains {feature} before asking you to use it.', 'Fixed the soft-lock when opening the inventory mid-cutscene.',
    'Controller prompts no longer switch to keyboard icons.', 'Added a restart button to the results screen.',
    'Music in {spot} now fades instead of cutting.', '{Spot2} [has|have:spot2] a shortcut back to the start.', 'Separate volume sliders for music and effects.',
    'The {res} meter is larger and has a number.', 'Autosave after every {unit}.', 'Cut the second tutorial pop-up.',
    'Screen shake can be turned off.', 'Frame pacing fixed on the Steam Deck.', 'New ending for {spot3}.',
    '{Feature2} costs less {res} and recovers faster.', 'Colourblind-safe markers for {res}.'],

  suggestion: ['Let me skip the intro to {spot}', 'Show the {res} total outside the shop', 'Add a practice mode for {feature}',
    'Explain {feature2} before the first {unit}', 'Separate music and effects volume', 'Autosave after {spot2}',
    'Make {feature} rebindable', 'Add a restart button to the results screen', 'Mark visited rooms in {spot3}',
    'Give {character} a second line of dialogue', 'Turn off screen shake', 'Slow the {res} drain in {spot2}',
    'A map marker I can place myself', 'Let {feature} cancel into {feature2}'],
}
