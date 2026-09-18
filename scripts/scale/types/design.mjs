import { settle } from '../compose.mjs'

/** Design work: a client or a brief, a set of deliverables, and a system or not. */

const BRIEFS = [
  { kind: 'identity', brief: '<an identity|a visual identity|a brand identity|branding|a rebrand|a new identity> for a {client}', parts: ['the wordmark', 'the monogram', 'the secondary palette', 'the business cards', 'the signage studies'] },
  { kind: 'typeface', brief: '<a typeface|a type family|a display typeface|a text typeface|a variable font|a signage typeface>', parts: ['the lowercase', 'the italic', 'the figures', 'the bold weight', 'the specimen', 'the punctuation'] },
  { kind: 'posters', brief: '<a poster series|a set of posters|a series of posters|three posters|a poster campaign|a screenprinted series> about {topic}', parts: ['the first poster', 'the third poster', 'the type lockup', 'the grid', 'the colour system'] },
  { kind: 'icons', brief: '<an icon set|a set of icons|an icon family|a pictogram set|a set of interface icons> for a {product}', parts: ['the navigation icons', 'the filled variants', 'the 16px versions', 'the stroke weight', 'the metaphor icons'] },
  { kind: 'packaging', brief: '<packaging|a packaging system|labels and packaging|boxes and labels|a label range> for a {client}', parts: ['the front panel', 'the label hierarchy', 'the colour coding', 'the side panel', 'the unboxing'] },
  { kind: 'wayfinding', brief: '<a wayfinding system|signage and wayfinding|a sign system|wayfinding|a signage family> for a {venue}', parts: ['the directional signs', 'the pictograms', 'the typeface choice', 'the level colours', 'the map'] },
  { kind: 'system', brief: '<a design system|a component library|a UI kit|a small design system|interface guidelines> for a {product}', parts: ['the button set', 'the form components', 'the spacing scale', 'the colour tokens', 'the empty states'] },
  { kind: 'book', brief: '<a book cover|a cover design|a jacket design|cover and spine> for {book}', parts: ['the front cover', 'the spine', 'the type treatment', 'the illustration', 'the back cover'] },
  { kind: 'album', brief: '<an album cover|a record sleeve|an LP sleeve|artwork for a record|a single cover> for {band}', parts: ['the front cover', 'the vinyl label', 'the type lockup', 'the inner sleeve', 'the colour'] },
  { kind: 'festival', brief: '<a festival identity|an identity|branding|posters and branding|a visual identity> for {festival}', parts: ['the logo', 'the poster', 'the programme layout', 'the wristband', 'the social templates'] },
  { kind: 'appicon', brief: '<an app icon and store art|an app icon|store artwork and an icon|an icon and launch graphics> for a {product}', parts: ['the icon', 'the store screenshots', 'the colour', 'the small-size icon', 'the feature graphic'] },
  { kind: 'menu', brief: '<a menu and identity|menus and signage|a menu design|a menu and shopfront> for {restaurant}', parts: ['the menu layout', 'the logo', 'the colour palette', 'the price typography', 'the signage'] },
  { kind: 'report', brief: '<an annual report|a yearly report|an impact report|a year-in-review booklet> for a {client}', parts: ['the cover', 'the charts', 'the spread layouts', 'the type hierarchy', 'the data tables'] },
  { kind: 'illustration', brief: '<editorial illustrations|a set of illustrations|spot illustrations|illustrations for a magazine piece|a picture essay> about {topic}', parts: ['the lead illustration', 'the spot illustrations', 'the palette', 'the line weight', 'the third piece'] },
]
const CLIENT = ['bakery', 'bike shop', 'ceramics studio', 'small brewery', 'bookshop', 'law firm', 'climbing gym', 'dental practice', 'cider maker',
  'tea merchant', 'sailing school', 'cheese shop', 'kitchenware brand', 'soap maker', 'olive oil producer', 'distillery', 'framing shop',
  'coffee roaster', 'community radio station', 'architecture practice', 'yoga studio', 'record shop', 'housing charity',
  'veterinary clinic', 'plant nursery', 'florist', 'boat builder', 'youth theatre', 'hardware store']
/** Clients who sell something that goes in a box. */
const MAKERS = ['bakery', 'small brewery', 'coffee roaster', 'tea merchant', 'soap maker', 'olive oil producer', 'distillery',
  'cider maker', 'cheese shop', 'kitchenware brand', 'plant nursery', 'chocolate maker', 'candle maker', 'hot sauce brand']
const VENUE = ['hospital', 'library', 'university campus', 'train station', 'museum', 'leisure centre', 'market hall', 'art school',
  'ferry terminal', 'botanic garden', 'city archive', 'sports stadium', 'shopping arcade', 'concert hall', 'children’s hospital']
const PRODUCT = ['banking app', 'booking tool', 'council website', 'recipe app', 'note-taking app', 'charity donation flow',
  'transit app', 'podcast player', 'weather app', 'library catalogue', 'fitness tracker', 'parking app', 'volunteer portal', 'music tuner']
const BOOK = ['a debut novel', 'a poetry collection', 'a cookbook', 'a history of lighthouses', 'a children’s book', 'a memoir',
  'a crime novel', 'a book of essays', 'a field guide', 'a short story collection', 'a travel book', 'a graphic novel']
const BAND = ['a folk trio', 'a post-punk band', 'an ambient producer', 'a brass band', 'a jazz quartet']
const FESTIVAL = ['a small film festival', 'a folk festival', 'a design week', 'a food festival', 'a book festival']
const RESTAURANT = ['a noodle bar', 'a seafood shack', 'a wine bar', 'a bakery café', 'a taquería']
const TOPICS = ['the tide', 'public transport', 'bees', 'the night shift', 'rivers', 'repair', 'the city at 5am', 'migration',
  'libraries', 'weather', 'bread', 'swimming pools', 'allotments', 'night buses', 'moths', 'the coast', 'lighthouses', 'markets',
  'football grounds', 'ferries', 'rain', 'old cinemas', 'birdsong', 'climate data']
const TOOLS = ['Figma', 'Illustrator', 'Glyphs', 'InDesign', 'Procreate', 'Affinity Designer', 'a risograph', 'pencil and a scanner']
/** What each kind of brief is actually made in. */
const TOOLS_BY = {
  identity: ['Figma', 'Illustrator', 'Glyphs', 'pencil and a scanner'], typeface: ['Glyphs', 'FontLab', 'RoboFont'],
  posters: ['Illustrator', 'InDesign', 'a risograph', 'screenprint'], icons: ['Figma', 'Illustrator'], packaging: ['Illustrator', 'InDesign', 'Figma'],
  wayfinding: ['Illustrator', 'InDesign', 'Figma'], system: ['Figma'], book: ['InDesign', 'Procreate', 'Illustrator'],
  album: ['Procreate', 'Illustrator', 'Photoshop', 'a risograph'], festival: ['Figma', 'Illustrator', 'InDesign'], appicon: ['Figma', 'Illustrator', 'Blender'],
  menu: ['InDesign', 'Illustrator'], report: ['InDesign', 'Figma'], illustration: ['Procreate', 'Photoshop', 'pencil and a scanner', 'gouache and a scanner'],
}
const ADJ = ['bold', 'quiet', 'geometric', 'hand-drawn', 'monochrome', 'warm', 'strict', 'playful', 'austere', 'loud', 'modular']

export default {
  slug: 'design',
  work: 'work', works: 'projects', audience: 'viewer', verbed: 'looked at', verb: 'look at',
  digital: false, interactive: false, next: 'round',
  devices: ['27-inch monitor', 'laptop', 'phone', 'printout at A3', 'iPad', 'calibrated display', 'projector', 'greyscale printout'],

  world(R) {
    const b = R.pick(BRIEFS)
    const client = b.kind === 'packaging' ? R.pick(MAKERS) : R.pick(CLIENT)
    const topic = R.pick(TOPICS)
    const tool = R.pick(TOOLS_BY[b.kind] ?? TOOLS)
    const brief = settle(R, b.brief).replace('{client}', client).replace('{venue}', R.pick(VENUE)).replace('{product}', R.pick(PRODUCT))
      .replace('{book}', R.pick(BOOK)).replace('{band}', R.pick(BAND)).replace('{festival}', R.pick(FESTIVAL))
      .replace('{restaurant}', R.pick(RESTAURANT)).replace('{topic}', topic)
    const parts = R.some(b.parts, 3)
    return {
      unit: 'pass', units: 'passes', brief, briefKind: b.kind, client, designTopic: topic, spot: parts[0], spot2: parts[1], spot3: parts[2],
      feature: R.pick(['the colour palette', 'the type pairing', 'the grid', 'the illustration style', 'the logo mark']),
      feature2: R.pick(['the spacing', 'the photography direction', 'the accent colour', 'the line weight', 'the texture']),
      feature3: R.pick(['the rationale document', 'the presentation deck', 'the application renders', 'the application examples']),
      tool, tool2: R.pick(TOOLS_BY[b.kind] ?? TOOLS), adj: R.pick(ADJ),
    }
  },

  places: ['on {spot}', 'in {spot2}', 'at small sizes', 'in the presentation', 'on the last board', 'in greyscale', 'at 16 pixels',
    'on the dark background', 'in the application examples', 'next to the competitors', 'on {spot3}', 'printed at actual size'],

  cats: {
    'Contrast and accessibility': ['access', ['the text on the accent colour', 'the light grey captions', 'the colour pairs in {feature}',
      'the smallest type size', 'the contrast on {spot}', 'the colour-coded parts of {spot2}']],
    'Brand tone': ['tone', ['the overall tone', 'the voice in the rationale', 'the playfulness of {spot}', 'the formality of the type',
      'the tone of {spot2}']],
    'Bug or defect': ['bug', ['the export has a hairline gap in {spot}', 'the RGB and CMYK versions of the accent do not match',
      'the kerning file is missing a pair in the wordmark', 'a layer in {spot2} [is|are:spot2] still set to the old colour',
      'the SVG export flattens the strokes', 'the font file installs with the wrong family name']],
    'Colour': ['visual', ['{feature}', 'the accent colour', 'the secondary palette', 'the colour on {spot}', 'the tints',
      'the colour on the dark background']],
    'Component consistency': ['craft', ['the corner radii', 'the stroke weights across {spot}', 'the icon sizes', 'the spacing between components',
      'the button heights']],
    'Composition': ['visual', ['the composition of {spot}', 'the balance on {spot2}', 'the negative space', 'the crop', 'the hierarchy on {spot3}']],
    'Concept': ['reason', ['the core idea', 'the metaphor behind {spot}', 'the rationale', 'the link between the brief and {spot2}',
      'the concept in the presentation']],
    'Confusion': ['confusion', []],
    'Copy': ['copy', ['the tagline in the applications', 'the rationale text', 'the captions on the boards', 'the copy on {spot}']],
    'Delight, keep this': ['delight', []],
    'File hygiene': ['craft', ['the layer names', 'the export settings', 'the file structure', 'the naming of the variants', 'the style library']],
    'Friction': ['flow', ['the presentation order', 'the file handover', 'the number of boards', 'the rationale document', 'the jump from {spot} to {spot2}']],
    'Iconography': ['visual', ['the icons', 'the pictograms', 'the metaphor icons', 'the icon stroke weight', 'the small-size icons']],
    'Imagery and illustration': ['visual', ['the illustration style', 'the photography', 'the textures', 'the illustration on {spot}',
      'the image treatment']],
    'Localisation and long strings': ['craft', ['the layout with German copy', 'the Arabic version', 'the long names on {spot}',
      'the wrap on {spot2}']],
    'Missing': ['missing', ['a one-colour version of the mark', 'a small-size version', 'a dark-background variant', 'a usage guide',
      'an example in real use', 'a clear-space rule', 'a black-and-white version of {spot}']],
    'Motion': ['visual', ['the logo animation', 'the transitions', 'the easing', 'the motion in {spot}']],
    'Performance': ['perf', ['the file sizes', 'the web font weight', 'the animation performance']],
    'Positioning': ['pitch', ['the presentation', 'the rationale', 'how it stands against competitors', 'the first board', 'the name']],
    'Spacing and rhythm': ['visual', ['the spacing on {spot}', 'the leading', 'the margins', 'the rhythm between sections', 'the letterspacing']],
    'States': ['craft', ['the hover states', 'the disabled state', 'the error state', 'the empty states', 'the focus state']],
    'Typography': ['visual', ['the type pairing', 'the headline type', 'the body size', 'the kerning in {spot}', '+the figures',
      'the italic', 'the wordmark letterforms']],
  },

  tagline: [
    '{Brief}, <for review|round one|first pass>.', '{Brief}, drawn in {tool}.', '{Brief}, second round.', 'A {adj} take on {brief}.',
    '{Brief}, built around {feature}.', 'A {adj} take on {brief}, first presentation.',
  ],

  summary: {
    origin: ['The client gave me a very loose brief and a lot of trust.', 'A self-initiated project that got out of hand.',
      'This is round two after the client rejected the first direction.', 'I did this for a friend’s business at cost.',
      'It started as a student project I never let go of.'],
    how: ['Made in {tool}.', 'Drawn in {tool}, finished in {tool2}.', 'Sketched on paper, finished in {tool}.'],
    state: {
      concept: ['Two rough directions and a moodboard.', 'Sketches only.'],
      prototype: ['One direction developed; applications are rough.', 'First round of the chosen direction.'],
      beta: ['Refined direction with applications.', 'Nearly final; {spot2} [is|are:spot2] the open question.'],
      release_candidate: ['Final presentation next week.', 'Final files going out in {month}.'],
      shipped: ['Delivered in {month}; now in use.', 'Launched in {month}.'],
    },
    why: ['I cannot tell if {spot} still works at small sizes.', 'The client loves {feature} and I am less sure.',
      'I want to know if it reads as a system or a set of nice pictures.', 'I am too close to {spot2} now.'],
  },

  session: [
    'Looked at it on a {device}, then on paper.', 'Two passes on a {device}, about {n} minutes.', 'Printed {spot} and looked at it at arm’s length.',
    'Went through the whole deck on a {device}.', 'Looked at it for {n} minutes on a {device}.', 'Looked at it in colour, then in greyscale.',
  ],

  ask: {
    task: ['Look at {spot} before anything else.', 'Compare {spot} with {spot2}.', 'Look at {spot3} on a {device}.', 'Look at {feature} on its own.', 'Print {spot} if you can.',
      'Look at {spot} at sixteen pixels before anything else.', 'Read the rationale once and close the file.',
      'Look at it at actual size, printed if you can.', 'Look at the palette with the photography removed.', 'Squint at it.',
      'Compare the first board to the last.', 'Look at {spot2} before {spot}.', 'Look at the worst case, not the hero shot.',
      'Look at it in greyscale.', 'Ignore the rationale and look at the work.', 'Look at the spacing, not the shapes.'],
    probe: ['Tell me whether {spot} belongs with {spot2}.', 'Say whether {feature} suits {brief}.', 'Name the weakest thing in {spot2}.', 'Tell me what {spot3} reminds you of.', 'Say whether {feature2} is doing any work.', 'Tell me which of {spot} and {spot2} you would show a client first.',
      'Say the idea back to me in one sentence.', 'Tell me whether {spot} still works.', 'Say whether the palette carries meaning.',
      'Name the board that is doing the least.', 'Tell me whether it reads as a system or a set of pictures.',
      'Say what it reminds you of, even if that is unflattering.', 'Tell me whether the hierarchy survives greyscale.',
      'Name the decision that reads as a default.', 'Tell me whether the tone matches the client.', 'Say which two things are fighting.',
      'Name the element I am too attached to.', 'Say whether {feature} [is|are:feature] doing any work.'],
  },

  changelog: ['New small-size version of {spot}.', 'Tightened the spacing on {spot2}.', 'Dropped the second accent colour.',
    'Redrew {spot3}.', 'One-colour version of the mark.', 'New dark-background variant.', 'Kerning fixed in the wordmark.',
    'Usage guide added.', 'Contrast raised on the captions.', 'Simplified {feature}.', 'Applications now use real content.'],

  suggestion: ['A one-colour mark', 'A small-size version of {spot}', 'Dark-background variant', 'A usage guide', 'Drop the second accent',
    'Real content in the applications', 'Tighter spacing on {spot2}', 'Clear-space rules', 'Redraw {spot3}', 'A greyscale check of {spot}'],
}
