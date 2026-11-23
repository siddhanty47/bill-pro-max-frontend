import { useCallback, useState } from 'react';
import type { RangeKey } from '../types';

const key = (chartId: string) => `dash.range.${chartId}`;

/** The chart's selected range, remembered per chart in localStorage (storage failures are ignored). */
export function useRangePreset(
  chartId: string,
  presets: RangeKey[],
  fallback: RangeKey
): [RangeKey, (range: RangeKey) => void] {
  const [range, setRange] = useState<RangeKey>(() => {
    try {
      const stored = localStorage.getItem(key(chartId)) as RangeKey | null;
      return stored && presets.includes(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  });

  const update = useCallback(
    (next: RangeKey) => {
      setRange(next);
      try {
        localStorage.setItem(key(chartId), next);
      } catch {
        /* storage unavailable: the choice just won't be remembered */
      }
    },
    [chartId]
  );

  return [range, update];
}
