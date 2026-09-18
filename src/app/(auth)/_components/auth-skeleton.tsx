/**
 * Loading geometry for the auth column, box for box.
 *
 * These skeletons are built out of the same wrapper classes as the real pages
 * rather than out of hand-computed pixel totals, so the two agree by
 * construction: `Field` stacks label, optional rule, control and helper at
 * `gap-2xs`; the helper reserves 1lh at `--text-xs`; `Input` is 44px; `Form`
 * stacks at `gap-lg`; the page stacks heading block, form and closing line at
 * `gap-lg`. A wrapped paragraph is drawn as stacked bars with no gap, because
 * wrapped lines have none.
 *
 * The whole page is replaced while it loads, not just the form, so each
 * skeleton here carries every block the loaded route carries, down to the
 * closing line under the form. A skeleton that stops at the submit button
 * hands the reader a page that grows the instant it resolves.
 */

import { Skeleton } from '@/components/ui'

/* ---------------------------------------------------------------- pieces -- */

/** Wrapped body lines: no gap between them, because wrapped text has none. */
function Lines({ widths }: { widths: readonly string[] }) {
  return (
    <div className="flex flex-col">
      {widths.map((w, i) => (
        <Skeleton key={i} w={w} h="1lh" radius="xs" />
      ))}
    </div>
  )
}

interface HeadBlockProps {
  /**
   * One entry per line the real heading wraps to in the 24rem column. Three of
   * the four headings take two lines at every width, and a one-line bar made
   * the page drop by a whole display line the moment it loaded.
   */
  heading: readonly string[]
  /** One entry per line the real standfirst wraps to. */
  sub: readonly string[]
}

function HeadBlock({ heading, sub }: HeadBlockProps) {
  return (
    <div className="flex flex-col gap-sm" aria-hidden="true">
      <div className="text-2xl">
        <Lines widths={heading} />
      </div>
      <div className="text-sm">
        <Lines widths={sub} />
      </div>
    </div>
  )
}

interface FieldSkeletonProps {
  label: string
  /** One entry per line of the field's rule, when it has one. */
  hint?: readonly string[]
}

function FieldSkeleton({ label, hint }: FieldSkeletonProps) {
  return (
    <div className="flex flex-col gap-2xs" aria-hidden="true">
      <div className="text-base">
        <Skeleton w={label} h="1lh" radius="xs" />
      </div>
      {hint ? (
        <div className="text-xs">
          <Lines widths={hint} />
        </div>
      ) : null}
      <Skeleton h="2.75rem" radius="sm" />
      {/* The reserved helper slot, empty here exactly as it is at rest. */}
      <div className="text-xs" style={{ minHeight: '1lh' }} />
    </div>
  )
}

/** The strength block that hangs off the password field at `gap-xs`. */
function StrengthSkeleton() {
  return (
    <div className="flex flex-col gap-2xs" aria-hidden="true">
      <div className="flex items-baseline justify-between gap-sm">
        <div className="text-sm">
          <Skeleton w="16ch" h="1lh" radius="xs" />
        </div>
        <div className="text-xs">
          <Skeleton w="6ch" h="1lh" radius="xs" />
        </div>
      </div>
      {/* The meter: a 0.75rem bar inside a 1px border, as `Meter` draws it. */}
      <Skeleton h="0.875rem" radius="xs" />
      <div className="text-xs">
        <Lines widths={['100%', '54%']} />
      </div>
    </div>
  )
}

function CheckboxSkeleton({ label, description }: { label: string; description: string }) {
  return (
    <div className="flex flex-col" aria-hidden="true">
      <div className="flex min-h-11 items-start gap-sm py-2xs">
        <span className="flex h-6 shrink-0 items-center">
          <Skeleton w="1.25rem" h="1.25rem" radius="xs" />
        </span>
        <span className="flex flex-col gap-3xs">
          <Skeleton w={label} h="1.5rem" radius="xs" />
          <div className="text-xs">
            <Skeleton w={description} h="1lh" radius="xs" />
          </div>
        </span>
      </div>
      <div className="text-xs" style={{ minHeight: '1lh' }} />
    </div>
  )
}

interface ActionRowProps {
  /** Width of the submit button bar. */
  button: string
  /** Width of the standalone link beside it, when there is one. */
  link?: string
}

function ActionRow({ button, link }: ActionRowProps) {
  return (
    <div className="flex flex-wrap items-center gap-lg" aria-hidden="true">
      <Skeleton w={button} h="2.75rem" radius="sm" />
      {link ? (
        <div className="text-sm">
          <Skeleton w={link} h="1lh" radius="xs" />
        </div>
      ) : null}
    </div>
  )
}

/**
 * Not an `<h1>`. Next leaves the resolved fallback in the document, so a
 * heading here would give the loaded route two level-one headings; a status
 * region says the same thing and adds nothing to the outline.
 */
function LoadingLabel({ label }: { label: string }) {
  return (
    <p role="status" className="sr-only">
      {label}
    </p>
  )
}

/* ----------------------------------------------------------------- pages -- */

/** Matches `/sign-in`: two fields, the stay-signed-in row, and the closing line. */
export function SignInSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-lg">
      <LoadingLabel label="Loading the sign-in form" />
      <HeadBlock heading={['5ch']} sub={['100%', '46%']} />

      <div className="flex flex-col gap-lg" aria-hidden="true">
        <FieldSkeleton label="5ch" />
        <FieldSkeleton label="8ch" />
        <CheckboxSkeleton label="24ch" description="40ch" />
        <ActionRow button="4.875rem" link="16ch" />
      </div>

      <div className="text-sm" aria-hidden="true">
        <Skeleton w="27ch" h="1lh" radius="xs" />
      </div>
    </div>
  )
}

/** Matches `/sign-up`: four fields, the strength block, and the two closing lines. */
export function SignUpSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-lg">
      <LoadingLabel label="Loading the sign-up form" />
      <HeadBlock heading={['56%', '48%']} sub={['100%', '100%', '30%']} />

      <div className="flex flex-col gap-lg" aria-hidden="true">
        <FieldSkeleton label="12ch" />
        <FieldSkeleton label="7ch" hint={['100%', '44%']} />
        <FieldSkeleton label="5ch" />
        <div className="flex flex-col gap-xs">
          <FieldSkeleton label="8ch" />
          <StrengthSkeleton />
        </div>
        <ActionRow button="8.25rem" />
        <div className="text-xs">
          <Skeleton w="48ch" h="1lh" radius="xs" />
        </div>
      </div>

      <div className="text-sm" aria-hidden="true">
        <Skeleton w="32ch" h="1lh" radius="xs" />
      </div>
    </div>
  )
}

/** Matches `/forgot-password`: one field with a three-line rule. */
export function ForgotSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-lg">
      <LoadingLabel label="Loading the password reset form" />
      <HeadBlock heading={['63%', '58%']} sub={['100%', '100%', '62%']} />

      <div className="flex flex-col gap-lg" aria-hidden="true">
        <FieldSkeleton label="5ch" hint={['100%', '100%', '38%']} />
        <ActionRow button="10.375rem" link="14ch" />
      </div>
    </div>
  )
}

/** Matches `/reset-password`: one password field and the strength block. */
export function ResetSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-lg">
      <LoadingLabel label="Checking the reset link" />
      <HeadBlock heading={['56%', '58%']} sub={['100%', '100%', '44%']} />

      <div className="flex flex-col gap-lg" aria-hidden="true">
        <div className="flex flex-col gap-xs">
          <FieldSkeleton label="12ch" />
          <StrengthSkeleton />
        </div>
        <ActionRow button="11.5rem" link="14ch" />
      </div>
    </div>
  )
}
