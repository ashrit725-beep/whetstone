/** Video: a runtime, a structure, named sequences, and a first fifteen seconds. */

const FORMS = [
  { form: 'short documentary', unit: 'watch', segs: ['the cold open', 'the interview section', 'the archive sequence', 'the closing montage', 'the workshop scenes'] },
  { form: 'music video', unit: 'watch', topics: ['a song about leaving a seaside town', 'a folk song about the canal', 'a breakup song shot in one launderette', 'a track about night buses', 'a song about a grandmother’s kitchen'], segs: ['the opening shot', 'the second chorus', 'the bridge', 'the one-take section', 'the final shot'] },
  { form: 'video essay', unit: 'watch', segs: ['the intro', 'the second chapter', 'the case study section', 'the conclusion', 'the counter-argument'] },
  { form: 'short film', unit: 'watch', segs: ['the opening scene', 'the kitchen scene', 'the argument', 'the drive', 'the last scene'] },
  { form: 'product film', unit: 'watch', topics: ['a folding e-bike', 'a small-batch hot sauce', 'a repairable kettle', 'an open-source keyboard', 'a note-taking app', 'a ceramics studio’s new glaze line'], segs: ['the hook', 'the walkthrough section', 'the founder interview', 'the pricing card', 'the end card'] },
  { form: 'YouTube tutorial', unit: 'watch', topics: ['wiring a doorbell', 'grading log footage', 'sharpening chisels', 'setting up a home server', 'baking a first sourdough loaf', 'restringing a guitar'], segs: ['the intro', 'the setup section', 'the main walkthrough', 'the troubleshooting part', 'the outro'] },
  { form: 'travel film', unit: 'watch', segs: ['the drone opener', 'the market sequence', 'the train section', 'the night shots', 'the ending'] },
  { form: 'animated short', unit: 'watch', topics: ['a lighthouse keeper and a moth', 'a lost umbrella', 'two pigeons and a sandwich', 'a robot learning to garden', 'a night at the laundrette'], segs: ['the title sequence', 'the first scene', 'the chase', 'the quiet middle', 'the final gag'] },
  { form: 'trailer', unit: 'watch', topics: ['a small narrative game', 'a documentary about a bell foundry', 'a theatre show', 'a short horror film', 'a puzzle game'], segs: ['the first beat', 'the title card', 'the gameplay montage', 'the final sting', 'the release date card'] },
  { form: 'cooking video', unit: 'watch', topics: ['making laminated dough at home', 'a week of lunches from one chicken', 'hand-pulled noodles', 'my grandmother’s jollof', 'fermenting hot sauce', 'a Sunday roast for one'], segs: ['the ingredients shot', 'the prep section', 'the cooking sequence', 'the tasting', 'the recipe card'] },
  { form: 'explainer', unit: 'watch', topics: ['how tides work', 'why buses bunch', 'how a heat pump works', 'what a council actually does', 'how bread rises', 'why the sky is blue at noon and orange at dusk'], segs: ['the hook', 'the problem section', 'the animated diagram', 'the example', 'the call to action'] },
  { form: 'mini-documentary series episode', unit: 'watch', segs: ['the recap', 'the cold open', 'the main interview', 'the B-roll montage', 'the cliffhanger'] },
]
const SUBJECTS = ['a family of ferry pilots', 'the last glassworks in the region', 'a night market', 'a bell foundry', 'a repair café',
  'a community swimming pool', 'a beekeeper on a council estate', 'a letterpress studio', 'the tide', 'a village choir',
  'a dockyard crane driver', 'a sourdough bakery at 4am', 'a youth boxing club', 'a pigeon fancier', 'an allotment in winter',
  'a lighthouse being decommissioned', 'a tailor retiring after forty years', 'a skate park built by its skaters', 'a river',
  'a salt marsh', 'a canal boat family', 'a record shop', 'a mountain rescue team', 'an ice rink', 'a knife sharpener']
const PEOPLE = ['the ferry pilot', 'the baker', 'the grandmother', 'the shop owner', 'the coach', 'the narrator', 'the foreman',
  'the tailor', 'the teacher', 'the youngest brother', 'the harbourmaster', 'the choir leader']
const TOOLS = ['Resolve', 'Premiere', 'Final Cut', 'DaVinci Resolve', 'Avid', 'Premiere Pro']
const CAMERAS = ['a borrowed FX3', 'a second-hand GH5', 'an iPhone', 'a Blackmagic Pocket', 'an old C100', 'a Super 8 camera', 'a Sony A7 III']
const ADJ = ['short', 'quiet', 'slow', 'handheld', 'black-and-white', 'nine-minute', 'wordless', 'one-take', 'low-budget', 'loud']

const tc = (R) => `${R.between(0, 5)}:${String(R.between(0, 59)).padStart(2, '0')}`

export default {
  slug: 'video',
  work: 'film', works: 'films', audience: 'viewer', verbed: 'watched', verb: 'watch',
  digital: false, interactive: false, next: 'cut',
  devices: ['phone with the sound low', 'laptop with headphones', 'TV', 'phone in a feed', 'pair of studio monitors', 'laptop with no headphones',
    'iPad in bed', '4K monitor', 'phone on mute with captions', 'projector'],

  world(R) {
    const f = R.pick(FORMS)
    const segs = R.some(f.segs, 3)
    const person = R.pick(PEOPLE)
    return {
      unit: 'watch', units: 'watches', form: f.form, topic: R.pick(f.topics ?? SUBJECTS), person,
      spot: segs[0], spot2: segs[1], spot3: segs[2],
      feature: R.pick(['the colour grade', 'the voice-over', 'the score', 'the title design', 'the handheld camera', 'the sound design']),
      feature2: R.pick(['the captions', 'the lower thirds', 'the music cues', 'the B-roll', 'the interview framing', 'the archive footage']),
      feature3: R.pick(['the cut at {tc}', 'the fade at {tc}', 'the jump cut at {tc}']),
      tc: () => tc(R), ...(() => { const m = R.between(2, 24); return { runtime: `${m} minutes`, runtimeAdj: `${m}-minute` } })(), tool: R.pick(TOOLS), camera: R.pick(CAMERAS), adj: R.pick(ADJ),
    }
  },

  places: ['at {tc}', 'around {tc}', 'in {spot}', 'in {spot2}', 'in the first fifteen seconds', 'just before {spot3}',
    'in the last minute', 'during {spot}', 'right after the title card', 'about halfway through', 'at the cut into {spot2}'],

  cats: {
    'Accessibility': ['access', ['+the captions', 'the caption timing', 'the text on screen', 'the flashing in {spot}',
      'the audio description', 'the contrast on the lower thirds']],
    'Audio mix': ['audio', ['the dialogue in {spot}', 'the music under the interview', 'the room tone', 'the mix at {tc}',
      'the wind noise in {spot2}', 'the voice-over level', 'the transition sound at {tc}']],
    'B-roll': ['visual', ['the B-roll in {spot}', '+the cutaways', 'the archive footage', '+the establishing shots',
      'the stock-looking shots in {spot2}', 'the detail shots']],
    'Bug or defect': ['bug', ['the audio drifts out of sync after {tc}', 'there is a black frame at {tc}', 'the captions stop at {tc}',
      'the export has a flash of the wrong grade at {tc}', 'the music cuts out for a second at {tc}', 'a lower third spells {person}’s name two ways']],
    'Colour and lighting': ['visual', ['the grade in {spot}', 'the skin tones', 'the lighting in the interview', 'the night shots',
      'the colour shift at {tc}', 'the contrast in {spot2}', 'the white balance in {spot3}']],
    'Confusion': ['confusion', []],
    'Copy': ['copy', ['the title card', '+the lower thirds', 'the description text', 'the end card copy', 'the on-screen text in {spot}']],
    'Cut timing': ['pacing', ['the cut at {tc}', 'the cut into {spot2}', '+the jump cuts in {spot}', 'the transition at {tc}',
      'the last cut before {spot3}', 'the hold on {person}']],
    'Delight, keep this': ['delight', []],
    'End screen and ask': ['pitch', ['the end screen', 'the subscribe ask', 'the call to action at the end', 'the final card', 'the credits']],
    'Framing': ['visual', ['the framing of {person}', 'the headroom in the interview', 'the wide shots in {spot}', 'the handheld framing',
      'the composition at {tc}', 'the two-shot in {spot2}']],
    'Friction': ['pacing', ['the slow start', 'the long interview section', 'the gap before {spot2}', 'the chapter jumps', 'the caption pace']],
    'Graphics and captions': ['visual', ['the title design', 'the lower thirds', 'the animated map', 'the chapter cards', 'the burned-in captions',
      'the diagram in {spot2}']],
    'Hook, first 15 seconds': ['pacing', ['the first fifteen seconds', 'the opening line', 'the first shot', 'the cold open', 'the hook']],
    'Missing': ['missing', ['a title card with the place and year', 'an establishing shot', 'a caption file', 'a chapter list',
      'a moment of silence', 'a shot of {person} listening', 'a clear ending', 'a name card for {person}']],
    'Music': ['audio', ['the score', 'the music in {spot}', 'the track under the ending', 'the music cue at {tc}', 'the licensed track']],
    'Pacing': ['pacing', ['{spot}', '{spot2}', 'the middle third', 'the ending', 'the interview section', 'the first two minutes']],
    'Performance': ['perf', ['the playback on a phone', 'the file size', 'the streaming quality', 'the buffering on the embed']],
    'Platform fit': ['pitch', ['the vertical crop', 'the runtime for the platform', 'the first frame as a thumbnail', 'the aspect ratio',
      'the length of the intro for YouTube']],
    'Positioning': ['pitch', ['the title', 'the logline', 'the description', 'the festival synopsis', 'the one-line pitch']],
    'Script': ['story', ['the voice-over script', 'the opening line', 'the narration in {spot}', 'the last line', 'the interview questions',
      'the explanation in {spot2}']],
    'Structure': ['pacing', ['the order of {spot} and {spot2}', 'the three-act structure', 'the flashback', 'the chapter order', 'the ending']],
    'Thumbnail and title': ['pitch', ['the thumbnail', 'the title', 'the text on the thumbnail', 'the face in the thumbnail']],
    'Voiceover delivery': ['audio', ['the voice-over delivery', 'the pace of the narration', 'the read of the last line', 'the mic sound',
      'the energy in {spot}']],
  },

  tagline: [
    'A {adj} {form} about {topic}.', 'A {runtimeAdj} {form} about {topic}.', '{Topic}, in {runtime}.',
    'A {form} about {topic}, shot on {camera}.', 'A {adj} {form} following {person} and {topic}.', 'A {form} about {topic}, cut to {runtime}.',
  ],

  summary: {
    origin: ['I filmed this over {k} weekends.', 'It started as a favour for a friend and became the thing I care most about.',
      'Shot over one long day with a crew of {k2}.', 'The footage sat on a drive for a year before I cut it.',
      'I made it for a local festival and missed the deadline, so here it is.'],
    how: ['Shot on {camera}, cut in {tool}.', 'Cut in {tool}; the grade is mine too.', 'Shot on {camera} with natural light.',
      'Edited in {tool}, music by a friend.'],
    state: {
      concept: ['Treatment and a mood reel only.', 'Script and storyboards for now.'],
      prototype: ['Rough assembly; the grade and mix are temporary.', 'First assembly at {runtime}.'],
      beta: ['Fine cut; sound and colour are close.', 'Picture lock pending notes.'],
      release_candidate: ['Picture locked; final mix next.', 'Festival cut, nearly done.'],
      shipped: ['Released in {month}.', 'Out since {month}; recutting a shorter version.'],
    },
    why: ['I have watched it too many times to see it.', 'I think {spot2} runs long and I cannot tell by how much.',
      'I do not know if the first fifteen seconds hold anyone.', 'I am torn about the ending.'],
  },

  session: [
    'Watched it once through on a {device}.', 'Two watches, the second with headphones.', 'Watched it on a {device} without pausing.',
    'One watch on a {device}, then skimmed {spot2} again.', 'Watched the whole thing on a {device}, then the first minute twice.',
    'Watched it the way I would in a feed, on a {device}.', 'Two watches on a {device}, {n} minutes with notes.',
  ],

  ask: {
    task: ['Watch {spot} and stop.', 'Watch from {spot2} to the end.', 'Watch {spot3} twice.', 'Watch it on a {device}.', 'Watch it with {feature} in mind.',
      'Watch it once at full size, no pausing.', 'Watch it with the sound off.', 'Watch it on a phone with the volume low.',
      'Watch the first thirty seconds and stop.', 'Watch it twice, the second time with headphones.', 'Watch it with captions on.',
      'Watch {spot2} only.', 'Watch it half-attending, the way you would in a feed.', 'Watch the last minute first, then the whole thing.',
      'Watch it once, then describe it back to me from memory.', 'Watch it next to somebody with no context.'],
    probe: ['Tell me whether {spot} earns its length.', 'Say whether {feature} helps or distracts.', 'Name the shot in {spot2} you would cut.', 'Tell me where {spot3} lost you, if it did.', 'Say whether {feature2} is doing enough.', 'Tell me what the film is about after {spot}.', 'Say whether {spot2} comes too early.',
      'Say whether the cut at {tc} reads as intentional or as a mistake.', 'Quote the last line you heard before you wanted to stop.',
      'Tell me whether the grade reads as a choice or a mistake.', 'Say whether the story still lands.', 'Name the shot you would cut.',
      'Tell me where you checked how much was left.', 'Say whether the music is carrying the edit or covering for it.',
      'Tell me what you thought it was about after thirty seconds.', 'Name the moment the pacing slipped.',
      'Say whether the ending earns the runtime.', 'Tell me whether the voice-over narrates what I can already see.',
      'Say whether the mix let you hear the words in {spot}.'],
  },

  changelog: ['Cut {spot2} by about a third.', 'New opening shot.', 'Captions for the whole film.', 'Music under the interview is 4 dB lower.',
    'Moved {spot3} earlier.', 'Regraded the night shots.', 'New title card with the place and year.', 'Removed the second jump cut in {spot}.',
    'Fixed the sync drift after the midpoint.', 'Shorter end card.', 'Re-recorded the voice-over for {spot}.', 'New thumbnail.'],

  suggestion: ['Cut {spot2} shorter', 'Captions for the whole film', 'Open on {spot3}', 'Lower the music under the interview',
    'A name card for {person}', 'Hold the last shot longer', 'A vertical cut for social', 'Regrade {spot}',
    'Title card with place and year', 'Drop the voice-over in {spot}', 'A shorter trailer', 'Chapter markers'],
}
