/**
 * Project names.
 *
 * Fifty-one first halves against thirty-six second halves, plus thirty-eight
 * single words, gave 1,377 distinct titles across 3,524 projects, with
 * "Sightline" and "Crosshatch" each used by thirty-two different people. Names
 * are now shaped by the kind of work (a CLI is called `sluice`, a website is
 * named after the business it is for, a typeface is a Grotesk) and drawn from
 * a much larger stock, and populate.mjs refuses to hand out a name twice.
 */

const WORD = ['Tide', 'Brine', 'Kiln', 'Ash', 'Harbour', 'Heron', 'Lantern', 'Ferry', 'Marsh', 'Sorrel', 'Alder', 'Flint',
  'Gorse', 'Moss', 'Fern', 'Wren', 'Rook', 'Otter', 'Larch', 'Birch', 'Hazel', 'Willow', 'Thistle', 'Bramble', 'Yarrow',
  'Juniper', 'Ember', 'Cinder', 'Salt', 'Slate', 'Chalk', 'Clay', 'Loam', 'Reed', 'Sedge', 'Kelp', 'Shoal', 'Dune', 'Cove',
  'Tarn', 'Moor', 'Crag', 'Scree', 'Drift', 'Frost', 'Rime', 'Gale', 'Squall', 'Dusk', 'Ivy', 'Oak', 'Elm', 'Rowan', 'Sloe',
  'Quince', 'Medlar', 'Damson', 'Linden', 'Cedar', 'Spruce', 'Basalt', 'Quartz', 'Cobalt', 'Copper', 'Pewter', 'Amber',
  'Ochre', 'Umber', 'Indigo', 'Saffron', 'Sage', 'Fennel', 'Nettle', 'Clover', 'Acorn', 'Pebble', 'Shingle', 'Weir', 'Sluice',
  'Quay', 'Wharf', 'Buoy', 'Anchor', 'Keel', 'Mast', 'Rudder', 'Compass', 'Almanac', 'Atlas', 'Ledger', 'Tally', 'Quill',
  'Vellum', 'Bobbin', 'Spindle', 'Loom', 'Shuttle', 'Thimble', 'Awl', 'Chisel', 'Lathe', 'Anvil', 'Bellows', 'Crucible',
  'Kettle', 'Ladle', 'Sieve', 'Trowel', 'Spade', 'Dibber', 'Scythe', 'Sickle', 'Plover', 'Curlew', 'Dunlin', 'Lapwing',
  'Kestrel', 'Merlin', 'Starling', 'Swift', 'Martin', 'Finch', 'Linnet', 'Magpie', 'Jackdaw', 'Pike', 'Perch', 'Tench',
  'Minnow', 'Eel', 'Mackerel', 'Herring', 'Sprat', 'Limpet', 'Whelk', 'Barnacle', 'Cairn', 'Bothy', 'Croft', 'Byre',
  'Gable', 'Lintel', 'Rafter', 'Mortar', 'Plinth', 'Arch', 'Lamp', 'Wick', 'Tallow', 'Beacon', 'Signal', 'Pilot', 'Tender',
  'Ballast', 'Hawser', 'Bollard', 'Capstan', 'Tiller', 'Mizzen', 'Sextant', 'Meridian', 'Solstice', 'Equinox', 'Vesper',
  'Matins', 'Nocturne', 'Canticle', 'Fable', 'Parable', 'Rune', 'Glyph', 'Cipher', 'Sigil', 'Tessera', 'Mosaic', 'Fresco',
  'Gesso', 'Umbra', 'Penumbra', 'Halo', 'Pyre', 'Hearth', 'Grate', 'Flue', 'Chimney', 'Garret', 'Attic',
  'Cellar', 'Larder', 'Pantry', 'Scullery', 'Orchard', 'Meadow', 'Paddock', 'Hedgerow', 'Coppice', 'Spinney', 'Thicket',
  'Bracken', 'Heather', 'Bilberry', 'Rosehip', 'Elder', 'Hawthorn', 'Blackthorn', 'Holly', 'Mistletoe', 'Lichen', 'Fungus',
  'Truffle', 'Morel', 'Chanterelle', 'Puffball', 'Sparrow', 'Robin', 'Thrush', 'Nightjar', 'Owl', 'Badger', 'Stoat',
  'Weasel', 'Vole', 'Shrew', 'Hare', 'Fox', 'Lynx', 'Marten', 'Seal', 'Puffin', 'Gannet', 'Skua', 'Tern', 'Petrel']

const SUFFIX = ['fall', 'hollow', 'line', 'gate', 'deck', 'root', 'mark', 'work', 'yard', 'wright', 'reach', 'bourne', 'cross',
  'ridge', 'well', 'path', 'fen', 'mill', 'shore', 'stead', 'vale', 'burn', 'combe', 'haven', 'moor', 'thorpe', 'wold', 'holt',
  'light', 'field', 'stone', 'wood', 'ford', 'mere', 'side', 'worth', 'ley', 'hurst', 'croft', 'hythe', 'ness', 'ings', 'down',
  'water', 'marsh', 'bank', 'brook', 'crest', 'dale', 'glen', 'heath', 'hill', 'wick']

const ADJ = ['Low', 'Slow', 'Salt', 'Glass', 'Iron', 'Quiet', 'Long', 'Cold', 'Small', 'Last', 'Night', 'Late', 'Early',
  'Little', 'Far', 'Deep', 'High', 'Wild', 'Pale', 'Dark', 'Bright', 'Hollow', 'Paper', 'Tin', 'Copper', 'Silver', 'Grey',
  'Green', 'Red', 'Blue', 'Winter', 'Summer', 'Northern', 'Western', 'Lost', 'Loose', 'Open', 'Second', 'Half', 'Odd', 'Stray',
  'Sunday', 'Midnight', 'Upper', 'Lower', 'Old', 'New', 'Borrowed', 'Broken', 'Drowned', 'Sleeping', 'Burning', 'Falling',
  'Tidal', 'Coastal', 'Common', 'Distant', 'Crooked', 'Gentle', 'Hidden', 'Narrow', 'Patient', 'Restless', 'Sunken', 'Tangled']

const NOUN = ['Tide', 'Harbour', 'Ferry', 'Lantern', 'Orchard', 'Kiln', 'Road', 'Hours', 'Signal', 'Ledger', 'Parade', 'Almanac',
  'Garden', 'Circuit', 'Frontier', 'Crossing', 'Current', 'Archive', 'Harvest', 'Weather', 'Station', 'Quarter', 'Commons',
  'Market', 'Circle', 'Chorus', 'Company', 'Engine', 'Assembly', 'Library', 'Office', 'Works', 'Shift', 'Season', 'Country',
  'Water', 'House', 'Machine', 'Island', 'Lighthouse', 'Bridge', 'Canal', 'Line', 'Room', 'Table', 'Window', 'Choir', 'Kitchen',
  'Workshop', 'Yard', 'Postcards', 'Letters', 'Maps', 'Bells', 'Wires', 'Rooms', 'Stairs', 'Keys', 'Tides', 'Lights', 'Nights',
  'Moths', 'Birds', 'Hands', 'Rivers', 'Fields', 'Streets', 'Ships', 'Songs', 'Stones', 'Clocks', 'Mirrors', 'Doors',
  'Ferryman', 'Keeper', 'Cartographer', 'Signalman', 'Diver', 'Glassblower', 'Beekeeper', 'Pilot', 'Surveyor', 'Lamplighter']

const NUMBER = ['Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Nine', 'Eleven', 'Twelve', 'Forty', 'A Hundred']
const HOUR = ['at Dawn', 'After Dark', 'in Winter', 'by Night', 'at Low Tide', 'Before the Rain', 'Until Morning', 'at Sea',
  'in the Rain', 'Underground', 'After Hours', 'in August']

const APP_SUFFIX = ['ly', 'kit', 'book', 'board', 'desk', 'base', 'log', 'flow', 'deck', 'list', 'note', 'sheet', 'wise', 'keeper',
  'post', 'nest', 'yard', 'box', 'cast', 'mark', 'pad', 'day', 'loop', 'spot']
const BUSINESS_SUFFIX = ['Co-op', 'Supply', 'Collective', 'Works', 'Club', 'Exchange', 'Library', '& Co.', 'Guild', 'Depot',
  'Cooperative', 'Share', 'Kitchen', 'Rentals', 'Repair', 'Delivery', 'Studio', 'Network', 'Partners', 'Pantry']
const BIZ_ADJ = ['Second', 'Spare', 'Common', 'Shared', 'Borrowed', 'Mended', 'Local', 'Weekly', 'Good', 'Open', 'Small',
  'Neighbourly', 'Fair', 'Honest', 'Little', 'Slow', 'Village', 'Corner', 'Market', 'Harbour']
const HARDWARE_SUFFIX = ['One', 'Mini', 'Mk II', 'Pro', 'Dial', 'Pad', 'Box', 'Node', 'Beacon', 'Board', 'Loop', 'Kit',
  'Lite', 'Two', 'Frame', 'Clip', 'Deck', 'Tab', 'Puck']
const TYPE_SUFFIX = ['Grotesk', 'Sans', 'Serif', 'Mono', 'Text', 'Display', 'Slab', 'Script', 'Book', 'Condensed', 'Gothic']
const CLI_SUFFIX = ['-cli', 'ctl', 'd', '-kit', '-sync', '-lint', '.js', '-rs', 'up', '-run', 'x']
const WRITING_SHAPES = [
  (R, w) => `On ${cap(w.topicShort)}`,
  (R, w) => `Notes on ${cap(w.topicShort)}`,
  (R, w) => `A Short History of ${cap(w.topicShort)}`,
  (R, w) => `Against ${cap(w.topicShort)}`,
  (R) => `What the ${R.pick(NOUN)} Kept`,
  (R) => `Letters from the ${R.pick(NOUN)}`,
  (R) => `The ${R.pick(ADJ)} ${R.pick(NOUN)}`,
  (R) => `${R.pick(ADJ)} ${R.pick(NOUN)}`,
  (R) => `${R.pick(NUMBER)} ${R.pick(NOUN.filter((n) => n.endsWith('s')))}`,
  (R) => `${R.pick(WORD)} Season`,
  (R, w) => `The Year of ${cap(w.topicShort)}`,
  (R) => `Everything I Know About ${R.pick(NOUN.filter((n) => n.endsWith('s')))}`,
  (R) => `${R.pick(NOUN)} ${R.pick(HOUR)}`,
]
const VIDEO_SHAPES = [
  (R) => `The ${R.pick(NOUN)}`,
  (R) => `${R.pick(ADJ)} ${R.pick(NOUN)}`,
  (R) => `${R.pick(NUMBER)} Minutes at the ${R.pick(NOUN.filter((n) => !n.endsWith('s')))}`,
  (R) => `${R.pick(NOUN)} ${R.pick(HOUR)}`,
  (R) => `After the ${R.pick(NOUN)}`,
  (R) => `${R.pick(WORD)}`,
  (R) => `The ${R.pick(ADJ)} ${R.pick(NOUN)}`,
  (R) => `Where the ${R.pick(NOUN.filter((n) => n.endsWith('s')))} Go`,
  (R) => `${R.pick(WORD)} & ${R.pick(WORD)}`,
  (R, w) => `${cap(w.person?.replace(/^the /, '') ?? 'Keeper')}`,
]

/** Short words a title leaves in lower case, unless one starts it. */
const MINOR = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to'])

/** Title case: "law firm" is "Law Firm", not "law Firm". */
function cap(s) {
  return s.split(' ').map((x, i) => (i > 0 && MINOR.has(x) ? x : x.charAt(0).toUpperCase() + x.slice(1))).join(' ')
}

function compound(R) {
  const w = R.pick(WORD)
  let s = R.pick(SUFFIX)
  while (w.toLowerCase().endsWith(s) || s.startsWith(w.toLowerCase())) s = R.pick(SUFFIX)
  return `${w}${s}`
}

/** A title for one project of `type`, given its world where one exists. */
export function makeTitle(R, type, world = {}) {
  const w = world
  switch (type) {
    case 'game': return R.weighted([
      [30, () => compound(R)],
      [22, () => `${R.pick(ADJ)} ${R.pick(NOUN)}`],
      [14, () => `The ${R.pick(ADJ)} ${R.pick(NOUN)}`],
      [8, () => R.pick(WORD)],
      [7, () => `${R.pick(WORD)} & ${R.pick(WORD)}`],
      [10, () => `The ${R.pick(NOUN.filter((n) => n.endsWith('s')))} of ${compound(R)}`],
      [5, () => `${R.pick(NOUN)} ${R.pick(HOUR)}`],
      [4, () => `${compound(R)}: ${R.pick(ADJ)} ${R.pick(NOUN)}`],
    ])()
    case 'web_app':
    case 'mobile_app': return R.weighted([
      [34, () => `${R.pick(WORD)}${R.pick(APP_SUFFIX)}`],
      [18, () => R.pick(WORD)],
      [14, () => compound(R)],
      [12, () => `${cap(w.obj ?? R.pick(WORD))}${R.pick(['wise', 'book', 'keeper', 'board', 'log', 'kit', 'desk', 'post'])}`],
      [8, () => `${R.pick(ADJ)} ${R.pick(WORD)}`],
      [8, () => `${R.pick(WORD)} ${R.pick(['App', 'HQ', 'Notes', 'Plan', 'Log', 'Desk'])}`],
      [6, () => `${R.pick(WORD).toLowerCase()}.${R.pick(['app', 'club', 'works', 'studio', 'garden'])}`],
    ])()
    case 'website': return R.weighted([
      [55, () => `${R.pick([compound(R), R.pick(WORD), `${R.pick(WORD)} & ${R.pick(WORD)}`])} ${R.pick(w.biz ?? ['Studio'])}`],
      [20, () => `${R.pick(WORD)} ${R.pick(SUFFIX).replace(/^./, (c) => c.toUpperCase())} ${R.pick(w.biz ?? ['Studio'])}`],
      [15, () => `${compound(R)}.${R.pick(['studio', 'co', 'works', 'club', 'org', 'site'])}`],
      [10, () => `The ${R.pick(ADJ)} ${R.pick(w.biz ?? ['Studio'])}`],
    ])()
    case 'video': return R.pick(VIDEO_SHAPES)(R, w)
    case 'writing': return R.pick(WRITING_SHAPES)(R, w)
    case 'design': {
      const client = `${R.pick([compound(R), R.pick(WORD)])} ${cap(w.client ?? 'Studio')}`
      switch (w.briefKind) {
        case 'typeface': return `${R.pick([R.pick(WORD), compound(R)])} ${R.pick(TYPE_SUFFIX)}`
        case 'identity': return `${client} identity`
        case 'posters': return R.pick([
          () => `${cap(w.designTopic ?? 'Tide')} posters`.replace(/^The /, ''), () => `${cap(w.designTopic ?? 'Tide')} poster series`.replace(/^The /, ''),
          () => `Posters for ${compound(R)}`, () => `${R.pick(WORD)} posters`, () => `${R.pick(ADJ)} ${R.pick(NOUN)} posters`,
        ])()
        case 'icons': return `${R.pick(WORD)} ${R.pick(['Icons', 'Icon Set', 'Glyphs', 'Pictograms'])}`
        case 'packaging': return `${client} packaging`
        case 'wayfinding': return `${compound(R)} ${R.pick(['Hospital', 'Library', 'Campus', 'Station', 'Museum', 'Market Hall'])} wayfinding`
        case 'system': return `${R.pick(WORD)} design system`
        case 'book': return `Cover for ${R.pick(['The', 'A'])} ${R.pick(ADJ)} ${R.pick(NOUN)}`
        case 'album': return R.pick([`${R.pick(ADJ)} ${R.pick(NOUN)} sleeve`, `Sleeve for ${R.pick(ADJ)} ${R.pick(NOUN)}`, `${R.pick(ADJ)} ${R.pick(NOUN)}, LP artwork`])
        case 'festival': return `${compound(R)} ${R.pick(['Festival', 'Fest', 'Weekender', 'Film Days', 'Book Fair'])} identity`
        case 'appicon': return `${R.pick(WORD)}${R.pick(APP_SUFFIX)} icon`
        case 'menu': return `${R.pick(WORD)} & ${R.pick(WORD)} menu`
        case 'report': return `${client} annual report`
        default: return R.pick([
          () => `${cap(w.designTopic ?? R.pick(WORD))} illustrations`.replace(/^The /, ''), () => `Drawing ${w.designTopic ?? 'the tide'}`,
          () => `${R.pick(WORD)} spot illustrations`, () => `Illustrations for ${compound(R)} Magazine`, () => `${R.pick(ADJ)} ${R.pick(NOUN)}, illustrated`,
        ])()
      }
    }
    case 'business_idea': return R.weighted([
      [40, () => `${R.pick(WORD)} ${R.pick(BUSINESS_SUFFIX)}`],
      [20, () => `${R.pick(BIZ_ADJ)} ${R.pick(BUSINESS_SUFFIX)}`],
      [15, () => compound(R)],
      [10, () => `${R.pick(['Second', 'Spare', 'Common', 'Shared', 'Borrowed', 'Mended', 'Local', 'Weekly'])} ${R.pick(NOUN)}`],
      [15, () => `${R.pick(WORD)}${R.pick(['share', 'swap', 'fix', 'hire', 'run', 'club', 'box', 'cart'])}`],
    ])()
    case 'hardware': return R.weighted([
      [40, () => `${R.pick(WORD)} ${R.pick(HARDWARE_SUFFIX)}`],
      [20, () => `${R.pick(WORD)}-${R.pick([8, 12, 16, 24, 32, 40, 48, 60, 64, 88, 100])}`],
      [20, () => R.pick(WORD)],
      [20, () => compound(R)],
    ])()
    case 'api_tool': return R.weighted([
      [36, () => R.pick(WORD).toLowerCase()],
      [28, () => compound(R).toLowerCase()],
      [22, () => `${R.pick(WORD).toLowerCase()}${R.pick(CLI_SUFFIX)}`],
      [14, () => `${R.pick(WORD).toLowerCase()}${R.pick(WORD).toLowerCase()}`],
    ])()
    default: return compound(R)
  }
}
