/**
 * Stages images saved in ~/Downloads in the last N hours for review, records
 * their dimensions, and prints a manifest so they can be placed.
 *
 * Nothing is written under public/: everything there is served to every
 * visitor, and a batch of unreviewed downloads is not something the product
 * should be able to serve. The staging folder is outside the repository unless
 * --out names another one; copy the images you keep into public/media/ under
 * names that say what they are.
 *
 * Run: node scripts/import-images.mjs [hours] [--out <dir>]
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

const args = process.argv.slice(2)
const outAt = args.indexOf('--out')
if (outAt !== -1 && !args[outAt + 1]) {
  console.error('--out needs a folder to stage the images in.')
  process.exit(1)
}
const DEST = path.resolve(outAt === -1 ? path.join(os.tmpdir(), 'whetstone-incoming') : args[outAt + 1])
const HOURS = Number(args.find((a, i) => (outAt === -1 || i !== outAt + 1) && /^\d+(\.\d+)?$/.test(a)) ?? 6)
const SRC = path.join(os.homedir(), 'Downloads')
const cutoff = Date.now() - HOURS * 3600_000
const exts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.avif'])

/** Where a path really is, even before it exists, so a symlinked /tmp cannot hide public/. */
const real = (p) => {
  const rest = []
  let at = p
  while (!fs.existsSync(at)) {
    rest.unshift(path.basename(at))
    at = path.dirname(at)
  }
  return path.join(fs.realpathSync(at), ...rest)
}
// The repository's public/, wherever the script is run from.
const served = real(path.resolve(import.meta.dirname, '..', 'public'))
const staged = real(DEST)
if (staged === served || staged.startsWith(served + path.sep)) {
  console.error(`Not staging into ${DEST}: everything under public/ is served. Pick a folder outside it.`)
  process.exit(1)
}

const found = fs.readdirSync(SRC)
  .filter(f => exts.has(path.extname(f).toLowerCase()))
  .map(f => ({ f, p: path.join(SRC, f), m: fs.statSync(path.join(SRC, f)).mtimeMs }))
  .filter(x => x.m >= cutoff)
  .sort((a, b) => a.m - b.m)

if (!found.length) {
  console.log(`No images modified in ~/Downloads in the last ${HOURS}h.`)
  process.exit(0)
}

fs.mkdirSync(DEST, { recursive: true })
const manifest = []
for (const [i, x] of found.entries()) {
  let w = 0, h = 0
  try {
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', x.p], { encoding: 'utf8' })
    w = Number(/pixelWidth:\s*(\d+)/.exec(out)?.[1] ?? 0)
    h = Number(/pixelHeight:\s*(\d+)/.exec(out)?.[1] ?? 0)
  } catch {
    // sips is macOS only; elsewhere the dimensions are left at zero.
  }
  const name = `supplied-${String(i + 1).padStart(2, '0')}${path.extname(x.f).toLowerCase()}`
  fs.copyFileSync(x.p, path.join(DEST, name))
  manifest.push({ name, from: x.f, w, h, bytes: fs.statSync(x.p).size })
  console.log(`${name}  ${w}x${h}  ${(fs.statSync(x.p).size / 1024).toFixed(0)}kB  <- ${x.f}`)
}
fs.writeFileSync(path.join(DEST, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`\n${manifest.length} staged in ${DEST}`)
