/**
 * Platform detection utility for OS-aware keyboard shortcut labels.
 *
 * `isMac` is true on macOS; `modLabel` returns the conventional
 * modifier symbol for the physical Control/Alt key on each platform.
 */

const macPattern = /Mac|iPod|iPhone|iPad/i;
const isMac = macPattern.test(navigator.platform);

/** "⌥" (Option symbol) on macOS, "Alt" on Windows/Linux */
const modLabel = isMac ? '⌥' : 'Alt';

/** Shortcut hint for an Alt/Option key: "⌥N" on macOS, "Alt+N" elsewhere. */
export function shortcutLabel(key: string): string {
  return isMac ? `${modLabel}${key}` : `${modLabel}+${key}`;
}

export function usePlatform() {
  return { isMac, modLabel } as const;
}
