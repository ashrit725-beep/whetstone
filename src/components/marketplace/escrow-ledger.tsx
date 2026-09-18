/**
 * The escrow ledger, printed rather than summarised.
 *
 * Every row is a real `bounty_escrow_events` row: what moved, from which state
 * to which, how much, and the escrow reference it was filed under. A bounty has
 * one escrow and so one reference, which is what a creator or a reviewer quotes
 * when they ask about a movement.
 *
 * Two layouts from the same entries. From 40rem up it is a five-column table.
 * Below that, five columns either wrap the date onto three lines or push the
 * reference behind a horizontal scroll with no cue that it is there, so each
 * movement becomes a short stacked entry instead: what moved and how much, the
 * note under it, then the date, the state change and the reference. Only one
 * of the two is ever displayed, so assistive technology meets one ledger.
 */

import { Table, THead, TBody, TR, TH, TD, TableEmpty } from '@/components/ui'
import { money } from '@/components/marketplace/format'
import { ESCROW_STATE } from '@/components/marketplace/bounty-state'
import type { EscrowEntry } from '@/server/queries/bounty-ops'

const EVENT_WORDING: Record<string, string> = {
  authorize: 'Amount committed',
  capture: 'Amount captured',
  hold: 'Moved into escrow',
  release: 'Released to the reviewer',
  partial_release: 'Part released to the reviewer',
  refund: 'Returned to the creator',
  chargeback: 'Reversed by the bank',
  dispute_open: 'Dispute opened',
  dispute_resolve: 'Dispute resolved',
  fee: 'Platform fee',
}

const CAPTION = 'Every movement on this bounty, oldest first.'
const EMPTY_TITLE = 'No escrow movements yet'
const EMPTY_DETAIL =
  'Nothing has been committed against this bounty, so the ledger has no rows to show.'

const DATE = new Intl.DateTimeFormat('en', { day: 'numeric', month: 'short', year: 'numeric' })

export function EscrowLedger({
  entries,
  currency,
}: {
  entries: readonly EscrowEntry[]
  currency: string
}) {
  return (
    <>
      <div className="hidden sm:block">
        <Table caption={CAPTION}>
          <THead>
            <TR>
              <TH>When</TH>
              <TH>Movement</TH>
              <TH>State</TH>
              <TH numeric>Amount</TH>
              <TH>Reference</TH>
            </TR>
          </THead>
          {entries.length === 0 ? (
            <TableEmpty colSpan={5} title={EMPTY_TITLE} detail={EMPTY_DETAIL} />
          ) : (
            <TBody>
              {entries.map((entry) => (
                <TR key={entry.id}>
                  <TD className="tnum whitespace-nowrap">{DATE.format(new Date(entry.createdAt))}</TD>
                  <TD>
                    <span className="block">{movement(entry)}</span>
                    {entry.note ? (
                      <span className="measure-ui mt-3xs block text-xs text-text-3">{entry.note}</span>
                    ) : null}
                  </TD>
                  <TD>
                    <StateChange entry={entry} />
                  </TD>
                  <TD numeric>{money(entry.amountCents, entry.currency || currency)}</TD>
                  <TD>
                    <Reference value={entry.providerRef} />
                  </TD>
                </TR>
              ))}
            </TBody>
          )}
        </Table>
      </div>

      <div className="sm:hidden">
        {entries.length === 0 ? (
          <div className="flex flex-col gap-2xs rounded-md border border-border-hair bg-surface-1 p-md">
            <p className="text-sm text-text-1">{EMPTY_TITLE}</p>
            <p className="text-sm text-text-2">{EMPTY_DETAIL}</p>
          </div>
        ) : (
          <ol
            aria-label={CAPTION}
            className="rounded-md border border-border-hair bg-surface-1 px-md"
          >
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-col gap-3xs border-t border-border-hair py-sm first:border-t-0"
              >
                <p className="flex items-baseline justify-between gap-md text-sm text-text-1">
                  <span className="min-w-0">{movement(entry)}</span>
                  <span className="tnum shrink-0">
                    {money(entry.amountCents, entry.currency || currency)}
                  </span>
                </p>
                {entry.note ? <p className="text-xs text-text-3">{entry.note}</p> : null}
                <p className="flex flex-wrap items-baseline gap-x-xs gap-y-3xs text-xs text-text-2">
                  <span className="tnum whitespace-nowrap">
                    {DATE.format(new Date(entry.createdAt))}
                  </span>
                  <span aria-hidden="true" className="text-text-3">
                    ·
                  </span>
                  <span>
                    <StateChange entry={entry} />
                  </span>
                  <span aria-hidden="true" className="text-text-3">
                    ·
                  </span>
                  <Reference value={entry.providerRef} />
                </p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  )
}

function movement(entry: EscrowEntry): string {
  return EVENT_WORDING[entry.eventKind] ?? entry.eventKind
}

/** A movement that leaves the state where it was, like the fee after a release, prints one state. */
function StateChange({ entry }: { entry: EscrowEntry }) {
  return (
    <>
      {entry.fromState && entry.fromState !== entry.toState ? (
        <>
          <span className="text-text-3">{ESCROW_STATE[entry.fromState].label.toLowerCase()}</span>
          <span aria-hidden="true" className="text-text-3">
            {' '}
            →{' '}
          </span>
          <span className="sr-only"> to </span>
        </>
      ) : null}
      <span>{ESCROW_STATE[entry.toState].label.toLowerCase()}</span>
    </>
  )
}

function Reference({ value }: { value: string | null }) {
  return value ? (
    <code className="text-xs text-text-3">{value}</code>
  ) : (
    <span className="text-xs text-text-3">No reference</span>
  )
}

export default EscrowLedger
