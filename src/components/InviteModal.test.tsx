import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { InviteModal } from './InviteModal';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';

const URL = '/businesses/biz-1/invitations';

function setup() {
  server.use(http.get(apiUrl('/businesses'), () => ok([])));
  const onClose = vi.fn();
  const utils = renderWithProviders(<InviteModal businessId="biz-1" onClose={onClose} />, {
    preloadedState: signedIn(),
  });
  return { ...utils, onClose };
}

function captureInvite(respond = () => ok({ _id: 'inv1' })) {
  const bodies: unknown[] = [];
  server.use(
    http.post(apiUrl(URL), async ({ request }) => {
      bodies.push(await request.json());
      return respond();
    })
  );
  return bodies;
}

describe('InviteModal', () => {
  it('sends the exact payload with the default viewer role and closes', async () => {
    const bodies = captureInvite();
    const { user, onClose } = setup();
    await user.type(screen.getByLabelText(/email address/i), 'new@acme.in');
    await user.click(screen.getByRole('button', { name: /send invitation/i }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(bodies).toEqual([{ email: 'new@acme.in', role: 'viewer' }]);
  });

  it('sends the chosen role', async () => {
    const bodies = captureInvite();
    const { user } = setup();
    await user.type(screen.getByLabelText(/email address/i), 'm@acme.in');
    await user.selectOptions(screen.getByLabelText(/^role/i), 'manager');
    await user.click(screen.getByRole('button', { name: /send invitation/i }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toEqual({ email: 'm@acme.in', role: 'manager' });
  });

  it('does not submit without an email', async () => {
    const bodies = captureInvite();
    const { user, onClose } = setup();
    await user.click(screen.getByRole('button', { name: /send invitation/i }));
    expect(bodies).toEqual([]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows the API error and stays open', async () => {
    captureInvite(() =>
      HttpResponse.json({ error: { message: 'Already a member' } }, { status: 409 })
    );
    const { user, onClose } = setup();
    await user.type(screen.getByLabelText(/email address/i), 'dup@acme.in');
    await user.click(screen.getByRole('button', { name: /send invitation/i }));
    expect(await screen.findByText('Already a member')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cancels', async () => {
    const { user, onClose } = setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalled();
  });
});
