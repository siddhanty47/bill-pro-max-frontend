import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  isThemePreference,
  prefersDark,
  readStoredPreference,
  resolveTheme,
  storePreference,
  THEME_KEY,
} from './theme';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('theme', () => {
  it('resolves a preference against the device', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });

  it('treats the device as dark unless it asks for light', () => {
    const mm = (matches: boolean) =>
      vi.fn().mockReturnValue({ matches }) as unknown as typeof window.matchMedia;
    vi.spyOn(window, 'matchMedia').mockImplementation(mm(true));
    expect(prefersDark()).toBe(false);
    vi.spyOn(window, 'matchMedia').mockImplementation(mm(false));
    expect(prefersDark()).toBe(true);
  });

  it('stores and reads the preference, ignoring junk and blocked storage', () => {
    expect(readStoredPreference()).toBe('system');
    storePreference('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(readStoredPreference()).toBe('light');
    localStorage.setItem(THEME_KEY, 'blue');
    expect(readStoredPreference()).toBe('system');

    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredPreference()).toBe('system');
    expect(() => storePreference('dark')).not.toThrow();
  });

  it('sets data-theme on <html> and checks values', () => {
    applyTheme('light');
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('blue')).toBe(false);
  });
});
