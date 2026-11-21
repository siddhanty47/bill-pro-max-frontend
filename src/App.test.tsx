import { describe, expect, it, vi } from 'vitest';
import { waitFor } from '@testing-library/react';
import { supabase } from './lib/supabase';
import { screen } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import App from './App';
import { renderWithProviders, signedIn } from './test/render';

// Stand-in detail pages: show the id and hold per-instance local state.
vi.mock('./components/Layout', () => ({ Layout: () => <Outlet /> }));
vi.mock('./pages/ChallanDetailPage', async () => {
  const { stub } = await import('./test/detailStub');
  return { ChallanDetailPage: stub('challanId') };
});
vi.mock('./pages/InventoryDetailPage', async () => ({
  InventoryDetailPage: (await import('./test/detailStub')).stub('itemId'),
}));
vi.mock('./pages/PartyDetailPage', async () => ({
  PartyDetailPage: (await import('./test/detailStub')).stub('partyId'),
}));
vi.mock('./pages/AgreementDetailPage', async () => ({
  AgreementDetailPage: (await import('./test/detailStub')).stub('agreementId'),
}));
vi.mock('./pages/BillDetailPage', async () => ({
  BillDetailPage: (await import('./test/detailStub')).stub('billId'),
}));
vi.mock('./pages/PaymentDetailPage', async () => ({
  PaymentDetailPage: (await import('./test/detailStub')).stub('paymentId'),
}));
vi.mock('./pages/EmployeeDetailPage', async () => ({
  EmployeeDetailPage: (await import('./test/detailStub')).stub('employeeId'),
}));

describe('App detail routes', () => {
  it.each([
    ['/inventory/x1', 'x1'],
    ['/parties/x1', 'x1'],
    ['/agreements/x1', 'x1'],
    ['/challans/x1', 'x1'],
    ['/bills/x1', 'x1'],
    ['/payments/x1', 'x1'],
    ['/team/employees/x1', 'x1'],
  ])('%s remounts the page when the id changes', async (route, id) => {
    const { user } = renderWithProviders(<App />, { preloadedState: signedIn(), route });
    expect(await screen.findByTestId('id')).toHaveTextContent(id);
    await user.click(screen.getByRole('button', { name: 'mark' }));
    expect(screen.getByTestId('marked')).toHaveTextContent('yes');
    await user.click(screen.getByRole('button', { name: 'step' }));
    expect(screen.getByTestId('id')).toHaveTextContent('x2');
    expect(screen.getByTestId('marked')).toHaveTextContent('no');
  });
});

describe('App auth wiring', () => {
  const session = { access_token: 'tok' } as never;
  const syncOk = () =>
    vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(
        async () => new Response(JSON.stringify({ data: { user: { _id: 'u1', name: 'U' } } }))
      );

  it('hydrates an existing session and syncs the user', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValueOnce({
      data: { session },
      error: null,
    } as never);
    const fetchSpy = syncOk();
    const { store } = renderWithProviders(<App />, { route: '/login' });
    await waitFor(() => expect(store.getState().auth.token).toBe('tok'));
    await waitFor(() => expect(store.getState().auth.user).toMatchObject({ _id: 'u1' }));
    expect(fetchSpy).toHaveBeenCalled();
  });

  it('reacts to sign-in, token refresh and sign-out events', async () => {
    const fetchSpy = syncOk();
    const { store } = renderWithProviders(<App />, { route: '/login' });
    await waitFor(() => expect(supabase.auth.onAuthStateChange).toHaveBeenCalled());
    const listener = vi.mocked(supabase.auth.onAuthStateChange).mock.calls.at(-1)![0];
    listener('SIGNED_IN', session);
    await waitFor(() => expect(store.getState().auth.user).toMatchObject({ _id: 'u1' }));
    listener('TOKEN_REFRESHED', { access_token: 'tok2' } as never);
    await waitFor(() => expect(store.getState().auth.token).toBe('tok2'));
    listener('SIGNED_OUT', null);
    await waitFor(() => expect(store.getState().auth.token).toBeNull());
    expect(fetchSpy).toHaveBeenCalled();
  });
});
