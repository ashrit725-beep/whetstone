import { z } from 'zod'
import { search } from '@/server/repos/search'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { Limit, Query } from '@/server/api/schema'
import { paths } from '@/server/api/site'

/**
 * GET /api/search
 *
 * Typeahead for the command palette. Three groups, each capped, each shaped the
 * same way, so the palette renders one list component and does not branch on
 * what kind of thing it found.
 *
 * Read-only and signed-out-safe. The repository only ever returns published,
 * public rows, so there is nothing here to authorise beyond the rate limit, and
 * a signed-out visitor searching the public catalogue is a supported case.
 *
 * The `<mark>` tags FTS5 emits are stripped rather than passed through. A
 * palette row is a link, not a rich-text surface, and handing marked-up user
 * text to a client is how an escaping bug becomes an injection bug.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SearchQuery = z.object({
  q: Query,
  in: z.enum(['all', 'projects', 'people', 'discussions']).default('all'),
  limit: Limit.default(8),
})

type Group = {
  kind: 'projects' | 'people' | 'discussions'
  label: string
  items: { id: string; title: string; subtitle: string; url: string; imageUrl: string | null }[]
}

function plain(text: string): string {
  return text.replace(/<\/?mark>/g, '').replace(/\s+/g, ' ').trim()
}

export const GET = handler({
  auth: 'optional',
  limit: LIMITS.search,
  query: SearchQuery,
  run({ query, viewer, setMeta }) {
    const scope = query.in === 'people' ? 'experts' : query.in
    const results = search(query.q, {
      scope,
      limit: query.limit,
      viewerId: viewer?.id ?? null,
    })

    const groups: Group[] = []

    if (results.projects.items.length > 0) {
      groups.push({
        kind: 'projects',
        label: 'Projects',
        items: results.projects.items.slice(0, query.limit).map((hit) => ({
          id: hit.project.id,
          title: hit.project.title,
          subtitle: `${hit.project.typeLabel}, ${hit.project.grit} grit, by ${hit.project.owner.displayName}`,
          url: paths.project(hit.project.slug),
          // Covers drawn by the renderer use an internal 'cover:' scheme, which
          // is not a URL anything can fetch. Only real image paths go out.
          imageUrl: fetchableImage(hit.project.cover?.thumbUrl ?? hit.project.cover?.url ?? null),
        })),
      })
    }

    if (results.experts.items.length > 0) {
      groups.push({
        kind: 'people',
        label: 'People',
        items: results.experts.items.slice(0, query.limit).map((expert) => ({
          id: expert.user.id,
          title: expert.user.displayName,
          subtitle: plain(expert.headline),
          url: paths.profile(expert.user.handle),
          imageUrl: expert.user.avatarUrl,
        })),
      })
    }

    if (results.discussions.items.length > 0) {
      groups.push({
        kind: 'discussions',
        label: 'Discussions',
        items: results.discussions.items.slice(0, query.limit).map((thread) => ({
          id: thread.id,
          title: thread.title,
          subtitle: `${thread.channel.label}, ${thread.postCount} ${
            thread.postCount === 1 ? 'reply' : 'replies'
          }`,
          url: paths.thread(thread.channel.slug, thread.id),
          imageUrl: null,
        })),
      })
    }

    const total = groups.reduce((sum, group) => sum + group.items.length, 0)
    setMeta({ total })

    return { query: query.q, scope: query.in, groups }
  },
})

function fetchableImage(url: string | null): string | null {
  if (!url) return null
  return url.startsWith('/') || url.startsWith('https://') ? url : null
}
