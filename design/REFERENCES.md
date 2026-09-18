# Visual references — what to take, what to leave

The owner supplied six references as **inspiration only**. Cloning any one of them fails the brief.
These are my direct observations of the supplied screenshots, written down because the images are not
on disk. Each reference is assigned ONE job. Take that job from it and nothing else.

The product must read as **a premium community for people building things**, not a B2B dashboard.
**Projects are the visual focus.** A project should feel like a Product Hunt launch crossed with a
Dribbble case study: a real launch moment, presented like a piece of work worth looking at.

---

## 1. Creator Connect → COMMUNITY INFORMATION ARCHITECTURE

What I observe: a left icon-rail plus a labelled sidebar (Home, Events, Courses, Members, Message,
Save) with grouped, collapsible sections beneath it (Get Started, Course, Membership) each holding
3–4 real destinations. Top bar carries a wide centred search with a visible `⌘ + F` hint, a primary
action, a notification bell with a dot, and an avatar with a presence ring. Main column is a stories
strip, then a composer ("What's on your mind?" with attachment affordances and Draft / Post), then
the feed. A right rail carries a calendar and upcoming events.

**Take:** the IA. Grouped, labelled, collapsible navigation that names real destinations instead of
abstractions. A visible keyboard hint on search. The idea that a community has a *composer* at the
top of the feed, not just a list. Presence and activity are shown, quietly.

**Leave:** the blue-on-white card stack, the rounded-everything, the emoji in headings ("Welcome
Back, Gery 👋"), the upgrade-nag panel, the trust-badge carousel, the stock-photo testimonials.

---

## 2. CreatorOS → TYPOGRAPHY AND RESTRAINT

What I observe: the single strongest reference. A very large bold grotesk headline, roughly 96–120px,
near-black, on a warm off-white ground with the faintest peach bloom. The signature move: one word in
the headline is set in **outline only** (stroke, transparent fill) against the solid words around it.
Everything else on the page is tiny by comparison. Nav is four plain text links plus one solid black
pill. A single email field with a black button. Below the fold, a genuine product screenshot in a
plain container: black bar charts, no gradients, small grey labels, tiny green and red delta pills.

**Take:** typography carries the identity, and the scale contrast is extreme — display type is 8–10×
the body. The outline/fill word treatment as a signature device. Warm off-white ground rather than
pure white. Near-black as the primary action colour. Charts drawn in ink, not colour.

**Leave:** the emoji in the subheading, the pastel bloom gradient behind the hero, the waitlist framing.

---

## 3. Basebox → LANDING-PAGE COMPOSITION

What I observe: a small bordered eyebrow tag ("NEW · AI task management for growth") above a tight
two-line headline. Left-aligned hero copy in a narrow measure, with a *structural* visual on the right
— a sparse grid of app tiles where most cells are empty and only a few hold a logo. Two buttons: one
solid black, one bordered. A single line of tiny social proof beneath. Then centred section headings
with a one-line standfirst. Then a four-column row of small outlined icon tiles above short
stat-and-claim pairs. Then real product screenshots used as evidence, with tab-like labels above them.
Generous vertical rhythm; sections breathe.

**Take:** the composition. Eyebrow → tight headline → narrow supporting line → two clearly ranked
actions → one line of proof. A structural rather than decorative hero visual. Alternating left-aligned
and centred sections. Real product screenshots used as evidence rather than ornament. Whitespace as
the main compositional material.

**Leave:** the logo strip ("Trusted by 200,000+"), the pastel icon tiles, the three-tier pricing
grid, the testimonial cards.

---

## 4. Onehub → FEEDBACK UI STRUCTURE

What I observe: feedback presented as discrete items, each with an avatar, a name, a **source tag**
("from app store"), a timestamp, a title, a body, and a row of reaction counts. Beside it, a reply
composed by the product with an "AI response" marker. Elsewhere, a sentiment list where each row
carries a name, a one-line quote and a coloured Positive / Negative pill. A left sidebar naming the
real nouns: Feedback, Insights, Search, Roadmaps.

**Take:** the anatomy of a feedback item — who, from where, when, what, and what happened next.
Provenance shown on every item. Sentiment as a labelled token, never colour alone. A reply visibly
attached to the thing it answers. The nouns Feedback / Insights / Roadmap as first-class destinations.

**Leave:** everything visual. The purple-to-pink gradients, the glow blooms, the glassmorphism, the
gradient pill CTAs, the "Popular" ribbon on pricing. This reference contributes structure only.

---

## 5. The F Suite → MOTION AND EDITORIAL POLISH

Assigned job: restrained, editorial motion and finish. Interpret as: motion that serves reading and
navigation. Entrances under 240ms, exits shorter than entrances, a single considered transition per
view, type and rules doing the work rather than effects. No scroll-jacking, no reveal-on-scroll
choreography, no parallax.

---

## 6. Giats → PROJECT PRESENTATION

What I observe: an off-white, almost celadon ground. A two-weight headline — "Remarkable" in regular,
"Virtual Experiences" in heavy — left-aligned, with a short paragraph set far to the right on the same
baseline. Below it, the signature: a **sliced, offset image composition**. One image is cut into
panels laid on an irregular grid, some panels pushed down, with negative space left between them, so
the picture reads as a composition rather than a rectangle. Nav is a plain wordmark plus two pills.

**Take:** this is the model for how a project is presented. Large. Offset. Composed rather than
boxed. Negative space used deliberately. A two-weight headline where weight, not colour, carries
emphasis. The project page should feel authored.

**Leave:** the purple 3D spheres, the literal "Scroll Down" markers.

---

## THE BANS (owner's list, all of them binding)

Excessive gradients · glassmorphism · floating blobs · huge rounded rectangles · excessive pills ·
generic AI-generated SaaS layouts · purple or indigo gradients · the default Tailwind indigo/violet
ramp as accent · Inter as the display face · centred three-card feature rows · fake testimonials ·
logo strips · four-column footers · gradient text · emoji in chrome · drop shadows on cards ·
number counters · scroll-triggered reveals · parallax · animation over 400ms · em dashes in copy.

## WHAT SURVIVES FROM THE EXISTING PRODUCT

The **grit scale** — 120 concept, 400 prototype, 1000 beta, 3000 release candidate, 8000 shipped. It
is real, sortable data and the product's one original idea. How it looks is entirely open. That it
exists is not.

Two type faces with different jobs, one of which marks text a human wrote, so a person is visible at
a glance in a list.

WCAG 2.2 AA, measured and stated for every text-on-surface pair, in both themes.

---

# Second batch: staged product renders (composition reference only)

The owner supplied five staged marketing renders — laptops on desks, floating feedback cards,
a project page, an insights dashboard, a discover grid. **None of their pixels go into the product.**
Reasons, recorded so nobody re-litigates this:

1. They brand a different product (buildly, Nova, Echo Realms) in a blue-violet system.
2. They carry invented social proof: "50K+ creators", "200K+ pieces of feedback", "2.5M+",
   "4.8/5 from 428 reviews", and a named testimonial from "Maya Chen, Indie Founder".
   Whetstone's database holds 29 users, 24 projects and 171 reviews. Shipping those numbers would
   be a fabricated claim on a live product.
3. They use the exact patterns the owner banned: gradient text, glassmorphic floating cards, pill
   buttons, drop shadows on cards, emoji in chrome, a Rocket icon, a logo strip, testimonial cards.

**What they ARE good for, and what we take:**

- **Project page composition (the "Echo Realms" render).** Header with logo, title, tagline, tags,
  and three ranked actions. Then a large primary media element with a thumbnail strip beside it and
  a "+3" overflow. Then a row of four equal-weight panels: *What I need help with* (a checklist with
  items already ticked), *Top feedback*, *Bug reports* (with counts), *Discussion*. A creator card
  with a quote about why they built it. This IA is close to right for Whetstone's project page —
  take the arrangement, not the styling, and replace the four-panel row with something that is not
  four identical cards.
- **The "what I need help with" checklist as a first-class element.** Showing which asks are already
  answered and which are still open, on the project page itself, is a genuinely good idea. Adopt it.
- **The progress ladder** ("Feedback received → Issues identified → Changes shipped → Launch
  readiness"), shown as a short vertical checklist. This is the close-the-loop story made visible.
  Adopt the idea; render it in our own language, tied to the grit scale.
- **Feedback item anatomy repeated across all five renders**: avatar, role badge, timestamp, category
  tag, body, and a vote count. Plus a creator reply marked as the creator, and a "shipped" marker.
  Confirms the Onehub reading above.
- **Discover grid**: large cover image, bookmark affordance top-right, then name, one-line pitch, a
  row of participant avatars and a count. Good structure for our GALLERY view specifically.
- **Insights dashboard**: a plain-language summary sentence sitting above the charts ("Users love the
  concept, but onboarding needs improvement"), with the supporting numbers beneath it. Adopt that
  ordering: the sentence first, the evidence under it.

**What we deliberately do instead of staged desk photography:**
Whetstone has no photographer and no real product screenshots of other people's work. So the hero
proof is the live product rendering real seeded entries, and each project's visual is generated cover
art derived deterministically from the project, designed to look intentional at 48px and at full
width. Real numbers only, pulled from the database at render time.
