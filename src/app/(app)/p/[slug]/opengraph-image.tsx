import { notFound } from 'next/navigation'
import { getProjectBySlug } from '@/server/repos/projects'
import { gritFor } from '@/server/queries/publishing'
import { renderProjectCard } from '@/server/api/og/card'

/**
 * The project card.
 *
 * The rail is hatched at this project's own grit value and the numeral is
 * rendered beside it, because CONTRACT §5.7 does not let the hatch carry the
 * value alone. A project that is not public renders nothing: a card is a
 * public artefact, and an unlisted build should not leak its title through a
 * link preview.
 */

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Whetstone project card'

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Response> {
  const { slug } = await params
  const project = getProjectBySlug(slug)

  if (!project || project.visibility !== 'public' || project.status !== 'published') notFound()

  return renderProjectCard({
    title: project.title,
    tagline: project.tagline,
    typeLabel: project.typeLabel,
    grit: project.grit > 0 ? project.grit : gritFor(project.stageKey),
    stageLabel: project.stageLabel,
    handle: project.owner.handle,
    feedbackCount: project.feedbackCounts.total,
  })
}
