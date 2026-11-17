import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { ShareLinkManager } from './ShareLinkManager';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { ShareLink } from '../types';

const LINKS = '/businesses/biz-1/parties/p1/share-links';

const link = (over: Partial<ShareLink> = {}): ShareLink => ({
  _id: 'l1',
  businessId: 'biz-1',
  partyId: 'p1',
  token: 'abcdef1234567890',
  status: 'active',
  createdBy: 'u1',
  accessCount: 4,
  createdAt: '2025-09-01T10:00:00.000Z',
  updatedAt: '2025-09-01T10:00:00.000Z',
  ...over,
});

const defaults = [
  link({ label: 'For Rajesh', siteCode: 'PLOT', lastAccessedAt: '2025-10-02T10:00:00.000Z' }),
  link({ _id: 'l2', token: 'zzzz9999yyyy', expiresAt: '2025-01-05T00:00:00.000Z' }),
  link({ _id: 'l3', label: 'Old link', status: 'revoked' }),
];

function useApi(items: ShareLink[] = defaults) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl(LINKS), () => ok(items))
  );
}

function renderManager() {
  return renderWithProviders(
    <ShareLinkManager
      partyId="p1"
      sites={[
        { code: 'PLOT', address: 'Plot 12' },
        { code: 'SECT', address: 'Sector 5' },
      ]}
    />,
    { preloadedState: signedIn() }
  );
}

const table = () => screen.getByRole('table', { name: 'Share links' });

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('ShareLinkManager', () => {
  it('lists links with scope, views, dates and status', async () => {
    useApi();
    renderManager();
    const rajesh = await within(
      await screen.findByRole('table', { name: 'Share links' })
    ).findByRole('row', { name: /For Rajesh/ });
    expect(within(rajesh).getByText('PLOT')).toHaveClass('mono');
    expect(within(rajesh).getByText('4')).toBeInTheDocument();
    expect(within(rajesh).getByText('1 Sep 2025')).toBeInTheDocument();
    expect(within(rajesh).getByText('2 Oct 2025')).toBeInTheDocument();
    expect(within(rajesh).getByText('Active')).toBeInTheDocument();

    const unnamed = within(table()).getByRole('row', { name: /Link zzzz9999…/ });
    expect(within(unnamed).getByText('All sites')).toBeInTheDocument();
    expect(within(unnamed).getByText('5 Jan 2025')).toBeInTheDocument();
    expect(within(unnamed).getByText('Expired')).toBeInTheDocument();

    const revoked = within(table()).getByRole('row', { name: /Old link/ });
    expect(within(revoked).getByText('Revoked')).toBeInTheDocument();
    expect(within(revoked).queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows an empty state', async () => {
    useApi([]);
    renderManager();
    expect(await screen.findAllByText('No share links yet')).not.toHaveLength(0);
  });

  it('creates a link with the exact payload and clears the form', async () => {
    useApi();
    const bodies: unknown[] = [];
    server.use(
      http.post(apiUrl(LINKS), async ({ request }) => {
        bodies.push(await request.json());
        return ok(link({ _id: 'new' }));
      })
    );
    const { user } = renderManager();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Site scope' }), 'SECT');
    await user.type(screen.getByRole('textbox', { name: 'Label' }), 'For Rajesh');
    const expires = screen.getByLabelText('Expires');
    await user.type(expires, '2026-12-31');
    await user.click(screen.getByRole('button', { name: 'Create link' }));
    await waitFor(() =>
      expect(bodies).toEqual([{ siteCode: 'SECT', label: 'For Rajesh', expiresAt: '2026-12-31' }])
    );
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Label' })).toHaveValue(''));
    expect(screen.getByRole('combobox', { name: 'Site scope' })).toHaveValue('');
    expect(expires).toHaveValue('');
  });

  it('creates an unscoped link with an empty payload', async () => {
    useApi();
    const bodies: unknown[] = [];
    server.use(
      http.post(apiUrl(LINKS), async ({ request }) => {
        bodies.push(await request.json());
        return ok(link({ _id: 'new' }));
      })
    );
    const { user } = renderManager();
    await user.click(screen.getByRole('button', { name: 'Create link' }));
    await waitFor(() => expect(bodies).toEqual([{}]));
  });

  it('alerts when creating fails', async () => {
    useApi();
    server.use(
      http.post(apiUrl(LINKS), () =>
        HttpResponse.json({ success: false, error: { message: 'Nope' } }, { status: 400 })
      )
    );
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderManager();
    await user.click(screen.getByRole('button', { name: 'Create link' }));
    await waitFor(() => expect(alert).toHaveBeenCalled());
  });

  it('copies the share URL and confirms for two seconds', async () => {
    useApi();
    const { user } = renderManager();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
    const row = await within(await screen.findByRole('table')).findByRole('row', {
      name: /For Rajesh/,
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await user.click(within(row).getByRole('button', { name: 'Copy link' }));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/share/abcdef1234567890`);
    expect(await within(row).findByRole('button', { name: 'Copied' })).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(within(row).getByRole('button', { name: 'Copy link' })).toBeInTheDocument();
  });

  it('revokes a link after confirming', async () => {
    useApi();
    const deleted: string[] = [];
    server.use(
      http.delete(apiUrl(`${LINKS}/:id`), ({ params }) => {
        deleted.push(params.id as string);
        return ok(null);
      })
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderManager();
    const row = await within(await screen.findByRole('table')).findByRole('row', {
      name: /For Rajesh/,
    });
    await user.click(within(row).getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Revoke' }));
    await waitFor(() => expect(deleted).toEqual(['l1']));
    expect(window.confirm).toHaveBeenCalledWith(
      'Revoke this share link? It will stop working immediately.'
    );
  });

  it('does not revoke when the confirm is dismissed, and alerts on failure', async () => {
    useApi();
    let calls = 0;
    server.use(
      http.delete(apiUrl(`${LINKS}/:id`), () => {
        calls += 1;
        return HttpResponse.json({ success: false, error: { message: 'x' } }, { status: 500 });
      })
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const { user } = renderManager();
    const row = await within(await screen.findByRole('table')).findByRole('row', {
      name: /For Rajesh/,
    });
    await user.click(within(row).getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Revoke' }));
    expect(calls).toBe(0);

    confirm.mockReturnValue(true);
    await user.click(within(row).getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Revoke' }));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(calls).toBe(1);
  });
});
