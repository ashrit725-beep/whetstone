/**
 * Do the AI tool schemas satisfy OpenAI's strict function-calling rules?
 *
 * Under `strict: true` every key in `properties` must also appear in
 * `required`, and every object must set `additionalProperties: false`. A schema
 * that breaks either rule is refused with a 400 that carries no useful signal:
 * the feature silently falls back to its deterministic path and the only trace
 * is an `http_400` in `ai_run`. The theme report shipped that way, so this
 * check exists to stop it happening again.
 *
 *   node --experimental-strip-types scripts/check-ai-schemas.mts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { registerHooks } from 'node:module'

// The application imports its own modules without a file extension and through
// the `@/` alias, both of which Next understands and a bare `node` run does
// not. Same hook the seed script installs, for the same reason.
const SRC = path.join(path.resolve(import.meta.dirname, '..'), 'src')
const withExtension = (file: string): string => {
  if (path.extname(file) !== '') return file
  for (const candidate of [`${file}.ts`, `${file}.tsx`, path.join(file, 'index.ts')]) {
    if (fs.existsSync(candidate)) return candidate
  }
  return file
}
registerHooks({
  resolve(specifier, context, next) {
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

const S = (await import('../src/server/ai/schemas.ts')) as Record<string, unknown>

const problems: string[] = []

function walk(node: unknown, path: string): void {
  if (node === null || typeof node !== 'object') return
  if (Array.isArray(node)) {
    node.forEach((n, i) => walk(n, `${path}[${i}]`))
    return
  }
  const obj = node as Record<string, unknown>
  const isObjectSchema =
    obj.type === 'object' || (Array.isArray(obj.type) && obj.type.includes('object'))
  if (isObjectSchema && obj.properties && typeof obj.properties === 'object') {
    const props = Object.keys(obj.properties as Record<string, unknown>)
    const required = Array.isArray(obj.required) ? (obj.required as string[]) : []
    const missing = props.filter((p) => !required.includes(p))
    if (missing.length > 0) problems.push(`${path}: optional under strict mode: ${missing.join(', ')}`)
    if (obj.additionalProperties !== false) problems.push(`${path}: additionalProperties is not false`)
  }
  for (const [k, v] of Object.entries(obj)) walk(v, `${path}.${k}`)
}

const schemas = Object.entries(S).filter(([name]) => name.endsWith('JSON_SCHEMA'))
for (const [name, schema] of schemas) walk(schema, name)

console.log(`  checked ${String(schemas.length)} tool schemas`)
if (problems.length === 0) {
  console.log('  all of them satisfy OpenAI strict mode')
} else {
  for (const p of problems) console.log(`  FAIL ${p}`)
  process.exit(1)
}
