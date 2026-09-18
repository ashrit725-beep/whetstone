import { headers } from 'next/headers'

/**
 * Where this deployment lives, and the canonical path for every linkable thing.
 *
 * Sitemaps, the RSS feed, OG image URLs and `alternates.canonical` all need one
 * absolute origin, and getting it from three places is how a feed ends up
 * linking at localhost in production. `SITE_URL` wins; otherwise the request's
 * own forwarded host is used, which is correct on a preview deployment; the
 * development port is the last resort.
 *
 * The path helpers exist so every surface agrees on one address per resource.
 * The repository layer already writes `/p/<slug>` into notification and
 * activity rows, so these mirror that rather than inventing a second spelling.
 */

const DEV_ORIGIN = 'http://localhost:4311'

function fromEnv(): string | null {
  const raw = process.env['SITE_URL'] ?? process.env['NEXT_PUBLIC_SITE_URL']
  if (!raw || raw.trim().length === 0) return null
  const trimmed = raw.trim().replace(/\/+$/, '')
  try {
    return new URL(trimmed).origin
  } catch {
    return null
  }
}

/** Synchronous origin. Correct in production, falls back in development. */
export function siteOrigin(): string {
  return fromEnv() ?? DEV_ORIGIN
}

/**
 * Origin derived from the live request when no `SITE_URL` is configured. Only
 * usable where `headers()` is allowed: a route handler, a Server Component, or
 * `generateMetadata`.
 */
export async function requestOrigin(): Promise<string> {
  const configured = fromEnv()
  if (configured) return configured
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  if (!host) return DEV_ORIGIN
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export function absolute(path: string): string {
  return new URL(path, `${siteOrigin()}/`).toString()
}

/* -------------------------------------------------------------------------- *
 * Canonical paths
 * -------------------------------------------------------------------------- */

export const paths = {
  home: '/',
  discover: '/discover',
  community: '/c',
  experts: '/experts',
  bounties: '/bounties',
  howItWorks: '/how-it-works',
  project: (slug: string): string => `/p/${slug}`,
  projectFeedback: (slug: string): string => `/p/${slug}/feedback`,
  profile: (handle: string): string => `/u/${handle}`,
  expert: (handle: string): string => `/experts/${handle}`,
  thread: (channelSlug: string, threadId: string): string => `/c/${channelSlug}/${threadId}`,
  bounty: (bountyId: string): string => `/bounties/${bountyId}`,
  feed: '/feed.xml',
} as const

export const SITE_NAME = 'Whetstone'

/** The one-line description used wherever a page has not written its own. */
export const SITE_DESCRIPTION =
  'Post the build. Pick the questions. Get review notes back, sorted by theme.'
