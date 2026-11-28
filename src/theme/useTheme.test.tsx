import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useApplyTheme, useTheme } from './useTheme';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl } from '../test/msw/handlers';
import { THEME_KEY } from './theme';
import type { User } from '../types';

function Probe() {
  useApplyTheme();
  const { preference, setPreference } = useTheme();
  return (
    <div>
      <span>pref:{preference}</span>
      <button onClick={() => setPreference('light')}>light</button>
      <button onClick={() => setPreference('dark')}>dark</button>
      <button onClick={() => setPreference('system')}>system</button>
    </div>
  );
}

const user = (theme?: User['theme']) =>
  ({
    id: 'u1',
    username: 'u1',
    email: 'a@b.c',
    name: 'A',
    firstName: 'A',
    lastName: '',
    roles: [],
    businessIds: [],
    theme,
  }) as User;

function withUser(u: User | null) {
  const state = signedIn();
  return { ...state, auth: { ...state.auth!, user: u } };
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('useTheme', () => {
  it("applies the account's saved theme and saves a new one to the account", async () => {
    const bodies: unknown[] = [];
    server.use(
      http.patch(apiUrl('/auth/preferences'), async ({ request }) => {
        bodies.push(await request.json());
        return HttpResponse.json({ success: true, data: { theme: 'dark' } });
      })
    );
    const { user: u, store } = renderWithProviders(<Probe />, {
      preloadedState: withUser(user('light')),
    });
    expect(screen.getByText('pref:light')).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));

    await u.click(screen.getByRole('button', { name: 'dark' }));
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(store.getState().auth.user?.theme).toBe('dark');
    await waitFor(() => expect(bodies).toEqual([{ theme: 'dark' }]));
  });

  it('without a user uses this browser only and follows the device on system', async () => {
    let onChange: (() => void) | undefined;
    let light = true;
    vi.spyOn(window, 'matchMedia').mockImplementation(
      () =>
        ({
          get matches() {
            return light;
          },
          addEventListener: (_: string, fn: () => void) => (onChange = fn),
          removeEventListener: () => undefined,
        }) as unknown as MediaQueryList
    );
    let patched = false;
    server.use(
      http.patch(apiUrl('/auth/preferences'), () => {
        patched = true;
        return HttpResponse.json({ success: true, data: { theme: 'system' } });
      })
    );
    const { user: u } = renderWithProviders(<Probe />, { preloadedState: withUser(null) });
    expect(screen.getByText('pref:system')).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('light'));

    light = false;
    onChange?.();
    expect(document.documentElement.dataset.theme).toBe('dark');

    await u.click(screen.getByRole('button', { name: 'light' }));
    expect(screen.getByText('pref:light')).toBeInTheDocument();
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    expect(patched).toBe(false);
  });
});
