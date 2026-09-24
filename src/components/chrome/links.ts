/**
 * Destination resolution for the chrome.
 *
 * Notification rows carry a URL written by `src/server/repos/notifications.ts`
 * against the route table in `design/ROUTES.md`: `/projects/[slug]/…`,
 * `/community/[threadId]`, `/dashboard/inbox/[feedbackId]`. The app routes
 * differently — projects at `/p/[slug]`, threads at `/c/[channel]/[id]`, and
 * no per-feedback permalink — so a row rendered verbatim is a link to a 404,
 * which the contract bans outright (ban 32).
 *
 * The bell cannot rewrite the repository, so it translates on the way out and
 * drops anything it cannot land somewhere true. Dropping is the right failure:
 * a notification the reader cannot act on is not a row worth drawing.
 *
 * Every target below was checked against `src/app`. When a route is added, the
 * rule for it moves from "nearest true page" to the real one and the rest of
 * this file does not change.
 */

/** Looks a thread id up to its channel, so `/c/[channel]/[id]` can be built. */
export type ChannelLookup = (threadId: string) => string | null

/**
 * Home for this reader: Discover when signed in, the front page when not.
 *
 * Every wordmark on a page is a link called "Whetstone, home", so they must all
 * resolve home the same way. Working it out in two places is how the nav came
 * to point a member at `/discover` while the footer under it sent the same
 * member out to the marketing page (SC 3.2.4, Consistent Identification).
 */
export function homeHref(signedIn: boolean): string {
  return signedIn ? '/discover' : '/'
}

/** A route that exists in `src/app` and needs no translation. */
const PASSES: readonly RegExp[] = [
  /^\/discover(?:\?|$)/,
  /^\/experts(?:\/[^/]+)?(?:\?|$)/,
  /^\/bounties(?:\/[^/]+)?(?:\?|$)/,
  /^\/u\/[^/]+(?:\/(?:projects|reviews|reputation))?(?:\?|$)/,
  /^\/p\/[^/]+(?:\/(?:feedback|versions|playtest))?(?:\?|$)/,
  /^\/c(?:\/[^/]+){0,2}(?:\?|$)/,
  /^\/dashboard(?:\/(?:inbox|insights|suggestions))?(?:\?|$)/,
  /^\/settings\/(?:profile|account|appearance|notifications|danger)(?:\?|$)/,
  /^\/new(?:\?|$)/,
  /^\/notifications(?:\?|$)/,
]

/**
 * Rewrites a repository URL to the nearest page that exists and is true.
 * Returns `null` when there is no honest destination, so the caller can drop
 * the row rather than draw a dead one.
 */
export function resolveChromeHref(raw: string, channelFor?: ChannelLookup): string | null {
  const url = raw.trim()
  if (url.length === 0 || !url.startsWith('/')) return null
  if (PASSES.some((re) => re.test(url))) return url

  const path = url.split(/[?#]/)[0] ?? url

  /* A thread. The id is addressable only under its own channel, so a row we
     cannot place lands on the channel index rather than nowhere. */
  const thread = /^\/(?:community|discussions)\/([^/]+)$/.exec(path)
  if (thread?.[1]) {
    const id = thread[1]
    const channel = channelFor?.(id) ?? null
    return channel === null ? '/c' : `/c/${channel}/${id}`
  }
  const threadWithChannel = /^\/(?:community|discussions)\/([^/]+)\/([^/]+)$/.exec(path)
  if (threadWithChannel) return `/c/${threadWithChannel[1]}/${threadWithChannel[2]}`
  if (/^\/(?:community|discussions)$/.test(path)) return '/c'

  /* A project, or anything under one. Only three sub-pages exist, and
     `/p/[slug]/feedback` is the composer, not a permalink: a row saying
     somebody reviewed you must not open a blank review form. */
  const project = /^\/projects\/([^/]+)(?:\/(.*))?$/.exec(path)
  if (project?.[1]) {
    const slug = project[1]
    const rest = project[2] ?? ''
    if (rest === 'versions' || rest === 'playtest') return `/p/${slug}/${rest}`
    return `/p/${slug}`
  }

  /* Feedback permalinks and the request queue collapse to the list that holds
     them; earnings has no page yet, so the dashboard root is the nearest true
     answer. */
  if (/^\/dashboard\/inbox\//.test(path)) return '/dashboard/inbox'
  if (/^\/dashboard\//.test(path)) return '/dashboard'

  return null
}
