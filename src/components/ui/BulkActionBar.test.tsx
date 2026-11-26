import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkActionBar } from './BulkActionBar';
import { Button } from './Button';

describe('BulkActionBar', () => {
  it('renders nothing when nothing is selected', () => {
    const { container } = render(
      <BulkActionBar count={0} noun="bills" onClear={() => {}}>
        <Button>Delete</Button>
      </BulkActionBar>
    );
    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).not.toBeInTheDocument();
  });

  it('shows the count, the actions and Clear in a named region', () => {
    render(
      <BulkActionBar count={3} noun="bills" onClear={() => {}} className="place">
        <Button>Mark 3 as sent</Button>
      </BulkActionBar>
    );
    const region = screen.getByRole('region', { name: 'Bulk actions' });
    expect(region).toHaveClass('bar', 'place');
    expect(within(region).getByText(/selected/)).toHaveTextContent('3 bills selected');
    expect(within(region).getByText('3')).toHaveClass('number');
    expect(within(region).getByRole('button', { name: 'Mark 3 as sent' })).toBeInTheDocument();
    expect(within(region).getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('calls onClear from Clear', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<BulkActionBar count={1} noun="bill" onClear={onClear} />);
    expect(screen.getByText(/selected/)).toHaveTextContent('1 bill selected');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});

describe('BulkActionBar phone spacer', () => {
  const original = globalThis.ResizeObserver;
  afterEach(() => {
    globalThis.ResizeObserver = original;
    vi.restoreAllMocks();
  });

  const spacerOf = (container: HTMLElement) => container.querySelector('.spacer') as HTMLElement;

  it('sets the spacer height to the bar height it measures, and stops on unmount', () => {
    let callback: ResizeObserverCallback = () => {};
    const observe = vi.fn();
    const disconnect = vi.fn();
    globalThis.ResizeObserver = class {
      constructor(cb: ResizeObserverCallback) {
        callback = cb;
      }
      observe = observe;
      unobserve = vi.fn();
      disconnect = disconnect;
    } as unknown as typeof ResizeObserver;
    let height = 132;
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      () => ({ height }) as DOMRect
    );

    const { container, unmount } = render(
      <BulkActionBar count={2} noun="bills" onClear={() => {}} />
    );
    const bar = screen.getByRole('region', { name: 'Bulk actions' });
    expect(observe).toHaveBeenCalledWith(bar);

    act(() => callback([], {} as ResizeObserver));
    expect(spacerOf(container).style.getPropertyValue('--bulk-bar-height')).toBe('132px');

    height = 188;
    act(() => callback([], {} as ResizeObserver));
    expect(spacerOf(container).style.getPropertyValue('--bulk-bar-height')).toBe('188px');

    height = 0;
    act(() => callback([], {} as ResizeObserver));
    expect(spacerOf(container).style.getPropertyValue('--bulk-bar-height')).toBe('');

    unmount();
    expect(disconnect).toHaveBeenCalled();
  });

  it('keeps the CSS fallback height when ResizeObserver is missing', () => {
    // @ts-expect-error simulate an old browser
    delete globalThis.ResizeObserver;
    const { container } = render(<BulkActionBar count={1} noun="bill" onClear={() => {}} />);
    expect(spacerOf(container)).toBeInTheDocument();
    expect(spacerOf(container).style.getPropertyValue('--bulk-bar-height')).toBe('');
  });
});
