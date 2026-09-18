'use client'

/**
 * The keyboard accelerators, stated visibly above the feed rather than left for
 * the reader to discover. A shortcut nobody is told about is not an
 * affordance, and a tooltip is not the place to tell them (§8.4.46).
 *
 * Quiet, though: `.ws-hint` takes it to tertiary ink, and it is not drawn below
 * 40rem or on a coarse pointer, where it wrapped to two lines of key caps
 * describing keys the reader does not have.
 *
 * Placement note: a client module only so it sits on the same side of the
 * boundary as the rest of this directory. There are no hooks here.
 */

import { Kbd } from '@/components/ui'

export function ShortcutHint() {
  return (
    <p className="ws-hint mt-sm mb-xs text-xs">
      <Kbd>/</Kbd> searches, <Kbd>j</Kbd> and <Kbd>k</Kbd> move between rows,{' '}
      <Kbd>Enter</Kbd> opens one.
    </p>
  )
}

export default ShortcutHint
