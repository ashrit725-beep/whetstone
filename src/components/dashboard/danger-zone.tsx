'use client'

/**
 * The danger zone.
 *
 * Three actions, graded by how hard they are to undo, and each one states the
 * real count it is about to affect rather than a generic warning:
 *
 *   Close feedback   reversible here — “Take feedback again” sits beside it —
 *                    so it is one button with no confirmation. A confirm dialog
 *                    on a reversible action is a habit that teaches people to
 *                    click through the ones that matter. The reverse used to be
 *                    promised “from its project page”, where no such control
 *                    existed, and the only way back was to post a new build.
 *   Sign out         disruptive but not destructive, and it names the number of
 *                    devices before you press it.
 *   Close account    confirm by typing your own handle. Not a checkbox and not a
 *                    second “are you sure”: typing is the only confirmation that
 *                    cannot be got through by muscle memory.
 *
 * Closing an account deactivates it. Every note other people wrote, and every
 * note you wrote on their work, stays where it is, because a hard delete would
 * quietly rewrite somebody else’s evidence. The account's projects close and
 * leave Discover (`deactivateAccount`), and sign-in refuses the account from
 * then on, which the warning says in so many words: it used to promise that
 * signing in again reopened it, and it does not.
 *
 * Keyboard contract: Tab reaches the three forms in order; each submit button is
 * reachable and never disabled at idle. The confirm field is a plain text input,
 * so paste works.
 */

import { Lock, LockOpen, LogOut, TriangleAlert } from 'lucide-react'
import {
  Banner,
  Field,
  Form,
  FormStatus,
  Input,
  SubmitButton,
} from '@/components/ui'
import {
  closeFeedbackEverywhere,
  deactivate,
  reopenFeedbackEverywhere,
  signOutEverywhere,
} from '@/app/(app)/settings/actions'

export interface DangerZoneProps {
  handle: string
  /** Every project the account owns, drafts included. */
  projects: number
  /** Projects still taking notes, so the ones closing would affect. */
  openProjects: number
  /** Projects already closed, so the ones reopening would affect. */
  closedProjects: number
  feedbackReceived: number
  feedbackWritten: number
  openSuggestions: number
  liveSessions: number
}

/** The first paragraph, which names what closing touches in the right number. */
function closeFeedbackCopy(open: number, total: number): string {
  const undo = 'Nothing already written is lost, and you can take feedback again from this page — posting a new build reopens a project too.'
  if (total === 0) return 'You do not own a project, so nothing is taking feedback.'
  if (open === 0) {
    return total === 1
      ? `Your project is closed to new notes. ${undo}`
      : `Every project you own is closed to new notes. ${undo}`
  }
  if (total === 1) {
    return `Your project is open to new notes. Closing it stops anything new arriving. ${undo}`
  }
  if (open === total) {
    // Not "3 of your 3 projects".
    const all = total === 2 ? 'Both your projects are' : `All ${String(total)} of your projects are`
    return `${all} open to new notes. Closing them stops anything new arriving. ${undo}`
  }
  return `${String(open)} of your ${String(total)} projects ${open === 1 ? 'is' : 'are'} open to new notes, and ${String(total - open)} ${total - open === 1 ? 'is' : 'are'} closed. Closing stops anything new arriving. ${undo}`
}

export function DangerZone(props: DangerZoneProps) {
  const devices =
    props.liveSessions === 1 ? 'this device' : `${String(props.liveSessions)} devices`
  const one = props.projects === 1
  const closingOne = props.openProjects === 1
  const reopeningOne = props.closedProjects === 1

  return (
    <div className="flex flex-col gap-2xl">
      <section aria-labelledby="close-feedback" className="flex flex-col gap-sm">
        <h2 id="close-feedback" className="text-md text-text-1">
          Stop taking feedback
        </h2>
        <p className="measure-ui text-sm text-text-2">
          {closeFeedbackCopy(props.openProjects, props.projects)}
        </p>
        {/* Each control is offered only when it has rows to act on: the close
            button used to stay after everything was closed, and answered the
            second press with "nothing changed". */}
        {props.openProjects > 0 ? (
          <Form action={closeFeedbackEverywhere} showSummary={false}>
            {({ state }) => (
              <div className="flex flex-wrap items-center gap-md">
                <SubmitButton
                  pendingLabel={closingOne ? 'Closing it…' : 'Closing them…'}
                  iconLeading={<Lock size={20} strokeWidth={1.5} />}
                >
                  {closingOne
                    ? 'Close your project to new feedback'
                    : 'Close every project to new feedback'}
                </SubmitButton>
                <FormStatus state={state} />
              </div>
            )}
          </Form>
        ) : null}
        {props.closedProjects > 0 ? (
          <Form action={reopenFeedbackEverywhere} showSummary={false}>
            {({ state }) => (
              <div className="flex flex-wrap items-center gap-md">
                <SubmitButton
                  pendingLabel={reopeningOne ? 'Reopening it…' : 'Reopening them…'}
                  iconLeading={<LockOpen size={20} strokeWidth={1.5} />}
                >
                  {reopeningOne
                    ? 'Take feedback again on your project'
                    : 'Take feedback again on every closed project'}
                </SubmitButton>
                <FormStatus state={state} />
              </div>
            )}
          </Form>
        ) : null}
      </section>

      <section
        aria-labelledby="sign-out"
        className="flex flex-col gap-sm border-t border-border-hair pt-2xl"
      >
        <h2 id="sign-out" className="text-md text-text-1">
          Sign out everywhere
        </h2>
        {/* One device has no plural to refer back to, and "every one of those
            sessions" had no antecedent on the common case. */}
        <p className="measure-ui text-sm text-text-2">
          {props.liveSessions === 1
            ? 'You are signed in on this device only. This ends that session and sends you back to the sign-in screen.'
            : `You are signed in on ${devices}. This ends every one of those sessions, including this one, and sends you back to the sign-in screen.`}
        </p>
        <Form action={signOutEverywhere} showSummary={false}>
          {({ state }) => (
            <div className="flex flex-wrap items-center gap-md">
              <SubmitButton
                pendingLabel="Signing you out…"
                iconLeading={<LogOut size={20} strokeWidth={1.5} />}
              >
                Sign out everywhere
              </SubmitButton>
              <FormStatus state={state} />
            </div>
          )}
        </Form>
      </section>

      <section
        aria-labelledby="close-account"
        className="flex flex-col gap-sm border-t border-border-hair pt-2xl"
      >
        <h2 id="close-account" className="text-md text-text-1">
          Close your account
        </h2>

        <Banner variant="warning" title="What closing your account does, exactly">
          <ul className="m-0 flex list-none flex-col gap-2xs p-0">
            <li className="text-sm">
              {`You are signed out on ${devices}, and your profile page comes down.`}
            </li>
            {props.projects > 0 ? (
              <li className="text-sm">
                {one
                  ? 'Your project stops accepting feedback and drops out of Discover.'
                  : `Your ${String(props.projects)} projects stop accepting feedback and drop out of Discover.`}
              </li>
            ) : null}
            {props.feedbackReceived > 0 ? (
              <li className="text-sm">
                {props.feedbackReceived === 1
                  ? 'The one note a reviewer wrote on your work stays written. It is someone else’s work, and deleting it would take the evidence out from under their reputation.'
                  : `The ${String(props.feedbackReceived)} notes reviewers wrote on your work stay written. They are other people’s work, and deleting them would take the evidence out from under their reputation.`}
              </li>
            ) : null}
            {props.feedbackWritten > 0 ? (
              <li className="text-sm">
                {props.feedbackWritten === 1
                  ? 'The one note you wrote on someone else’s project stays too, under your handle.'
                  : `The ${String(props.feedbackWritten)} notes you wrote on other people’s projects stay too, under your handle.`}
              </li>
            ) : null}
            {props.openSuggestions > 0 ? (
              // Not "still open": the tracker's Open column is a narrower set,
              // and the rail counts that one under the same word.
              <li className="text-sm">
                {props.openSuggestions === 1
                  ? '1 suggestion is not shipped or declined yet, and the reviewers behind it never hear what happened.'
                  : `${String(props.openSuggestions)} suggestions are not shipped or declined yet, and the reviewers behind them never hear what happened.`}
              </li>
            ) : null}
            <li className="text-sm">
              Your email address and handle stay attached to the closed account, so neither can be
              used to sign up again.
            </li>
            <li className="text-sm">
              You cannot sign back in to a closed account, so this one has no undo. Nothing is
              deleted: everything written here keeps its place.
            </li>
          </ul>
        </Banner>

        <Form action={deactivate} summaryTitle="Your account was not closed.">
          {({ state }) => (
            <>
              <Field
                id="confirm"
                label={`Type ${props.handle} to confirm`}
                hint="Your own handle, exactly as it appears above. Paste works."
                required
                error={state.fieldErrors?.['confirm']}
              >
                {({ id, describedBy, invalid }) => (
                  <Input
                    id={id}
                    name="confirm"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-describedby={describedBy}
                    invalid={invalid}
                    required
                  />
                )}
              </Field>

              <div className="flex flex-wrap items-center gap-md">
                <SubmitButton
                  variant="danger"
                  pendingLabel="Closing your account…"
                  iconLeading={<TriangleAlert size={20} strokeWidth={1.5} />}
                >
                  Close my account
                </SubmitButton>
                <FormStatus state={state} />
              </div>
            </>
          )}
        </Form>
      </section>
    </div>
  )
}

export default DangerZone
