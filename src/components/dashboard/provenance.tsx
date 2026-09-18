/**
 * Says how a panel’s numbers were produced, in the panel, every time.
 *
 * The AI layer returns the same shape whether a model answered or the
 * deterministic path did (`AiResult.source`), and this renders that answer
 * without softening it. A provenance label that lies is worse than none: it
 * teaches a creator to distrust every figure on the page. So “Clustered
 * locally” is written as plainly as “Clustered with Claude”, in the same place,
 * at the same size, with the model named when there was one.
 */

import { Badge, Timestamp } from '@/components/ui'
import type { Provenance as ProvenanceValue } from '@/server/queries/dashboard'

export interface ProvenanceProps {
  value: ProvenanceValue
  /** Shown when the local path ran because no provider is configured. */
  className?: string
}

export function Provenance({ value, className }: ProvenanceProps) {
  const at = Date.parse(value.generatedAt)
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-xs">
        <Badge tone={value.source === 'heuristic' ? 'neutral' : 'accent'}>{value.label}</Badge>
        {Number.isFinite(at) ? <Timestamp ts={at} prefix="Run" /> : null}
        {value.model ? (
          <span className="text-xs text-text-3">
            <span>Model </span>
            <code className="text-xs">{value.model}</code>
          </span>
        ) : null}
      </div>
      <p className="measure-ui mt-2xs text-xs text-text-3">{value.detail}</p>
    </div>
  )
}

export default Provenance
