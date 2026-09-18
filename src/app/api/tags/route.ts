import { z } from 'zod'
import { searchTags, trendingTags } from '@/server/repos/tags'
import { handler } from '@/server/api/handler'
import { LIMITS } from '@/server/api/limits'
import { Limit } from '@/server/api/schema'

/**
 * GET /api/tags
 *
 * Tag typeahead for the project and discussion composers. With no `q` it
 * returns what is actually being used right now rather than an alphabetical
 * list, because the useful default in a tag field is "what do people call this
 * already", not "what exists".
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const TagQuery = z.object({
  q: z.string().trim().max(48).optional(),
  limit: Limit.default(12),
})

export const GET = handler({
  auth: 'optional',
  limit: LIMITS.tags,
  query: TagQuery,
  run({ query, viewer, setMeta }) {
    const term = query.q ?? ''

    const tags =
      term.length >= 2
        ? searchTags(term, query.limit).map((tag) => ({
            slug: tag.slug,
            label: tag.label,
            count: tag.usage_count,
          }))
        : trendingTags(query.limit, viewer?.id ?? null).map((tag) => ({
            slug: tag.slug,
            label: tag.label,
            count: tag.usageCount,
          }))

    setMeta({ total: tags.length })
    return { query: term, trending: term.length < 2, tags }
  },
})
