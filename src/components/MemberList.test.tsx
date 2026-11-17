import { describe, expect, it, vi, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { MemberList } from './MemberList';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { BusinessMember } from '../types';
import type { RootState } from '../store';

const member = (over: Partial<BusinessMember>): BusinessMember => ({
  _id: 'm1',
  businessId: 'biz-1',
  userId: 'u-owner',
  email: 'owner@x.in',
  name: 'Asha Patel',
  role: 'owner',
  joinedAt: '2020-03-05T00:00:00.000Z',
  ...over,
});

const members = [
  member({}),
  member({ _id: 'm2', userId: 'u-me', email: 'me@x.in', name: 'Me Myself', role: 'manager' }),
  member({ _id: 'm3', userId: 'u-3', email: 'ravi@x.in', name: undefined, role: 'staff' }),
];

function renderList(rows = members, onInvite?: () => void) {
  const base = signedIn();
  const state = {
    auth: { ...base.auth, user: { id: 'u-me' } },
  } as unknown as Partial<RootState>;
  return renderWithProviders(<MemberList members={rows} businessId="biz-1" onInvite={onInvite} />, {
    preloadedState: state,
  });
}

afterEach(() => vi.restoreAllMocks());

describe('MemberList', () => {
  it('renders members with role chip and formatted join date', () => {
    renderList();
    const table = screen.getByRole('table');
    const rows = within(table).getAllByRole('row');
    expect(within(rows[1]).getByText('Asha Patel')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Owner')).toBeInTheDocument();
    // Roles are colour-distinct: owner success, manager info, staff neutral.
    expect(within(rows[1]).getByText('Owner')).toHaveClass('success');
    expect(within(rows[2]).getByText('Manager')).toHaveClass('info');
    expect(within(rows[3]).getByText('Staff')).toHaveClass('neutral');
    expect(within(rows[1]).getByText('5 Mar 2020')).toBeInTheDocument();
    expect(within(rows[3]).getByText('—')).toBeInTheDocument();
  });

  it('offers no actions for the owner or the current user', () => {
    renderList();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(within(rows[1]).queryByRole('button')).toBeNull();
    expect(within(rows[2]).queryByRole('button')).toBeNull();
    expect(within(rows[3]).getByRole('button', { name: 'More actions' })).toBeInTheDocument();
  });

  it('changes a role through the inline select', async () => {
    let body: unknown;
    server.use(
      http.patch(apiUrl('/businesses/biz-1/members/m3'), async ({ request }) => {
        body = await request.json();
        return ok(null);
      })
    );
    const { user } = renderList();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    await user.click(within(rows[3]).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Change role' }));
    const select = await within(
      within(screen.getByRole('table')).getAllByRole('row')[3]
    ).findByRole('combobox');
    expect(select).toHaveFocus();
    await user.selectOptions(select, 'accountant');
    await waitFor(() => expect(body).toEqual({ role: 'accountant' }));
  });

  it('cancels role editing with Escape and when the same role is picked', async () => {
    let patched = false;
    server.use(
      http.patch(apiUrl('/businesses/biz-1/members/m3'), () => {
        patched = true;
        return ok(null);
      })
    );
    const { user } = renderList();
    const row = () => within(screen.getByRole('table')).getAllByRole('row')[3];
    await user.click(within(row()).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Change role' }));
    await user.keyboard('{Escape}');
    expect(within(row()).queryByRole('combobox')).toBeNull();
    await user.click(within(row()).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Change role' }));
    await user.selectOptions(await within(row()).findByRole('combobox'), 'staff');
    expect(within(row()).queryByRole('combobox')).toBeNull();
    expect(patched).toBe(false);
  });

  it('removes a member after confirming', async () => {
    let removed = false;
    server.use(
      http.delete(apiUrl('/businesses/biz-1/members/m3'), () => {
        removed = true;
        return ok(null);
      })
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderList();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    await user.click(within(rows[3]).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    await waitFor(() => expect(removed).toBe(true));
  });

  it('does not remove when the confirm is declined', async () => {
    let removed = false;
    server.use(
      http.delete(apiUrl('/businesses/biz-1/members/m3'), () => {
        removed = true;
        return ok(null);
      })
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = renderList();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    await user.click(within(rows[3]).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    expect(confirm).toHaveBeenCalled();
    expect(removed).toBe(false);
  });

  it('shows the phone list with email, role and join date', () => {
    renderList();
    const item = within(screen.getByRole('list', { name: 'Members' })).getAllByRole('listitem')[2];
    expect(item).toHaveTextContent('ravi@x.in');
    expect(item).toHaveTextContent('Staff');
    expect(item).toHaveTextContent('5 Mar 2020');
  });

  it('shows an empty state whose action invites a member', async () => {
    const onInvite = vi.fn();
    const { user } = renderList([], onInvite);
    expect(screen.getByText('No members yet')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Invite member' }));
    expect(onInvite).toHaveBeenCalled();
  });
});
