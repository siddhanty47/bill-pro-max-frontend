import { useEffect, useState } from 'react';

export type ChartTheme = {
  /** Primary series (bars). */
  accent: string;
  /** Secondary series (line). */
  info: string;
  danger: string;
  /** Neutral series, e.g. stock in the yard beside stock at sites. */
  muted: string;
  grid: string;
  axis: string;
  text: string;
  surface: string;
};

/** Token name per theme slot. SVG paints accept `var(--x)`, so it doubles as the jsdom fallback. */
const TOKENS: Record<keyof ChartTheme, string> = {
  accent: '--accent',
  info: '--status-info-text',
  danger: '--status-danger-text',
  muted: '--border-medium',
  grid: '--border-default',
  axis: '--text-secondary',
  text: '--text-primary',
  surface: '--bg-card',
};

/** Read the current token values; falls back to `var(--token)` where they can't be resolved. */
export function readChartTheme(): ChartTheme {
  const css =
    typeof document !== 'undefined' ? getComputedStyle(document.documentElement) : undefined;
  const theme = {} as ChartTheme;
  (Object.keys(TOKENS) as (keyof ChartTheme)[]).forEach(slot => {
    const name = TOKENS[slot];
    theme[slot] = css?.getPropertyValue(name).trim() || `var(${name})`;
  });
  return theme;
}

/** The chart colours, re-read when the colour scheme or the `data-theme` attribute changes. */
export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(readChartTheme);

  useEffect(() => {
    const refresh = () => setTheme(readChartTheme());
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    media?.addEventListener?.('change', refresh);
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      media?.removeEventListener?.('change', refresh);
      observer.disconnect();
    };
  }, []);

  return theme;
}
