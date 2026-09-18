import { settle } from '../compose.mjs'

/** Business ideas: a customer, a price, a channel, and the assumption it all rests on. */

const IDEAS = [
  { what: '<a repair subscription|a monthly repair plan|repair-as-a-service|a fix-it membership> for {things}', who: 'households', model: 'monthly subscription', things: ['kids’ bikes', 'washing machines', 'coffee machines', 'laptops'] },
  { what: '<a marketplace|an online market|a resale site|a trading board> for {things}', who: 'small makers', model: 'commission', things: ['second-hand tools', 'offcut timber', 'restaurant equipment', 'studio pottery'] },
  { what: '<a co-op|a cooperative|a worker-owned agency|a collective> for {things}', who: 'freelancers', model: 'membership', things: ['illustrators', 'sound engineers', 'translators', 'bike couriers'] },
  { what: '<shared kitchen space|a rentable commercial kitchen|a kitchen by the hour> for {things}', who: 'food start-ups', model: 'hourly rental', things: ['bakers', 'caterers', 'hot sauce makers', 'meal-prep cooks'] },
  { what: '<a tool library|a lending library of tools|a borrow-don’t-buy shed> for {things}', who: 'neighbourhoods', model: 'annual membership', things: ['one postcode', 'a housing estate', 'a small town', 'three streets'] },
  { what: '<a delivery service|cargo-bike delivery|same-day delivery|a shared courier> for {things}', who: 'independent shops', model: 'per-delivery fee', things: ['bookshops', 'florists', 'bakeries', 'pharmacies'] },
  { what: '<bookkeeping|a bookkeeping service|tax-return help|monthly accounts> for {things}', who: 'sole traders', model: 'monthly fee', things: ['tradespeople', 'musicians', 'childminders', 'market traders'] },
  { what: '<a refill van|a mobile refill shop|a zero-waste van round> for {things}', who: 'rural villages', model: 'margin on goods', things: ['cleaning products', 'dry goods', 'toiletries', 'pet food'] },
  { what: '<a booking platform|online booking|a shared calendar service> for {things}', who: 'venues', model: 'per-booking fee', things: ['village halls', 'rehearsal rooms', 'community kitchens', 'darkrooms'] },
  { what: '<a training course|a twelve-week course|an evening course|a bootcamp> for {things}', who: 'career changers', model: 'course fee', things: ['junior sound designers', 'bike mechanics', 'UX researchers', 'bakers'] },
  { what: '<a rental service|a hire scheme|monthly rental|a lending subscription> for {things}', who: 'parents', model: 'monthly rental', things: ['baby carriers', 'kids’ skis', 'cargo bikes', 'school instruments'] },
  { what: '<insurance|an insurance product|cover|pay-as-you-go insurance> for {things}', who: 'freelancers', model: 'annual premium', things: ['camera kit', 'musical instruments', 'bikes used for work', 'drones'] },
  { what: '<a staffing agency|temp staffing|a shift-cover service> for {things}', who: 'hospitality businesses', model: 'hourly margin', things: ['festival bars', 'wedding catering', 'ski chalets', 'pop-up restaurants'] },
  { what: '<a lunch service|office lunches|a lunch delivery round> for {things}', who: 'small offices', model: 'per-meal price', things: ['co-working spaces', 'architecture studios', 'clinics', 'workshops'] },
  { what: '<a consultancy|a one-person consultancy|freelance support> for {things}', who: 'charities', model: 'day rate', things: ['grant writing', 'accessibility audits', 'volunteer management', 'fundraising pages'] },
  { what: '<print on demand|a print-on-demand shop|a small-run printing service|made-to-order printing> for {things}', who: 'illustrators', model: 'margin per print', things: ['risograph prints', 'zines', 'calendars', 'tea towels'] },
  { what: '<a meal kit|a recipe box|a weekly food box> for {things}', who: 'busy families', model: 'weekly subscription', things: ['batch cooking', 'school lunches', 'plant-based dinners', 'freezer meals'] },
  { what: '<a pet-sitting network|home pet care|a sitter network> for {things}', who: 'pet owners', model: 'booking fee', things: ['elderly dogs', 'cats who hate catteries', 'rabbits', 'working dogs'] },
  { what: '<a buying club|a group-buying co-op|a bulk ordering club> for {things}', who: 'small cafés', model: 'membership plus margin', things: ['coffee', 'milk', 'compostable cups', 'pastries'] },
  { what: '<coaching|a coaching service|mentoring|a peer-coaching circle> for {things}', who: 'first-time managers', model: 'monthly retainer', things: ['engineering leads', 'head chefs', 'shop managers', 'nurses'] },
  { what: '<a used-kit store|a second-hand shop|a consignment shop|a refurbished-kit store> for {things}', who: 'hobbyists', model: 'consignment', things: ['climbing gear', 'film cameras', 'synths', 'road bikes'] },
]
const CHANNELS = ['word of mouth', 'a Facebook group', 'local councils', 'farmers’ markets', 'Instagram', 'a partner shop',
  'school newsletters', 'trade fairs', 'LinkedIn', 'the existing customer list', 'cold email', 'a waiting list from a blog post']
const COMPETITORS = ['a big national chain', 'a spreadsheet and a lot of phone calls', 'the big marketplace', 'a friend with a van',
  'the council service', 'two funded start-ups', 'the local Facebook group', 'the supermarket', 'an agency in the city']
/** What the price is called, per model, so "the £9 consignment" never happens. */
const OFFER = {
  'monthly subscription': 'the {price} monthly plan', commission: 'the {pct} per cent commission', membership: 'the {price} membership',
  'hourly rental': 'the {price} hourly rate', 'annual membership': 'the {price} annual membership', 'per-delivery fee': 'the {price} delivery fee',
  'monthly fee': 'the {price} monthly fee', 'margin on goods': 'the margin on each refill', 'per-booking fee': 'the {price} booking fee',
  'course fee': 'the {price} course fee', 'monthly rental': 'the {price} monthly rental', 'annual premium': 'the {price} annual premium',
  'hourly margin': 'the hourly margin', 'per-meal price': 'the {price} lunch price', 'day rate': 'the {price} day rate',
  'margin per print': 'the margin per print', 'weekly subscription': 'the {price} weekly box', 'booking fee': 'the {price} booking fee',
  'membership plus margin': 'the {price} membership', 'monthly retainer': 'the {price} monthly retainer', consignment: 'the consignment split',
}
const ADJ = ['small', 'local', 'boring', 'profitable-on-day-one', 'cooperative', 'slow-growth', 'seasonal', 'niche', 'part-time', 'two-person']

export default {
  slug: 'business_idea',
  work: 'plan', works: 'plans', audience: 'customer', verbed: 'read', verb: 'read',
  digital: false, interactive: false, next: 'draft',
  devices: ['laptop', 'phone', 'printout', 'tablet', 'second monitor with a spreadsheet open', 'train with bad signal'],

  world(R, { currency = '£' } = {}) {
    const i = R.pick(IDEAS)
    const things = R.pick(i.things)
    const price = `${currency}${R.pick([4, 5, 6, 8, 9, 12, 15, 19, 24, 29, 35, 49, 60, 90, 120])}`
    return {
      unit: 'read', units: 'reads', idea: settle(R, i.what).replace('{things}', things), who: i.who, things, model: i.model,
      price, channel: R.pick(CHANNELS), competitor: R.pick(COMPETITORS), adj: R.pick(ADJ),
      spot: R.pick(['the revenue section', 'the one-pager', 'the pricing slide']),
      spot2: R.pick(['the market sizing', 'the competitor table', 'the go-to-market plan']),
      spot3: R.pick(['the unit economics sheet', 'the first-year plan', 'the risks section']),
      feature: (OFFER[i.model] ?? 'the {price} price').replace('{price}', price).replace('{pct}', String(R.pick([10, 12, 15, 18, 20, 25]))), feature2: `the ${R.pick(['launch', 'pilot', 'founding'])} offer`,
      feature3: `the plan to find customers through ${R.pick(CHANNELS)}`,
    }
  },

  places: ['in {spot}', 'in {spot2}', 'in {spot3}', 'on the first page', 'in the numbers', 'in the pitch', 'at the pricing',
    'in the assumptions list', 'in the costs section', 'in the summary'],

  cats: {
    'Accessibility': ['access', ['the service for people without a car', 'the booking by phone', 'the pricing for low incomes',
      'the website for older customers', 'the pick-up points']],
    'Alternatives and status quo': ['reason', ['the comparison with {competitor}', 'the status quo', 'the switching cost',
      'the reason people would leave {competitor}', 'the free alternative']],
    'Testable assumptions': ['reason', ['the conversion assumption', 'the retention figure', 'the assumption about {who}',
      'the churn estimate', 'the assumption that {channel} will work', 'the price sensitivity guess']],
    'Bug or defect': ['bug', ['the spreadsheet double-counts the delivery cost', 'the growth tab uses the wrong month as a base',
      'the margin formula ignores VAT', 'the summary and {spot3} give different break-even dates',
      'the market size is annual in one place and monthly in another']],
    'Confusion': ['confusion', []],
    'Copy': ['copy', ['the one-line pitch', 'the headline on the landing page', 'the description of {feature}', 'the name', 'the FAQ']],
    'Delight, keep this': ['delight', []],
    'Founder fit': ['reason', ['your background in this', 'the time you can give it', 'the network you already have', 'the reason it is you']],
    'Friction': ['flow', ['the one-pager', 'the order of the sections', 'the jargon in {spot}', 'the appendix', 'the number of assumptions']],
    'Go-to-market': ['reason', ['{feature3}', 'the launch plan', 'the first hundred customers', 'the partnership with {channel}',
      'the referral scheme', 'the pilot']],
    'Missing': ['missing', ['a line for payment fees', 'a plan for refunds', 'a named first customer', 'a competitor list',
      'a churn assumption', 'a plan for the quiet months', 'an insurance cost', 'a break-even month']],
    'Moat': ['reason', ['the defensibility', 'the network effect claim', 'the supplier relationships', 'the brand', 'the local knowledge']],
    'Naming and brand': ['copy', ['the name', 'the tagline', 'the logo idea', 'the tone of the landing page']],
    'Performance': ['perf', ['the operations at scale', 'the delivery capacity', 'the booking system load']],
    'Positioning': ['pitch', ['the pitch', 'the landing page promise', 'the positioning against {competitor}', 'the one-liner',
      'the target customer description']],
    'Pricing and model': ['money', ['{feature}', 'the {model}', 'the tier structure', '{feature2}', 'the annual discount',
      'the price for {who}']],
    'Problem definition': ['reason', ['the problem statement', 'the pain you describe', 'the evidence the problem is real',
      'the story in the opening']],
    'Regulatory and legal': ['reason', ['the licensing', 'the insurance position', 'the food safety side', 'the employment status of workers',
      'the data protection side']],
    'Target customer': ['reason', ['the target customer', 'the description of {who}', 'the first segment', 'the persona in {spot}']],
    'Timing': ['reason', ['the timing', 'the launch month', 'the seasonality', 'the why-now argument']],
    'Unit economics': ['money', ['the margin per order', 'the customer acquisition cost', 'the delivery cost', 'the lifetime value',
      'the break-even', '{spot3}']],
  },

  tagline: [
    '{Idea}, aimed at {who}.', 'A {adj} business: {idea}.', '{Idea}, starting with one town.', 'Testing {idea} before quitting my job.',
    '{Idea}, as an alternative to {competitor}.', '{Idea}, run from a spare room.', '{Idea}, selling through {channel} first.',
  ],

  summary: {
    origin: ['I have worked in this trade for {k} years and seen the same gap every season.', 'This came out of my own frustration as a customer.',
      'A friend and I have been sketching this for {k} months.', 'I ran a small version of this last summer by hand.',
      'Three people asked me for exactly this in the same month.'],
    how: ['I have a spreadsheet, a landing page and {k2} people on a waiting list.', 'No money in yet; savings for six months.',
      'Planning to start with {k2} customers found through {channel}.', 'Bootstrapped; I will keep my job until it covers rent.'],
    state: {
      concept: ['This is an idea and some arithmetic.', 'Only a one-pager so far.'],
      prototype: ['I am running it manually for {k2} customers.', 'A pilot with {k2} customers is running.'],
      beta: ['Twenty paying customers, all found through {channel}.', 'Pilot done; deciding whether to go full time.'],
      release_candidate: ['Launching properly in {month}.', 'Registered the company; launching in {month}.'],
      shipped: ['Trading since {month}.', 'Running since {month}; profitable in two of those months.'],
    },
    why: ['I want someone to break the numbers before a customer does.', 'I am not sure {feature} [is|are:feature] the right price.',
      'I cannot tell whether {who} are the right first customers.', 'The part I trust least is {spot2}.'],
  },

  session: [
    'Read the whole thing twice.', 'Read it on a {device}, then went through the numbers.', 'Read the one-pager, then the spreadsheet, about {n} minutes.',
    'Went through it for {n} minutes with a calculator.', 'Read it as a sceptical customer would.', 'Read it on a {device}; {n} minutes.',
  ],

  ask: {
    task: ['Read {spot} as one of {who}.', 'Read {spot2} first, then {spot}.', 'Read it as someone at {competitor}.', 'Price {idea} yourself before you read {spot}.', 'Read it imagining you found it through {channel}.', 'Read only {spot3}.', 'Skim the one-pager, then read {spot2} properly.',
      'Read the one-pager once, no more.', 'Price it in your head before you read my number.', 'Look at the numbers before the story.',
      'Read it as if a friend had sent it unprompted.', 'Add the competitor I missed.', 'Read only {spot}.',
      'Read it as the person whose job is to say no.', 'Work out how many customers it needs before it works.',
      'Read it as somebody who has run one of these.', 'Read it once for the idea and once for the arithmetic.'],
    probe: ['Tell me whether {feature} would stop you buying.', 'Say whether {channel} is a real way to reach {who}.', 'Tell me what {competitor} does better.', 'Name the number in {spot2} you doubt most.', 'Would you pay for {idea}? If not, tell me what would change your mind.', 'Tell me which of {who} you would sell to first.', 'Say whether {feature2} is generous or just expensive for me.', 'Tell me what {spot3} leaves out.', 'Say whether {idea} is a business or a service I would be doing by hand forever.',
      'Tell me whether you would pay {price}. If not, give me the number you would pay.', 'Tell me who this is not for.',
      'Name the cost I have forgotten.', 'Tell me the assumption that has to hold for any of it to work.',
      'Name the part that sounds like a feature rather than a business.', 'Tell me how it dies, if it dies.',
      'Say whether the market is small or only badly described.', 'Tell me what I should cut to start sooner.',
      'Name the competitor I ought to worry about.', 'Say whether the first customer is findable or hypothetical.',
      'Tell me whether the margin survives one bad month.', 'Tell me whether you would take the meeting.'],
  },

  changelog: ['Added payment fees and refunds to the model.', 'Dropped the price to {price}.', 'New section on {competitor}.',
    'Named the first ten customers.', 'Rewrote the pitch around {who}.', 'Moved the launch to {month}.', 'Cut the second revenue line.',
    'Added a churn assumption.', 'Split the one-pager into problem and plan.', 'Break-even month added to the summary.'],

  suggestion: ['Model payment fees', 'Name the first ten customers', 'Test {price} with real buyers', 'Compare against {competitor}',
    'Cut the second revenue line', 'A plan for the quiet months', 'Add a churn assumption', 'Start in one town',
    'Show the break-even month', 'A pilot through {channel}'],
}
