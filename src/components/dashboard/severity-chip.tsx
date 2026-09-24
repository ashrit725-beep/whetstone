/**
 * One severity chip, drawn one way.
 *
 * The project page prints a severity as a ruled chip — solid ink for Blocker
 * and Major, a hairline outline for the rest — and the creator’s inbox printed
 * the same value as a hue-carrying badge: red for Major, olive for Minor. The
 * same datum in two visual languages, one click apart, in the two places a
 * creator reads their notes in a single sitting. The ink chip wins, because it
 * is the direction’s own language and because severity is not a state that
 * needs hue to be scanned; the word is the signal, in every theme, desaturated
 * or not.
 *
 * `.chip` is the shared component class in globals.css, so nothing here owns a
 * colour of its own.
 */

/** Severities heavy enough to take the solid fill. */
const SOLID: ReadonlySet<string> = new Set(['blocker', 'major'])

export interface SeverityChipProps {
  /** The severity key, e.g. `blocker`. Decides the fill. */
  severity: string
  /** The word a reader sees, e.g. “Blocker”. */
  label: string
}

export function SeverityChip({ severity, label }: SeverityChipProps) {
  return (
    <span className="chip" data-solid={SOLID.has(severity) ? 'true' : undefined}>
      {label}
    </span>
  )
}

export default SeverityChip
