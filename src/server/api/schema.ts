import { z } from 'zod'
import { GRIT_STAGE_KEYS } from '@/lib/taxonomy'

/**
 * The shared request vocabulary.
 *
 * Every route parses through these rather than re-describing an id or a handle,
 * so one tightening is one edit. Messages are written for a person: a field
 * error is rendered next to the field and has to say what to do about it.
 */

export const Id = z.string().uuid('That identifier is not in the expected form.')

export const Handle = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9])$/,
    'Letters, numbers and hyphens, 3 to 24 characters, starting and ending with a letter or number.',
  )

export const Slug = z.string().trim().regex(/^[a-z0-9][a-z0-9-]{0,79}$/, 'That address is not in the expected form.')

/**
 * A link a reader will be given as an href.
 *
 * `z.string().url()` is not enough on its own: the URL constructor happily
 * accepts `javascript:`, `data:` and `vbscript:`, so a field validated that way
 * and rendered into an href is a stored-XSS surface that only React's own
 * href filtering was standing in front of. The scheme check is the point, and
 * the length cap keeps a megabyte of query string out of the database.
 */
export const HttpsUrl = z
  .string()
  .trim()
  .max(2_048, 'That link is too long. Two thousand characters is the limit.')
  .url('That is not a link.')
  .refine((value) => value.toLowerCase().startsWith('https://'), 'Links must start with https.')

export const Cursor = z.string().max(240)

export const Limit = z.coerce.number().int().min(1).max(50)

export const Query = z.string().trim().min(2, 'Type at least two characters.').max(120)

export const Page = z.object({
  cursor: Cursor.nullish().transform((v) => v ?? null),
  limit: Limit.default(20),
})

/** The five grit stage keys, straight from the taxonomy so the two cannot drift. */
export const StageKey = z.enum(
  GRIT_STAGE_KEYS as unknown as [string, ...string[]],
  { message: 'Pick one of the five grit stages.' },
)

export const GritValue = z
  .coerce
  .number()
  .int()
  .refine((n) => n === 120 || n === 400 || n === 1000 || n === 3000 || n === 8000, {
    message: 'Grit is one of 120, 400, 1000, 3000 or 8000.',
  })

/**
 * `1` to place the vote, `0` to retract it. There is no implicit toggle: a
 * double-tap should settle on a state rather than flip past it.
 *
 * Written as a refined number rather than a union of literals because a failed
 * `z.union` reports its own generic message and buries the branch messages, and
 * a field error a person reads has to say what the field will accept.
 */
export const VoteValue = z
  .number()
  .int()
  .refine((n): n is 0 | 1 => n === 0 || n === 1, {
    message: 'A vote is 1 to place it or 0 to take it back.',
  })

/** Up, none, down. Only discussion posts carry a downvote. */
export const SignedVoteValue = z
  .number()
  .int()
  .refine((n): n is -1 | 0 | 1 => n === -1 || n === 0 || n === 1, {
    message: 'A vote is 1 for up, -1 for down, or 0 to take it back.',
  })

export const Toggle = z.object({ on: z.boolean() })

/**
 * Zod's flattened field errors, in the shape the envelope promises.
 * `noUncheckedIndexedAccess` is on, so every read is guarded.
 */
export function fieldErrorsOf(error: z.ZodError): Record<string, readonly string[]> {
  const out: Record<string, string[]> = {}
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_'
    const bucket = out[key]
    if (bucket) bucket.push(issue.message)
    else out[key] = [issue.message]
  }
  return out
}

/** Search params to a plain object, keeping the last value of a repeated key. */
export function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of params) out[key] = value
  return out
}
