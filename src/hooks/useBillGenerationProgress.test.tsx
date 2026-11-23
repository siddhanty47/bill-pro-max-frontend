import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Socket } from 'socket.io-client';
import { setupStore } from '../store';
import { WebSocketContext } from '../context/socketContext';
import { useBillGenerationProgress } from './useBillGenerationProgress';

type Handler = (data: unknown) => void;

function fakeSocket() {
  const handlers = new Map<string, Handler>();
  const socket = {
    on: (event: string, h: Handler) => handlers.set(event, h),
    off: (event: string) => handlers.delete(event),
  } as unknown as Socket;
  const emit = (event: string, data: unknown) => handlers.get(event)?.(data);
  return { socket, emit };
}

/** Tag lists passed to invalidateTags dispatches. */
function invalidated(dispatch: { mock: { calls: unknown[][] } }): unknown[] {
  return dispatch.mock.calls
    .map(([action]) => action as { type?: string; payload?: unknown })
    .filter(a => a?.type === 'api/invalidateTags')
    .map(a => a.payload);
}

afterEach(() => {
  vi.useRealTimers();
});

describe('useBillGenerationProgress', () => {
  function setup() {
    const store = setupStore();
    const dispatch = vi.spyOn(store, 'dispatch');
    const { socket, emit } = fakeSocket();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <Provider store={store}>
        <WebSocketContext.Provider value={{ socket, isConnected: true }}>
          {children}
        </WebSocketContext.Provider>
      </Provider>
    );
    const hook = renderHook(() => useBillGenerationProgress(), { wrapper });
    return { hook, emit, dispatch };
  }

  it('refreshes bills and the dashboard (throttled) as bills are generated', () => {
    vi.useFakeTimers();
    const { hook, emit, dispatch } = setup();
    act(() => hook.result.current.startBatch('b1', 2));

    act(() => {
      emit('bill:generated', { batchId: 'b1', billId: 'x', agreementId: 'a', billNumber: '1' });
      emit('bill:generated', { batchId: 'b1', billId: 'y', agreementId: 'b', billNumber: '2' });
    });
    expect(invalidated(dispatch)).toEqual([]);

    act(() => vi.advanceTimersByTime(2000));
    expect(invalidated(dispatch)).toEqual([['Bill', 'Dashboard']]);
  });

  it('refreshes bills and the dashboard when the batch completes', () => {
    const { hook, emit, dispatch } = setup();
    act(() => hook.result.current.startBatch('b1', 1));

    act(() => emit('bill:batch-complete', { batchId: 'b1', total: 1, completed: 1, failed: 0 }));

    expect(invalidated(dispatch)).toEqual([['Bill', 'Dashboard']]);
    expect(hook.result.current.hasActiveJobs).toBe(false);
  });

  it('records failures, ignores unknown batches and dismisses a batch', () => {
    const { hook, emit } = setup();
    act(() => hook.result.current.startBatch('b1', 2));

    act(() => {
      emit('bill:failed', { batchId: 'b1', agreementId: 'a', partyId: 'p', error: 'No rates' });
      emit('bill:failed', { batchId: 'nope', agreementId: 'a', partyId: 'p', error: 'x' });
      emit('bill:generated', { batchId: 'nope', billId: 'x', agreementId: 'a', billNumber: '1' });
    });

    expect(hook.result.current.batches).toEqual([
      expect.objectContaining({
        batchId: 'b1',
        failed: 1,
        results: [{ agreementId: 'a', error: 'No rates', status: 'failed' }],
      }),
    ]);
    expect(hook.result.current.hasActiveJobs).toBe(true);

    act(() => hook.result.current.dismissBatch('b1'));
    expect(hook.result.current.batches).toEqual([]);
  });

  it('stops listening and drops a pending refresh on unmount', () => {
    vi.useFakeTimers();
    const { hook, emit, dispatch } = setup();
    act(() => hook.result.current.startBatch('b1', 1));
    act(() =>
      emit('bill:generated', { batchId: 'b1', billId: 'x', agreementId: 'a', billNumber: '1' })
    );

    hook.unmount();
    vi.advanceTimersByTime(2000);
    emit('bill:batch-complete', { batchId: 'b1', total: 1, completed: 1, failed: 0 });

    expect(invalidated(dispatch)).toEqual([]);
  });
});
