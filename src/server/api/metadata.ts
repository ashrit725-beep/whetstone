import type { Metadata } from 'next'
import type { ProjectDetail, ProfileView, ThreadCard } from '@/lib/types'
import { paths, SITE_NAME } from './site'

/**
 * `generateMetadata` helpers, so no surface ships the layout's default title.
 *
 * The root layout owns `metadataBase` and the `'%s · Whetstone'` template, so
 * every `title` returned here is the page's own half of that template and never
 * repeats the site name. Descriptions are built from real rows: a project's own
 * ask, a creator's own bio. Where a row has nothing to say, the fallback states
 * a fact about the page rather than inventing a claim about the product.
 *
 * Punctuation follows CONTRACT §3.4. `summarise()` is the one place a rendered
 * description is trimmed, so the ellipsis is a real one and there is nowhere
 * else for three periods to creep in.
 */

/** Search engines show about 155 characters. Trim on a word, close with `…`. */
export function summarise(text: string | null | undefined, max = 155): string | null {
  if (!text) return null
  const flat = text
    .replace(/[#*_`>]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (flat.length === 0) return null
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  const kept = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${kept.replace(/[,;:.–-]$/, '')}…`
}

export interface PageMetaInput {
  readonly title: string
  readonly description: string
  readonly path: string
  /** Defaults to true. Set false for a signed-in-only surface. */
  readonly index?: boolean
}

/** The general case: a static surface that knows its own title and address. */
export function pageMetadata(input: PageMetaInput): Metadata {
  const index = input.index ?? true
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: input.path },
    openGraph: {
      type: 'website',
      siteName: SITE_NAME,
      title: input.title,
      description: input.description,
      url: input.path,
    },
    twitter: { card: 'summary_large_image', title: input.title, description: input.description },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
  }
}

/** A signed-in surface. Indexing a dashboard is how private work leaks. */
export function privateMetadata(title: string, description: string): Metadata {
  return {
    title,
    description,
    robots: { index: false, follow: false },
  }
}

export function notFoundMetadata(what: string): Metadata {
  return {
    title: `${what} not found`,
    description: `This ${what.toLowerCase()} is not on Whetstone, or it is no longer public.`,
    robots: { index: false, follow: false },
  }
}

/* -------------------------------------------------------------------------- *
 * Resource metadata
 * -------------------------------------------------------------------------- */

/**
 * A project page.
 *
 * The title carries the grit numeral because that is the one number that tells
 * a reader, from a search result alone, whether this is a sketch or a shipped
 * thing. The description prefers the creator's own ask over the tagline: the ask
 * is what a reviewer is deciding whether to answer.
 */
export function projectMetadata(project: ProjectDetail): Metadata {
  const title = `${project.title} · ${project.grit} grit`
  const ask = project.asks[0]?.prompt ?? null
  const description =
    summarise(ask) ??
    summarise(project.tagline) ??
    summarise(project.summaryMd) ??
    `${project.typeLabel} by ${project.owner.displayName}, at ${project.stageLabel}, open for structured feedback.`

  const listed = project.visibility === 'public' && project.status === 'published'

  return {
    title,
    description,
    authors: [{ name: project.owner.displayName, url: paths.profile(project.owner.handle) }],
    alternates: { canonical: paths.project(project.slug) },
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      title: project.title,
      description,
      url: paths.project(project.slug),
      ...(project.publishedAt ? { publishedTime: new Date(project.publishedAt).toISOString() } : {}),
      modifiedTime: new Date(project.updatedAt).toISOString(),
    },
    twitter: { card: 'summary_large_image', title: project.title, description },
    robots: listed ? { index: true, follow: true } : { index: false, follow: false },
  }
}

export function profileMetadata(profile: ProfileView): Metadata {
  const title = `${profile.displayName} (@${profile.handle})`
  const description =
    summarise(profile.bio) ??
    `${profile.counts.projects} ${
      profile.counts.projects === 1 ? 'project' : 'projects'
    } and ${profile.counts.reviews} ${
      profile.counts.reviews === 1 ? 'review' : 'reviews'
    } on Whetstone.`

  return {
    title,
    description,
    alternates: { canonical: paths.profile(profile.handle) },
    openGraph: {
      type: 'profile',
      siteName: SITE_NAME,
      title,
      description,
      url: paths.profile(profile.handle),
      username: profile.handle,
    },
    twitter: { card: 'summary_large_image', title, description },
    robots: { index: true, follow: true },
  }
}

export function threadMetadata(thread: ThreadCard): Metadata {
  const description =
    summarise(thread.excerpt) ??
    `A ${thread.kind} in ${thread.channel.label}, with ${thread.postCount} ${
      thread.postCount === 1 ? 'reply' : 'replies'
    }.`

  return {
    title: thread.title,
    description,
    alternates: { canonical: paths.thread(thread.channel.slug, thread.id) },
    openGraph: {
      type: 'article',
      siteName: SITE_NAME,
      title: thread.title,
      description,
      url: paths.thread(thread.channel.slug, thread.id),
      publishedTime: new Date(thread.createdAt).toISOString(),
    },
    twitter: { card: 'summary_large_image', title: thread.title, description },
    robots: { index: true, follow: true },
  }
}
