'use client'

/**
 * The composer in a real `<dialog>`, over the project it is about.
 *
 * Keyboard contract: `showModal()` owns the focus trap, the backdrop and the
 * `inert` background, so there is none of ours to go wrong. Escape closes and
 * the browser returns focus to the trigger; the close is intercepted only to
 * keep the two states in sync, never to block it. The exit animation comes from
 * `transition-behavior: allow-discrete` on `display` and `overlay`, so closing
 * needs no timer and leaves no ghost.
 *
 * The same form renders as a full page at /p/<slug>/feedback. The dialog is the
 * enhancement; the route is the thing that works.
 */

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import type { FormAction } from '@/components/ui'
import { ComposerForm } from './composer-form'
import type { ComposerData, OptimisticNote } from './types'

export interface ComposerDialogProps {
  data: ComposerData
  action: FormAction
  open: boolean
  onOpenChange: (open: boolean) => void
  onOptimistic?: (notes: readonly OptimisticNote[]) => void
}

export function ComposerDialog({ data, action, open, onOpenChange, onOptimistic }: ComposerDialogProps) {
  const ref = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      document.documentElement.style.overflow = 'hidden'
    } else if (!open && dialog.open) {
      dialog.close()
    }
    return () => {
      document.documentElement.style.overflow = ''
    }
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const onClose = (): void => {
      document.documentElement.style.overflow = ''
      onOpenChange(false)
    }
    dialog.addEventListener('close', onClose)
    return () => {
      dialog.removeEventListener('close', onClose)
    }
  }, [onOpenChange])

  return (
    <dialog
      ref={ref}
      className="ws-composer"
      aria-label={`Write feedback on ${data.project.title}`}
    >
      <div className="flex min-h-0 flex-col" style={{ maxBlockSize: 'inherit' }}>
        <div className="flex items-start justify-between gap-sm border-b border-border-hair p-lg pb-sm">
          <p className="text-sm text-text-2">Write feedback</p>
          <button
            type="button"
            onClick={() => {
              onOpenChange(false)
            }}
            className="grid size-11 shrink-0 place-items-center rounded-sm border border-transparent text-text-2"
          >
            <X size={20} strokeWidth={1.5} aria-hidden="true" />
            <span className="sr-only">Close the composer</span>
          </button>
        </div>
        <ComposerForm
          data={data}
          action={action}
          onOptimistic={onOptimistic}
          onCancel={() => {
            onOpenChange(false)
          }}
          cancelHref={`/p/${data.project.slug}`}
          className="min-h-0 flex-1"
        />
      </div>
    </dialog>
  )
}

export default ComposerDialog
