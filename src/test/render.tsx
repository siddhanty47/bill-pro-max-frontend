/**
 * renderWithProviders — render with a fresh Redux store (real reducers +
 * RTK Query) and a MemoryRouter. Returns RTL's result plus `store` and a
 * pre-bound `user` (userEvent).
 *
 *   const { user, store } = renderWithProviders(<Thing />, { route: '/parties' });
 */
import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { setupStore, type AppStore, type RootState } from '../store';

interface ProviderOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  store?: AppStore;
  route?: string;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState,
    store = setupStore(preloadedState),
    route = '/',
    ...options
  }: ProviderOptions = {}
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <Provider store={store}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </Provider>
    );
  }
  return { store, user: userEvent.setup(), ...render(ui, { wrapper: Wrapper, ...options }) };
}

/** Auth slice state for a signed-in user in a business. */
export function signedIn(currentBusinessId = 'biz-1'): Partial<RootState> {
  return {
    auth: {
      user: null,
      token: 'test-token',
      isAuthenticated: true,
      isLoading: false,
      error: null,
      currentBusinessId,
    },
  } as Partial<RootState>;
}
