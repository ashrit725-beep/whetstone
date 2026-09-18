/**
 * A person's published projects, drawn with the Discover feed's own row.
 *
 * `FeedRowItem` and its stylesheet are imported rather than reimplemented, so
 * the profile list and the feed cannot drift on geometry, hairlines, hover or
 * the stretched title overlay. The one thing this list does not inherit is the
 * feed's keyboard accelerator: j and k belong to the feed, where a reader is
 * scanning hundreds of rows, and a profile list of three would be a shortcut
 * with nowhere to go.
 *
 * `ws-bench` is the sparse floor PLAYBOOK move 1 puts under the profile's own
 * Projects tab, where the list is the whole page and one row would read as a
 * broken one. It is on by default and switched off on the overview, where
 * "Recent reviews" follows the list: there the floor was a 127-176px blank
 * under the one or two rows most creators have, before the section gap even
 * started.
 *
 * Keyboard contract: an ordinary list of links, two tab stops per row (the
 * title and the grit filter link), in visual order.
 */

import { DiscoverStyles } from '@/components/discover/discover-styles'
import { FeedRowItem } from '@/components/discover/feed-row'
import { toFeedRow } from '@/components/discover/row-data'
import { parseQueryString } from '@/components/discover/filters'
import { cn } from '@/lib/utils'
import type { ProjectCard } from '@/lib/types'

const FEED_STATE = parseQueryString('')

export interface ProjectListProps {
  projects: readonly ProjectCard[]
  /** Names the list for assistive technology. */
  label: string
  /** The three-row floor. Off where another section follows the list. */
  bench?: boolean
}

export function ProjectList({ projects, label, bench = true }: ProjectListProps) {
  return (
    <>
      <DiscoverStyles />
      <ul className={cn('ws-feed', bench && 'ws-bench')} aria-label={label}>
        {projects.map((project) => (
          <FeedRowItem key={project.id} row={toFeedRow(project, undefined, FEED_STATE)} />
        ))}
      </ul>
    </>
  )
}

export default ProjectList
