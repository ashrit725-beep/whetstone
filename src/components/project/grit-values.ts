/**
 * The grit scale as plain data.
 *
 * `src/components/ui/grit.tsx` carries the `'use client'` directive, so a
 * Server Component that imports its constants gets a client reference rather
 * than the array. These read the same five rungs from `src/lib/taxonomy.ts`,
 * which is the source both of them already share, so nothing can drift.
 */

import { GRIT_STAGES } from '@/lib/taxonomy'

export type GritValue = (typeof GRIT_STAGES)[number]['grit']

export const GRIT_VALUES: readonly GritValue[] = GRIT_STAGES.map((stage) => stage.grit)

export interface GritRung {
  readonly value: GritValue
  readonly key: string
  readonly label: string
  readonly definition: string
}

export const GRIT_SCALE: readonly GritRung[] = GRIT_STAGES.map((stage) => ({
  value: stage.grit,
  key: stage.key,
  label: stage.label,
  definition: stage.definition,
}))

export function isGritValue(n: number): n is GritValue {
  return GRIT_VALUES.includes(n as GritValue)
}

export function gritLabelFor(n: number): string {
  return GRIT_SCALE.find((rung) => rung.value === n)?.label ?? 'Concept'
}

/** Tabular figures with a slashed zero, so 120 and 1000 cannot be misread. */
export const GRIT_NUMERAL_STYLE = {
  fontVariantNumeric: 'tabular-nums',
  fontFeatureSettings: '"tnum" 1, "zero" 1',
} as const
