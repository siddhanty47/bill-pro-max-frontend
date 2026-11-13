# Frontend Design System (BillProMax frontend)

Apply whenever you add or edit a component, page, or stylesheet in `bill-pro-max-frontend`. The app has ONE deliberate visual language — a **dark terminal / developer-console aesthetic**. New UI must match it exactly, or it looks bolted-on (green-on-black, monospace, hairline borders, near-square corners, no shadows).

## The aesthetic in one breath

Black background, monospace everywhere (JetBrains Mono), a single green accent (`#00cc88`), 2px (effectively square) corners, **no** shadows, **no** blur, hairline translucent-white borders, light-grey body text, white headings, UPPERCASE small-caps labels. Buttons and interactive chrome are **ghost** style: transparent fill, colored text + border, subtle fill on hover.

## Non-negotiable rules

1. **Never hardcode colors / fonts / radii.** Always use the CSS variables from `src/globals.css` `:root`. A literal `#fff`, `#4f46e5`, `white`, `blue`, `8px` radius, or `box-shadow` is a bug — it will not match the theme. (This is how the assistant panel first shipped wrong: it used `--color-primary`/`#fff` fallbacks that don't exist here.)
2. **No inline `style={}`.** CSS Modules (`Component.module.css`) or global classes only. (Also enforced in root + frontend CLAUDE.md.)
3. **Monospace is the whole brand.** Don't introduce sans/serif. Font is inherited from `--font-body`; only set `font-family: var(--font-body)` when an element resets it (buttons/inputs).
4. **Square + flat.** `border-radius: var(--radius-md)` (2px). `--shadow-*` are `none`; don't add shadows or `backdrop-filter`.
5. **Prefer existing global classes** over re-styling from scratch — `.btn`/`.btn-primary`/`.btn-secondary`/`.btn-danger`/`.btn-sm`, `.form-group`, `.data-table`, `.status` (+ state variants), `.card`, `.stat-card`, `.page-header`, `.filters`, `.error-message`. Only write module CSS for layout/structure unique to your component.
6. **Reuse tokens for state**, never raw status colors: warning = `--status-warning-*`, danger = `--status-danger-*`, success = `--status-success-*`, info = `--status-info-*`.

## Token cheat-sheet (from `globals.css`)

**Surfaces (darkest → lightest):** `--bg-deepest #000` (header/sidebar/input-rows) · `--bg-surface #0a0a0a` (page content) · `--bg-elevated #111` · `--bg-card #161616` · `--bg-input #0d0d0d` · `--bg-hover #1a1a1a`.

**Borders (hairline, translucent white):** `--border-subtle` · `--border-default` · `--border-medium`. Use `1px solid var(--border-default)` for dividers/cards.

**Text:** `--text-primary #d4d4d4` (body) · `--text-heading #fff` (titles, emphasis) · `--text-secondary #737373` (labels, muted) · `--text-muted #525252` (placeholder, disabled).

**Accent (the only brand color):** `--accent #00cc88` · `--accent-hover #00e699` · `--accent-muted` (12% fill — use for active/hover backgrounds). Use accent for links, active nav, focus borders, primary actions, selected state.

**Typography:** `--font-body` (JetBrains Mono stack). Labels: UPPERCASE, `letter-spacing: 0.5px`, `font-size: 12px`, `color: var(--text-secondary)`.

**Shape/motion:** `--radius-md: 2px` · shadows `none` · `--transition-fast: .15s` / `--transition-default: .2s`.

## Pattern recipes

**Ghost button** (the house style):
```css
background: transparent;
border: 1px solid var(--accent);      /* or --border-medium for secondary */
border-radius: var(--radius-md);
color: var(--accent);                  /* or --text-primary */
font-family: var(--font-body);
transition: background var(--transition-fast);
/* hover */ background: var(--accent-muted);
```
Or just use the global `.btn .btn-primary` / `.btn-secondary` / `.btn-danger`.

**Form field** (bottom-border-only, transparent): label UPPERCASE `--text-secondary`; input `border: none; border-bottom: 1px solid var(--border-medium); background: transparent; color: var(--text-primary)`; focus → `border-bottom-color: var(--accent)`. Prefer the global `.form-group`.

**Status badge** — rendered as bracketed caps, e.g. `[OVERDUE]`; use global `.status` + `.status-overdue` / `.status-paid` / `.status-pending` etc. Don't invent badge colors.

**Card / surface panel:** `background: var(--bg-elevated|card); border: 1px solid var(--border-default); border-radius: var(--radius-md);` no shadow. Prefer global `.card`.

**Input focus / selection:** focus ring is `--accent`; never a blue browser default (`outline: none` + accent border).

## Checklist for any new component

- [ ] Module CSS file (`X.module.css`), zero inline styles.
- [ ] Every color/font/radius is a `var(--…)` token — grep your CSS for `#`, `rgb(`, `px` radius, `shadow`; justify each.
- [ ] Reused a global class (`.btn`, `.form-group`, `.data-table`, `.status`, `.card`) where one fits.
- [ ] Body text `--text-primary`, headings `--text-heading`, labels UPPERCASE `--text-secondary` — all legible on black (no low-contrast grey-on-grey).
- [ ] Accent used only for interactive/active/primary; state colors via `--status-*`.
- [ ] 2px radius, no shadow, monospace, hairline borders.
- [ ] Looks native beside `DataTable`, `Layout` sidebar, and a form — compare side by side.

## Notes

- Global stylesheet: `src/globals.css` (tokens in `:root`, reusable classes below). Read it before styling anything new.
- When a design token is missing for a genuinely new need, add it to `:root` rather than hardcoding at the call site.
