import './guard'

/**
 * Brings a model's tool input into line with the JSON schema it was given,
 * before zod judges it.
 *
 * OpenAI's strict mode enforces the schema while generating. Anthropic's tool
 * input schema is guidance, not a constraint, and Claude reliably writes a
 * theme label of seventy characters when the limit is sixty. Zod then rejected
 * the whole report for one long string, the repair turn failed differently,
 * and a good clustering was thrown away for the embeddings fallback after
 * seventy seconds.
 *
 * What is repaired here is only what has one obviously right answer:
 *   - a string over `maxLength` is cut at the last word boundary that fits;
 *   - an array over `maxItems` keeps its first `maxItems` entries;
 *   - an array or object that arrived as a JSON string is parsed.
 * Anything else (a missing key, a wrong enum, a number out of range) is left
 * for zod to refuse, because guessing there would be inventing an answer.
 *
 * Cutting a quote keeps it a contiguous substring of its source, so the
 * verbatim check downstream still means what it says.
 */
export function conformToSchema(value: unknown, schema: unknown): unknown {
  if (!schema || typeof schema !== 'object') return value
  const s = schema as {
    type?: string | string[]
    maxLength?: number
    maxItems?: number
    items?: unknown
    properties?: Record<string, unknown>
    required?: string[]
  }
  const types = Array.isArray(s.type) ? s.type : s.type ? [s.type] : []

  if (typeof value === 'string' && (types.includes('array') || types.includes('object')) && !types.includes('string')) {
    const parsed = parseJson(value)
    if (parsed !== undefined) return conformToSchema(parsed, schema)
    // The reason, never the content: this runs over reviewers' words.
    try {
      JSON.parse(value.trim())
    } catch (error) {
      console.warn(`[ai] a ${String(value.length)}-character string where JSON was expected would not parse: ${String(error)}`)
    }
    return value
  }

  if (typeof value === 'string' && types.includes('string') && typeof s.maxLength === 'number') {
    return clip(value, s.maxLength)
  }

  if (Array.isArray(value) && types.includes('array')) {
    const kept = typeof s.maxItems === 'number' ? value.slice(0, s.maxItems) : value
    return kept.map((item) => conformToSchema(item, s.items))
  }

  if (value && typeof value === 'object' && !Array.isArray(value) && s.properties) {
    const unwrapped = unwrap(value as Record<string, unknown>, s.properties, s.required ?? [])
    if (unwrapped !== value) return conformToSchema(unwrapped, schema)
    const out: Record<string, unknown> = { ...(value as Record<string, unknown>) }
    for (const [key, sub] of Object.entries(s.properties)) {
      if (key in out) out[key] = conformToSchema(out[key], sub)
    }
    return out
  }

  return value
}

/**
 * The answer wrapped in one extra object: `{ "digest": { "headline": … } }`
 * where `{ "headline": … }` was asked for. Seen from Opus on the weekly brief,
 * where every required key was then "missing". Unwrapped only when the one
 * inner object carries most of the required keys and the outer none of them.
 */
function unwrap(
  value: Record<string, unknown>,
  properties: Record<string, unknown>,
  required: readonly string[],
): Record<string, unknown> {
  const keys = Object.keys(value)
  if (keys.length !== 1 || required.length === 0) return value
  if (keys.some((k) => k in properties)) return value
  let inner = value[keys[0]!]
  if (typeof inner === 'string') inner = parseJson(inner)
  if (!inner || typeof inner !== 'object' || Array.isArray(inner)) return value
  const present = required.filter((k) => k in (inner as Record<string, unknown>)).length
  return present >= Math.ceil(required.length / 2) ? (inner as Record<string, unknown>) : value
}

function parseJson(text: string): unknown {
  const t = text.trim()
  if (!(t.startsWith('[') || t.startsWith('{'))) return undefined
  try {
    return JSON.parse(t) as unknown
  } catch {
    // Seen from Claude on the theme report: the array closes, and the rest of
    // the object (`"unclustered": [...]`) carries on inside the same string.
    // The leading value is complete and is the part that was asked for.
    const end = leadingValueEnd(t)
    if (end === undefined) return undefined
    try {
      return JSON.parse(t.slice(0, end + 1)) as unknown
    } catch {
      return undefined
    }
  }
}

/** Index of the bracket that closes the value opening `text`, string-aware. */
function leadingValueEnd(text: string): number | undefined {
  let depth = 0
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inString) {
      if (c === '\\') i++
      else if (c === '"') inString = false
      continue
    }
    if (c === '"') inString = true
    else if (c === '[' || c === '{') depth++
    else if (c === ']' || c === '}') {
      depth--
      if (depth === 0) return i
    }
  }
  return undefined
}

/** At most `max` characters, ending on a whole word when one is reasonably close. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text
  const hard = text.slice(0, max)
  const space = hard.lastIndexOf(' ')
  const cut = space >= max * 0.6 ? hard.slice(0, space) : hard
  return cut.replace(/[\s,;:–—-]+$/u, '')
}
