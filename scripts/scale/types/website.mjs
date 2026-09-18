import { settle } from '../compose.mjs'

/** Websites: who they are for, what they sell, and whether the first screen says so. */

const DOMAINS = [
  { topic: '<a ceramics studio|a pottery studio|a small ceramics workshop>', biz: ['Ceramics', 'Clay Studio', 'Pottery'], sells: 'classes and commissions', pages: ['the classes page', 'the shop', 'the commissions page', 'the about page'],
    feats: ['the class calendar', 'the booking form', 'the gallery grid', 'the newsletter sign-up'] },
  { topic: 'a bicycle repair co-op', biz: ['Bike Co-op', 'Cycles', 'Bike Workshop'], sells: 'repairs and workshops', pages: ['the services page', 'the booking page', 'the workshops page', 'the membership page'],
    feats: ['the price list', 'the opening hours block', 'the map', 'the booking widget'] },
  { topic: 'a translation agency', biz: ['Translations', 'Language Services'], sells: 'certified translations', pages: ['the services page', 'the quote form', 'the languages page', 'the case studies'],
    feats: ['the instant quote', 'the language list', 'the client logos', 'the turnaround table'] },
  { topic: 'an architecture practice', biz: ['Architects', 'Architecture', 'Studio'], sells: 'residential design', pages: ['the projects page', 'the studio page', 'the process page', 'the contact page'],
    feats: ['the project grid', 'the full-bleed photography', 'the process timeline', 'the enquiry form'] },
  { topic: 'a wedding photographer', biz: ['Photography', 'Weddings'], sells: 'wedding packages', pages: ['the portfolio', 'the packages page', 'the enquiry page', 'the reviews page'],
    feats: ['the package table', 'the portfolio slideshow', 'the availability checker', 'the testimonials'] },
  { topic: '<a small coffee roaster|an independent coffee roaster|a coffee roastery>', biz: ['Coffee', 'Roasters', 'Coffee Co.'], sells: 'subscriptions and wholesale', pages: ['the shop', 'the subscription page', 'the wholesale page', 'the brewing guides'],
    feats: ['the grind selector', 'the subscription builder', 'the tasting notes', 'the brewing guides'] },
  { topic: 'a dance school', biz: ['Dance', 'Dance School', 'Movement'], sells: 'term classes', pages: ['the timetable', 'the classes page', 'the teachers page', 'the pricing page'],
    feats: ['the timetable filter', 'the trial class form', 'the teacher bios', 'the term dates'] },
  { topic: 'a record label', biz: ['Records', 'Recordings'], sells: 'vinyl and downloads', pages: ['the releases page', 'the artist pages', 'the shop', 'the tour dates'],
    feats: ['the audio previews', 'the pre-order button', 'the release grid', 'the mailing list form'] },
  { topic: 'a physiotherapy clinic', biz: ['Physio', 'Physiotherapy', 'Clinic'], sells: 'appointments', pages: ['the treatments page', 'the booking page', 'the team page', 'the prices page'],
    feats: ['the online booking', 'the conditions list', 'the insurance section', 'the first-visit guide'] },
  { topic: 'a climbing gym', biz: ['Climbing', 'Bouldering', 'Climbing Wall'], sells: 'memberships and classes', pages: ['the membership page', 'the first-visit page', 'the classes page', 'the opening hours'],
    feats: ['the live busyness meter', 'the induction booking', 'the route news', 'the price comparison'] },
  { topic: 'a font foundry', biz: ['Type', 'Type Foundry', 'Letters'], sells: 'typeface licences', pages: ['the typeface pages', 'the licensing page', 'the specimen', 'the trial page'],
    feats: ['the type tester', 'the licence calculator', 'the weight slider', 'the trial download'] },
  { topic: 'a community theatre', biz: ['Theatre', 'Playhouse', 'Stage'], sells: 'tickets', pages: ['the what’s-on page', 'the show pages', 'the volunteer page', 'the access page'],
    feats: ['the seat map', 'the season listing', 'the access information', 'the donation button'] },
  { topic: 'a freelance illustrator', biz: ['Illustration', 'Drawings'], sells: 'commissions', pages: ['the portfolio', 'the about page', 'the commissions page', 'the shop'],
    feats: ['the portfolio filter', 'the client list', 'the rates table', 'the print shop'] },
  { topic: 'a zero-waste shop', biz: ['Refills', 'Refill Shop', 'Pantry'], sells: 'refills and delivery', pages: ['the shop', 'the delivery page', 'the how-it-works page', 'the stockists'],
    feats: ['the refill finder', 'the delivery map', 'the product filters', 'the container deposit explainer'] },
  { topic: 'a developer conference', biz: ['Conf', 'Summit', 'Days'], sells: 'tickets', pages: ['the schedule', 'the speakers page', 'the tickets page', 'the venue page'],
    feats: ['the schedule grid', 'the speaker cards', 'the ticket tiers', 'the travel guide'] },
  { topic: 'a tattoo studio', biz: ['Tattoo', 'Tattoo Studio', 'Ink'], sells: 'bookings', pages: ['the artists page', 'the booking page', 'the aftercare page', 'the flash gallery'],
    feats: ['the artist portfolios', 'the deposit form', 'the flash sheets', 'the aftercare guide'] },
  { topic: '<a bakery|a neighbourhood bakery|a sourdough bakery>', biz: ['Bakery', 'Bakehouse', 'Bread'], sells: 'pre-orders and wholesale', pages: ['the menu', 'the pre-order page', 'the wholesale page', 'the about page'],
    feats: ['the daily menu', 'the pre-order form', 'the allergen table', 'the location map'] },
  { topic: '<an open-source project|an open-source library|a small open-source tool>', biz: ['Project', 'docs'], sells: 'sponsorships', pages: ['the docs home', 'the showcase', 'the sponsors page', 'the blog'],
    feats: ['the install snippet', 'the version switcher', 'the sponsor tiers', 'the showcase grid'] },
  { topic: 'a local newspaper', biz: ['Gazette', 'Courier', 'Chronicle', 'Post'], sells: 'subscriptions', pages: ['the front page', 'the article pages', 'the subscribe page', 'the archive'],
    feats: ['the paywall', 'the section navigation', 'the newsletter signup', 'the archive search'] },
  { topic: '<a design agency|a small design studio|a two-person design practice>', biz: ['Studio', 'Design', '& Partners'], sells: 'brand projects', pages: ['the work page', 'the case studies', 'the services page', 'the contact page'],
    feats: ['the case study layouts', 'the client logos', 'the process section', 'the contact form'] },
  { topic: 'a language school', biz: ['Languages', 'Language School'], sells: 'courses', pages: ['the courses page', 'the level test', 'the timetable', 'the teachers page'],
    feats: ['the level test', 'the course finder', 'the price table', 'the teacher videos'] },
  { topic: '<a personal portfolio|my own portfolio|a freelancer’s portfolio>', biz: ['Portfolio'], sells: 'freelance work', pages: ['the home page', 'the case studies', 'the about page', 'the writing page'],
    feats: ['the project list', 'the intro paragraph', 'the contact link', 'the CV download'] },
]

const ADJ = ['quiet', 'fast', 'plain', 'warm', 'one-page', 'editorial', 'honest', 'small', 'bold', 'accessible', 'text-first']
const STACKS = ['Astro', 'Eleventy', 'hand-written HTML and CSS', 'Webflow', 'WordPress with a custom theme', 'Hugo',
  'Next.js', 'Squarespace', 'Kirby', 'Jekyll', 'Framer', 'Ghost']

export default {
  slug: 'website',
  work: 'site', works: 'sites', audience: 'visitor', verbed: 'browsed', verb: 'browse',
  digital: true, interactive: true, next: 'revision',
  devices: ['phone on 4G', 'iPhone SE', 'laptop in Safari', 'desktop in Firefox', 'Android in Chrome', 'tablet',
    'phone on a slow connection', 'laptop with a screen reader', 'laptop in a narrow window', '27-inch monitor', 'work laptop with fonts blocked'],

  world(R) {
    const d = R.pick(DOMAINS)
    const pages = R.some(d.pages, 3)
    const feats = R.some(d.feats, 3)
    return {
      unit: 'visit', units: 'visits', topic: settle(R, d.topic), biz: d.biz, sells: d.sells, spot: pages[0], spot2: pages[1], spot3: pages[2],
      feature: feats[0], feature2: feats[1], feature3: feats[2], stack: R.pick(STACKS), adj: R.pick(ADJ),
    }
  },

  places: ['on {spot}', 'on {spot2}', 'above the fold', 'in the footer', 'in the main navigation', 'on the contact form',
    'halfway down the home page', 'on a phone', 'in the first screen', 'on {spot3}', 'at the pricing section', 'in the hero'],

  cats: {
    'Accessibility': ['access', ['the colour contrast in the hero', '+the link styles', 'the heading order on {spot}', '+the image alt texts',
      'the focus states on {feature}', 'the autoplaying carousel', 'the form labels on {spot2}', 'the skip link']],
    'Broken link': ['bug', ['the footer link to {spot2} [goes|go:spot2] to a 404', 'the logo links to a staging domain', 'the “book now” button goes nowhere on mobile',
      'the Instagram link points at the wrong account', 'the PDF menu link is dead', 'the anchor links on {spot} jump to the wrong section']],
    'Bug or defect': ['bug', ['the menu stays open after tapping a link on mobile', '{feature} submits twice', 'the hero image loads last',
      'the cookie banner covers the contact button', 'the carousel skips a slide on Safari', 'the page jumps when the fonts load',
      'the map does not load on Firefox', 'the form clears itself if one field is wrong']],
    'Calls to action': ['pitch', ['the main button in the hero', 'the “get in touch” link', '+the two competing buttons on {spot}',
      'the newsletter prompt', 'the booking button on {spot2}', 'the sticky call to action']],
    'Confusion': ['confusion', []],
    'Copy and tone': ['copy', ['the hero headline', 'the about page', 'the intro paragraph on {spot}', 'the tone of {spot2}',
      '+the service descriptions', 'the footer blurb', 'the FAQ answers']],
    'Delight, keep this': ['delight', []],
    'Forms': ['flow', ['the contact form', '{feature}', 'the enquiry form', 'the newsletter form', 'the required fields',
      'the form confirmation']],
    'Friction': ['flow', []],
    'Hero and headline': ['pitch', ['the hero', 'the headline', 'the hero image', 'the subheading', 'the first screen on mobile']],
    'Missing': ['missing', ['a price anywhere', 'an address in the footer', 'a way to contact a real person', 'an opening-hours block',
      'a clear next step on {spot}', 'a search box', 'an about page', 'a phone number on mobile', 'an FAQ',
      'a date on the blog posts']],
    'Mobile layout': ['visual', ['{spot} on a phone', 'the navigation on mobile', 'the hero on a small screen', 'the tables on mobile',
      '{feature} on a phone', 'the footer on mobile']],
    'Navigation': ['flow', ['the main navigation', 'the footer navigation', 'the mobile menu', 'the order of the menu items',
      'the breadcrumb on {spot2}', 'the path from {spot} to {spot2}']],
    'Page speed': ['perf', ['the hero video', '+the web fonts', 'the first load on 4G', '+the gallery images', 'the third-party scripts',
      'the map embed']],
    'Positioning': ['pitch', ['the tagline', 'the way {sells} are described', 'the comparison with competitors', 'the about page story',
      'the site name', 'the case for choosing them']],
    'Pricing page': ['money', ['the pricing table', 'the tiers on {spot2}', 'the “from” price', 'the add-ons list', 'the pricing FAQ']],
    'SEO and metadata': ['copy', ['the page titles', 'the meta descriptions', 'the social share image', 'the URL structure',
      'the headings on {spot}']],
    'Social proof': ['pitch', ['+the testimonials', '+the client logos', 'the review count', '+the case studies', 'the press quotes']],
    'Value proposition': ['pitch', ['the value proposition', 'the promise in the hero', 'the “why us” section', 'the first paragraph']],
    'Visual design': ['visual', ['the typography', 'the colour palette', 'the spacing on {spot}', 'the photography', '+the icons',
      'the grid on {spot2}', 'the hero illustration', 'the footer']],
  },

  tagline: [
    'A {adj} website for {topic}.', 'A new site for {topic}, built in {stack}.', 'A {adj} site for {topic} that sells {sells}.',
    'The website for {topic}, rebuilt from scratch.', 'A {adj} homepage for {topic}.', 'A site that sells {sells} for {topic}.',
  ],

  summary: {
    origin: ['The old site was a template the owner hated.', 'This is a rebuild of a site I made {k} years ago.',
      'A friend’s business, and my first client project.', 'They were getting enquiries by phone only; this is meant to fix that.',
      'Built for {topic} that has never had a site before.'],
    how: ['Built in {stack}.', '{Stack}, no tracking, one font.', 'Designed and built by me in {stack}.', 'Built in {stack} over {k} weekends.'],
    state: {
      concept: ['Wireframes and a moodboard for now.', 'Just the home page design so far.'],
      prototype: ['A staging version with the real copy on {spot}.', 'Staging only; the copy on {spot2} [is|are:spot2] still thin.'],
      beta: ['Soft-launched to existing customers.', 'Live on a staging domain with real content.'],
      release_candidate: ['Going live in {month}.', 'Final copy is in; launching soon.'],
      shipped: ['Live since {month}.', 'Launched in {month}; enquiries are up but bookings are not.'],
    },
    why: ['I want to know if the first screen says what they do.', 'Nobody finds {spot2} and I do not know why.',
      'The owner and I disagree about the hero and I want a tie-break.', 'Bounce rate on mobile is high.'],
  },

  session: [
    'Browsed it for {n} minutes on a {device}.', 'Looked at it on a {device} for about {n} minutes.', '{N} minutes, {device}, as a first-time visitor.',
    'Read it through on a {device}; {n} minutes.', 'Came in cold on a {device} and spent {n} minutes.',
    'About {n} minutes, mostly on a {device}.',
  ],

  ask: {
    task: ['Start on {spot2}.', 'Go from {spot} to {spot2} and nothing else.', 'Look at {spot3} on a {device}.', 'Try {feature} first.',
      'Read the home page once, at normal speed, then close it.', 'Find the contact route without using search.',
      'Look at it on your phone before your laptop.', 'Scroll to the bottom without stopping, then scroll back.',
      'Read only the headings.', 'Land on {spot2} cold, as if from a search result.', 'Look at the first screen for five seconds, then look away.',
      'Try to work out who runs this.', 'Open it on the slowest connection you can arrange.', 'Try to book or buy something.',
      'Try to find the price of {sells}.'],
    probe: ['Tell me whether {spot} says what they do.', 'Say whether {feature} is worth its space.', 'Name the sentence on {spot2} you did not believe.', 'Tell me whether you would find {spot3} without help.', 'Say whether {feature2} is noise.', 'Tell me what you would expect to find on {spot2}.',
      'Tell me what you think they sell.', 'Tell me how long it took.', 'Say whether the first screen tells you what this is or only how it feels.',
      'Name the sentence you stopped on.', 'Tell me who you think this is for.', 'Say what you would click next, and why.',
      'Tell me whether the type is doing hierarchy or decoration.', 'Name the section I could cut.', 'Tell me the claim you did not believe.',
      'Say whether it reads as a company or a person.', 'Tell me whether {feature} [is|are:feature] worth its space.', 'Name the first thing your eye landed on.'],
  },

  changelog: ['New hero copy that says what they do.', 'Contact details in the footer on every page.', 'Fixed the dead link to {spot2}.',
    'Images are a third of the size.', 'The mobile menu closes after a tap.', '{Feature} moved above the fold.',
    'Removed the carousel.', 'Contrast raised across the site.', 'Prices added to {spot}.', 'One call to action per page.',
    'Fonts load without the page jumping.', 'Alt text on every image.'],

  suggestion: ['Put a price on {spot}', 'Address in the footer', 'Move {feature} above the fold', 'Drop the carousel',
    'One button in the hero', 'A phone number on mobile', 'Add dates to the blog', 'Compress the gallery images',
    'Plain-language headline', 'Fix the mobile menu', 'Testimonials near {spot2}', 'A short FAQ'],
}
