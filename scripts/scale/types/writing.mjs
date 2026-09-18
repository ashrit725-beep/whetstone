/** Writing: an opening, an argument or a voice, named sections, and an ending. */

const FORMS = [
  { form: 'essay', unit: 'read', parts: ['the opening paragraph', 'the section on {topicShort}', 'the second section', 'the conclusion', 'the footnotes', 'the counter-argument'] },
  { form: 'short story', unit: 'read', parts: ['the first page', 'the dinner scene', 'the flashback', 'the last page', 'the argument in the car', 'the letter'] },
  { form: 'newsletter', unit: 'read', parts: ['the intro', 'the main piece', 'the links section', 'the sign-off', 'the subject line', 'the second item'] },
  { form: 'novel chapter', unit: 'read', parts: ['the opening page', 'the dialogue in the kitchen', 'the chapter’s last line', 'the middle scene', 'the description of the town'] },
  { form: 'technical guide', unit: 'read', parts: ['the introduction', 'the setup section', 'the first worked example', 'the troubleshooting section', 'the summary'] },
  { form: 'personal essay', unit: 'read', parts: ['the first paragraph', 'the section about my father', 'the turn in the middle', 'the ending', 'the title'] },
  { form: 'zine', unit: 'read', parts: ['the cover', 'the first spread', 'the interview', 'the back page', 'the centre spread'] },
  { form: 'poetry collection', unit: 'read', parts: ['the first poem', 'the title poem', 'the sequence in the middle', 'the last poem', 'the prose poem'] },
  { form: 'longform article', unit: 'read', parts: ['the lede', 'the nut graf', 'the interview section', 'the data section', 'the kicker'] },
  { form: 'grant application', unit: 'read', parts: ['the summary', 'the need statement', 'the methods section', 'the budget narrative', 'the outcomes section'] },
  { form: 'manual', unit: 'read', parts: ['the quick start', 'the safety page', 'the troubleshooting table', 'the glossary', 'the first chapter'] },
  { form: 'picture book text', unit: 'read', parts: ['the first spread', 'the repeated line', 'the turn', 'the last spread', 'the title'] },
]
const TOPICS = [['tide tables', 'tides'], ['rope', 'rope'], ['second-hand books', 'books'], ['sleep debt', 'sleep'],
  ['shift work', 'shift work'], ['the ferry that stopped running', 'the ferry'], ['learning to swim at forty', 'swimming'],
  ['my grandmother’s recipes', 'recipes'], ['moving cities twice in a year', 'moving'], ['why buses are late', 'buses'],
  ['repairing things', 'repair'], ['the end of a band', 'the band'], ['bread', 'bread'], ['owning a car in a city', 'cars'],
  ['night trains', 'trains'], ['caring for a parent', 'care'], ['the economics of small bookshops', 'bookshops'],
  ['the history of the typewriter', 'typewriters'], ['walking the whole coast', 'the coast'], ['allotment waiting lists', 'allotments'],
  ['burnout in games', 'burnout'], ['learning Welsh', 'Welsh'], ['lighthouses', 'lighthouses'], ['a flooded village', 'the flood'],
  ['being a junior developer', 'work'], ['birdwatching from a tower block', 'birds'], ['losing a language', 'language'],
  ['running a village shop', 'the shop'], ['the last cinema in town', 'cinemas'], ['growing up above a takeaway', 'home'], ['night swimming', 'swimming'],
  ['learning to drive at fifty', 'driving'], ['the price of rent', 'rent'], ['keeping bees in a city', 'bees'], ['a year without a phone', 'phones'],
  ['public libraries', 'libraries'], ['working nights in a hospital', 'nights'], ['my father’s allotment', 'allotments'], ['football on the radio', 'football'],
  ['the fishing fleet that left', 'the fleet'], ['fixing an old boat', 'boats'], ['choirs', 'singing'], ['moving back home', 'home'],
  ['the kitchen at a care home', 'care'], ['long-distance friendship', 'friendship'], ['a small town’s bus route', 'buses'], ['migrating birds', 'birds'],
  ['open-plan offices', 'offices'], ['the ethics of tipping', 'tipping'], ['board games with my grandfather', 'board games'], ['snow days', 'snow']]
const VENUES = ['Substack', 'Buttondown', 'a personal blog', 'Ghost', 'a print zine', 'Medium', 'a literary magazine', 'an anthology', 'a local paper']
const WRITING_TOOLS = ['Google Docs', 'Scrivener', 'Obsidian', 'iA Writer', 'a notebook', 'Word']
const VOICES = ['the second-person voice', 'the present tense', 'the footnotes', 'the short paragraphs', 'the list structure',
  'the dry humour', 'the letters format', 'the unnamed narrator', 'the repeated refrain', 'the numbered sections']
const ADJ = ['short', 'long', 'quiet', 'angry', 'funny', 'slow', 'practical', 'personal', 'strange', 'plain-spoken', 'fortnightly']

export default {
  slug: 'writing',
  work: 'piece', works: 'pieces', audience: 'reader', verbed: 'read', verb: 'read',
  digital: false, interactive: false, next: 'draft',
  devices: ['phone', 'laptop', 'Kindle', 'printout', 'tablet', 'e-reader', 'phone on the bus', 'desktop in reader mode'],

  world(R) {
    const f = R.pick(FORMS)
    const [topic, topicShort] = R.pick(TOPICS)
    const parts = R.some(f.parts, 3).map((p) => p.replace('{topicShort}', topicShort))
    const voices = R.some(VOICES, 2)
    return {
      unit: 'read', units: 'reads', form: f.form, topic, topicShort,
      spot: parts[0], spot2: parts[1], spot3: parts[2], feature: voices[0], feature2: voices[1], feature3: 'the title',
      words: `${R.between(8, 95) * 100}`, platform: R.pick(VENUES), tool: R.pick(WRITING_TOOLS), adj: R.pick(ADJ),
    }
  },

  places: ['in {spot}', 'in {spot2}', 'at the start of {spot3}', 'on the second page', 'around the halfway mark',
    'in the last paragraph', 'in the third paragraph', 'at the turn', 'just before {spot2}', 'in the opening lines'],

  cats: {
    'Accessibility': ['access', ['the line length', 'the font size on a phone', '+the long paragraphs', 'the image descriptions',
      'the contrast in the PDF', 'the table in {spot2}']],
    'Argument and evidence': ['reason', ['the central claim', 'the evidence in {spot2}', 'the statistic in {spot}', 'the counter-argument',
      'the example about {topicShort}', 'the leap in {spot3}', 'the conclusion']],
    'Bug or defect': ['bug', ['the footnote numbers skip from 4 to 6', 'a link in {spot2} [goes|go:spot2] to a 404', 'the PDF cuts off the last line of each page',
      'the same paragraph appears twice in {spot}', 'the images do not load in the email version', 'a name changes spelling in {spot3}']],
    'Claim check': ['reason', ['the figure in {spot}', 'the quote attributed in {spot2}', 'the date in {spot3}', 'the claim about {topicShort}',
      'the statistic in the opening']],
    'Confusion': ['confusion', []],
    'Copy': ['copy', ['the blurb', 'the subtitle', 'the author note', 'the pull quote', 'the email subject line']],
    'Delight, keep this': ['delight', []],
    'Dialogue': ['story', ['the dialogue in {spot}', 'the argument in {spot2}', 'the last exchange', 'the phone call', 'the way the mother speaks']],
    'Ending': ['pacing', ['the ending', 'the last paragraph', 'the final line', 'the resolution', 'the epilogue']],
    'Friction': ['flow', ['+the long paragraphs', '+the footnotes', '+the jumps between sections', 'the table in {spot2}', 'the dense opening', 'the second section']],
    'Jargon and clarity': ['copy', ['the term in {spot}', 'the acronyms in {spot2}', 'the technical passage', 'the definition of {topicShort}',
      'the second sentence of {spot}']],
    'Line edit': ['copy', ['the first sentence', 'the sentence starting “It is worth”', 'the adverbs in {spot2}', 'the long sentence in {spot3}',
      'the repeated “just”', 'the passive sentences in {spot}']],
    'Missing': ['missing', ['a concrete example in {spot}', 'a source for the main figure', 'a scene between {spot} and {spot2}',
      'a counter-argument', 'a clear thesis sentence', 'a date on the piece', 'a section break before {spot3}']],
    'Opening': ['pacing', ['the opening paragraph', 'the first line', 'the first page', 'the hook', 'the throat-clearing before {spot}']],
    'Pacing': ['pacing', ['{spot2}', 'the middle', '{spot3}', 'the backstory in {spot}', 'the list in the second half']],
    'Performance': ['perf', ['the page load on a phone', 'the image sizes', 'the email size']],
    'Positioning': ['pitch', ['the title', 'the pitch to editors', 'the subtitle', 'the first line of the description', 'who it is for']],
    'Repetition and filler': ['copy', ['the phrase “in many ways”', '+the recaps in {spot2}', 'the second example in {spot}',
      'the repeated image of {topicShort}', 'the summary at the end of each section']],
    'Scannability': ['copy', ['the headings', 'the paragraph lengths', 'the pull quotes', 'the lists in {spot2}', 'the section breaks']],
    'Structure': ['pacing', ['the order of {spot} and {spot2}', 'the section breaks', 'the flashback', 'the frame story', 'where {spot3} [sits|sit:spot3]']],
    'Title and subheads': ['copy', ['the title', 'the subheads', 'the section titles in {spot2}', 'the chapter title', 'the subtitle']],
    'Tone fit': ['tone', ['the tone of {spot}', 'the jokes in {spot2}', 'the formality of {spot3}', 'the anger in the ending', 'the tone of the title']],
    'Voice and character': ['story', ['{feature}', 'the narrator', 'the main character', 'the voice in {spot}', 'the father', '{feature2}']],
  },

  tagline: [
    'A {adj} {form} about {topic}.', 'A {form} about {topic}, about {words} words.', 'An {form} on {topic}, written for {platform}.',
    'A {adj} {form} on {topic}.', '{Topic}: a {form}.', 'A {adj} {form} about {topic}, for {platform}.',
  ],

  summary: {
    origin: ['I have been circling this subject for {k} years.', 'It started as a thread I deleted.', 'This came out of a conversation I could not stop thinking about.',
      'The first draft was twice this length.', 'It is the piece I wanted to read and could not find.'],
    how: ['Written for {platform}.', 'About {words} words, written in {platform}.', 'Drafted in {tool}; nobody has read it yet.',
      'Written over {k} months of mornings.'],
    state: {
      concept: ['An outline and the opening only.', 'A pitch and a rough first page.'],
      prototype: ['First full draft.', 'Draft two; {spot2} [is|are:spot2] still rough.'],
      beta: ['Third draft; structure is settled, sentences are not.', 'Close to done apart from the ending.'],
      release_candidate: ['Final draft before I send it out.', 'Going to an editor in {month}.'],
      shipped: ['Published in {month}; I am revising it for a collection.', 'Out since {month}.'],
    },
    why: ['I cannot tell whether the opening earns the rest.', 'I want to know where you stopped reading.',
      'I am not sure the argument survives a sceptical reader.', 'The ending is the part I trust least.'],
  },

  session: [
    'Read it once through on a {device}.', 'Read it twice: once fast, once properly.', 'Read it on a {device} in one sitting.',
    'Read it on a {device}, about {n} minutes.', 'One careful read on a {device}, pencil in hand.', 'Read it on a {device}, then {spot} again.',
    'Read it out loud, which took about {n} minutes.',
  ],

  ask: {
    task: ['Read {spot} and then stop.', 'Start at {spot2} and read to the end.', 'Read {spot3} twice.', 'Read it on a {device}.', 'Read it with {feature} in mind.',
      'Read it once at speed.', 'Read the first paragraph and the last, nothing else.', 'Read it out loud.', 'Read it on a phone.',
      'Read until you would stop, and stop there.', 'Read it cold, no context from me.', 'Read {spot2} on its own.',
      'Read it, then close it before you write anything down.', 'Skim it the way a busy person would.', 'Read the headings first, then the whole thing.',
      'Read it as somebody who disagrees with the premise.', 'Read the ending first.'],
    probe: ['Tell me whether {spot} earns its place.', 'Say whether {feature} works or gets in the way.', 'Name the sentence in {spot2} you would cut.', 'Tell me where {spot3} lost you, if it did.', 'Say whether the piece is really about {topic}.', 'Tell me what you remember of {spot} a day later.', 'Say whether {spot2} comes too early or too late.',
      'Say the argument back to me in one sentence, or name where you lost it.', 'Tell me the paragraph where you started skimming.',
      'Say whether the opening earns the rest or is throat-clearing.', 'Tell me whether the ending lands or only stops.',
      'Name the sentence doing the most work.', 'Tell me the claim I have not supported.', 'Say whether the voice holds or drifts.',
      'Name the paragraph that could go without anyone noticing.', 'Tell me whether the title is honest about what is inside.',
      'Say where you wanted a concrete example.', 'Tell me whether {feature} [works|work:feature] for you.', 'Tell me who you think I am writing for.'],
  },

  changelog: ['New opening paragraph.', 'Cut {spot2} by half.', 'Moved {spot3} earlier.', 'Added a source for the main figure.',
    'New ending.', 'Removed most of the adverbs.', 'New title.', 'Split the long section into two.', 'Rewrote the dialogue in {spot}.',
    'Dropped the recap at the end of each section.', 'Added a concrete example about {topicShort}.'],

  suggestion: ['Open on {spot3}', 'Cut {spot2} in half', 'Source the main figure', 'A new title', 'End a paragraph earlier',
    'Add a concrete example about {topicShort}', 'Drop the recaps', 'Split the long section', 'Move {spot} later', 'A thesis sentence up front'],
}
