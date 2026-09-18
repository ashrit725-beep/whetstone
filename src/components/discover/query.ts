/**
 * The one place the URL state becomes a repository filter. Pure, so the page,
 * the Server Action and the empty-state's "what would dropping this show"
 * probes all ask the data layer the same question.
 */

import type { ProjectFilters } from '@/lib/types'
import type { DiscoverState } from './filters'

export function toProjectFilters(state: DiscoverState): ProjectFilters {
  return {
    typeSlug: state.typeSlug,
    grit: state.grit,
    needs: state.needs,
    tagSlugs: state.tags,
    query: state.query.length > 0 ? state.query : null,
    openOnly: state.openOnly,
  }
}
