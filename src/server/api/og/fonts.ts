import { readFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Fonts for `ImageResponse`, and the reason they are not the page's fonts.
 *
 * Satori reads TTF, OTF and WOFF. It does not read WOFF2, and it does not apply
 * variable-font axes. `public/fonts/bricolage-var.woff2` is therefore unusable
 * here on two counts, so three **static instances** of the same family are
 * shipped beside it as WOFF, one per role:
 *
 *   og-700.woff   headings
 *   og-600.woff   labels and metadata
 *   og-400.woff   sentences
 *
 * Recorded deviation from `direction.md`, which says the OG route reads the same
 * `/public` bytes as the page: it cannot, so it reads three static cuts of the
 * same family from the same directory. Replace them whenever the display face
 * changes; they come from the `@fontsource/bricolage-grotesque` static package.
 *
 * All three are subset to Latin and include the curly quotes, the ellipsis and
 * the en dash the type rules require, so a title using them renders rather than
 * showing a tofu box.
 *
 * Read once per process. `ImageResponse` runs on the Node runtime, so the file
 * system is available and a fetch round trip is not needed.
 */

export interface OgFont {
  name: string
  data: ArrayBuffer
  weight: 400 | 600 | 700
  style: 'normal'
}

export const OG_FONT_FAMILY = 'Bricolage OG'

const FILES: readonly { file: string; weight: 400 | 600 | 700 }[] = [
  { file: 'og-400.woff', weight: 400 },
  { file: 'og-600.woff', weight: 600 },
  { file: 'og-700.woff', weight: 700 },
]

let cache: Promise<OgFont[]> | null = null

async function load(): Promise<OgFont[]> {
  const dir = path.join(process.cwd(), 'public', 'fonts')
  const loaded: OgFont[] = []
  for (const entry of FILES) {
    const buffer = await readFile(path.join(dir, entry.file))
    // A Buffer is a view over a pooled ArrayBuffer; slice it so satori is handed
    // exactly this font's bytes and not the whole pool.
    const data = buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer
    loaded.push({ name: OG_FONT_FAMILY, data, weight: entry.weight, style: 'normal' })
  }
  return loaded
}

export function ogFonts(): Promise<OgFont[]> {
  cache ??= load()
  return cache
}
