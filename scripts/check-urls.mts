/**
 * Does the href allowlist actually refuse what it claims to?
 *
 * `safeHref` guards every place a stored URL becomes an href, and `HttpsUrl`
 * guards every form that writes one. Both exist because `z.string().url()` and
 * `new URL()` accept `javascript:`, `data:` and `vbscript:` without complaint.
 * A rule nobody tests is a rule that quietly stops holding, so this asserts the
 * hostile cases directly.
 *
 *   node --experimental-strip-types scripts/check-urls.mts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { registerHooks } from 'node:module'

const SRC = path.join(path.resolve(import.meta.dirname, '..'), 'src')
const withExtension = (file: string): string => {
  if (path.extname(file) !== '') return file
  for (const c of [`${file}.ts`, `${file}.tsx`, path.join(file, 'index.ts')]) {
    if (fs.existsSync(c)) return c
  }
  return file
}
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'next/headers') {
      return { url: 'data:text/javascript,export function cookies(){throw new Error("not here")}', shortCircuit: true }
    }
    if (specifier.startsWith('@/')) {
      return next(pathToFileURL(withExtension(path.join(SRC, specifier.slice(2)))).href, context)
    }
    if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
      const parent = path.dirname(fileURLToPath(context.parentURL))
      const resolved = withExtension(path.resolve(parent, specifier))
      if (resolved !== path.resolve(parent, specifier)) return next(pathToFileURL(resolved).href, context)
    }
    return next(specifier, context)
  },
})

const { safeHref } = (await import('../src/lib/utils.ts')) as { safeHref: (s: unknown) => string | null }
const { HttpsUrl } = (await import('../src/server/api/schema.ts')) as { HttpsUrl: { safeParse: (v: unknown) => { success: boolean } } }

const HOSTILE = [
  'javascript:alert(1)',
  'JaVaScRiPt:alert(1)',
  ' javascript:alert(1)',
  'java\tscript:alert(1)',
  'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  'vbscript:msgbox(1)',
  'file:///etc/passwd',
  '//evil.example/steal',
  'about:blank',
  `https://evil.example/${'a'.repeat(3000)}`,
]
const ALLOWED = [
  'https://example.com/build',
  'http://example.com/build',
  '/p/brinehollow',
  'mailto:someone@example.com',
]

let failed = 0
const say = (ok: boolean, label: string) => {
  if (!ok) failed++
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${label}`)
}

console.log('  safeHref, the render-side allowlist:')
for (const u of HOSTILE) say(safeHref(u) === null, `refuses ${u.slice(0, 52)}`)
for (const u of ALLOWED) say(safeHref(u) !== null, `allows  ${u.slice(0, 52)}`)
say(safeHref(null) === null, 'refuses null')
say(safeHref(undefined) === null, 'refuses undefined')
say(safeHref(123 as unknown as string) === null, 'refuses a non-string')

console.log('\n  HttpsUrl, the write-side schema:')
for (const u of HOSTILE) say(!HttpsUrl.safeParse(u).success, `refuses ${u.slice(0, 52)}`)
say(HttpsUrl.safeParse('https://example.com/build').success, 'allows  https://example.com/build')
say(!HttpsUrl.safeParse('http://example.com/build').success, 'refuses plain http on a write')

console.log(`\n  ${failed === 0 ? 'every case behaves' : String(failed) + ' cases wrong'}`)
process.exit(failed === 0 ? 0 : 1)
