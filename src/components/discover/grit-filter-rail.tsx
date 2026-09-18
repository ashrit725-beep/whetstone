'use client'

/**
 * Placement note: every component in `src/components/discover/` that draws from
 * `@/components/ui` declares `'use client'`. `src/components/ui/grit.tsx` is a
 * client module, so its exported values (`GRIT_STEPS`, `GRIT_NUMERAL_STYLE`)
 * reach a Server Component as client references rather than as data, and
 * `CoverArt` reads `GRIT_STEPS` at render time. Declaring the boundary here
 * means the row looks the same wherever it is rendered from. The data work all
 * happens in the two page files, which import nothing from the barrel; nothing
 * in this directory uses a hook unless its own contract says so.
 */

/**
 * Discover's one bold element (CONTRACT §1): the grit scale, drawn as five
 * cells carrying the real hatch at its real stroke width and spacing, each with
 * the live count of projects sitting at that step.
 *
 * It is a filter, so every cell is a link and the state lives in the URL. The
 * selected cell links back to the unfiltered feed, which is how a reader clears
 * it without hunting for a separate control. A step with no projects under the
 * other filters keeps its hatch and its zero but is not a link, one ink step
 * down, because it could only lead to an empty page.
 *
 * Selection is never a fill (§2.4.6) and the grind-mark is spent on the current
 * feed row (§2.4.7), so the selected cell is carried by three non-chromatic
 * signals at once: `aria-current="true"`, the ink stepping text-2 to text-1, and
 * a Check glyph in a slot that is reserved on every cell, so nothing moves.
 *
 * Keyboard contract: five links in document order. Tab reaches each one, Enter
 * activates. No roving tabindex here: these are five independent destinations,
 * not one composite control.
 */

import Link from 'next/link'
import { Check } from 'lucide-react'
import { GritHatch, GRIT_NUMERAL_STYLE } from '@/components/ui'
import { GRIT_STAGES } from '@/lib/taxonomy'
import { hrefFor, withGrit, type DiscoverState } from './filters'

export interface GritFilterRailProps {
  state: DiscoverState
  /** Live counts keyed by the schema's stage key. Missing keys read as zero. */
  counts: Readonly<Record<string, number>>
  headingId: string
  onNavigate?: () => void
}

export function GritFilterRail({ state, counts, headingId, onNavigate }: GritFilterRailProps) {
  return (
    <div className="ws-rail-group">
      <h3 id={headingId} className="ws-rail-heading">
        Grit
      </h3>
      <p className="text-xs text-text-3 measure-ui">
        The stroke gets finer as the work gets finer, 120–8000. Pick the stage you are useful at.
      </p>

      <div className="ws-grit-rail">
        {GRIT_STAGES.map((stage) => {
          const count = counts[stage.key] ?? 0
          const selected = state.grit === stage.grit
          const body = (
            <>
              <span className="ws-grit-swatch" aria-hidden="true">
                <GritHatch value={stage.grit} />
              </span>

              <span aria-hidden="true">
                {selected ? <Check size={16} strokeWidth={1.5} /> : null}
              </span>

              <span className="flex min-w-0 flex-col">
                <span className="text-sm">{stage.label}</span>
                <span className="text-2xs text-text-3" style={GRIT_NUMERAL_STYLE}>
                  {stage.grit} grit
                </span>
              </span>

              <span className="tnum text-xs text-text-3">{count.toLocaleString('en')}</span>

              <span className="sr-only">
                {count === 1 ? '1 project' : `${String(count)} projects`}
                {selected ? '. Selected. Activate to clear this grit filter.' : '.'}
              </span>
            </>
          )

          if (count === 0 && !selected) {
            return (
              <span key={stage.key} className="ws-grit-cell" data-empty="true">
                {body}
              </span>
            )
          }
          return (
            <Link
              key={stage.key}
              href={hrefFor(withGrit(state, stage.grit))}
              prefetch={false}
              aria-current={selected ? 'true' : undefined}
              onClick={onNavigate}
              className="ws-grit-cell"
            >
              {body}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default GritFilterRail
