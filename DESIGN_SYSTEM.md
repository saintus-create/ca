# Design System — California Legislative Information

Single source of truth for visual language, tokens, and component conventions.

## Principles

1. **Token-first.** Every colour, radius, duration and focus treatment comes from
   a token. A raw hex value or an arbitrary `duration-[160ms]` in a component is
   a defect, not a preference.
2. **Semantic over primitive.** `bg-card`, `text-muted-foreground`, `border-border`,
   `bg-brand`. Never `#1f1f1f`, never `neutral-700`.
3. **One component, one implementation.** If `components/ui` or `@assistant-ui`
   already does the job, use it. Do not hand-build a parallel version.
4. **Accessibility by default.** WCAG 2.2 AA contrast, a visible focus indicator,
   full keyboard reach, and reduced motion honoured from one rule.
5. **Light and dark are one design.** Every semantic token has both values, so a
   component never carries a `dark:` colour override of its own.

## Token hierarchy

### 1. Primitive values

Defined once in `app/globals.css`:

- Colour ramps (neutral HSL, brand `#22364a` / `#33506b`, citation `#8a6d1a` / `#d3ab55`)
- `--radius: 0.5rem`
- Font families: Neue Haas Grotesk Display Pro (self-hosted in `public/fonts`),
  Public Sans Variable, Source Serif 4, system mono
- Line-height scale for the type system
- Motion: `--duration-fast` 140ms, `--duration-base` 200ms, `--duration-slow` 320ms,
  `--ease-standard`, `--ease-in-out`

### 2. Semantic tokens

Mapped to Tailwind utilities via `@theme { --color-* }`, with a matching `.dark` block:

| Token | Purpose |
|-------|---------|
| `background` / `foreground` | Page canvas and primary text |
| `card` / `popover` | Elevated surfaces: composer, dialogs, menus |
| `primary` / `secondary` / `muted` / `accent` | Interactive and supporting surfaces |
| `muted-foreground` | Secondary text, icons, placeholders |
| `destructive` | Error and danger |
| `border` / `input` / `ring` | Borders, form controls, focus ring |
| `sidebar` / `sidebar-foreground` / `sidebar-accent` / `sidebar-border` / `sidebar-ring` | The threads drawer. Required by `components/ui/sidebar.tsx`; without them the drawer renders transparent |
| `brand` / `brand-foreground` | Charcoal-blue brand accent, primary action |
| `citation` | Warm gold for statutory citations, links, list markers |

### 3. Component tokens

Only where a value is genuinely local. Prefer composing semantic tokens.

## Typography

- **UI and body:** Neue Haas Grotesk Display Pro (`font-sans`), falling back to
  Public Sans, then the system stack.
- **Quoted statute text:** Source Serif 4 (`font-serif`).
- **Code:** system mono (`font-mono`).

Type scale lives in `@theme` (`--text-xs--line-height` and friends). Use the scale
utilities rather than `text-[15px]`-style one-offs for new work.

## Spacing and geometry

Tailwind spacing scale. Prefer `gap-*`, `p-*`, `m-*`. Elevated surfaces use
`border border-border/70 bg-card`.

## Focus and motion

- Focus: one global rule, `:focus-visible { outline: 2px solid var(--color-ring); outline-offset: 2px }`.
  Components may instead show a ring (`focus-visible:ring-2 focus-visible:ring-ring`),
  which is what `components/ui/button.tsx` does. What they must not do is set
  `outline-none` with nothing in its place.
- Motion: use the duration and easing tokens. Meaningful animation is suppressed
  under `prefers-reduced-motion: reduce` by a single global rule.

## Component conventions

- **Chat surface:** `components/assistant-ui/gemini.tsx`, built on assistant-ui's
  primitives (`ThreadPrimitive`, `ComposerPrimitive`, `MessagePrimitive`,
  `AriaBarPrimitive`, `AuiIf`). It is a theme, not a reimplementation: styling
  changes belong in its class names, behaviour changes belong in the runtime
  bridge (`research-runtime.tsx`), and neither should grow a parallel component.
- **Library components:** `components/ui/*` (shadcn, Radix). Use `Button`,
  `Input`, `Label`, `Dialog`, `DropdownMenu`, `Select` rather than raw elements.
- **Vendored extras:** `components/velora/*` is a third-party animated-component
  set, currently unused. It is kept as inventory, not as an example to copy:
  those files carry their own palettes and would need tokenising before use.

## Extending the system

1. Add the value in `app/globals.css` under `@theme`, plus a `.dark` value if it
   is a colour.
2. Prefer a semantic name (`surface-raised`) over a primitive one (`grey-200`).
3. Consume it through the generated utility.
4. Document it in the table above.

## Verification checklist

- [x] No hardcoded hex in application or library components (audited; `components/velora` excepted, see above)
- [x] Sidebar tokens defined for light and dark
- [x] Motion, focus and reduced-motion governed by tokens and one global rule each
- [x] `main` landmark and an `h1` on every route
- [x] Keyboard focus visible on the composer input and on buttons
- [x] Light and dark verified in a browser at 390×844 and 1440×900
- [x] Production build, typecheck and the end-to-end suite pass
- [ ] Full contrast audit against WCAG 2.2 AA for every token pair (measured, not assumed)
- [ ] Screen-reader pass on a real device

---

Last updated as part of the site-wide standardisation pass.
