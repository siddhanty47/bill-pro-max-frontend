import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { RootState } from '../store';
import type { Business, User } from '../types';
import { Layout } from './Layout';

// The WebSocket client talks to a real server; keep it offline in tests.
vi.mock('socket.io-client', () => ({
  io: () => ({ on: vi.fn(), off: vi.fn(), disconnect: vi.fn() }),
}));

// AssistantPanel scrolls its message list; jsdom has no Element.scrollTo.
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};

function makeBusiness(id: string, name: string): Business {
  return {
    _id: id,
    name,
    ownerUserId: 'user-1',
    settings: {} as Business['settings'],
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function setup({
  businesses = [
    makeBusiness('biz-1', 'Sharma Scaffolding'),
    makeBusiness('biz-2', 'Gupta Rentals'),
  ],
  route = '/',
}: { businesses?: Business[]; route?: string } = {}) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok(businesses)),
    http.get(apiUrl('/businesses/:businessId/search/index'), () =>
      ok({ version: 'v1', capabilities: { entities: true, bills: true, challans: true }, rows: [] })
    )
  );
  const base = signedIn('biz-1');
  const user: User = {
    id: 'user-1',
    username: 'sid',
    email: 'sid@example.com',
    name: 'Sid Yadav',
    firstName: 'Sid',
    lastName: 'Yadav',
    roles: [],
    businessIds: ['biz-1'],
  };
  const preloadedState: Partial<RootState> = {
    ...base,
    auth: { ...(base.auth as RootState['auth']), user },
  };
  return renderWithProviders(
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<p>home</p>} />
        <Route path="bills" element={<p>bills</p>} />
      </Route>
    </Routes>,
    { preloadedState, route }
  );
}

describe('Layout', () => {
  it('groups navigation under Yard, Paperwork and Business', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    for (const label of ['Yard', 'Paperwork', 'Business']) {
      expect(within(nav).getByText(label)).toBeInTheDocument();
    }
    const names = within(nav)
      .getAllByRole('link')
      .map(link => link.textContent);
    expect(names).toEqual([
      'Dashboard',
      'Inventory',
      'Parties',
      'Agreements',
      'Challans',
      'Bills',
      'Payments',
      'Team',
    ]);
    expect(within(nav).getByRole('link', { name: 'Bills' })).toHaveAttribute('href', '/bills');
  });

  it('marks the current route active', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(within(nav).getByRole('link', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(within(nav).getByRole('link', { name: 'Bills' })).not.toHaveAttribute('aria-current');
  });

  it('opens the business menu with Settings and other businesses', async () => {
    const { user, store } = setup();
    await user.click(await screen.findByRole('button', { name: 'Sharma Scaffolding' }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByRole('menuitem', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/business'
    );
    expect(within(menu).getByText('Switch business')).toBeInTheDocument();

    await user.click(within(menu).getByRole('menuitem', { name: 'Gupta Rentals' }));
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(store.getState().auth.currentBusinessId).toBe('biz-2');
  });

  it('shows only Settings in the business menu with a single business', async () => {
    const { user } = setup({ businesses: [makeBusiness('biz-1', 'Sharma Scaffolding')] });
    await user.click(await screen.findByRole('button', { name: 'Sharma Scaffolding' }));

    const menu = screen.getByRole('menu');
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map(i => i.textContent)
    ).toEqual(['Settings']);
    expect(within(menu).queryByText('Switch business')).not.toBeInTheDocument();
  });

  it('toggles the assistant from the Ask button', async () => {
    const { user } = setup();
    const ask = screen.getByRole('button', { name: 'Ask' });
    expect(ask).toHaveAttribute('aria-pressed', 'false');
    await user.click(ask);
    expect(ask).toHaveAttribute('aria-pressed', 'true');
  });

  it('opens the profile menu and logs out', async () => {
    const { user, store } = setup();
    await user.click(screen.getByRole('button', { name: 'Account' }));

    const menu = screen.getByRole('menu');
    expect(within(menu).getByText('sid@example.com')).toBeInTheDocument();
    await user.click(within(menu).getByRole('menuitem', { name: 'Log out' }));

    await vi.waitFor(() => expect(store.getState().auth.isAuthenticated).toBe(false));
    expect(store.getState().auth.token).toBeNull();
  });

  it('toggles the mobile drawer with the menu button', async () => {
    const { user } = setup();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(nav.className).not.toMatch(/sidebarOpen/);

    await user.click(screen.getByRole('button', { name: 'Toggle navigation' }));
    expect(nav.className).toMatch(/sidebarOpen/);

    await user.click(within(nav).getByRole('link', { name: 'Bills' }));
    expect(await screen.findByText('bills')).toBeInTheDocument();
    expect(nav.className).not.toMatch(/sidebarOpen/);
  });
});
