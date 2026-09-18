import './guard'
import { createHash } from 'node:crypto'

/**
 * Content hashing for the artifact cache.
 *
 * Every cache key is a sha256 over the exact inputs that produced the output,
 * so a hit is a guarantee rather than a guess. Object key order is normalised
 * before hashing: two callers that build the same input in a different order
 * must land on the same hash or the cache silently halves its own hit rate.
 */
export function sha256(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/** Deterministic JSON: object keys sorted depth-first, arrays left in order. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`
}

/** The cache key for a feature run. `schemaVersion` bumps invalidate every row. */
export function inputHash(schemaVersion: number, parts: unknown): string {
  return sha256(`v${schemaVersion}|${stableStringify(parts)}`)
}

/** 32-bit FNV-1a. Cheap, stable, and the basis of the MinHash permutations. */
export function fnv1a(input: string, seed = 2166136261): number {
  let h = seed >>> 0
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
