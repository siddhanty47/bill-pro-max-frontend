import { afterEach, describe, expect, it, vi } from 'vitest';
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
    expect(within(issued).getByText('+₹99.50')).toBeVisible();
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
    expect(within(item).getByText('+₹99.50')).toBeInTheDocument();
    expect(within(item).getByText('INV-2026-27-0009')).toHaveClass('mono');
  });

  describe('bulk actions', () => {
    afterEach(() => vi.restoreAllMocks());
    const bar = () => screen.queryByRole('region', { name: 'Bulk actions' });
    const doneDialog = () => screen.findByRole('dialog', { name: 'Done' });
    const conflict = (code: string) =>
      HttpResponse.json(
        { success: false, error: { code, message: `${code} message` } },
        { status: 409 }
      );
    const items = (el: HTMLElement) =>
      within(el)
        .getAllByRole('listitem')
        .map(li => li.textContent);
    const mixed: BillNote[] = [
      makeBillNote({ _id: 'd1', billNumber: 'B-1' }),
      makeBillNote({ _id: 'd2', billNumber: 'B-2', type: 'debit' }),
      makeBillNote({ _id: 'd3', billNumber: 'B-3' }),
      makeBillNote({ _id: 'i1', billNumber: 'B-4', status: 'issued', noteNumber: 'CN/1' }),
      makeBillNote({ _id: 'x1', billNumber: 'B-5', status: 'cancelled', noteNumber: 'CN/2' }),
    ];
    function track(action: 'issue' | 'cancel', reply: (id: string) => Response | undefined) {
      const hits: string[] = [];
      server.use(
        http.post(apiUrl(`/businesses/biz-1/bill-notes/:id/${action}`), ({ params }) => {
          const id = String(params.id);
          hits.push(id);
          return reply(id) ?? ok(makeBillNote({ _id: id, status: 'issued' }));
        })
      );
      return hits;
    }
    const selectAll = (user: ReturnType<typeof renderPage>['user']) =>
      user.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));

    it('names each row checkbox by note number, or by bill for a draft', async () => {
      useApi(mixed);
      const { user } = renderPage();
      await screen.findByRole('table', { name: 'Notes' });
      expect(bar()).not.toBeInTheDocument();
      await user.click(within(table()).getByRole('checkbox', { name: 'Select CN/1' }));
      await user.click(within(table()).getByRole('checkbox', { name: 'Select Draft on B-1' }));
      expect(bar()).toHaveTextContent('2 notes selected');
      expect(within(bar()!).getByRole('button', { name: 'Issue 1' })).toBeEnabled();
      expect(within(bar()!).getByRole('button', { name: 'Cancel 1' })).toBeEnabled();
      expect(within(bar()!).getByRole('button', { name: 'Download 2 PDFs' })).toBeEnabled();
      await user.click(within(table()).getByRole('checkbox', { name: 'Select Draft on B-1' }));
      expect(bar()).toHaveTextContent('1 note selected');
      expect(within(bar()!).getByRole('button', { name: 'Issue 0' })).toBeDisabled();
      expect(within(bar()!).getByRole('button', { name: 'Cancel 0' })).toBeDisabled();
    });

    it('issues drafts; deadline and out-of-date refusals become reasons', async () => {
      useApi(mixed);
      const hits = track('issue', id =>
        id === 'd1'
          ? conflict('CREDIT_NOTE_DEADLINE_PASSED')
          : id === 'd3'
            ? conflict('NOTE_OUT_OF_DATE')
            : undefined
      );
      const { user } = renderPage();
      await screen.findByRole('table', { name: 'Notes' });
      await selectAll(user);
      await user.click(within(bar()!).getByRole('button', { name: 'Issue 3' }));
      const ask = screen.getByRole('dialog', { name: 'Issue 3 notes?' });
      expect(ask).toHaveTextContent('They will be locked.');
      await user.click(within(ask).getByRole('button', { name: 'Issue' }));
      const done = await doneDialog();
      expect(hits.sort()).toEqual(['d1', 'd2', 'd3']);
      expect(done).toHaveTextContent('1 issued');
      expect(items(done)).toEqual([
        'Draft on B-1: too late for a credit note this year',
        'Draft on B-3: changed since you opened it, reload',
        'CN/1: already issued',
        'CN/2: already cancelled',
      ]);
    });

    it('uses the singular when issuing one note', async () => {
      useApi(mixed.slice(0, 1));
      track('issue', () => undefined);
      const { user } = renderPage();
      await screen.findByRole('table', { name: 'Notes' });
      await selectAll(user);
      await user.click(within(bar()!).getByRole('button', { name: 'Issue 1' }));
      const ask = screen.getByRole('dialog', { name: 'Issue 1 note?' });
      expect(ask).toHaveTextContent('It will be locked.');
      await user.click(within(ask).getByRole('button', { name: 'Issue' }));
      expect(await doneDialog()).toHaveTextContent('1 issued');
      await user.click(
        within(await doneDialog())
          .getAllByRole('button', { name: 'Close' })
          .at(-1)!
      );
      expect(bar()).not.toBeInTheDocument();
    });

    it('cancels drafts after the confirm; Keep notes does nothing', async () => {
      useApi(mixed);
      const hits = track('cancel', id =>
        id === 'd2'
          ? HttpResponse.json({ success: false, message: 'Server broke' }, { status: 500 })
          : undefined
      );
      const { user } = renderPage();
      await screen.findByRole('table', { name: 'Notes' });
      await selectAll(user);
      await user.click(within(bar()!).getByRole('button', { name: 'Cancel 3' }));
      let ask = screen.getByRole('dialog', { name: 'Cancel 3 draft notes?' });
      await user.click(within(ask).getByRole('button', { name: 'Keep notes' }));
      expect(hits).toEqual([]);
      await user.click(within(bar()!).getByRole('button', { name: 'Cancel 3' }));
      ask = screen.getByRole('dialog', { name: 'Cancel 3 draft notes?' });
      await user.click(within(ask).getByRole('button', { name: 'Cancel notes' }));
      const done = await doneDialog();
      expect(hits.sort()).toEqual(['d1', 'd2', 'd3']);
      expect(done).toHaveTextContent('2 cancelled');
      expect(items(done)[0]).toBe('Draft on B-2: Server broke');
    });

    it('uses the singular buttons when cancelling one note', async () => {
      useApi(mixed.slice(0, 1));
      track('cancel', () => undefined);
      const { user } = renderPage();
      await screen.findByRole('table', { name: 'Notes' });
      await selectAll(user);
      await user.click(within(bar()!).getByRole('button', { name: 'Cancel 1' }));
      const ask = screen.getByRole('dialog', { name: 'Cancel 1 draft note?' });
      expect(within(ask).getByRole('button', { name: 'Keep note' })).toBeInTheDocument();
      await user.click(within(ask).getByRole('button', { name: 'Cancel note' }));
      expect(await doneDialog()).toHaveTextContent('1 cancelled');
    });

    it('downloads one PDF per selected note, named like the single download', async () => {
      useApi(mixed);
      server.use(
        http.get(apiUrl('/businesses/biz-1/bill-notes/:id/pdf'), ({ params }) =>
          params.id === 'x1'
            ? HttpResponse.json({ success: false, message: 'No PDF' }, { status: 404 })
            : new HttpResponse('pdf', { headers: { 'Content-Type': 'application/pdf' } })
        )
      );
      URL.createObjectURL = vi.fn(() => 'blob:x');
      URL.revokeObjectURL = vi.fn();
      const names: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement
      ) {
        names.push(this.download);
      });
      const { user } = renderPage();
      await screen.findByRole('table', { name: 'Notes' });
      await selectAll(user);
      await user.click(within(bar()!).getByRole('button', { name: 'Download 5 PDFs' }));
      const done = await doneDialog();
      expect(done).toHaveTextContent('4 downloaded');
      expect(items(done)).toEqual(['CN/2: No PDF']);
      expect(names.sort()).toEqual([
        'note-CN-1.pdf',
        'note-draft.pdf',
        'note-draft.pdf',
        'note-draft.pdf',
      ]);
    });

    it('clears the selection when a filter changes', async () => {
      useApi(mixed);
      const { user } = renderPage();
      await screen.findByRole('table', { name: 'Notes' });
      await user.click(within(table()).getByRole('checkbox', { name: 'Select CN/1' }));
      expect(bar()).toBeInTheDocument();
      await user.selectOptions(screen.getByLabelText('Type'), 'debit');
      await waitFor(() => expect(bar()).not.toBeInTheDocument());
    });
  });
});
