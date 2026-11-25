import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes, useLocation } from 'react-router-dom';
import { BillNotesPage } from './BillNotesPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok, pagedOk } from '../test/msw/handlers';
import { makeBillNote } from '../test/factories';
import type { BillNote, Party } from '../types';

const defaults: BillNote[] = [
  makeBillNote({ _id: 'n1' }),
  makeBillNote({
    _id: 'n2',
    type: 'debit',
    source: 'auto',
    status: 'issued',
    noteNumber: 'DN/2026-27/0002',
    noteDate: '2026-11-21T00:00:00.000Z',
    billId: 'bill-2',
    billNumber: 'INV-2026-27-0009',
    partyId: 'p2',
    totalAmount: 99.5,
  }),
];

/** Like the backend: type/status/source filters, no text search. */
function matchNote(n: BillNote, q: URLSearchParams): boolean {
  return (['type', 'status', 'source'] as const).every(k => !q.get(k) || n[k] === q.get(k));
}

function useApi(notes: BillNote[] = defaults) {
  const queries: URLSearchParams[] = [];
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl('/businesses/biz-1/bill-notes'), ({ request }) => {
      queries.push(new URL(request.url).searchParams);
      return pagedOk(notes, request, matchNote);
    }),
    http.get(apiUrl('/businesses/biz-1/parties'), () =>
      ok([
        { _id: 'p1', name: 'Mehta Builders' },
        { _id: 'p2', name: 'Om Constructions' },
      ] as Party[])
    )
  );
  return queries;
}

function Where() {
  return <div data-testid="where">{useLocation().pathname}</div>;
}

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/bill-notes" element={<BillNotesPage />} />
      <Route path="*" element={<Where />} />
    </Routes>,
    { preloadedState: signedIn(), route: '/bill-notes' }
  );
}

const table = () => screen.getByRole('table', { name: 'Notes' });
const rowOf = (text: string) => within(table()).getByText(text).closest('tr')!;

describe('BillNotesPage', () => {
  it('shows a spinner, then the notes with draft numbers, signed amounts and chips', async () => {
    useApi();
    renderPage();
    expect(screen.getByText('Loading notes…')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Notes', level: 1 })).toBeVisible();

    const draft = rowOf('INV-2026-27-0007');
    expect(within(draft).getAllByText('Draft')).toHaveLength(2);
    expect(within(draft).getByText('Credit')).toBeVisible();
    expect(within(draft).getByRole('link', { name: 'INV-2026-27-0007' })).toHaveAttribute(
      'href',
      '/bills/bill-1'
    );
    expect(await within(draft).findByText('Mehta Builders')).toBeVisible();
    expect(within(draft).getByText('-₹1,180')).toBeVisible();
    expect(within(draft).getByText('Manual')).toBeVisible();
    expect(within(draft).getByText('Not added')).toBeVisible();

    const issued = rowOf('DN/2026-27/0002');
    expect(within(issued).getByText('Debit')).toBeVisible();
    expect(within(issued).getByText('₹99.50')).toBeVisible();
    expect(within(issued).getByText('21 Nov')).toBeVisible();
    expect(within(issued).getByText('Issued')).toBeVisible();
    expect(within(issued).getByText('Auto')).toBeVisible();
  });

  it('sends type, status and source filters to the server', async () => {
    const queries = useApi();
    const { user } = renderPage();
    await screen.findByRole('table', { name: 'Notes' });
    await user.selectOptions(screen.getByLabelText('Type'), 'debit');
    await user.selectOptions(screen.getByLabelText('Status'), 'issued');
    await user.selectOptions(screen.getByLabelText('Source'), 'auto');
    await waitFor(() => {
      const last = queries[queries.length - 1];
      expect(last.get('type')).toBe('debit');
      expect(last.get('status')).toBe('issued');
      expect(last.get('source')).toBe('auto');
    });
    await waitFor(() =>
      expect(within(table()).queryByText('INV-2026-27-0007')).not.toBeInTheDocument()
    );
    expect(within(table()).getByText('DN/2026-27/0002')).toBeVisible();
  });

  it('searches by note number, bill number or party name', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table', { name: 'Notes' });
    const search = screen.getByRole('searchbox', { name: 'Search notes' });

    await user.type(search, '0009');
    await waitFor(() =>
      expect(within(table()).queryByText('INV-2026-27-0007')).not.toBeInTheDocument()
    );
    expect(within(table()).getByText('DN/2026-27/0002')).toBeVisible();

    await user.clear(search);
    await user.type(search, 'mehta');
    await waitFor(() =>
      expect(within(table()).queryByText('DN/2026-27/0002')).not.toBeInTheDocument()
    );
    expect(within(table()).getByText('INV-2026-27-0007')).toBeVisible();

    await user.clear(search);
    await user.type(search, 'dn/2026');
    await waitFor(() =>
      expect(within(table()).queryByText('INV-2026-27-0007')).not.toBeInTheDocument()
    );

    await user.clear(search);
    await user.type(search, 'nothing like this');
    expect(await screen.findAllByText('No notes match these filters')).not.toHaveLength(0);
  });

  it('opens a note from its row', async () => {
    useApi();
    const { user } = renderPage();
    await screen.findByRole('table', { name: 'Notes' });
    await user.click(within(rowOf('INV-2026-27-0007')).getByText('Credit'));
    expect(await screen.findByTestId('where')).toHaveTextContent('/bill-notes/n1');
  });

  it('shows an empty state when there are no notes', async () => {
    useApi([]);
    renderPage();
    expect(await screen.findAllByText('No notes yet')).not.toHaveLength(0);
  });

  it('shows the load error with a retry', async () => {
    useApi();
    server.use(
      http.get(apiUrl('/businesses/biz-1/bill-notes'), () =>
        HttpResponse.json({ success: false, error: { message: 'Notes broke' } }, { status: 500 })
      )
    );
    renderPage();
    expect(await screen.findByText(/Notes broke/)).toBeInTheDocument();
  });

  it('renders the phone list with the same facts', async () => {
    useApi();
    renderPage();
    const list = await screen.findByRole('list', { name: 'Notes' });
    const item = within(list).getAllByRole('listitem')[1];
    expect(within(item).getByText('DN/2026-27/0002')).toBeInTheDocument();
    expect(within(item).getByText('Issued')).toBeInTheDocument();
    expect(within(item).getByText('Om Constructions')).toBeInTheDocument();
    expect(within(item).getByText('₹99.50')).toBeInTheDocument();
  });
});
