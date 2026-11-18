import { describe, expect, it, vi, afterEach } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { InvitationList } from './InvitationList';
import { renderWithProviders } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Invitation } from '../types';

const inv = (over: Partial<Invitation>): Invitation =>
  ({
    _id: 'i1',
    businessId: 'biz-1',
    email: 'a@x.in',
    role: 'staff',
    status: 'pending',
    createdAt: '2020-06-07T00:00:00.000Z',
    ...over,
  }) as Invitation;

const rows = [
  inv({}),
  inv({ _id: 'i2', email: 'b@x.in', status: 'expired' }),
  inv({ _id: 'i3', email: 'c@x.in', status: 'accepted' }),
];

const bodyRows = () => within(screen.getByRole('table')).getAllByRole('row').slice(1);

afterEach(() => vi.restoreAllMocks());

describe('InvitationList', () => {
  it('renders email, role, status chip and sent date', () => {
    renderWithProviders(<InvitationList invitations={rows} businessId="biz-1" />);
    const first = bodyRows()[0];
    expect(within(first).getByText('a@x.in')).toBeInTheDocument();
    expect(within(first).getByText('Staff')).toBeInTheDocument();
    expect(within(first).getByText('Pending')).toBeInTheDocument();
    expect(within(first).getByText('7 Jun 2020')).toBeInTheDocument();
  });

  it('gives accepted invitations no actions', () => {
    renderWithProviders(<InvitationList invitations={rows} businessId="biz-1" />);
    expect(within(bodyRows()[2]).queryByRole('button')).toBeNull();
  });

  it('resends an expired invitation after confirming', async () => {
    let hit = false;
    server.use(
      http.post(apiUrl('/businesses/biz-1/invitations/i2/resend'), () => {
        hit = true;
        return ok(null);
      })
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderWithProviders(<InvitationList invitations={rows} businessId="biz-1" />);
    const row = bodyRows()[1];
    expect(within(row).queryByRole('button', { name: 'More actions' })).toBeNull();
    await user.click(within(row).getByRole('button', { name: 'Resend' }));
    await waitFor(() => expect(hit).toBe(true));
  });

  it('cancels a pending invitation from the menu', async () => {
    let hit = false;
    server.use(
      http.delete(apiUrl('/businesses/biz-1/invitations/i1'), () => {
        hit = true;
        return ok(null);
      })
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderWithProviders(<InvitationList invitations={rows} businessId="biz-1" />);
    await user.click(within(bodyRows()[0]).getByRole('button', { name: 'More actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Cancel invitation' }));
    await waitFor(() => expect(hit).toBe(true));
  });

  it('does nothing when the confirm is declined', async () => {
    let hit = false;
    server.use(
      http.post(apiUrl('/businesses/biz-1/invitations/i1/resend'), () => {
        hit = true;
        return ok(null);
      })
    );
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user } = renderWithProviders(<InvitationList invitations={rows} businessId="biz-1" />);
    await user.click(within(bodyRows()[0]).getByRole('button', { name: 'Resend' }));
    expect(confirm).toHaveBeenCalled();
    expect(hit).toBe(false);
  });

  it('shows the phone list with email, role and sent date', () => {
    renderWithProviders(<InvitationList invitations={rows} businessId="biz-1" />);
    const item = within(screen.getByRole('list', { name: 'Invitations' })).getAllByRole(
      'listitem'
    )[0];
    expect(item).toHaveTextContent('a@x.in');
    expect(item).toHaveTextContent('Staff');
    expect(item).toHaveTextContent('7 Jun 2020');
  });

  it('shows an empty state', () => {
    renderWithProviders(<InvitationList invitations={[]} businessId="biz-1" />);
    expect(screen.getByText('No invitations sent')).toBeInTheDocument();
  });
});
