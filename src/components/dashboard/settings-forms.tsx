'use client'

/**
 * The settings forms.
 *
 * All four are real `<form action={serverAction}>` elements posting to Server
 * Actions, so they submit and validate with JavaScript switched off;
 * `useActionState` adds the pending state, the field-level errors and the
 * spoken result on top. Every field has a visible label above it, and every
 * helper slot is reserved at 1lh so an arriving error moves nothing.
 *
 * Keyboard contract for all of them: Tab follows visual order, Enter submits
 * from any text field, Space toggles a checkbox, and arrow keys move within a
 * radio group as native radios do. Nothing here traps focus.
 */

import { useEffect, useState } from 'react'
import {
  Banner,
  Checkbox,
  Field,
  Form,
  FormStatus,
  Input,
  RadioGroup,
  SubmitButton,
  Textarea,
  type FormState,
} from '@/components/ui'
import {
  saveAccount,
  saveAppearance,
  saveNotifications,
  saveProfile,
} from '@/app/(app)/settings/actions'

/* ------------------------------------------------------------------ profile */

export interface ProfileFormProps {
  displayName: string
  bio: string
  pronouns: string
  location: string
  availability: 'open' | 'limited' | 'closed'
  searchable: boolean
}

export function ProfileForm(props: ProfileFormProps) {
  return (
    <Form action={saveProfile} summaryTitle="Your profile was not saved.">
      {({ state }) => (
        <>
          <Field
            id="displayName"
            label="Display name"
            hint="What reviewers see beside every note you write."
            required
            error={state.fieldErrors?.['displayName']}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="displayName"
                defaultValue={props.displayName}
                autoComplete="name"
                aria-describedby={describedBy}
                invalid={invalid}
                required
              />
            )}
          </Field>

          <Field
            id="bio"
            label="Bio"
            optional
            hint="A few lines about what you build and what you are good at reviewing."
            error={state.fieldErrors?.['bio']}
          >
            {({ id, describedBy, invalid }) => (
              <Textarea
                id={id}
                name="bio"
                prose
                rows={5}
                defaultValue={props.bio}
                maxChars={600}
                aria-describedby={describedBy}
                invalid={invalid}
              />
            )}
          </Field>

          <div className="grid gap-lg sm:grid-cols-2">
            <Field id="pronouns" label="Pronouns" optional error={state.fieldErrors?.['pronouns']}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="pronouns"
                  defaultValue={props.pronouns}
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>

            <Field id="location" label="Where you are" optional error={state.fieldErrors?.['location']}>
              {({ id, describedBy, invalid }) => (
                <Input
                  id={id}
                  name="location"
                  defaultValue={props.location}
                  autoComplete="address-level2"
                  aria-describedby={describedBy}
                  invalid={invalid}
                />
              )}
            </Field>
          </div>

          <RadioGroup
            legend="How much reviewing you want right now"
            name="availability"
            defaultValue={props.availability}
            hint="This sits on your public profile, so people know before they ask."
            options={[
              {
                value: 'open',
                label: 'Open',
                description: 'Happy to be asked for a review.',
              },
              {
                value: 'limited',
                label: 'Limited',
                description: 'Taking a few, and slower than usual.',
              },
              {
                value: 'closed',
                label: 'Closed',
                description: 'Not reviewing at the moment.',
              },
            ]}
          />

          <Checkbox
            id="searchable"
            name="searchable"
            defaultChecked={props.searchable}
            label="Let people find me in reviewer search"
            description="Off means your profile still works from a direct link, it just does not appear in the reviewer list."
          />

          <div className="flex flex-wrap items-center gap-md">
            <SubmitButton variant="primary" pendingLabel="Saving your profile…">
              Save the profile
            </SubmitButton>
            <FormStatus state={state} />
          </div>
        </>
      )}
    </Form>
  )
}

/* ------------------------------------------------------------------ account */

export interface AccountFormProps {
  handle: string
  email: string
  emailVerified: boolean
}

export function AccountForm(props: AccountFormProps) {
  return (
    <Form action={saveAccount} summaryTitle="Your account was not saved.">
      {({ state }) => (
        <>
          <Field
            id="handle"
            label="Handle"
            hint={`Your profile lives at /u/${props.handle}. Changing it breaks links other people have shared.`}
            required
            error={state.fieldErrors?.['handle']}
          >
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                name="handle"
                defaultValue={props.handle}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-describedby={describedBy}
                invalid={invalid}
                required
              />
            )}
          </Field>

          <Field
            id="email"
            label="Email"
            // Reset links go out whether or not the address was verified, and
            // there is no verification step to send anyone to, so an
            // unverified address is described by what it is used for. The
            // old line said recovery would not reach it, which was false.
            hint={props.emailVerified ? 'Verified.' : 'Password reset links go to this address.'}
            disabled
            disabledReason="The address you sign in with is fixed to this account."
          >
            {({ id, describedBy }) => (
              <Input
                id={id}
                name="email"
                type="email"
                defaultValue={props.email}
                autoComplete="email"
                aria-describedby={describedBy}
                disabled
                readOnly
              />
            )}
          </Field>

          <div className="flex flex-wrap items-center gap-md">
            <SubmitButton variant="primary" pendingLabel="Saving your account…">
              Save the account
            </SubmitButton>
            <FormStatus state={state} />
          </div>
        </>
      )}
    </Form>
  )
}

/* ------------------------------------------------------------ notifications */

export interface NotificationRow {
  readonly kind: string
  readonly label: string
  readonly detail: string
  readonly inApp: boolean
}

export interface NotificationPrefsProps {
  rows: readonly NotificationRow[]
}

/**
 * One channel, because one is all Whetstone delivers: the bell. This used to
 * offer a "By email" column and a weekly brief "sent to you", and nothing sends
 * either, so both switches changed a stored value and nothing else. They come
 * back when a sender exists to read them.
 */
export function NotificationPrefs({ rows }: NotificationPrefsProps) {
  return (
    <Form action={saveNotifications} summaryTitle="These preferences were not saved.">
      {({ state }) => (
        <>
          <div
            role="region"
            aria-label="Notification kinds"
            tabIndex={0}
            data-scroll-region
            className="w-full overflow-x-auto rounded-md border border-border-hair"
          >
            <table className="relative w-full border-collapse text-left">
              <caption className="sr-only">Which notifications reach your bell</caption>
              <thead className="bg-surface-2">
                <tr>
                  <th
                    scope="col"
                    className="rounded-none border-b border-border-hair px-md py-sm text-2xs text-text-3"
                    style={{ fontVariationSettings: '"wdth" 87, "wght" 600' }}
                  >
                    What happened
                  </th>
                  <th
                    scope="col"
                    className="rounded-none border-b border-border-hair px-md py-sm text-2xs whitespace-nowrap text-text-3"
                    style={{ fontVariationSettings: '"wdth" 87, "wght" 600' }}
                  >
                    Notify me
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.kind}
                    className="border-b border-border-hair odd:bg-surface-1 even:bg-surface-2"
                  >
                    <th
                      scope="row"
                      className="rounded-none px-md py-sm text-left align-middle font-normal"
                    >
                      <span className="flex flex-col gap-3xs">
                        <span className="text-sm text-text-1">{row.label}</span>
                        <span className="measure-ui text-xs text-text-3">{row.detail}</span>
                      </span>
                    </th>
                    <td className="rounded-none px-md py-2xs align-middle">
                      {/* No reserved helper line: this box can never carry an
                          error, and the empty line sat it above the middle of
                          its row. */}
                      <Checkbox
                        id={`in-app-${row.kind}`}
                        name={`in-app:${row.kind}`}
                        defaultChecked={row.inApp}
                        wrapperClassName="[&>[aria-live]]:hidden [&>label]:items-center"
                        label={<span className="sr-only">{`Notify me when: ${row.label}`}</span>}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-md">
            <SubmitButton variant="primary" pendingLabel="Saving these preferences…">
              Save the preferences
            </SubmitButton>
            <FormStatus state={state} />
          </div>
        </>
      )}
    </Form>
  )
}

/* --------------------------------------------------------------- appearance */

export interface AppearanceFormProps {
  theme: 'system' | 'light' | 'dark'
}

export function AppearanceForm({ theme }: AppearanceFormProps) {
  const current = useThemeCookie(theme)
  return (
    <Form action={saveAppearance} summaryTitle="This setting was not saved.">
      {({ state }) => (
        <>
          <ApplyTheme state={state} />

          {/* Keyed on the live setting, so switching the theme from the header
              while this page is open moves the checked option with it. */}
          <RadioGroup
            key={current}
            legend="Theme"
            name="theme"
            defaultValue={current}
            options={[
              {
                value: 'system',
                label: 'Follow the system',
                description: 'Changes when your operating system does.',
              },
              { value: 'light', label: 'Light', description: 'Warm paper and near-black ink.' },
              { value: 'dark', label: 'Dark', description: 'An ink-dark ground with paper-coloured type.' },
            ]}
          />

          <Banner variant="info" title="Motion follows your system setting">
            Nothing in Whetstone animates for longer than 400 milliseconds, nothing repeats for ever,
            and turning on reduce motion in your operating system removes the rest. There is no
            separate switch here because there is nothing left for it to turn off.
          </Banner>

          <div className="flex flex-wrap items-center gap-md">
            <SubmitButton variant="primary" pendingLabel="Saving the theme…">
              Save the theme
            </SubmitButton>
            <FormStatus state={state} />
          </div>
        </>
      )}
    </Form>
  )
}

type ThemeSetting = AppearanceFormProps['theme']

function readThemeCookie(): ThemeSetting {
  const match = /(?:^|; )ws_theme=([^;]*)/.exec(document.cookie)
  const value = match?.[1] ? decodeURIComponent(match[1]) : ''
  return value === 'light' || value === 'dark' ? value : 'system'
}

/**
 * The theme as the cookie says it is now. `ws-theme` is the event both this
 * form and the header toggle dispatch after writing the cookie, so each one
 * follows a change made by the other without a reload.
 */
function useThemeCookie(initial: ThemeSetting): ThemeSetting {
  const [value, setValue] = useState<ThemeSetting>(initial)
  useEffect(() => {
    const sync = () => {
      setValue(readThemeCookie())
    }
    window.addEventListener('ws-theme', sync)
    return () => {
      window.removeEventListener('ws-theme', sync)
    }
  }, [])
  return value
}

/**
 * Applies the saved theme to the document root the moment the action succeeds,
 * and tells the header toggle, so its glyph and label follow the save.
 *
 * Without it the cookie is right and the page in front of the reader is not,
 * until the next full load. This is a genuine external-system sync, which is
 * what an effect is for.
 */
function ApplyTheme({ state }: { state: FormState }) {
  // Keyed on the result object, not on "succeeded": a second save also
  // succeeds, and a boolean that stays true never ran the effect again.
  useEffect(() => {
    if (state.status !== 'success') return
    const value = readThemeCookie()
    const root = document.documentElement
    if (value === 'system') delete root.dataset.theme
    else root.dataset.theme = value
    window.dispatchEvent(new Event('ws-theme'))
  }, [state])
  return null
}
