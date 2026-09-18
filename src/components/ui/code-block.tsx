/**
 * CodeBlock: a run of code, in a well, that scrolls by itself.
 *
 * Keyboard contract: the <pre> is a focusable, named scroll region
 * (`tabIndex={0}` plus `role="region"` and a label), so a keyboard user can
 * reach a wide snippet and scroll it with the arrow keys instead of being
 * stuck (SC 2.1.1). The copy control is a separate tab stop before the code.
 *
 * Contract notes: this and <kbd> are the only places mono type is legal
 * (§3.1). The well is `surface-0`, the radius is 4px, and the code never
 * wraps silently: it scrolls, because a wrapped command line is a wrong
 * command line.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CopyButton } from './copy-button'

export interface CodeBlockProps {
  code: string
  /** Shown as the header label, e.g. "bash" or "next.config.ts". */
  label?: string
  /** Adds a copy control. Off by default, because not all code is meant to run. */
  copyable?: boolean
  className?: string
}

export function CodeBlock({ code, label, copyable = false, className }: CodeBlockProps) {
  const name = label ?? 'code'
  return (
    <figure className={cn('m-0 overflow-hidden rounded-sm border border-border-hair', className)}>
      {label || copyable ? (
        <figcaption className="flex items-center justify-between gap-sm border-b border-border-hair bg-surface-2 px-sm py-2xs">
          <span className="text-xs text-text-3">{name}</span>
          {copyable ? <CopyButton value={code} what={name} iconOnly /> : null}
        </figcaption>
      ) : null}
      <pre
        role="region"
        aria-label={`${name}, scrollable code`}
        tabIndex={0}
        data-scroll-region
        className="m-0 overflow-x-auto bg-surface-0 p-md text-sm text-text-2"
      >
        <code>{code}</code>
      </pre>
    </figure>
  )
}

export function InlineCode({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <code
      className={cn(
        'rounded-xs border border-border-hair bg-surface-0 px-3xs py-3xs text-text-2',
        className,
      )}
    >
      {children}
    </code>
  )
}
