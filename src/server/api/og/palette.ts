/**
 * The OG image palette. THE ONE PERMITTED HEX-LITERAL FILE OUTSIDE `@theme`.
 *
 * Recorded deviation from CONTRACT §2.1 and gate line 9.1.1:
 *
 *   §2.1 / §9.1.1 · `src/server/api/og/palette.ts` is the single permitted hex
 *   literal location outside `@theme` · satori, which backs `ImageResponse`,
 *   cannot resolve CSS custom properties, and the social card has to render the
 *   real palette. The gate's grep covers `app` and `components`; this file sits
 *   in neither, so the grep still returns zero. Values are copied verbatim from
 *   the `@theme` block in `src/app/globals.css` and must be changed in both
 *   places or the card and the product will disagree.
 *
 * PLAYBOOK §6.6 puts this file at `src/lib/og-tokens.ts`. It lives here instead
 * because `src/lib/**` is outside this surface's ownership, and the property
 * that matters (one file, outside the grepped directories, with the reason
 * written down) is unchanged.
 *
 * Dark only. A social card has no viewer theme to read: it is one PNG shown on
 * someone else's surface, so it renders the dark ground the product is designed
 * around and holds still.
 */

export const OG = {
  /** Page ground. */
  surface1: '#141d20',
  /** Raised: the rail well and the metadata bar. */
  surface2: '#1b262a',
  /** Decorative rule. Carries no information. */
  borderHair: '#2e4047',
  /** Perceivable boundary, ≥3:1 on every surface. */
  borderControl: '#6e858d',
  /** Grit hatch strokes. */
  hatch: '#7e939a',

  text1: '#e6edee',
  text2: '#bccace',
  text3: '#93a7ae',

  /** The grind-mark, and nothing else on this card. */
  accent: '#66ace2',
  positive: '#6fcf8e',
} as const

export type OgColor = (typeof OG)[keyof typeof OG]
