import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { InvitationAcceptPage } from './InvitationAcceptPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';

function Where() {
  const { pathname, search } = useLocation();
  return <div data-testid="where">{pathname + search}</div>;
}

const where = () => screen.getByTestId('where').textContent;

const invitation = { businessName: 'Acme Scaffolds', role: 'manager' };

function renderPage(preloadedState?: Parameters<typeof renderWithProviders>[1]) {
  return renderWithProviders(
    <Routes>
      <Route path="/invitations/:token" element={<InvitationAcceptPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { route: '/invitations/tok-1', ...preloadedState }
  );
}

function verifyOk() {
  server.use(http.get(apiUrl('/invitations/verify/tok-1'), () => ok(invitation)));
}

describe('InvitationAcceptPage', () => {
  it('shows a loading state while verifying', () => {
    server.use(
      http.get(apiUrl('/invitations/verify/tok-1'), async () => {
        await new Promise(() => {});
        return ok(invitation);
      })
    );
    renderPage();
    expect(screen.getByRole('heading', { name: 'Loading invitation…' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    expect(screen.queryByText('Checking invitation…')).not.toBeInTheDocument();
  });

  it('shows an error state for an unknown invitation and links to sign in', async () => {
    server.use(
      http.get(apiUrl('/invitations/verify/tok-1'), () =>
        HttpResponse.json({ success: false, error: 'Not found' }, { status: 404 })
      )
    );
    const { user } = renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Invalid or expired invitation' })
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go to sign in' }));
    expect(where()).toBe('/login');
  });

  it('prompts signed-out visitors to sign in or register with the token', async () => {
    verifyOk();
    const { user } = renderPage();
    expect(await screen.findByText('Acme Scaffolds')).toBeInTheDocument();
    expect(screen.getByText('manager')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create account to accept' }));
    expect(where()).toBe('/register?invitation=tok-1');
  });

  it('sends signed-out visitors to sign in', async () => {
    verifyOk();
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Sign in to accept' }));
    expect(where()).toBe('/login?invitation=tok-1');
  });

  it('accepts the invitation, confirms and redirects home', async () => {
    verifyOk();
    const accept = vi.fn();
    server.use(
      http.post(apiUrl('/invitations/tok-1/accept'), () => {
        accept();
        return ok(null);
      })
    );
    const { user } = renderPage({ preloadedState: signedIn() });
    await user.click(await screen.findByRole('button', { name: 'Accept invitation' }));
    expect(await screen.findByRole('heading', { name: 'Done. Redirecting…' })).toBeInTheDocument();
    expect(accept).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(where()).toBe('/'), { timeout: 3000 });
  });

  it('declines the invitation', async () => {
    verifyOk();
    const decline = vi.fn();
    server.use(
      http.post(apiUrl('/invitations/tok-1/decline'), () => {
        decline();
        return ok(null);
      })
    );
    const { user } = renderPage({ preloadedState: signedIn() });
    await user.click(await screen.findByRole('button', { name: 'Decline' }));
    expect(await screen.findByRole('heading', { name: 'Done. Redirecting…' })).toBeInTheDocument();
    expect(decline).toHaveBeenCalledTimes(1);
  });

  it('stays on the invitation when accepting fails', async () => {
    verifyOk();
    server.use(
      http.post(apiUrl('/invitations/tok-1/accept'), () =>
        HttpResponse.json(
          { success: false, error: { message: 'Invitation has expired' } },
          { status: 400 }
        )
      )
    );
    const { user } = renderPage({ preloadedState: signedIn() });
    await user.click(await screen.findByRole('button', { name: 'Accept invitation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invitation has expired');
    expect(screen.getByRole('button', { name: 'Accept invitation' })).toBeEnabled();
    expect(screen.queryByRole('heading', { name: 'Done. Redirecting…' })).not.toBeInTheDocument();
  });

  it('shows the error and stays when declining fails, then clears it on retry', async () => {
    verifyOk();
    let fail = true;
    server.use(
      http.post(apiUrl('/invitations/tok-1/decline'), () =>
        fail
          ? HttpResponse.json(
              { success: false, error: { message: 'Could not decline' } },
              { status: 500 }
            )
          : ok(null)
      )
    );
    const { user } = renderPage({ preloadedState: signedIn() });
    await user.click(await screen.findByRole('button', { name: 'Decline' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not decline');
    expect(screen.getByRole('heading', { name: "You're invited" })).toBeInTheDocument();

    fail = false;
    await user.click(screen.getByRole('button', { name: 'Decline' }));
    expect(await screen.findByRole('heading', { name: 'Done. Redirecting…' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
