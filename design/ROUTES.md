# routes

> Complete information architecture, route map, auth/session model, middleware + rate-limiting strategy, Zod contracts for all 60 API route handlers, and a 44-component UI primitive catalog for Whetstone — a Next.js 15 App Router / React 19 / Tailwind v4 / TypeScript app. 57 page routes across 3 route groups ((marketing), (auth), (app)), each specified with rendering mode, data dependencies, auth requirement, and empty/loading/error states. Aligns with the existing scaffold in src/lib/auth.ts (jose HS256 + scrypt + httpOnly ws_session cookie) and src/server/db/client.ts (node:sqlite, WAL, sync tx helper).

# Whetstone — Information Architecture & Route Map

*Next.js 15 App Router · React 19 · Tailwind CSS v4 · TypeScript · SQLite (`node:sqlite`) · jose + scrypt · zero component libraries*

---

## 0. Global architecture decisions

These decisions govern every route below; the per-route tables only note deviations.

**Rendering.** Every `page.tsx` is a **Server Component** unless listed otherwise. Interactivity is pushed into named **client islands** (`components/**/*.client.tsx`) that receive serialized props. No route is client-rendered end to end — not even the feedback composer, whose shell is server-rendered and whose form body is a client island.

**Mutation surface.** `/api/**` Route Handlers are the **single source of truth for every mutation**. A thin Server Action layer (`app/actions/*.ts`) exists only for progressive-enhancement forms (auth, composer, settings) and each action does nothing but call the same `src/server/services/*` function the route handler calls, then `revalidateTag`. There is never mutation logic that lives only in an action. Validation, authorization, and rate limiting live in the service layer, so both entrypoints get them.

**Data flow for filters.** Filter/sort/pagination state lives in `searchParams`, never in client state. A client `FilterBar` island calls `router.replace(?…, { scroll: false })` inside `useTransition`; the server re-renders the list. This makes every filtered view linkable, back-button-correct, and screen-reader-announceable via a single `aria-live="polite"` result-count region.

**Caching.** Marketing and legal routes are static (`export const revalidate = 3600`). Anything reading `cookies()` or `searchParams` is dynamic. Read paths go through `unstable_cache` keyed by tags: `project:{id}`, `feed`, `feedback:{projectId}`, `profile:{handle}`, `insights:{projectId}`, `discussion:{id}`, `notifications:{userId}`. Every mutation service calls `revalidateTag` for the tags it dirties before returning.

**Segment file convention.** Every dynamic segment ships four files:

```
page.tsx        server component
loading.tsx     skeleton matching the real layout's box model exactly (no layout shift)
error.tsx       'use client' — receives { error, reset }
not-found.tsx   only where a 404 is semantically distinct from an error
```

`app/global-error.tsx` is the last resort (renders its own `<html>`). `app/not-found.tsx` is the catch-all 404.

**Empty-state contract.** Every empty state has four parts and is implemented with the shared `<EmptyState>` primitive: an icon or line illustration, a one-line title stating the fact, a sentence explaining *why it's empty and what changes it*, and exactly one primary action (plus at most one secondary). Empty states are never a bare "No results."

**Error-state contract.** `error.tsx` boundaries render `<ErrorState>` with: a human title (never a stack trace), the `requestId` from the `x-request-id` header in small mono text for support, a `Try again` button wired to `reset()`, and a secondary escape hatch (back to the parent list). Expected-but-empty conditions (404, private project, deleted feedback) use `notFound()` / `<EmptyState>`, not the error boundary.

**Accessibility baseline (WCAG 2.2 AA).**
- `app/layout.tsx` renders a skip link (`href="#main"`) as the first focusable element; every layout's content region is `<main id="main" tabIndex={-1}>`.
- A `RouteAnnouncer` client island in the root layout watches `usePathname()` and writes the new page title into a visually-hidden `aria-live="assertive"` region, then focuses `#main` — this fixes the App Router's focus-loss-on-navigation problem.
- Theme: `data-theme` on `<html>` read from the `ws_theme` cookie in the root layout (server-side, so no flash). Tailwind v4 `@theme` tokens define both palettes; dark is the default when the cookie is absent and `prefers-color-scheme` is dark.
- `@media (prefers-reduced-motion: reduce)` collapses all `motion` transitions to opacity-only, ≤80 ms.
- Target size ≥ 24×24 CSS px (2.5.8), focus not obscured by sticky headers (2.4.11 — every sticky header sets `scroll-margin-top` on focusable descendants), no drag-only interactions (2.5.7 — the suggestion kanban has keyboard move commands and a "Move to…" menu alongside pointer drag), consistent help (3.2.6 — the help affordance sits in the same footer slot on every page), redundant entry avoided (3.3.7 — the review composer prefills context from the last review).

**Route groups.**

```
app/
  (marketing)/   public, static, marketing chrome (light-leaning hero, wide container)
  (auth)/        public, centered single-column, no app nav
  (app)/         authenticated-or-public product chrome (sidebar + topbar + command palette)
  api/           route handlers
```

---

## 1. Session & auth model

Built on the existing `src/lib/auth.ts`, extended.

**Password hashing.** `scrypt` (N=16384, r=8, p=1, keylen=64) with a 16-byte per-password random salt, stored as `scrypt$<saltHex>$<hashHex>`, compared with `timingSafeEqual`. Verification must run on the Node runtime (`node:crypto`), so every auth route handler declares `export const runtime = 'nodejs'`.

**Token.** HS256 JWT via `jose`, signed with `AUTH_SECRET`. Claims:

```ts
{
  sub: string   // user id
  handle: string
  sid: string   // session id — the revocation handle
  sv: number    // session version, bumped on password change / "sign out everywhere"
  iss: 'whetstone'
  aud: 'whetstone-web'
  iat, exp      // 30 days
}
```

**Cookie.** `ws_session`, `httpOnly`, `sameSite: 'lax'`, `secure` in production, `path: '/'`, `maxAge` 30 days. `lax` is correct here: all mutations are same-origin `fetch` with a `x-ws-csrf` header check, and `lax` keeps the session alive across inbound links from email and social.

**Two-tier verification — the important part.**

| Tier | Where | Runtime | Checks |
|---|---|---|---|
| Cheap | `middleware.ts` | edge | Signature + `exp` + `iss`/`aud` only. No DB. |
| Authoritative | `requireUser()` in RSC/handlers | node | Re-verifies, then loads `sessions` row by `sid`, asserts `revoked_at IS NULL` and `user.session_version === sv`, and touches `last_seen_at`. |

Middleware cannot reach SQLite, so it can never be the authority on revocation. Every protected page and every mutating handler calls `requireUser()`; middleware exists only to redirect early and avoid rendering a shell the user can't use.

**Sliding refresh.** If `exp - now < 7 days`, middleware re-signs with the same `sid`/`sv` and sets a fresh cookie on the response. A session that goes 30 days untouched expires.

**Revocation.** `POST /api/auth/password/change` and `DELETE /api/auth/sessions` bump `users.session_version`, invalidating every outstanding token on the next authoritative check. `/api/auth/sessions/[sessionId]` revokes one device.

**CSRF.** Double-submit: a non-`httpOnly` `ws_csrf` cookie (random 32 bytes, set alongside the session) plus a required `x-ws-csrf` header on every non-GET `/api/**` request, compared with `timingSafeEqual`. Requests missing or mismatching the header get `403 CSRF_FAILED`. A shared `apiFetch()` client helper attaches it automatically. Server Action submissions are exempt (Next's own action-origin check covers them).

**Header spoofing.** Middleware **strips any inbound `x-ws-*` headers first**, then sets `x-ws-uid` / `x-ws-handle` / `x-ws-sid` for downstream convenience. Downstream code treats these as a hint only — authorization always re-derives identity from the cookie via `requireUser()`.

**Password reset.** `password_reset_tokens(token_hash, user_id, expires_at, used_at)` — the token is 32 random bytes, base64url in the emailed link, and only its SHA-256 is stored. Single use, 30-minute TTL, invalidated by a successful sign-in or another reset request.

**Anonymous identity.** Reviewers may post feedback under a persistent pseudonym, but there is no true anonymous posting — every feedback row has a `user_id`, and `visibility: 'creator-only'` controls exposure, not identity.

---

## 2. Middleware behavior

`middleware.ts`, `runtime: 'edge'`.

```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons/|images/|api/health).*)'],
}
```

In order:

1. **Strip** all inbound `x-ws-*` and `x-request-id` headers.
2. **Assign** `x-request-id = crypto.randomUUID()`; echo it on the response. Every log line and every `<ErrorState>` carries it.
3. **Verify** `ws_session` (signature only). On success set `x-ws-uid`, `x-ws-handle`, `x-ws-sid`.
4. **Refresh** the cookie if within 7 days of expiry.
5. **Redirect rules:**
   - Unauthenticated + path matches a protected prefix (`/dashboard`, `/settings`, `/notifications`, `/projects/new`, `/projects/*/edit`, `/projects/*/review`, `/community/new`, `/bounties/new`, `/experts/*/request`, `/dashboard/*`) → `307 /sign-in?next=<encodeURIComponent(pathname + search)>`.
   - Authenticated + path in `(auth)` group → `307` to `next` if it's a safe same-origin relative path, else `/discover`.
   - `/u/<Handle>` with uppercase → `308` to the lowercase form (handles are canonical lowercase).
   - `/p/<slug>` legacy → `308 /projects/<slug>`.
6. **Coarse burst guard** (in-memory, per edge instance): >180 requests/min from one hashed IP → `429` with `Retry-After: 30`. This is a shock absorber, not the rate limiter; it is deliberately not authoritative because edge instances don't share memory.
7. **Security headers** on every response:

```
Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-<n>' 'strict-dynamic';
  style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:;
  media-src 'self' https:; frame-src https://www.youtube-nocookie.com https://player.vimeo.com https://itch.io;
  connect-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none';
  form-action 'self'; frame-ancestors 'none'
Referrer-Policy: strict-origin-when-cross-origin
X-Content-Type-Options: nosniff
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=()
Cross-Origin-Opener-Policy: same-origin
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload   (prod only)
```

The nonce is passed to the root layout via the `x-nonce` request header and applied to Next's inline bootstrap scripts. `frame-src` is the only third-party allowance — it is what makes project embeds (itch.io builds, YouTube devlogs, Vimeo cuts) possible, and every embed is rendered inside a sandboxed iframe (`sandbox="allow-scripts allow-same-origin allow-presentation"`).

Middleware does **no** database access, **no** `await`ed I/O beyond `jwtVerify`, and never renders.

---

## 3. Rate limiting strategy

Three layers, each catching what the one above cannot.

**L1 — edge burst guard.** Described above. Per-instance, per-hashed-IP, 180 req/min.

**L2 — authoritative token bucket (GCRA) in SQLite.** Table:

```sql
CREATE TABLE rate_limit (
  bucket     TEXT PRIMARY KEY,   -- "<routeId>:<subject>"
  tokens     REAL NOT NULL,
  updated_at INTEGER NOT NULL
);
```

Consumption runs inside the existing `tx()` helper (`BEGIN IMMEDIATE`), so it is atomic under SQLite's writer lock:

```ts
function consume(routeId: string, subject: string, capacity: number, windowMs: number, cost = 1): RateResult
```

Refill rate is `capacity / windowMs` tokens per ms, computed lazily on read — no background sweeper. A daily `VACUUM`-adjacent job deletes rows untouched for 24 h.

**Subject key.** `uid:<userId>` when authenticated, otherwise `ip:<HMAC-SHA256(AUTH_SECRET, ip).slice(0,16)>`. Raw IPs are never persisted or logged. Authenticated subjects get their own bucket so one abusive user cannot rate-limit an entire NAT'd office.

**L3 — cost budgets.** AI-backed endpoints (insight rollup, theme clustering, composer assist) additionally debit a per-user daily *cost* budget, with `cost` proportional to input size. When `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` are unset these endpoints run the deterministic fallback (keyword clustering + lexicon sentiment) and debit nothing.

**Per-route limits.**

| Route | Capacity / window | Subject | Notes |
|---|---|---|---|
| `POST /api/auth/sign-in` | 5 / 15 min | `email + ip` | Always runs a dummy scrypt on unknown email (constant-time, no user enumeration). Failures 6–10 add exponential delay (250 ms × 2ⁿ, capped 4 s). |
| `POST /api/auth/sign-up` | 3 / 1 h | ip | |
| `POST /api/auth/password/forgot` | 3 / 1 h | `email + ip` | Always returns `200 { ok: true }` regardless of account existence. |
| `POST /api/auth/password/reset` | 5 / 1 h | ip | |
| `GET /api/auth/handle-available` | 30 / 1 min | ip | |
| `POST /api/feedback` | 10 / 1 h **and** 1 / 60 s | uid | The 60 s floor stops accidental double-submit and drive-by spam. |
| `POST /api/feedback/*/replies` | 30 / 1 h | uid | |
| `POST /api/feedback/*/vote` | 60 / 1 min | uid | |
| `POST /api/feedback/*/report` | 10 / 1 h | uid | |
| `POST /api/projects` | 5 / 1 h | uid | |
| `PATCH /api/projects/*` | 60 / 1 h | uid | |
| `POST /api/projects/*/insights` | 5 / 1 h | `projectId` | Bucketed on the project, not the user — co-owners share it. |
| `POST /api/uploads` | 20 / 1 h, 40 MB / 1 h | uid | Byte budget uses `cost = bytes / 1_048_576`. |
| `POST /api/discussions` | 10 / 1 h | uid | |
| `POST /api/discussions/*/comments` | 40 / 1 h | uid | |
| `POST /api/requests` | 10 / 1 h | uid | |
| `POST /api/bounties` | 5 / 1 h | uid | |
| `GET /api/search`, `/api/tags` | 60 / 1 min | uid-or-ip | Typeahead; client debounces 200 ms. |
| `GET /api/notifications/stream` | 5 concurrent | uid | SSE connection cap. |
| all other `/api/**` | 300 / 1 min | uid-or-ip | Default policy — no route is unlimited. |

**Response headers** on every `/api` response:

```
RateLimit-Limit: 10
RateLimit-Remaining: 7
RateLimit-Reset: 2841        # seconds
Retry-After: 2841            # 429 only
```

**New-account throttle.** Accounts younger than 24 h get 50 % capacity on `POST /api/feedback`, `/api/discussions`, and `/api/comments/*`. Accounts with reputation ≥ 500 get 2×.

---

## 4. Shared API conventions

**Envelope.** Every handler returns one of:

```ts
type ApiOk<T>  = { ok: true; data: T; meta?: { nextCursor?: string | null; total?: number } }
type ApiErr    = { ok: false; error: {
  code: ErrorCode
  message: string                            // human, safe to display
  fields?: Record<string, string[]>          // flattened Zod fieldErrors
  retryAfter?: number
} }
```

```ts
const ErrorCode = z.enum([
  'VALIDATION_FAILED',   // 422
  'UNAUTHENTICATED',     // 401
  'FORBIDDEN',           // 403
  'CSRF_FAILED',         // 403
  'NOT_FOUND',           // 404
  'CONFLICT',            // 409  (slug taken, handle taken, duplicate vote)
  'RATE_LIMITED',        // 429
  'PAYLOAD_TOO_LARGE',   // 413
  'UNSUPPORTED_MEDIA',   // 415
  'STATE_INVALID',       // 409  (accepting an already-accepted request)
  'INTERNAL',            // 500
])
```

**Handler shape.** Every mutating handler is wrapped:

```ts
export const POST = handler({
  runtime: 'nodejs',
  auth: 'required',                  // 'required' | 'optional' | 'none'
  limit: { id: 'feedback.create', capacity: 10, windowMs: 3_600_000, floorMs: 60_000 },
  body: FeedbackCreate,              // Zod
  async run({ user, body, params, requestId }) { … },
})
```

The wrapper does, in order: CSRF check → rate limit → `requireUser()` → `Content-Type` check → body size cap (1 MB JSON, 25 MB multipart) → `schema.safeParse` → service call → `revalidateTag` → envelope. Uncaught throws become `500 INTERNAL` with the `requestId` logged, never the message.

**Shared Zod primitives** (`src/lib/schema/common.ts`):

```ts
export const Id       = z.string().uuid()
export const Handle   = z.string().trim().toLowerCase()
                         .regex(/^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/, 'Letters, numbers and hyphens, 3–24 characters')
export const Email    = z.string().trim().toLowerCase().email().max(254)
export const Password = z.string().min(12, 'At least 12 characters').max(200)
export const Slug     = z.string().regex(/^[a-z0-9][a-z0-9-]{0,79}$/)
export const Cursor   = z.string().max(160)
export const Url      = z.string().url().max(2048)
                         .refine(u => /^https:\/\//.test(u), 'Must be https')

export const ProjectType = z.enum(['game','app','website','tool','video','hardware','tabletop','other'])
export const Stage       = z.enum(['concept','prototype','alpha','beta','release-candidate','launched'])
export const Need        = z.enum(['fun','balance','controls','onboarding','performance','visual-design',
                                   'narrative','copy','pricing','technical','accessibility','market-fit'])
export const Score       = z.number().int().min(1).max(5)
export const Severity    = z.enum(['nit','minor','major','blocker'])
export const Sentiment   = z.enum(['positive','mixed','negative'])
export const Visibility  = z.enum(['public','creator-only'])
export const RichText    = z.string().trim().max(20_000)   // markdown, sanitized server-side
export const Page = z.object({ cursor: Cursor.optional(), limit: z.coerce.number().int().min(1).max(50).default(20) })
```

**Category scoping is data, not enum.** Each project type ships a default category set; a creator can edit it per project. Submitted `scores[].category` keys are validated against the project's stored `ask.categories` with a `superRefine` inside the service (the static schema only constrains shape), so the composer can never submit "balance" for a landing page.

```ts
const DEFAULT_CATEGORIES: Record<ProjectType, string[]> = {
  game:     ['fun','balance','controls','onboarding','performance','art-direction'],
  app:      ['clarity','onboarding','performance','visual-design','value'],
  website:  ['clarity','visual-design','copy','performance','trust'],
  tool:     ['ergonomics','docs','performance','integration','value'],
  video:    ['hook','pacing','clarity','audio','edit'],
  hardware: ['ergonomics','build-quality','setup','value','docs'],
  tabletop: ['fun','balance','rules-clarity','components','replayability'],
  other:    ['clarity','value','execution'],
}
```

---

## 5. Page routes

Legend — **S** = Server Component, **C** = client island named inline. Auth: *public* / *optional* (renders for everyone, richer when signed in) / *required* / *owner* (must own the resource).

### 5.1 `(marketing)` — logged out

Layout: `app/(marketing)/layout.tsx` (**S**) — marketing top nav (`C` for the mobile disclosure only), footer with the persistent help link (3.2.6), no sidebar. `revalidate = 3600`.

#### `/` — landing
- **S**. Static. Client islands: `HeroDemo` (an interactive miniature of the feedback composer, ~14 KB, `next/dynamic` with `ssr: true` and a static fallback), `ThemeToggle`.
- **Auth** public. Signed-in visitors see the nav swap to "Go to dashboard"; the page itself is identical (keeps it static).
- **Data** `getLandingStats()` — projects sharpened, reviews written, median time-to-first-feedback — cached 1 h and rendered from a snapshot table, never a live aggregate.
- **Loading** none needed (static); `HeroDemo` renders its non-interactive server fallback until hydrated.
- **Empty** stats fall back to hand-set copy ("Built for the week before launch") if the snapshot row is missing — the page must never render "0 projects".
- **Error** `error.tsx` renders a reduced hero with the sign-up CTA only. The landing page must never be a blank error screen.

#### `/how-it-works`
- **S**, static. **Data** none (MDX-free, hand-authored TSX sections). **Loading/Empty** n/a. **Error** generic marketing boundary.

#### `/for-creators`, `/for-reviewers`
- **S**, static. Audience-split value props (creators: pre-launch signal; reviewers: reputation + paid work). **Data** `getFeaturedProjects(3)` / `getFeaturedExperts(3)`, cached 1 h. **Empty** the featured strip is omitted entirely rather than showing placeholders. **Error** marketing boundary.

#### `/pricing`
- **S**, static. **Data** static plan table + `getBountyFeeSchedule()`. **Empty** n/a. **Error** marketing boundary; the FAQ accordion is a `<details>`-based primitive so it works without JS.

#### `/changelog`
- **S**, `revalidate = 300`. **Data** `listChangelog({limit:50})`. **Loading** 6 entry skeletons. **Empty** "Nothing shipped yet — follow along on the discussions board." **Error** boundary with retry.

#### `/legal/terms`, `/legal/privacy`
- **S**, static, `revalidate = 86400`. **Data** none. Long-form prose at `65ch`, with an in-page table of contents (`C` for scroll-spy, degrades to plain anchors). **Empty** n/a. **Error** marketing boundary.

### 5.2 `(auth)`

Layout: `app/(auth)/layout.tsx` (**S**) — centered `max-w-sm` card, product mark, no nav, `<main>` is the form region. Every form is a `<form action={serverAction}>` with `useActionState`, so it submits without JS and shows inline errors with JS.

#### `/sign-in`
- **S** shell + `SignInForm` (**C**).
- **Auth** public; middleware bounces authenticated users.
- **Data** `searchParams.next` (validated same-origin relative) and `searchParams.reason` (`session-expired` | `verify-first` | `password-changed`) which renders a `<Banner>` above the form.
- **Loading** `loading.tsx` renders the exact card with two skeleton fields — prevents the layout jump users notice most on a cold auth page.
- **Empty** n/a.
- **Error** field-level errors under each input (`aria-describedby`, `aria-invalid`); credential failure renders one form-level `role="alert"` message — *"Email or password is incorrect"* — never distinguishing which. Rate-limit failure renders a countdown banner with a live-updating `Retry in 4:12` (`aria-live="polite"`, updated at 10 s granularity so it doesn't spam AT).

#### `/sign-up`
- **S** shell + `SignUpForm` (**C**) with async handle availability (`GET /api/auth/handle-available`, 300 ms debounce, `aria-live="polite"` status, and a server-side re-check on submit because availability is racy).
- **Auth** public. **Data** `searchParams.next`, `searchParams.invite`.
- **Loading** same card skeleton.
- **Error** per-field; handle conflict on submit returns `409 CONFLICT` and the form focuses the handle field and suggests three free alternates.

#### `/forgot-password`
- **S** + `ForgotForm` (**C**). **Auth** public. **Data** none.
- **Empty/success** always renders the same neutral confirmation panel ("If an account exists for that address, a reset link is on its way") — no enumeration.
- **Error** only validation and rate-limit errors are distinguishable.

#### `/reset-password?token=…`
- **S** — validates the token server-side *before* rendering (`getResetTokenState(token)`), so an expired link never shows a form the user will fill out for nothing. + `ResetForm` (**C**) with a password strength meter (`<Meter>`).
- **Auth** public (token *is* the auth). **Data** token state.
- **Empty** missing token → `<EmptyState>` "That link is incomplete" + link to `/forgot-password`.
- **Error** expired/used token → `<EmptyState>` "This reset link has expired" + a one-click "Send a new one" form. Not an error boundary — this is an expected state.

#### `/verify-email?token=…`
- **S**, performs the verification on render via a service call guarded by a token check (idempotent; safe under email-scanner prefetch because it's a `GET` that only flips `verified_at` and is rate limited).
- **Auth** public. **Data** token state.
- **Loading** `loading.tsx` with a centered `<Spinner>` and "Confirming your email…".
- **Empty** already-verified → success panel, same as first verification.
- **Error** invalid token → `<EmptyState>` with "Resend verification" (requires sign-in).

### 5.3 `(app)` — product shell

Layout: `app/(app)/layout.tsx` (**S**) — reads `currentClaims()`, renders `<AppSidebar>` (**S** links, **C** only for the mobile drawer + collapse state persisted to `localStorage`), `<TopBar>` with `<SearchTrigger>` (**C**, ⌘K), `<NotificationBell>` (**C**, subscribes to `/api/notifications/stream`), `<UserMenu>` (**C**). Unauthenticated visitors get the same shell with a sign-in CTA in place of the user menu — `/discover`, `/projects/[slug]`, `/u/[handle]`, `/community`, `/experts`, `/bounties` are all public and must render identically to a crawler.

`app/(app)/@modal/default.tsx` provides a **parallel route slot** used by intercepting routes (`(.)review`, `(.)feedback/[id]`) so the composer and feedback permalinks open as a dialog over the feed but are full pages on refresh or direct link.

---

#### `/discover` — project feed
- **S** (`dynamic = 'force-dynamic'`, reads `searchParams`). Islands: `FilterBar` (**C**), `FeedSortMenu` (**C**), `LoadMore` (**C**, cursor button — *not* infinite scroll, because infinite scroll strands the footer and breaks 2.4.1 navigation; the button is the primary, an IntersectionObserver auto-click is applied only when `prefers-reduced-motion` is not set and the user has clicked once).
- **Auth** optional. Signed in adds follow state, "hide projects I've reviewed", and a personalized `for-you` sort.
- **Search params** `type` (multi), `stage` (multi), `needs` (multi), `sort` = `fresh|needs-eyes|trending|closing-soon|for-you`, `q`, `cursor`.
- **Data** `listProjects(filters)` → `{items, nextCursor}`; `getFacetCounts(filters)` for the filter chip counts; `viewer.followedProjectIds`; `getStarterPicks()` for the empty state.
- **Loading** `loading.tsx` renders the filter bar statically (it's derivable from `searchParams` alone) plus 9 `<ProjectCardSkeleton>` in the real grid. In-place filter changes don't unmount: the grid gets `aria-busy="true"` and `opacity-60` during the transition, and the result count region announces "148 projects" when it settles.
- **Empty** two distinct states. (a) *No filter*: impossible after seed, but falls back to "Nothing here yet — be the first to post a project" + `/projects/new`. (b) *Filters too narrow*: "No projects match these five filters", the narrowest filter named explicitly ("`stage: concept` is excluding 94 projects"), a **Clear filters** button, and a row of three loosened-filter suggestions.
- **Error** boundary keeps the filter bar mounted (it lives in the layout segment) and replaces only the grid — so a failed query doesn't lose the user's filter state.

#### `/search`
- **S**, `dynamic = 'force-dynamic'`. Full-surface search across projects, people, discussions.
- **Auth** optional. **Search params** `q`, `in` = `all|projects|people|discussions`, `cursor`.
- **Data** `search({q, in, cursor})` (SQLite FTS5 over title/pitch/body with a `bm25()` rank), `getRelatedTags(q)`.
- **Loading** three grouped section skeletons, headers rendered eagerly.
- **Empty** `q` blank → recent searches (localStorage) + trending tags. `q` present, 0 results → "No matches for *'godot roguelike'*" + spelling-relaxed alternates + "Search discussions instead" scoped link.
- **Error** boundary with the query preserved in the retry link.

#### `/projects/new` — post a project (wizard)
- **S** shell + `ProjectWizard` (**C**, 4 steps: basics → media/embed → the ask → preview). Step state lives in `?step=` so back/forward works and the step is linkable; draft autosaves to `POST /api/projects` (status `draft`) then `PATCH` every 4 s idle.
- **Auth** required (+ verified email to publish, not to draft).
- **Data** `DEFAULT_CATEGORIES`, `listMyDrafts()`, `getEmbedProviders()`.
- **Loading** `loading.tsx` = wizard chrome + step-1 field skeletons.
- **Empty** n/a. If an unfinished draft exists, a `<Banner>` offers "Resume *Untitled roguelike* (saved 3 h ago)".
- **Error** per-step field errors inline; a failed autosave shows a persistent `<Banner variant="warning">` "Changes aren't saving — Retry" and **disables the publish button** rather than risking a silent loss. Slug collision returns `409` and the wizard appends a suffix and tells the user the new URL.

#### `/projects/[slug]` — project detail
- **S**. `generateMetadata` (OG image from the project's cover via `next/og`). `generateStaticParams` for the top 200 projects with `revalidate = 60`.
- **Islands** `MediaGallery` (**C**, lightbox + keyboard arrows + focus trap), `EmbedFrame` (**C**, click-to-load so third-party frames never load uninvited), `RatingSummary` (**S**), `FeedbackThread` with `ThreadFilters` (**C**), `ReviewCta` (**C**, opens the intercepted composer), `FollowButton` (**C**, optimistic).
- **Auth** optional; private/draft projects are owner-only (`notFound()` for everyone else — a 403 would leak existence).
- **Data** `getProjectBySlug(slug)`, `getProjectMedia`, `getAsk` (the categories + the creator's written ask), `listFeedback({projectId, sort, category, cursor})`, `getRatingRollup`, `getCreator`, `viewer.hasReviewed`, `viewer.follows`.
- **Loading** `loading.tsx` mirrors the two-column layout precisely: media block (16:9 shimmer), title/byline lines, ask card, then 3 feedback skeletons. The gallery aspect ratio is reserved from `media[0].aspect` in the parent server render to prevent CLS.
- **Empty** *no feedback yet* is the most important empty state in the product: "No feedback yet — you'd be first", the creator's ask quoted verbatim, the category chips they're asking about, an estimate ("~8 minutes"), and the primary **Write feedback** CTA. If the viewer is the creator, it instead reads "Share your link to get the first review" with a copy-link button and the three highest-signal sharing destinations. *No media*: the gallery slot collapses (no grey box).
- **Error** `not-found.tsx` for unknown slugs, with a search box prefilled from the slug text. `error.tsx` for load failures; a feedback-thread failure is isolated in its own `<Suspense>` + boundary so the project header still renders.

#### `/projects/[slug]/review` — structured feedback composer
- **S** shell (loads the project, its category set, the ask, and any saved draft) + `FeedbackComposer` (**C**) — the single most complex island.
- Also reachable as an intercepted modal from `/discover` and the project page via `@modal/(.)review`; identical component, different chrome.
- **Auth** required. Forbidden if the viewer is the project owner (renders `<EmptyState>` "You can't review your own project" — not a 403 page). Locked if `visibility` restricts reviews to invited experts and the viewer isn't one.
- **Data** `getProject`, `getAsk.categories`, `getDraft(projectId, userId)`, `getMyLastContext()` (platform + experience prefill, satisfying 3.3.7 redundant-entry).
- **Structure** category-scoped: one `<ScoreRow>` per configured category (a 1–5 `<RatingScale>` implemented as a radio group, never a star widget with unlabeled buttons) with an optional note; then *what worked* (up to 5 bullets), *friction points* (text + severity + optional timestamp for video/game submissions), *suggestions*, a required summary (40–6000 chars), and a context block. A live "signal meter" (`<Meter>`) scores completeness and is advisory only — it never blocks submission.
- **Loading** `loading.tsx` shows the project header + skeleton category rows so the reviewer sees *what they'll be asked* before hydration. Submit shows the button's own `loading` state; the form is `inert` during flight.
- **Empty** if the creator configured zero categories: falls back to freeform summary + suggestions with a note explaining the creator didn't scope the ask.
- **Error** Zod field errors map to `aria-describedby` on the exact control; on any failure focus moves to an error summary at the top of the form (`role="alert"`, links to each bad field) — this is the WCAG-correct pattern and the one most often skipped. Draft-save failure shows an unobtrusive "Saved locally" indicator backed by `localStorage` so a network blip never loses 20 minutes of writing. A `beforeunload` guard fires only when the draft is dirty and unsaved.

#### `/projects/[slug]/feedback/[feedbackId]` — feedback permalink
- **S** + `ReplyBox` (**C**), `HelpfulVote` (**C**, optimistic). Intercepted as a modal from the thread.
- **Auth** optional; `creator-only` feedback is visible to the author and the project owner only, else `notFound()`.
- **Data** `getFeedback(id)`, `listReplies(id)`, `getProjectHeader(slug)`, `viewer.vote`.
- **Loading** header + scorecard skeleton + 2 reply skeletons.
- **Empty** no replies → a quiet inline prompt ("Reply to ask a follow-up") rather than a full empty-state block.
- **Error** `not-found.tsx` for deleted/removed feedback: "This feedback was removed" + link back to the thread — deliberately not an error.

#### `/projects/[slug]/updates`
- **S**. Reverse-chronological devlog entries with per-entry permalink anchors.
- **Auth** optional. **Data** `listUpdates({projectId, cursor})`.
- **Loading** 4 entry skeletons. **Empty** "No updates yet" + (owner) "Post your first update". **Error** standard boundary.

#### `/projects/[slug]/suggestions` — public suggestion board
- **S** + `SuggestionVote` (**C**). Read-only mirror of the creator's tracker, showing only items the creator marked public.
- **Auth** optional (voting requires auth; the vote button for signed-out users opens the sign-in dialog with `next` preserved).
- **Data** `listPublicSuggestions({projectId, status, sort})`.
- **Loading** grouped column skeletons. **Empty** "No public suggestions yet — suggestions come from feedback the creator promotes." **Error** standard boundary.

#### `/projects/[slug]/edit`
- **S** + `ProjectEditor` (**C**) — same field components as the wizard, flat rather than stepped.
- **Auth** **owner**. Non-owners get `notFound()`.
- **Data** `getProjectForEdit(slug, userId)`, media list, ask config.
- **Loading** populated-shaped skeleton (labels rendered, values shimmering).
- **Empty** n/a. **Error** inline field errors; a destructive zone (unpublish, delete) at the bottom behind a typed-confirmation `<Dialog>`.

---

#### `/dashboard` — creator overview
- **S**. Cards: unread feedback count, sentiment trend sparkline, top themes, suggestion throughput, open bounties/requests.
- **Auth** required.
- **Data** `getDashboardSummary(userId)` (single aggregate query), `listMyProjects(userId, {limit:5})`, `getRecentActivity(userId, {limit:8})`.
- **Loading** `loading.tsx` = 5 stat-card skeletons + activity list skeleton. Each card is independently `<Suspense>`-wrapped so the fast ones paint first.
- **Empty** *no projects*: the whole dashboard is replaced by a single onboarding panel — "Post your first project" with a 3-step explainer, not a grid of zeros. *Projects but no feedback*: cards render with "—" and a share-your-link prompt.
- **Error** per-card boundaries; one failing rollup never blanks the dashboard.

#### `/dashboard/inbox` — feedback inbox
- **S** list + `InboxToolbar` (**C**: status filter, project filter, bulk select) + `InboxList` (**C**: keyboard list navigation `j`/`k`/`Enter`, `aria-activedescendant`, roving tabindex).
- **Auth** required (scoped to the viewer's projects).
- **Search params** `project`, `status` = `new|read|actioned|archived`, `category`, `sentiment`, `sort`, `cursor`.
- **Data** `listInboxFeedback(userId, filters)`, `getInboxCounts(userId)`.
- **Loading** toolbar eager + 12 row skeletons. Filter changes use the same `aria-busy` dim as the feed.
- **Empty** *zero inbox* is a success state, not a failure: "Inbox zero — every piece of feedback is triaged", with a link to archived. *Filtered to nothing*: "No feedback matches" + clear-filters.
- **Error** boundary preserves the toolbar; bulk-action failures roll back the optimistic UI and raise a toast naming how many succeeded.

#### `/dashboard/inbox/[feedbackId]`
- **S** detail pane (rendered beside the list on ≥lg via a parallel route `@detail`; full page on mobile) + `TriageControls` (**C**: status, promote-to-suggestion, reply, thank, flag).
- **Auth** **owner** of the parent project.
- **Data** `getFeedbackForOwner(id, userId)`, `listReplies`, `getReviewerCard(reviewerId)` (their reputation, prior reviews on this project), `getSimilarFeedback(id)` (theme-clustered siblings).
- **Loading** scorecard skeleton + reviewer card skeleton.
- **Empty** no similar feedback → that section is omitted entirely.
- **Error** boundary local to the detail pane; the list stays usable.

#### `/dashboard/insights` and `/dashboard/insights/[projectId]`
- **S** + `ThemeExplorer` (**C**, click a theme to filter the quote list), `SentimentChart` (**C**, canvas with an accessible `<table>` fallback rendered in a `<details>` — charts must have a text equivalent).
- **Auth** required / owner.
- **Data** `listMyProjects`, `getInsightRollup(projectId)` → `{ themes[], sentimentByCategory[], sentimentOverTime[], quoteExemplars[], coverage }`. Rollups are precomputed and stored; the page never calls an LLM during render. When AI keys are absent the same shape is produced by the deterministic clusterer (TF-IDF + n-gram merge, lexicon sentiment) and `rollup.method` is surfaced honestly in the UI as "Computed without AI".
- **Loading** chart area reserves exact height; theme chips shimmer.
- **Empty** *< 5 pieces of feedback*: "Themes need at least 5 reviews to be meaningful — you have 2." with a progress `<Meter>` toward 5. This threshold is a product decision: a rollup over 2 reviews is noise dressed as insight. *Stale rollup*: a banner "Insights are 3 days old — Recompute".
- **Error** boundary offers "Recompute insights" as the retry action, since a stale-data failure and a compute failure look the same to the user.

#### `/dashboard/suggestions` — suggestion tracker
- **S** + `SuggestionBoard` (**C**) — kanban across `backlog | planned | in-progress | shipped | declined`.
- **Accessibility** drag is pointer-*optional*: every card has a "Move to…" menu, and keyboard users press `Space` to lift, arrows to move, `Space` to drop, with each transition announced in a live region. (2.5.7 no drag-only.)
- **Auth** required. **Search params** `project`, `status`, `source`.
- **Data** `listSuggestions(userId, filters)`, `getSuggestionCounts`, `listMyProjects`.
- **Loading** 5 column headers eager + 3 card skeletons per column.
- **Empty** whole board empty → "Suggestions come from feedback — promote one from your inbox" + link. Individual empty column → a dashed drop zone reading "Nothing planned".
- **Error** reorder failure reverts the optimistic move, announces "Couldn't save — card returned to Planned" in the live region, and offers undo.

#### `/dashboard/projects`
- **S** + `ProjectRow` menus (**C**). Table of the viewer's projects: stage, visibility, reviews, avg score, last activity.
- **Auth** required. **Data** `listMyProjects(userId, {withStats:true})`.
- **Loading** 6 table-row skeletons preserving column widths. **Empty** "No projects yet" + primary CTA. **Error** boundary with retry.

#### `/dashboard/projects/[slug]/analytics`
- **S** + `Chart` islands. Views, review-start vs review-complete funnel, category score trend, reviewer composition.
- **Auth** **owner**. **Data** `getProjectAnalytics(projectId, {range})` (`range` = `7d|30d|90d|all` in searchParams).
- **Loading** fixed-height chart skeletons. **Empty** "Not enough data for this range — try 90 days." **Error** per-chart boundaries.

#### `/dashboard/requests` and `/dashboard/requests/[requestId]`
- **S** + `RequestActions` (**C**). Two tabs driven by `?role=client|expert`. The detail page is the shared workspace for a paid feedback engagement: brief, agreed scope, deadline, deliverable, escrow state.
- **Auth** required; the detail page requires being the client *or* the expert on that request.
- **Data** `listRequests(userId, {role, status, cursor})`, `getRequest(id)`, `getRequestTimeline(id)`, `getDeliverable(id)`.
- **Loading** list: 6 row skeletons. Detail: brief block + timeline skeleton.
- **Empty** client view: "No paid requests yet — browse experts." Expert view (not yet an expert): "Set up your expert profile to receive requests" + link to `/settings/expertise`. Expert view (profile live, no requests): "Your profile is live — no requests yet" plus the two profile fields most likely to be missing.
- **Error** boundary; money-adjacent actions (`deliver`, `approve`, `dispute`) additionally require a confirmation `<Dialog>` and are idempotent server-side keyed by request state, so a double-click can't double-pay.

#### `/dashboard/bounties`
- **S** + `BountyActions` (**C**). Bounties the viewer posted and claims on them.
- **Auth** required. **Data** `listMyBounties(userId, {status})`, `listClaims(bountyId)`.
- **Loading** card skeletons. **Empty** "No bounties posted — a bounty is how you get expert eyes fast" + `/bounties/new`. **Error** standard boundary.

#### `/dashboard/earnings`
- **S**. Reviewer-side ledger: completed requests, awarded bounties, pending payouts, lifetime total.
- **Auth** required. **Data** `getEarningsLedger(userId, {range, cursor})`.
- **Loading** summary stat skeletons + table skeleton.
- **Empty** "No earnings yet" + the two highest-leverage actions (complete your expert profile / claim an open bounty).
- **Error** boundary. Amounts are rendered from integer minor units with `Intl.NumberFormat`; never floats.

#### `/notifications`
- **S** + `NotificationList` (**C**, mark-read on view via IntersectionObserver + explicit "Mark all read").
- **Auth** required. **Search params** `filter` = `all|feedback|replies|mentions|requests`.
- **Data** `listNotifications(userId, {filter, cursor})`, `getUnreadCount`.
- **Loading** 10 row skeletons. **Empty** "You're all caught up" (with the same success framing as inbox zero). **Error** boundary; SSE disconnects degrade to a 60 s poll and show a subtle "Reconnecting…" chip rather than failing.

---

#### `/u/[handle]` — public creator/reviewer profile
- **S**. `generateMetadata` + OG card. Tabs are real routes (below), not client state, so each is linkable.
- **Auth** optional. **Data** `getProfileByHandle(handle)`, `getReputation(userId)`, `getPinnedProjects`, `getActivityHeatmap`, `viewer.follows`.
- **Loading** avatar/name/bio block skeleton + tab bar eager + card skeletons.
- **Empty** brand-new profile: "*@handle* hasn't posted anything yet" — and if the viewer *is* the owner, "Your profile is empty — post a project or write your first review" with both CTAs.
- **Error** `not-found.tsx` for unknown handles with a people-search box.

#### `/u/[handle]/projects`, `/u/[handle]/reviews`, `/u/[handle]/reputation`
- **S** each, sharing the profile layout (which fetches the header once).
- **Auth** optional. `reviews` shows only `public` feedback.
- **Data** `listProjectsByUser`, `listReviewsByUser`, `getReputationBreakdown(userId)` → the components of the score (reviews written, helpful votes, creator acknowledgements, shipped suggestions, expert endorsements) with the exact formula shown. Reputation must be legible, not a black box.
- **Loading** per-tab card/row skeletons; the header never re-skeletons on tab change (it's in the layout).
- **Empty** per tab: "No public projects", "No public reviews — reviews marked *creator-only* stay private", "Reputation starts at 0 — write a review to begin".
- **Error** per-tab boundary inside the shared layout.

#### `/experts` — expert marketplace
- **S** + `ExpertFilters` (**C**).
- **Auth** optional. **Search params** `domain`, `type`, `price` (band), `turnaround`, `availability`, `sort`, `cursor`.
- **Data** `listExperts(filters)`, `getExpertFacets`.
- **Loading** filter bar eager + 8 expert card skeletons.
- **Empty** "No experts match — try widening the domain filter", plus three adjacent-domain suggestions. If the marketplace is genuinely empty (early days), a waitlist panel: "We're onboarding experts — apply to be one."
- **Error** boundary preserving filters.

#### `/experts/[handle]`
- **S** + `HireCta` (**C**). Packages, rate, turnaround, sample redacted reviews, endorsements, availability.
- **Auth** optional. **Data** `getExpertProfile(handle)`, `listSampleReviews`, `getEndorsements`, `getAvailability`.
- **Loading** header + package card skeletons.
- **Empty** no samples → "No public samples yet" with the endorsement count standing in.
- **Error** `not-found.tsx` if the handle exists but has no expert profile — with a link to their normal profile, which is the correct destination.

#### `/experts/[handle]/request`
- **S** + `RequestForm` (**C**): pick project, pick package, scope checkboxes, deadline, budget, brief.
- **Auth** required. Blocked if the expert is unavailable (renders a "Notify me when available" panel instead of the form).
- **Data** `getExpertProfile(handle)`, `listMyProjects(userId)` (must have at least one).
- **Loading** form skeleton with the package summary rendered eagerly from the parent.
- **Empty** *no projects to attach*: the form is replaced by "You'll need a project first" + `/projects/new` with `?then=request:<handle>` so the user lands back here.
- **Error** inline field errors + error summary; budget below the expert's floor returns `422` with a field error naming the minimum.

#### `/bounties`
- **S** + `BountyFilters` (**C**). Open feedback bounties.
- **Auth** optional. **Search params** `type`, `needs`, `min`, `status`, `sort`, `cursor`.
- **Data** `listBounties(filters)`.
- **Loading** 8 card skeletons. **Empty** "No open bounties right now" + "Post one" (creators) / "Get notified" (reviewers). **Error** boundary.

#### `/bounties/new`
- **S** + `BountyForm` (**C**). **Auth** required. **Data** `listMyProjects`, `getFeeSchedule`.
- **Loading** form skeleton. **Empty** same no-projects redirect pattern as above.
- **Error** inline; the fee breakdown recomputes live and is also recomputed server-side — the client number is never trusted.

#### `/bounties/[bountyId]`
- **S** + `ClaimButton` (**C**), `AwardPanel` (**C**, owner only).
- **Auth** optional to view; required to claim; owner to award.
- **Data** `getBounty(id)`, `listClaims(id)`, `getProjectHeader`.
- **Loading** brief + claim-list skeletons.
- **Empty** no claims → owner sees "No claims yet — bounties usually get their first claim within a day"; visitors see "Be the first to claim".
- **Error** `not-found.tsx` for withdrawn bounties; `STATE_INVALID` on claiming an awarded bounty surfaces as an inline banner + refresh, not a toast that disappears.

---

#### `/community` — discussions index
- **S** + `DiscussionFilters` (**C**).
- **Auth** optional. **Search params** `sort` = `latest|top|unanswered`, `tag`, `cursor`.
- **Data** `listDiscussions(filters)`, `listCategories`, `getTrendingTags`.
- **Loading** category rail eager + 10 row skeletons.
- **Empty** "No discussions yet — start one" (with JS-free fallback link). **Error** boundary.

#### `/community/c/[category]`
- **S**. Same as index, scoped. **Data** `getCategory(slug)` + `listDiscussions({category})`.
- **Loading/Empty/Error** as index; unknown category → `not-found.tsx` listing the valid categories.

#### `/community/new`
- **S** + `DiscussionComposer` (**C**, markdown with a live preview tab and a plain-textarea fallback).
- **Auth** required. **Data** `listCategories`, `getDraft`.
- **Loading** editor skeleton. **Empty** n/a. **Error** inline + error summary; draft autosaved to `localStorage`.

#### `/community/[slug]`
- **S** + `CommentTree` (**C**, collapse/expand with `aria-expanded`, depth capped at 5 then flattened with a "continue this thread" link), `CommentComposer` (**C**), `VoteButton` (**C**).
- **Auth** optional to read; required to comment or vote.
- **Data** `getDiscussion(slug)`, `listComments(id, {sort})`, `viewer.votes`.
- **Loading** post body skeleton + 5 comment skeletons.
- **Empty** "No replies yet" inline prompt. **Error** `not-found.tsx` for deleted threads; comment-tree failure isolated from the post body via nested `<Suspense>`.

#### `/community/tags/[tag]`
- **S**. **Data** `listDiscussions({tag})`, `getTagMeta`. **Loading** 10 row skeletons. **Empty** "Nothing tagged *#tag* yet." **Error** boundary.

---

#### `/settings/*`
Shared layout `app/(app)/settings/layout.tsx` (**S**) — a vertical nav (real links, `aria-current="page"`) beside `<main>`. **Auth required** on every child; middleware guards the prefix.

| Route | Component | Data | Loading | Empty | Error |
|---|---|---|---|---|---|
| `/settings/profile` | **S** + `ProfileForm` (**C**) | `getProfile(userId)` | populated-shape skeleton | n/a | inline field errors; avatar upload failure keeps the old avatar and shows a retry chip |
| `/settings/account` | **S** + `AccountForm` (**C**) | `getAccount(userId)` (email, verification state, handle) | field skeletons | n/a | email change requires password re-entry; `409` on handle conflict |
| `/settings/expertise` | **S** + `ExpertForm` (**C**) | `getExpertProfile(userId)`, domain taxonomy | field skeletons | *no expert profile yet* → an explainer panel + "Create expert profile", not an empty form | inline; publishing requires ≥3 completed public reviews, enforced server-side with a `422` naming the shortfall |
| `/settings/notifications` | **S** + `NotificationPrefs` (**C**) | `getNotificationPrefs(userId)` | toggle-grid skeleton | n/a | per-toggle optimistic revert + toast |
| `/settings/appearance` | **S** + `AppearanceForm` (**C**) | `ws_theme` / `ws_density` / `ws_motion` cookies | none (instant) | n/a | writes are cookie-only; a failure is impossible and there is no error state — the form is `<form action>` with no network dependency beyond the handler |
| `/settings/security` | **S** + `PasswordForm`, `SessionList` (**C**) | `listSessions(userId)` | 3 session-row skeletons | n/a | password change bumps `session_version` and re-issues the current session; the UI states plainly "this will sign you out on 4 other devices" *before* submit |
| `/settings/billing` | **S** + `BillingPanel` (**C**) | `getBillingProfile(userId)`, `listInvoices` | summary + table skeleton | "No invoices yet" | boundary; no card data ever touches this app's forms — payouts/collection are delegated to the processor's hosted flow |

---

## 6. API route handlers

All under `app/api/**/route.ts`. `runtime: 'nodejs'` throughout (SQLite + `node:crypto`). Every response is the `ApiOk`/`ApiErr` envelope from §4; below, "→" shows the `data` payload only.

### 6.1 Auth

```ts
// POST /api/auth/sign-up
const SignUp = z.object({
  email: Email,
  handle: Handle,
  displayName: z.string().trim().min(1).max(60),
  password: Password,
  role: z.enum(['creator','reviewer','both']).default('both'),
  acceptedTerms: z.literal(true, { errorMap: () => ({ message: 'You must accept the terms' }) }),
  next: z.string().max(512).optional(),
})
// → { user: { id, handle, displayName, avatarHue }, redirectTo: string }
// 409 CONFLICT { fields: { email | handle: [...] } }  — email conflict returns a generic
//   "Check your email" success shape instead, to avoid enumeration; the mail explains.

// POST /api/auth/sign-in
const SignIn = z.object({ email: Email, password: z.string().min(1).max(200), next: z.string().max(512).optional() })
// → { user: { id, handle, displayName }, redirectTo: string }
// 401 UNAUTHENTICATED (generic message)  |  429 RATE_LIMITED { retryAfter }

// POST /api/auth/sign-out
const SignOut = z.object({ everywhere: z.boolean().default(false) })
// → { ok: true }   clears cookie; `everywhere` bumps session_version

// GET /api/auth/handle-available?handle=
const HandleQuery = z.object({ handle: Handle })
// → { available: boolean, suggestions: string[] }   (suggestions only when taken)

// GET /api/auth/verify-email?token=
const VerifyQuery = z.object({ token: z.string().min(32).max(256) })
// → { verified: true, alreadyVerified: boolean }

// POST /api/auth/password/forgot
const Forgot = z.object({ email: Email })
// → { ok: true }   always, regardless of existence

// POST /api/auth/password/reset
const Reset = z.object({ token: z.string().min(32).max(256), password: Password })
// → { ok: true }   bumps session_version, consumes token, signs the user in

// POST /api/auth/password/change
const ChangePassword = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: Password,
}).refine(v => v.currentPassword !== v.newPassword, { path: ['newPassword'], message: 'Choose a different password' })
// → { revokedSessions: number }

// GET /api/auth/sessions            → { sessions: [{ id, current, userAgent, ip: '203.0.113.x', lastSeenAt, createdAt }] }
// DELETE /api/auth/sessions         → { revoked: number }        (all but current)
// DELETE /api/auth/sessions/[sessionId]  params: { sessionId: Id } → { ok: true }
```

### 6.2 Projects

```ts
// POST /api/projects            (creates a draft)
const ProjectCreate = z.object({
  title: z.string().trim().min(3).max(80),
  pitch: z.string().trim().min(20).max(280),
  type: ProjectType,
  stage: Stage,
  description: RichText.optional(),
  tags: z.array(z.string().trim().toLowerCase().min(2).max(24)).max(6).default([]),
  links: z.array(z.object({ label: z.string().trim().max(40), url: Url })).max(5).default([]),
})
// → { id, slug, status: 'draft', url }

// PATCH /api/projects/[projectId]      (owner)
const ProjectUpdate = ProjectCreate.partial().extend({
  visibility: z.enum(['public','unlisted','private']).optional(),
  coverMediaId: Id.nullable().optional(),
})
// → { id, slug, updatedAt }

// DELETE /api/projects/[projectId]     (owner)
const ProjectDelete = z.object({ confirmTitle: z.string() })   // must equal the project title
// → { deleted: true }

// POST /api/projects/[projectId]/publish
const Publish = z.object({ publish: z.boolean() })
// → { status: 'published' | 'draft', slug, url }
// 422 VALIDATION_FAILED { fields } when required fields (pitch, ≥1 category, ≥1 media-or-link) are missing

// PUT /api/projects/[projectId]/ask        (the structured ask)
const AskUpsert = z.object({
  prompt: z.string().trim().min(20).max(1000),          // "What I need eyes on"
  categories: z.array(z.object({
    key: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
    label: z.string().trim().min(2).max(32),
    hint: z.string().trim().max(160).optional(),
    required: z.boolean().default(true),
  })).min(1).max(8),
  needs: z.array(Need).min(1).max(5),
  estimatedMinutes: z.number().int().min(2).max(180),
  reviewerGuidance: RichText.optional(),
  allowPublicFeedback: z.boolean().default(true),
}).superRefine((v, ctx) => { /* unique category keys */ })
// → { askId, categories }

// POST /api/projects/[projectId]/media     multipart or JSON-embed
const MediaAdd = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('upload'), uploadId: Id, alt: z.string().trim().min(1).max(200), caption: z.string().max(200).optional() }),
  z.object({ kind: z.literal('embed'),  url: Url, provider: z.enum(['youtube','vimeo','itch','figma','codesandbox']),
             alt: z.string().trim().min(1).max(200) }),
])
// alt is REQUIRED — a project cannot add media without a text alternative (1.1.1 enforced at the API, not just the UI)
// → { mediaId, kind, url, width, height, aspect }

// DELETE /api/projects/[projectId]/media/[mediaId] → { deleted: true }
// PATCH  /api/projects/[projectId]/media           → { order: Id[] } → { ok: true }   (reorder)

// POST /api/projects/[projectId]/updates
const UpdateCreate = z.object({ title: z.string().trim().min(3).max(100), body: RichText.min(10), notifyFollowers: z.boolean().default(true) })
// → { updateId, url }

// POST /api/projects/[projectId]/follow
const Follow = z.object({ following: z.boolean() })
// → { following: boolean, followerCount: number }

// PUT /api/projects/[projectId]/rating      (one per user, upsert)
const RatingUpsert = z.object({ overall: Score, wouldRecommend: z.boolean() })
// → { overall: number, count: number, distribution: [number,number,number,number,number] }
// 403 FORBIDDEN if the rater is the owner

// POST /api/projects/[projectId]/insights    (recompute rollup)
const InsightsRecompute = z.object({ force: z.boolean().default(false) })
// → { rollupId, method: 'llm' | 'deterministic', themes: number, computedAt: number }
// 409 STATE_INVALID when feedbackCount < 5

// GET /api/projects/[projectId]/export?format=json|csv     (owner)
const ExportQuery = z.object({ format: z.enum(['json','csv']).default('json'), scope: z.enum(['feedback','suggestions','all']).default('all') })
// → streamed file; Content-Disposition attachment. Data portability is a product promise, not a feature flag.
```

### 6.3 Feedback (the core)

```ts
// POST /api/feedback
const FeedbackCreate = z.object({
  projectId: Id,
  headline: z.string().trim().min(8).max(120),
  scores: z.array(z.object({
    category: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
    score: Score,
    note: z.string().trim().max(2000).optional(),
  })).min(1).max(8),
  summary: z.string().trim().min(40, 'Give the creator at least a couple of sentences').max(6000),
  strengths: z.array(z.string().trim().min(3).max(280)).max(5).default([]),
  frictions: z.array(z.object({
    text: z.string().trim().min(3).max(500),
    severity: Severity,
    timestampSeconds: z.number().int().min(0).max(86_400).optional(),   // video/game session marker
    mediaId: Id.optional(),
  })).max(10).default([]),
  suggestions: z.array(z.string().trim().min(3).max(280)).max(5).default([]),
  context: z.object({
    platform: z.string().trim().max(60).optional(),
    sessionMinutes: z.number().int().min(1).max(600),
    priorExperience: z.enum(['none','some','expert']),
  }),
  visibility: Visibility.default('public'),
  requestId: Id.optional(),     // fulfils a paid request
  bountyId: Id.optional(),      // claims a bounty
  draftId: Id.optional(),
}).superRefine((v, ctx) => {
  const keys = v.scores.map(s => s.category)
  if (new Set(keys).size !== keys.length)
    ctx.addIssue({ code: 'custom', path: ['scores'], message: 'Each category can be scored once' })
})
// Service-level superRefine additionally asserts: scores[].category ⊆ project.ask.categories,
// every ask category with required:true is present, reviewer !== owner, no existing
// non-superseded feedback by this user on this project.
// → { id, projectId, url, createdAt, reputationDelta: number, promptedFollowUp: boolean }
// 409 CONFLICT when the user already reviewed (with { existingUrl }) — the client offers "Edit your review"

// PATCH /api/feedback/[feedbackId]        (author, within 24 h, creates a revision)
const FeedbackUpdate = FeedbackCreate.omit({ projectId: true, requestId: true, bountyId: true, draftId: true }).partial()
// → { id, revision: number, updatedAt }

// DELETE /api/feedback/[feedbackId]       (author or moderator)
// → { deleted: true }   (soft delete; the thread renders a tombstone)

// POST /api/feedback/[feedbackId]/replies
const ReplyCreate = z.object({ body: z.string().trim().min(2).max(4000), parentReplyId: Id.optional() })
// → { replyId, createdAt, url }

// POST /api/feedback/[feedbackId]/vote
const VoteBody = z.object({ value: z.union([z.literal(1), z.literal(0)]) })   // helpful / retract
// → { helpfulCount: number, viewerVoted: boolean }
// 403 FORBIDDEN on self-vote

// POST /api/feedback/[feedbackId]/status   (project owner triage)
const TriageStatus = z.object({
  status: z.enum(['new','read','actioned','archived']),
  acknowledge: z.boolean().default(false),          // grants the reviewer reputation
  promoteToSuggestion: z.object({
    title: z.string().trim().min(3).max(120),
    status: z.enum(['backlog','planned','in-progress','shipped','declined']).default('backlog'),
    public: z.boolean().default(false),
  }).optional(),
})
// → { status, suggestionId?: string, reviewerReputationDelta?: number }

// POST /api/feedback/[feedbackId]/report
const Report = z.object({
  reason: z.enum(['spam','abuse','off-topic','low-effort','conflict-of-interest','other']),
  detail: z.string().trim().max(1000).optional(),
}).superRefine((v, ctx) => {
  if (v.reason === 'other' && !v.detail) ctx.addIssue({ code: 'custom', path: ['detail'], message: 'Tell us what happened' })
})
// → { reported: true }

// PUT /api/feedback/drafts                  (autosave, upsert by projectId+userId)
const DraftUpsert = z.object({ projectId: Id, payload: FeedbackCreate.deepPartial() })
// → { draftId, savedAt }
// DELETE /api/feedback/drafts/[draftId]  → { deleted: true }
```

### 6.4 Suggestions

```ts
// POST /api/suggestions
const SuggestionCreate = z.object({
  projectId: Id,
  title: z.string().trim().min(3).max(120),
  detail: RichText.optional(),
  sourceFeedbackId: Id.optional(),
  status: z.enum(['backlog','planned','in-progress','shipped','declined']).default('backlog'),
  public: z.boolean().default(false),
})
// → { id, status, position: number }

// PATCH /api/suggestions/[suggestionId]
const SuggestionUpdate = SuggestionCreate.partial().omit({ projectId: true }).extend({
  shippedInUpdateId: Id.optional(),
  declineReason: z.string().trim().max(500).optional(),
}).superRefine((v, ctx) => {
  if (v.status === 'declined' && !v.declineReason)
    ctx.addIssue({ code: 'custom', path: ['declineReason'], message: 'Say why — the reviewer sees this' })
})
// → { id, status, updatedAt }
// Moving to 'shipped' credits every contributing reviewer's reputation.

// POST /api/suggestions/[suggestionId]/vote
const SuggestionVote = z.object({ value: z.union([z.literal(1), z.literal(0)]) })
// → { votes: number, viewerVoted: boolean }

// POST /api/suggestions/reorder
const Reorder = z.object({
  projectId: Id,
  moves: z.array(z.object({ id: Id, status: z.enum(['backlog','planned','in-progress','shipped','declined']), position: z.number().int().min(0) })).min(1).max(200),
})
// → { ok: true, version: number }   — optimistic-concurrency `version` lets the board detect a stale drag
```

### 6.5 Marketplace

```ts
// POST /api/requests
const RequestCreate = z.object({
  expertHandle: Handle,
  projectId: Id,
  packageKey: z.string().min(1).max(40),
  brief: z.string().trim().min(40).max(4000),
  scope: z.array(Need).min(1).max(5),
  deadline: z.number().int().positive(),                 // epoch ms
  budgetMinor: z.number().int().min(500).max(500_000),    // cents
  currency: z.enum(['usd','eur','gbp']).default('usd'),
}).refine(v => v.deadline > Date.now() + 86_400_000, { path: ['deadline'], message: 'Give at least 24 hours' })
// → { requestId, status: 'pending', url }
// 422 when budgetMinor < expert.minimumMinor, with the minimum in the field error

// PATCH /api/requests/[requestId]         (client, while pending)
const RequestUpdate = RequestCreate.pick({ brief: true, scope: true, deadline: true }).partial()

// POST /api/requests/[requestId]/accept    (expert)   body: { note?: string ≤500 }          → { status: 'accepted', startedAt }
// POST /api/requests/[requestId]/decline   (expert)   body: { reason: enum, note?: ≤500 }   → { status: 'declined' }
// POST /api/requests/[requestId]/deliver   (expert)   body: { feedbackId: Id, note?: ≤1000 }→ { status: 'delivered', deliveredAt }
// POST /api/requests/[requestId]/approve   (client)   body: { rating: Score, note?: ≤1000 } → { status: 'completed', payoutMinor }
// POST /api/requests/[requestId]/dispute   (either)   body: { reason: enum, detail: 20..2000 } → { status: 'disputed', caseId }
// Every transition is validated against a state machine; an illegal transition is 409 STATE_INVALID
// with { from, to, allowed: string[] } so the UI can explain rather than just fail.

// POST /api/bounties
const BountyCreate = z.object({
  projectId: Id,
  title: z.string().trim().min(6).max(120),
  brief: z.string().trim().min(40).max(4000),
  needs: z.array(Need).min(1).max(5),
  amountMinor: z.number().int().min(500).max(200_000),
  currency: z.enum(['usd','eur','gbp']).default('usd'),
  slots: z.number().int().min(1).max(10).default(1),
  closesAt: z.number().int().positive(),
  requiredReputation: z.number().int().min(0).max(5000).default(0),
})
// → { bountyId, url, feeMinor, totalMinor }

// PATCH  /api/bounties/[bountyId]              (owner, while open)  → { id, updatedAt }
// DELETE /api/bounties/[bountyId]              (owner, no claims)   → { withdrawn: true }
// POST   /api/bounties/[bountyId]/claim        body: { note?: ≤500 } → { claimId, expiresAt }
//        409 STATE_INVALID when slots are exhausted or reputation is short (with the shortfall)
// POST   /api/bounties/[bountyId]/award        (owner) body: { claimId: Id, feedbackId: Id, amountMinor?: int }
//        → { awarded: true, payoutMinor, reviewerReputationDelta }

// PUT /api/expert-profile
const ExpertProfileUpsert = z.object({
  headline: z.string().trim().min(10).max(120),
  bio: RichText.min(80),
  domains: z.array(z.string().trim().min(2).max(32)).min(1).max(8),
  projectTypes: z.array(ProjectType).min(1),
  packages: z.array(z.object({
    key: z.string().regex(/^[a-z][a-z0-9-]{1,30}$/),
    name: z.string().trim().min(3).max(40),
    description: z.string().trim().min(20).max(600),
    priceMinor: z.number().int().min(500).max(500_000),
    turnaroundHours: z.number().int().min(4).max(720),
  })).min(1).max(4),
  availability: z.enum(['open','limited','closed']),
  minimumMinor: z.number().int().min(500),
  published: z.boolean().default(false),
})
// → { expertProfileId, published, url }
// 422 when published:true and completedPublicReviews < 3
```

### 6.6 Community, profile, platform

```ts
// POST /api/discussions
const DiscussionCreate = z.object({
  categorySlug: Slug,
  title: z.string().trim().min(8).max(140),
  body: RichText.min(20),
  tags: z.array(z.string().trim().toLowerCase().min(2).max(24)).max(5).default([]),
  linkedProjectId: Id.optional(),
})
// → { id, slug, url }
// PATCH  /api/discussions/[discussionId]   (author ≤ 24 h, or moderator)  → { id, updatedAt }
// DELETE /api/discussions/[discussionId]                                   → { deleted: true }

// POST /api/discussions/[discussionId]/comments
const CommentCreate = z.object({ body: z.string().trim().min(2).max(8000), parentId: Id.optional() })
// → { commentId, depth: number, url }
// PATCH  /api/comments/[commentId]  body: { body: 2..8000 }  → { id, editedAt }
// DELETE /api/comments/[commentId]                            → { deleted: true }
// POST   /api/comments/[commentId]/vote  body: { value: -1|0|1 } → { score: number, viewerVote: -1|0|1 }

// PATCH /api/profile
const ProfileUpdate = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  handle: Handle.optional(),
  bio: z.string().trim().max(600).optional(),
  location: z.string().trim().max(60).optional(),
  website: Url.optional().or(z.literal('')),
  socials: z.array(z.object({ kind: z.enum(['github','x','mastodon','bluesky','itch','youtube','linkedin']), url: Url })).max(6).optional(),
  pinnedProjectIds: z.array(Id).max(3).optional(),
  pronouns: z.string().trim().max(24).optional(),
})
// → { handle, displayName, url }   409 on handle conflict

// POST /api/profile/avatar        multipart, ≤ 2 MB, image/png|jpeg|webp
// → { avatarUrl, width, height }

// PATCH /api/settings/notifications
const NotificationPrefs = z.object({
  channels: z.object({ email: z.boolean(), inApp: z.boolean() }),
  events: z.record(
    z.enum(['feedback.new','feedback.reply','suggestion.shipped','request.received','request.delivered',
            'bounty.claimed','discussion.reply','mention','follower.new','digest.weekly']),
    z.object({ email: z.boolean(), inApp: z.boolean() })
  ),
  quietHours: z.object({ start: z.number().int().min(0).max(23), end: z.number().int().min(0).max(23), tz: z.string().max(64) }).nullable(),
})
// → { savedAt }

// PATCH /api/settings/appearance
const Appearance = z.object({
  theme: z.enum(['dark','light','system']),
  density: z.enum(['comfortable','compact']),
  reducedMotion: z.enum(['system','always']),
})
// → { ok: true }   sets ws_theme / ws_density / ws_motion cookies (1 year, httpOnly:false, sameSite:'lax')

// POST /api/notifications/read
const MarkRead = z.object({ ids: z.array(Id).max(200).optional(), all: z.boolean().default(false) })
  .refine(v => v.all || (v.ids?.length ?? 0) > 0, { message: 'Nothing to mark' })
// → { unreadCount: number }

// GET /api/notifications/stream        text/event-stream, heartbeat every 25 s,
//                                      events: notification | unread-count | ping; client reconnects with backoff

// POST /api/uploads                    multipart
const UploadMeta = z.object({
  purpose: z.enum(['project-media','avatar','feedback-attachment']),
  filename: z.string().max(255),
})
// Accepts image/png|jpeg|webp|gif, video/mp4|webm. Type is sniffed from magic bytes,
// never trusted from Content-Type. ≤ 25 MB (2 MB for avatars). Files are written under
// a content-hash name; the original filename is stored as a label only.
// → { uploadId, url, mime, bytes, width?, height?, durationSeconds? }
// 413 PAYLOAD_TOO_LARGE | 415 UNSUPPORTED_MEDIA

// GET /api/search?q=&in=&limit=        typeahead for the command palette
const SearchQuery = z.object({ q: z.string().trim().min(2).max(120), in: z.enum(['all','projects','people','discussions']).default('all'), limit: z.coerce.number().int().min(1).max(20).default(8) })
// → { groups: [{ kind, items: [{ id, title, subtitle, url, avatarUrl? }] }] }

// GET /api/tags?q=                     → { tags: [{ tag, count }] }
// GET /api/health                      → { ok: true, version, db: 'up', ai: { anthropic: boolean, openai: boolean, kimi: boolean } }
```

---

## 7. UI primitives

All hand-built in `src/components/ui/`. Shared conventions: every primitive accepts `className` merged through `cn()`; every interactive primitive forwards its ref and spreads rest props onto the underlying element; **no primitive removes the focus ring** — the base ring is `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--ring]` at ≥3:1 against both the component and its surroundings (2.4.11/2.4.13); disabled controls use `aria-disabled` + a click guard rather than the `disabled` attribute wherever the control must stay focusable and explain itself.

### 7.1 Actions

**`Button`**
```ts
{ variant?: 'primary'|'secondary'|'ghost'|'danger'|'link'   // default 'secondary'
  size?: 'sm'|'md'|'lg'                                      // md = 40px, sm = 32px (still 24px target min)
  loading?: boolean; loadingLabel?: string                   // default 'Working…'
  disabled?: boolean; iconStart?: ReactNode; iconEnd?: ReactNode
  fullWidth?: boolean; type?: 'button'|'submit'|'reset'; asChild?: boolean }
```
States: `hover` · `active` · **`focus-visible`** (2px ring, offset 2, never removed on mouse click) · **`disabled`** (`aria-disabled`, 45 % opacity, cursor `not-allowed`, tooltip-explained when the reason is non-obvious) · **`loading`** (spinner replaces `iconStart`, width locked to the resting width to prevent reflow, `aria-busy="true"`, `aria-live="polite"` announcing `loadingLabel`, pointer events off) · `pressed` (for toggle use) · **`error`** (transient 2 s shake-free red outline + `role="alert"` sibling when the action failed in place).

**`IconButton`** — `Button` minus children, plus **required** `label: string` (rendered as `aria-label` and as the `Tooltip` content). Same states. A missing label is a type error.

**`ButtonGroup`** — `{ orientation?: 'horizontal'|'vertical'; attached?: boolean }`. Manages border collapsing and roving tabindex when `role="group"` children are toggles.

**`AppLink`** — wraps `next/link`: `{ href; prefetch?; external?: boolean; underline?: 'always'|'hover'|'none' }`. External links get `rel="noopener noreferrer"` and a visually-hidden "(opens in a new tab)". States: `hover` · **`focus-visible`** · `visited` (prose contexts only) · `disabled` (renders a `<span aria-disabled>`).

### 7.2 Forms

**`Field`** — the composition root every input sits inside.
```ts
{ label: string; labelHidden?: boolean; hint?: ReactNode; error?: string | string[]
  required?: boolean; optionalLabel?: boolean; id?: string; children: (a: FieldAria) => ReactNode }
type FieldAria = { id: string; 'aria-describedby'?: string; 'aria-invalid'?: true; 'aria-required'?: true }
```
Generates ids via `useId`, wires `aria-describedby` to hint **and** error together, renders the error with `role="alert"`. States: `default` · `focus-within` · **`error`** (red border on the control, error text with an inline icon — colour is never the only signal, 1.4.1) · **`disabled`** (label + hint dimmed) · `readonly`.

**`Input`** — `{ type?: 'text'|'email'|'password'|'url'|'search'|'number'; invalid?: boolean; loading?: boolean; prefix?; suffix?; clearable?: boolean; autoComplete: string }`. `autoComplete` is **required** by the type (1.3.5 identify input purpose). States: rest · hover · **focus-visible** · **disabled** · readonly · **error** · **loading** (trailing spinner, for async validation like handle availability) · `filled`.

**`PasswordInput`** — `Input` + a reveal `IconButton` whose label toggles between "Show password"/"Hide password" and whose state change is announced; `autoComplete` restricted to `current-password | new-password`.

**`Textarea`** — `{ autoGrow?: boolean; minRows?: number; maxRows?: number; maxLength?: number; showCount?: boolean }`. The character counter is `aria-live="polite"` but only announces at 90 % and 100 % of the limit (announcing every keystroke is a screen-reader disaster). Same state set as `Input`.

**`Select`** — native `<select>` styled; `{ options: {value,label,disabled?}[]; placeholder?: string }`. Native is deliberate: mobile pickers and AT support beat any custom listbox. States as `Input`.

**`Combobox`** — `{ items; value; onChange; onSearch; loading?: boolean; emptyMessage?: string; multiple?: boolean }`. Full ARIA 1.2 combobox: `role="combobox"` + `aria-expanded` + `aria-controls` + `aria-activedescendant`, Home/End/Esc/typeahead, results count in a live region. States: closed · open · **focus-visible** · **loading** (spinner + `aria-busy` on the listbox) · **empty** (`emptyMessage`) · **error** · **disabled**.

**`TagInput`** — `{ value: string[]; max?: number; suggest?: (q) => Promise<string[]>; allowCreate?: boolean }`. Each tag is a removable chip reachable by arrow keys; Backspace on an empty input removes the last tag *with* a live announcement. States: default · **focus-visible** · at-max (input disabled, counter turns warning) · **error** · **disabled** · **loading** (suggestions).

**`Checkbox` / `Radio` / `RadioGroup`** — `{ label; description?; invalid?; indeterminate? (checkbox) }`. `RadioGroup` is a real `<fieldset>`+`<legend>` with roving arrow-key focus. States: unchecked · checked · indeterminate · **focus-visible** · **disabled** · **error** (group-level message via `aria-describedby` on the fieldset).

**`Switch`** — `role="switch"` + `aria-checked`, `{ label; labelPosition?; describedBy? }`. Never used for anything requiring a Save button. States: off · on · **focus-visible** · **disabled** · **loading** (optimistic in-flight: a small spinner inside the thumb, `aria-busy`) · **error** (reverts with a `role="alert"` message).

**`RatingScale`** — the composer's 1–5 control. `{ name; value; onChange; min?: 1; max?: 5; lowLabel: string; highLabel: string; describedBy? }`. Implemented as a **radio group**, not stars: each option has a real label ("3 — works but unremarkable"), arrow keys move, and the endpoints are labelled in visible text. States: unselected · selected · **focus-visible** (ring on the individual option) · **disabled** · **error**.

**`Slider`** — `{ min; max; step; value; onChange; formatValue?; label }`, `role="slider"` with `aria-valuetext`. States: rest · dragging · **focus-visible** · **disabled** · **error**.

**`SegmentedControl`** — `{ options; value; onChange; size? }`, `role="radiogroup"` with roving tabindex and a sliding indicator that respects reduced motion. States: per-segment selected/unselected · **focus-visible** · **disabled** (whole or per-option).

**`FileDrop`** — `{ accept: string[]; maxBytes: number; multiple?: boolean; onFiles; hint? }`. Drop is an enhancement; the button-triggered file input is the primary path (2.5.7). Per-file rows show name, size, a progress `<Meter>`, and a remove button. States: idle · dragging-over · **uploading** (per-file progress, `aria-busy`) · success · **error** (per-file message: too large, wrong type, network) · **disabled**.

**`Form` + `SubmitButton`** — `Form` wires `useActionState`, renders an `<ErrorSummary>` at the top on failure (`role="alert"`, focuses itself, links to each invalid field by id), and blocks double submit. `SubmitButton` uses `useFormStatus` for its own loading state.

### 7.3 Overlays

**`Dialog`**
```ts
{ open; onOpenChange; title: string; description?: string
  size?: 'sm'|'md'|'lg'|'full'; dismissible?: boolean          // false for destructive confirms
  initialFocus?: RefObject<HTMLElement>; footer?: ReactNode }
```
Native `<dialog>` + `showModal()` where supported, with a focus-trap fallback. Restores focus to the invoker on close, Esc closes when `dismissible`, background is `inert`, scroll locked without layout shift (scrollbar-gutter). States: closed · opening/closing (respects reduced motion) · open · **loading** (footer button's loading state; the dialog itself becomes `aria-busy` and non-dismissible) · **error** (inline `<Banner variant="danger">` above the footer — the dialog never closes on failure).

**`Drawer`** — same contract plus `{ side: 'left'|'right'|'bottom' }`. Bottom sheets are swipe-dismissible *and* have a close button.

**`Popover`** — `{ trigger; placement?; offset?; matchTriggerWidth?: boolean }`. Non-modal, Esc closes, focus returns to trigger, closes on outside pointerdown. States: closed · open · **focus-visible** on trigger · **disabled**.

**`DropdownMenu`** — `role="menu"` with `menuitem`/`menuitemradio`/`menuitemcheckbox`, typeahead, submenus, destructive items styled distinctly. States: closed · open · item hover/focus · **disabled item** (focusable and announced as disabled, not skipped) · **loading** (async item shows a spinner and keeps the menu open).

**`Tooltip`** — `{ content: string; placement?; delay? }`. Hover **and** focus triggered, dismissible with Esc, stays open while the pointer moves onto it (1.4.13). Never carries information available nowhere else, and never wraps a disabled native control (which wouldn't fire events) — the wrapper handles that.

**`Toast` / `Toaster`** — `{ title; description?; variant: 'info'|'success'|'warning'|'danger'; action?: {label,onClick}; duration?: number|'persist' }`. Region is `role="status"` for info/success and `role="alert"` for danger. Toasts with an action never auto-dismiss. States: entering · visible · **paused** (pointer or focus inside) · exiting · stacked (max 3, overflow collapses to "+2 more").

**`CommandPalette`** — ⌘K. `{ groups; onSearch; recent }`. Combobox semantics, async results with a `loading` row, `emptyMessage`, and keyboard-only operation end to end.

### 7.4 Structure & content

**`Card`** — `{ as?; interactive?: boolean; padding?: 'none'|'sm'|'md'|'lg'; elevated?: boolean }`. When `interactive`, the whole card is a link via a stretched pseudo-element on a single real `<a>` — never a `div` with `onClick`. States: rest · hover · **focus-visible** (ring on the card, driven by `:focus-within`) · **disabled/muted** (e.g. a closed bounty) · **loading** (renders `CardSkeleton`).

**`Surface` / `Panel`** — `{ level: 0|1|2|3; border?: boolean }`. The elevation scale is the dark-mode backbone: in dark, elevation is lighter surface, not shadow; in light, elevation is shadow plus border.

**`Tabs`** — real ARIA tabs for in-page state; when tabs map to routes, the primitive renders `<nav>` + links with `aria-current="page"` instead (`{ mode: 'aria'|'links' }`). States: selected · unselected · **focus-visible** · **disabled tab** · overflow (scrollable with edge fades and keyboard scroll).

**`Disclosure` / `Accordion`** — `<details>`/`<summary>`-based so it works without JS; `{ multiple?: boolean; defaultOpen? }`. States: collapsed · expanded · **focus-visible** on the summary · **disabled**.

**`Table`** — `{ columns: Column[]; rows; caption: string; sort?; onSort?; stickyHeader?; density? }`. Real `<table>` with `<caption>`, `scope` on headers, `aria-sort` on sorted columns. Horizontal overflow wraps in a `tabIndex={0}` scroll region with an accessible name (keyboard users must be able to scroll it). States: default · sorted asc/desc · row hover · row selected · **loading** (`TableSkeleton` with matching column widths) · **empty** (a full-width row containing `<EmptyState>`) · **error** (full-width row with retry).

**`Pagination` / `LoadMore`** — `{ nextCursor; total?; onLoad }`. `LoadMore` announces "20 more loaded, 60 of 148" in a live region. States: idle · **loading** · **exhausted** ("That's everything") · **error** (Retry).

**`Breadcrumbs`** — `{ items: {label, href?}[] }`, `<nav aria-label="Breadcrumb">`, last item `aria-current="page"`.

**`EmptyState`** — `{ icon?; title: string; body: string; primaryAction?; secondaryAction?; variant?: 'default'|'filtered'|'success' }`. `variant="success"` is what inbox-zero uses so absence doesn't read as failure.

**`ErrorState`** — `{ title?; body?; requestId?: string; onRetry?; backHref? }`. Used by every `error.tsx`.

**`Skeleton`** — `{ w?; h?; radius?; lines?: number }`. Pure CSS shimmer, `aria-hidden`, disabled entirely under `prefers-reduced-motion` (becomes a static tint). Every list has a purpose-built `*Skeleton` composed from it so the loading layout matches the loaded layout box-for-box.

**`Spinner`** — `{ size?; label?: string }`. Decorative by default (`aria-hidden`), labelled when it is the only loading indicator.

**`Progress`** (determinate task) and **`Meter`** (a measurement: signal strength, password strength, review threshold) — distinct primitives with distinct ARIA roles, because conflating them produces wrong announcements. `Meter`: `{ value; min; max; optimum?; segments?; label; valueText }`.

**`Banner`** — in-flow message. `{ variant: 'info'|'success'|'warning'|'danger'; title; body?; action?; dismissible?; persistKey?: string }`. `role="status"` or `role="alert"` by variant.

**`Badge`** / **`Chip`** / **`FilterChip`** — `Badge` is non-interactive status (`{ tone; children }`). `Chip` is a removable token. `FilterChip` is a toggle with `aria-pressed` and an optional count. Chip states: rest · selected · **focus-visible** · **disabled** · **loading** (count resolving) · removable-hover.

**`Avatar` / `AvatarGroup`** — `{ src?; name: string; size; shape? }`. Falls back to initials over a hue derived from `hashCode(userId)` (the helper already in `src/lib/utils.ts`), with `alt=""` when the name is adjacent in text and a real `alt` when standalone. `AvatarGroup` collapses past `max` into "+7" with an accessible full list in a popover.

**`Stat`** — `{ label; value; delta?; deltaDirection?; hint? }`. Delta direction is conveyed by an arrow glyph plus text, not colour alone. States: default · **loading** (skeleton keeping the numeral's width) · **empty** (renders `—` with a hint explaining why).

**`Sparkline` / `BarChart` / `SentimentBar`** — `{ data; label; formatValue }`. Every chart renders an adjacent visually-hidden `<table>` of the same data and accepts `describedBy`. `SentimentBar` is the insights primitive: a stacked positive/mixed/negative bar with per-segment labels and percentages in text.

**`Prose`** — sanitized markdown renderer. `{ content: string; allow: 'comment'|'article' }`. Server-side sanitization (allowlist of tags/attrs, `rel="ugc nofollow noopener"` on links, no raw HTML, no `javascript:` URLs), heading levels shifted so user content can never inject an `<h1>`, and `max-w-[65ch]`.

**`CodeBlock`** — `{ code; lang?; filename?; wrap? }` with a `CopyButton`, a scrollable `tabIndex={0}` region, and no syntax-highlighting dependency (a small tokenizer for the ~6 languages that matter).

**`MediaGallery` / `Lightbox`** — `{ items: Media[]; initialIndex? }`. Thumbnails are a roving-tabindex listbox; the lightbox is a `Dialog` with arrow-key navigation, a visible counter ("3 of 7"), pinch/scroll zoom, and required `alt` per item. States: loading (blurhash-free: a reserved-aspect tint) · loaded · **error** (a labelled broken-media placeholder, never a silent gap) · empty (slot collapses).

**`EmbedFrame`** — `{ provider; url; title: string; aspect }`. Click-to-load poster with a visible "Load from YouTube — this shares your IP with YouTube" notice; the iframe is sandboxed and `title` is required. States: poster · **loading** · loaded · **blocked** (provider refused framing → falls back to a labelled outbound link).

**`StepIndicator`** — `{ steps; current; completed }` for the project wizard; `<ol>` with `aria-current="step"` and completion announced.

**`SortableList`** — the accessible drag primitive behind the suggestion board. `{ items; onMove; getItemLabel; groups }`. Pointer drag, keyboard lift/move/drop, and a "Move to…" menu on every item; every state change is announced ("*Fix tutorial pacing* moved to Planned, position 2 of 6"). States: idle · lifted · dragging-over · dropped · **error/reverted**.

**Utilities** — `VisuallyHidden`, `Portal`, `FocusTrap`, `ScrollArea` (keyboard-focusable when scrollable), `Separator` (`role="separator"` or decorative), `Kbd`, `Timestamp` (`<time dateTime>` + `relativeTime()` from `src/lib/utils.ts`, with the absolute date in `title` and in a tooltip), `CopyButton` (idle → **loading** → copied-for-2 s with a live announcement → **error**), `ThemeToggle` (3-state: dark/light/system, writes the cookie via `/api/settings/appearance` and updates `document.documentElement.dataset.theme` immediately).

### 7.5 The four states every primitive must prove

Before a primitive is considered done it is checked against all four in Storybook-free "states pages" under `/dev/primitives` (dev-only route, excluded from the build):

1. **focus-visible** — reachable by Tab, ring visible in both themes at ≥3:1, ring not clipped by any `overflow-hidden` ancestor, not obscured by sticky chrome.
2. **disabled** — visually distinct at ≥3:1 for non-text contrast where the control still conveys meaning, programmatically announced, and *explained* (why is this off?) rather than silently inert.
3. **loading** — dimensions locked so nothing reflows, `aria-busy` set, an announcement that fires once (not per frame), and pointer/keyboard activation blocked for the duration.
4. **error** — message associated via `aria-describedby`, `role="alert"` on appearance, colour never the sole carrier, and recovery (retry/undo/edit) always offered.

---

## 8. Implementation notes tied to the existing scaffold

- `src/lib/auth.ts` already implements scrypt hashing, HS256 signing, and the `ws_session` cookie. It needs three additions to match this spec: `sid` and `sv` claims in `SessionClaims`, a `sessions` table + `requireUser()` in `src/server/auth/require-user.ts` doing the authoritative revocation check, and the CSRF cookie set alongside the session.
- `src/server/db/client.ts` expects `src/server/db/schema.sql`, which does not exist yet — it is the next file to write, and it must include `rate_limit`, `sessions`, and `password_reset_tokens` alongside the domain tables.
- `zod@3.25` is installed; the schemas above use the classic v3 API (`z.string().email()`). If you prefer the v4 surface (`z.email()`, better `superRefine` ergonomics), 3.25 exposes it at the `zod/v4` subpath — pick one and use it uniformly, because mixing the two produces confusing type errors at schema composition boundaries.
- `motion@12` is installed; confine it to the client islands that genuinely need it (`Dialog`, `Drawer`, `Toaster`, `SortableList`, `SegmentedControl` indicator) and gate every animation on `useReducedMotion()`.
- AI-optional behavior is already modeled in `src/lib/env.ts` via `aiAvailability()`. The only AI-touching routes in this map are `POST /api/projects/[projectId]/insights` and the composer's optional "sharpen my wording" assist; both must return the deterministic result with `method: 'deterministic'` when no key is configured, and the UI must say so rather than hiding it.