import type { Metadata } from 'next'
import { Clause, LegalDoc } from '../_doc'

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What Whetstone stores, why it stores it, what is public, and what closing your account does.',
}

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy"
      updated="18 September 2026"
      standfirst="The short version: we store what the product needs to work, we do not sell it, and you can close your account whenever you like."
    >
      <Clause heading="What we store">
        <p>
          Your email address and a hash of your password, so you can sign in. Your handle, display
          name and anything you choose to put on your profile. The projects you post and the reviews
          you write, which are public by design. Notification preferences. That is the list.
        </p>
        <p>
          We keep a record of sessions so you can sign out of every device at once, including one
          you no longer have. We keep rate-limit counters so one account cannot flood the service.
          Both expire.
        </p>
      </Clause>

      <Clause heading="What we do not do">
        <p>
          We do not sell anything about you. We do not run third-party advertising or tracking
          scripts. We do not build a profile of you from anywhere other than what you do here.
        </p>
      </Clause>

      <Clause heading="What is public">
        <p>
          Projects, reviews, discussion posts, your handle, your display name, your bio and your
          reputation are public. Your email address is not, and is never shown to another person.
        </p>
      </Clause>

      <Clause heading="Feedback and language models">
        <p>
          Some features group similar reviews together, sort them by severity, and suggest where to
          start. Where a model is used for that, the text of the review is sent to the provider for
          the length of that request and is not used to train anything.
        </p>
        <p>
          Every one of those features also has a version that runs here, with no model involved. The
          interface tells you which one produced what you are looking at, every time.
        </p>
      </Clause>

      <Clause heading="Closing your account">
        <p>
          You can close your account from Settings, under Danger zone. Closing it signs you out on
          every device and takes your profile page down.
        </p>
        <p>
          Reviews you wrote on other people’s projects stay under your handle, and so do the reviews
          other people wrote on yours. A creator acted on them, and removing them would rewrite
          somebody else’s record.
        </p>
      </Clause>

      <Clause heading="Getting in touch">
        <p>
          Ask for anything in this document and you will get an answer from a person, not a form.
          The Ask for help link in the footer reaches the same place from every page.
        </p>
      </Clause>
    </LegalDoc>
  )
}
