import { getLandingStats } from '@/server/repos/stats'
import { gritHistoryFor } from '@/server/queries/publishing'
import { renderSiteCard } from '@/server/api/og/card'
import { GRIT_STAGES } from '@/lib/taxonomy'
import { all } from '@/server/db/client'

/**
 * The site card.
 *
 * Every number on it is a row count read at render time, per CONTRACT §7.6: the
 * strip shows how many published projects actually sit at each of the five grit
 * stages, and the sentence beneath it is the real review count. Nothing here is
 * a placeholder, so an empty database renders honest zeroes rather than
 * invented proof.
 */

export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const alt = 'Whetstone. Ship sharper. Feedback on work in progress, sorted by theme.'

/** Platform-wide stage counts, the shape the strip renders. */
function platformGritHistory(): ReturnType<typeof gritHistoryFor> {
  const rows = all<{ stage_key: string; n: number }>(
    `SELECT stage_key, COUNT(*) AS n
       FROM projects
      WHERE deleted_at IS NULL AND status = 'published' AND visibility = 'public'
      GROUP BY stage_key`,
  )
  const counts = new Map<string, number>(rows.map((r) => [r.stage_key, r.n]))
  return GRIT_STAGES.map((stage) => ({
    key: stage.key,
    grit: stage.grit,
    label: stage.label,
    count: counts.get(stage.key) ?? 0,
  }))
}

export default async function Image(): Promise<Response> {
  const stats = getLandingStats()
  const cells = platformGritHistory()
  const projects = cells.reduce((sum, cell) => sum + cell.count, 0)

  return renderSiteCard({ cells, projects, reviews: stats.reviewsWritten })
}
