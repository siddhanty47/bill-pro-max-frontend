import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { readCss } from '../../test/readCss';
import { ScrollArea } from './ScrollArea';

/** jsdom has no layout: give the scroll region the sizes a browser would. */
function setSize(
  el: HTMLElement,
  { scrollWidth, clientWidth, scrollLeft = 0 }: Record<string, number>
) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
  el.scrollLeft = scrollLeft;
}

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

/** A controllable IntersectionObserver: `fire()` reports the target as visible. */
function stubIntersection() {
  const observers: Array<{ cb: IntersectionObserverCallback; disconnect: () => void }> = [];
  class FakeIO {
    cb: IntersectionObserverCallback;
    disconnect = vi.fn();
    constructor(cb: IntersectionObserverCallback) {
      this.cb = cb;
      observers.push(this);
    }
    observe() {}
    unobserve() {}
    takeRecords() {
      return [];
    }
  }
  vi.stubGlobal('IntersectionObserver', FakeIO);
  return {
    fire: () =>
      act(() => {
        observers.forEach(o =>
          o.cb(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            o as unknown as IntersectionObserver
          )
        );
      }),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const renderArea = () =>
  render(
    <ScrollArea label="Stock chart">
      <div>bars</div>
    </ScrollArea>
  );

describe('ScrollArea', () => {
  it('is a focusable, named region', () => {
    renderArea();
    const region = screen.getByRole('region', { name: 'Stock chart' });
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveTextContent('bars');
  });

  it('reports the scroll position', () => {
    const onScroll = vi.fn();
    render(
      <ScrollArea label="Chart" onScroll={onScroll}>
        <div />
      </ScrollArea>
    );
    const region = screen.getByRole('region');
    setSize(region, { scrollWidth: 1000, clientWidth: 300, scrollLeft: 120 });
    fireEvent.scroll(region);
    expect(onScroll).toHaveBeenCalledWith(120);
  });

  it('shows no buttons when everything fits', () => {
    renderArea();
    const region = screen.getByRole('region');
    setSize(region, { scrollWidth: 300, clientWidth: 300 });
    fireEvent.scroll(region);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows the right button only while content is hidden on the right', () => {
    renderArea();
    const region = screen.getByRole('region');
    setSize(region, { scrollWidth: 1000, clientWidth: 300 });
    fireEvent.scroll(region);
    expect(screen.getByRole('button', { name: 'Scroll right' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scroll left' })).not.toBeInTheDocument();

    setSize(region, { scrollWidth: 1000, clientWidth: 300, scrollLeft: 300 });
    fireEvent.scroll(region);
    expect(screen.getByRole('button', { name: 'Scroll left' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Scroll right' })).toBeInTheDocument();

    setSize(region, { scrollWidth: 1000, clientWidth: 300, scrollLeft: 700 });
    fireEvent.scroll(region);
    expect(screen.getByRole('button', { name: 'Scroll left' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Scroll right' })).not.toBeInTheDocument();
  });

  it('scrolls by most of the visible width, smoothly', () => {
    setReducedMotion(false);
    renderArea();
    const region = screen.getByRole('region');
    const scrollBy = vi.fn();
    region.scrollBy = scrollBy as unknown as typeof region.scrollBy;
    setSize(region, { scrollWidth: 1000, clientWidth: 300, scrollLeft: 300 });
    fireEvent.scroll(region);
    fireEvent.click(screen.getByRole('button', { name: 'Scroll right' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 240, behavior: 'smooth' });
    fireEvent.click(screen.getByRole('button', { name: 'Scroll left' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: -240, behavior: 'smooth' });
  });

  it('jumps instead of gliding under reduced motion', () => {
    setReducedMotion(true);
    renderArea();
    const region = screen.getByRole('region');
    const scrollBy = vi.fn();
    region.scrollBy = scrollBy as unknown as typeof region.scrollBy;
    setSize(region, { scrollWidth: 1000, clientWidth: 300 });
    fireEvent.scroll(region);
    fireEvent.click(screen.getByRole('button', { name: 'Scroll right' }));
    expect(scrollBy).toHaveBeenLastCalledWith({ left: 240, behavior: 'auto' });
  });

  it('falls back to scrollLeft where scrollBy is missing', () => {
    renderArea();
    const region = screen.getByRole('region');
    Object.defineProperty(region, 'scrollBy', { configurable: true, value: undefined });
    setSize(region, { scrollWidth: 1000, clientWidth: 300 });
    fireEvent.scroll(region);
    fireEvent.click(screen.getByRole('button', { name: 'Scroll right' }));
    expect(region.scrollLeft).toBe(240);
  });

  it('nudges once when it first comes into view and overflows', () => {
    setReducedMotion(false);
    const io = stubIntersection();
    renderArea();
    const region = screen.getByRole('region');
    setSize(region, { scrollWidth: 1000, clientWidth: 300 });
    const inner = screen.getByText('bars').parentElement as HTMLElement;
    expect(inner).not.toHaveClass('nudge');
    io.fire();
    expect(inner).toHaveClass('nudge');
    // jsdom has no AnimationEvent, so React listens for the prefixed name
    fireEvent(inner, new Event('webkitAnimationEnd', { bubbles: true }));
    expect(inner).not.toHaveClass('nudge');
    io.fire();
    expect(inner).not.toHaveClass('nudge');
  });

  it('does not nudge under reduced motion', () => {
    setReducedMotion(true);
    const io = stubIntersection();
    renderArea();
    const region = screen.getByRole('region');
    setSize(region, { scrollWidth: 1000, clientWidth: 300 });
    io.fire();
    expect(screen.getByText('bars').parentElement).not.toHaveClass('nudge');
  });

  it('does not nudge when everything fits', () => {
    setReducedMotion(false);
    const io = stubIntersection();
    renderArea();
    setSize(screen.getByRole('region'), { scrollWidth: 300, clientWidth: 300 });
    io.fire();
    expect(screen.getByText('bars').parentElement).not.toHaveClass('nudge');
  });

  it('re-measures when its size changes', () => {
    const callbacks: ResizeObserverCallback[] = [];
    class FakeRO {
      constructor(cb: ResizeObserverCallback) {
        callbacks.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', FakeRO);
    renderArea();
    setSize(screen.getByRole('region'), { scrollWidth: 1000, clientWidth: 300 });
    act(() => callbacks.forEach(cb => cb([], {} as ResizeObserver)));
    expect(screen.getByRole('button', { name: 'Scroll right' })).toBeInTheDocument();
  });

  it('fades the hidden edges and keeps the nudge out of reduced motion (CSS)', async () => {
    const css = await readCss('src/components/ui/ScrollArea.module.css');
    expect(css).toMatch(/linear-gradient\([^)]*var\(--bg-card\)/);
    expect(css).toMatch(/@keyframes nudge/);
    expect(css).toMatch(
      /prefers-reduced-motion: reduce\)\s*\{[^@]*\.nudge\s*\{[^}]*animation:\s*none/
    );
  });
});
