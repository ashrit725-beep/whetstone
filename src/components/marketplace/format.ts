/**
 * Formatting for money, time and counts across the marketplace and the profile.
 *
 * Pure functions, no JSX, so both Server and Client Components import them.
 * Every string here obeys §3.4: a non-breaking space before a unit, an en dash
 * for a numeric range, no em dash, no three-period ellipsis.
 */

const NBSP = ' '
const ENDASH = '–'

/**
 * What a bounty may be worth. One table, read by the composer that prices the
 * amount live and by the Server Action that refuses it: two copies of this rule
 * had drifted, so the form's ledger costed $1 and $15,050,007 down to the cent
 * and the submit was then refused by a floor the reader was never shown.
 */
export const MIN_BOUNTY_CENTS = 5_000
export const MAX_BOUNTY_CENTS = 500_000

/** Whole dollars when the amount is whole, cents when it is not. */
export function money(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

/** The bare numeral, for a cell that already carries a currency heading. */
export function moneyPlain(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100)
}

export function moneyRange(low: number, high: number, currency = 'USD'): string {
  return `${money(low, currency)}${ENDASH}${money(high, currency)}`
}

/** Hours, said the way a person would say them. */
export function turnaround(hours: number | null): string | null {
  if (hours === null || hours <= 0) return null
  if (hours % 24 === 0) {
    const days = hours / 24
    return `${String(days)}${NBSP}${days === 1 ? 'day' : 'days'}`
  }
  return `${String(hours)}${NBSP}${hours === 1 ? 'hour' : 'hours'}`
}

export function plural(n: number, one: string, many: string): string {
  return `${n.toLocaleString('en')}${NBSP}${n === 1 ? one : many}`
}

/** A rate as a fraction of real rows, never a bare percentage with no base. */
export function ofCount(part: number, whole: number): string {
  return `${String(part)} of ${String(whole)}`
}

export function percent(fraction: number): string {
  return `${String(Math.round(fraction * 100))}%`
}

export { NBSP, ENDASH }
