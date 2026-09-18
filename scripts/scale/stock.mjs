/**
 * The frames around a review: its headline, the paragraph that opens it, the
 * replies it gets, and the smaller bits of creator text (asks, needs, roadmap
 * reasons). Everything here is a frame with slots, filled from the project's
 * own world and from the points the note actually contains, so a summary
 * names the thing its worst point is about rather than gesturing at "it".
 *
 *   {main}    the subject of the note's most serious issue, as a noun phrase
 *   {praise}  the subject of its best praise point
 *   {obs}     the subject of its first neutral observation
 *   {spot} {feature} {unit} {work} ...  the project's world, see types/
 *
 * A fixed run of five or more words can only recur so often before the
 * writer refuses it (see compose.mjs), so long frames carry `<a|b>`
 * alternatives in the middle: the sentence stays the same shape, and the
 * words a reader would notice repeating do not.
 */

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October',
  'November', 'December']
/** Things people were doing when an idea arrived. All gerund phrases, so "while {hobby}" and "after {hobby}" both read. */
export const HOBBIES = ['sea swimming in March', 'helping at a repair café', 'walking the coast path', 'crossing on a night ferry',
  'clearing my grandfather’s shed', 'volunteering at a food bank', 'working on an allotment', 'sitting in a hospital waiting room',
  'learning to sail', 'ringing birds on the coast', 'working a harvest', 'restoring a narrowboat', 'teaching a night class',
  'moving house twice', 'fixing a neighbour’s radio', 'travelling across the country by train']
export const TIME = ['a week', 'two weeks', 'a month', 'a weekend', 'six weeks', 'the summer', 'the next sprint', 'two evenings']

/* -------------------------------------------------------------- headlines */

export const HEADLINE = {
  positive: [
    '{Feature} [carries|carry:feature] this', 'Came for {spot}, stayed for {feature}', 'Clear from the first {unit}', 'Would come back for another {unit}',
    '{Spot} [is|are:spot] the best thing here', 'Better than the description suggests', 'The {work} knows what it is', '{Feature} [is|are:feature] worth protecting',
    'Held my attention past {spot}', 'Kept going after I meant to stop at {spot}', '{Praise} [is|are:praise] the highlight', 'Easy to recommend already',
    'Strong {unit}, one small snag in {spot2}', 'Solid, and {spot2} [is|are:spot2] lovely', 'Nearly there, and {praise} [is|are:praise] why', 'Confident work on {spot}',
    'Quietly very good', 'More finished than you are letting on', 'Good first {unit}, better second one', '{Praise} sold me',
    'Would use this as it is', 'The care shows in {spot}', 'Small, clear and well made', '{N} minutes and I wanted more',
    'A {unit} I would repeat', 'Right idea, well executed', '{Spot} and {spot2} both land', 'Impressed by {feature}',
    'Very little to fix before {spot2}', '{Spot} [is|are:spot] lovely', '{Feature} [is|are:feature] the star', 'Went in sceptical, came out a fan of {feature}',
    'Good {work}, and {feature} [is|are:feature] great', 'Most of this already works', 'Polished already, especially {spot}', 'Nothing in {spot} to cut',
    '{Praise} did it for me', 'Keen to see {spot3}', 'Strong opening, and {spot2} [holds|hold:spot2] up', 'A pleasure to {verb}',
  ],
  mixed: [
    '{Spot} [works|work:spot], {spot2} [does|do:spot2] not yet', 'Good {work}, rough going in {spot2}', 'Close, but {main} [is|are:main] in the way', 'Strong start, slow going in {spot2}',
    '{Feature} yes, {feature2} not yet', 'Promising, with one real snag in {spot2}', 'Half finished, and the good half is {spot}',
    '{Main} [needs|need:main] a pass; the rest holds', 'Liked it more on the second {unit}', 'Good bones, rough edges around {spot2}',
    'Solid apart from {main}', 'The idea is right, {spot2} [is|are:spot2] not there yet', 'Two tries at {spot2}, same snag both times',
    'Fix {main} first', '{Praise} [works|work:praise], {main} [does|do:main] not', 'Better than I expected, with a caveat about {spot2}',
    'I trusted it until {spot2}', 'Nearly there; {main} [is|are:main] the gap', 'Some of {spot} [is|are:spot] excellent', 'One decision away from {spot2} working',
    'Clear idea, muddier in {spot2}', 'Uneven, but {spot} [is|are:spot] a high point', '{Spot} [is|are:spot] stronger than {spot2}', 'Mixed feelings about {feature}',
    'Good in {spot}, lost in {spot2}', 'Worth it, once {main} [is|are:main] sorted', '{Feature} [is|are:feature] doing too much', 'Half a great {unit}',
    'Promising {work}, awkward in {spot2}', '{Spot2} [undoes|undo:spot2] some of {spot}', 'Almost, apart from {feature2}', 'Rough around {main}',
    'The {work} is ahead of {spot2}', '{Feature2} [gets|get:feature2] in the way of {feature}',
  ],
  negative: [
    'Stalled at {spot}', 'Lost at {spot2}', '{Main} stopped me', 'Could not get past {spot}', 'Too much before {spot} [happens|happen:spot]',
    'Not ready for strangers yet', '{Main} [needs|need:main] rethinking', 'Bounced off {spot}', 'Confused from {spot2} onwards',
    'The idea is there; {spot} [is|are:spot] not', 'Gave up at {spot2}', '{Main} [is|are:main] the whole problem', 'Could not tell what {spot} wanted from me',
    'Stopped at {spot}', 'Too many questions before {spot2}', 'Not for me, and {spot} [is|are:spot] why', 'Hard going after {spot}',
    '{Main} broke it for me', 'The good part is hidden behind {spot}', 'Wanted to like {feature} more', 'Frustrating {unit} in {spot2}',
    'Needs another pass before more {audience}s', 'Stuck on {main}', '{Spot2} lost me', 'Rough {unit}, mostly because of {main}',
    '{Feature} got in my way', 'Did not reach {spot2}', 'Struggled with {feature}', 'Fell apart around {spot2}', '{Main}, twice',
  ],
}

/** An optional short tail on a headline. */
export const HEADLINE_TAIL = [', and I would look again', ', mostly', ' on a {device}', ', for me at least', ', honestly', ' so far']

/* ---------------------------------------------------------- note summaries */

/** Openers any kind of work can take. The type's own openers are in types/. */
export const SESSION = [
  '{N} minutes on a {device}, <mostly|largely|nearly all> in {spot}.', 'About {n} minutes on a {device}<| this morning| last night| over lunch>.',
  '<Spent|Put in|Gave it> {n} minutes, <most of that|the bulk of it|much of it> in {spot}.', 'One sitting, {n} minutes, <on a|using a> {device}.',
  'I <gave it|spent> {n} minutes and <got as far as|reached|made it to> {spot2}.', '<Went through|Got through|Covered> {spot} and {spot2} in about {n} minutes.',
  'Had about {n} minutes, so I <stuck to|focused on|concentrated on> {spot}.', '<Came to it cold|Went in blind|Started with no context> on a {device} and <spent|stayed for|gave it> {n} minutes.',
  'Tried it on a {device} first, then a {device2}; {n} minutes <overall|in total|all told>.', '<Roughly|About|Around> {n} minutes, and I <stopped|called it a day|ran out of time> <at|around|somewhere in> {spot2}.',
  'Single sitting: {n} minutes on a {device}.', '{N} minutes <all told|in one go|without a break>.',
  '<I read your ask first|Read the ask first|I started with your ask>, then {n} minutes <on|in|with> {spot}.', 'Started at {spot} <as you suggested|like you asked|per the ask>; {n} minutes in total.',
  '{N} minutes in, I had <seen|been through|covered> {spot} and <most|some|a bit> of {spot2}.', '<Evening|Lunchtime|Morning|Late-night|Weekend> session, {n} minutes, {device}.',
  '{N} minutes, {device}, no <notes|help|context> from the project page.', 'I <spent|put> {n} minutes on this, <split|divided|shared> between {spot} and {spot2}.',
  'Two passes on a {device}, {n} minutes <between them|altogether|in all>.', '{N} minutes, <most|much|the majority> of it in {spot2}.',
  '<Took|It took|Needed> {n} minutes to <get through|finish|work through> {spot}.', 'On a {device}, about {n} minutes, <at my desk|on the sofa|on the train|after work|before work>.',
  'Did {spot} twice over {n} minutes.', '{N} minutes<, mostly| and most of it> poking at {feature}.', 'Just under {n} minutes before I <stopped|called it>.',
  'I used a {device} for this, {n} minutes <start to finish|end to end>.',
]

export const FINDING = {
  negative: [
    'The main <problem|issue|snag> for me was {main}.', 'Most of what follows comes back to {main}.', '{Main} [is|are:main] where it <fell apart|came unstuck|went wrong> for me.',
    'I stalled on {main} and <never really recovered|did not quite recover>.', 'The thing I would fix first is {main}.', '{Main} cost me the most <time|patience>.',
    'Everything was fine until {main}.', 'I got stuck on {main}, and it <coloured|shaped|soured> the rest.', 'My notes mostly circle {main}.',
    'I spent most of the {unit} <fighting|working around|trying to get past> {main}.', 'I did not get far, and {main} [is|are:main] why.',
    'Honestly, {main} undid a lot of good work.', '{Main} [is|are:main] the <big one|real problem|thing to look at>.', 'It was {main} that <lost me|stopped me|did it>.',
    'I would not show this to more {audience}s until {main} [is|are:main] <fixed|sorted|dealt with>.', 'Of everything below, {main} [matters|matter:main] most.',
    '<Sadly|Honestly|Unfortunately>, {main} <got in the way|spoiled it|was a wall> for me.', '{Main} <needs|wants|deserves> a proper rethink.',
  ],
  mixed: [
    'Mostly good; {main} [is|are:main] the exception.', 'I liked more of it than I expected, but {main} [needs|need:main] <another pass|work|attention>.',
    '{Main} [is|are:main] the one thing I would change before showing <more people|anyone else|the next group>.', 'Good {unit} overall, with {main} as the weak spot.',
    'The {work} is further along than {main} suggests.', 'Two things stood out: {praise}, and {main}.', '{Praise} [is|are:praise] lovely; {main} [is|are:main] not there yet.',
    'I <enjoyed|liked> {praise}, and <struggled with|stumbled on|got stuck on> {main}.', '{Main} <aside|apart>, this <works|holds up|is good>.',
    'Better than I thought going in, apart from {main}.', 'The good parts are good, and {main} [gets|get:main] in their way.', 'I would fix {main} before anything else.',
    'Half of this <works really well|is excellent|is ready>, and {main} [is|are:main] the other half.', '{Praise} [works|work:praise]; {main} [is|are:main] where I <hesitated|slowed down|got stuck>.',
    'Somewhere between good and great, held back by {main}.', '<My biggest|The main|My one real|The first> note is {main}.',
    '{Main} [is|are:main] the <weak spot|soft spot|bit that needs work>.', 'Good in places; {main} [is|are:main] not <one of them|there yet>.',
  ],
  positive: [
    '{Praise} carried most of it for me.', 'The best thing here is {praise}.', '{Praise} [is|are:praise] the reason I kept going.',
    'Very little to complain about, and {praise} <especially|in particular> is good.', 'I came away impressed, mostly by {praise}.',
    '<My only real|The one|My single|The only> note is {main}, and it is <small|minor|easy to fix>.', 'I would change very little; {main} [is|are:main] the <one thing|exception|only snag>.',
    '{Praise} [is|are:praise] where the care shows.', 'This is in good shape, and {praise} [is|are:praise] the standout.', 'I enjoyed this, {praise} most of all.',
    'Genuinely good, with {praise} as the <highlight|high point|best part>.', 'Not much to fix, and {praise} [deserves|deserve:praise] a <mention|special mention|shout-out>.',
    '{Praise} <stood out|was the best part|made it> for me.', 'I <liked|enjoyed|rated> {praise} most.', 'Good all round; {praise} especially.',
  ],
  /** A note whose verdict is negative or mixed but whose points are observations. */
  vague: {
    negative: ['I bounced off {spot}, and the notes below are the smaller details.', 'It did not click for me, starting at {spot}.',
      'Honestly this did not land for me; {obs} is part of why.', 'Not for me, though I found it hard to say why beyond {obs}.',
      'I struggled to get into it; {obs} is the clearest example.', 'I wanted more from {spot} than I got.'],
    mixed: ['<Mixed feelings|Mixed reactions|Honestly mixed>, <mostly|largely> about {obs}.', '<Some|Most> of it works; I am less sure about {obs}.',
      'I <went back and forth|changed my mind twice|kept wavering> on {obs}.', 'Parts of {spot} <work for me|land> and parts do not.',
      '{Obs} is where I <landed|ended up|kept coming back to>.', 'Not sure what I think of {obs} yet.', 'Good in places, <unsure|undecided> about {obs}.',
      '{Spot} <mostly works|is mostly there>; {obs} I am less sure of.'],
  },
  observe: [
    '<Mostly observations|Observations more than problems|Thoughts rather than problems>, the main one about {obs}.',
    'Nothing broken as such; my notes are <mostly|largely> about {obs}.', '<A few thoughts|Some thoughts|A couple of thoughts>, starting with {obs}.',
    'No big problems; {obs} [is|are:obs] the thing I would <look at|think about|keep an eye on>.', 'Mostly small things, and {obs} [is|are:obs] the one worth a look.',
    'Nothing urgent, though {obs} <stuck with me|is worth a thought|caught my eye>.', '{Obs} [is|are:obs] the thing I <kept thinking about|noticed most|would ask others about>.',
    'I do not have much to fix, but I do have thoughts on {obs}.', 'The note I care about most is on {obs}.', 'Only small stuff, mainly {obs}.',
    'My <main|biggest|first> thought was about {obs}.', 'Nothing broke; I mostly wondered about {obs}.',
  ],
  none: [
    'Notes below, <in the order I hit them in|roughly in the order they came up in> {spot}.', 'A few specific things below, mostly about {spot}.',
    'Short notes, all from {spot} and {spot2}.', 'Everything below is from my first pass through {spot}.',
  ],
}

export const SECOND = {
  praiseAfterIssue: ['{Praise} [is|are:praise] worth protecting whatever else changes.', 'For balance: {praise} [is|are:praise] <excellent|really good|well done>.',
    'On the other hand, {praise} [is|are:praise] the best-judged thing in it.', 'I would not touch {praise}.', '{Praise} [is|are:praise] the part to build on.',
    'To be clear, {praise} [is|are:praise] <great|lovely|spot on>.', 'Keep {praise} whatever you do about the rest.', '{Praise}, though, is <very good|a real strength>.'],
  issueAfterPraise: ['The one thing I would look at is {main}.', 'If anything, {main} could use a second look.',
    'Small note on {main} below.', 'I have one real concern, and it is {main}.', 'Only {main} held me up.', '{Main} [is|are:main] the only thing I would change.'],
}

export const CLOSE = {
  positive: ['Would happily {verb} the next {next}.', 'I would recommend it as it stands.', 'Looking forward to {spot2} getting the same care.',
    'I will be back for the next {unit}.', 'Nice work on {feature}.', 'Keen to see where {spot3} [goes|go:spot3].', 'Say if you want me to go deeper on {feature}.',
    'Good luck with {spot3}.', 'Would {verb} it again on a {device}.'],
  mixed: ['Happy to look again once {main} [moves|move:main].', 'Worth another {unit} from me after the next {next}.',
    'Send it back when {spot2} [changes|change:spot2] and I will look again.', 'Close; {spot2} just needs a pass.', 'Ask me again after {spot2} [changes|change:spot2].',
    'Take the point about {main} seriously and weigh the rest.', 'I could be wrong about {main}; worth a second opinion.', 'Happy to test {spot2} again.'],
  negative: ['I would hold off on more {audience}s until {main} [is|are:main] sorted.', 'Happy to try again after a fix to {spot}.',
    'Sorry this is mostly problems; the idea deserves better than {spot}.', 'Not sure I am the right {audience} for this, so weigh it.',
    'I would try again once {spot} [changes|change:spot].', 'Hope this is useful rather than just discouraging about {spot2}.'],
}

/* --------------------------------------------------------------- replies */

/** A creator's first answer: an acknowledgement that names the thing, then (usually) what happens next. */
export const REPLY_ACK = [
  'Good catch on {main}.', 'Thanks for the detail on {main}.', 'Fair point about {main}.', '<This is|That is|Really> useful on {main}.',
  'You are not the first to mention {main}.', 'You are the {ord} person to mention {main}.', '#^I had not seen {main} on a {device}.',
  '<Appreciate you|Thanks for> getting <as far as|all the way to|through to> {spot2}.', '<Thanks|Thank you> for <sticking with|persevering with|staying with> {spot}.', 'Interesting that {spot} worked for you and {main} did not.',
  'Glad {praise} landed.', 'I disagree about {main}, but I can see how you got there.', 'Noted on {main}.', '{Main} [is|are:main] a fair hit.',
  '#I knew about {main} and hoped nobody would reach it.', 'This is the clearest note I have had about {main}.',
  '%Honestly I thought {main} [was|were:main] fine until <three|a few|several> of you said otherwise.', 'You are right about {main}; I have been avoiding it.',
  '#{Main} [was|were:main] a leftover, not a decision.', '!^I can reproduce {main} here, so thank you.', '<Thank you for|Glad you kept> going past {spot}; <most people|a lot of {audience}s> stop earlier.',
  'Ha, {main} again.', 'Oof, {main}.', 'Thanks, {main} [is|are:main] a good spot.', 'That is fair about {main}.', 'I appreciate the honesty about {main}.',
  'Glad {praise} <worked for you|came across|made sense>.', '<Really|So> pleased {praise} <landed|worked>; it took a while.',
  '{Praise} was the part I was least sure of, so thank you.', 'Thanks for <the kind words|the encouragement> about {praise}.',
  '<Thanks|Thank you> for <taking the time|the time> on {spot}.', '<Good|Useful> to hear how {spot} <reads|comes across> to someone new.',
  '^<Thanks|Cheers> for trying it on a {device}.', 'Interesting read on {spot2}, thank you.', 'I did not expect anyone to <mention|notice> {feature}.',
  'This is <helpful|really helpful|useful> for {spot}.',
]
/** What happens next. No {main}: the acknowledgement already named it. */
export const REPLY_PLAN = [
  '!I will look at it alongside {spot2} this week.', '!The fix should be in the next {next}, along with changes to {spot2}.', '!^Did it happen more than once?',
  '^Did you try {feature}, or did you not <find|notice> it?', 'How long did {spot} take you, roughly?',
  '!I tried to {alt} in {month} and it made {spot2} worse, so I need another idea.', 'I will <ping you|let you know|post here> when {spot2} [changes|change:spot2].',
  'I want to <watch|see> someone else <do|try> {spot} before I change anything.', 'Keeping {feature} for now, though.', '!The fix touches {spot2} as well, so it may take {time}.',
  'Would you <look at|try> {spot2} again <once it changes|after the next {next}|when it is updated>?', '!Half of it I can do this week; the rest depends on {feature}.',
  '!It pays off later in {spot2}, but I clearly need to signal that sooner.', '!I am going to try to {alt} next.',
  '^Could you tell me what you expected {feature} to do?', '!^Was it every {unit}, or just once?', '!Changing it on the strength of this and {k} other notes.',
  'That was <exactly|precisely> my worry about {spot2}.', '<I will note it|It goes> in the changelog when {spot} [changes|change:spot].', '!^It is fixed locally; the build with {spot2} [goes|go:spot2] up <soon|this weekend|next week>.',
  '!My plan is to {alt} and see.', '<Next|Up next> is {spot2}, so this is good timing.', 'I will <keep|hold on to> {feature} and look at {spot3} <instead|next>.',
  'Did {spot2} make sense <after that|to you|at all>?', '<Is there|Was there> anything in {spot3} that <stood out|you would change>?', '!^Do you remember what you were doing in {spot} just before?',
]
/** The reviewer, coming back. */
export const REPLY_REVIEWER = [
  'Happy to look again once {main} [changes|change:main].', '^It was a {device}, if that helps with {main}.', 'That makes sense; I had assumed {main} [was|were:main] accidental.',
  'If you change {main}, send it back and I will do the same {unit} again.', '^I tried {feature} after your reply and it helped with {spot}.',
  'For what it is worth, I would still ship before fixing {main}.', 'About {m} minutes on {spot}, maybe a little more.',
  'Understood. I will look at {spot2} in the next {next}.', 'Then my note about {main} [stands|stand:main], but it matters less than I thought.',
  'Good to know. In your place I would have made the same call on {feature}.', '!^I ran it again and got the same thing {where}.',
  'That is a better reason for {main} than I expected.', '^No, I never found {feature}. That might be the real problem.',
  'Glad it was useful. {Spot2} [is|are:spot2] the bit I would watch.', '!^Every time, on the {device}. Once on the {device2}.',
  'A change to {feature} would help, yes.', 'Sure, ping me when {spot2} [is|are:spot2] updated.', 'Makes sense now you explain {feature}.',
  '!^I was on a {device}, and it happened {where}.', '!^Once only, {where}, and I could not repeat it.', '!^I expected {feature} to <save|undo|explain> it, honestly.',
  '^Roughly {m} minutes before I hit {main}.', 'I looked at {spot} twice before I wrote that.', 'Fair, and {feature} [makes|make:feature] more sense now.',
  'Glad {spot2} [is|are:spot2] getting another look.', 'That explains {main}, thanks.', 'If {spot2} [changes|change:spot2], I will do the same {unit} again.',
]
export const REPLY_REVIEWER_EXTRA = ['Good luck with {spot2}.', 'Looking forward to {spot3}.', 'Either way, {feature} [is|are:feature] great.',
  'Happy to test {spot2} when it is ready.', 'The rest of {spot} [was|were:spot] fine for me.']

export const REPLY_CREATOR_LAST = [
  'Thanks, that narrows {main} down a lot.', 'Will do. {Spot2} [is|are:spot2] next on my list anyway.', 'Perfect, that is what I needed on {main}.',
  'I will ping you when the build with {spot2} [is|are:spot2] up.', '^That helps. {Main} only seems to happen on a {device}.', 'Noted, and thank you again for {spot}.',
  '^Makes sense. I will test {spot} on a {device} this week.', 'Good, then {feature} stays.', 'Great, {spot2} it is.',
]

/* ---------------------------------------------------------- creator text */

/** Asks that are one direct question, the way people often write them. */
export const ASK_QUESTION = [
  '[Is|Are:feature] {feature} worth keeping, or would you cut [it|them:feature]?', '[Does|Do:spot] {spot} make sense <without me explaining|cold|without the project page>?',
  'Where in {spot2} did you <slow down|hesitate|lose interest>?', '[Is|Are:spot] {spot} too long, too short, or about right?',
  '^What did you expect {feature} to do <before you tried it|the first time>?', 'Would you come back for a second {unit}<, and why| after {spot}|>?',
  '<At what point in|When during|Where in> {spot} did you <understand|get|see> what the {work} is for?', '[Is|Are:feature2] {feature2} doing anything for you?',
  'What would you change first in {spot2}?', '^Did {feature} feel <finished|deliberate|right> to you?', '<Which works better for you|Which do you prefer|Which is clearer>, {spot} or {spot2}?',
  'How long did {spot} take you<, roughly|>?', 'Is there anything in {spot} you would cut outright?', '[Does|Do:feature] {feature} read the way I think [it reads|they read:feature]?',
  'Did anything in {spot2} make you want to <stop|give up|skip ahead>?', 'By the end of {spot}, is it clear who the {work} is for?', '[Is|Are:spot3] {spot3} worth the time [it asks|they ask:spot3] for?',
  '^How did {feature2} feel on a {device}?', '[Does|Do:spot2] {spot2} need {feature}, or [is it|are they:spot2] fine without?', 'What is the weakest part of {spot}?',
  '[Does|Do:feature] {feature} <get in the way of|distract from|help or hurt> {spot2}?', 'Would you recommend it after {spot} alone?',
]
/** Tasks and probes any kind of work can take; the type's own are in types/. */
export const ASK_TASK = [
  '<Spend|Give it> {n} minutes on {spot} and nothing else.', 'Start at {spot2} instead of the beginning.', 'Go through {spot} on a {device}.',
  '^Try {feature} before anything else.', 'Give it {n} minutes, cold, no <context|notes|introduction> from me.',
  'Go straight to {spot2} and work backwards.', '^Try it on a {device} if you have one.', 'Do one {unit}, then stop.',
]
export const ASK_PROBE = [
  'Tell me the <first|one> thing you would change about {spot}.', 'Say whether {feature} [earns|earn:feature] [its|their:feature] place.', 'Name the <moment|point> in {spot2} where you <hesitated|slowed down|lost the thread>.',
  '^Tell me what you expected {feature} to do before you tried it.', 'Say where your attention <drifted|wandered|went> in {spot2}, if it did.',
  '<Tell me|Say> what you would cut from {spot2}.', 'Let me know <if|whether> {spot} [makes|make:spot] sense <without the project page|on its own|without context>.', '<I want to know|Tell me> whether {feature2} [is|are:feature2] <noise|worth keeping|worth the space>.',
  'Say whether {spot} and {spot2} feel like the same {work}.', 'Tell me what confused you<, in the order it happened| in {spot}|, if anything>.',
]
export const ASK_CODA = [
  '{N} minutes is plenty.', 'Be blunt about {spot}; I have heard the polite version.', 'One specific answer <beats|is worth more than> five general ones.',
  'First reactions <on {spot}|to {feature}> are what I want.', 'Guessing is fine; just say that you are guessing.', 'If nothing in {spot2} [stands|stand:spot2] out, say that too.',
  'Skip anything you would only say to be kind.', 'If you get stuck {where}, stop and tell me where.', 'No need to write much about {spot}.',
  'Assume I already know {spot2} [is|are:spot2] rough.', 'Say it the way you would to a friend.', 'Timestamps or screenshots of {spot} help a lot.',
  'Even one sentence about {feature} [helps|help:feature].', 'Short answers are fine.',
]

/** What a creator adds under a need, when they bother. */
export const NEED_DETAIL = {
  playtesters: ['{N} minutes is a full session; longer is welcome.', 'Controller preferred, keyboard fine for {spot}.',
    'I care most about the first {unit}, before you know anything.', 'Especially people who bounced off {spot} in other games.',
    'Anyone who has never played a {genre} is gold to me.', 'If you stream it, even better; I learn most from hearing people think through {spot}.',
    'Fresh players for {spot2} especially.', 'One {unit} is enough, but get to {spot2} if you can.', 'I want to see where {feature} clicks for people.'],
  usability: ['Watch for the pause before each step in {spot}, not the step itself.', 'The main task in {spot} [is|are:spot] the only one that matters right now.',
    'Tell me where you stalled in {spot2}, not how you would redesign it.', 'I mostly care about {spot} and {spot2}.',
    'Fresh eyes on {feature} especially.', 'I would love one session from somebody who uses a screen reader on {spot}.',
    'The path from {spot} to {spot2} [is|are:spot2] what I am testing.', 'First-time {audience}s only, if possible.'],
  copy_review: ['<Headings and error states|Headings and labels|Error states> in {spot} first; the <body copy|rest> can wait.', 'Line edits welcome on {spot2}<, rewrites even more so|; rewrites too|>.',
    'The <empty state|first screen|intro copy> on {spot} is the weakest part<| and I know it>.', 'Start with {spot}; <that copy is the oldest|it was written first|it has not been touched in months>.',
    '<I am not a native English speaker|English is my second language>, so be picky about {spot2}.', '<Tone|Voice> matters more than <grammar|typos> in {spot}.',
    '<Especially|Mostly|In particular> the wording around {feature}.', 'The copy in {spot3} [was|were:spot3] <written in a hurry|rushed|a first draft>.'],
  art_direction: ['Composition over craft in {spot}; the craft is fixable.', 'Tell me whether {spot} [holds|hold:spot] together, not whether you like it.',
    'The palette in {spot2} [is|are:spot2] the part I keep changing.', 'Especially {feature}, which I am too close to.',
    'I would like one note on {spot} from somebody who draws.', 'Is {feature} a style or a set of habits? That is my question.',
    'Does {spot3} match the rest?'],
  technical_review: ['Architecture rather than style, though I will take both.', 'The data layer behind {spot} [is|are:spot] where I am least confident.',
    'Assume {spot2} [has|have:spot2] to run for three years without me.', 'Mostly {feature}; the rest is boring on purpose.',
    'A second pair of eyes on how {spot} handles failure would help.', 'If something in {spot2} [looks|look:spot2] clever, it is probably wrong.',
    'I am least sure about {feature2}.'],
  pricing: ['I have never charged for anything like {spot} before.', 'The tiers are a guess, and {spot2} [is|are:spot2] the guess I trust least.',
    'Tell me what you would pay, not what the market pays.', 'The number I am least sure of is {currency}{price}.',
    'Is a one-off price better than a subscription here?', 'Would a free tier help or just cost me?', 'Is {currency}{price} too low for this?'],
  positioning: ['I can describe {feature} in a paragraph and not in a sentence.', 'Who it is not for is the harder half.',
    'The category is the bit I keep getting wrong in {spot}.', 'Is it a {work} for experts or for beginners? I keep changing my mind.',
    'I am competing with doing nothing, mostly.', 'The name might be the problem, or {spot} might be.', 'Does {spot} say what this is?'],
  accessibility_audit: ['Keyboard path and contrast on {spot} first.', 'I have run the automated checks on {spot2}; it is the rest I am asking about.',
    'Screen reader notes on {spot} especially welcome.', 'Especially {spot}, which has had the least testing.',
    'I would pay for an hour from someone who does this professionally.', 'Reduced motion in {spot2} [is|are:spot2] the part I have not tested.'],
  docs_review: ['The first five minutes of the README are what matter.', 'Assume the reader has never used anything like {spot}.',
    'Tell me which example should have come before {spot}.', 'The reference is generated; the guides for {spot2} are not, and they show it.',
    'Follow the quickstart exactly and tell me where it lied.', 'Especially the section on {feature}.'],
  bug_hunt: ['Repro steps are enough; no need to diagnose.', 'Edge cases in {spot} welcome; I have covered the happy path.',
    'Anything in {spot2} that looks wrong counts, even if it is not.', 'Especially on a {device}; I do not own one.',
    'I am most worried about {spot}.', 'Crash logs are in the settings if {spot2} falls over.', '{Feature} [is|are:feature] new and probably fragile.'],
}

/** Why a creator declined a suggestion. */
export const DECLINE = [
  'It would cost {spot} its simplicity.', 'I tried it in {month} and it made {spot2} worse.', 'Not before {feature} [is|are:feature] finished.',
  '{K} people asked for this and {k2} asked for the opposite.', 'Real, but it belongs in a different {work}.',
  'The support cost is higher than the build cost for {spot}.', 'Parked until after {month}.', 'I did this once for {spot2} and took it out again.',
  'Fair ask. It is behind {k} bigger things.', 'It fixes {spot} and breaks {spot2}.', 'Not now. Ask again after {month}.',
  'This would double the testing I do on {spot}.', 'I would rather make {feature} good than add this.', 'Out of scope for this version of {spot}.',
  'It clashes with how {feature} [works|work:feature].', 'Tried it with {k} people in {month}; nobody used it.', 'Too much work for {spot3} this year.',
  'I do not want to maintain two versions of {spot}.', 'Good idea, wrong {work}.', 'It would make {feature2} confusing.',
  'Only one person asked, and {spot2} [needs|need:spot2] the time more.', 'Maybe later, once {spot} settles.',
]

/** Changelog lines any project can have. The type's own are in types/. */
export const CHANGELOG = [
  'Fixed a crash in {spot2}.', '{Feature} [is|are:feature] faster.', 'Clearer wording on {spot}.', 'Reworked {spot3} after notes here.',
  'Smaller fixes across {spot} and {spot2}.', '{Feature2} [is|are:feature2] off by default now.', 'Removed a step from {spot}.',
  'New layout for {spot2}.', '{Spot} rewritten from scratch.', 'Tidied up {feature2}.', 'Fixed {k} small bugs in {spot3}.',
  '{Feature} [works|work:feature] the way the notes asked.', 'Cut {spot3} down by about a third.', 'Rebalanced {spot2}.',
]

/** Roadmap titles any project can have. */
export const SUGGESTION = [
  'Rework {spot2}', 'Explain {feature} earlier', 'Make {feature2} optional', 'Shorten {spot}', 'Fix the flow from {spot} to {spot2}',
  'Clearer copy in {spot3}', 'Revisit {feature}', 'Merge {spot2} into {spot}', 'A settings toggle for {feature2}', 'Test {spot3} on a {device}',
]

/* ----------------------------------------------------------------- bios */

export const BIO_LEAD = [
  '{Role} in {city}.', '{City}-based {role}.', '{Role}, {city}.', '{Role} living in {city}.', 'I am a {role} in {city}.',
  '{Role} by day, {role2} by night.', '{Role}.', '{Role} and occasional {role2}.', 'Mostly a {role}.', '{Role}, currently in {city}.',
  '{Role} from {city2}, now in {city}.', 'Working as a {role} in {city}.',
]

/* ------------------------------------------------------ project summaries */

/** Status sentences any kind of work can take, by stage. The type's own are in types/. */
export const STATE = {
  concept: ['<Nothing is built yet|Nothing is built>; I have notes on {spot} and {feature}.', '<This is still a plan|Still a plan>: {spot} [is|are:spot] sketched, {spot2} [is|are:spot2] not.',
    '<At the idea stage|Idea stage>, with a rough outline of {spot}.', '<No build yet|Not built yet>, just <a document|some notes|a page> describing {feature}.',
    '<Pre-production|Very early>; {spot} [exists|exist:spot] only on paper.', 'I have a <one-page plan|short plan|rough plan> and <a rough idea|some sketches> of {spot2}.',
    'Early days: {feature} [is|are:feature] the only part I am sure about.', '<Mostly sketches|Sketches only|Paper and sketches>, and a clear idea of {spot}.',
    'I have {spot} worked out and {spot2} still vague.', 'So far this is {feature} and a lot of questions.', 'Concept only; {spot3} [is|are:spot3] the part I have thought least about.',
    'Only {spot} [is|are:spot] designed; everything else is a list.'],
  prototype: ['The prototype covers {spot} and <a rough|a first pass at> {spot2}.', 'Prototype: {spot} [works|work:spot], {spot3} [does|do:spot3] not exist yet.', 'Working, roughly: {feature} and {spot}.', 'Rough prototype: {feature} [works|work:feature], {feature2} [does|do:feature2] not yet.',
    'Early build, and {spot2} [is|are:spot2] mostly grey boxes.', 'Only {spot} [is|are:spot] properly built so far.', 'A working prototype of {feature}, and not much else.',
    'Prototype stage; {spot3} [is|are:spot3] still on paper.', '{Spot} [works|work:spot] end to end; {spot2} [is|are:spot2] stubbed.'],
  beta: ['{Spot} and {spot2} are done; {spot3} [is|are:spot3] still moving.', 'Beta: {feature} [is|are:feature] new this month.',
    'Most of it is in; {feature2} [is|are:feature2] the last big piece.', 'Beta, with {k} people using it regularly.', 'Everything through {spot2} [is|are:spot2] in and roughly polished.',
    'Feature-complete apart from {feature2}.'],
  release_candidate: ['Close to done: fixing things in {spot2} before {month}.', 'Release candidate; the last change was to {feature}.',
    'Nearly finished, aiming for {month}.', 'Final stretch: {spot3} [is|are:spot3] the only open question.', 'Frozen apart from bugs in {spot}.'],
  shipped: ['Out since {month}; this round is about {spot2}.', 'Released in {month}, and {feature} [is|are:feature] the first big change since.',
    'Shipped in {month}; reworking {spot} now.', 'Live since {month}. I am working on {feature2} next.', 'Released in {month}; this is the first update.'],
}
/** How it started, for any kind of work. The type's own origins are in types/. */
export const ORIGIN = ['I started this in {year}<| after {hobby}>.', '<The first version|Version one> took a weekend; this one has taken {k} years.',
  'It <began|started> as a sketch of {spot} on the back of <an envelope|a receipt|a train ticket>.', '<I have been working on it|In progress> since {month} {year}.',
  'It started with {feature} and <grew from there|everything else followed>.', 'The idea <came to me|arrived> while {hobby}.',
  'Started in {year}, <shelved|put away|abandoned>, and <picked up|restarted> again this {month}.', '<I made|I built> the first version for myself in {year}.',
  'This is my {ord} <attempt|go at it>; the earlier ones never got past {spot}.', 'It grew out of a {month} side project about {feature}.',
  '{Feature} came first; {spot} came <a year|months> later.', 'Mostly <evenings|weekends|early mornings> since {year}.',
  'A <friend|colleague|neighbour> asked for {feature} in {year}, and here we are.', 'Two <false starts|abandoned versions> before this one.']
export const WHY = ['I would like fresh eyes on {spot} before I build more of it.', 'The part I trust least is {spot2}.',
  '{Feature} [has|have:feature] split everyone who has tried it.', 'I cannot tell whether {feature} [is|are:feature] worth the space it takes.',
  'Most people stall somewhere around {spot}, and I want to know why.', 'I am about to spend {time} on {spot2} and want a check first.',
  'I have stared at {spot} for too long to see it.', 'I am not sure {spot3} [belongs|belong:spot3] at all.', 'The notes so far are all about {feature}; I would like a wider read.',
  'I want to know if {spot} [works|work:spot] for people who are not me.', 'Before {month} I need to decide about {feature2}.']
