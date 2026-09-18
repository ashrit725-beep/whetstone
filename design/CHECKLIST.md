# The finish gate

Every item is checkable by looking at the code or a screenshot. A build that fails any line is not
finished. No exceptions, no "mostly".

## A. Slop tells — any one of these is an automatic fail

- [ ] No purple or indigo gradient anywhere. No default Tailwind indigo/violet ramp as an accent.
- [ ] No gradient text. No gradient on a button. No gradient as a section background.
- [ ] No glassmorphism. No `backdrop-filter: blur` used as decoration.
- [ ] No floating blobs, orbs, glows, or "random shapes" behind content.
- [ ] No pill buttons. `border-radius` on a button, chip, badge, input or tab is 0, 2px or 3px.
      `rounded-full` appears only on an `<img>` avatar.
- [ ] No drop shadow on a card, row, chip or button. Depth comes from the paper step and a 1px rule.
- [ ] No centred three-card feature row. No four-column footer. No "trusted by" logo strip.
- [ ] No testimonial cards, and no invented quote, name, company or metric anywhere.
- [ ] No emoji in chrome: headings, nav, buttons, chips, labels, empty states, toasts.
- [ ] No Rocket, Sparkles, Zap, Wand, Gem, Bot, or star-as-decoration icon.
- [ ] No number that counts up on load. Numbers render final on first paint.
- [ ] No scroll-triggered reveal of content. No parallax. No scroll-jacking. No marquee.
- [ ] No `transition: all` and no `transition-all`. Nothing animates for longer than 400ms.
- [ ] No em dash in any rendered string. No straight quotes. No `...`. Use `’ “ ” … –`.
- [ ] No exclamation mark in an error message or an empty state.
- [ ] No uppercase tracked-out "eyebrow pill" above a heading. Eyebrows are ruled, not filled.
- [ ] No lorem ipsum, no "Your content here", no placeholder copy of any kind.

## B. The system — every value comes from the token layer

- [ ] Zero colour literals outside `globals.css`. No `#hex`, `rgb()`, `hsl()`, `oklch()` in any
      component. Grep it: `grep -rE '#[0-9a-fA-F]{3,8}\b' src/components src/app --include='*.tsx'`
- [ ] Spacing only from the closed scale: 4 8 12 16 24 32 48 64 96 128 192. `p-[17px]` is a fail.
- [ ] Type only from the scale. A heading that sets a raw `font-size` is a fail.
- [ ] Display face (Bricolage) for chrome, headings and every numeral.
      Voice face (Newsreader, class `voice`) for anything a human wrote and nothing else.
- [ ] `tnum` on every number that sits in a column.
- [ ] Maximum one containment level. A bordered box inside a bordered box is a fail.
- [ ] The mark colour appears on at most one element per viewport and always means "this is the ask".

## C. Hierarchy — the reason the old build failed

- [ ] The page has ONE thing the eye lands on first, and it is the right thing.
- [ ] Display type on a marketing page is at least 6× the body size. A 32px hero headline is a fail.
- [ ] Whitespace is uneven and deliberate. No two adjacent sections share their vertical padding.
- [ ] No screen is more than 70% empty at 1440px, and none is unscannable.
- [ ] Every project's visual is large enough to actually look at.

## D. States — all eight, for every interactive element

- [ ] default · hover · focus-visible · active · disabled · loading · error · success
- [ ] Focus ring is 2px ink at 3px offset, never removed, never transitioned, never clipped.
- [ ] Disabled carries a visible reason. Opacity alone is a fail.
- [ ] Loading uses a skeleton whose geometry matches the loaded state box for box.
- [ ] Error names what broke and what to do about it, and is tied by `aria-describedby`.

## E. Motion — it must earn its place

- [ ] Entrances ≤240ms, exits ~⅔ of the entrance, hover/press 120ms.
- [ ] Only `opacity` and `transform` are animated. Never width, height, top, left, margin,
      padding, box-shadow, outline, filter, or background-position.
- [ ] An accordion animates `grid-template-rows: 0fr → 1fr`, never `height`.
- [ ] Every animation has a `prefers-reduced-motion: reduce` path, verified by toggling it.
- [ ] At most three distinct animation primitives per page.
- [ ] Nothing animates on scroll. Nothing loops forever.

## F. Responsive — four widths, designed not stacked

- [ ] 1440 · 1024 · 768 · 390. Each is laid out on purpose; 390 is not a squashed desktop.
- [ ] `document.scrollWidth === clientWidth` at every width. Sideways page scroll is a fail.
- [ ] Wide content (tables, code) scrolls inside its own `tabIndex={0}` region with an
      accessible name. The page itself never scrolls sideways.
- [ ] Every grid track that can hold an image has `min-width: 0`.
- [ ] No text is clipped mid-descender. No orphaned single word on a heading.

## G. Accessibility — WCAG 2.2 AA, measured

- [ ] Body text ≥4.5:1, large text and control boundaries ≥3:1, in BOTH themes, measured.
- [ ] Real semantics: `ul/li` for lists, `table` for tables, `dl` for metadata, `nav/main/aside`.
- [ ] A visible `<label>` above every field. Placeholder-as-label is a fail.
- [ ] 44×44px minimum hit area, ≥8px between adjacent targets.
- [ ] Keyboard operable end to end. Focus returns to the invoker when a dialog closes.
- [ ] `aria-current` on the selected item, `aria-live` on async results.
- [ ] Nothing is carried by colour alone: every state has a label or a glyph too.

## H. Truth — this one is not negotiable

- [ ] Every number on screen comes from the database at render time.
- [ ] No claim about usage, ratings or user counts that the data does not support.
- [ ] Where a result came from a heuristic rather than a model, the interface says so.
