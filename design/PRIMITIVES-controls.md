# Whetstone primitives, group 1: controls and forms

API reference for `src/components/ui/`. Read this instead of the source. Every
component here ships all eight states from CONTRACT §5.4, a 44px minimum hit
area, and a keyboard contract stated in a header comment in its file.

Import from the file path. Each module has a named export and a default export:

```tsx
import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import { Form, SubmitButton, idleFormState, type FormState } from '@/components/ui/form'
```

House rules these components already satisfy, so callers do not repeat them:

- Radius is hierarchical. Buttons, inputs, selects and textareas are `rounded-sm`;
  chips, tabs, segments and the switch thumb are `rounded-xs`; the error summary
  callout is `rounded-md`. Nothing here is a pill.
- No shadows. Depth is the surface step plus the 1px border.
- Hover rules live inside `@media (hover: hover)` because that is what Tailwind v4
  emits for the `hover:` variant. Entrances run 120ms with `ease-out`, exits 80ms
  with `ease-in`. Only buttons translate, by 1px.
- Focus is the global 2px straw outline at 2px offset, declared once in
  `globals.css`, never transitioned, never removed.
- The one looping animation in this group is the button's loading arc. It is
  wrapped in `motion-safe:` so reduced motion renders it static.

---

## Button · `button.tsx`

```ts
type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'straw'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonOwnProps {
  variant?: ButtonVariant          // default 'secondary'
  size?: ButtonSize                // default 'md'
  loading?: boolean                // default false
  loadingLabel?: string            // default 'Working…', announced, not drawn
  disabled?: boolean               // default false
  disabledReason?: string          // visible sentence under the button
  iconLeading?: ReactNode
  iconTrailing?: ReactNode
  fullWidth?: boolean              // default false
  as?: 'button' | 'a'              // default 'button'
}
// plus every native <button> attribute, or every <a> attribute when as="a"
type ButtonProps = ButtonAsButton | ButtonAsAnchor
```

`forwardRef<HTMLButtonElement | HTMLAnchorElement>`.

| Variant | Fill | Where it is legal |
|---|---|---|
| `primary` | accent fill, accent ink | one per viewport, the single next action |
| `secondary` | surface-2, border-control | the default |
| `ghost` | transparent, border appears on hover | toolbars, row actions |
| `danger` | critical fill, critical ink | destructive confirmations |
| `straw` | straw fill, straw ink | reviewer marketplace only (surface 7) |

| Size | Height | Padding | Hit area |
|---|---|---|---|
| `sm` | 36px | `px-sm` | `tap-44` expands it to 44 |
| `md` | 44px | `px-md` | native |
| `lg` | 52px | `px-lg` | native |

Behaviour:

- `loading` renders the label invisible but still laid out, so the width is locked
  and nothing reflows. It sets `aria-busy`, overlays the arc, announces
  `loadingLabel`, and blocks activation.
- `disabled` sets `aria-disabled` rather than the `disabled` attribute, so the
  control keeps its tab stop and the reason stays reachable. Activation is blocked
  in the handler. Pass `disabledReason` with it: opacity alone is a defect, and a
  disabled button with no stated reason fails the gate.
- Icons: pass a lucide glyph at `size={16}` for `sm` and `size={20}` for `md` and
  `lg`, `strokeWidth={1.5}`. The wrapper adds `aria-hidden`.
- Labels never wrap (`whitespace-nowrap`). Shorten the verb phrase instead.

```tsx
<Button variant="primary" iconLeading={<Check size={20} strokeWidth={1.5} />}>
  Post feedback
</Button>

<Button
  disabled
  disabledReason="Pick at least one category before you post."
>
  Post feedback
</Button>
```

---

## Link · `link.tsx`

```ts
interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string
  variant?: 'inline' | 'standalone' | 'quiet'   // default 'inline'
  external?: boolean          // default: true when href starts with http
  showExternalIcon?: boolean  // default true, standalone and quiet only
  children: ReactNode
}
```

`forwardRef<HTMLAnchorElement>`. Internal destinations render through `next/link`.

- `inline` sits in a sentence, accent, underlined at rest.
- `standalone` sits on its own line, `tap-44`, underlines on hover.
- `quiet` is `standalone` in `text-2`, for footers and metadata rows.

External links get `target="_blank"`, `rel="noopener noreferrer"`, an outbound
arrow on the non-inline variants, and a visually hidden "(opens in a new tab)".

---

## Field · `field.tsx`

The wrapper every labelled control uses. It owns the id and the describedby wiring.

```ts
interface FieldRenderArgs {
  id: string
  describedBy: string | undefined
  invalid: boolean
  required: boolean
  disabled: boolean
}

interface FieldProps {
  label: ReactNode
  hint?: ReactNode              // between label and control, never for errors
  error?: string | null         // present means invalid
  required?: boolean            // renders the word 'required'
  optional?: boolean            // renders the word 'optional'
  disabled?: boolean
  disabledReason?: string
  id?: string                   // pass one when a Server Action keys errors by it
  className?: string
  children: (args: FieldRenderArgs) => ReactNode
}
```

Layout is label, hint, control, helper slot. The helper slot keeps `min-height: 1lh`
at all times and is `aria-live="polite"`, so an error arriving after blur announces
itself and moves nothing. Error text replaces the reason text in that slot and
carries a `CircleAlert` glyph plus the sentence.

Also exported: `FieldHelper({ errorId, error, reasonId, reason, className })`, the
same reserved slot, used standalone by Checkbox, RadioGroup, Switch and
SegmentedControl, which own their own labels.

```tsx
<Field id="email" label="Email" hint="We use this for the sign-in link." error={errors.email}>
  {({ id, describedBy, invalid }) => (
    <Input id={id} name="email" type="email" autoComplete="username"
           aria-describedby={describedBy} invalid={invalid} />
  )}
</Field>
```

---

## Input · `input.tsx`

```ts
interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  invalid?: boolean
  success?: boolean        // positive border and a check glyph
  trailingSlot?: ReactNode // a show/hide toggle, replaces the status glyph
  wrapperClassName?: string
}
```

`forwardRef<HTMLInputElement>`. 44px tall, `text-base` so iOS does not zoom, 1px
border in every state with only the colour changing, and a permanently reserved
24px trailing slot so a validation glyph never shifts the text.

Also exported: `controlClasses({ invalid, disabled, readOnly, success })`, the
shared border and fill logic for Input, Textarea, Select and SearchInput.

---

## Textarea · `textarea.tsx`

```ts
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
  success?: boolean
  maxChars?: number        // turns on the counter; the field is not hard clipped
  announceWithin?: number  // default 20, remaining count at which the live region speaks
  prose?: boolean          // Literata at 66ch, for anything a human writes
  wrapperClassName?: string
}
```

`forwardRef<HTMLTextAreaElement>`. `min-height: 6rem`, `resize: vertical`.

The counter is drawn at all times with `tabular-nums` and is `aria-hidden`. A
separate polite region stays empty until `announceWithin` characters remain, so a
screen reader is not interrupted per keystroke. Going over the limit turns the
counter critical, sets `aria-invalid`, and draws the critical border. It does not
block typing or paste.

---

## Select · `select.tsx`

```ts
interface SelectOption { value: string; label: string; disabled?: boolean }

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  invalid?: boolean
  success?: boolean
  options?: readonly SelectOption[]
  placeholderOption?: string   // a disabled first entry, not a label
  wrapperClassName?: string
  children?: ReactNode         // use instead of options when you need optgroups
}
```

`forwardRef<HTMLSelectElement>`. A real `<select>` with a `ChevronDown` in the
reserved trailing slot. Geometry matches Input exactly, so a select beside a
button lines up at 44px. There is no div listbox in this product.

---

## Checkbox · `checkbox.tsx`

```ts
interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label: ReactNode
  description?: ReactNode
  indeterminate?: boolean      // resolves to checked on the next press
  error?: string | null
  disabledReason?: string
  wrapperClassName?: string
}
```

`forwardRef<HTMLInputElement>`. A real input with `accent-color`, 20px drawn,
44x44 through `tap-44`, inside a 44px label row that is entirely clickable. Stack
rows with at least `gap-xs` to keep 8px between neighbouring targets. Pass `id`
when you pass `error` or `disabledReason`, because the describedby wiring is
keyed off it.

---

## Radio and RadioGroup · `radio.tsx`

```ts
interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label: ReactNode
  description?: ReactNode
  wrapperClassName?: string
}

interface RadioOption {
  value: string
  label: ReactNode
  description?: ReactNode
  disabled?: boolean
}

interface RadioGroupProps {
  legend: ReactNode
  name: string
  options: readonly RadioOption[]
  value?: string               // controlled
  defaultValue?: string        // uncontrolled
  onValueChange?: (value: string) => void
  hint?: ReactNode
  error?: string | null
  required?: boolean
  disabled?: boolean
  disabledReason?: string
  className?: string
}
```

`RadioGroup` renders a `<fieldset>` with a visible `<legend>`. Arrow keys move and
select, which is native radio behaviour; no roving tabindex is hand built.

---

## Switch · `switch.tsx`

```ts
interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size' | 'onChange'> {
  label: ReactNode             // what it does, never 'on' or 'off'
  description?: ReactNode
  checked?: boolean            // controlled
  defaultChecked?: boolean     // uncontrolled, default false
  onCheckedChange?: (checked: boolean) => void
  error?: string | null
  disabledReason?: string
  wrapperClassName?: string
}
```

`forwardRef<HTMLInputElement>`. A visually hidden `input[type=checkbox]` carrying
`role="switch"` and `aria-checked`, with a 44x24 track and a 20px thumb drawn as
its siblings. Space toggles; the whole row is the label. The thumb moves by
`translateX` over 120ms.

A switch applies instantly, so it is never paired with a save button, and no
screen carries more than three of them.

---

## SegmentedControl · `segmented-control.tsx`

```ts
interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  iconLeading?: ReactNode      // lucide at size 16, strokeWidth 1.5
  disabled?: boolean
}

interface SegmentedControlProps<T extends string> {
  label: string                // rendered visibly above, and names the group
  options: readonly SegmentedOption<T>[]
  value: T
  onValueChange: (value: T) => void
  name?: string                // renders a hidden input so the value posts
  fullWidth?: boolean
  loading?: boolean            // geometry matched skeleton in place of the segments
  loadingLabel?: string        // default 'Loading the options.'
  disabled?: boolean
  disabledReason?: string
  error?: string | null
  className?: string
}
```

Generic in `T`, so `value` and `onValueChange` narrow to your union. Not a
forwardRef: a ref onto the group is not meaningful.

`role="radiogroup"` with `role="radio"` segments and a roving tabindex, so the
whole control is one tab stop. Arrows wrap and skip disabled segments; Home and
End jump to the ends. The indicator is one absolutely positioned box moved by
`transform: translateX` over 180ms, so nothing animates width.

Selection is carried three ways at once, never by hue: the indicator moves one
surface step, the label steps from `text-2` to `text-1`, and `aria-checked` is set.

---

## SearchInput · `search-input.tsx`

```ts
interface SearchInputProps {
  label: string                // visible, above the field
  hint?: ReactNode
  placeholder?: string
  value?: string               // controlled
  defaultValue?: string        // uncontrolled, default ''
  onValueChange?: (value: string) => void      // every keystroke
  onDebouncedChange?: (value: string) => void  // debounceMs after typing stops
  debounceMs?: number          // default 250
  name?: string
  id?: string
  error?: string | null
  disabled?: boolean
  disabledReason?: string
  loading?: boolean            // marks the field aria-busy
  resultsLabel?: string        // polite summary, for example '14 projects match.'
  clearLabel?: string          // default 'Clear the search'
  className?: string
}
```

Built on `Field`, so it gets the visible label and the reserved helper slot. A
leading `Search` glyph, `aria-hidden`, because a magnifier is not a label. The
clear button appears only when there is a value, is a real button with a 44px hit
area, and returns focus to the field. Escape clears and fires the debounced
callback immediately. The debounce timer is cleared on unmount.

---

## Form, ErrorSummary, SubmitButton, FormStatus · `form.tsx`

```ts
interface FormState {
  status: 'idle' | 'success' | 'error'
  message?: string
  fieldErrors?: Readonly<Record<string, string>>  // keys are Field ids
}
const idleFormState: FormState

type FormAction = (state: FormState, formData: FormData) => FormState | Promise<FormState>

interface FormProps extends Omit<FormHTMLAttributes<HTMLFormElement>, 'action' | 'children'> {
  action: FormAction
  initialState?: FormState      // default idleFormState
  summaryTitle?: string         // default 'This form was not posted.'
  showSummary?: boolean         // default true
  children: (args: { state: FormState; pending: boolean }) => ReactNode
}

interface ErrorSummaryProps { state: FormState; pending: boolean; title?: string; className?: string }

type SubmitButtonProps = Omit<ButtonAsButton, 'as' | 'type' | 'loading'> & {
  pendingLabel?: string         // default 'Posting…'
}

interface FormStatusProps { state: FormState; className?: string }
```

`Form` wires `useActionState`, so the form posts to a Server Action and works with
JavaScript disabled. While a submit is in flight the form is `aria-busy` and a
second submit is dropped, which makes double posting impossible from keyboard or
pointer.

`ErrorSummary` renders only on failure. It is `role="alert"` with `tabIndex={-1}`
and focuses itself once per failed submit. Each entry is a fragment link to the
offending field id, and activating one focuses that field and scrolls it clear of
the sticky nav. Key `fieldErrors` by the same `id` you pass to each `Field`.

`SubmitButton` reads `useFormStatus`, so it must render inside the `<form>`. It is
never disabled at idle: a disabled submit button is not a validation strategy.

`FormStatus` is a polite region with a reserved `1lh`. Render it only when the
result of the action happens off screen; success is silent when the effect is
visible.

```tsx
<Form action={postFeedback}>
  {({ state }) => (
    <>
      <Field id="ask" label="What do you want reviewed?" error={state.fieldErrors?.ask}>
        {({ id, describedBy, invalid }) => (
          <Textarea id={id} name="ask" prose maxChars={600}
                    aria-describedby={describedBy} invalid={invalid} />
        )}
      </Field>
      <SubmitButton variant="primary" pendingLabel="Posting the feedback…">
        Post feedback
      </SubmitButton>
    </>
  )}
</Form>
```

---

## Recorded deviations

1. **Icons are lucide, not Phosphor.** CONTRACT §5.6 names Phosphor Regular;
   `package.json` ships `lucide-react` and no Phosphor package, and installing one
   is out of scope for this group. Every glyph here is lucide at 16 or 20,
   `strokeWidth={1.5}`, `currentColor`, `aria-hidden` when decorative. The banned
   glyph list is unchanged and unused.
2. **One looping animation.** The button's loading arc spins, under
   `motion-safe:`. This is the genuine-loading-indicator carve-out in gate line
   9.5/38; §6.3's "zero infinite animations" otherwise holds across this group.
3. **`aria-disabled` instead of `disabled` on Button.** A `disabled` attribute
   removes the control from the focus order, which hides the reason text the
   contract requires. Form fields still take the real `disabled` attribute, so
   they are correctly excluded from submission.
