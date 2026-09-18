/**
 * The frame the three project routes share.
 *
 * It constrains nothing but the measure. Sections set their own vertical
 * rhythm, because a page where every band has the same padding reads as a
 * spreadsheet; the disagreement band in particular is meant to be a change of
 * ground, which it cannot be if the shell has already painted it.
 *
 * Server-safe. Its only job is that the title, the tab row and the first line
 * of body copy start on exactly the same left edge on all three routes.
 */

import { ProjectStyles } from './styles'

export function Wrap({
  children,
  className,
  as: As = 'div',
}: {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'section'
}) {
  return (
    <As className={`pad-inline mx-auto w-full max-w-page ${className ?? ''}`}>{children}</As>
  )
}

export interface ProjectShellProps {
  children: React.ReactNode
}

export function ProjectShell({ children }: ProjectShellProps) {
  return (
    <div className="flex w-full flex-col">
      <ProjectStyles />
      {children}
    </div>
  )
}

export default ProjectShell
