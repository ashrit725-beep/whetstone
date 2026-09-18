'use client'

/**
 * Validation timing, exactly as CONTRACT §5.5 and PLAYBOOK §4.1 specify:
 *
 *   first keystroke → first blur   nothing runs, nothing is shown
 *   blur, once touched             that field's rule runs
 *   input, only while showing      the rule re-runs, so a fix clears instantly
 *   submit                         the Server Action is the authority
 *
 * Server errors arrive keyed by `Field` id. Editing a field drops its server
 * error, and a fresh action result brings every server error back, tracked by
 * the identity of the `fieldErrors` object rather than by an effect.
 */

import { useCallback, useState } from 'react'
import { checkField, type AuthFieldId } from '../schema'

type ServerErrors = Readonly<Record<string, string>> | undefined

export interface AuthFields {
  /** The message to hand `Field`, or null. Client result wins over server result. */
  errorFor: (id: AuthFieldId) => string | null
  /** Wire to onBlur. Runs the rule once the field has been touched. */
  handleBlur: (id: AuthFieldId, value: string) => void
  /** Wire to onChange. Re-runs the rule only while a message is on screen. */
  handleChange: (id: AuthFieldId, value: string) => void
  /** For a result that arrives from the server out of band, such as a taken handle. */
  setError: (id: AuthFieldId, message: string | null) => void
}

export function useAuthFields(serverErrors: ServerErrors): AuthFields {
  const [clientErrors, setClientErrors] = useState<Record<string, string | null>>({})
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set<string>())
  const [seenServerErrors, setSeenServerErrors] = useState<ServerErrors>(serverErrors)

  // Derived state adjusted during render, never synced by an effect: a new
  // action result is a new object, and it un-dismisses everything.
  if (seenServerErrors !== serverErrors) {
    setSeenServerErrors(serverErrors)
    setDismissed(new Set<string>())
  }

  const errorFor = useCallback(
    (id: AuthFieldId): string | null => {
      const client = clientErrors[id]
      if (client) return client
      if (dismissed.has(id)) return null
      return serverErrors?.[id] ?? null
    },
    [clientErrors, dismissed, serverErrors],
  )

  const handleBlur = useCallback((id: AuthFieldId, value: string) => {
    // An untouched empty field says nothing on blur: tabbing through a form is
    // not a mistake.
    if (value.length === 0) return
    setClientErrors((prev) => ({ ...prev, [id]: checkField(id, value) }))
  }, [])

  const handleChange = useCallback((id: AuthFieldId, value: string) => {
    setDismissed((prev) => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      return next
    })
    setClientErrors((prev) => {
      if (!prev[id]) return prev
      return { ...prev, [id]: checkField(id, value) }
    })
  }, [])

  const setError = useCallback((id: AuthFieldId, message: string | null) => {
    setClientErrors((prev) => ({ ...prev, [id]: message }))
  }, [])

  return { errorFor, handleBlur, handleChange, setError }
}
