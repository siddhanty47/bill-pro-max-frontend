import { describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { readCss } from '../test/readCss';
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
        <Route path="business" element={<p>business settings</p>} />
      </Route>
    </Routes>,
    { preloadedState, route }
  );
}

describe('Layout', () => {
  it('uses the kit Brand with a collapsible wordmark', () => {
    setup();
    const word = screen.getByText('Bill Pro Max');
    expect(word).toHaveClass('collapsible');
    expect(word.parentElement).toHaveClass('brand', 'md');
  });

  it('fits the header at 320px (CSS present at <=360)', async () => {
    const css = await readCss('src/components/Layout.module.css');
    expect(css).toContain('@media (max-width: 360px)');
    const block = css.slice(css.indexOf('@media (max-width: 360px)'));
    expect(block).toMatch(/\.header\s*\{[^}]*padding:[^;]*var\(--space-2\)[^}]*gap:\s*0/);
    expect(block).toMatch(/\.headerActions\s*\{[^}]*gap:\s*2px/);
    expect(block).toMatch(/\.profileControl\s*\{[^}]*margin-left:\s*0/);
  });

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

  it('navigates to business settings from the business menu', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'Sharma Scaffolding' }));
    await user.click(screen.getByRole('menuitem', { name: 'Settings' }));
    expect(await screen.findByText('business settings')).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens and closes the assistant from the Ask button', async () => {
    const { user } = setup();
    const ask = screen.getByRole('button', { name: 'Ask' });
    expect(ask).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('complementary', { name: 'AI assistant' })).not.toBeInTheDocument();

    await user.click(ask);
    expect(ask).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('complementary', { name: 'AI assistant' })).toBeInTheDocument();

    await user.click(ask);
    expect(ask).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('complementary', { name: 'AI assistant' })).not.toBeInTheDocument();
  });

  it('closes the assistant from its own close button', async () => {
    const { user } = setup();
    const ask = screen.getByRole('button', { name: 'Ask' });
    await user.click(ask);
    await user.click(screen.getByRole('button', { name: 'Close assistant' }));
    expect(ask).toHaveAttribute('aria-pressed', 'false');
    expect(screen.queryByRole('complementary', { name: 'AI assistant' })).not.toBeInTheDocument();
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

  it('closes the mobile drawer when the overlay is clicked', async () => {
    const { user, container } = setup();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    expect(container.querySelector('.sidebarOverlay')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Toggle navigation' }));
    const overlay = container.querySelector('.sidebarOverlay');
    expect(overlay).not.toBeNull();

    await user.click(overlay!);
    expect(nav.className).not.toMatch(/sidebarOpen/);
    expect(container.querySelector('.sidebarOverlay')).toBeNull();
  });

  it('marks the active nav icon with the accent class', () => {
    setup();
    const nav = screen.getByRole('navigation', { name: 'Main' });
    const active = within(nav).getByRole('link', { name: 'Dashboard' });
    expect(active.querySelector('svg')).toHaveClass('navIconActive');
    expect(within(nav).getByRole('link', { name: 'Bills' }).querySelector('svg')).not.toHaveClass(
      'navIconActive'
    );
  });
});
