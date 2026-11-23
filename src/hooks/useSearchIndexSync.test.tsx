import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { setupStore } from '../store';
import { signedIn } from '../test/render';
import { WebSocketContext } from '../context/socketContext';
import { useSearchIndexSync } from './useSearchIndexSync';

type Handler = (data: unknown) => void;

describe('useSearchIndexSync', () => {
  function setup() {
    // Not authenticated: keeps useCurrentBusiness from fetching the business list.
    const state = signedIn('biz-1');
    const store = setupStore({ ...state, auth: { ...state.auth!, isAuthenticated: false } });
    const dispatch = vi.spyOn(store, 'dispatch');
    const handlers = new Map<string, Handler>();
    const socket = {
      on: (event: string, h: Handler) => handlers.set(event, h),
      off: (event: string) => handlers.delete(event),
    } as unknown as Socket;
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>
        <WebSocketContext.Provider value={{ socket, isConnected: true }}>
          {children}
        </WebSocketContext.Provider>
      </Provider>
    );
    const hook = renderHook(() => useSearchIndexSync(), { wrapper });
    const invalidated = () =>
      dispatch.mock.calls
        .map(([action]) => action as { type?: string; payload?: unknown })
        .filter(a => a?.type === 'api/invalidateTags')
        .map(a => a.payload);
    return { hook, handlers, invalidated };
  }

  it("refreshes the search index and the dashboard on the current business's change", () => {
    const { handlers, invalidated } = setup();

    act(() => handlers.get('search:index-changed')?.({ businessId: 'biz-1' }));

    expect(invalidated()).toEqual([['SearchIndex', 'Dashboard']]);
  });

  it('ignores changes in another business and unsubscribes on unmount', () => {
    const { hook, handlers, invalidated } = setup();

    act(() => handlers.get('search:index-changed')?.({ businessId: 'other' }));
    expect(invalidated()).toEqual([]);

    hook.unmount();
    expect(handlers.has('search:index-changed')).toBe(false);
  });
});
