import { listPublishedProjects } from '@/server/queries/publishing'
import { gritStage, gritValue } from '@/lib/taxonomy'
import { requestOrigin, SITE_DESCRIPTION, SITE_NAME } from '@/server/api/site'

/**
 * RSS 2.0, to spec.
 *
 * The spec is small and specific, and most hand-written feeds break one of the
 * same four rules, so each is handled explicitly here:
 *
 *  1. `pubDate` and `lastBuildDate` are RFC-822 dates, not ISO-8601.
 *     `toUTCString()` emits exactly the form the spec's examples use.
 *  2. Every `<guid>` is a permalink and never changes once published, so an
 *     edited title does not resurface the item as unread. The project address
 *     is that identifier.
 *  3. `<atom:link rel="self">` is required by every validator for a feed served
 *     at a stable address, so the namespace is declared and the element is
 *     present.
 *  4. Text is escaped rather than wrapped in CDATA. CDATA hides an unescaped
 *     `]]>` inside a description and produces a feed that parses as garbage in
 *     exactly one reader; escaping has no such edge.
 *
 * The window is the fifty most recently published public projects. A feed is a
 * river, not an archive: the sitemap is where the whole catalogue lives.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ITEMS = 50

/** XML text escaping. Five entities, applied in the one order that is safe. */
function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Markdown to a plain sentence or two, trimmed on a word. */
function describe(text: string | null, max = 280): string {
  if (!text) return ''
  const flat = text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#*_`>]/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (flat.length <= max) return flat
  const cut = flat.slice(0, max)
  const lastSpace = cut.lastIndexOf(' ')
  const kept = lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut
  return `${kept.replace(/[,;:.–-]$/, '')}…`
}

function rfc822(ms: number): string {
  return new Date(ms).toUTCString()
}

export async function GET(): Promise<Response> {
  const origin = await requestOrigin()
  const projects = listPublishedProjects(ITEMS)
  const newest = projects[0]?.publishedAt ?? Date.now()

  const items = projects
    .map((project) => {
      const link = `${origin}/p/${project.slug}`
      const grit = gritValue(project.stageKey)
      const stageLabel = gritStage(project.stageKey)?.label ?? project.stageKey
      const summary = describe(project.tagline ?? project.summary)
      // The grit numeral rides in the description because it is the one figure
      // that tells a subscriber whether this is a sketch or a shipped build.
      const context = `${project.typeLabel}, ${stageLabel}, ${grit} of 8000 grit, by ${project.ownerName}`
      const description = summary ? `${summary} (${context})` : `${context}.`

      return [
        '    <item>',
        `      <title>${esc(project.title)}</title>`,
        `      <link>${esc(link)}</link>`,
        `      <guid isPermaLink="true">${esc(link)}</guid>`,
        `      <pubDate>${rfc822(project.publishedAt)}</pubDate>`,
        `      <description>${esc(description)}</description>`,
        `      <category>${esc(project.typeLabel)}</category>`,
        `      <category>${esc(stageLabel)}</category>`,
        '    </item>',
      ].join('\n')
    })
    .join('\n')

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${esc(`${SITE_NAME}: new projects`)}</title>`,
    `    <link>${esc(`${origin}/discover`)}</link>`,
    `    <description>${esc(SITE_DESCRIPTION)}</description>`,
    '    <language>en</language>',
    `    <lastBuildDate>${rfc822(newest)}</lastBuildDate>`,
    `    <generator>${esc(SITE_NAME)}</generator>`,
    '    <ttl>60</ttl>',
    `    <atom:link href="${esc(`${origin}/feed.xml`)}" rel="self" type="application/rss+xml" />`,
    items,
    '  </channel>',
    '</rss>',
    '',
  ].join('\n')

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600, s-maxage=600, stale-while-revalidate=3600',
    },
  })
}
