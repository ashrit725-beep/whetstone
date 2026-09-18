import { settle } from '../compose.mjs'

/** Hardware: an object with parts, a board inside, a battery, and a bill of materials. */

const DEVICES = [
  { what: 'a desk lamp that <dims|turns itself down|fades out> when you <leave|walk away|leave the room>', parts: ['the arm joint', 'the base', 'the dimmer dial', 'the diffuser', 'the cable exit'] },
  { what: 'a <forty|forty-two|thirty-six>-key <mechanical|low-profile|split> keyboard', parts: ['the case', 'the stabilisers', 'the plate', 'the USB-C port', 'the knob', 'the keycaps'] },
  { what: 'a soil <moisture|temperature and moisture> sensor for <allotments|raised beds|greenhouses>', parts: ['the probe', 'the enclosure', 'the solar panel', 'the antenna', 'the battery door'] },
  { what: 'a <pocket|palm-sized|two-channel> field recorder', parts: ['the mic capsules', 'the record button', 'the headphone jack', 'the screen', 'the SD slot'] },
  { what: 'an e-ink <bus times|train departures|tram times> display', parts: ['the e-ink panel', 'the frame', 'the wall mount', 'the refresh button', 'the power input'] },
  { what: 'a modular synth module', parts: ['the front panel', 'the jacks', 'the pots', 'the power header', 'the LEDs'] },
  { what: 'a <rear bike light|bike light> that <brightens when you brake|flashes when you slow down|reacts to braking>', parts: ['the clamp', 'the lens', 'the charge port', 'the button', 'the housing seam'] },
  { what: 'a kitchen scale <for bakers|with a hydration mode|for bread and coffee>', parts: ['the platform', 'the display', 'the tare button', 'the feet', 'the battery compartment'] },
  { what: 'a <plant-watering|balcony irrigation|self-watering> controller', parts: ['the pump', 'the tubing clips', 'the reservoir', 'the app pairing button', 'the float sensor'] },
  { what: 'a braille label maker', parts: ['the embosser', 'the dial', 'the tape cartridge', 'the grip', 'the cutter'] },
  { what: 'a <kids’ audio player|screen-free story player|children’s music box> <with cards|that plays cards|with NFC cards>', parts: ['the card slot', 'the volume wheel', 'the speaker grille', 'the charging dock', 'the strap'] },
  { what: 'a <motorised|compact|silent> camera slider for <small studios|product shots|interview setups|one-person shoots>', parts: ['the carriage', 'the rail', 'the motor housing', 'the end stops', 'the controller'] },
  { what: 'a hive <scale|monitor> for <beekeepers|small apiaries>', parts: ['the load cells', 'the frame', 'the weatherproof box', 'the solar panel', 'the cable glands'] },
  { what: 'a <fuzz|delay|reverb|looper|tremolo> pedal', parts: ['the footswitch', 'the enclosure', 'the knobs', 'the jacks', 'the battery door'] },
  { what: 'a CO₂ monitor for <classrooms|offices|bedrooms|meeting rooms>', parts: ['the traffic-light LED', 'the sensor vent', 'the display', 'the mount', 'the USB port'] },
  { what: 'a <thumb|finger|large-ball> trackball', parts: ['the ball', 'the bearings', 'the scroll ring', 'the buttons', 'the shell'] },
  { what: 'a weather station <kit|for schools|for sailing clubs>', parts: ['the anemometer', 'the rain gauge', 'the mast bracket', 'the sensor shield', 'the base unit'] },
  { what: 'a <doorbell|video doorbell|door chime> <with no cloud|that works offline|with no subscription>', parts: ['the button', 'the camera window', 'the chime unit', 'the mounting plate', 'the wiring terminals'] },
  { what: 'a handheld game console <kit|you solder yourself|for retro games>', parts: ['the d-pad', 'the shoulder buttons', 'the screen bezel', 'the battery', 'the shell'] },
  { what: 'a <coffee grinder retrofit|grinder upgrade kit|burr grinder mod>', parts: ['the motor mount', 'the burr carrier', 'the adjustment collar', 'the hopper', 'the switch'] },
]
const BOARDS = ['ESP32', 'RP2040', 'nRF52840', 'STM32', 'ATmega32U4', 'Raspberry Pi Zero', 'ESP32-C3']
const TOOLS = ['KiCad', 'Fusion 360', 'Onshape', 'FreeCAD', 'a Prusa and a lot of patience', 'SolidWorks']
const ADJ = ['small', 'repairable', 'open-source', 'battery-powered', 'quiet', 'solid', 'cheap', 'modular', 'kit-built', 'plain']

export default {
  slug: 'hardware',
  work: 'device', works: 'devices', audience: 'buyer', verbed: 'handled', verb: 'handle',
  digital: false, interactive: true, next: 'revision',
  devices: ['laptop', 'phone', 'tablet', '27-inch monitor', 'printout', 'second screen'],

  world(R) {
    const d = R.pick(DEVICES)
    const parts = R.some(d.parts, 3)
    const what = settle(R, d.what)
    return {
      unit: 'day', units: 'days', what, whatNoun: what.replace(/^an? /, ''),
      setting: R.pick(['desk', 'workbench', 'kitchen counter', 'bedside table', 'studio shelf', 'allotment shed', 'bike']), spot: parts[0], spot2: parts[1], spot3: parts[2],
      feature: parts[0], feature2: parts[1], feature3: 'the companion app',
      board: R.pick(BOARDS), tool: R.pick(TOOLS), adj: R.pick(ADJ),
      price: `${R.pick([19, 29, 35, 45, 59, 79, 99, 129, 149, 199])}`, battery: `${R.pick([2, 3, 6, 9, 12, 18])} months`,
    }
  },

  places: ['at {spot}', 'around {spot2}', 'on the underside', 'at the seam', 'in the render', 'in the prototype photos', 'in the BOM',
    'in the spec sheet', 'on {spot3}', 'at the cable exit', 'in the assembly guide'],

  cats: {
    'Accessibility': ['access', ['the button feel for people with arthritis', 'the LED-only status', 'the small labels', 'the app-only setup',
      'the tactile markings on {spot}']],
    'Bill of materials and cost': ['money', ['the BOM', 'the cost of {spot}', 'the enclosure cost at a thousand units', 'the {board}',
      'the connector choice', 'the retail price of {currency}{price}']],
    'Bug or defect': ['bug', ['the firmware resets when the battery dips below 20 per cent', '{spot} rattles after a day of use',
      'the Bluetooth drops if the phone locks', 'the status LED stays on after shutdown', 'the display ghosts after a refresh',
      'the button double-registers when pressed firmly']],
    'Confusion': ['confusion', []],
    'Connectivity and pairing': ['system', ['the pairing flow', 'the Bluetooth range', 'the Wi-Fi setup', 'the reconnect after sleep',
      'the USB enumeration']],
    'Copy': ['copy', ['the product page', 'the spec sheet', 'the quick-start card', 'the labels on {spot}', 'the warning text']],
    'Delight, keep this': ['delight', []],
    'Design for manufacture': ['physical', ['{spot}', 'the snap fits', 'the draft angles', 'the screw bosses', 'the two-part enclosure',
      'the PCB mounting', 'the tolerances on {spot2}']],
    'Documentation': ['copy', ['the assembly guide', 'the pinout diagram', 'the firmware README', 'the safety sheet', 'the schematic notes']],
    'Ergonomics': ['physical', ['{spot}', 'the weight', 'the grip', 'the button placement', 'the angle of {spot2}', 'the reach to {spot3}']],
    'Firmware and companion app': ['system', ['the companion app', 'the firmware update process', 'the settings menu on the device',
      'the calibration routine', 'the app onboarding']],
    'Friction': ['flow', ['the setup', 'the pairing', 'the first charge', 'the assembly', 'the reset button combination']],
    'Industrial design': ['visual', ['the overall form', 'the proportions', '{spot}', 'the colourway', 'the logo placement',
      'the silhouette from the side']],
    'Materials and finish': ['physical', ['the plastic finish', 'the anodised parts', '{spot}', 'the rubber feet', 'the texture on {spot2}',
      'the 3D-printed parts']],
    'Mechanism and moving parts': ['physical', ['{spot}', 'the hinge', 'the detents on {spot2}', 'the spring return', 'the slide action']],
    'Missing': ['missing', ['a way to replace the battery', 'a physical off switch', 'a status light', 'a wall mount', 'a USB-C port',
      'a way to use it without the app', 'a spare-parts list', 'a carrying case']],
    'Packaging': ['physical', ['the box', 'the insert', 'the unboxing order', 'the cable ties', 'the printed card']],
    'Performance': ['perf', ['the battery life claim of {battery}', 'the sensor accuracy', 'the start-up time', 'the refresh rate',
      'the standby drain']],
    'Positioning': ['pitch', ['the product page', 'the price of {currency}{price}', 'the comparison with the big brands', 'the name', 'the launch video']],
    'Power and battery': ['power', ['the battery life', 'the charging time', 'the power adaptor', 'the low-battery warning', 'the {battery} claim']],
    'Repairability': ['physical', ['the screws', 'the glued parts', 'the battery access', 'the spare parts plan', '{spot}']],
    'Safety and compliance': ['bug', ['the battery has no thermal cut-off', 'the mains section has no clear creepage gap',
      'the small parts are loose enough to be a choking risk', 'the charger is not certified for the markets you list',
      'the enclosure vents sit right above the cells']],
    'Thermals': ['physical', ['the heat near {spot}', 'the vents', 'the warm spot on the underside', 'the regulator heat', 'the case temperature']],
  },

  tagline: [
    'A {adj} {whatNoun}.', '{What}, built on an {board}.', '{What}, designed to be repaired.', 'A {adj} take on {what}.',
    '{What}, for about {currency}{price}.', '{What}, with {battery} of battery life.',
  ],

  summary: {
    origin: ['I built the first one to fix a problem on my own {setting}.', 'This started on a breadboard {k} years ago.',
      'Three friends asked for one after seeing mine.', 'It began as a weekend kit and grew a case.',
      'The commercial ones all need an account and a cloud; this does not.'],
    how: ['Designed in {tool}, running on an {board}.', 'PCB in KiCad, enclosure in {tool}.', 'Firmware in C on an {board}.',
      '{Board} inside, printed enclosure for now.'],
    state: {
      concept: ['Renders and a breadboard.', 'A spec sheet and some sketches.'],
      prototype: ['Working prototype, printed enclosure.', 'Rev A boards arrived last month.'],
      beta: ['Twenty units out with testers.', 'Rev B, close to production.'],
      release_candidate: ['Tooling ordered; first run of {k2}00 in {month}.', 'Pre-orders open in {month}.'],
      shipped: ['Shipping since {month}.', 'The first batch sold out in {month}; planning Rev C.'],
    },
    why: ['I need to know what feels cheap.', 'I cannot tell whether {spot} will survive daily use.',
      'The BOM is too high and I do not know what to cut.', 'I am about to order tooling and want a last check.'],
  },

  session: [
    'Had the prototype on my {setting} for {k} days.', 'Went through the renders and the spec sheet, about {n} minutes.',
    'Used the unit for {k} days on my {setting}.', 'Looked at the photos and the BOM for {n} minutes.',
    'Assembled the kit, which took {n} minutes, then used it for a week.', 'Read the spec sheet first, then the photos.',
  ],

  ask: {
    task: ['Look at {spot} before anything else.', 'Compare {spot} and {spot2} in the photos.', 'Picture {spot} after a year in a bag.', 'Read the spec sheet with {spot3} in mind.', 'Imagine assembling {spot} yourself.', 'Look at {spot2} from the side.',
      'Hold the render at arm’s length.', 'Read the dimensions before you look at the photos.', 'Picture it on your {setting} for a year.',
      'Compare it to the thing you already own that does this.', 'Read the spec sheet first and the pitch second.',
      'Look at the ports and nothing else.', 'Assume you have to repair it in three years.', 'Look at where your hand actually goes.',
      'Assume we are shipping a thousand of these.', 'Look at the prototype photo, not the render.'],
    probe: ['Tell me whether {spot} looks strong enough.', 'Say whether {spot2} is where you would expect it.', 'Tell me what you would pay for {whatNoun}.', 'Name the part you would redesign first, {spot} or {spot2}.', 'Tell me whether {battery} of battery life sounds believable.', 'Say whether {spot3} looks finished.', 'Tell me if {whatNoun} solves a problem you have.',
      'Tell me what you think it costs.', 'Tell me whether {spot} [is|are:spot] worth the millimetres it adds.', 'Name the first thing you would knock off a desk.',
      'Tell me what you would remove to make it cheaper.', 'Say whether it reads as a product or a prototype.', 'Name the part that will fail first.',
      'Tell me whether the size is honest.', 'Say what you would want in the box.', 'Name the tolerance I am going to regret.',
      'Say whether you would use it every day.', 'Tell me what it looks like it should weigh.'],
  },

  changelog: ['Rev B: {spot} redesigned for strength.', 'Battery door is now screw-free.', 'Moved to USB-C.', 'Firmware no longer resets on low battery.',
    'Added a physical off switch.', 'Swapped the {board} for a cheaper module.', 'Enclosure wall thickness up to 2 mm.', 'New matte finish.',
    'Pairing takes one step now.', 'Status LED dimmed at night.', 'Spare parts list published.'],

  suggestion: ['Replaceable battery', 'Physical off switch', 'USB-C instead of micro-USB', 'Use it without the app', 'A wall mount',
    'Strengthen {spot}', 'Publish the spare parts list', 'Matte finish on {spot2}', 'Make {spot3} quieter', 'A cheaper kit version'],
}
