/**
 * The empty state for the project surfaces.
 *
 * A ruled block with the mark on its leading edge, a sentence in the human face
 * that says what is missing and what to do about it, and one real action. No
 * illustration, no exclamation mark, and never the word “oops”.
 */

import Link from 'next/link'

export interface EmptySectionProps {
  title: string
  body: string
  action?: { label: string; href: string }
  headingId?: string
  /** 1 where the empty state is the whole page, such as a not-found view. */
  headingLevel?: 1 | 2
}

export function EmptySection({ title, body, action, headingId, headingLevel = 2 }: EmptySectionProps) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return (
    <div className="marked bg-paper-hi py-8 pl-6 pr-6">
      <Heading id={headingId} className="text-md">
        {title}
      </Heading>
      <p className="voice mt-3 text-base">{body}</p>
      {action ? (
        <p className="mt-6">
          {/* A fragment is a place on this page, such as the form above the
              empty state. A plain anchor fires the hashchange the form opens
              on; the router's own navigation would move the address silently. */}
          {action.href.startsWith('#') ? (
            <a href={action.href} className="btn">
              {action.label}
            </a>
          ) : (
            <Link href={action.href} className="btn">
              {action.label}
            </Link>
          )}
        </p>
      ) : null}
    </div>
  )
}

export default EmptySection
