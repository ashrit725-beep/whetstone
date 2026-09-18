/**
 * Verification, stated rather than asserted.
 *
 * A generic tick beside a name tells a reader nothing they can check. Each row
 * here names the area that was verified, what kind of evidence was accepted,
 * and the date it was accepted, so a reader can decide how much it is worth.
 * Unverified declared areas are shown in the same list, marked as declared, for
 * the same reason: hiding them would let the verified ones stand for all.
 *
 * An area can be verified with no credential row behind it. It still gets the
 * verified mark here, because the marketplace row badges every verified area
 * and the two surfaces must name the same set. It has no evidence line of its
 * own to print, so it states the level and the verification and nothing it
 * would have to borrow from another area's credential.
 */

import { BadgeCheck } from 'lucide-react'
import { Badge } from '@/components/ui'
import { credentialWording, type VerifiedCredential } from '@/server/queries/profile'

export interface DeclaredArea {
  slug: string
  label: string
  level: 'familiar' | 'practitioner' | 'specialist'
  isVerified: boolean
}

const LEVEL_WORDING: Record<DeclaredArea['level'], string> = {
  specialist: 'Specialist',
  practitioner: 'Practitioner',
  familiar: 'Familiar',
}

export function VerifiedCredentials({
  credentials,
  declared,
}: {
  credentials: readonly VerifiedCredential[]
  declared?: readonly DeclaredArea[]
}) {
  if (credentials.length === 0 && (declared ?? []).length === 0) {
    return (
      <p className="measure-ui text-xs text-text-3">
        Nothing verified yet. Expertise here is verified per area, so an unverified
        listing stays unlisted until at least one area is checked.
      </p>
    )
  }

  const credentialed = new Set(credentials.map((c) => c.expertiseLabel))
  const areas = declared ?? []
  const verifiedOnly = areas.filter((area) => area.isVerified && !credentialed.has(area.label))
  const declaredOnly = areas.filter((area) => !area.isVerified && !credentialed.has(area.label))

  return (
    <dl className="flex flex-col gap-sm">
      {credentials.map((credential) => (
        <div key={credential.id} className="flex flex-col gap-3xs">
          <dt className="flex items-center gap-2xs text-sm text-text-1">
            <BadgeCheck size={20} strokeWidth={1.5} aria-hidden="true" className="text-positive" />
            <span>{credential.expertiseLabel ?? 'General review practice'}</span>
            <span className="sr-only">verified</span>
          </dt>
          <dd className="text-xs text-text-2">
            {credentialWording(credential.credential)}
            <span className="text-text-3">
              {' '}
              · checked{' '}
              <span className="tnum">
                {new Intl.DateTimeFormat('en', {
                  month: 'short',
                  year: 'numeric',
                }).format(new Date(credential.issuedAt))}
              </span>
            </span>
          </dd>
        </div>
      ))}

      {verifiedOnly.map((area) => (
        <div key={area.slug} className="flex flex-col gap-3xs">
          <dt className="flex items-center gap-2xs text-sm text-text-1">
            <BadgeCheck size={20} strokeWidth={1.5} aria-hidden="true" className="text-positive" />
            <span>{area.label}</span>
            <span className="sr-only">verified</span>
          </dt>
          <dd className="text-xs text-text-2">{LEVEL_WORDING[area.level]}. Verified by Whetstone.</dd>
        </div>
      ))}

      {declaredOnly.map((area) => (
        <div key={area.slug} className="flex flex-col gap-3xs">
          <dt className="flex items-center gap-2xs text-sm text-text-2">
            <span>{area.label}</span>
            <Badge tone="neutral">Declared</Badge>
          </dt>
          <dd className="text-xs text-text-3">
            {LEVEL_WORDING[area.level]} by their own account. Nobody has checked this area.
          </dd>
        </div>
      ))}
    </dl>
  )
}

export default VerifiedCredentials
