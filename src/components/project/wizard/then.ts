/**
 * Where a creator goes once their project is live, when they came to /new from
 * a page that needed one.
 *
 * The bounty form and an expert's request page both link here with `?then=`
 * and tell the creator they land back there afterwards. The wizard dropped the
 * parameter at its first link, so that promise was never kept. Now it rides
 * along in the address and in every step's form, the way the draft id does.
 *
 * It decides a redirect, so it is read against a closed list and never trusted
 * as a path: `bounty`, or `request:` and a handle in the shape handles take.
 */

const REQUEST = /^request:([a-z0-9](?:[a-z0-9-]{1,22}[a-z0-9]))$/i

export function parseThen(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  return raw === 'bounty' || REQUEST.test(raw) ? raw : null
}

/** `&then=…` to append to a wizard address, or nothing. */
export function thenParam(then: string | null): string {
  return then ? `&then=${encodeURIComponent(then)}` : ''
}

/** Where publishing lands: the page that sent the creator here, with the new project chosen. */
export function afterPublish(then: string | null, slug: string): string {
  const project = `?project=${encodeURIComponent(slug)}`
  if (then === 'bounty') return `/bounties/new${project}`
  const handle = then ? REQUEST.exec(then)?.[1] : undefined
  return handle ? `/experts/${handle}/request${project}` : `/p/${slug}`
}

/** One clause for the wizard's introduction, so the creator knows where publishing leads. */
export function afterPublishNote(then: string | null): string | null {
  if (then === 'bounty') return 'Publishing takes you straight back to the bounty form, with this project chosen.'
  if (then && REQUEST.test(then)) return 'Publishing takes you straight back to your review request, with this project chosen.'
  return null
}
