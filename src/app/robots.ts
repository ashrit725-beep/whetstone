import type { MetadataRoute } from 'next'
import { siteOrigin } from '@/server/api/site'

/**
 * What a crawler may read.
 *
 * Everything public is allowed. The disallow list is the set of surfaces that
 * are either personal (the dashboard, the notification list, settings), a
 * machine endpoint (`/api`), a composer behind a sign-in, or a search results
 * page, which is a view of pages that are indexed on their own and would be
 * duplicate content. A crawler that fetched any of them would get a sign-in
 * redirect or a thin page, so the rule saves it the round trip.
 *
 * Every path below is a route that exists. A disallow rule naming a route that
 * was renamed is worse than no rule: it reads as coverage and provides none.
 *
 * Not a security control. Authorisation is enforced per request in the handler
 * layer; this file is a courtesy to well-behaved crawlers.
 */

export const dynamic = 'force-dynamic'

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin()

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Machine endpoints.
          '/api/',
          // Personal surfaces. A crawler would only ever be redirected to sign in.
          '/dashboard',
          '/settings',
          '/notifications',
          '/search',
          // Composers. Each is a form behind a sign-in.
          '/new',
          '/bounties/new',
          '/experts/*/request',
          '/p/*/playtest',
          // Authentication. Nothing here is a landing page.
          '/sign-in',
          '/sign-up',
          '/forgot-password',
          '/reset-password',
          '/verify-email',
        ],
      },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  }
}
