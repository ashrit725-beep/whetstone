/**
 * The page a closed account lands on.
 *
 * Closing used to redirect to `/?account=closed`, which nothing reads: the
 * reader got the marketing home, part-way down it because the danger zone had
 * been scrolled to, with no word anywhere about the account they had just
 * closed. The confirmation belongs at the top of a page of its own, and it
 * repeats exactly what the danger zone promised rather than a softer version.
 *
 * Static, like the rest of this group, and out of the index: it is a
 * confirmation, not a destination.
 */

import type { Metadata } from 'next'
import NextLink from 'next/link'

export const metadata: Metadata = {
  title: 'Your account is closed',
  description: 'What closing a Whetstone account did, and what stayed where it was.',
  robots: { index: false, follow: false },
}

export default function AccountClosedPage() {
  return (
    <article className="pad-inline py-16">
      <div className="mx-auto max-w-[40rem]">
        <p className="eyebrow">Account</p>
        <h1 className="mt-6 text-2xl text-ink">Your account is closed</h1>
        <p className="voice mt-6 text-voice">
          You have been signed out on every device, and this address cannot sign in again.
        </p>

        <div className="voice mt-12 flex flex-col gap-8">
          <section className="flex flex-col gap-3">
            <h2 className="text-md text-ink">What stayed where it was</h2>
            <p>
              Every note you wrote, and every note written on your work, is still on Whetstone under
              your handle. Nothing was deleted: the creators who were reviewed and the reviewers who
              were answered keep what they read, and the reputation those notes earned stays
              attached to them.
            </p>
          </section>

          <section className="flex flex-col gap-3 border-t border-rule pt-8">
            <h2 className="text-md text-ink">What changed</h2>
            <p>
              Your projects have left Discover, and they are no longer taking new notes. Your email
              address and your handle stay attached to this closed account, so neither can be used
              to sign up again — to take part another time, sign up with a different address.
            </p>
          </section>

          <section className="flex flex-col gap-3 border-t border-rule pt-8">
            <h2 className="text-md text-ink">There is no undo</h2>
            <p>
              Closing an account is the one thing on Whetstone that cannot be reversed, which is
              why it asked you to type your handle first. Everything above is now the settled state
              of it.
            </p>
          </section>
        </div>

        <p className="mt-12">
          <NextLink href="/discover" className="link">
            Keep reading Whetstone
          </NextLink>
        </p>
      </div>
    </article>
  )
}
