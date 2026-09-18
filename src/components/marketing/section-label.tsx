/**
 * A section label: one small word, then a rule running to the end of the
 * measure. It is how a reader knows where they are without another heading
 * level, and it is ruled rather than filled, so it can never become a pill.
 */

import styles from './paper.module.css'

export interface SectionLabelProps {
  children: string
}

export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <p className={styles.secLabel}>
      <span
        className="text-2xs uppercase text-ink-3"
        style={{ fontVariationSettings: '"wght" 700', letterSpacing: '0.16em' }}
      >
        {children}
      </span>
      <i aria-hidden="true" />
    </p>
  )
}
