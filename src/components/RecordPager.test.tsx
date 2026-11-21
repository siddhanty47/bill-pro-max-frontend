import { Fragment, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { RecordPager } from './RecordPager';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, pagedOk } from '../test/msw/handlers';
import type { RecordNav } from '../utils/recordNav';

function Probe() {
  const loc = useLocation();
  const type = useNavigationType();
  const nav = (loc.state as { recordNav?: RecordNav } | null)?.recordNav;
  return (
    <div>
      <output data-testid="path">{loc.pathname}</output>
      <output data-testid="type">{type}</output>
      <output data-testid="index">{nav ? String(nav.index) : 'none'}</output>
    </div>
  );
}

/** Mirrors App.tsx: the page (and its pager) remounts when the record changes. */
function RemountPerPath({ children }: { children: ReactNode }) {
  return <Fragment key={useLocation().pathname}>{children}</Fragment>;
}

function renderPager(route: string, routeState?: unknown, noun = 'challan') {
  return renderWithProviders(
    <Routes>
      <Route
        path="*"
        element={
          <RemountPerPath>
            <RecordPager noun={noun} />
            <Probe />
          </RemountPerPath>
        }
      />
    </Routes>,
    { route, routeState, preloadedState: signedIn() }
  );
}

const local = (index: number): { recordNav: RecordNav } => ({
  recordNav: { paths: ['/challans/a', '/challans/b', '/challans/c'], index },
});

const path = () => screen.getByTestId('path').textContent;

describe('RecordPager', () => {
  it('without context disables both buttons and shows no counter', () => {
    renderPager('/challans/b');
    const prev = screen.getByRole('button', { name: 'Previous challan' });
    const next = screen.getByRole('button', { name: 'Next challan' });
    expect(prev).toBeDisabled();
    expect(next).toBeDisabled();
    expect(next).toHaveAttribute('title', 'Open from a table to browse');
    expect(screen.queryByText(/ of /)).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Browse challans' })).toBeInTheDocument();
  });

  it('shows the position and steps with replace', async () => {
    const { user } = renderPager('/challans/b', local(1));
    expect(screen.getByText('2 of 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next challan' }));
    expect(path()).toBe('/challans/c');
    expect(screen.getByTestId('index')).toHaveTextContent('2');
    expect(screen.getByTestId('type')).toHaveTextContent('REPLACE');
    await user.click(screen.getByRole('button', { name: 'Previous challan' }));
    expect(path()).toBe('/challans/b');
  });

  it('restores focus after a step: Next stays focused, Previous when Next disables', async () => {
    const { user } = renderPager('/challans/a', local(0));
    await user.click(screen.getByRole('button', { name: 'Next challan' }));
    expect(screen.getByRole('button', { name: 'Next challan' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Next challan' }));
    expect(path()).toBe('/challans/c');
    expect(screen.getByRole('button', { name: 'Previous challan' })).toHaveFocus();
  });

  it('announces the position politely', () => {
    renderPager('/challans/b', local(1));
    expect(screen.getByText('2 of 3')).toHaveAttribute('aria-live', 'polite');
  });

  it('does not intercept [ and ] without context', () => {
    renderPager('/challans/b');
    const ev = new KeyboardEvent('keydown', { code: 'BracketRight', key: ']', cancelable: true });
    document.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('disables Next at the last record and Prev at the first', () => {
    const { unmount } = renderPager('/challans/c', local(2));
    expect(screen.getByRole('button', { name: 'Next challan' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Previous challan' })).toBeEnabled();
    unmount();
    renderPager('/challans/a', local(0));
    expect(screen.getByRole('button', { name: 'Previous challan' })).toBeDisabled();
  });

  it('steps with [ and ]', () => {
    renderPager('/challans/b', local(1));
    fireEvent.keyDown(document, { code: 'BracketRight' });
    expect(path()).toBe('/challans/c');
    fireEvent.keyDown(document, { code: 'BracketLeft' });
    expect(path()).toBe('/challans/b');
  });

  it('ignores hotkeys while typing in an input', () => {
    renderPager('/challans/b', local(1));
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { code: 'BracketRight' });
    expect(path()).toBe('/challans/b');
    input.remove();
  });

  it('ignores hotkeys while a dialog is open', () => {
    renderPager('/challans/b', local(1));
    const dlg = document.createElement('div');
    dlg.setAttribute('role', 'dialog');
    document.body.appendChild(dlg);
    fireEvent.keyDown(document, { code: 'BracketRight' });
    expect(path()).toBe('/challans/b');
    dlg.remove();
  });

  describe('server edge', () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({ _id: `c${i + 1}` }));
    const serverState = (page: number, index: number): { recordNav: RecordNav } => {
      const start = (page - 1) * 25;
      const paths = rows.slice(start, start + 25).map(r => `/challans/${r._id}`);
      return {
        recordNav: {
          paths,
          index,
          server: {
            page,
            total: 30,
            source: {
              list: 'challans',
              args: {
                businessId: 'biz-1',
                pageSize: 25,
                search: 'x',
                status: 'draft',
                type: 'delivery',
              },
            },
          },
        },
      };
    };

    it('fetches the next page and lands on its first row', async () => {
      let url = '';
      server.use(
        http.get(apiUrl('/businesses/biz-1/challans'), ({ request }) => {
          url = request.url;
          return pagedOk(rows, request);
        })
      );
      const { user } = renderPager('/challans/c25', serverState(1, 24));
      expect(screen.getByText('25 of 30')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Next challan' }));
      await waitFor(() => expect(path()).toBe('/challans/c26'));
      const q = new URL(url).searchParams;
      expect(q.get('page')).toBe('2');
      expect(q.get('pageSize')).toBe('25');
      expect(q.get('search')).toBe('x');
      expect(q.get('status')).toBe('draft');
      expect(q.get('type')).toBe('delivery');
      expect(screen.getByText('26 of 30')).toBeInTheDocument();
      expect(screen.getByTestId('type')).toHaveTextContent('REPLACE');
    });

    it('fetches the previous page and lands on its last row', async () => {
      server.use(
        http.get(apiUrl('/businesses/biz-1/challans'), ({ request }) => pagedOk(rows, request))
      );
      const { user } = renderPager('/challans/c26', serverState(2, 0));
      await user.click(screen.getByRole('button', { name: 'Previous challan' }));
      await waitFor(() => expect(path()).toBe('/challans/c25'));
      expect(screen.getByText('25 of 30')).toBeInTheDocument();
    });

    it('stays put and re-enables the buttons on an empty page', async () => {
      server.use(
        http.get(apiUrl('/businesses/biz-1/challans'), ({ request }) => pagedOk([], request))
      );
      const { user } = renderPager('/challans/c25', serverState(1, 24));
      const next = screen.getByRole('button', { name: 'Next challan' });
      await user.click(next);
      await waitFor(() => expect(next).toBeEnabled());
      expect(path()).toBe('/challans/c25');
    });

    it('stays put and re-enables the buttons on a server error', async () => {
      server.use(
        http.get(
          apiUrl('/businesses/biz-1/challans'),
          () => new HttpResponse(null, { status: 500 })
        )
      );
      const { user } = renderPager('/challans/c25', serverState(1, 24));
      const next = screen.getByRole('button', { name: 'Next challan' });
      await user.click(next);
      await waitFor(() => expect(next).toBeEnabled());
      expect(path()).toBe('/challans/c25');
    });

    it('fetches once on a double click', async () => {
      let hits = 0;
      server.use(
        http.get(apiUrl('/businesses/biz-1/challans'), ({ request }) => {
          hits += 1;
          return pagedOk(rows, request);
        })
      );
      renderPager('/challans/c25', serverState(1, 24));
      const next = screen.getByRole('button', { name: 'Next challan' });
      fireEvent.click(next);
      fireEvent.click(next);
      await waitFor(() => expect(path()).toBe('/challans/c26'));
      expect(hits).toBe(1);
    });

    it('does not navigate after the user left while the fetch was in flight', async () => {
      server.use(
        http.get(apiUrl('/businesses/biz-1/challans'), async ({ request }) => {
          await delay(80);
          return pagedOk(rows, request);
        })
      );
      function Leave() {
        const navigate = useNavigate();
        return (
          <button type="button" onClick={() => navigate('/elsewhere')}>
            leave
          </button>
        );
      }
      const { user } = renderWithProviders(
        <Routes>
          <Route
            path="*"
            element={
              <>
                <RecordPager noun="challan" />
                <Leave />
                <Probe />
              </>
            }
          />
        </Routes>,
        { route: '/challans/c25', routeState: serverState(1, 24), preloadedState: signedIn() }
      );
      await user.click(screen.getByRole('button', { name: 'Next challan' }));
      await user.click(screen.getByRole('button', { name: 'leave' }));
      await new Promise(r => setTimeout(r, 200));
      expect(path()).toBe('/elsewhere');
    });

    it('uses the bills endpoint and paths for a bills source', async () => {
      const bills = Array.from({ length: 30 }, (_, i) => ({ _id: `b${i + 1}` }));
      server.use(
        http.get(apiUrl('/businesses/biz-1/bills'), ({ request }) => pagedOk(bills, request))
      );
      const { user } = renderPager(
        '/bills/b25',
        {
          recordNav: {
            paths: bills.slice(0, 25).map(r => `/bills/${r._id}`),
            index: 24,
            server: {
              page: 1,
              total: 30,
              source: { list: 'bills', args: { businessId: 'biz-1', pageSize: 25 } },
            },
          },
        },
        'bill'
      );
      await user.click(screen.getByRole('button', { name: 'Next bill' }));
      await waitFor(() => expect(path()).toBe('/bills/b26'));
    });
  });
});
