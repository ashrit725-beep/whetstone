'use client'

/**
 * Hold every field's value across a rejected submit.
 *
 * React 19 resets a form once its action settles. The reset is internal, not
 * the cancelable `reset` event, so `onReset` cannot refuse it: React clears the
 * DOM value while the state that should be driving the controlled input is
 * unchanged, sees no difference in the `value` prop on the next render, and
 * never writes it back. What the person saw was a sign-in rejected with “check
 * both” and an email box that had just been emptied for them.
 *
 * This runs after every commit, including the one that carries the action
 * result, and writes a value back only where the DOM has drifted from state.
 * Assigning `.value` goes through the setter React instruments, so its change
 * tracker stays in step and the next keystroke still fires `onChange`.
 *
 * SC 3.3.7 Redundant Entry: a failed attempt must not re-ask for what was
 * already given. Keys are `Field` ids, the same ids the error summary links to.
 */

import { useLayoutEffect } from 'react'

export function useKeepFieldValues(values: Readonly<Record<string, string>>): void {
  useLayoutEffect(() => {
    for (const [id, value] of Object.entries(values)) {
      const node = document.getElementById(id)
      if (node instanceof HTMLInputElement && node.value !== value) {
        node.value = value
      }
    }
  })
}
