import type { Metadata } from 'next'
import { Clause, LegalDoc } from '../_doc'

export const metadata: Metadata = {
  title: 'Terms',
  description: 'What you agree to when you post work to Whetstone or review someone else’s.',
}

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms"
      updated="18 September 2026"
      standfirst="Whetstone is a place where people show work that is not finished. These terms exist mainly to say who owns what, what happens to a review once it is written, and when we will step in."
    >
      <Clause heading="Your work stays yours">
        <p>
          Posting a project does not transfer anything. You keep every right you had before, and you
          can close your projects to new feedback whenever you like. What reviewers have already
          written stays readable, because it is theirs as much as the project is yours.
        </p>
        <p>
          You are telling us you have the right to post what you post. If you are showing work made
          with other people, that is between you and them.
        </p>
      </Clause>

      <Clause heading="A review belongs to the person who wrote it">
        <p>
          Reviewers keep their own words. You can quote a review, act on it, argue with it and mark
          it as shipped. You cannot edit it, and you cannot delete it because you disagree with it.
        </p>
        <p>
          If a review breaks the rules below, raise it through the Ask for help link at the foot of
          every page and we will look at it. Until we decide, it stays where it is and counts toward
          its author’s record.
        </p>
      </Clause>

      <Clause heading="What gets removed">
        <p>
          Reviews that attack a person rather than the work. Reviews written to settle a score.
          Anything that exists to move a number rather than to tell a creator something true. Work
          you do not have the right to post. Anything unlawful.
        </p>
        <p>
          We remove accounts that do these things repeatedly, and we do not restore reputation
          earned through them.
        </p>
      </Clause>

      <Clause heading="Paid reviews and bounties">
        <p>
          When money is involved, the money is held until the work is delivered and accepted. A
          reviewer who does not deliver does not get paid. If the two sides disagree about a
          delivery, either can open a dispute, and nothing is paid out or refunded until it is
          settled.
        </p>
        <p>
          We take a percentage of paid transactions. The rate is shown before you commit to one, and
          it does not change after the fact.
        </p>
      </Clause>

      <Clause heading="What we do not promise">
        <p>
          We do not promise that you will get feedback, that it will be good, or that it will be
          kind. We do not promise the service will be available, though we try. We do not review
          work ourselves and we do not vouch for anything posted here.
        </p>
      </Clause>

      <Clause heading="Changes">
        <p>
          If these terms change in a way that affects you, you will hear about it before it takes
          effect, not after. The date at the top is the only version that applies.
        </p>
      </Clause>
    </LegalDoc>
  )
}
