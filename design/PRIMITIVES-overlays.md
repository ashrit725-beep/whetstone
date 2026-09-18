# Whetstone primitives, group 2: overlays and feedback

API reference for the overlay, message and loading primitives in
`src/components/ui/`. Read this instead of the source. Every component states
its keyboard contract in a header comment in its own file.

Hand-built on the platform: native `<dialog>` + `showModal()`, `inert`,
portals, `useSyncExternalStore`. No headless-UI dependency anywhere.

```tsx
import { Dialog } from '@/components/ui/dialog'
import { Drawer } from '@/components/ui/drawer'
import { Popover } from '@/components/ui/popover'
import { DropdownMenu, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Tooltip } from '@/components/ui/tooltip'
import { Toaster, toast } from '@/components/ui/toast'
import { Banner } from '@/components/ui/banner'
import { EmptyState } from '@/components/ui/empty-state'
import { ErrorState } from '@/components/ui/error-state'
import { Skeleton, FeedRowSkeleton } from '@/components/ui/skeleton'
import { Spinner, useDelayedLoading } from '@/components/ui/spinner'
import { Progress } from '@/components/ui/progress'
import { Meter } from '@/components/ui/meter'
```

Each module has a named export and a default export.

House rules these components already satisfy, so callers do not repeat them:

- **Radius.** Modals, sheets, popovers and menu panels are `rounded-lg` (14px);
  banners, empty and error states, toasts and cards are `rounded-md` (8px); menu
  items and chips are `rounded-xs`; tooltips are `rounded-sm`. Nothing is a pill.
- **Shadow.** `shadow-overlay` appears on modals, sheets, popovers, menus and
  toasts, and nowhere else. In-flow messages (Banner, EmptyState, ErrorState)
  get no shadow at all: the surface step plus the 1px border carries them.
- **Focus.** The global 2px straw outline at 2px offset, never transitioned,
  never removed. Every overlay returns focus to whatever opened it.
- **Motion.** Modals and sheets 240ms in / 160ms out; popovers, menus, tooltips
  and toasts 180ms in / 120ms out; hover and press 120ms. Only `opacity` and
  `transform` animate. Every keyframe sits inside
  `@media (prefers-reduced-motion: no-preference)` and has an explicit `reduce`
  path.
- **Actions.** Banner, EmptyState, ErrorState and Toast render their buttons
  through `Button` from group 1, so the message surfaces cannot drift away from
  the rest of the product.
- **Copy.** Titles are sentence case. Errors name what broke, why it matters and
  what to do. No exclamation marks, no em dashes, no straight quotes.

---

## Dialog · `dialog.tsx`

```ts
type DialogSize = 'sm' | 'md' | 'lg' | 'full'   // 24rem / 32rem / 48rem / viewport

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string                       // required; it is the accessible name
  description?: string                // wired to aria-describedby
  size?: DialogSize                   // default 'md'
  dismissible?: boolean               // default true; false for destructive confirms
  initialFocus?: RefObject<HTMLElement | null>
  footer?: ReactNode                  // affirmative action last
  loading?: boolean                   // aria-busy, and nothing can dismiss it
  error?: { title: string; body?: string } | null
  children?: ReactNode
  className?: string
}
```

Native `<dialog>` + `showModal()`, portalled to `document.body`. Escape fires
`onOpenChange(false)` only when dismissible; the browser’s instant close is
always intercepted so the exit animation runs. Backdrop click closes a
dismissible dialog. Document scroll is locked with no layout shift
(`scrollbar-gutter: stable` is already global). The background is inert: the top
layer does it when `showModal()` exists, and a focus-trap plus an `inert` sweep
of `document.body`’s children does it when it does not. Focus returns to the
invoker on close.

`error` renders a danger `Banner` above the footer and the dialog stays open:
failure never closes a dialog, because the reader would lose what they typed.

```tsx
<Dialog
  open={open}
  onOpenChange={setOpen}
  title="Delete this project"
  description="Feedback on it is deleted too, and cannot be recovered."
  size="sm"
  dismissible={false}
  loading={pending}
  error={error}
  footer={
    <>
      <Button onClick={() => setOpen(false)}>Keep the project</Button>
      <Button variant="danger" loading={pending} onClick={destroy}>Delete the project</Button>
    </>
  }
/>
```

**Also exported** (shared plumbing; Drawer is built on it): `useModalDialog`,
`useOverlayPortal`, `getFocusable`, `prefersReducedMotion`, `OverlayStyles`,
`OVERLAY_CSS`, types `DialogSize`, `DialogErrorSpec`, `OverlayPhase`.

---

## Drawer · `drawer.tsx`

```ts
type DrawerSide = 'left' | 'right' | 'bottom'
type DrawerSize = 'sm' | 'md' | 'lg'            // 20rem / 24rem / 32rem, side drawers only

interface DrawerProps extends /* the Dialog contract */ {
  side?: DrawerSide                   // default 'right'
  size?: DrawerSize                   // default 'md'
}
```

Same open, close, focus, inert and scroll behaviour as Dialog. `left` is the
Discover filter rail below 60rem; `bottom` is the phone sheet.

A bottom sheet is swipe-dismissible from its grab handle (released past 28% of
its height) **and** always shows a close button, because a drag must never be
the only way out (SC 2.5.7). The handle is `aria-hidden` and not a tab stop.
Mid-drag the sheet follows the pointer exactly, with animation and transition
both off.

---

## Popover · `popover.tsx`

```ts
type Placement = 'bottom-start' | 'bottom-end' | 'bottom' | 'top-start' | 'top-end' | 'top'

interface PopoverProps {
  trigger: ReactElement               // must render a real <button>
  children: ReactNode | ((api: { close: () => void }) => ReactNode)
  placement?: Placement               // default 'bottom-start'
  offset?: number                     // px gap, default 8
  matchTriggerWidth?: boolean         // default false
  open?: boolean                      // controlled; omit for internal state
  onOpenChange?: (open: boolean) => void
  label: string                       // accessible name for the panel
  className?: string
}
```

Non-modal `role="dialog"`, `aria-modal="false"`. The page behind stays live.
`aria-expanded`, `aria-haspopup` and `aria-controls` are cloned onto the
trigger. Escape closes and returns focus; an outside pointerdown closes; focus
leaving the panel closes. Focus is never trapped. The panel flips above the
trigger when the space below is short and clamps 8px from the viewport edge.

**Also exported:** `useAnchoredPosition` (fixed anchoring with flip and clamp),
`useExitPhase(open, exitMs)` (keeps a panel mounted for its exit), and
`AnchoredStyles` / the `.whetstone-anchored` class, which DropdownMenu and
Tooltip reuse.

---

## DropdownMenu · `dropdown-menu.tsx`

```ts
<DropdownMenu trigger={<Button …/>} label="Project actions" placement? offset? open? onOpenChange? />

<DropdownMenuItem
  onSelect?={() => void | Promise<void>}
  icon?={LucideIcon} destructive?={boolean}
  disabled?={boolean} disabledReason?={string}
  shortcut?={string} closeOnSelect?={boolean}   // default true
/>
<DropdownMenuCheckboxItem checked onCheckedChange disabled? disabledReason? />
<DropdownMenuRadioGroup value onValueChange label>
  <DropdownMenuRadioItem value disabled? disabledReason? />
</DropdownMenuRadioGroup>
<DropdownMenuSub label icon? disabled? disabledReason?>…</DropdownMenuSub>
<DropdownMenuSeparator />
<DropdownMenuLabel>…</DropdownMenuLabel>
```

Real `role="menu"` with `menuitem`, `menuitemradio` and `menuitemcheckbox`.
ArrowUp/Down wrap, Home/End jump, printable characters do typeahead, Escape
closes the level and restores focus, ArrowRight/ArrowLeft open and close
submenus. Every key a menu handles stops propagating, because a submenu panel is
a React child of its parent menu and would otherwise move focus in both.

A **disabled item stays focusable and in sequence**, is announced as disabled
and shows `disabledReason` under its label. It is never skipped: skipping hides
the fact that the action exists.

An item whose `onSelect` returns a promise swaps its icon for a spinner and
holds the menu open until the work settles, then closes if `closeOnSelect`.

`destructive` styles the label with the critical hue. Pair it with a verb that
names the loss (“Delete the project”), never with a bare “Delete”.

**Recorded deviation (contract §5.5).** Menu items are 44px tall and stacked
with a 2px gap rather than the 8px demanded between adjacent targets. The 8px
rule is written for free-standing controls; 8px inside a menu reads as separate
groups, and 44px rows already clear SC 2.5.8 with margin.

---

## Tooltip · `tooltip.tsx`

```ts
interface TooltipProps {
  content: ReactNode                  // a few words
  children: ReactElement              // focusable, and never `disabled`
  placement?: Placement               // default 'top'
  offset?: number                     // default 8
  className?: string
}
```

Hover opens after 280ms; focus opens instantly (the two delays must differ).
The tooltip stays open while the pointer travels onto it and can be read
(SC 1.4.13). Escape dismisses it while the trigger keeps focus, and it stays
dismissed until the pointer or focus leaves and comes back. Touch pointers do
not open it: a tap should activate the control.

Three rules of use: never the only place the information lives, never on a
`disabled` native control (use `aria-disabled` plus a visible reason), never
interactive content (use Popover).

---

## Toast · `toast.tsx`

```ts
type ToastVariant = 'info' | 'success' | 'warning' | 'danger'

toast({
  title: string,
  description?: string,
  variant?: ToastVariant,             // default 'info'
  action?: { label: string; onClick: () => void },
  duration?: number | 'persist',      // default 6000
}): string                            // returns the id

dismissToast(id: string): void
dismissAllToasts(): void

<Toaster max?={3} />                  // mount once in the app shell
```

A module-level store read through `useSyncExternalStore`, so `toast()` works
from anywhere without a provider. Two live regions render from first paint:
`role="status"` for info, success and warning; `role="alert"` for danger.

A toast carrying an action never auto-dismisses, whatever `duration` says. The
timer pauses while a pointer is over the stack or focus is inside it. Escape
dismisses the toast holding focus. Beyond `max`, the rest collapse into a
“+2 more” button that expands the stack.

Use a toast only when the result is off-screen. A posted comment, a moved row
and a saved field say so themselves.

---

## Banner · `banner.tsx`

```ts
interface BannerProps {
  variant?: 'info' | 'success' | 'warning' | 'danger'   // default 'info'
  title: string
  children?: ReactNode                // body
  action?: MessageActionSpec
  dismissible?: boolean               // default false
  persistKey?: string                 // with dismissible: remembered in localStorage
  onDismiss?: () => void
  announce?: boolean                  // danger always announces
  className?: string
  id?: string
}

interface MessageActionSpec {
  label: string; onClick?: () => void; href?: string
  primary?: boolean; busy?: boolean
}
```

In-flow, never floating. `info` is the only surface that uses `surface-wash`,
and the only non-interactive use of the accent. `warning` is straw as icon,
border and label, never a fill. `danger` carries `role="alert"`.

**Also exported:** `MessageAction` (the shared action control, delegating to
`Button`) and `MIN_TAP`, the 44px minimum block size used by controls that
cannot be a `Button`, such as `role="menuitem"` rows.

---

## EmptyState · `empty-state.tsx`

```ts
interface EmptyStateProps {
  icon?: LucideIcon                   // overrides the variant icon
  title: string                       // what is empty, specifically
  body: string                        // why it matters and what changes it
  primaryAction?: MessageActionSpec   // the single next action
  secondaryAction?: MessageActionSpec
  variant?: 'default' | 'filtered' | 'success'    // default 'default'
  headingLevel?: 2 | 3 | 4            // default 2; keeps the outline sequential
  className?: string
}
```

Three beats and one button. `variant="success"` is what inbox zero uses, so an
absence does not read as a failure.

Copy is written for the situation, not for the component:

> “No projects match Game + Needs playtesting + 8000 grit. Drop the grit filter
> to see 14 games that need playtesting.” · button “Clear grit filter”

No illustration, no shrug, no “No data available”, no exclamation mark.

---

## ErrorState · `error-state.tsx`

```ts
interface ErrorStateProps {
  title: string                       // what broke
  body: string                        // why it matters here, and what to do next
  requestId?: string                  // selectable mono text, for a support message
  onRetry?: () => void
  retrying?: boolean                  // drives the delayed spinner on Retry
  backHref?: string
  backLabel?: string                  // default 'Back to Discover'
  headingLevel?: 1 | 2 | 3            // default 1
  className?: string
}
```

What every `error.tsx` renders. `role="alert"`, announced once. Focus is not
moved: the reader is already here, and stealing focus on an error is
disorienting.

---

## Skeleton · `skeleton.tsx`

```ts
<Skeleton w? h? radius?='xs' lines? className? />        // w/h are CSS lengths
<TextSkeleton lines?={3} label? />                       // 1.0625rem lines, 66ch
<FeedRowSkeleton count?={6} label? />                    // 4.5rem tall, 8px radius, 48px thumb
<CardSkeleton media?={false} lines?={2} label? />        // surface-3, hairline, 8px radius
<TableSkeleton columns rows?={6} label? />               // 0px cell radius, zebra, header band
```

Geometry matches the loaded component box for box, which is the whole point:
nothing moves when data lands. Every skeleton is `aria-hidden`; pass `label` to
a composite to get one polite status line, or set `aria-busy` on the region you
own.

**Recorded deviation (contract §6.1, the 400ms ceiling).** The pulse cycle is
1200ms. A cycle inside the ceiling would flash at 2.5&nbsp;Hz, which is the
range SC 2.3.1 exists to prevent. §6.4 exempts functional loading motion.
Under `prefers-reduced-motion: reduce` the animation is removed entirely and the
skeleton is a static tint.

---

## Spinner · `spinner.tsx`

```ts
<Spinner size?={16 | 20 | 24} label? className? />
useDelayedLoading(active: boolean, { delayMs?: 150, minVisibleMs?: 300 }): boolean
```

Decorative and `aria-hidden` by default; pass `label` when it is the only thing
on screen saying that work is in flight. Prefer a geometry-matched skeleton:
reach for a spinner only where the shape of the result is unknowable.

`useDelayedLoading` holds the indicator back 150ms so fast work never flashes
one, then keeps it up 300ms so it never strobes.

**Recorded deviation (contract §6.1).** One revolution is 640ms, and 1200ms
under reduced motion, where it keeps turning per §6.4. A sub-400ms revolution
reads as a flicker, not as progress.

---

## Progress · `progress.tsx`

```ts
interface ProgressProps {
  value: number
  max?: number                        // default 100
  label: string                       // visible; name the task, not the widget
  valueText?: string                  // spoken instead of the percentage
  hideValue?: boolean                 // default false
  tone?: 'accent' | 'positive' | 'critical'
  className?: string
  id?: string
}
```

`role="progressbar"`. A **determinate task** moving toward completion. The fill
animates `transform: scaleX`, never `width`. If the answer is unknowable, use a
labelled Spinner rather than a fake bar.

---

## Meter · `meter.tsx`

```ts
interface MeterProps {
  value?: number; min?: number; max?: number       // single-value form
  optimum?: number                  // picks the tone: ≥ optimum positive, low critical
  segments?: { label: string; value: number; tone? }[]   // stacked form
  label: string
  valueText?: string                // e.g. 'Balance: 3000 of 8000'
  tone?: 'accent' | 'positive' | 'critical' | 'straw' | 'neutral'
  className?: string
}
```

`role="meter"`. A **measurement** inside a known range: grit position, sentiment
split, storage used. Never a task that finishes, and never interchangeable with
Progress.

In the segmented form the bar is `aria-hidden` and every share is printed in a
visible `<dl>` legend with `tabular-nums`, so the dashboard rollup is fully
readable in greyscale. No hue carries meaning alone.
