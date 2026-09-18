import type { MetadataRoute } from 'next'
import { siteOrigin } from '@/server/api/site'
import {
  listPublicProfiles,
  listPublicThreads,
  listPublishedExperts,
  listPublishedProjects,
} from '@/server/queries/publishing'

/**
 * The sitemap, built from rows rather than from a list of paths someone wrote
 * down. Every entry is a project, profile, expert or thread that is actually
 * published and actually public, with its real last-modified timestamp, so a
 * crawler re-reads a page when the page changed and not on a schedule.
 *
 * Priorities are relative and deliberately flat. A project page is the thing
 * this product is for; a profile is how you decide whether to trust one; the
 * static surfaces are the way in. There is no 0.64-vs-0.66 hair-splitting,
 * because crawlers do not read it that way.
 */

export const dynamic = 'force-dynamic'
export const revalidate = 3600

/** Every path here is a route that exists; a 404 in a sitemap is a broken promise. */
const STATIC: readonly { path: string; priority: number; frequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, frequency: 'daily' },
  { path: '/discover', priority: 0.9, frequency: 'hourly' },
  { path: '/c', priority: 0.7, frequency: 'hourly' },
  { path: '/experts', priority: 0.7, frequency: 'daily' },
  { path: '/bounties', priority: 0.6, frequency: 'daily' },
  { path: '/how-it-works', priority: 0.5, frequency: 'monthly' },
  { path: '/for-reviewers', priority: 0.5, frequency: 'monthly' },
]

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin()
  const now = new Date()
  const url = (path: string): string => `${origin}${path}`

  const staticEntries: MetadataRoute.Sitemap = STATIC.map((entry) => ({
    url: url(entry.path),
    lastModified: now,
    changeFrequency: entry.frequency,
    priority: entry.priority,
  }))

  const projects: MetadataRoute.Sitemap = listPublishedProjects(2000).map((project) => ({
    url: url(`/p/${project.slug}`),
    lastModified: new Date(project.updatedAt),
    changeFrequency: 'weekly',
    priority: 0.8,
  }))

  const profiles: MetadataRoute.Sitemap = listPublicProfiles(5000).map((entry) => ({
    url: url(entry.path),
    lastModified: new Date(entry.lastModified),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  const experts: MetadataRoute.Sitemap = listPublishedExperts(2000).map((entry) => ({
    url: url(entry.path),
    lastModified: new Date(entry.lastModified),
    changeFrequency: 'weekly',
    priority: 0.6,
  }))

  const threads: MetadataRoute.Sitemap = listPublicThreads(2000).map((entry) => ({
    url: url(entry.path),
    lastModified: new Date(entry.lastModified),
    changeFrequency: 'weekly',
    priority: 0.5,
  }))

  return [...staticEntries, ...projects, ...profiles, ...experts, ...threads]
}
