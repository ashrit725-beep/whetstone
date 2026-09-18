import { EmptySection } from '@/components/project/empty-section'
import { ProjectShell, Wrap } from '@/components/project/project-shell'

export default function ProjectNotFound() {
  return (
    <ProjectShell>
      <Wrap className="pt-24 pb-32">
        <EmptySection
          headingLevel={1}
          title="No project at this address"
          body="It may have been unpublished, made private, or the link may have a typo in it. The Discover feed lists everything that is open for feedback right now."
          action={{ label: 'Browse Discover', href: '/discover' }}
        />
      </Wrap>
    </ProjectShell>
  )
}
