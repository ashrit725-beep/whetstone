/**
 * Is every custom property the stylesheets read actually defined?
 *
 * An undefined `var()` with no fallback does not fall back to anything: it
 * makes the whole declaration invalid at computed-value time and the browser
 * drops it, silently. A button loses its padding, a border disappears, a
 * two-column shell collapses to one, and nothing about it shows up in a build,
 * a type check, or a page sweep that is only looking for overflow.
 *
 * A ten-dimension audit found exactly this: a dozen tokens read by the component
 * layer and defined nowhere, so borders, row heights, reading widths and the
 * z-index scale all silently dropped. They were fixed, and this check was
 * written the same day; its first run found ten more. The failure is invisible
 * in every other gate, so the check stays.
 *
 * It reads the source rather than the built stylesheet, so a token Tailwind
 * emits from its own theme is counted as defined when the source defines it.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(process.cwd(), 'src')

/** Every file that can carry CSS: stylesheets, and the styled component files. */
function sources(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      sources(full, out)
    } else if (/\.(css|tsx|ts)$/.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

const files = sources(ROOT)

/**
 * Tailwind v4 generates a variable for every token in `@theme`, and defines its
 * own on top. These are the ones the framework or the browser supplies, which a
 * stylesheet may read without declaring.
 */
const PROVIDED = [
  /^--tw-/,
  /^--spacing$/,
  /^--default-/,
  /^--color-(?:inherit|current|transparent|black|white)$/,
]

const defined = new Set()
const used = new Map()

for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  for (const m of text.matchAll(/(--[a-zA-Z0-9_-]+)\s*:/g)) defined.add(m[1])
  // A `var()` in a comment is prose about the token, not a read of it.
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const m of stripped.matchAll(/var\((--[a-zA-Z0-9_-]+)\s*(,)?/g)) {
    // A var() with a fallback cannot invalidate the declaration.
    if (m[2] === ',') continue
    const name = m[1]
    const seen = used.get(name) ?? []
    seen.push(`${file.replace(`${process.cwd()}/`, '')}`)
    used.set(name, seen)
  }
}

const missing = [...used.entries()]
  .filter(([name]) => !defined.has(name) && !PROVIDED.some((re) => re.test(name)))
  .sort((a, b) => b[1].length - a[1].length)

console.log(`  ${String(defined.size)} custom properties defined, ${String(used.size)} read without a fallback`)
if (missing.length === 0) {
  console.log('  every one of them resolves')
  process.exit(0)
}
console.log(`\n  ${String(missing.length)} read and never defined:`)
for (const [name, where] of missing) {
  const places = [...new Set(where)]
  console.log(`  FAIL  ${name}  (${String(where.length)} reads in ${places.length === 1 ? places[0] : `${String(places.length)} files`})`)
}
process.exit(1)
