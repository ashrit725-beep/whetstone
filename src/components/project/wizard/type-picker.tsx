/**
 * Step one: what kind of thing this is.
 *
 * Server-safe. The choice is a list of real links, so it is addressable, works
 * with JavaScript off, and the back button means what it says. It is the first
 * question because it decides every other question: a game is rated on fun,
 * balance, feel, onboarding and performance, and an API tool is not.
 */

import Link from 'next/link'
import { allProjectTypes } from '@/lib/taxonomy'
import { inSentence } from '@/lib/utils'
import { thenParam } from './then'

export function TypePicker({ then }: { then: string | null }) {
  const types = allProjectTypes()

  return (
    <section aria-labelledby="type-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="type-heading" className="text-lg text-ink">
          What are you building?
        </h2>
        <p className="measure-ui text-sm text-ink-2">
          This picks the five areas reviewers rate and the categories they file notes under, so it is the one answer
          that cannot be changed once the draft exists.
        </p>
      </div>

      <ul className="m-0 flex list-none flex-col p-0">
        {types.map((type, index) => (
          <li key={type.slug} className={index > 0 ? 'border-t border-rule' : undefined}>
            <Link
              href={`/new?step=basics&type=${type.slug}${thenParam(then)}`}
              className="ws-type-link flex min-h-[2.75rem] flex-col gap-1 py-3 no-underline"
            >
              <span className="text-md text-ink">{type.label}</span>
              <span className="measure-ui text-xs text-ink-2">{type.description}</span>
              {/* The chip step is for numerals and column heads, never a
                  sentence (§3.2), and this is a sentence of eleven words. */}
              <span className="measure-ui text-xs text-ink-3">
                {`Rated on ${type.axes.map((axis) => inSentence(axis.label)).join(', ')}.`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

export default TypePicker
