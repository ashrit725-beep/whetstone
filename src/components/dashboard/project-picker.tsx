/**
 * Which project a dashboard page is about.
 *
 * The inbox always had this row; the overview, Insights and the tracker did
 * not, so a creator with three projects saw whichever one the page defaulted to
 * and had no way to reach the others short of editing the URL. Same chips,
 * same `?project=` param, on every page that is scoped to one project.
 *
 * A row of links, not a select: each one is a real, shareable URL that works
 * with JavaScript switched off, and two or three projects fit on one line. With
 * a single project there is nothing to choose, so nothing renders.
 */

import { FilterChipLink } from '@/components/ui'

export interface ProjectPickerProps {
  projects: readonly { readonly id: string; readonly title: string; readonly count?: number }[]
  /** The project id in view, or `'all'`. */
  selected: string
  /** Where each chip goes. Called with a project id, or `'all'` for the whole account. */
  href: (project: string) => string
  /** Offer “All projects”, for pages that can show every project at once. */
  allowAll?: boolean
}

export function ProjectPicker({ projects, selected, href, allowAll = false }: ProjectPickerProps) {
  if (projects.length < 2) return null
  return (
    <fieldset className="m-0 flex flex-col gap-xs border-0 p-0">
      <legend className="p-0 text-xs text-text-3">Project</legend>
      <div className="flex flex-wrap gap-xs">
        {projects.map((project) => (
          <FilterChipLink
            key={project.id}
            href={href(project.id)}
            selected={selected === project.id}
            {...(project.count !== undefined ? { count: project.count } : {})}
          >
            {project.title}
          </FilterChipLink>
        ))}
        {allowAll ? (
          <FilterChipLink href={href('all')} selected={selected === 'all'}>
            All projects
          </FilterChipLink>
        ) : null}
      </div>
    </fieldset>
  )
}

export default ProjectPicker
