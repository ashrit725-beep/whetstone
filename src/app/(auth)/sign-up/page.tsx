/**
 * Create an account. Same column, same grammar as sign-in: one 24rem column,
 * left-aligned, on `surface-1`, control edges the only structure.
 */

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Link } from '@/components/ui'
import { currentUser } from '@/server/queries/auth'
import { firstParam, safeNextPath, withNext, type RawSearchParams } from '../schema'
import { SignUpForm } from '../_components/sign-up-form'

export const metadata: Metadata = {
  title: 'Create an account',
  description:
    'Create a Whetstone account to post what you are building and get feedback sorted by the categories that matter for it.',
  robots: { index: false, follow: true },
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>
}) {
  const sp = await searchParams
  const next = safeNextPath(firstParam(sp['next']))

  const viewer = await currentUser()
  if (viewer) redirect(next)

  return (
    <div className="flex flex-col gap-lg">
      <div className="flex flex-col gap-sm">
        <h1 className="text-2xl">Create an account</h1>
        <p className="measure-ui text-sm text-text-2">
          One account covers both sides: post what you are building, and review what other people
          are building. Four fields, no confirmation step.
        </p>
      </div>

      <SignUpForm next={next} />

      <p className="measure-ui text-sm text-text-2">
        Already have an account?{' '}
        <Link href={withNext('/sign-in', next)}>Sign in</Link>.
      </p>
    </div>
  )
}
