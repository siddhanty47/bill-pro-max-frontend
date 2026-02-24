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

export function usePlatform() {
  return { isMac, modLabel } as const;
}
