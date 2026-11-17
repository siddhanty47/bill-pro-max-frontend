import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(platform: string) {
  vi.resetModules();
  vi.spyOn(navigator, 'platform', 'get').mockReturnValue(platform);
  return import('./usePlatform');
}

describe('shortcutLabel', () => {
  afterEach(() => vi.resetModules());

  it('uses the Option symbol with no separator on macOS', async () => {
    const { shortcutLabel, usePlatform } = await load('MacIntel');
    expect(shortcutLabel('N')).toBe('⌥N');
    expect(usePlatform()).toEqual({ isMac: true, modLabel: '⌥' });
  });

  it('uses Alt+ elsewhere', async () => {
    const { shortcutLabel, usePlatform } = await load('Win32');
    expect(shortcutLabel('D')).toBe('Alt+D');
    expect(usePlatform()).toEqual({ isMac: false, modLabel: 'Alt' });
  });
});
