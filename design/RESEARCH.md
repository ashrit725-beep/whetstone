# Research findings (6 lenses)

## research:nextjs-craft

**Sources read:**
- https://react.dev/reference/react/useOptimistic
- https://react.dev/reference/react/useActionState
- https://nextjs.org/docs/app/api-reference/file-conventions/loading
- https://nextjs.org/docs/app/api-reference/functions/image-response
- https://nextjs.org/docs/app/api-reference/file-conventions/metadata/opengraph-image
- https://nextjs.org/docs/app/api-reference/functions/cookies
- https://nextjs.org/docs/app/api-reference/file-conventions/page
- https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- https://nextjs.org/docs/app/api-reference/functions/use-link-status
- https://nextjs.org/docs/app/api-reference/components/link
- https://nextjs.org/docs/app/api-reference/components/font
- https://nextjs.org/docs/app/api-reference/functions/after
- https://nextjs.org/docs/app/guides/forms
- https://nextjs.org/docs/app/getting-started/caching
- https://nextjs.org/docs/15/app/getting-started/partial-prerendering
- https://nextjs.org/docs/15/app/api-reference/config/next-config-js/ppr
- https://nextjs.org/docs/15/app/getting-started/updating-data
- https://nextjs.org/docs/15/app/api-reference/functions/revalidatePath
- https://nextjs.org/docs/app/api-reference/functions/revalidateTag
- https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/AGENTS.md

### Push every `await` below the Suspense boundary (pass the promise, don't resolve it)
- **What:** Never `await params` / `await searchParams` / `await cookies()` in the page or layout component body. Destructure nothing at the top; pass the un-awaited promise as a prop into a child that is wrapped in `<Suspense>`, and await it there. Next 15 made all four of these promises precisely so this is possible.
- **Why it reads expensive:** The chrome — nav, filter rail, column headers, the bevel rail, the footer — paints in the first HTML chunk on every navigation, at the same instant, every time. The page never appears to 'boot'. Only the data region moves. This is the single structural difference between an app that feels like a document and one that feels like a spinner farm, and it costs no runtime code at all.
- **How:** Discover: `export default function Page({ searchParams }: { searchParams: Promise<{ stage?: string; sort?: string; page?: string }> }) { return (<><FilterRail /><Suspense fallback={<FeedSkeleton rows={12} />}><FeedRows searchParams={searchParams} /></Suspense></>) }` — note the page function is NOT `async`. Then `async function FeedRows({ searchParams }: { searchParams: Promise<...> }) { const { stage = 'all', sort = 'grit' } = await searchParams; ... }`. Docs: "Components only opt into dynamic rendering when the value is accessed... you can forward this value to another component as a prop" (https://nextjs.org/docs/15/app/getting-started/partial-prerendering). Same for params on Project detail: `<Suspense fallback={<ThreadSkeleton/>}>{params.then(({slug}) => <Thread slug={slug} />)}</Suspense>`. Inside the async child, run independent queries with `Promise.all([getProject(slug), getFeedback(slug), getRatings(slug)])` — Vercel rule 1.5, "When async operations have no interdependencies, execute them concurrently using Promise.all()".
- **Where:** Discover feed (surface 2), Project detail (surface 3), Creator dashboard (surface 5), Community discussions (surface 8).
- **Risk:** If you await in the page body instead, the entire route including the sticky nav blocks on the slowest query, and `loading.tsx` cannot help — the loading.js docs state that when a layout reads runtime data, "Navigation blocks until the layout finishes rendering." Also: `<Suspense>` alone does not make a component dynamic; forgetting to actually move the access down leaves the boundary decorative.

### Optimistic feedback insert with `useOptimistic` + a single-roundtrip Server Action
- **What:** The composer's submit inserts the real comment row into the thread before the network returns, and Next's Server Action response carries the re-rendered RSC payload back in the same POST, so the optimistic row is replaced by the authoritative row with no second fetch and no flicker.
- **Why it reads expensive:** The 250–600ms gap between pressing Post and seeing your own words is the moment a product feels cheap. Removing it is the highest-value single interaction in a feedback product, because posting feedback IS the product. And because the swap happens in one roundtrip, there is never the tell-tale double-paint where the optimistic row disappears and reappears.
- **How:** Signature is `const [optimisticState, setOptimistic] = useOptimistic(value, reducer?)` (https://react.dev/reference/react/useOptimistic). In the thread client component: `const [optimistic, addOptimistic] = useOptimistic<Comment[], Draft>(comments, (state, draft) => [...state, { ...draft, id: draft.tempId, pending: true }])`. The form's action calls `addOptimistic(draft)` FIRST, then `await postFeedback(...)`. The setter must run inside an Action — `<form action={fn}>` supplies the transition automatically; an `onClick` path needs an explicit `startTransition`. In the action: `revalidatePath('/p/' + slug)` — Next 15 docs: "When an action is invoked, Next.js can return both the updated UI and new data in a single server roundtrip" (https://nextjs.org/docs/15/app/getting-started/updating-data). Render the pending row at the *same geometry* as a settled row and animate only opacity and a 2px lift, never height: `.thread-row[data-optimistic='true'] { animation: ws-row-in var(--dur-2) var(--ease-out) both }` with `@keyframes ws-row-in { from { opacity: 0; transform: translateY(2px) } to { opacity: 1; transform: none } }` — 180ms, the contract's declared duration for "optimistic row insert". Mark it `aria-busy="true"` until settled.
- **Where:** Feedback composer (surface 4) posting into the Project detail thread (surface 3); Community discussions replies (surface 8).
- **Risk:** Calling the setter outside a transition makes the row "briefly render then immediately revert" (React docs). Animating `height` or `max-height` on insert reflows every row below it and produces visible CLS on a 4.5rem row list. And if the action throws, React "renders with whatever `value` currently is" — so the optimistic row vanishes silently; you must surface the failure in the composer's helper slot, not just drop the row.

### Delayed-reveal pending indicators in pure CSS (`animation-delay`, no JS timers)
- **What:** Every skeleton, spinner and pending hint starts at `opacity: 0` and is revealed by a CSS animation with a delay. A fast response never shows a loading state at all, because the animation never reaches its first frame before the real content replaces it.
- **Why it reads expensive:** The flash of a skeleton that lives for 60ms is the loudest cheapness tell in a streaming app — it reads as jitter, not speed. Delaying the reveal makes fast paths look instantaneous and slow paths look deliberate, from one CSS rule with zero JS. Next's own docs recommend exactly this: "add an initial animation delay (e.g. 100ms) and start the animation as invisible (e.g. `opacity: 0`)" (https://nextjs.org/docs/app/api-reference/functions/use-link-status).
- **How:** In globals.css: `.ws-pending { opacity: 0; animation: ws-reveal var(--dur-2) var(--ease-out) 150ms forwards; }` and `@keyframes ws-reveal { to { opacity: 1 } }`. 150ms delay + 180ms reveal = 330ms total, inside the 400ms ceiling. Apply to Suspense fallback skeletons and to the composer's submit spinner. Wrap in `@media (prefers-reduced-motion: no-preference)` and give the reduced-motion branch `opacity: 1; animation: none` after the same 150ms via `transition-delay` instead. CSS cannot enforce the contract's "minimum 300ms visible" on the way out, so for the one indicator whose lifetime you own — the composer submit button while `pending` is true — add a 14-line floor hook: record `performance.now()` when pending flips true, and keep `showSpinner` true until `Math.max(0, 300 - elapsed)` ms have passed.
- **Where:** Every Suspense fallback: Discover feed rows, Creator dashboard panes, Project detail thread. The composer submit button. Any `useLinkStatus` hint.
- **Risk:** `animation-fill-mode` must be `forwards` (or `both`) or the element snaps back to `opacity: 0` at animation end. Do not use `visibility: hidden` on a skeleton that is reserving space — use `opacity: 0`, or the box collapses and you reintroduce the CLS you were preventing.

### `useActionState` with a discriminated-union state that lands in the permanently reserved helper slot
- **What:** The Server Action returns a typed result object (`{ status: 'idle' | 'invalid' | 'error' | 'ok'; fieldErrors?; message? }`) rather than throwing, and the component renders that into the helper slot that §5.5 already reserves at `min-height: 1lh` — so an appearing error changes glyphs, not geometry.
- **Why it reads expensive:** Validation errors in most apps push the submit button 22px down the page. Reserving the slot and swapping the text inside it means the form never moves. Combined with the tuple's built-in `pending`, the whole submit lifecycle is three states in one hook with no local `useState`, which is why it stays correct after a year of edits.
- **How:** Signature: `const [state, dispatchAction, isPending] = useActionState(reducerAction, initialState, permalink?)` (https://react.dev/reference/react/useActionState). The action signature gains a first argument: `export async function postFeedback(prevState: State, formData: FormData): Promise<State>`. Validate with `schema.safeParse(...)` and return `{ status: 'invalid', fieldErrors: parsed.error.flatten().fieldErrors }` (https://nextjs.org/docs/app/guides/forms). In the field: `aria-invalid={!!err} aria-describedby="note-fun"` and `<p id="note-fun" className="helper" aria-live="polite">{err ?? helperText}</p>` where `.helper { min-height: 1lh }`. Disable submit with `disabled={isPending}` only — never at idle. React 19 gives `pending` as the third tuple element, so `useFormStatus` is only needed when the button is a separate component that cannot see the tuple. Note the caveats: `initialState` must be serializable, and "If `dispatchAction` throws an error, React cancels all queued actions and shows the nearest Error Boundary" — which is why you return failures instead of throwing them.
- **Where:** Feedback composer (surface 4), Auth (surface 9), the dashboard's suggestion-status changes (surface 5).
- **Risk:** Throwing inside the action for an expected validation failure blows the whole route to the error boundary and loses everything the user typed. Also, without `aria-live` on the helper node a screen-reader user gets no announcement, and without `min-height: 1lh` the layout jumps on first error — both are contract violations, not just polish.

### `next/font/local` with `declarations` to keep the `wdth` axis while getting an automatic metric-matched fallback
- **What:** Replace the hand-written `@font-face` blocks plus hand-tuned "Archivo Fallback"/"Literata Fallback" faces in globals.css with `next/font/local`, using the `declarations` escape hatch to preserve `font-stretch: 62% 125%` so the width-axis headline device still works.
- **Why it reads expensive:** The width axis is this design's headline move: `h1` sits at `wdth 112`. A fallback face at normal width is dramatically narrower, so the font swap reflows the largest type on the page — the most visible CLS a user can experience. next/font generates a metric-matched fallback `@font-face` (via `ascent-override`/`size-adjust`) automatically and emits the correct preload link, replacing two manual `<link rel=preload>` tags in layout.tsx and two hand-maintained fallback faces.
- **How:** `src/app/fonts.ts`: `import localFont from 'next/font/local'; export const archivo = localFont({ src: './fonts/archivo-var.woff2', variable: '--font-ui', display: 'swap', weight: '100 900', declarations: [{ prop: 'font-stretch', value: '62% 125%' }], adjustFontFallback: 'Arial', fallback: ['Helvetica Neue','Arial','sans-serif'] }); export const literata = localFont({ src: './fonts/literata-var.woff2', variable: '--font-prose', display: 'swap', weight: '200 900', adjustFontFallback: 'Times New Roman', fallback: ['Georgia','Times New Roman','serif'] })`. Then `<html className={`${archivo.variable} ${literata.variable}`}>` and delete the two `<link rel="preload">` tags — preload is on by default. Docs for `declarations`: "An array of font face descriptor key-value pairs that define the generated @font-face further"; `adjustFontFallback` for `next/font/local` is `'Arial' | 'Times New Roman' | false`, default `'Arial'` (https://nextjs.org/docs/app/api-reference/components/font). `src` is resolved relative to the file that calls the loader, so move the woff2 files out of `public/` into `src/app/fonts/`.
- **Where:** Root layout; every surface, but most visibly the Landing hero (surface 1) and every `h1`/`h2` in the app chrome.
- **Risk:** The generated fallback is metric-matched at the default width (100), not at 112, so a residual shift remains on `h1` during the swap window — smaller than today's, not zero. Omitting `declarations` silently drops `font-stretch` from the generated `@font-face`, at which point `font-variation-settings: "wdth" 112` clamps and the headline device disappears without an error. If you keep the hand-rolled faces instead, that is a legitimate choice — record it as a deviation, as globals.css line 12 already does.

### `React.cache` around the project loader, shared by `generateMetadata` and the page
- **What:** Wrap the per-request data loaders in `cache()` from React so `generateMetadata` and the page component that both need the same project hit the database once.
- **Why it reads expensive:** It halves the request count on the most-linked surface in the product, and it removes the class of bug where the `<title>` and the `<h1>` disagree because two queries ran a moment apart. It also matters for perceived speed on shares: for scraping bots, "Next.js resolves `generateMetadata` before streaming UI, and metadata is placed in the `<head>` of the initial HTML" (https://nextjs.org/docs/app/api-reference/file-conventions/loading) — so that query is on the critical path twice unless deduped.
- **How:** `src/server/projects.ts`: `import { cache } from 'react'; export const getProject = cache(async (slug: string) => db.project(slug))`. Then in `app/p/[slug]/page.tsx`: `export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const { slug } = await params; const p = await getProject(slug); if (!p) return { title: 'Project not found' }; return { title: p.title, description: p.ask.slice(0, 155), openGraph: { title: p.title, description: p.ask.slice(0, 155), type: 'article' } } }`. The page body calls `getProject(slug)` again and gets the memoized promise. Vercel rule 3.9: "Use React.cache() for server-side request deduplication. Authentication and database queries benefit most" (https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/AGENTS.md) — so wrap the session loader too.
- **Where:** Project detail (surface 3), Public creator profile (surface 6), Reviewer profile (surface 7).
- **Risk:** `cache()` is per-request only; it is not a persistent cache and does not survive across requests — do not reach for it to fix a slow query. It also only dedupes when called with identical arguments, so normalize the slug before the call, not inside it.

### Per-project OG image drawing the real grit hatch via `opengraph-image.tsx`
- **What:** A code-generated 1200×630 OG card per project that renders the project title in Archivo at its real width axis, the ask in Literata, and the actual grit hatch at that project's stroke-width/spacing — on `#141D20` with the accent and straw exactly as the app uses them.
- **Why it reads expensive:** It is the only surface most people see before they ever visit the site, and a generic card is an instant downgrade. Rendering the same hatch primitive the product uses makes a shared link legible as data (this project is at grit 1000) rather than decoration. Statically optimized by default, so it costs nothing at request time.
- **How:** `app/p/[slug]/opengraph-image.tsx`: `export const alt = 'Whetstone project'; export const size = { width: 1200, height: 630 }; export const contentType = 'image/png'`. Read the font once at module scope — "The font doesn't depend on request data, so read it once at module scope": `const archivoData = await readFile(join(process.cwd(), 'src/app/fonts/archivo.ttf'))` (ttf/otf preferred over woff; only those three formats are supported). Then `export default async function Image({ params }) { const { slug } = await params; ... return new ImageResponse(<div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', background:'#141D20', padding:64 }}>…</div>, { ...size, fonts: [{ name:'Archivo', data: archivoData, style:'normal', weight: 400 }] }) }`. Draw the hatch as N absolutely-positioned 1px `<div>`s (Satori has no `<pattern>` support and partial repeating-gradient support); cap N at ~140 strokes across the card and scale spacing proportionally so grit 8000 stays renderable. Constraints from the docs: "Only flexbox and a subset of CSS properties are supported. Advanced layouts (e.g. `display: grid`) will not work" and "Maximum bundle size of 500KB" including the fonts (https://nextjs.org/docs/app/api-reference/functions/image-response). Subset the ttf to Latin before committing it.
- **Where:** Project detail (surface 3); a second one at `app/u/[handle]/opengraph-image.tsx` for the creator profile's 5-cell grit history strip (surface 6).
- **Risk:** Version-sensitive: `params` is a plain object in Next 15 and became a Promise in v16.0.0 — writing `const { slug } = await params` is correct in both (awaiting a non-promise is a no-op), while destructuring directly breaks on upgrade. A full-size unsubsetted variable font will blow the 500KB bundle cap and fail the build. `display: grid` silently produces a blank or mangled card rather than erroring.

### Filter changes as `useTransition` + `router.replace(..., { scroll: false })`
- **What:** Discover's filter chips and sort control write to the URL with `replace`, inside a transition, with scroll restoration disabled — so toggling a filter never scrolls the feed to the top and never pushes twenty history entries.
- **Why it reads expensive:** This is the daily-use test. A feed that jumps to the top every time you change a filter, or that takes fifteen back-presses to escape, is the thing that makes a user stop using a product in month three. The transition also keeps the previous results on screen and interactive while the new ones stream, instead of blanking the list.
- **How:** `'use client'` filter bar: `const [isPending, startTransition] = useTransition(); const router = useRouter(); const pathname = usePathname(); const sp = useSearchParams();` then `function setFilter(key: string, value: string | null) { const next = new URLSearchParams(sp); value === null ? next.delete(key) : next.set(key, value); next.delete('page'); startTransition(() => router.replace(`${pathname}?${next}`, { scroll: false })) }`. `scroll: false` is documented on both `<Link>` and `router.push/replace` (https://nextjs.org/docs/app/api-reference/components/link). While `isPending`, set `aria-busy="true"` on the `<ul>` and reveal a 2px `var(--color-accent)` rule under the sticky filter bar using the delayed-reveal rule above — do NOT dim the list: stale-but-readable beats faded, and the contract already treats opacity-only signalling as a defect. Pair with `html { scroll-padding-top: calc(var(--nav-h) + 1rem) }` so hash navigation clears the sticky nav, which the Link docs call out explicitly.
- **Where:** Discover feed filter rail (surface 2); the dashboard inbox's table sort (surface 5); discussion tab switches (surface 8).
- **Risk:** `push` instead of `replace` makes the back button useless. Forgetting `next.delete('page')` leaves the user on page 7 of a filter that has 2 pages and shows an empty state that looks like a bug. And because `searchParams` opts the route into dynamic rendering, this only feels fast if technique #1 is already in place.

### `useLinkStatus` press feedback on Discover rows for the uncached case
- **What:** A fixed-size hint inside each feed row's `<Link>` that appears only when navigation is actually blocked — the case where the project route is dynamic and its prefetch has not completed.
- **Why it reads expensive:** Clicking a row and getting nothing for 400ms is the moment a list feels dead. This gives the row an acknowledgement without a global top-of-page progress bar, which is both a visual cliché and, at the nav's z-index, a layout problem.
- **How:** Introduced in v15.3.0, so available on 15.5.4. `'use client'; import { useLinkStatus } from 'next/link'; export function RowHint() { const { pending } = useLinkStatus(); return <span aria-hidden className={`row-hint ${pending ? 'is-pending' : ''}`} /> }` rendered as a descendant of the row's `<Link>` (https://nextjs.org/docs/app/api-reference/functions/use-link-status). Style it as a 2px `var(--color-accent)` rule on the row's leading edge, always present in the DOM at `opacity: 0` with reserved width, revealed via the delayed-reveal animation at 120ms. The docs are explicit about the failure mode: "Inline indicators can easily introduce layout shifts. Prefer a fixed-size, always-rendered hint element and toggle its opacity." Use it as a patch, not a default — "If the linked route has been prefetched, the pending state will be skipped."
- **Where:** Discover feed rows (surface 2), Community discussion rows (surface 8), the dashboard inbox table rows (surface 5).
- **Risk:** It returns `{ pending: false }` forever if the component is not a descendant of a `<Link>`, so it fails silently. It is also mostly a no-op on prefetched static routes — if you find yourself needing it everywhere, the real fix is a `loading.tsx` or prefetching, not more hints. Do not use straw for this: straw is money and focus only.

### ⌘/Ctrl+Enter submit in the composer via `requestSubmit()`
- **What:** The Literata textarea listens for the platform modifier plus Enter and calls `e.currentTarget.form?.requestSubmit()`, which runs the same Server Action path as the button — including validation and `useActionState`.
- **Why it reads expensive:** Anyone writing structured feedback across five category tabs will hit this shortcut within a day. It is four lines of code and it is the difference between a form and a tool. `requestSubmit()` (unlike `form.submit()`) fires the submit event and respects constraint validation, so nothing is bypassed.
- **How:** Exact pattern from the Next docs (https://nextjs.org/docs/app/guides/forms): `const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => { if ((e.ctrlKey || e.metaKey) && (e.key === 'Enter' || e.key === 'NumpadEnter')) { e.preventDefault(); e.currentTarget.form?.requestSubmit() } }`. Surface it in the sticky footer with the existing `kbd.tsx` primitive — `<Kbd>⌘</Kbd><Kbd>↵</Kbd> Post` — rendered as static text, not a tooltip, so it is discoverable without hover (and therefore on touch). Keep the real `<button type="submit">` as the primary path.
- **Where:** Feedback composer (surface 4), Community discussion reply box (surface 8).
- **Risk:** Checking only `metaKey` breaks on Windows and Linux; checking only `e.key === 'Enter'` misses the numeric keypad. Omitting `e.preventDefault()` inserts a newline and then submits. Never make the shortcut the only way to submit — that fails keyboard-operability and the composer's no-JS requirement.

### `after()` for post-mutation telemetry so the composer returns at network speed
- **What:** Analytics writes, notification fan-out, and 'creator has unread feedback' bookkeeping run in `after()` rather than inline in the Server Action, so the action's response — and therefore the optimistic-row settle — is not gated on them.
- **Why it reads expensive:** A 40ms analytics insert inside the action is 40ms of visible latency on the product's core interaction, every time. Moving it out is free perceived speed with no behavioural change. Stable since v15.1.0, no experimental flag.
- **How:** `import { after } from 'next/server'` — "`after` allows you to schedule work to be executed after a response (or prerender) is finished" (https://nextjs.org/docs/app/api-reference/functions/after). In the action: `after(async () => { const ua = (await headers()).get('user-agent') ?? 'unknown'; await logFeedbackPosted({ projectId, reviewerId, ua }) })`, placed before `revalidatePath('/p/' + slug)` and the return. In Server Actions and Route Handlers you may call `cookies()`/`headers()` *inside* the callback; in Server Components you may not — read them first and close over the values, or it throws a runtime error. `after` is not a request-time API, so it does not make a static route dynamic.
- **Where:** `postFeedback`, `updateSuggestionStatus`, `setGrit` — every Server Action behind the composer (surface 4) and the dashboard (surface 5).
- **Risk:** `after` "will run for the platform's default or configured max duration of your route" — it is not a queue, and long work still burns the invocation. It also runs even when the request errored or redirected, so the callback must tolerate a failed mutation. Do not put anything the user's next render depends on inside it.

### Keep runtime data out of the root layout; read the theme cookie in the boot script instead
- **What:** Deliberately do NOT move the theme resolution from the inline pre-paint script into `await cookies()` in the root layout, even though the async API makes it tempting. Runtime data in a layout is the one thing that defeats every instant-navigation mechanism in the framework.
- **Why it reads expensive:** This is a negative technique and it is worth more than most positive ones. Reading a cookie in the root layout converts every route in the product to dynamic rendering and, per the loading.js docs, "If the layout accesses uncached or runtime data (e.g. `cookies()`, `headers()`, or uncached fetches), `loading.js` will not show a fallback for it... Navigation blocks until the layout finishes rendering." One convenient line at the top of layout.tsx would silently make every navigation in Whetstone feel slower, with no error and no failing test.
- **How:** Keep the existing `THEME_BOOT` script as the first child of `<head>`, before the stylesheet link, so `data-theme` is stamped before the first style recalculation. Guidance from the docs: "To ensure instant navigation, move uncached data fetching from `layout.js` into `page.js`, or wrap the runtime data access in your layout in its own `<Suspense>` boundary" (https://nextjs.org/docs/app/api-reference/file-conventions/loading). Where the app nav genuinely needs the session (avatar, unread count), do not await it in the layout — render `<Suspense fallback={<AvatarSkeleton />}><SessionChip /></Suspense>` and read `await cookies()` inside `SessionChip`. Keep the deviation recorded in `/design/direction.md` alongside the existing font-loading note.
- **Where:** Root layout, app nav, theme toggle — cross-surface.
- **Risk:** The inline script is 180 bytes of blocking JS and must stay that small; anything more and you have traded a flash for a delay. It also must be resilient — the current try/catch around `document.cookie` is correct, since a browser with site data blocked would otherwise throw before the stylesheet parses and leave the page unstyled.

### Build PPR-shaped, but do not enable PPR on 15.5.4
- **What:** Adopt the exact component structure Partial Prerendering requires — static shell, Suspense-wrapped dynamic holes, awaits pushed down — while leaving `experimental.ppr` out of next.config.ts.
- **Why it reads expensive:** You get most of the perceived benefit today from ordinary streaming, and the route becomes a one-line change when PPR is no longer canary. The structure is the value; the flag is a deployment risk. Being explicit about this prevents a plausible-looking config change that breaks the build.
- **How:** The Next 15 doc is unambiguous: "This feature is currently experimental and subject to change, it's not recommended for production" and the config reference adds "This feature is currently available in the canary channel" (https://nextjs.org/docs/15/app/getting-started/partial-prerendering, https://nextjs.org/docs/15/app/api-reference/config/next-config-js/ppr). On the stable 15.5.4 in package.json, `experimental: { ppr: 'incremental' }` is not supported. When you do move: add that flag, then `export const experimental_ppr = true` at the top segment of a route — "`experimental_ppr` will apply to all children of the route segment... You don't have to add it to every file, only the top segment of a route." Under PPR the dynamic APIs throw a build error rather than silently opting the route out, which is precisely why doing the Suspense work first pays: `cookies`, `headers`, `connection`, `draftMode`, `searchParams`, `unstable_noStore`, and `fetch` with `{ cache: 'no-store' }` are the listed triggers.
- **Where:** Landing (surface 1) and Discover (surface 2) are the two routes with a large genuinely-static shell and would be the first opt-ins.
- **Risk:** Enabling it on a stable release fails the build; enabling it on canary and then shipping ties the product to a moving target for a first-load gain most users will not perceive. Note also that Next 16 replaces this model with Cache Components / `use cache` — so anything you write against `experimental_ppr` today is throwaway, while the Suspense structure carries forward unchanged.

### Deep-import the icon set instead of the barrel, and fix the `optimizePackageImports` mismatch
- **What:** The contract mandates Phosphor Regular at 1.5px stroke, but next.config.ts optimizes `lucide-react` and package.json ships `lucide-react` with no Phosphor dependency. Whichever library actually ships, its barrel file must not be imported unoptimized.
- **Why it reads expensive:** Barrel imports are invisible in the UI and brutal in the numbers — Vercel's rule 2.1 measures "up to 10,000 re-exports" in an icon entry file and a "200-800ms" import cost on cold starts (https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/AGENTS.md). On a product whose whole premise is that the feed appears instantly, this is the largest single number you can delete without touching a pixel.
- **How:** Either add the real package to the existing config — `experimental: { optimizePackageImports: ['@phosphor-icons/react'] }` — or bypass the barrel entirely with deep paths: `import { WarningCircle } from '@phosphor-icons/react/dist/ssr/WarningCircle'`. The `/dist/ssr` entry matters: the default Phosphor export is a client component and will pull `'use client'` into server-rendered rows. Given the contract's §5.6 rule that "No icon ships without a one-line relevance note in `/design/direction.md`", the icon set is small and closed — a hand-written `src/components/ui/icons.tsx` re-exporting the ~15 icons actually used via deep paths is defensible and makes the audit trivial. Pair with Vercel rule 2.4 (`next/dynamic` for heavy components) for the drag-and-drop suggestion tracker, which no other surface needs.
- **Where:** Cross-surface; heaviest impact on Discover (surface 2) and the Creator dashboard (surface 5), which render the most icon instances per page.
- **Risk:** `optimizePackageImports` names must match the installed package exactly, or the entry is a silent no-op — which is the current state if Phosphor is the intended library. Deep paths are not covered by semver in most icon packages and can break on a minor bump, so pin the version. And resolve the mismatch before shipping: right now the config optimizes a library the contract bans.


---

## research:forms-and-composer

**Sources read:**
- https://www.w3.org/WAI/WCAG22/Understanding/redundant-entry.html
- https://www.w3.org/WAI/WCAG22/Understanding/accessible-authentication-minimum.html
- https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html
- https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
- https://design-system.service.gov.uk/components/error-summary/
- https://design-system.service.gov.uk/components/error-message/
- https://design-system.service.gov.uk/components/character-count/
- https://design-system.service.gov.uk/patterns/check-answers/
- https://raw.githubusercontent.com/alphagov/govuk-frontend/main/packages/govuk-frontend/src/govuk/components/character-count/character-count.mjs
- https://adamsilver.io/blog/live-validation-is-problematic/
- https://www.w3.org/WAI/tutorials/forms/notifications/
- https://www.w3.org/WAI/ARIA/apg/patterns/tabs/
- https://react.dev/reference/react/useActionState
- https://developer.mozilla.org/en-US/docs/Web/CSS/field-sizing
- https://developer.mozilla.org/en-US/docs/Web/CSS/:user-invalid
- https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog
- https://developer.mozilla.org/en-US/docs/Web/API/Window/beforeunload_event
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLFormElement/requestSubmit
- https://linear.app/docs/creating-issues
- https://primer.style/product/internal-components/markdown-editor/

### Validate on submit, answer with one focusable error summary
- **What:** No per-keystroke and no on-blur validation. Constraint checks run once, when the reviewer presses Post feedback. The server action returns a field-keyed error map; the client renders a single summary block at the top of the dialog body listing every problem as a link to its field, and moves focus to that block. Field-level messages are duplicates of the summary lines, sitting in each field's reserved slot.
- **Why it reads expensive:** Live validation is the single loudest tell of an amateur form: the page judders between valid and invalid, errors fire before the answer is finished, and screen reader users hear an error on every tab stop. A form that stays completely quiet while you write, then tells you everything at once in one place, reads as software written by someone who has watched people use a form. Adam Silver lists nine distinct failures of live validation, including page juddering and blur firing when a password manager opens. GOV.UK's rule is blunt: always show an error summary when there is a validation error, even if there is only one.
- **How:** Server action returns `{ values, errors: Record<FieldKey, string>, submittedAt: number }` from `useActionState(action, initial)` (React 19 signature `const [state, formAction, isPending] = useActionState(fn, initialState, permalink?)`, the action receiving `(previousState, formData)`). Summary markup: `<div ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="composer-problem-title">` containing `<h2 id="composer-problem-title">` with the literal string `2 problems with this feedback` (no exclamation mark, no apology), then a `<ul>` of `<a href="#body-balance">`. Focus it in an effect keyed on `state.submittedAt` so a second failing submit re-announces: `useEffect(() => { if (state.submittedAt) summaryRef.current?.focus(); }, [state.submittedAt])`. Each invalid control gets `aria-invalid="true"` and `aria-describedby="<fieldId>-msg"`; the message node opens with `<span class="sr-only">Error: </span>` per the GOV.UK error message component. Styling: `border-color: var(--color-critical)` at the same 1px width as rest (contract §5.2), Phosphor `WarningCircle` at 16px in the reserved inline slot, `transition: border-color var(--dur-1) var(--ease-out)`. Summary container is `background: var(--color-surface-2); color: var(--color-text-1); border-inline-start: 2px solid var(--color-critical); border-radius: var(--radius-md); padding: var(--space-md);` and gets `outline: 2px solid var(--color-focus); outline-offset: 2px` on `:focus-visible` with zero transition.
- **Where:** Surface 4 (feedback composer) primarily; surface 9 (auth) and surface 7 (marketplace bounty request) reuse the identical block.
- **Risk:** Three ways to get it wrong. (a) Using `role="alert"` on a node that is in the DOM at rest and merely emptied: it will not announce, and worse, it can double-announce alongside the focus move. Render the summary conditionally so it is inserted on failure. (b) Putting the summary inside the scrolling dialog body but forgetting `scroll-margin-block: 5rem` (contract §4.4) so the sticky composer footer covers it after the focus scroll. (c) Making the summary the only error signal: the contract's rule 8 means each field still needs its own labelled message plus the glyph, since hue never carries meaning alone.

### Message slot as a fixed grid row, not a conditional child
- **What:** Every field group is a CSS grid with a permanently reserved message row. Helper text and error text occupy the same grid cell; the error replaces the helper rather than stacking below it. A right-edge slot of fixed inline size is reserved for the validation glyph or the password toggle so the input's text never reflows when an icon appears.
- **Why it reads expensive:** Zero layout shift at the moment of failure is what separates a form that feels engineered from one that feels assembled. When an error appears and nothing below it moves, the reviewer's eye stays where it was and the correction is instant. It costs about eight lines of CSS and it is the highest quality-per-byte move on the whole surface. GOV.UK's guidance that the count message sits below the textarea specifically so it stays separate from hint and error text is the same instinct expressed as a rule.
- **How:** ```css
.field {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-areas: "label" "control" "msg";
  row-gap: var(--space-2xs);
}
.field > label { grid-area: label; }
.field > .control-wrap { grid-area: control; position: relative; }
.field > .msg {
  grid-area: msg;
  min-block-size: 1lh;
  font-size: var(--text-xs);
  color: var(--color-text-3);
  max-inline-size: 58ch;
}
.field[data-state="error"] > .msg { color: var(--color-critical); }
.control-wrap { padding-inline-end: calc(var(--space-lg) + var(--space-xs)); }
.control-wrap > .adornment {
  position: absolute; inset-block: 0; inset-inline-end: var(--space-xs);
  inline-size: var(--space-lg); display: grid; place-items: center;
}
```
One `.msg` node always exists; React swaps its text content and the `data-state` attribute, so `aria-describedby` points at a stable id that never appears or disappears. Combine with `input { outline: 2px solid transparent; outline-offset: 1px; }` at rest (contract §5.4) so the focus ring also costs zero geometry.
- **Where:** All nine surfaces. Composer textareas, auth email and password, the marketplace bounty amount, the Discover filter drawer's numeric inputs.
- **Risk:** `1lh` is the line box of the message's own font size, so if the message inherits a different size than you reserved against, a two-line error still pushes. Cap error copy at one line at 58ch in the string-writing pass, or reserve `min-block-size: 2lh` for fields whose errors are known to run long and accept the constant extra 17px. Also: `min-block-size: 1lh` on an empty div is invisible but the contract's ban 47 forbids a helper slot that collapses, so never `display: none` it.

### field-sizing: content for every Literata textarea
- **What:** Replace JavaScript autosize with one CSS declaration. The composer textarea starts at the contract's 6rem minimum, grows line by line as the reviewer writes, and stops at a max that keeps the sticky footer on screen inside the 40rem dialog.
- **Why it reads expensive:** Hand-rolled autosize (measure a mirror div, set style.height on every input event) is janky at exactly the moment it matters: fast typing, paste of a long block, deleting back. The native version resizes in layout, in the same frame, with no scrollbar flash and no resize observer. It also removes a chunk of client JS from a surface that the contract requires to work without JavaScript at all.
- **How:** ```css
.composer-textarea {
  field-sizing: content;
  min-block-size: 6rem;
  max-block-size: 22rem;
  max-inline-size: 66ch;
  resize: vertical;
  font-family: var(--font-prose);
  font-size: var(--text-prose);
  line-height: 1.65;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-border-control);
  background: var(--color-surface-0);
  color: var(--color-text-1);
}
```
`field-sizing` reached Baseline in June 2026 (Chrome/Edge 123+, Firefox 152). Note from the spec that `rows` and `cols` are ignored once `field-sizing: content` is set, so the floor must come from `min-block-size`, and that fixed `block-size`/`height` overrides content sizing, so do not also set a height. Its animation type is discrete, so it cannot accidentally produce a transition and cannot violate the 400ms ceiling or the ban on animating height. Older engines simply fall back to the fixed 6rem box with a scrollbar, which is the current behaviour, so no polyfill is needed.
- **Where:** Surface 4 composer (five category textareas), surface 8 discussion reply box, surface 3 project-detail inline reply.
- **Risk:** Two. (a) Growth past `max-block-size` inside a `<dialog>` capped at `max-height: min(80vh, 40rem)` will fight the dialog's own scroll if the max is set too high; pick a max that leaves the sticky footer plus one field visible at 1280x800 and verify at 375px. (b) MDN notes controls with a `placeholder` render large enough to show the placeholder. The contract bans placeholder-as-label outright, so as long as that ban holds there is no sizing surprise. Do not reintroduce a placeholder to 'hint' at length.

### Cmd/Ctrl+Enter submit via requestSubmit(), shown as a real <kbd>
- **What:** The composer submits from the keyboard without leaving the textarea, through `form.requestSubmit(submitButton)` rather than `form.submit()`, and the shortcut is rendered in the sticky footer beside the button rather than hidden in a help page.
- **Why it reads expensive:** This is the single detail that separates a composer people use daily from one they endure. GitHub's internal MarkdownEditor wires Ctrl/Cmd+Enter to the primary action; Linear's whole input model is keyboard-first. More importantly, `requestSubmit()` runs constraint validation and fires the `submit` event, so the keyboard path and the mouse path go through exactly the same code, exactly the same error summary, exactly the same server action. `submit()` does neither, which is how keyboard submit quietly bypasses validation in most codebases.
- **How:** ```tsx
function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    e.currentTarget.form?.requestSubmit(submitRef.current);
  }
}
```
`requestSubmit()` is Baseline widely available since September 2022; it throws `TypeError` if the passed submitter is not a submit button, so keep the ref on the actual `<button type="submit">`. Render the affordance as `<kbd>` (the contract's only non-code home for JetBrains Mono, §3.1) at `--text-2xs`, `color: var(--color-text-3)`, `border: 1px solid var(--color-border-hair)`, `border-radius: var(--radius-xs)`, `padding: var(--space-3xs) var(--space-2xs)`, placed to the inline-start of the Post feedback button with `--space-sm` gap. Detect the platform once at mount to print the correct glyph rather than shipping both.
- **Where:** Surface 4 composer footer; surface 8 discussion reply; surface 5 dashboard inbox quick reply.
- **Risk:** Announcing a shortcut you did not actually bind is worse than not announcing it. Also, if the sticky footer's button sits outside the `<form>` element (a common consequence of the fixed-footer layout), `form?.requestSubmit(submitRef.current)` throws `NotFoundError` because the submitter is not a member of the form. Fix with the `form="composer-form"` attribute on the button, which makes it a member without moving it in the DOM. The `<kbd>` must not become a target: it is 2xs text and would fail SC 2.5.8 if made clickable.

### Never clear a field on failure, and prefill anything already known (SC 3.3.7)
- **What:** A failed submit re-renders with every value the reviewer typed still in place, via `defaultValue` from the returned action state. Separately, anything the product already knows is pre-populated or offered as a selection rather than retyped: the category the reviewer filtered Discover by, the grit stage they were browsing, the email carried from the sign-up attempt into the sign-in form.
- **Why it reads expensive:** Retyping a paragraph of feedback because a category checkbox was missing is the moment a reviewer stops reviewing. SC 3.3.7 requires that information previously entered in the same process be auto-populated or available for selection, with only three exceptions (re-entry is essential, security requires it, or the earlier data is no longer valid). GOV.UK states it as a flat instruction: do not clear any form fields when showing the error message component. The WCAG understanding page explicitly names retaining credit card numbers when errors occur as the passing case.
- **How:** React 19 pattern from the `useActionState` docs: return the submitted values alongside the errors and bind them with `defaultValue`, never `value`, so the inputs stay uncontrolled and survive a no-JS native round trip identically. `<textarea name="balance" defaultValue={state.values.balance} aria-invalid={!!state.errors.balance || undefined} />`. For cross-step prefill, read the Discover filter state from `searchParams` in the Server Component that renders the composer trigger and pass it as the dialog's initial props. Where auto-population is not appropriate (the WCAG page allows selection instead), offer an explicit control: a `<button type="button">Use the categories the creator asked for</button>` that populates the checkbox group, styled as a secondary button at the 44px base height. Note that a process does not span closed sessions, so a returning reviewer is not owed a prefill by this SC, which is what the draft technique below is for.
- **Where:** Surfaces 4, 7, 9. The auth pair (sign-up failure to sign-in) is the clearest SC 3.3.7 win and takes one search param.
- **Risk:** Prefilling the wrong thing is worse than prefilling nothing: if the Discover filter said 'Controls' but the creator's ask is about onboarding, a pre-ticked Controls box biases the review and pollutes the theme rollup on surface 5. Prefill only from data the reviewer themselves entered in this process, or from the creator's declared ask, and label which it is. Also, never use `defaultValue` and `value` on the same field; React will silently ignore one and the no-JS path will diverge.

### Draft persistence that survives Escape, tab-hide, and a closed laptop
- **What:** The composer writes a draft keyed by project id on a debounced input, on `visibilitychange` when the page hides, and inside the `<dialog>`'s `cancel` handler before the dialog actually closes. Escape still closes immediately (no confirm dialog); reopening the composer restores the draft and says so in a line the reviewer can dismiss with one button.
- **Why it reads expensive:** Losing 400 words because a hand hit Escape is the failure people remember for a year. Linear's answer is instructive: navigating away keeps a temporary local draft that restores on the next create; Escape or close offers a persistent draft that survives logout, lives on a Drafts page, and is kept for six months. The version that reads best inside Whetstone's constraints is the silent one, because the contract bans confirmation dialogs for reversible actions and celebratory toasts, and a draft that saves itself is exactly a reversible action.
- **How:** Do not `preventDefault()` the dialog's `cancel` event: contract gate line 30 requires Escape to close and restore focus to the trigger, and the dialog's default `closedby` for `showModal()` is `closerequest`. Instead: `dialogRef.current.addEventListener('cancel', () => saveDraft())` and let the close proceed. Add `document.addEventListener('visibilitychange', () => { if (document.hidden) saveDraft(); })`, which MDN recommends over `beforeunload` because `beforeunload` is unreliable on mobile and disqualifies the page from Firefox's bfcache. Debounce the in-typing save at 800ms of idle. Use `beforeunload` only as a narrow backstop, added when the draft is dirty and a save has failed, removed the moment it succeeds, with `e.preventDefault()` (plus `e.returnValue = true` for Chrome/Edge below 119) and nothing else; the browser ignores it without sticky activation anyway. On reopen, render the restore line in the same reserved message slot as an info callout: `background: var(--color-surface-wash)` with `color: var(--color-text-1)` set in the same rule (contract §2.4 rule 9), the literal copy `Restored your draft from 4 minutes ago.` and one `<button>Discard draft</button>`. Do not `autofocus` anything but the first textarea (contract bans `autofocus` outside a modal, and this is inside one, so it is legal).
- **Where:** Surface 4 composer, surface 8 new-thread form, surface 7 bounty request.
- **Risk:** `localStorage` writes on every keystroke will jank on a long body; debounce and store one JSON blob per project, not per field. A restored draft that silently overwrites a newer server-side draft is a data-loss bug, so stamp `savedAt` and prefer the newer. And the restore line must not be a toast: the contract's ban 46 rules out celebratory toasts for an effect already visible on screen, and the restored text is visible on screen.

### A counter that only speaks when it matters, with the visible and spoken counts split
- **What:** The character or word counter is hidden until the reviewer crosses a threshold of the limit. The visible counter is `aria-hidden="true"`; a separate live region carries the spoken count and only becomes announceable past the threshold. Typing past the limit is allowed, never blocked.
- **Why it reads expensive:** A counter that reads 0 of 2000 the whole time is nagging furniture; a counter that appears at 1500 is a helpful colleague. GOV.UK's component does exactly this with `data-threshold`, and its source splits the two counters precisely: `govuk-character-count__status` carries `aria-hidden="true"`, `govuk-character-count__sr-status` carries `aria-live="polite"` and keeps `aria-hidden="true"` until the threshold is crossed. The component also refuses to block input so that a reviewer can paste a full answer and then edit it down.
- **How:** Threshold at 75%: `const show = length >= Math.floor(maxLength * 0.75)`. Two nodes:
```tsx
<div className="cc-visible" aria-hidden="true">{remaining} characters remaining</div>
<div className="sr-only" aria-live="polite" aria-hidden={show ? undefined : true}>{srText}</div>
```
Update the spoken string on a settle timer, not on every keystroke: GOV.UK polls at 1000ms while focused and only acts once the value has been unchanged for 500ms, which also catches speech-recognition software writing the value without firing `input`. Under the limit, the visible node is `--text-xs` at `color: var(--color-text-3)`; over the limit it flips to `color: var(--color-critical)` with the Phosphor `WarningCircle` at 16px, and the plural is handled properly (`1 character over the limit`, not `1 characters`). Place it below the textarea, in its own row, not sharing the reserved message slot. Use `&nbsp;` before the unit per contract §3.4. Without JS, render a static hint: `You can enter up to 2,000 characters.`
- **Where:** Surface 4 composer textareas. Nowhere else: a counter on the discussion reply or the bio would be nagging furniture by definition.
- **Risk:** Setting `maxlength` on the textarea blocks typing past the limit and destroys the paste-then-edit flow, so use a soft limit validated on submit and leave `maxlength` off. Do not put `aria-live` on the visible node and `aria-hidden` on nothing: that is the double-announcement bug GOV.UK fixed in 2022. And note that `String.length` counts emoji and many non-Latin characters as more than one unit, so a count shown to a reviewer writing in a non-Latin script will be wrong; count with `[...str].length` or `Intl.Segmenter` if the limit is user-facing.

### Keep all five category panels mounted; surface per-tab error counts on the tab
- **What:** The composer's roving-tabindex tablist hides inactive panels with the `hidden` attribute rather than unmounting them, so every textarea keeps its value, a native no-JS submit posts all five categories at once, and the error summary can link into a panel that is not currently open. A tab whose panel holds a problem carries a numeral and a glyph, never a color alone.
- **Why it reads expensive:** The failure it prevents is specific and infuriating: submit fails, the summary lists a problem in Onboarding, you click the link, and either nothing happens (the field is unmounted) or the tab switches and your Balance draft is gone. Making the tabs a view over one persistent form, rather than five forms, is what makes a five-category composer feel like one document instead of a five-page tax return. It also satisfies the contract's requirement that the composer work with JavaScript disabled, essentially for free, because all five fields are in the DOM at submit time.
- **How:** Panels: `<div role="tabpanel" id="panel-balance" aria-labelledby="tab-balance" hidden={active !== 'balance'}>`. Keep the panel out of the tab order (each contains a focusable textarea, so APG does not require `tabindex="0"` on the panel itself; add it only to panels with no focusable content). Use automatic activation, which APG recommends when panels display without noticeable latency, with Left/Right wrapping and Home/End. Error-summary links call a handler that sets the active tab and then focuses: `setActive(tabOf(fieldId)); requestAnimationFrame(() => document.getElementById(fieldId)?.focus());` (the field is display:none until the `hidden` flag clears, and focus on a hidden element is a no-op, hence the frame). Tab error affordance: append a chip at `--text-2xs` with `font-variation-settings: 'wdth' 87, 'wght' 600`, `font-feature-settings: 'zero' 1`, `border-radius: var(--radius-xs)`, the numeral, and a 16px `WarningCircle`, plus `aria-describedby` on the tab pointing at a visually hidden `1 problem`. Tab underline moves on `transform: translateX` at 180ms `--ease-out` (contract §6.2), never on `width` or `left`.
- **Where:** Surface 4 composer tablist (Fun / Balance / Controls / Onboarding / Performance).
- **Risk:** `hidden` is overridden by any `display` rule with higher specificity, and a grid or flex parent setting `display: grid` on the panel will defeat it; guard with `[hidden] { display: none !important }` or, better, `.panel[hidden] { display: none }` at matching specificity, since the contract bans `!important`. Also, five mounted textareas means five `field-sizing` boxes: verify the dialog's `max-height: min(80vh, 40rem)` is measured against the active panel only, since hidden panels contribute no height.

### Pending state that does not resize the button or lie about progress
- **What:** The submit button reserves the inline size of its longest label so the label swap from Post feedback to Posting… causes zero reflow in the sticky footer; the spinner is delayed 150ms and held 300ms minimum; the outcome is announced once in a polite status region rather than shouted by a toast.
- **Why it reads expensive:** The footer of a composer is the last thing a reviewer looks at, and a button that jumps 12px wider when it starts working is the detail that makes the whole surface feel cheap. Reserving the width is three lines. The 150/300 rule kills the flash-of-spinner on a fast connection, which is the other half of the same feeling.
- **How:** ```css
.btn-submit { min-inline-size: var(--btn-submit-w); white-space: nowrap; }
```
Measure `--btn-submit-w` once by rendering both strings in a hidden span at build or in a layout effect, or simply set it from the longer literal with `ch` and verify at 375px. Drive from `isPending` (third return of `useActionState`). Delay the spinner with a 150ms timer cleared on resolve; hold with a `Math.max(0, 300 - elapsed)` timeout. Contract §5.4 permits disabling the submit only while in-flight, so `disabled={isPending}` is legal and `aria-disabled` plus a reason is not needed here because the reason is visible in the label. Status region: `<p role="status" aria-live="polite" className="sr-only">` updated to `Feedback posted to Maya Okonkwo’s roguelike deckbuilder.` on success. Per contract §5.4 success is silent when the effect is visible, so if the posted row appears in the thread behind the dialog, the visible toast is omitted and only the status region speaks.
- **Where:** Surface 4 composer footer, surface 9 auth, surface 7 bounty request, surface 8 reply.
- **Risk:** Two failure modes. `role="status"` on a node whose text is set in the same commit as its insertion often does not announce; render the node empty on mount and set its text in a later effect. And `disabled` on the submit removes it from the tab order mid-flight, dropping focus to the body; use `aria-disabled="true"` with a click guard instead if the in-flight window can exceed a second, so focus stays put.

### A check-answers pass before posting, built from summary rows not a second form
- **What:** Pressing Post feedback on a multi-category review shows a read-only summary inside the same dialog: one row per category with the grit value, the first line of the note, and a Change link that returns to that exact tab. Continue posts. The reviewer reads instead of writing, which is why it does not feel like another step.
- **Why it reads expensive:** GOV.UK's rationale is that a check page gives users a second chance to notice and correct errors before submitting, and measurably lowers error rates. In Whetstone the stake is social, not clerical: feedback is public and attached to your name, and one glance before it goes out is worth more than any validation rule. The craft is in making it a `<dl>`-shaped read, not a review screen that re-renders the inputs.
- **How:** Render the summary from the same state object the action would submit. Each row: `<div class="sum-row"><dt>Balance</dt><dd>3000 grit · 214&nbsp;words</dd><dd><button type="button">Change<span class="sr-only"> the Balance note</span></button></dd></div>`. The visually hidden suffix is GOV.UK's exact device and is what makes a list of five links named Change usable with a screen reader's link list. Change sets the active tab, closes the summary, and focuses that panel's textarea; Continue calls `form.requestSubmit(submitRef.current)`. Layout is hairline-ruled rows (`border-block-end: 1px solid var(--color-border-hair)`, `padding-block: var(--space-sm)`), `--radius-0`, Archivo `--text-sm` for the key and `tabular-nums` on the grit numeral, first line of the note in Literata `--text-xs` clipped to one line. No card, no second containment level. Crossfade between compose and summary at 240ms `--ease-out` on opacity only, or skip motion entirely; both are inside the ceiling.
- **Where:** Surface 4 composer, when two or more categories carry content. Surface 7 for a paid bounty request, where the money makes the review pass mandatory.
- **Risk:** Gating a single-category note behind a check page is pure friction; show it only at two or more filled categories, or make it a disclosure the reviewer opens. GOV.UK's own guidance is that after a Change the Continue button must return straight to the check page, not walk the remaining steps, so the tab you return from must know to come back. And this must not become the contract's banned confirmation dialog for a reversible action: it is a review of content, not a Are you sure.

### Every drag has a tap-only twin (SC 2.5.7), specified as a real menu not a keyboard fallback
- **What:** The dashboard suggestion tracker's drag-to-move is mirrored by a per-item Move to… button that opens a menu of destination columns. Tap the button, tap the column, the card moves. No holding, no keyboard required.
- **Why it reads expensive:** Most products that bolt on a keyboard path for drag think they have satisfied 2.5.7. They have not: the understanding document is explicit that the alternative must work with a single pointer, because touchscreen users may have no keyboard. The WCAG page's own kanban example is precisely this, select an element with a tap, then use controls to move it between columns. Shipping the menu also makes the tracker usable one-handed on a phone, which is where creators actually triage feedback.
- **How:** Each tracker item carries `<button type="button" aria-haspopup="menu" aria-expanded={open} popovertarget={`move-${id}`}>` with the Phosphor `DotsThree` glyph, and a native `[popover]` element containing `role="menu"` with one `role="menuitem"` per column (the contract mandates the Popover API over a library). Button hit area 44x44 via `::before { position:absolute; inset:-12px }` per contract §5.5, with `>=8px` to its neighbour. On choose: optimistic move with `useOptimistic`, row insert at 180ms `--ease-out` on `opacity` and `translateY(8px -> 0)` (contract §6.2), plus a `role="status"` announcement `Moved to Planned. Column now has 4 items.`. The same rule applies to the composer's grit selector: build it as a `<fieldset>` of five radios with the hatch swatch and the literal numeral, never a range slider, since a slider is a dragging movement and would then owe its own tap alternative (the WCAG page's slider guidance is that clicking anywhere on the track must reposition the thumb).
- **Where:** Surface 5 suggestion tracker (the contract already names this), and preventively surface 4's grit selector and any future rating control.
- **Risk:** A Move to… menu that only appears on hover fails the same criterion it was built to satisfy and trips contract ban 46 (hover-only affordances with no focus or tap equivalent). Render it always, at `--color-text-3`, stepping to `--color-text-1` on hover and focus. Also, drag libraries commonly `preventDefault` on `pointerdown` across the whole card, which can swallow the button's click on touch; scope the drag handle.

### Target size proven by the spacing exception, not by eyeballing (SC 2.5.8)
- **What:** A written, checkable rule for the small controls that the 44px base cannot absorb: the counter's clear button, the summary row's Change link, the tab's dismiss affordance. Either the target is 44x44 including its `::before` expansion, or it satisfies the spacing exception with real geometry.
- **Why it reads expensive:** The contract already mandates 44px, which passes 2.5.8 with room. The craft is knowing the exception well enough to handle the two or three places where 44px is genuinely wrong, without guessing. The exception's wording is exact: undersized targets must be positioned so that if a 24 CSS pixel diameter circle is centred on the bounding box of each, the circles do not intersect another target or another undersized target's circle. That means 24px centre-to-centre spacing, measured from bounding-box centres, not 24px of gap.
- **How:** For any control under 44px, compute centre-to-centre distance to the nearest neighbouring target and require `>= 24px`; the contract's `>=8px` gap plus a 20px glyph box already yields 28px centre-to-centre, so the house rule is safe, but write the arithmetic into `/design/finish-gate.md` per line 26 rather than asserting it. Use the Inline exception only for links genuinely inside a sentence (a Sign in link inside the auth error copy), never for a row of chips, since the exception exists because reflow makes spacing unpredictable in running text. Use the Equivalent exception deliberately: a 20px inline Change link inside a summary row passes if the same action is also reachable from a 44px control elsewhere on the page, which the tab itself provides. Measure with DevTools on the composite box including `::before`, because the pseudo-element expansion is what carries the size and is invisible in a screenshot.
- **Where:** Surfaces 4, 5, 7, 8. Especially the summary-row Change links and the tracker's per-item menu button.
- **Risk:** The commonest error is measuring the gap instead of the centre distance and then shipping targets that pass a visual check and fail the SC. The second is stacking a 44px `::before` expansion on adjacent controls so the expansions overlap: the criterion is about the target, and overlapping hit areas mean taps land on the wrong control, which is a usability bug even where it is technically conformant. Keep `>=8px` between the expanded boxes, not the visual boxes.

### Auth that a password manager can drive end to end (SC 3.3.8)
- **What:** Paste enabled everywhere, correct `autocomplete` tokens on every field, and a one-time code entered in a single input rather than six boxes, so nobody is asked to transcribe anything.
- **Why it reads expensive:** SC 3.3.8 bans cognitive function tests unless an exception applies, and the Mechanism exception is satisfied precisely by allowing password managers to enter the password and by allowing copy and paste to reduce the burden of re-typing. The six-box OTP widget, which almost every product now ships, is the canonical failure: the understanding document states that users must be able to paste the code and let the user agent fill the fields, and that requiring manual transcription is non-compliant. Shipping one input instead reads as restraint and is less code.
- **How:** Fields: `autocomplete="username"` on the email at sign-in, `autocomplete="new-password"` at sign-up, `autocomplete="current-password"` at sign-in, and one `<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6}>` for the code, in Archivo with `font-variant-numeric: tabular-nums` and `letter-spacing: 0.12em` so the six digits read as groups without splitting the field. Never set `onPaste={e => e.preventDefault()}` and never `autocomplete="off"` on a password. Reserve the right-edge adornment slot permanently for the show/hide toggle (contract §5.5) so enabling it causes no shift; the toggle is a `<button type="button" aria-pressed>` with Phosphor `Eye`/`EyeSlash` at 20px and a 44px hit area. Error copy follows the contract's three beats with no exclamation: `That email already has an account. Sign in instead, or use a different address.` plus a real `Sign in` link. Because the sign-up email is carried into sign-in via a search param, SC 3.3.7 is satisfied in the same breath.
- **Where:** Surface 9 auth only.
- **Risk:** Splitting the OTP into six inputs is usually introduced for looks and then defended as friendlier; it is the specific thing the criterion names. If a designer insists, the only conformant version auto-distributes a pasted six-character string across the boxes and supports the user agent filling them, which is more code than the single input and still worse for screen readers. Also, `letter-spacing` on an input shifts the caret in some engines; verify the caret sits between digits at 375px before shipping it.


---

## research:feed-and-density

**Sources read:**
- https://inclusive-components.design/cards/
- https://adrianroselli.com/2020/02/block-links-cards-clickable-regions-etc.html
- https://css-tricks.com/block-links-the-search-for-a-perfect-solution/
- https://css-tricks.com/position-sticky-and-table-headers/
- https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_grid_layout/Subgrid
- https://developer.mozilla.org/en-US/docs/Web/CSS/content-visibility
- https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-padding
- https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter
- https://developer.mozilla.org/en-US/docs/Web/CSS/-webkit-line-clamp
- https://developer.mozilla.org/en-US/docs/Web/CSS/text-wrap-style
- https://developer.mozilla.org/en-US/docs/Web/CSS/:has
- https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollIntoView
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-current
- https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- https://www.w3.org/WAI/ARIA/apg/patterns/grid/
- https://www.w3.org/WAI/WCAG22/Understanding/character-key-shortcuts.html
- https://nextjs.org/docs/app/api-reference/components/link
- https://react.dev/reference/react/useOptimistic
- https://developer.chrome.com/blog/css-scroll-state-queries
- https://tanstack.com/virtual/latest/docs/introduction
- https://linear.app/now/how-we-redesigned-the-linear-ui
- https://primer.style/components/action-list

### True metadata columns across rows (subgrid), not a dot-separated string
- **What:** Every row's metadata sits in real, shared vertical tracks — category, grit chip, feedback count each own a column that is identical on row 1 and row 400 — instead of being inline-flowed text joined by separators. The `<ul>` owns the track definition; each `<li>` inherits it with `grid-template-columns: subgrid`. This is the single highest-leverage change for a row feed, and the contract already demands the `<dl>` semantics it needs (§4.4, surface 2: "Metadata is a `<dl>`, never a `·`-joined string").
- **Why it reads expensive:** A dense list stops reading as text and starts reading as a spec sheet. The eye can run down one column and compare grit values or feedback counts without re-parsing each line. Ragged, content-width metadata is the single loudest tell of a hand-rolled feed; locked columns is what makes Linear's issue list scannable, and Linear's own redesign writeup describes exactly this work — aligning labels, icons and buttons vertically and horizontally as the thing users "feel after a few minutes" without consciously noticing.
- **How:** ```css
.feed {
  display: grid;
  /* thumb | title+ask | category | grit | count */
  grid-template-columns:
    48px minmax(0, 1fr) [meta-start] 8rem 6rem 4rem [meta-end];
  column-gap: var(--space-sm);   /* 12px */
}
.feed > li {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: subgrid; /* columns only — never rows */
  align-items: center;
  min-block-size: 4.5rem;
  border-block-end: 1px solid var(--color-border-hair);
}
.feed > li > dl {
  grid-column: meta-start / meta-end;
  display: grid;
  grid-template-columns: subgrid;
  row-gap: var(--space-3xs);
}
.feed dt { font-size: var(--text-2xs); font-variation-settings: 'wdth' 87, 'wght' 600; color: var(--color-text-3); }
.feed dd { margin: 0; font-size: var(--text-xs); color: var(--color-text-2);
  font-variant-numeric: tabular-nums; }
.feed dd.count { inline-size: 4ch; text-align: end; } /* 3 and 128 share a right edge */
.feed .grit { font-feature-settings: 'zero' 1; }
```
Below `--bp-sm` (40rem) drop to `grid-template-columns: 48px minmax(0,1fr)` and set the `<dl>` to `grid-auto-flow: row`, which is precisely the breakpoint the contract already defines ("Feed row metadata goes from stacked to inline"). Named lines (`meta-start`/`meta-end`) are passed into the subgrid automatically per MDN, so the `<dl>` places itself without magic numbers. The `dt` uses the contract's own table-column-head setting (`--text-2xs`, `'wdth' 87`) — a metadata column head *is* a table column head. Subgrid is Baseline since September 2023.
- **Where:** Discover feed row (surface 2), the project list on the public creator profile which reuses the Discover row (surface 6), and the two-column reviewer list on the marketplace (surface 7).
- **Risk:** Two real traps. (1) Never set `grid-template-rows: subgrid` alongside it — MDN is explicit that subgridding both dimensions prevents implicit track creation and extra items have nowhere to go. (2) A grid container forced into an independent formatting context stops being a subgrid and becomes a normal nested grid, so `content-visibility`, `contain: layout`, non-visible `overflow`, or absolute positioning on the `<li>` will silently kill the alignment. I did not fetch a source stating that interaction precisely — verify it in DevTools before combining this with technique 6. The escape hatch costs nothing: define `--feed-cols: 48px minmax(0,1fr) 8rem 6rem 4rem` once and set `grid-template-columns: var(--feed-cols)` on every `li`; because every track here is either fixed or `minmax(0,1fr)`, alignment is byte-identical, and only content-sized (`auto`/`max-content`) tracks genuinely require subgrid. Separately: I tried to fetch Carbon's data-table style page for reference density values and it returned truncated with no numbers, so the 4.5rem row height stands on the contract, not on an external benchmark.

### Row-as-link by stretching the title link's ::after, with the accessible name kept short
- **What:** The whole 4.5rem row navigates, but the only `<a>` wrapping content is the one around the title. Its `::after` pseudo-element is absolutely positioned across the row, so the click target is the row while the accessible name is just the project title. Other interactive children (the author link, the grit chip that filters, a "Give feedback" button) are lifted above the overlay with `z-index`.
- **Why it reads expensive:** It is the difference between a row that responds where you point and one that makes you hunt for the title. Cheap implementations either wrap everything in an `<a>` — Adrian Roselli measured a screen reader taking roughly 25 seconds to read a single card announced that way — or attach `onClick` to a `<div>`, which kills middle-click, cmd-click, right-click-copy-link-address, and the status-bar URL preview. Those three affordances are exactly what a daily user reaches for in month two, and their absence is felt long before it is diagnosed.
- **How:** ```css
.feed > li { position: relative; }
.feed .row-title a::after {
  content: "";
  position: absolute;
  inset: 0;
  z-index: 1;
}
.feed > li :is(a, button):not(.row-title a) {
  position: relative;
  z-index: 2;               /* above the overlay */
}
```
The 44px hit expansion the contract mandates (`::before { position:absolute; inset:-12px }`) inherits the child's stacking context, so it clears the overlay for free — but only if the child itself carries `position: relative; z-index: 2`. Verify every child target with DevTools' hit-test overlay, not by eye.

Text selection is the known cost: the overlay masks the text. Restore it with a delegated listener on the `<ul>` (not a JSX `onClick` on the `<li>`, which trips `jsx-a11y/click-events-have-key-events` — gate line 49):
```ts
useEffect(() => {
  const ul = ref.current;
  if (!ul) return;
  const onClick = (e: MouseEvent) => {
    if (e.defaultPrevented || e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if ((e.target as Element).closest('a, button')) return;
    if (window.getSelection()?.toString()) return;   // user was selecting text
    (e.target as Element).closest('li')
      ?.querySelector<HTMLAnchorElement>('.row-title a')?.click();
  };
  ul.addEventListener('click', onClick);
  return () => ul.removeEventListener('click', onClick);
}, []);
```
Keyboard already works — the real `<a>` is in the tab order — so this listener is pure progressive enhancement and the row degrades to a normal link with JS off.
- **Where:** Discover feed rows (surface 2), discussion thread rows (surface 8), dashboard inbox `<tr>` (surface 5 — apply the same `::after` to `td > a[href]` with `position: relative` on the `<tr>`), reviewer rows (surface 7).
- **Risk:** Forgetting the cleanup returns from the effect is an auto-fail on ban-list item 53. Forgetting `e.metaKey`/`e.button` checks makes cmd-click open the row twice (once natively, once forwarded). Stretching the `::after` over a child whose 44px `::before` expansion sits *outside* its own box will produce a dead zone that only shows up on touch. And do not let the pseudo-element cover the grit chip if that chip is itself a filter link — either raise it, or clip the overlay with `inset: 0 8rem 0 0` so it stops before the metadata columns, which also gives text selection back on the ask without any JS.

### Row hover and focus painted by :has(), with the focus ring left on the child
- **What:** The row tints on hover and whenever anything inside it has `:focus-visible`, using a `:has()` selector — no JS, no state, no wrapper div. Crucially the row tint and the focus ring are separate signals: the row says *which row*, the 2px straw outline says *which control inside it*.
- **Why it reads expensive:** In a dense list, a focus ring on a small trailing button with no row context leaves you unsure where you are; a row-wide fill with no ring leaves you unsure what Enter will do. Products that feel good at 400 rows show both at once. `:has()` gets it without a single `onMouseEnter` handler, which matters because JS-driven row hover in a long list is where jank enters a feed.
- **How:** ```css
@media (hover: hover) {
  .feed > li:has(> .row-title a:hover) { background-color: var(--color-surface-2); }
}
.feed > li:has(:focus-visible) { background-color: var(--color-surface-2); }

.feed > li { transition: background-color var(--dur-1) var(--ease-out); }   /* 120ms in */
@media (hover: hover) { .feed > li:not(:hover) { transition-duration: var(--dur-exit-1); } } /* 80ms out */

/* ring stays on the actual focused element, and never transitions */
.feed a:focus-visible, .feed button:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 2px;
  border-radius: inherit;
}
```
One background step, no transform, no shadow — which is exactly what contract §5.4 permits for rows ("Cards, feed rows, and grid items never transform"). `:has()` is Baseline since December 2023.
- **Where:** Discover rows, discussion rows, dashboard inbox rows, marketplace rows — every row register in the product.
- **Risk:** MDN warns that broadly-anchored `:has()` is expensive during DOM mutation. Anchor to the `li` and use the child combinator (`li:has(> a:hover)`), never `body:has(...)` or `*:has(...)`. Do not put `:has(:hover)` outside a `@media (hover: hover)` guard or touch devices get a sticky tint after every tap. And never add a transition to the `outline` — that is gate line 41.

### The grind-mark as a permanently-reserved transparent border, so nothing moves when it appears
- **What:** The contract's identity motif — a 2px accent rule on the leading edge of exactly one element per view — is reserved as a transparent `border-inline-start` on *every* row at rest, and only its color changes on the current one. Zero geometry change between states, and RTL correct for free.
- **Why it reads expensive:** The alternative implementations both fail the contract in small, visible ways: adding a 2px border only on the current row shifts that row's content 2px sideways (border *width* changing between states is banned by §5.2), and a `box-shadow: inset` cannot be transitioned and would fight the hairline. Reserving the gutter is the move that makes selection feel like the list was designed around it rather than decorated after the fact.
- **How:** ```css
.feed > li {
  border-inline-start: 2px solid transparent;   /* reserved on every row, always */
  border-block-end: 1px solid var(--color-border-hair);
}
.feed > li[aria-current="true"] {
  border-inline-start-color: var(--color-accent);
}
.feed > li[aria-current="true"] .row-title { color: var(--color-text-1); }  /* steps up from text-2 */
```
Markup: `<li aria-current={isCurrent ? 'true' : undefined}>` — omit the attribute entirely when false rather than writing `aria-current="false"`, and set it on at most one row. `aria-current` is the correct attribute here rather than `aria-selected`: MDN warns against substituting `aria-current` for `aria-selected` on elements with `role="row"`/`option`/`gridcell`, but Whetstone's rows are plain `<li>` elements in a navigation list with no grid role, so "this is the one you are looking at" is exactly `aria-current`'s job. Account for the 2px in the subgrid by starting track 1 after it — the `<ul>`'s `padding-inline-start` absorbs nothing; the border is on the `li`, inside its own box.
- **Where:** The open ask on project detail, the selected thread in discussions, the current bounty in the marketplace, the focused inbox row on the dashboard — §2.4 rule 7 caps this at exactly one element per view, so the `aria-current` computation must live in one place per surface.
- **Risk:** If a second element on the same viewport also carries the grind-mark, the motif dies and gate line 7 (accent footprint) starts creeping. Also: `border-inline-start: 2px solid transparent` on a row whose background is a surface fill will show the page ground through the border under `background-clip: border-box` — set `background-clip: padding-box` on filled rows or accept the 2px ground sliver as the intended gap.

### scroll-padding-top for the two sticky layers, plus a stuck-state that changes shadow without animating it
- **What:** Two things that together make a sticky filter bar stop being a nuisance: `scroll-padding-top` on the scroll container so that anything scrolled into view — hash links, `scrollIntoView`, and the browser's own focus scrolling — clears both the nav and the filter bar; and a `stuck` state that adds `--shadow-raised` the moment the bar detaches, with no transition at all.
- **Why it reads expensive:** Tabbing into a row that lands underneath a sticky bar is the most common failure of sticky-header feeds and it is a hard WCAG 2.2 fail (SC 2.4.11 Focus Not Obscured), which is gate line 25. Fixing it with per-element `scroll-margin` means remembering it on every focusable forever; fixing it once on the container means it is right for elements nobody has written yet. Next.js's own docs recommend exactly this because their router skips sticky and fixed elements when picking a scroll target.
- **How:** ```css
html {
  scroll-padding-top: calc(var(--nav-h) + var(--filterbar-h)); /* 3.5rem + 3rem */
  scrollbar-gutter: stable;
}
```
MDN's distinction is the point: `scroll-padding` is on the *container* and applies to every scroll-into-view operation; `scroll-margin` is per-element and must be remembered each time. Keep the contract's `scroll-margin-block: 5rem` on composer focusables as the belt-and-braces layer inside the `<dialog>`, which is its own scroll container.

Stuck state, progressive:
```css
.filterbar-wrap {
  position: sticky;
  top: var(--nav-h);
  z-index: var(--z-sticky);
  container-type: scroll-state;
}
.filterbar { background-color: var(--color-surface-2); color: var(--color-text-1); }
@container scroll-state(stuck: top) {
  .filterbar { box-shadow: var(--shadow-raised); }
}
/* fallback for engines without scroll-state queries */
.filterbar-wrap[data-stuck="true"] .filterbar { box-shadow: var(--shadow-raised); }
```
Fallback JS is a 1px sentinel `<div>` immediately above the wrapper watched by `IntersectionObserver` (`threshold: 0`), toggling `data-stuck` — not a scroll listener. Scroll-state container queries shipped in Chrome 133. Note there is **no** `transition` on the `box-shadow`: §6.3 bans animating it, so the swap is discrete, which is also what you want — a shadow that fades in over 180ms reads as lag.
- **Where:** Discover filter bar (`top: var(--nav-h)`), the dashboard inbox table's sticky column-head row, and the composer's sticky footer.
- **Risk:** `scroll-padding-top` on `html` only helps if `html` is the scroll container — if the feed lives in its own `overflow-y: auto` panel, put it on that element too. Do not stack a third sticky element: gate line 21 requires exactly one `position: sticky; top: 0` per page. And the `IntersectionObserver` fallback needs a cleanup return or it fails ban-list item 53.

### content-visibility: auto with an exact contain-intrinsic-size, instead of virtualising
- **What:** Two CSS lines that let the browser skip layout, style and paint for off-screen rows while keeping them in the DOM, the accessibility tree, the tab order, and find-in-page. Because the contract fixes the row at 4.5rem, the intrinsic size placeholder is exact rather than a guess, so the scrollbar tells the truth from the first frame.
- **Why it reads expensive:** Virtualised feeds break Ctrl+F, break browser scroll restoration, and produce blank flashes on fast scroll — all things a daily user hits in the first week and can never articulate as a bug. MDN is explicit that with `content-visibility: auto` the skipped content "must still be available as normal to user-agent features such as find-in-page, tab order navigation, etc." You get most of the perf win and none of the behavioural debt.
- **How:** ```css
.feed > li {
  content-visibility: auto;
  contain-intrinsic-size: auto 4.5rem;  /* the auto keyword matters */
}
```
The `auto <length>` form is the one to use: MDN notes the element "retains its rendered intrinsic size even when scrolled out of viewport," so once a row has been measured the estimate is replaced by its real height and the scroll position stops drifting. The bare `contain-intrinsic-size: 4.5rem` form does not do this.

Threshold for escalating to real virtualisation: only past roughly 2,000 live DOM rows, and Whetstone's Discover feed should be paginating long before that. If it ever comes, TanStack Virtual's `useVirtualizer({ count, getScrollElement, estimateSize })` is headless — it "does not ship with or render any markup or styles" — so it introduces no visual dependency and is not on the contract's banned-dependency list (§8.6 item 54).
- **Where:** Discover feed `<li>`s, discussion thread rows, and the dashboard inbox `<tr>` set once it exceeds a screenful.
- **Risk:** This is the conflict flagged in technique 1: layout containment can force the element into an independent formatting context, which would make a `grid-template-columns: subgrid` row fall back to an independent grid and silently lose column alignment. Test the two together in DevTools first; if they fight, move `content-visibility` to a section/group wrapper around chunks of rows, or use the `--feed-cols` custom-property fallback for alignment. Second risk: applying it to rows shorter than ~2 viewports of content is pure overhead — measure before adding it.

### A two-line ask that reserves its own height and never leaves an orphan
- **What:** The Literata ask is clamped to two lines, the clamp height is *reserved* with `min-block-size: 2lh` so a one-line ask does not make its row shorter than its neighbours, and `text-wrap: pretty` stops the second line being a single stranded word.
- **Why it reads expensive:** This is what keeps the 4.5rem row height literal rather than nominal. If some rows are 68px and some are 72px because their ask happened to be short, the metadata columns wobble and the hairlines stop forming a regular rhythm — the reader registers it as sloppiness without locating it. And clamping with CSS rather than JS keeps the full ask in the DOM: MDN notes this means screen readers still read the whole text and users can still copy it, which is a real advantage over truncating the string server-side.
- **How:** ```css
.feed .ask {
  font-family: var(--font-prose);
  font-size: var(--text-xs);        /* 13px / 1.45 */
  line-height: 1.45;
  color: var(--color-text-2);
  max-inline-size: 66ch;

  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;                    /* standard property, not yet Baseline — ship both */
  overflow: hidden;

  min-block-size: 2lh;              /* = 37.7px at 13px/1.45; row height stays exact */
  text-wrap: pretty;
  overflow-wrap: anywhere;
}
```
MDN is explicit that `-webkit-line-clamp` needs all four of `display: -webkit-box`, `-webkit-box-orient: vertical`, the clamp count, and `overflow: hidden` — omit `overflow: hidden` and you get an ellipsis with no clipping. `text-wrap: pretty` (Baseline October 2024) is the right choice here, not `balance`: MDN restricts `balance` to short blocks of roughly 6 lines or fewer and calls it computationally expensive, which is not what you want repeated 200 times down a feed.
- **Where:** The clipped two-line ask in every Discover row, the reviewer bio excerpt in the marketplace list, and the first-line preview of a discussion post.
- **Risk:** MDN notes `-webkit-line-clamp` on an anchor element can truncate mid-word rather than at a word boundary — check the visual at 320px with a long unbroken token. `display: -webkit-box` on the ask element removes it from normal flow participation, so put the clamp on an inner element if the ask is itself a subgrid cell. And the whole row must still pass the 72ch absolute cap (gate line 13) — 66ch here is inside it.

### Arrow / j / k row traversal that stays a plain list of links and conforms to SC 2.1.4 by scoping
- **What:** Arrow Up/Down, Home/End, and the j/k aliases move DOM focus between row title links. The list is **not** given `role="grid"` or a roving single tab stop — it stays an ordinary `<ul>` of links where Tab still reaches every link, and the keys are an additive accelerator layered on top.
- **Why it reads expensive:** This is the decision most implementations get wrong in the direction of over-engineering. APG's single-tab-stop principle applies to composite widgets; a feed of navigable project links is not one, and turning it into a grid makes the row's secondary links unreachable by Tab while lying to screen readers about the structure. Layering arrows on a real link list gives power users Linear-speed traversal and costs assistive-tech users nothing. APG also notes the practical bonus of moving real DOM focus rather than `aria-activedescendant`: "the user agent will scroll the newly focused element into view."
- **How:** ```ts
const onKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target as HTMLElement;
  if (t.closest('input, textarea, select, [contenteditable]')) return;

  const map: Record<string, 1 | -1 | 'first' | 'last'> = {
    ArrowDown: 1, j: 1, ArrowUp: -1, k: -1, Home: 'first', End: 'last',
  };
  const move = map[e.key];
  if (move === undefined) return;
  e.preventDefault();

  const links = Array.from(
    e.currentTarget.querySelectorAll<HTMLAnchorElement>('li > .row-title a')
  );
  const i = links.indexOf(t.closest('li')!.querySelector('.row-title a')!);
  const next =
    move === 'first' ? 0 :
    move === 'last'  ? links.length - 1 :
    Math.min(Math.max(i + move, 0), links.length - 1);

  links[next].focus({ preventScroll: true });
  links[next].scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
};
```
`block: 'nearest'` is the key value — MDN describes it as scrolling only as much as necessary, so a row already on screen does not move at all and the viewport never lurches. `behavior: 'instant'` unconditionally: a smooth scroll on every j keypress would be both a lag signal and a 400ms-budget problem on a long jump, and it sidesteps the `prefers-reduced-motion` branch entirely. The manual `scrollIntoView` after `preventScroll: true` is what makes `scroll-padding-top` from technique 5 apply, so the focused row clears the sticky bar.

WCAG 2.2 SC 2.1.4 (Character Key Shortcuts) offers three conformance routes — turn off, remap, or "the keyboard shortcut for a user interface component is only active when that component has focus." Scoping the handler to `onKeyDown` on the `<ul>` takes the third route, so j/k needs no settings toggle. Document that in the component's keyboard-contract header comment (gate line 50).
- **Where:** Discover feed, dashboard inbox table (where Arrow keys are the primary traversal and the APG data-grid rules for Left/Right within a row become relevant), discussions list.
- **Risk:** Binding the handler globally on `document` instead of on the `<ul>` breaks SC 2.1.4 conformance immediately and will stomp on the composer's textarea. Forgetting the modifier-key bail makes Cmd+J (browser downloads) unreachable. Forgetting `preventScroll: true` gives you a double scroll — the UA's and yours — which reads as a stutter. And do not add `role="grid"`/`role="row"` to get arrow keys: the moment you do, you owe the full APG grid contract including Left/Right cell traversal and `aria-selected`, and Tab stops reaching the row's inner links.

### Prefetch on intent rather than on viewport entry
- **What:** Feed rows opt out of Next's default prefetching and instead prefetch the project detail route on pointer dwell or focus — the moment intent is real, roughly 100–200ms before the click lands.
- **Why it reads expensive:** Row → detail becomes instant, which is the single transition a Whetstone user makes hundreds of times a week, and it buys that without the alternative cost. Next's docs state that prefetching "happens when a `<Link />` component enters the user's viewport (initially or through scroll)" — in a 200-row feed with `content-visibility` scrolled fast, that is 200 route fetches for the two rows anyone opens. Intent-based prefetch is the version that still feels instant on a phone on a train.
- **How:** ```tsx
'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';

export function RowTitleLink({ href, children }: { href: string; children: React.ReactNode }) {
  const router = useRouter();
  const timer = useRef<number | undefined>(undefined);
  const seen = useRef(new Set<string>()).current;

  const arm = () => {
    if (seen.has(href)) return;
    timer.current = window.setTimeout(() => { seen.add(href); router.prefetch(href); }, 120);
  };
  const disarm = () => window.clearTimeout(timer.current);

  return (
    <Link
      href={href}
      prefetch={false}
      onPointerEnter={arm}
      onPointerLeave={disarm}
      onFocus={arm}
      onBlur={disarm}
    >{children}</Link>
  );
}
```
`onPointerEnter` rather than `onMouseEnter` so pen and hover-capable touch behave; `onFocus` so the j/k user in technique 8 gets the same speed as the mouse user. The 120ms dwell means scrolling past a row never fires. The `Set` means re-hovering a row you already armed is free. Next's default `prefetch="auto"`/`null` prefetches the partial route down to the nearest `loading.js` boundary for dynamic routes, so keep `loading.tsx` present on the detail segment (gate line 48) — that boundary is what makes the prefetch small.
- **Where:** Discover row title links, discussion thread rows, marketplace reviewer rows — anywhere a long list of links points at route segments.
- **Risk:** Prefetching is production-only per Next's docs, so this will look like it does nothing in dev — verify with a production build and the network panel, not `next dev`. Without the `Set` guard a user sweeping the pointer down the list fires a request per row, which is worse than the default. And `prefetch={false}` disables hover prefetching too, so the manual handler is not optional once you set it.

### scrollbar-gutter: stable and overscroll-behavior: contain on every scroll container
- **What:** Reserve the scrollbar's width permanently so the feed does not jolt sideways when a filter change shortens the list below one viewport, and stop scroll chaining out of the filter drawer and the composer dialog into the page behind them.
- **Why it reads expensive:** The horizontal jolt on filter apply is a ~15px layout shift that fires on one of the most-repeated interactions in the product; nobody reports it and everybody feels it. MDN frames `scrollbar-gutter` as exactly this: classic scrollbars "consume/release space in the viewport, causing unwanted layout shifts," and `stable` reserves the gutter "even if not overflowing." Two declarations, permanent payoff, Baseline since December 2024.
- **How:** ```css
html { scrollbar-gutter: stable; overflow-x: clip; }

/* the filter drawer below --bp-md, and the composer dialog body */
dialog .scroll-body {
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}
```
If the persistent filter rail (≥60rem) and the feed sit side by side and only one scrolls, MDN's third example applies — give the non-scrolling one `overflow: hidden; scrollbar-gutter: stable;` so both reserve the same width and their top edges stay aligned.
- **Where:** The document scroll container on all nine surfaces; the Discover filter `<dialog>` drawer body below 60rem; the composer dialog's scrolling panel between its header and sticky footer.
- **Risk:** `scrollbar-gutter: stable both-edges` is the wrong default here — it reserves space on both sides and will break the left alignment the contract insists on for project detail. Use plain `stable`. It has no effect where the OS uses overlay scrollbars (most macOS setups), so test on Windows or with scrollbars forced always-visible, or you will conclude it does nothing.

### Filters as a real GET form over search params, with a pending dim instead of a skeleton
- **What:** The filter rail is a `<form method="GET">` whose state lives entirely in the URL, read by a Server Component. The client enhancement replaces the URL inside `startTransition` with `scroll: false`, and the `isPending` flag dims the still-valid rows rather than replacing them with skeletons.
- **Why it reads expensive:** Three things at once: the filtered view is linkable and back-button-correct, the whole thing works with JS disabled, and — the craft part — the feed does not flash. Swapping valid rows for skeletons on a filter change destroys the user's spatial memory of the list for no information gain; dimming says "this is about to be replaced" while keeping every row readable. `scroll: false` is the detail that stops the feed jumping to the top on every chip toggle, which is the most common unforced error in filtered feeds.
- **How:** ```tsx
'use client';
const [isPending, startTransition] = useTransition();
const router = useRouter();
const pathname = usePathname();

const setFilter = (next: URLSearchParams) => {
  startTransition(() => {
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  });
};
```
```css
.feed[data-pending="true"] { color: var(--color-text-2); }
.feed[data-pending="true"] .row-title { color: var(--color-text-2); } /* steps down from text-1 */
.feed { transition: color var(--dur-1) var(--ease-out); }
```
Spinner only if the transition exceeds 150ms, minimum 300ms visible, per §5.4 — and only then, a labelled one, never bare. Applied filters render as individually removable chips plus a single named escape action; the contract's own copy pattern for the empty result is already written (§7.2 row 5: "No projects match Game + Needs playtesting + 8000 grit. Drop the grit filter to see 14 games that need playtesting." + button "Clear grit filter"). For posting feedback rather than filtering, the companion is `useOptimistic(value)` with the setter called **inside** `startTransition` — React's docs are explicit that outside a transition the optimistic state renders briefly and immediately reverts.
- **Where:** Discover filter rail and grit-scale rail (surface 2 — the one place boldness is spent), the dashboard inbox filters (surface 5), the marketplace category filters (surface 7).
- **Risk:** `router.push` instead of `replace` fills the back stack with one entry per chip toggle, so Back stops meaning "the previous page." Omitting `scroll: false` re-scrolls to top on every toggle. Dimming to `text-2` must not be the *only* pending signal for a slow connection — pair it with `aria-busy="true"` on the `<ul>` and an `aria-live="polite"` result count so the change is announced. And the form must still submit as GET with JS off, which means the submit button cannot be `type="button"`.

### Sticky column-head row that keeps its hairline
- **What:** The dashboard inbox table's `<th>` row sticks below the nav and keeps its 1px rule, by abandoning `border-collapse: collapse` for `separate` with zero spacing and putting the rule on one side of each cell.
- **Why it reads expensive:** There is a well-known browser behaviour — logged as csswg-drafts issue 3136 — where collapsed table borders do not travel with sticky cells, so the header's underline detaches and scrolls away the moment you start scrolling, leaving the header floating with a visible seam. Fixing it is four lines and is the difference between a table that looks built and one that looks assembled. In a hairline-ruled system like Grit Index, a missing hairline is not a small defect.
- **How:** ```css
.inbox {
  border-collapse: separate;   /* NOT collapse */
  border-spacing: 0;
  inline-size: 100%;
}
.inbox :is(th, td) {
  border-block-end: 1px solid var(--color-border-hair);  /* rule on ONE side only */
  padding-block: var(--space-sm);
  padding-inline: var(--space-md);
  border-radius: var(--radius-0);
  font-variant-numeric: tabular-nums;
}
.inbox thead th {
  position: sticky;
  top: var(--nav-h);
  z-index: var(--z-sticky);
  background-color: var(--color-surface-2);  /* opaque — rows scroll under it */
  color: var(--color-text-3);                 /* set in the same rule, §2.4 rule 9 */
  font-size: var(--text-2xs);
  font-variation-settings: 'wdth' 87, 'wght' 600;
  text-align: start;
}
.inbox tbody tr:nth-child(odd)  { background-color: var(--color-surface-1); color: var(--color-text-2); }
.inbox tbody tr:nth-child(even) { background-color: var(--color-surface-2); color: var(--color-text-2); }
```
CSS-Tricks' fix is exactly this — `border-collapse: separate; border-spacing: 0;` with borders "on just two sides (e.g. top/left) of each `<th>` and `<td>`"; one side is enough when every row is present. The zebra must live on the `<tr>` and the sticky `<th>` must have its own opaque background or rows will show through it.
- **Where:** Creator dashboard inbox table (surface 5, pane a) — the one `<table>` in the product.
- **Risk:** `border-spacing: 0` is mandatory; without it every cell gains a 2px gap and the hairline grid shatters. Setting `background-color` on the `th` without `color` in the same rule is a direct §2.4 rule 9 violation and a gate failure. And `top: var(--nav-h)` on the `th` counts toward gate line 21's "exactly one element is `position: sticky; top: 0`" — this one is not at `top: 0`, so it is fine, but a third sticky layer on the same page is not.

### The loading skeleton rendered by the row component itself, static and shimmer-free
- **What:** The feed row and its skeleton are one component with a `pending` branch, so the skeleton's 48px thumbnail, `2lh` ask block, and every metadata column land on exactly the same pixels as the real row. The blocks are flat `surface-0` fills with no shimmer and no pulse.
- **Why it reads expensive:** A skeleton whose geometry is hand-approximated always drifts from the real row after two design changes, and the reflow when data arrives is the tell. Deriving both from one component makes the drift structurally impossible. The no-shimmer decision is the taste call: a static block at the recessed surface, inside the same hairline grid, says "the shape is known, the data is not" without adding an infinite animation — which §6.3 bans outright and which is, after a year of daily use, simply noise.
- **How:** ```tsx
export function FeedRow({ project, pending = false }: { project?: Project; pending?: boolean }) {
  // identical grid, identical tracks, identical min-block-size in both branches
  return (
    <li className="row" aria-hidden={pending || undefined}>
      {pending ? <span className="ph ph--thumb" /> : <img … />}
      …
    </li>
  );
}
```
```css
.ph { background-color: var(--color-surface-0); border-radius: var(--radius-xs); display: block; }
.ph--thumb { inline-size: 48px; block-size: 48px; }
.ph--title { block-size: 1lh; inline-size: 18ch; }
.ph--ask   { block-size: 2lh; inline-size: 42ch; }   /* matches the clamp reservation exactly */
```
Wrapper: `<ul aria-busy="true">` plus a visually-hidden `aria-live="polite"` line naming what is loading ("Loading projects filtered by Game and 400 grit"), which satisfies §5.4's "copy says what is loading" without putting a sentence on screen. Spinner, if any, appears only after 150ms and stays a minimum of 300ms.
- **Where:** `app/discover/loading.tsx` and the pending branch of the Discover row; the dashboard inbox `loading.tsx`; the discussions list. Gate line 48 requires `loading.tsx` on every route segment anyway, so this costs one prop.
- **Risk:** Any `animate-pulse` or shimmer keyframe here is a direct hit on ban-list items 40 and 42 and gate line 38. Hard-coding skeleton dimensions in a separate file is the failure mode this technique exists to prevent — if the placeholder sizes are not derived from the same tokens (`2lh`, `48px`, the shared column tracks), you have rebuilt the drift. And `aria-hidden` on the placeholder row matters: without it a screen reader enumerates a dozen empty list items.


---

## research:dashboard-dataviz

**Sources read:**
- https://docs.dovetail.com/help/dashboards
- https://dovetail.com/product/insights/
- https://help.maze.co/articles/4089931793-highlights-thematic-analysis-with-unmoderated-studies
- https://www.datawrapper.de/blog/divergingbars
- https://www.datawrapper.de/academy/what-to-consider-when-creating-stacked-column-charts
- https://clauswilke.com/dataviz/visualizing-uncertainty.html
- https://accessibility.build/guides/accessible-charts
- https://www.sarasoueidan.com/blog/accessible-data-charts-for-khan-academy-2018-annual-report/
- https://designsystem.digital.gov/components/data-visualizations/
- https://fossheim.io/writing/posts/accessible-dataviz-d3-intro/
- https://css-tricks.com/simple-patterns-for-separation/
- https://www.sigmacomputing.com/blog/data-charts-color-blindness
- https://www.w3.org/wiki/SVG_Accessibility/Palettes_for_low_vision_and_color_blind
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/forced-colors

### Fix the measured greyscale collision in the rollup bar (neutral vs critical)
- **What:** The contract's rollup segments are `--color-positive` #6FCF8E, `--color-text-3` #93A7AE, `--color-critical` #FF7A80. Back-solving relative luminance from the contract's own contrast table against `--color-surface-1` #141D20 (L_bg = 0.01195): positive L = 0.505, text-3 L = 0.3731, critical L = 0.3719. Neutral and critical are 0.3% apart in luminance, i.e. the same grey. Gate line 9.4/32 ("greyscale screenshot of the dashboard rollup… all meaning still readable") fails today, and under deuteranopia the green and salmon converge too. The fix is structural, not chromatic: separate adjacent segments by a 2px ground-coloured gap AND give the neutral segment a hatch fill, so the encoding survives greyscale, deuteranopia, and forced colors.
- **Why it reads expensive:** It is the difference between a chart that happens to look fine on your monitor and one that a colour-blind reviewer can read at 6pm on a laptop. Hatch-on-neutral also reads as a deliberate material decision (unfinished / unresolved = unfilled) rather than a palette accident.
- **How:** Build the bar as HTML flex, not SVG, so text stays real text. `ul.rollup { display:flex; gap: var(--space-3xs); /* 2px, on-scale; shows surface-1 through */ block-size: 1.25rem; border-radius: var(--radius-0); }` Each `li` gets `flex: var(--n) 1 0` where `--n` is the raw review count set inline (`style={{ '--n': theme.positive }}`), never a percentage — raw counts as `flex-grow` means the bar always sums exactly and there is no 99%/101% rounding artefact. `min-inline-size: var(--space-2xs)` on each `li` so a 1-of-40 segment is still visible. The neutral `li` carries an absolutely-positioned inline `<svg aria-hidden="true" width="100%" height="100%">` containing `<rect width="100%" height="100%" fill="url(#hatch-neutral)"/>`, with the pattern defined once in the page: `<pattern id="hatch-neutral" width="4" height="4" patternUnits="userSpaceOnUse"><line x1="0" y1="0" x2="0" y2="4" stroke="var(--color-hatch)" stroke-width="1.25"/></pattern>` — vertical lines, not diagonal (CSS-Tricks flags diagonal fills for vestibular discomfort). Because the rollup is a Server Component, derive the pattern id from the theme slug (`hatch-${theme.slug}`), not `useId()`, which is a client hook. Never use `repeating-linear-gradient`: gate line 9.1/5 greps for `linear-gradient` and expects zero hits.
- **Where:** Surface 5, Creator dashboard — pane (b), the theme rollup bars. This is the surface's one bold element, so it is the one that must not fail the greyscale test.
- **Risk:** Over-hatching. If you hatch two of the three segments, or drop the pattern spacing below 4px at 1.25px stroke, you get moiré on a 20px-tall bar and the row reads as noise. Exactly one segment carries a pattern. Also: do not let the 2px gap grow to 4px — at that width the bar stops reading as one whole and the part-of-total relationship is lost.

### Two views of one array: aria-hidden bar plus a real table in a <details>
- **What:** The bar and the numbers are generated from the same server-side array, in the same render, so they can never disagree. The visual bar is `aria-hidden="true"`; the actual text alternative is a real `<table>` with `scope` attributes, disclosed by a `<summary>`. accessibility.build states it plainly: "The chart and the table are two views of one dataset. Generate both from the same data so they never disagree," and "The data table is the alternative that actually carries the information." USWDS says the same (`usa-sr-only` table, chart `aria-hidden`).
- **Why it reads expensive:** Every reviewer who wants the exact numbers can get them without leaving the row, and the screen-reader path is the same path. Products that bolt on an `aria-label` summary feel thin the first time someone asks "what was the actual count".
- **How:** ```tsx
<figure className="rollup">
  <figcaption>Balance, 41 review passes</figcaption>
  <ul aria-hidden="true" className="rollup-bar">…</ul>
  <details className="rollup-numbers">
    <summary>Show the numbers</summary>
    <table>
      <caption className="sr-only">Balance feedback by sentiment</caption>
      <thead><tr><th scope="col">Sentiment</th><th scope="col">Reviews</th><th scope="col">Share</th></tr></thead>
      <tbody><tr><th scope="row">Works</th><td>24</td><td>59%</td></tr>…</tbody>
    </table>
  </details>
</figure>
```
sr-only utility, exactly as Sara Soueidan ships it (drop the deprecated `clip`): `.sr-only:not(:focus):not(:active){clip-path:inset(100%);height:1px;overflow:hidden;position:absolute;white-space:nowrap;width:1px;}`. `<summary>` needs `padding-block: var(--space-xs); padding-inline: var(--space-sm); min-block-size: 2.75rem;` to clear the 44px rule, and `list-style: none` plus a Phosphor `CaretRight` rotated by `transform` (not by animating anything banned). If you animate the disclosure at all, use `::details-content { block-size: 0; transition: block-size var(--dur-2) var(--ease-out), content-visibility var(--dur-2) allow-discrete; interpolate-size: allow-keywords }` — or simply do not animate it. Never animate `height` directly (ban list 39). Percentages in the table must use largest-remainder rounding so the Share column sums to exactly 100.
- **Where:** Surface 5 rollup; also the grit bars on Surface 3 (project detail ratings) and the 5-cell grit history strip on Surface 6.
- **Risk:** Duplicating the data-shaping logic in two components. Compute one `RollupRow[]` in the server module and pass it to both children; if the bar and the table ever take different props, they will drift and the table becomes a liability rather than an alternative.

### Replace every mean with a split test and a named split state
- **What:** Never render an average rating anywhere. Compute, per category, `topShare` (share of reviews in the top two grit-relative buckets) and `bottomShare`, and mark the row `split` when `topShare >= 0.30 && bottomShare >= 0.30`. A split row gets an explicit Archivo label and a straw warn treatment (icon + 1px border + label, never a fill — contract 0.16), because a split is the single most actionable thing a rollup can tell a creator and a mean destroys it. This is the concrete answer to "how do you show reviewers DISAGREE": you do not encode it in the bar's shape, you detect it and name it in text next to the bar.
- **Why it reads expensive:** A creator using this daily for a year learns that Whetstone tells them when the room is divided instead of handing them a 3.4. That is a product opinion, and product opinions are what separate a tool from a template. Dovetail's dashboards are explicitly framed as "a starting point for investigation rather than a static report" — the split flag is what starts the investigation.
- **How:** Server Component, no client JS: `const split = topShare >= 0.3 && bottomShare >= 0.3 && n >= 10;`. Markup: `<p className="split"><WarningCircle size={16} aria-hidden="true" /> Reviewers split: 12 say the pacing works, 9 say it drags.</p>` — Archivo `--text-xs`, `color: var(--color-warn)`, `border-inline-start: 1px solid var(--color-warn)`, `padding-inline-start: var(--space-xs)`. Copy obeys §7: active voice, real counts from real rows, no em dash (use a colon and a comma), no exclamation mark. Add `<th scope="row">` to the hidden table's split row and put the same sentence in the table caption, so the split is not a visual-only signal. The threshold constants live in one module with a comment naming the source, so they are tunable rather than folklore.
- **Where:** Surface 5 rollup rows; surface 3 project-detail rating rows (each grit bar gets the same test).
- **Risk:** Flagging split on n=4 and looking stupid. Gate the flag on the small-n rule below. Also: do not add a sixth hue for "split" — it takes straw's warn form (icon + border + label), and it must never be the only straw on the viewport competing with a focus ring.

### Below n=10, stop drawing percentages and draw one cell per reviewer
- **What:** Maze's own guidance is "ensure you have at least 10 responses to start identifying meaningful patterns" before thematic analysis. Wilke's uncertainty chapter supplies the perceptual reason to switch form rather than just annotate: "we are much better at perceiving, counting, and judging the relative frequencies of discrete objects… than we are at judging the relative sizes of different areas," and quantile dotplots "should use a small to moderate number of dots" — roughly 10 maximum before dots read as a continuum. So: n >= 10 renders the stacked bar with percentages; n < 10 renders one 12px cell per review and the sentence "4 of 7 reviewers". (I could not fetch datarevelations.com/showing-uncertainty or the Medium polarisation piece — both returned 403 — so this threshold is grounded in Maze and Wilke, not in those.)
- **Why it reads expensive:** "57%" off seven reviews is a lie with a decimal point. Switching form at the threshold is the kind of restraint a user notices in month three, and it makes early projects feel honest instead of empty.
- **How:** ```tsx
{n < 10
  ? <UnitStrip rows={reviews} />
  : <StackedBar rows={rollup} />}
```
`UnitStrip`: `ol { display:grid; grid-auto-flow:column; grid-auto-columns: 0.75rem; gap: var(--space-3xs); block-size: 1.25rem; }`, each `li { border-radius: var(--radius-xs); }` filled with `--color-positive` / hatched neutral / `--color-critical`, each carrying a `<span className="sr-only">` with the reviewer handle and verdict. Caption in Archivo `--text-xs`, `font-variant-numeric: tabular-nums`: `4 of 7 reviewers`. Cells are 12px wide so 9 cells plus gaps fit in 7rem, which is the same slot the bar occupies — the row height never changes when a project crosses the threshold, so the table does not jump. The threshold constant `MIN_N_FOR_SHARE = 10` lives beside the split thresholds.
- **Where:** Surface 5 rollup (new projects), surface 3 rating rows, surface 6 grit history strip cells.
- **Risk:** Two chart forms in one column is a consistency cost. It is only worth it because the column has a hard semantic break at n=10. Do not invent a third form for n between 10 and 30, and do not fade or dim the low-n bar as an alternative — dimming reads as disabled and collides with `--color-text-disabled`.

### Direct in-segment labels, with a container query moving the label out when the segment is too narrow
- **What:** Datawrapper: "Instead of using a legend, you can now label the areas of your columns directly. This vastly improves legibility since your readers do not have to color-match the legend to the individual areas." Sigma lists direct labelling as the first colour-blindness mitigation. Contract rule 2.4/8 already requires each segment to carry its percentage numeral and label. The craft problem is the narrow segment: at 9% of 12rem the label does not fit. Solve it per-segment with a container query, not with JS measurement.
- **Why it reads expensive:** Legends are a tax paid on every glance, forever. Labels that gracefully relocate instead of clipping or wrapping is the detail that makes a dense dashboard feel engineered.
- **How:** Each segment `li { container-type: inline-size; position: relative; }`. Label inside: `.seg-label { font-family: var(--font-ui); font-variation-settings: 'wdth' 87, 'wght' 600; font-size: var(--text-2xs); font-variant-numeric: tabular-nums; padding-inline: var(--space-2xs); white-space: nowrap; }`. Then `@container (max-width: 5rem) { .seg-label { clip-path: inset(100%); height:1px; width:1px; overflow:hidden; position:absolute; white-space:nowrap; } .seg-label-out { display: inline; } }` where `.seg-label-out` is a sibling rendered after the bar in a `--text-xs` metadata line (`Works 59% · Mixed 17% · Breaks 24%`, using the required `·` separator sparingly or, better, a `<dl>` per contract §4.4 row 2). Colours must not carry the label's meaning: the word plus the numeral is the carrier, per contract rule 2.4/8 and accessibility.build's "Colour can be a cue; it must never be the only cue." Label ink: dark ink on filled segments (`--color-accent-ink` family logic), never white on `--color-critical` (ban list 12).
- **Where:** Surface 5 rollup segments; surface 3 grit rating bars.
- **Risk:** Two sources of truth for the label text. Render both from the same string and toggle visibility with the container query, never with two different strings. And the out-of-bar fallback line must not exceed 58ch (UI paragraph cap).

### Left-aligned 100% stacked, never diverging, with a 50% hairline and a total at the top
- **What:** Datawrapper's case against diverging stacked bars is direct: they make it "really hard to compare the length of the bars to either side of the middle line," they waste horizontal space on the neutral band (bad at 320px), and they lose the shares intuition. Their prescription is a 100% stacked bar with direct labels, grid lines at reference points, and a second axis showing the combined category. Their other rule from the stacked-column guide: "Bring the most important value to the bottom" — in a horizontal bar that means the leading edge, sharing the baseline. Also from that guide: past roughly 10 totals, switch form; and never split the neutral category across a centre line, which they call "dangerous."
- **Why it reads expensive:** Diverging Likert bars are the fashionable choice and they are the wrong one on a 320px reflow. A left-aligned bar with a 50% tick answers "is this over half?" instantly, which is the only threshold question a creator actually asks.
- **How:** Segment order is fixed in code, never data-driven: positive (leading edge, shares the baseline with every other row) → neutral → critical. The 50% reference is a 1px element, not a gradient and not a border: `.rollup::after { content:''; position:absolute; inset-block:-2px; inset-inline-start:50%; inline-size:1px; background: var(--color-border-hair); }` with `aria-hidden` implied (pseudo-element). Above the bar, a single Archivo `--text-xs` line carries the combined total: `59% say balance works`. If the dashboard ever needs to compare more than ~10 themes at once, do not stack: render three left-aligned bars per row in a CSS `subgrid` so all three share a baseline (Datawrapper's split-bars recommendation), which also keeps the hairline-row grammar intact.
- **Where:** Surface 5 rollup. This also settles the question of what the rollup is NOT: no diverging bar, no donut, no gauge.
- **Risk:** The 50% tick sitting on `--color-border-hair` (1.58:1) is decorative-only by contract §5.2, which is correct here — it is a reading aid, not information. If you ever make it load-bearing (e.g. "majority" highlighting), it must move to `--color-border-control` at ≥3:1.

### One representative quote per theme, in Literata, inline in the row
- **What:** Dovetail's insight product is built on traceability: "embed highlight reels and video clips directly in your Docs so stakeholders don't read a generic paraphrase." Dovetail dashboards state that "every widget includes links to the underlying data powering it" with a drill-in affordance. Maze themes carry "linked highlights." Whetstone's version: every rollup row shows exactly one verbatim quote under the bar, set in Literata, with a link to the full feedback. Selection rule (deterministic, server-side): the longest highlight under 180 characters drawn from the modal sentiment bucket; on a split row, take one from each of the two poles.
- **Why it reads expensive:** The serif is the product's own tell that a person wrote this (contract §1: "a serif paragraph inside a row is the signal that there is a person in there"). A number with a human sentence under it is the whole thesis of the product rendered in one row, and it costs one `<figure>`.
- **How:** ```tsx
<figure className="rollup-quote">
  <blockquote cite={`/p/${slug}/f/${id}`}>“The second boss gate stops the run dead for me.”</blockquote>
  <figcaption>Maya Okonkwo, pass 3 · <a href={`/p/${slug}/f/${id}`}>Read the full note</a></figcaption>
</figure>
```
`blockquote { font-family: var(--font-prose); font-size: var(--text-prose); line-height: 1.65; max-inline-size: 66ch; font-variant-numeric: proportional-nums oldstyle-nums; }`; `figcaption { font-family: var(--font-ui); font-size: var(--text-xs); color: var(--color-text-3); }`. Curly quotes are required (§3.4); the em dash is banned, so the attribution uses a comma and a middot, not a dash. No border, no fill, no card — the quote sits directly on `surface-1` under the bar, indented by `padding-inline-start: var(--space-md)` to hang off the row. Truncation, if any, is `-webkit-line-clamp: 2` with the full text reachable by the link, never an ellipsis inserted into the string (three-period `...` is banned; `…` only).
- **Where:** Surface 5 rollup rows; the same `<figure>` primitive is reused on surface 3's feedback thread and surface 6's profile.
- **Risk:** Quote-picking that looks like editorialising. The selection rule must be deterministic and documented, and a split row must show both poles or the creator will accuse the product of cherry-picking. Also: quotes are user-submitted, so this path needs the DOMPurify rule from gate line 9.7/51 if it ever renders anything but plain text.

### Sort the rollup by disagreement by default, in the URL, with aria-sort
- **What:** Dovetail dashboards compare "up to 4 themes" by volume and trend. Volume-first sorting is the obvious default and the wrong one: the loudest theme is usually the one the creator already knows about. Default the rollup to descending disagreement (split rows first, then by `min(topShare, bottomShare)` descending), with volume and recency as alternate sorts, all expressed as `searchParams` read in a Server Component so the state is linkable and survives a reload.
- **Why it reads expensive:** Opening the dashboard and finding the contested thing already at the top is the single highest-value thing this screen can do. It costs a comparator function. Users who live in a tool for a year notice which thing the tool chooses to show first.
- **How:** `app/dashboard/page.tsx` is a Server Component reading `searchParams.sort` (`split` | `volume` | `recent`, defaulting to `split`). The sort control is a real `<form method="get">` with a `<select name="sort">` and a submit button, so it works with JS off; progressive enhancement via `useRouter` is optional and must not be the only path. On the hidden data table's header cells set `aria-sort="descending"` on the active column and `aria-sort="none"` on the others, with the header itself a `<button>` inside `<th scope="col">`. Keep the sort key visible in Archivo `--text-xs` above the list ("Sorted by disagreement") so the ordering is never mysterious.
- **Where:** Surface 5, both pane (a) the inbox `<table>` and pane (b) the rollup.
- **Risk:** Reordering under the user. If the sort is live and a new review flips two rows while someone is reading, that is a worse sin than a bad default. Sort on the server per request; do not re-sort in place on the client after an optimistic insert — append the optimistic row and re-sort on the next navigation.

### The bar never animates its width; only the row entry animates
- **What:** Contract 0.10 removed number counters because they violate the ceiling and are a generated-dashboard tell. A bar that grows into place is a counter drawn horizontally, and it is the single most common way a feedback dashboard announces itself as a template. So: segments get `transition: none` on size, explicitly. The only motion when feedback lands is the contract-sanctioned optimistic row insert.
- **Why it reads expensive:** Silence. Day 200, the creator refreshes the dashboard eleven times and nothing wiggles. Restraint here is felt as speed.
- **How:** `.rollup li { transition: none; }` stated explicitly so no inherited or utility transition catches it (and `transition: all` is grep-banned anyway, gate 9.5/35). New feedback arrives via `useOptimistic` in the inbox pane and animates only per the contract's table: `@media (prefers-reduced-motion: no-preference) { .row-enter { animation: row-in var(--dur-2) var(--ease-out) both; } } @keyframes row-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }` — 180ms, `cubic-bezier(0.16, 1, 0.3, 1)`, opacity and transform only. The rollup numerals re-render at their final value on the next paint. If you want any acknowledgement at all, change the row background by exactly one surface step over `--dur-1` (120ms) and let it settle — one effect, not three.
- **Where:** Surface 5, both the inbox and the rollup.
- **Risk:** Someone will ask for the bar to "animate in" on first paint. The answer is no, and the reason is written down: gate line 9.5/36 plus merge-ledger 0.10. The escape hatch, if a stakeholder insists, is a single `transform: scaleX()` on the segment with a counter-scaled label — transform is allowed — but it is still a counter and it still fails the spirit of the ledger.

### Segment detail on hover AND focus via the Popover API, dismissible, with @starting-style
- **What:** accessibility.build maps this to SC 1.4.13: "Tooltips must appear on both hover and focus, remain visible while pointed at, and be dismissible with Escape." The contract already forbids hover-only affordances (ban list 46) and prescribes the platform Popover API over a component library (merge ledger 0.13). Each rollup segment gets a focusable trigger that opens a small popover naming the segment, its count, its share, and one quote.
- **Why it reads expensive:** Peeking at a segment without leaving the page is the interaction people repeat hundreds of times. Doing it on the platform primitive means it survives Escape, light-dismiss, and top-layer stacking for free, and there is no z-index argument to have.
- **How:** ```tsx
<button type="button" popovertarget={`seg-${slug}-${key}`} className="seg-trigger">…</button>
<div id={`seg-${slug}-${key}`} popover="auto" className="seg-pop">…</div>
```
```css
.seg-pop { background: var(--color-surface-4); color: var(--color-text-1); border: 1px solid var(--color-border-control); border-radius: var(--radius-lg); box-shadow: var(--shadow-overlay); padding: var(--space-sm); max-inline-size: 20rem; opacity: 0; transform: translateY(4px); transition: opacity var(--dur-exit-2) var(--ease-in), transform var(--dur-exit-2) var(--ease-in), overlay var(--dur-exit-2) allow-discrete, display var(--dur-exit-2) allow-discrete; }
.seg-pop:popover-open { opacity: 1; transform: translateY(0); transition-duration: var(--dur-2); transition-timing-function: var(--ease-out); }
@starting-style { .seg-pop:popover-open { opacity: 0; transform: translateY(4px); } }
```
180ms in / 120ms out, opacity and transform only, per the contract's motion table. Anchor with `anchor-name: --seg-x` on the trigger and `position-anchor: --seg-x; position-area: block-start span-inline-end;` plus `position-try-fallbacks: flip-block;`, with a `position: absolute` fallback inside a `position: relative` row for engines without anchor positioning. Trigger hit area reaches 44px via `::before { position:absolute; inset-block:-12px; }` without changing the 20px bar height. Hover opens it too (`onPointerEnter` calling `el.showPopover()`), but focus alone must be sufficient, and the popover content must also exist in the hidden data table so it is never the only route to the data.
- **Where:** Surface 5 rollup segments. Same primitive reused for the grit chip explainer in Discover's filter rail (surface 2).
- **Risk:** Hover-open plus `popover="auto"` light-dismiss can fight each other if the pointer leaves through the gap between trigger and popover. Give the popover `margin-block-end: 0` against the anchor and close on `pointerleave` of a wrapper containing both, not of the trigger. If that gets fiddly, ship focus/click-only — that is still compliant; hover-only never is.

### A forced-colors path, because forced colors deletes every bar fill
- **What:** MDN lists `background-color` and SVG `fill`/`stroke` among the properties forced at paint time when `forced-colors: active`, and `background-image` forced to `none`. That means the entire rollup bar collapses to a single `Canvas`-coloured strip for Windows High Contrast users: all three segments become indistinguishable. The grit hatch primitive, by contrast, survives by construction — its information is stroke density, and forced colors recolours the strokes but does not change their spacing. So: the hatch is already safe; the rollup is not.
- **Why it reads expensive:** Almost nothing ships this. It is two rules of CSS and it is the difference between a dashboard that degrades and one that disappears.
- **How:** Preferred fix, one rule pair: `@media (forced-colors: active) { .rollup-bar { display: none; } .rollup-numbers { /* the <details> */ } .rollup-numbers > summary { display: none; } .rollup-numbers[open], .rollup-numbers { display: block; } }` — in forced colors the table replaces the bar rather than trying to survive as one. Ship the `<details>` element with `open` forced via CSS-driven layout, or simpler, render the table unconditionally and hide it with `.sr-only` outside forced-colors mode, un-hiding it inside: `@media (forced-colors: active) { .rollup-table.sr-only:not(:focus):not(:active) { clip-path: none; position: static; inline-size: auto; block-size: auto; } }`. Only reach for `forced-color-adjust: none` where the exact colour IS the data (MDN names chart legends as the legitimate case) and then you must supply your own contrast, so prefer swapping in the table. Verify in Edge with Settings → Accessibility → Contrast themes, on all three of the dashboard panes.
- **Where:** Surface 5 rollup and the surface 3 grit rating bars. The bevel rail and grit hatch need no change; note that in `/design/direction.md` as a deliberate finding.
- **Risk:** Writing `forced-color-adjust: none` across the whole chart. That opts out of the user's chosen palette entirely and is exactly the abuse MDN warns about ("should be used for small tweaks, not complete redesigns"). Swap the form, do not defeat the mode.

### ch-locked numeric columns so nothing reflows as counts change
- **What:** Contract §3.4 requires `tabular-nums` on every count. Tabular figures stop digits from jittering but they do not stop a column from resizing when 9 becomes 10. Lock every numeric cell to a `ch` width sized for the maximum plausible value, right-aligned, so the whole dashboard is geometrically stable as feedback arrives. Same treatment for the grit chip, which additionally needs slashed zero per §3.4.
- **Why it reads expensive:** Columns that never move when data updates is the quietest possible signal that a table was built rather than generated. It is also what makes a live inbox scannable at a glance instead of re-read every time.
- **How:** ```css
.num { font-family: var(--font-ui); font-variant-numeric: tabular-nums; font-variation-settings: 'wdth' 94, 'wght' 400; inline-size: 4ch; text-align: end; }
th.num { font-variation-settings: 'wdth' 87, 'wght' 600; font-size: var(--text-2xs); }
.grit-chip { font-variant-numeric: tabular-nums; font-feature-settings: 'zero' 1; inline-size: 5ch; text-align: end; border-radius: var(--radius-xs); }
.pct { inline-size: 4ch; }  /* fits “100%” */
```
Use `ch` not `rem`: `ch` is the advance of “0”, which with tabular figures is exactly the advance of every digit, so `4ch` is precisely four digits regardless of how the Archivo width axis is set on that element. Percentage cells: apply largest-remainder rounding server-side so the column sums to 100 and no cell ever renders `100%` next to a bar that is 99% full. Row heights: `align-items: center; line-height: 1` on intrinsic-height items per contract §4.4 row 8.
- **Where:** Surface 5 inbox `<table>` and rollup numerals; surface 7 marketplace price column; surface 6 reputation sentence.
- **Risk:** `ch` widths break if a number exceeds the reserved digits. Pick the width from the real maximum in the data model (review counts are bounded in practice; grit values are a closed set of five), and add `min-inline-size` rather than a fixed `inline-size` if the ceiling is genuinely open.

### Name the chart with role=img + aria-labelledby, and hide the internals
- **What:** accessibility.build: `role="img"` "tells assistive technology to treat the SVG as a single image, and it collapses the internal shapes so a screen reader reads only your label," with the warning that "`<title>` and `<desc>` alone are not reliably announced." Sara Soueidan's Khan Academy implementation pairs `role="img"` + `aria-label` (the name, announced before the role) with `aria-describedby` (the description, announced after, "with a short pause preceding it"), and specifically rejected `<figcaption>` as a description because figcaption supplies a name, not a description. Sarah Fossheim's D3 walkthrough adds the practical point that visual-only labels should be moved off-canvas rather than `display: none`, which removes them from the accessibility tree.
- **Why it reads expensive:** It is the difference between a screen reader announcing "graphic" and announcing "Balance sentiment across 41 review passes, image. Fifty-nine percent say balance works; reviewers are split." Both cost the same to write.
- **How:** Where the bar is purely decorative because a table carries the data (the rollup), use `aria-hidden="true"` on the bar and let the `<figcaption>` + `<details>` table do the work — USWDS's explicit recommendation. Where the SVG IS the information and no table accompanies it (the surface-3 bevel rail, the surface-6 grit history strip), use: `<svg role="img" aria-labelledby={titleId} aria-describedby={descId}>` with `<title id={titleId}>Grit history, 41 projects</title>` and a `<desc id={descId}>` carrying the sentence; ids derived from the entity slug on the server, not `useId()`. Per contract gate 9.4/31 the grit bars must announce their scale, so the accessible name is literally `"Balance: 3000 of 8000"` — build it from the same formatter that renders the visible numeral. Every purely decorative `<svg>` in the chart (the 50% tick, the hatch `<defs>`) takes `aria-hidden="true"` (gate 9.4/34).
- **Where:** Surface 3 bevel rail and rating bars, surface 6 grit history strip, surface 2 grit chips, surface 5 rollup.
- **Risk:** Double-announcing. If the `<figure>` has a `<figcaption>` and the inner `<svg>` has `role="img"` with its own label, a screen reader reads the same sentence twice. Pick one: caption-plus-hidden-svg for anything with a table, labelled-svg for anything without.


---

## research:motion

**Sources read:**
- https://emilkowal.ski/ui/7-practical-animation-tips
- https://emilkowal.ski/ui/great-animations
- https://emilkowal.ski/ui/you-dont-need-animations
- https://emilkowal.ski/ui/building-a-toast-component
- https://emilkowal.ski/ui/building-a-drawer-component
- https://emilkowal.ski/
- https://animations.dev/learn/css-animations/transitions
- https://developer.mozilla.org/en-US/docs/Web/CSS/@starting-style
- https://developer.chrome.com/blog/entry-exit-animations
- https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API
- https://developer.mozilla.org/en-US/docs/Web/API/View_Transition_API/Using
- https://developer.mozilla.org/en-US/docs/Web/CSS/view-transition-name
- https://nextjs.org/docs/app/guides/view-transitions
- https://css-tricks.com/nuking-motion-with-prefers-reduced-motion/

### Top-layer exit animations with @starting-style + transition-behavior: allow-discrete + overlay
- **What:** Animate the native <dialog> and Popover-API primitives in and OUT using only CSS, with no React "isClosing" state, no setTimeout before unmount, and no JS motion library. Three platform features do the work: @starting-style supplies the "from" values for an element that has no previous state (first render, display:none → visible, entry into the top layer); `display N allow-discrete` keeps the element painted for the length of the exit; `overlay N allow-discrete` keeps it in the top layer for the same span, which is the part everyone forgets.
- **Why it reads expensive:** The single most common tell of a hand-built overlay is that it fades in and then vanishes on close, because the browser yanks it out of the top layer the instant `close()` runs. Symmetric, interruptible entry and exit on a dialog is the difference between "a div appeared" and "a panel was placed." It also deletes the class of bug where a fast double-press leaves a ghost dialog mounted, which a daily user hits within a week.
- **How:** In globals.css, for the composer dialog:

```css
dialog.panel {
  opacity: 0; transform: scale(0.98);
  transition:
    opacity   var(--dur-exit-3) var(--ease-in),
    transform var(--dur-exit-3) var(--ease-in),
    overlay   var(--dur-exit-3) allow-discrete,
    display   var(--dur-exit-3) allow-discrete;
}
dialog.panel[open] {
  opacity: 1; transform: scale(1);
  transition:
    opacity   var(--dur-3) var(--ease-out),
    transform var(--dur-3) var(--ease-out),
    overlay   var(--dur-3) allow-discrete,
    display   var(--dur-3) allow-discrete;
}
/* MUST come after the [open] rule: same specificity, source order decides. */
@starting-style {
  dialog.panel[open] { opacity: 0; transform: scale(0.98); }
}
dialog.panel::backdrop {
  background-color: transparent;
  transition:
    background-color var(--dur-exit-3) var(--ease-in),
    overlay var(--dur-exit-3) allow-discrete,
    display var(--dur-exit-3) allow-discrete;
}
dialog.panel[open]::backdrop { background-color: var(--color-scrim); }
@starting-style { dialog.panel[open]::backdrop { background-color: transparent; } }
```

React side collapses to `ref.current.showModal()` / `ref.current.close()`. Delete any `const [closing, setClosing] = useState(false)` and any `setTimeout(unmount, 160)` in src/components/ui/dialog.tsx. 240ms in / 160ms out are the contract's --dur-3 / --dur-exit-3, unchanged. Same block, swapping `transform: scale()` for `translateY(100%)`, drives the Discover filter drawer; swapping for `translateY(4px)` at --dur-2/--dur-exit-2 drives popover.tsx and dropdown-menu.tsx via `[popover]:popover-open`. Baseline 2024, so it ships today with no polyfill; browsers without it simply get an instant close.
- **Where:** src/components/ui/dialog.tsx (surface 4, the feedback composer), drawer.tsx (Discover filter drawer below 60rem), popover.tsx, dropdown-menu.tsx, and the tracker's "Move to…" menu on the creator dashboard.
- **Risk:** Three ordering traps, each silent. (1) @starting-style must be written AFTER the `[open]` rule or it never applies — same specificity, later source wins. (2) `allow-discrete` must sit inside the shorthand per-property; writing `transition-behavior: allow-discrete` before a `transition:` shorthand gets reverted to `normal` by the shorthand. (3) Omitting the `overlay` line makes the exit invisible while looking correct in code review — the element is clipped out of the top layer immediately. Also do not transition `filter` or `box-shadow` here; §6.3 bans both.

### Transitions for anything reversible; keyframes only for one-shot sequences
- **What:** A CSS transition retargets: interrupt it and the browser reads the current computed value and animates from there to the new target. A @keyframes animation does not — interrupt it at 40% and it restarts from frame 0. So every two-state thing in the product (hover, open/closed, selected/unselected, checked) is driven by a `transition` on a data-attribute or pseudo-class change, and @keyframes is reserved for the three things that genuinely run once and cannot be reversed: the hero grind, the loading spinner, and view-transition pseudo-elements (which require keyframes by spec).
- **Why it reads expensive:** Interruptibility is the property users feel but never name. Open a menu, change your mind at 80ms, close it: with a transition the panel travels back from where it actually is over 120ms. With keyframes it snaps to fully-open and then plays the close. In a product someone opens the composer forty times a day, this is the difference between a tool that tracks intent and one that argues with it.
- **How:** Author every primitive as `state attribute + transition`, never `state attribute + animation-name`:

```css
.menu { opacity: 0; transform: translateY(4px);
  transition: opacity var(--dur-exit-2) var(--ease-in),
              transform var(--dur-exit-2) var(--ease-in); }
.menu[data-open] { opacity: 1; transform: translateY(0);
  transition: opacity var(--dur-2) var(--ease-out),
              transform var(--dur-2) var(--ease-out); }
```

Note the transition is declared on BOTH states, with different durations and curves, so the exit is 120ms/--ease-in and the entrance 180ms/--ease-out — the contract's 65% rule falls out of where you put the declaration, not out of a JS branch. Be explicit about `transition-property` rather than relying on a shorthand that catches future properties (`transition-property: opacity, transform` + `transition-duration`), which is also how you stay grep-clean on `transition: all`. Existing hits to convert: the tab panel crossfade, the checkbox tick, the theme toggle, the chip selected state.
- **Where:** Every file in src/components/ui that has an open/closed or selected state: tabs.tsx, dropdown-menu.tsx, popover.tsx, tooltip.tsx, switch.tsx, checkbox.tsx, chip.tsx, segmented-control.tsx, dialog.tsx.
- **Risk:** Two properties can only be transitioned, never keyframed, if you want reversal: `display` and `overlay` (technique 1). Conversely, the hero grind on "sharper" must stay a keyframe — it is a one-shot, sessionStorage-gated sequence, and making it a transition would let a hydration re-render replay it. Do not reach for a spring or a `linear()` spring approximation to get "interruptible": §8.4-38 bans springs and overshoot on UI state change, and a decelerating cubic-bezier already retargets fine.

### Reduced motion authored as the base layer, with a functional-motion escape hatch
- **What:** Invert the cascade: write the opacity-only version as the default and add transform under `@media (prefers-reduced-motion: no-preference)`, instead of writing the full motion and clipping it with a global duration nuke. Then punch one hole in the existing global reset so genuinely functional motion (spinner, indeterminate progress) survives, which the contract asks for in prose (§6.4: "Functional motion keeps running, slower") but its own `*` reset currently forbids.
- **Why it reads expensive:** Reduced motion is not no motion — position change across distance is the vestibular trigger; a short opacity cross-dissolve is not. Products that nuke everything give reduced-motion users a worse, more confusing product (elements teleport, loading states freeze); products that degrade to cross-fades stay legible. A frozen spinner under Reduce Motion is a bug a reviewer will hit on day one and never report.
- **How:** Per primitive:

```css
/* base = the reduced-motion version: opacity only, no travel */
.menu { opacity: 0; transition: opacity var(--dur-exit-2) var(--ease-in); }
.menu[data-open] { opacity: 1; transition-duration: var(--dur-2);
                   transition-timing-function: var(--ease-out); }
@media (prefers-reduced-motion: no-preference) {
  .menu { transform: translateY(4px); transition-property: opacity, transform; }
  .menu[data-open] { transform: translateY(0); }
}
```

Keep the existing global `*` reset as a backstop for anything missed, then add immediately after it, inside the same media block:

```css
@media (prefers-reduced-motion: reduce) {
  [data-motion='functional'] {
    animation-duration: 1.2s !important;
    animation-iteration-count: infinite !important;
  }
}
```

and put `data-motion="functional"` on spinner.tsx and any indeterminate progress bar. For JS reads, replace a one-time `matchMedia(...).matches` with a live subscription so an OS-level change takes effect without a reload, using the pattern already in toast.tsx:

```ts
const mq = () => window.matchMedia('(prefers-reduced-motion: reduce)')
export const useReducedMotion = () => useSyncExternalStore(
  (cb) => { const m = mq(); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
  () => mq().matches,
  () => false,  // SSR: assume motion, the CSS base layer is already safe
)
```
- **Where:** src/app/globals.css §6.4 block, src/components/ui/spinner.tsx, progress.tsx, and the `prefersReducedMotion` helper currently exported from dialog.tsx.
- **Risk:** The `!important` is load-bearing here — it has to beat the reset's own `!important`, and it is the only place outside the reset where it is justified; do not let it spread. `useSyncExternalStore` with a server snapshot of `false` means the first client paint assumes motion; that is safe only because the CSS base layer is already the reduced version. I could not fetch Apple's HIG motion page (developer.apple.com returns a JS-rendered shell to WebFetch and yielded only the page title), so nothing here is attributed to HIG; the reduce-don't-remove argument is cited to CSS-Tricks.

### @starting-style for optimistic row insertion, replacing the mount-class useEffect
- **What:** An optimistically inserted row (useOptimistic) gets its 180ms entrance from `@starting-style` rather than from the usual `useEffect(() => setMounted(true))` + `requestAnimationFrame` double-render dance. The browser supplies the "from" state for an element that was just added to the DOM.
- **Why it reads expensive:** The rAF/mount-class pattern has a one-frame window where the row paints at its final position before the class lands, which shows up as a flash on a busy main thread — exactly when an optimistic insert happens, because React is also reconciling. Removing the extra render also removes a whole class of "row animated twice" bugs on re-render. And it is four lines of CSS against a stateful hook per list.
- **How:** ```css
.row[data-fresh] {
  opacity: 1; transform: translateY(0);
  transition: opacity var(--dur-2) var(--ease-out),
              transform var(--dur-2) var(--ease-out);
  @starting-style { opacity: 0; transform: translateY(8px); }
}
@media (prefers-reduced-motion: reduce) {
  .row[data-fresh] { @starting-style { transform: none; } }
}
```

The optimistic entry sets `data-fresh` (server-rendered rows do not have it), so the attribute is the scope guard:

```tsx
const [rows, addRow] = useOptimistic(serverRows, (s, next: Reply) => [...s, { ...next, fresh: true }])
// …
<li key={r.id} data-fresh={r.fresh || undefined} className="row">
```

8px / 180ms / --ease-out are the contract's §6.2 "optimistic comment / feed row insert" line, unchanged.
- **Where:** Project detail feedback thread (surface 3) and discussion replies (surface 8) when a reply posts; Discover feed rows appended by pagination.tsx; toast insertion.
- **Risk:** @starting-style fires for EVERY element first rendered, including the whole server-rendered list on first paint. Without the `[data-fresh]` guard you get thirty feed rows sliding up on load, which is a scroll-reveal in all but name and fails §8.4-40. Also be aware React re-mounts on key change; if a row's key is derived from optimistic state and then from the server row, it will animate twice — key on the stable id.

### Instant on repeat, instant from the keyboard
- **What:** Two rules that switch a transition off rather than tune it: (a) if another instance of the same overlay was open within the last ~300ms, the next one opens with zero duration (Emil's `data-instant`); (b) if the interaction was keyboard-initiated, it does not animate at all.
- **Why it reads expensive:** Sweeping a pointer across a row of tooltips or tab triggers should feel like one continuous surface, not like ten independent 180ms fades. And a menu opened by ⌘K that takes 180ms to appear reads as lag, because the user's hands are already in the next keystroke. Emil states this flatly: keyboard-initiated actions "should never" be animated. This is the rule that makes a tool survive daily use — it removes motion from the interactions that repeat most.
- **How:** Repeat suppression, module-scoped in tooltip.tsx / dropdown-menu.tsx:

```ts
let lastCloseAt = 0
export const markClosed = () => { lastCloseAt = performance.now() }
export const isWarm = () => performance.now() - lastCloseAt < 300
```

Set `data-instant` on the panel for that open, and match specificity so no `!important` is needed (place after the `[data-open]` rule):

```css
.menu[data-instant] { transition-duration: 0ms; }
```

Keyboard detection needs no key listener — a click synthesised by Enter/Space reports `detail === 0`:

```tsx
onClick={(e) => open({ instant: e.detail === 0 })}
```

Tooltips additionally need asymmetric delay, which §8.4-46 already requires: 300ms open delay on hover, 0ms on focus, 0ms on both when warm.
- **Where:** tooltip.tsx, dropdown-menu.tsx, popover.tsx, the composer's tablist (Fun / Balance / Controls / Onboarding / Performance — arrow-key traversal must not animate the underline), and any ⌘K-style opener.
- **Risk:** `e.detail === 0` is also 0 for programmatic `.click()` calls, which is usually the behaviour you want but will surprise you in tests. Do not extend "instant" to the composer dialog itself: a modal appearing with zero transition reads as a screen flash even to keyboard users — apply it to the tab underline and menus, not to the top-layer panel.

### Direction-aware entry offset instead of a fixed translateY
- **What:** A dropdown that flips above its trigger (because it is near the viewport bottom) must enter from below, not from above — the sign of the 4px offset follows the resolved placement. This is the Whetstone-legal form of Emil's transform-origin tip: the contract's dropdown motion is `translateY(4px → 0)` with no scale, so origin is irrelevant, but direction is not.
- **Why it reads expensive:** An element should always look like it emerged from the thing that spawned it. A flipped menu that still slides down from above appears to pass *through* its trigger. It is a two-line fix that almost nobody makes, and it is visible every single time the filter menu opens near the bottom of the Discover list.
- **How:** The positioner already knows the resolved side; publish it as a custom property instead of a class:

```ts
panel.style.setProperty('--pop-dy', side === 'top' ? '-4px' : '4px')
```

```css
.menu { transform: translateY(var(--pop-dy, 4px)); }
.menu[data-open] { transform: translateY(0); }
```

Same idea for the drawer: a bottom sheet enters `translateY(100%)`, a left rail drawer enters `translateX(-100%)`. If you later introduce scale on any anchored surface, set `transform-origin` from the same resolved side (`top left` / `bottom left`) — Emil's point is that the default `center` is almost always wrong for anchored UI.
- **Where:** popover.tsx, dropdown-menu.tsx, select.tsx, tooltip.tsx, and the Discover filter drawer.
- **Risk:** The property must be set before the `[data-open]` attribute lands in the same frame, or the first open reads the fallback `4px`; set it in the same layout effect that positions the panel. Keep the magnitude at 4px — increasing it to sell the direction turns a menu into a slide and starts to read as motion for its own sake.

### Skeleton-to-content handoff as a pure opacity crossfade over identical geometry
- **What:** Because the contract already mandates a skeleton whose geometry matches the real row exactly (8px radius, 4.5rem tall), the handoff can be a zero-movement crossfade: the skeleton exits over 120ms, the content enters over 180ms starting after the exit finishes. Nothing translates, because nothing needs to — the row is already in the right place.
- **Why it reads expensive:** The usual failure is a skeleton that vanishes and content that pops, or worse, both visible for a frame. An asymmetric handoff (old leaves fast so it stops competing for attention; new arrives more gently, delayed until the old is gone) is exactly the pattern Next's view-transition guide uses at 150ms/210ms. Getting this right on a feed that loads a hundred times a day is worth more than any hero animation.
- **How:** Zero-new-API version, keeping both mounted for the length of the handoff:

```css
.skeleton { opacity: 1; transition: opacity var(--dur-exit-2) var(--ease-in); }
.skeleton[data-resolved] { opacity: 0; }
.rows { opacity: 0;
  transition: opacity var(--dur-2) var(--ease-out) var(--dur-exit-2); }
.rows[data-resolved] { opacity: 1; }
```

120 + 180 = 300ms total, inside the 400ms ceiling. The upgrade, if you take on React's ViewTransition (Next App Router; on Next 15.5 it is behind `experimental: { viewTransition: true }` and imported as `unstable_ViewTransition`, and it is stated as experimental — on 16.x it needs no config):

```tsx
<Suspense fallback={<ViewTransition exit="skelOut" default="none"><FeedSkeleton/></ViewTransition>}>
  <ViewTransition enter="rowsIn" default="none"><FeedRows/></ViewTransition>
</Suspense>
```
```css
::view-transition-old(.skelOut) { animation: var(--dur-exit-2) var(--ease-in) both fade reverse; }
::view-transition-new(.rowsIn)  { animation: var(--dur-2) var(--ease-out) var(--dur-exit-2) both fade; }
@keyframes fade { from { opacity: 0 } to { opacity: 1 } }
```
- **Where:** app/(discover)/loading.tsx → the feed (surface 2), the dashboard inbox table (surface 5), and project detail's thread column (surface 3).
- **Risk:** Do not copy the `filter: blur(3px)` keyframe from Next's guide — §6.3 and ban 39 forbid animating `filter`, and the contract's geometry-matched skeleton makes it unnecessary anyway. Also do not add translate to the enter: the skeleton is already at the row's exact position, so any travel is a lie about where the content came from. The React `ViewTransition` API is explicitly experimental; the CSS version above has no version risk, so ship that first.

### Tab underline as one element moved with translateX + scaleX, re-measured on font load
- **What:** The active-tab rule is a single 1px-wide pseudo-element that is translated and scaled to the active trigger's box, so its width changes without ever animating the `width` property. The measurement is taken in a layout effect, refreshed by a ResizeObserver, and refreshed again after `document.fonts.ready`.
- **Why it reads expensive:** Two things separate a good tab bar from a generic one: the underline travels (rather than one fading out and another fading in), and it is never wrong by a few pixels. The font-load re-measure is the detail almost everyone misses — Whetstone loads Archivo Variable with `display: swap`, so the first measurement happens against the Arial fallback and the underline sits at the wrong width until the next interaction.
- **How:** ```tsx
const sync = useCallback(() => {
  const list = listRef.current; const active = list?.querySelector('[aria-selected="true"]')
  if (!list || !active) return
  const a = active.getBoundingClientRect(), l = list.getBoundingClientRect()
  list.style.setProperty('--tab-x', `${a.left - l.left}px`)
  list.style.setProperty('--tab-w', String(a.width))   // unitless multiplier
}, [])
useLayoutEffect(() => {
  sync()
  const ro = new ResizeObserver(sync); if (listRef.current) ro.observe(listRef.current)
  document.fonts.ready.then(sync)
  return () => ro.disconnect()
}, [sync, activeId])
```
```css
.tablist { position: relative; }
.tablist::after {
  content: ''; position: absolute; inset-block-end: 0; inset-inline-start: 0;
  inline-size: 1px; block-size: 2px; background-color: var(--color-accent);
  transform: translateX(var(--tab-x, 0)) scaleX(var(--tab-w, 0));
  transform-origin: 0 50%;
  transition: transform var(--dur-2) var(--ease-out);
}
```
The 1px base × `scaleX(width)` gives an exact pixel width with a transform-only animation. 180ms / --ease-out is the contract's §6.2 tab-underline line.
- **Where:** tabs.tsx (composer category tablist, surface 4), segmented-control.tsx, and the dashboard pane switcher.
- **Risk:** Combine with technique 5: arrow-key traversal of a roving tabindex must set `data-instant` so holding Right does not queue five 180ms slides. The ResizeObserver must be cleaned up (ban 53 fails a subscribe without cleanup). If the tablist ever scrolls horizontally, measure against `scrollLeft` or the underline drifts.

### Toast stack positioned by transform offsets measured with ResizeObserver, with a hover bridge
- **What:** Sonner's model, stripped to Whetstone's grammar: each toast is absolutely positioned at the same anchor, and its place in the stack is a `translateY` computed from the summed heights of the toasts before it plus the gap. Nothing animates `top`, `height`, or `margin`. A `::after` pseudo-element spans the gap between toasts so the pointer never falls through the seam and un-pauses the timer. Timers also pause on `document.visibilitychange`.
- **Why it reads expensive:** Toasts of different heights that reflow by changing layout properties jitter on every insert and dismiss. Offsets in transform space stay on the compositor and stay interruptible, so dismissing the middle toast lets the ones below it travel smoothly to their new slots. The `::after` bridge and the tab-hidden pause are pure daily-use details: without them, a toast dismisses while you are reaching for its Undo, or four minutes of background tab time silently burns the 4s timer.
- **How:** ```tsx
const GAP = 8 // --space-xs
const offset = list.slice(0, i).reduce((h, t) => h + (heights[t.id] ?? 0) + GAP, 0)
<li style={{ ['--toast-offset' as string]: `${offset}px` }} ref={measure} />
```
Measure with one ResizeObserver over the stack (`entry.borderBoxSize[0].blockSize`), not `offsetHeight` per render.
```css
.toast {
  position: absolute; inset-block-end: 0; inset-inline-end: 0;
  transform: translateY(calc(var(--toast-offset) * -1));
  transition: transform var(--dur-2) var(--ease-out),
              opacity   var(--dur-2) var(--ease-out);
}
.toast[data-exiting] { opacity: 0;
  transition-duration: var(--dur-exit-2); transition-timing-function: var(--ease-in); }
.toast::after { content: ''; position: absolute; inset-block-start: 100%;
  inset-inline: 0; block-size: 8px; }  /* hover bridge across the gap */
```
```ts
useEffect(() => {
  const on = () => (document.hidden ? pauseAll() : resumeAll())
  document.addEventListener('visibilitychange', on)
  return () => document.removeEventListener('visibilitychange', on)
}, [])
```
- **Where:** src/components/ui/toast.tsx — which already pauses on hover/focus and caps the stack at three, so this is the positioning and visibility half of the job.
- **Risk:** Do not copy Sonner's two published values: 400ms with `ease` is four times the contract's toast class (180/120), and the per-index `scale(0.95)` reads as a stack of cards, which contradicts the hairline-row grammar and would be the only stacked-card object in the product. Absolute positioning means the stack container needs `pointer-events: none` with `pointer-events: auto` restored on each toast, or it will eat clicks on the page beneath it.

### Cross-list reorder with view transitions, capped at the contract's duration and with the chrome anchored
- **What:** When the feed re-sorts, a tracker card moves column, or a filter removes rows, wrap the state update in `document.startViewTransition()` and let the browser FLIP every row from its old box to its new one. `view-transition-name: match-element` assigns the unique per-element identities automatically, so you do not hand-name a hundred rows. The whole thing is then clamped: 180ms, `--ease-out`, page stays clickable, sticky chrome does not move.
- **Why it reads expensive:** Re-sorting a list is the moment a user most needs continuity: they are trying to find where their project went. Rows that jump teach nothing; rows that travel show the new ranking. Doing it with the platform means no FLIP bookkeeping, no measurement pass, no library — and because the snapshot is taken by the compositor, it does not thrash layout the way a JS FLIP over a hundred rows does.
- **How:** ```ts
export function withReorder(update: () => void) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduce || !document.startViewTransition) return update()
  document.startViewTransition(() => flushSync(update))
}
```
```css
.feed > li { view-transition-name: match-element; }   /* Baseline Oct 2025 */
::view-transition-group(*) {
  animation-duration: var(--dur-2);
  animation-timing-function: var(--ease-out);
}
::view-transition { pointer-events: none; }           /* clicks reach the live page */
/* anchor the chrome: the nav and filter bar must not slide */
::view-transition-group(site-header),
::view-transition-group(filter-bar) { animation: none; z-index: 100; }
::view-transition-old(site-header),
::view-transition-old(filter-bar) { display: none; }
```
with `view-transition-name: site-header` on the sticky nav and `filter-bar` on the Discover filter bar. For browsers without `match-element`, fall back to `style={{ viewTransitionName: \`row-${project.id}\` }}`.
- **Where:** Discover sort/filter changes (surface 2, filters are URL searchParams so the update is a router navigation — wrap the `router.replace` in the same helper), the dashboard suggestion tracker's "Move to…" menu and drag drop (surface 5), and inbox sorting.
- **Risk:** Duplicate `view-transition-name` values silently skip the whole transition (`ready` rejects) — this is why `match-element` is worth the Baseline-2025 dependency. The snapshot freezes the page, so a transition longer than ~200ms starts to feel like an outage; the `::view-transition-group(*)` duration override is what keeps a UA default from creeping past the ceiling, and it is grep-checkable. Do not add the blur keyframe from Next's guide (§6.3 bans animating `filter`). Anchoring the chrome is not optional: a sticky nav that slides during a re-sort destroys the user's only fixed reference point.

### Sheet curve borrowed from iOS, at Whetstone's duration, not iOS's
- **What:** For the one surface that behaves like a physical sheet — the Discover filter drawer on mobile — use `cubic-bezier(0.32, 0.72, 0, 1)`, the curve Vaul takes from Ionic to match the iOS sheet, run at 240ms in / 160ms out rather than Vaul's 500ms.
- **Why it reads expensive:** That curve is the reason a sheet feels weighted rather than merely fast: it leaves immediately and settles very slowly at the end, without any overshoot. Every control point is inside [0,1], so it is not a spring and does not bounce — it is legal under the ban on overshoot easings, unlike the `cubic-bezier(0.34, 1.56, 0.64, 1)` family. At 240ms it reads as the same gesture iOS makes, compressed to a product that must not spend 500ms on a filter panel.
- **How:** Add one token beside the three in §6.1 and record the deviation in /design/direction.md (or reuse `--ease-out`, which is the safer no-deviation option and is close in character):

```css
--ease-sheet: cubic-bezier(0.32, 0.72, 0, 1);
```
```css
.drawer {
  transform: translateY(100%);
  transition: transform var(--dur-exit-3) var(--ease-in),
              overlay var(--dur-exit-3) allow-discrete,
              display var(--dur-exit-3) allow-discrete;
}
.drawer[open] {
  transform: translateY(0);
  transition: transform var(--dur-3) var(--ease-sheet),
              overlay var(--dur-3) allow-discrete,
              display var(--dur-3) allow-discrete;
}
@starting-style { .drawer[open] { transform: translateY(100%); } }
```
- **Where:** src/components/ui/drawer.tsx — the Discover filter rail below 60rem (surface 2). Nowhere else: the composer dialog keeps `--ease-out`, so the sheet curve stays a signal that this object is draggable.
- **Risk:** Introducing a fourth easing token is a contract deviation under §0/§6.1 and must be logged in /design/direction.md with its one-line reason, or the Finish Gate fails. Do not carry the 500ms — the ceiling is absolute. And do not generalise the curve to buttons or menus; its extremely slow settle only reads correctly on an object large enough to have mass.

### Direct-manipulation handoff: pointer capture, transition removed during drag, velocity-based release
- **What:** While a finger or cursor is down on the drawer handle or a tracker card, the element tracks the pointer 1:1 with no transition at all, its transform written imperatively; over-drag past the edge is damped rather than hard-stopped; on release, the transition is restored and the outcome is decided by distance OR velocity, so a fast flick dismisses without reaching the threshold.
- **Why it reads expensive:** Leaving a transition on during a drag introduces a constant lag between the pointer and the object — the single most common reason a hand-built drawer feels cheap next to an OS sheet. Pointer capture is what keeps the drag alive when the pointer leaves the element's box mid-gesture. Velocity-based release is what lets an experienced user flick a filter drawer shut in 80ms instead of dragging it two-thirds of the way down every time.
- **How:** ```ts
let startY = 0, startT = 0, dragging = false
function onPointerDown(e: React.PointerEvent<HTMLElement>) {
  const el = e.currentTarget
  el.setPointerCapture(e.pointerId)
  el.style.transition = 'none'
  startY = e.clientY; startT = performance.now(); dragging = true
}
function onPointerMove(e: React.PointerEvent<HTMLElement>) {
  if (!dragging) return
  const dy = e.clientY - startY
  // damp the direction the sheet cannot travel; resistance grows with distance
  const y = dy < 0 ? dy / (1 + Math.abs(dy) / 200) : dy
  e.currentTarget.style.transform = `translateY(${y}px)`
}
function onPointerUp(e: React.PointerEvent<HTMLElement>) {
  const el = e.currentTarget; dragging = false
  const dy = e.clientY - startY
  const velocity = Math.abs(dy) / (performance.now() - startT)   // px per ms
  el.style.transition = ''            // hand control back to the CSS in technique 11
  el.style.transform = ''
  if (dy > el.offsetHeight * 0.25 || velocity > 0.11) close()
}
```
The `0.11` threshold is Sonner's published dismissal velocity. Write the transform directly on the dragged element rather than through a custom property, which is what Vaul does to avoid a style recalculation cascading through every child on each pointermove.
- **Where:** drawer.tsx (Discover filter sheet) and the dashboard suggestion tracker's drag (surface 5).
- **Risk:** SC 2.5.7 means drag can never be the only path: the tracker's per-item "Move to…" menu and the drawer's close button are mandatory, not optional. Ignore every pointer after the first (`if (dragging) return` on a second pointerdown) or a second finger teleports the sheet. Reset `el.style.transition` in a `pointercancel` handler too, or a cancelled gesture leaves the element permanently untransitioned. Do not extend drag-to-dismiss to toasts without also giving them a visible dismiss button.

### Spinner appearance delay in CSS, not in a setTimeout
- **What:** The contract's "spinner only after 150ms" rule is implemented with `opacity: 0` plus a 1ms animation on a 150ms delay, so a request that resolves in 90ms never paints a spinner at all and never schedules a timer that can leak.
- **Why it reads expensive:** A spinner that flashes for two frames on a fast request makes a fast product look unreliable. Doing the delay in CSS means it costs nothing, cannot race with an unmount, and cannot be forgotten at a call site — the delay lives with the component, not with each caller.
- **How:** ```css
.spinner {
  opacity: 0;
  animation: spinner-appear 1ms linear 150ms forwards;
}
@keyframes spinner-appear { to { opacity: 1 } }
```
The rotation itself stays a separate infinite animation carrying `data-motion="functional"` (technique 3) so the reduced-motion reset does not freeze it. The second half of the contract's rule — minimum 300ms visible once shown — does need state, but only a single `useRef<number>` recording `performance.now()` on first paint and a `Math.max(0, 300 - elapsed)` deferral before hiding; do not reach for a library.
- **Where:** src/components/ui/spinner.tsx, used by the composer submit button and any in-flight Server Action across surfaces 2, 3, 4 and 5.
- **Risk:** `animation-delay` is not touched by the global reduced-motion reset (which sets duration and iteration-count), so the delay survives correctly — but the 1ms duration becomes 0.01ms, which is harmless here and would not be harmless if you ever put real motion in `spinner-appear`. Keep the appear animation a pure opacity step. The spinner must still be accompanied by copy naming what is loading (§5.4); the delay does not exempt it.


---

## research:craft-details

**Sources read:**
- https://raw.githubusercontent.com/raunofreiberg/interfaces/main/README.md
- https://vercel.com/design/guidelines
- https://developer.chrome.com/blog/css-text-wrap-balance
- https://developer.chrome.com/blog/css-text-wrap-pretty
- https://developer.chrome.com/blog/css-text-box-trim
- https://www.joshwcomeau.com/animation/css-transitions/
- https://www.joshwcomeau.com/css/designing-shadows/
- https://emilkowal.ski/ui/great-animations
- https://emilkowal.ski/ui/you-dont-need-animations
- https://raw.githubusercontent.com/emilkowalski/skills/main/skills/emil-design-eng/SKILL.md
- https://rauno.me/craft/interaction-design
- https://annualbeta.com/blog/1px-hairline-css-borders-on-hidpi-screens/
- https://linear.app/now/how-we-redesigned-the-linear-ui
- https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-gutter

### Suppress every transition during a theme flip
- **What:** When the user toggles dark/light, the contract's 120ms background-color and border-color transitions fire on every element at once, producing a smeary cross-fade where hundreds of elements arrive at slightly different times. Kill all transitions for exactly one frame around the attribute swap so the theme change is instantaneous and total.
- **Why it reads expensive:** The theme toggle is the single most-screenshotted interaction in a dark-first product, and a smeared flip is the loudest cheap tell there is. Rauno's guidelines list it as a discrete rule: 'Switching themes should not trigger transitions and animations on elements.' A hard cut reads as a compiled app repainting; a 120ms colour crossfade reads as a web page.
- **How:** In app/globals.css, mirroring the existing reduced-motion reset so the !important precedent is already set by the contract (§6.4):

:root[data-theme-switching] *,
:root[data-theme-switching] *::before,
:root[data-theme-switching] *::after {
  transition: none !important;
  animation: none !important;
}

In the toggle (a client component):

function setTheme(next: "dark" | "light") {
  const root = document.documentElement;
  root.setAttribute("data-theme-switching", "");
  root.setAttribute("data-theme", next);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    root.removeAttribute("data-theme-switching");
  }));
}

Belt-and-braces: also clear the attribute from a 200ms setTimeout stored in a ref and cleared on unmount, so a backgrounded tab that never fires rAF cannot leave the app permanently motionless.
- **Where:** The theme toggle wherever it lives in the app nav (surfaces 2–9) and the landing footer (surface 1). Global rule in app/globals.css.
- **Risk:** If the attribute is never removed, every transition in the product dies silently and nothing errors. The rAF path does not run in a backgrounded tab, hence the timeout fallback. Do not fold this into the reduced-motion reset selector or you double-specify.

### text-wrap: balance on headings, pretty on prose, neither on clamped rows
- **What:** Two one-line declarations that remove ragged headline breaks and single-word orphans. `balance` distributes a heading evenly across its lines (six lines max, by spec); `pretty` fixes orphans and rag in body copy.
- **Why it reads expensive:** Whetstone's headline device is the Archivo width axis at wdth 108–112, which makes headings wider per character and therefore far more likely to break badly. A two-line h2 whose second line is one word is the difference between typeset and typed. Chrome's own guidance is 'balance for headlines and pretty for paragraphs'.
- **How:** app/globals.css:

h1, h2, h3, h4, h5, h6, blockquote, figcaption { text-wrap: balance; }
.prose p, .prose li, .empty-state p, .helper-text, .error-text { text-wrap: pretty; }

Two exclusions that matter here:
1. The landing hero h1 is excluded. It runs inside `contain: layout paint` with `min-inline-size` reserved at the wdth 118 measurement (§6.2); re-balancing can change the line count and defeat the zero-CLS reservation. Break the hero by hand.
2. Keep `pretty` off the Discover row ask, which is `-webkit-line-clamp: 2` — pretty changes where the rag falls and can change which word becomes the clamp point between engines.

Both properties are no-ops where unsupported, so no @supports guard is needed. Support: balance Chrome/Edge 114+, Firefox 121+, Safari 17.5+; pretty Chrome 117+.
- **Where:** All headings on all nine surfaces (h2 at wdth 108 and h1 at wdth 112 benefit most). `pretty` goes on Literata bodies: the ask and project description (surface 3), feedback bodies (surfaces 3–5), discussion posts (surface 8), reviewer bios (surfaces 6–7), plus the three-beat empty-state copy and helper/error text at 58ch everywhere.
- **Risk:** `balance` is spec-limited to ≤6 lines, so a long h1 at 320px silently stops balancing — verify at the 320/375 gate widths rather than assuming. Chrome's article also warns that balanced text inside a bordered container can look visually imbalanced against the box; check the info callout on surface-wash specifically.

### Reserve the bench: design the sparse state, not only the empty state
- **What:** A hairline-ruled row list with one or two rows in it looks broken in a way a card grid does not, because the ruling simply stops a third of the way down and the page collapses to a stub. Give every ruled list a reserved minimum height of three rows plus a closing hairline, and centre the empty/sparse copy inside that reserved block.
- **Why it reads expensive:** Vercel's guidelines call for designing 'empty, sparse, dense, and error states' as four separate states, not two. Whetstone's whole structural bet is rows-not-cards, and rows are exactly the grammar that falls apart at n=1. Getting the three-row-tall state right is what makes a brand-new account look like a real product rather than a seeded demo.
- **How:** Give the row height a token and reuse it three ways (skeleton, sparse floor, contain-intrinsic-size):

:root { --row-h: 4.5rem; }
.bench {
  min-block-size: calc(3 * var(--row-h));
  border-block-end: var(--hairline) solid var(--color-border-hair);
  display: grid;
  align-content: start;
}
.bench-empty {
  display: grid; place-content: center; gap: var(--space-sm);
  min-block-size: calc(3 * var(--row-h));
}

The empty block still ships the contract's three beats (§7.1.5) and one verb button; this only fixes its geometry. Do NOT draw empty ruling with `repeating-linear-gradient` — ban-list item 7 forbids gradients as decoration. If you want visible empty rules, render real `<li aria-hidden="true" class="rule-only">` elements carrying nothing but the border, or settle for the single closing hairline.
- **Where:** Discover feed `<ul>` (surface 2), the dashboard inbox `<table>` and suggestion tracker columns (surface 5), the project-detail feedback thread (surface 3), the discussions row register (surface 8), the profile project list (surface 6).
- **Risk:** Reserving three rows costs nothing on a usually-long list, but on the tracker columns it can push the board past the fold at 1280×800 — measure. Do not reach for nested `:has()` chains on the same subtree to detect sparseness; a server-rendered row count is cheaper and more predictable.

### text-box: trim-both cap alphabetic on chrome type
- **What:** CSS half-leading puts invisible space above and below every line box, so a 'centred' chip label is never actually centred on its cap height and an icon set to the same box as its label never lines up. `text-box-trim` removes that space and lets you centre on real letterforms.
- **Why it reads expensive:** This is the largest single source of the one-to-two-pixel wrongness that makes hand-built primitives look hand-built. Whetstone runs three families with very different metrics (Archivo wdth 87 chips, Literata opsz 17 prose, JetBrains Mono in code), so half-leading differs per element and no fixed padding fix works across all three. Trim makes symmetric padding actually look symmetric — exactly the alignment work Linear describes as 'something that you'll feel after a few minutes'.
- **How:** @supports (text-box: trim-both cap alphabetic) {
  .chip, .btn, .tab, .grit-chip, th, .count, .metadata dt, .metadata dd {
    text-box: trim-both cap alphabetic;
  }
}

Once trimmed, stop hand-tuning block padding and centre geometrically instead:
.chip { display: grid; place-items: center; block-size: 1.75rem; padding-inline: var(--space-xs); }
.btn  { display: grid; place-items: center; block-size: 2.75rem; padding-inline: var(--space-md); }

Scope it away from form controls. §5.5 defines input vertical padding as (height − line-height-px)/2; trimming changes that arithmetic, so leave `<input>`, `<select>`, `<textarea>` untrimmed and keep the documented formula. Support: Chrome/Edge 133+, Safari 18.2+, Firefox 154+; unsupported browsers fall back to today's look, so this is pure progressive enhancement.
- **Where:** Grit chips and hatch labels (--text-2xs, wdth 87), dashboard table column heads (surface 5), buttons, tabs, the Discover row metadata `<dl>` (surface 2), feedback counts, the marketplace price in --text-lg tabular-nums (surface 7).
- **Risk:** Trim plus a fixed `block-size` will clip descenders if you also set `overflow: hidden` — do not. In Firefox <154 the untrimmed fallback runs ~1–2px looser; if you tune padding to the trimmed result the fallback looks bottom-heavy. Use the fixed-height `place-items: center` form above, which degrades gracefully in both.

### True hairlines on HiDPI, for decorative rules only
- **What:** `border: 1px` resolves to 2 device pixels on a 2× display and 3 on a 3×, so the hairline carrying Whetstone's entire structure renders about twice as heavy as intended on every modern laptop. Step the decorative hairline to 0.5px behind a resolution media query.
- **Why it reads expensive:** The design's premise is 'hairline-ruled rows instead of floating cards'. If the rule is visually 2px, the page reads as a bordered table, not a bench. Native macOS and iOS have used a true one-device-pixel separator for over a decade; matching it is most of why native chrome looks finer than web chrome. The annualbeta article documents the problem and the original transform-scale workaround; the 0.5px media query is the modern simplification of it, and that simplification is my adaptation rather than the article's recommendation.
- **How:** :root { --hairline: 1px; }
@media (min-resolution: 2dppx) { :root { --hairline: 0.5px; } }

.feed > li + li,
.thread > li + li,
.rule { border-block-start: var(--hairline) solid var(--color-border-hair); }

Apply to `--color-border-hair` ONLY. Every `--color-border-control` edge stays a full 1px: §5.2 says border width never changes between states, and those edges must remain perceivable at ≥3:1 for SC 1.4.11. This varies width by device, not by state, so §5.2 is intact.
- **Where:** Every row separator on Discover (surface 2), discussions (surface 8), the profile project list (surface 6) and the feedback thread (surface 3); the landing `<figure>` border (surface 1); the one-line app footer rule; the dashboard zebra boundary (surface 5).
- **Risk:** 0.5px can round to nothing at some browser/zoom combinations, and at 200% text zoom (gate line 17) physical rendering changes — screenshot at 1×, 2× and 200% before committing. border-hair is already only 1.58:1 in dark, so halving it may push the ruling below perceptual visibility on a dim screen; if so keep 1px and record the decision rather than reaching for a brighter token.

### Native-surface plumbing: color-scheme, ::selection, theme-color, dark-only smoothing
- **What:** Four declarations that make the browser's own chrome agree with the page: scrollbars and native form controls repaint for the theme, text selection uses the accent instead of OS blue, the mobile URL bar matches the ground, and text rendering is tuned per theme.
- **Why it reads expensive:** A default-blue selection highlight on a #141D20 ground, or a light scrollbar track in a dark app, are the two commonest places a careful dark theme leaks. Rauno's list calls for styling `::selection`; Vercel's calls for `color-scheme: dark` on `<html>` and a `<meta name="theme-color">`. Each is one line and each removes a visible seam.
- **How:** app/globals.css:
:root { color-scheme: dark; -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; }
:root[data-theme="light"] { color-scheme: light; -webkit-font-smoothing: auto; }
@media (prefers-color-scheme: light) { :root:not([data-theme="dark"]) { color-scheme: light; -webkit-font-smoothing: auto; } }
::selection { background-color: var(--color-accent); color: var(--color-accent-ink); }

The dark-only `antialiased` is deliberate: subpixel-antialiased light-on-dark renders too heavy, grayscale-antialiased dark-on-light renders too thin. Contrast is already proven — accent-ink #07161E on accent #66ACE2 is 7.50 (§2.2).

theme-color needs care: ban-list 13 and gate line 9.1.1 forbid hex in .ts/.tsx, so do NOT use Next's `export const viewport` with a literal. Ship a small client component that reads the live token:

useEffect(() => {
  const c = getComputedStyle(document.documentElement)
    .getPropertyValue("--color-surface-1").trim();
  let m = document.querySelector('meta[name="theme-color"]');
  if (!m) { m = document.createElement("meta"); m.setAttribute("name", "theme-color"); document.head.appendChild(m); }
  m.setAttribute("content", c);
}, [theme]);

If you prefer it in static HTML, that is a legitimate deviation — record it in /design/direction.md per §0.
- **Where:** Global. `color-scheme` matters most on the dashboard inbox scroll container (surface 5) and the composer `<dialog>` (surface 4); `::selection` matters most in Literata feedback bodies and discussion posts (surfaces 3, 8), where people select and quote constantly.
- **Risk:** `text-rendering: optimizeLegibility` has a history of forcing kerning/ligature work that costs layout time on long documents and has been buggy in older engines; if a thread ever renders thousands of Literata paragraphs, drop it and keep only the smoothing line. A stale theme-color after a client-side toggle is worse than none — key the effect on the theme value.

### The row owns its rule, and hover paints inside it
- **What:** Draw separators with `li + li { border-block-start }` rather than `li { border-bottom }`, and give rows `background-clip: padding-box` so a hover fill never bleeds under the hairline.
- **Why it reads expensive:** Two specific defects disappear. First the orphan rule: `border-bottom` on every row leaves a hairline hanging under the last row that either doubles with the container's own edge (a visible 2px line) or floats alone with nothing beneath it. Second the smear: with the default `background-clip: border-box`, the hover surface step paints under the semi-transparent-looking hairline and the separator appears to dim as the cursor passes — the kind of flicker you notice on the four-hundredth pass but cannot name. Vercel's guidelines frame this as combining border and fill deliberately rather than stacking them.
- **How:** .feed, .thread, .discussions { list-style: none; margin: 0; padding: 0; }
.feed > li { background-clip: padding-box; border-radius: var(--radius-md); }
.feed > li + li { border-block-start: var(--hairline) solid var(--color-border-hair); }

@media (hover: hover) and (pointer: fine) {
  .feed > li:hover { background-color: var(--color-surface-2); }
}

Because the rule now belongs to the following row, a row carrying the 2px accent grind-mark on its leading edge (§2.4.7) never fights a border on the same box. Keep the grind-mark as `border-inline-start: 2px solid var(--color-accent)` on the row itself, or an inset pseudo-element — not both. The dashboard table uses the same idea: `border-collapse: separate; border-spacing: 0; tr + tr > td { border-block-start: ... }`.
- **Where:** Discover feed rows (surface 2), discussion rows (surface 8), the profile project list (surface 6), the feedback thread (surface 3), the dashboard inbox table (surface 5).
- **Risk:** With `li + li` the first row has no top rule, so if the list sits directly under the sticky filter bar you need the bar's own bottom hairline to close the gap, or there is a visible missing line at the top of the feed. `background-clip: padding-box` has no effect on a row with no padding, so keep the row's inline padding.

### scrollbar-gutter: stable plus overscroll-behavior: contain on every scroll container
- **What:** Reserve scrollbar space in advance so content does not jump sideways the moment a list crosses the overflow threshold, and stop wheel/trackpad momentum from chaining out of a modal into the page behind it.
- **Why it reads expensive:** The horizontal jolt when a filtered feed gains its fourteenth row is a pure web artifact native apps do not have; MDN describes `stable` as existing precisely to prevent that shift. Scroll-chaining is the other half: reaching the bottom of a 66ch textarea in the composer `<dialog>` and continuing to scroll currently drags the Discover feed underneath, which instantly reveals the modal as an overlay rather than a surface.
- **How:** .scroll-y, dialog .dialog-body, .inbox-scroll, .thread-col {
  overflow-y: auto;
  scrollbar-gutter: stable;
  overscroll-behavior: contain;
}

`stable` is Baseline as of December 2024. On macOS overlay scrollbars it reserves nothing (correct); on Windows classic scrollbars it reserves roughly 15px permanently, so re-measure the 66ch prose and 58ch UI caps inside those containers at 960px and 1280px after enabling it. Use `stable both-edges` only where content is genuinely centred — in Whetstone that is nowhere, since every surface is left-aligned by §4.4.
- **Where:** Composer `<dialog>` body and the Literata textarea (surface 4), dashboard inbox scroller and tracker columns (surface 5), project-detail feedback thread column (surface 3), the Discover filter drawer `<dialog>` below 60rem (surface 2).
- **Risk:** `overscroll-behavior: contain` is correct for a modal and wrong for an inline panel — a short modal can feel stuck if the user expected the page to move. Never put it on `body`: the contract already constrains `html`/`body` to `overflow-x: clip` (gate line 18), and overscroll rules there affect Android pull-to-refresh.

### Move the hover transform to an inner face so the button box never moves
- **What:** The contract gives buttons `translateY(-1px)` on hover and `translateY(1px)` on press. If the transform sits on the button itself, the hover target physically moves out from under a cursor resting on its edge, un-triggering the hover, which re-triggers it — Josh Comeau's 'doom flicker'. Nest a face element: the outer box is the stationary trigger, the inner span does the moving.
- **Why it reads expensive:** It is one of the few interaction bugs a user feels a hundred times a day without ever consciously diagnosing. It also protects the 44×44px hit area — a target that shifts by a pixel at its own boundary is a target whose measured size is a lie, which matters directly at gate line 26.
- **How:** <button class="btn"><span class="btn-face">Post feedback</span></button>

.btn { display: grid; place-items: center; block-size: 2.75rem; padding-inline: var(--space-md);
       border: 1px solid var(--color-border-control); border-radius: var(--radius-sm);
       background-color: var(--color-surface-2); color: var(--color-text-1);
       transition: background-color var(--dur-1) var(--ease-out),
                   border-color var(--dur-1) var(--ease-out); }
.btn-face { display: block; white-space: nowrap; user-select: none;
            transition: transform var(--dur-exit-1) var(--ease-in); }

@media (hover: hover) and (pointer: fine) {
  .btn:hover { border-color: var(--color-border-strong); background-color: var(--color-surface-3); }
  .btn:hover .btn-face { transform: translateY(-1px);
                         transition: transform var(--dur-1) var(--ease-out); }
}
.btn:active .btn-face { transform: translateY(1px); transition-duration: 90ms; }

The asymmetry (120ms in via --dur-1, 80ms out via --dur-exit-1) is already the contract's; it now lands on the right element. `user-select: none` on the face is Rauno's rule for interactive inner content. The focus ring stays on `.btn` with zero transition (§5.4).
- **Where:** Every button on all nine surfaces. Rows, cards and grid items still never transform (§5.4) — this is buttons only.
- **Risk:** Two boxes means two places to get the hit area wrong; keep padding and height on `.btn` and let `.btn-face` be a bare block with no box of its own. Do not also transition `background-color` on `.btn-face` — ban-list 37 forbids more than one simultaneous hover effect on an element.

### Enter direction follows resolved placement for popovers and dropdowns
- **What:** The contract's popover entrance is `translateY(4px → 0)`, which is correct for a popover that opens below its trigger and backwards for one that flips above when there is no room. Set the enter offset from the resolved placement so the panel always grows away from the thing that spawned it.
- **Why it reads expensive:** Emil Kowalski's rule is that a thing exits the way it entered and animates from its trigger, not from an abstract centre; Vercel states the same idea as 'transform-origin anchored to motion start point'. A dropdown that flips above the trigger near the viewport bottom but still slides downward reads, subliminally, as arriving from the wrong place — the difference between a menu that feels attached and one that feels pasted on.
- **How:** Using the native Popover API that §0.13 already prescribes:

[popover] { --enter-y: 4px; }
[popover][data-side="top"]    { --enter-y: -4px; }
[popover][data-side="bottom"] { --enter-y: 4px; }

@media (prefers-reduced-motion: no-preference) {
  [popover]:popover-open { animation: pop-in var(--dur-2) var(--ease-out); }
  @keyframes pop-in { from { opacity: 0; transform: translateY(var(--enter-y)); } }
}

Set data-side in the same measurement pass that decides the flip (one getBoundingClientRect before showPopover), or derive it from `position-try-fallbacks` if you use CSS anchor positioning. Exit is 120ms via --dur-exit-2 with the same offset sign. No scale is added — §6.2 specifies opacity + translateY for this class and that stays.
- **Where:** The Discover sort menu and filter rail sub-menus (surface 2), the tracker's 'Move to…' menu (surface 5), the grit-selector popover in the composer (surface 4), the account menu in the app nav.
- **Risk:** A stale `data-side` set once and never updated after a resize or scroll is worse than no rule, because the animation then contradicts the position on every subsequent open — recompute per open. Measure the trigger, never the popover, or you force a reflow before paint.

### Tooltip group timing: delay the first, then no delay and no animation
- **What:** A tooltip group shares one timer. The first tooltip opens after a short delay; while the group is warm, moving to a sibling trigger opens instantly with animation duration set to zero. Keyboard focus always opens instantly with no delay.
- **Why it reads expensive:** Both Vercel's and Emil's writing name this exact pattern ('delay the first tooltip; subsequent tooltips in the group appear without delay'; 'skip animation on subsequent hovers — set transition-duration: 0ms'). Sweeping across a toolbar and watching each tooltip independently fade in is the clearest signal a tooltip was installed rather than designed. It also satisfies ban-list 46, which forbids equal hover and focus delays.
- **How:** A tiny provider holding refs, no state, so nothing re-renders:

const warm = useRef(false);
const timer = useRef<number | null>(null);
const OPEN_DELAY = 320;    // hover, cold
const WARM_WINDOW = 400;   // grace after the last close

function onPointerEnter() {
  if (warm.current) return setOpen(true);              // instant
  timer.current = window.setTimeout(() => setOpen(true), OPEN_DELAY);
}
function onFocus() { setOpen(true); }                   // always instant
function onClose() {
  warm.current = true;
  timer.current = window.setTimeout(() => { warm.current = false; }, WARM_WINDOW);
}
useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

.tooltip[data-warm="true"], .tooltip[data-trigger="focus"] { animation: none; }

320ms and 400ms are delays, not animations, so the 400ms ceiling in §6.1 is untouched and both pass the gate's `[4-9][0-9]{2}ms` grep. Tooltips carry no interactive content (Rauno's rule), and disabled controls get no tooltip at all — the reason goes in the helper slot, which §5.4 already requires.
- **Where:** The grit chip on every Discover row (surface 2) and the 5-cell grit history strip (surface 6), the dashboard rollup segments (surface 5), icon-only controls in the app nav.
- **Risk:** Every timer must be cleared on unmount or §8.6.53 fails ('a useEffect that times without a cleanup'). A warm flag leaking across unrelated groups makes a distant tooltip fire instantly and reads as a bug — scope the ref to one provider per toolbar or row.

### Menus open on pointerdown, not click
- **What:** A menu that opens on `click` waits for mouseup, so it opens on release. Opening on pointerdown makes it appear under the finger the instant the button goes down, which is what every native menu bar does.
- **Why it reads expensive:** Rauno's guidelines state it flatly: 'To open immediately on press, dropdown menus should trigger on mousedown, not click.' The perceived latency difference is the full duration of the user's own press — typically 60–120ms of felt lag no amount of animation tuning recovers. Emil's frequency argument reinforces it: high-frequency controls should lose motion and gain immediacy, not the reverse.
- **How:** onPointerDown={(e) => {
  if (e.button !== 0 || e.ctrlKey) return;   // let right-click and ctrl-click pass through
  e.preventDefault();                        // keeps focus on the trigger, blocks text selection
  setOpen((o) => !o);
}}
onKeyDown={(e) => {
  if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
    e.preventDefault(); setOpen(true);
  }
}}

Because preventDefault on pointerdown suppresses the following click, remove any onClick handler or you get a double toggle. The keyboard contract is unchanged and must still be documented in the file header per gate line 50: Enter/Space/ArrowDown open, Escape closes and restores focus to the trigger, Home/End jump, roving tabindex inside. Pair with `touch-action: manipulation` on the trigger to kill the double-tap delay, and keep hover states inside `@media (hover: hover) and (pointer: fine)` so a touch press never paints a hover state.
- **Where:** The Discover sort control and filter chips (surface 2), the 'Move to…' menu on every tracker item (surface 5, which SC 2.5.7 requires to exist anyway), the account menu in the app nav.
- **Risk:** pointerdown-to-open breaks a press-drag-release selection gesture and fires on a press the user intended as the start of a drag — irrelevant for these three menus, fatal on a drag handle. Never use it for a destructive control, where Vercel's guidance is confirmation or undo.

### content-visibility on feed rows, sized by the same row token as the skeleton
- **What:** Let the browser skip layout and paint for rows below the fold, with an intrinsic size hint so the scrollbar stays honest. Reuse the exact `--row-h` value the loading skeleton and the sparse-state floor already use.
- **Why it reads expensive:** First paint on a long Discover feed stops being proportional to row count. Vercel's guidelines list `content-visibility: auto` as the CSS-only alternative to list virtualisation, which matters here because ban-list 54 forbids the usual libraries. The second-order benefit is the one you feel daily: scrolling a 200-row feed stays at frame rate instead of degrading, which is the difference between a feed and a document.
- **How:** :root { --row-h: 4.5rem; }

.feed > li {
  content-visibility: auto;
  contain-intrinsic-size: auto var(--row-h);
}

The craft point is that one token drives all three states:
.skeleton-row { block-size: var(--row-h); border-radius: var(--radius-md); }  /* geometry matches the real row, per §5.4 and Vercel's 'skeletons mirror final content exactly' */
.bench { min-block-size: calc(3 * var(--row-h)); }

Use `auto` in `contain-intrinsic-size: auto <len>` so the browser remembers each row's measured height after it has rendered once, which keeps the scrollbar from twitching as you scroll back up.
- **Where:** Discover feed `<li>` (surface 2), discussion rows (surface 8), dashboard inbox `<tr>` (surface 5), the profile project list (surface 6).
- **Risk:** Do not apply it to the first screenful — a row containing the LCP image must render eagerly, and gate line 55 requires `fetchpriority="high"` there. Off-screen `auto` subtrees are skipped by some in-page operations in some engines: test Cmd-F find-in-page and anchor links into the thread before shipping. Never apply it inside a `<dialog>`.

### Optical nudges expressed in em, applied to icon and numeral lockups
- **What:** Phosphor glyphs are drawn in a square box; Archivo cap height is not square. Set at the same nominal size, an icon beside a label sits fractionally low, and a directional glyph (caret, chevron, play) sits fractionally left of where the eye puts it. Correct with a small translate expressed in em, so the correction scales with the 16/20/24 sizes rather than being right at exactly one of them.
- **Why it reads expensive:** Vercel's layout section names this directly — 'adjust ±1px when visual perception differs from geometric precision' and 'every element aligns with something intentionally'. Linear describes their own redesign as largely this work: aligning labels, icons and buttons within the sidebar and tabs, which they say 'you'll feel after a few minutes'. Invisible individually, unmistakable in aggregate. (The em-versus-px framing is my own reasoning; Vercel's text says ±1px.)
- **How:** .lockup { display: inline-grid; grid-auto-flow: column; align-items: center; gap: var(--space-xs); }
.lockup > svg { flex: none; transform: translateY(-0.03em); }          /* cap-height alignment */
.lockup > svg[data-dir] { transform: translate(0.02em, -0.03em); }     /* directional glyphs lean into their point */

Three Whetstone-specific applications:
1. The 2px accent grind-mark sits on the row's border box, flush with the ruling, not inset by the row's inline padding — otherwise it reads as floating.
2. Grit chip numerals already set `font-feature-settings: 'zero' 1` and tabular-nums; add `text-box: trim-both cap alphabetic` (technique 4) so the numeral centres on cap height rather than the line box — that is what makes 120 and 8000 sit at the same optical height in the same chip.
3. The SVG hatch in the 3rem bevel rail aligns to the ask's first baseline, not to the top of the column.

If you ever transform an SVG group, set `transform-box: fill-box; transform-origin: center;` — Vercel's guidelines flag that Safari miscalculates the origin otherwise.
- **Where:** Every icon-plus-label lockup in the app nav, buttons and chips; the grit chip on Discover rows (surface 2); the bevel rail on project detail (surface 3); the feedback-count glyph in the Discover metadata `<dl>`; the 5-cell grit history strip (surface 6).
- **Risk:** This is judgement work and easy to over-apply: a nudge on an already-correct pair makes things worse, and a nudge in px makes the 24px icon right and the 16px icon wrong. Nudge only lockups you have looked at against a cap-height guide, and never nudge anything that moves a hit target's visual centre away from its 44px box.

### Concentric radii and focus-within contrast escalation on field groups
- **What:** Two small rules. First, an inner radius equals the outer radius minus the inset between them, so nested corners stay concentric instead of running parallel with a visible pinch. Second, a field group raises its own label's contrast on `:focus-within`, so the active field is legible before the user hunts for the ring.
- **Why it reads expensive:** Vercel's design section states both: 'child radius ≤ parent radius, concentric alignment' and ':hover, :active, :focus states have higher contrast than rest', with the rationale that escalating contrast is what signals interactivity. Whetstone has a six-value radius scale precisely so radii are hierarchical, and the composer is the surface where a mismatched inner corner is unmissable.
- **How:** Radius rule: inner = outer − inset, snapped down to the nearest value on the closed scale. In the composer the dialog is --radius-lg (14px) and the sticky footer must carry the dialog's own bottom corners, not its own:

dialog { border-radius: var(--radius-lg); overflow: clip; }
dialog .sticky-footer { border-end-start-radius: var(--radius-lg);
                        border-end-end-radius: var(--radius-lg); }

The 48px Discover thumbnail at --radius-xs (2px) inside a --radius-md (8px) row is already correct, because the row's 12px padding makes 8 − 12 < 0 and any small value is concentric-neutral — that is a check to run, not a value to change.

Contrast escalation, adding no new token and no second indicator:
.field > label { color: var(--color-text-2); transition: color var(--dur-1) var(--ease-out); }
.field:focus-within > label { color: var(--color-text-1); }
.field:focus-within .hatch { color: var(--color-border-strong); }

The straw focus ring is untouched: still instant, still zero transition (§5.4).
- **Where:** The composer dialog, its five category panels and sticky footer (surface 4); the auth form's 24rem column (surface 9); the Discover filter rail's grouped controls and its `<dialog>` drawer (surface 2).
- **Risk:** `overflow: clip` on a `<dialog>` clips any popover that is a DOM child of it — the grit selector must live in the top layer via the Popover API, not as an absolutely-positioned child, or it is cut off. And the focus-within label change must never touch font-weight: Rauno's rule is that weight must not change on state, because it shifts layout.


---

