/**
 * Where a notification sends you.
 *
 * These were written as inline template strings next to each `notify()` call,
 * against route shapes that never existed: `/projects/…` where the route is
 * `/p/…`, `/discussions/…` where it is `/c/…`, and `/earnings`, `/requests/:id`,
 * `/p/:slug/tracker` and `/dashboard/inbox/:id`, none of which are routes at
 * all. Every notification of those kinds was a dead link, which is the worst
 * possible defect in the one surface whose entire job is to bring somebody back.
 *
 * One module now owns the mapping, so a route rename breaks a build here rather
 * than quietly breaking the bell. `scripts/audit.mjs` asserts that every stored
 * `notifications.url` still resolves to a real route.
 */

/** The project itself. */
export const projectUrl = (slug: string): string => `/p/${slug}`

/** The build history, where a shipped change is visible. */
export const projectBuildsUrl = (slug: string): string => `/p/${slug}/versions`

/**
 * One note, on the project page that renders it. `FeedbackNote` puts
 * `id="note-<id>"` on its article, so the fragment lands the reader on it.
 */
export const noteOnProjectUrl = (slug: string, feedbackId: string): string =>
  `/p/${slug}#note-${feedbackId}`

/**
 * One note, opened in the creator's inbox. The inbox page reads `note` from its
 * search params and renders that note above the register; the fragment lands
 * the reader on it even before any script has run.
 */
export const noteInInboxUrl = (feedbackId: string): string =>
  `/dashboard/inbox?note=${encodeURIComponent(feedbackId)}#open-note`

/** A discussion thread. The channel segment is part of the route. */
export const threadUrl = (channelSlug: string, threadId: string): string =>
  `/c/${channelSlug}/${threadId}`

/** A bounty, which is also where its awards and their state are shown. */
export const bountyUrl = (bountyId: string): string => `/bounties/${bountyId}`

/** The creator's own suggestion tracker. */
export const suggestionTrackerUrl = (): string => '/dashboard/suggestions'

/** A person. */
export const profileUrl = (handle: string): string => `/u/${handle}`
