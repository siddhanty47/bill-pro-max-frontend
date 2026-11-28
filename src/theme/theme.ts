/**
 * @file Colour theme
 * @description The user's theme preference (`system` | `light` | `dark`, saved on their account
 * and cached in localStorage for the first paint) resolves to `light` or `dark`, which is set as
 * `data-theme` on <html>. `globals.css` holds one token set per resolved theme. `index.html` runs
 * the same resolution before React loads, so the page never flashes the wrong theme.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

/** localStorage key; keep in step with the inline script in index.html */
export const THEME_KEY = 'bpm-theme';

export const THEME_PREFERENCES: ThemePreference[] = ['system', 'light', 'dark'];

export const isThemePreference = (v: unknown): v is ThemePreference =>
  v === 'system' || v === 'light' || v === 'dark';

/** Dark unless the device asks for light (dark was the only theme before, so it stays the fallback). */
export function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia
    ? !window.matchMedia('(prefers-color-scheme: light)').matches
    : true;
}

export function resolveTheme(pref: ThemePreference, deviceDark = prefersDark()): ResolvedTheme {
  if (pref === 'system') return deviceDark ? 'dark' : 'light';
  return pref;
}

export function applyTheme(theme: ResolvedTheme): void {
  document.documentElement.dataset.theme = theme;
}

export function readStoredPreference(): ThemePreference {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return isThemePreference(v) ? v : 'system';
  } catch {
    return 'system';
  }
}

export function storePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Private mode or blocked storage: the account still holds the choice.
  }
}
