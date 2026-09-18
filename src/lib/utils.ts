import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * tailwind-merge only resolves conflicts between classes it can classify, and
 * it classifies by Tailwind's default scale. The named tokens in globals.css
 * are outside it, so `cn('p-md', 'p-0')` kept both and the stylesheet's order
 * picked the winner, not the caller: a popover asked for `p-0` and got 16px.
 * `text-voice` was worse, read as a colour, so a later `text-text-2` deleted it.
 * Each token namespace the theme defines beyond the defaults is listed here.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ['3xs', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl'],
      text: ['voice', 'hero'],
      radius: ['0'],
      shadow: ['overlay', 'raised'],
      container: ['prose', 'feed', 'detail', 'rail', 'text', 'page', 'wide'],
    },
  },
})

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

export function uid(): string {
  return crypto.randomUUID()
}

export function now(): number {
  return Date.now()
}

/** URL-safe slug. Collisions are resolved by the caller appending a short suffix. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'untitled'
}

/**
 * Relative time. Uses Intl so it localises, and caps at an absolute date past
 * 30 days because "3 months ago" is less useful than the date itself.
 */
export function relativeTime(ts: number, nowMs = Date.now()): string {
  const diff = ts - nowMs
  const abs = Math.abs(diff)
  const min = 60_000, hr = 3_600_000, day = 86_400_000
  if (abs < 45_000) return 'just now'
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  if (abs < hr) return rtf.format(Math.round(diff / min), 'minute')
  if (abs < day) return rtf.format(Math.round(diff / hr), 'hour')
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), 'day')
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(ts))
}

/** Compact counts: 1200 -> 1.2k. Avoids column reflow in dense tables. */
export function compactNumber(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/**
 * A heading-case label, placed mid-sentence: "Onboarding & legibility" becomes
 * "onboarding & legibility", while "API ergonomics" keeps its acronym, which a
 * bare `toLowerCase()` turned into "api ergonomics".
 */
export function inSentence(label: string): string {
  return /^\p{Lu}\p{Ll}/u.test(label) ? label.charAt(0).toLowerCase() + label.slice(1) : label
}

/** Deterministic 32-bit hash. Used to pick a stable avatar hue per user id. */
export function hashCode(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * A link from stored data, or null.
 *
 * `new URL()` accepts `javascript:`, `data:` and `vbscript:`, so anything that
 * reaches an href needs an allowlist rather than a parse. This is the one:
 * internal paths, http(s), and mailto. Everything else, including a
 * protocol-relative `//host` that inherits the page's scheme, is refused.
 *
 * The markdown renderer has always used this rule. It lives here so that every
 * other place a stored URL reaches an href uses the same one, and so that a
 * field with no write path today cannot become a stored-XSS surface the day
 * somebody adds a form for it.
 */
export function safeHref(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null
  const href = raw.trim()
  if (href.length === 0 || href.length > 2048) return null
  if (href.startsWith('//')) return null
  if (href.startsWith('#')) return null
  if (href.startsWith('/')) return href
  if (/^https?:\/\/[^\s]+$/i.test(href)) return href
  if (/^mailto:[^\s]+@[^\s]+$/i.test(href)) return href
  return null
}
