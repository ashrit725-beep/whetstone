'use client'

/**
 * The third, quietest action: save this project to read later.
 *
 * Keyboard contract: one real submit button, 44px tall, `aria-pressed` carrying
 * the state, and a live region that says what happened rather than leaving the
 * change to a silent colour swap. Signed out it is a link to sign-in that says
 * why, not a disabled control with no explanation.
 *
 * A form action is already a transition, so the optimistic flip lands in the
 * same commit as the request and the server row replaces it on revalidation.
 */

import { useOptimistic } from 'react'
import Link from 'next/link'
import { Bookmark, BookmarkCheck } from 'lucide-react'

export interface SaveButtonProps {
  slug: string
  saved: boolean
  signedIn: boolean
  action: (formData: FormData) => void | Promise<void>
}

export function SaveButton({ slug, saved, signedIn, action }: SaveButtonProps) {
  const [optimistic, flip] = useOptimistic(saved, (_current: boolean, next: boolean) => next)

  if (!signedIn) {
    return (
      <Link href={`/sign-in?next=/p/${slug}`} className="ws-toggle">
        <Bookmark size={16} strokeWidth={1.75} aria-hidden="true" />
        Save
        <span className="sr-only">, which needs a signed-in account</span>
      </Link>
    )
  }

  return (
    <form
      action={(formData: FormData) => {
        flip(!optimistic)
        return action(formData)
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="saved" value={optimistic ? 'false' : 'true'} />
      <button type="submit" className="ws-toggle" aria-pressed={optimistic}>
        {optimistic ? (
          <BookmarkCheck size={16} strokeWidth={1.75} aria-hidden="true" />
        ) : (
          <Bookmark size={16} strokeWidth={1.75} aria-hidden="true" />
        )}
        {optimistic ? 'Saved' : 'Save'}
      </button>
      <span aria-live="polite" className="sr-only">
        {optimistic ? 'Saved to your list.' : 'Not saved.'}
      </span>
    </form>
  )
}

export default SaveButton
