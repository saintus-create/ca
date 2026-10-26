# Design System — California Legislative Information

Single source of truth for visual language, tokens, and component conventions.

## Principles

1. **Token-first** — Prefer design tokens over arbitrary values. Hard-coded colors, spacing, or radii are technical debt.
2. **Semantic over primitive** — Prefer `text-citation`, `bg-muted`, `border-border` over raw hex or scale numbers.
3. **Preserve identity** — Public Sans + Source Serif 4, charcoal-blue brand, warm gold citation accent, and the neutral monochrome base are intentional.
4. **Accessibility by default** — WCAG 2.2 AA contrast, visible focus, keyboard support, `prefers-reduced-motion`.

## Token Hierarchy

### 1. Primitive (raw values)

Defined in `app/globals.css` (`@theme`, `:root`, `.dark`).

- Color ramps (neutral HSL, brand `#22364a` / `#33506b`, citation `#8a6d1a` / `#d3ab55`)
- `--radius: 0.5rem`
- Font families (`--font-sans`, `--font-serif`, `--font-mono`)
- Line-height scale for the type system

### 2. Semantic tokens

Mapped to Tailwind utilities via `@theme { --color-* }`:

| Token | Purpose |
|-------|---------|
| `background` / `foreground` | Page canvas and primary text |
| `card` / `popover` | Elevated surfaces |
| `primary` / `secondary` / `muted` / `accent` | Interactive and supporting surfaces |
| `destructive` | Error / danger |
| `border` / `input` / `ring` | Borders, form controls, focus rings |
| `brand` | Charcoal-blue brand accent |
| `citation` | Warm gold for statutory citations, secondary links, list markers, thinking states |

### 3. Component tokens

Prefer composition of semantic tokens. Only introduce component-level tokens when a value is truly local.

## Typography

- **UI / body**: Public Sans Variable (`font-sans`)
- **Quoted statute text**: Source Serif 4 (`font-serif`)
- **Code**: system mono (`font-mono`)

## Spacing & Geometry

- Use Tailwind spacing scale. Prefer `gap-*`, `p-*`, `m-*`.
- Elevated cards and panels: `border border-border/80 bg-card shadow-xs`.

## Color Usage Rules

- Primary actions / brand → `brand` or `primary`
- Citations, statutory links, list markers, thinking indicators → `citation`
- Secondary text → `muted-foreground`
- Borders / dividers → `border` (with opacity modifiers `/60`, `/80` as needed)

### Intentional exceptions

- `components/speak-button.tsx` active state uses a California-inspired blue (`#002868` / `#eaf0fa`).
- Decorative cursor fill in `animated-cursor.tsx`.
- Some gradient skeleton animations and Velora/shadcn decorative variants retain local hex for intentional visual effects.

## Extending the System

1. Add the value in `app/globals.css` (`@theme` + light/dark overrides).
2. Prefer a semantic name.
3. Consume via the generated utility.
4. Document the token here.

## Verification Checklist

- [x] Citation and elevated-surface hardcodes migrated to tokens in primary UI surfaces
- [x] Light and dark themes defined for citation
- [x] Scrollbars driven by tokens
- [ ] Full keyboard / contrast / reduced-motion pass (requires browser)
- [ ] Production build + lint + unit tests (run in CI or local after install)

---

Last updated as part of the design-system formalization and verification pass.
