# Design system pointers

The design system is documented once, in the **`frontend-design`** skill
(`.claude/skills/frontend-design/SKILL.md`). Invoke it before building or restyling any component
or page. This page only says where things are; it does not restate the rules.

| What | Where |
|------|-------|
| Design language, tokens, page/form recipes, copy and mobile rules | `.claude/skills/frontend-design/SKILL.md` |
| Kit components and props | `src/components/ui/README.md` (import from `components/ui`) |
| Tokens | `:root` in `src/globals.css` |
| Token check (run by `npm run lint`) | `scripts/check-design-tokens.mjs --strict` |
| Detail page layout | `src/components/DetailPageShell.tsx` |
| Formatters | `src/utils/format.ts` (`formatMoney`, `formatDate`, …) |

Hard rules that fail lint or review: no inline `style={}`, no hardcoded colours/fonts/radii/shadows,
page CSS modules are layout only, never restyle the kit from a page.

Feature-specific copy (dialog titles, notices) is listed in each feature doc in this folder.
