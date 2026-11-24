import { afterEach, describe, expect, it } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { readChartTheme, useChartTheme } from './chartTheme';

describe('chartTheme', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty('--accent');
    document.documentElement.removeAttribute('data-theme');
  });

  it('falls back to var() strings when tokens are empty (jsdom)', () => {
    const theme = readChartTheme();
    expect(theme.accent).toBe('var(--accent)');
    expect(theme.info).toBe('var(--status-info-text)');
    expect(theme.grid).toBe('var(--border-default)');
    expect(theme.muted).toBe('var(--border-medium)');
  });

  it('reads the token value when it resolves', () => {
    document.documentElement.style.setProperty('--accent', 'teal');
    expect(readChartTheme().accent).toBe('teal');
  });

  it('re-reads when data-theme changes', async () => {
    const { result } = renderHook(() => useChartTheme());
    expect(result.current.accent).toBe('var(--accent)');
    act(() => {
      document.documentElement.style.setProperty('--accent', 'teal');
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await waitFor(() => expect(result.current.accent).toBe('teal'));
  });
});
