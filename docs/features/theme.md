# Light / dark theme

- Preference: `system` (default, follows the device) | `light` | `dark`. Saved on the user's
  account (backend `docs/features/user-preferences.md`: `User.theme`, returned by `/auth/sync`,
  saved with `PATCH /auth/preferences`) so it follows the user to every device, and cached in
  localStorage `bpm-theme` for the first paint and signed-out pages.
- Picker: the account menu (avatar, top right) → Theme: "Same as device" / "Light" / "Dark"; the
  current one is marked (`unread` style + `aria-current`).
- Resolution: `src/theme/theme.ts` (`resolveTheme`; the device counts as dark unless it asks for
  light). `index.html` runs the same rule inline before React so there is no flash.
  `useApplyTheme` (mounted once in `App`) sets `<html data-theme="light|dark">` and, on `system`,
  follows device changes. `useTheme` reads the preference (account first, then browser) and
  saves changes (store + localStorage + `preferencesApi.updatePreferences`; a failed save keeps
  the local change).
- Tokens: `globals.css` `:root` is the dark set; `:root[data-theme='light']` overrides the colour
  tokens (surfaces, borders, text, a deeper accent `#00875a` for contrast on white, status,
  delivery/return, popover shadow) and `color-scheme`. Components only use tokens, so they need
  no per-theme CSS; charts re-read tokens on `data-theme` changes (`useChartTheme`).
- Adding a colour token: add it to both sets.
- Tests: `src/theme/theme.test.ts`, `src/theme/useTheme.test.tsx`, `Layout.test.tsx` (menu).
