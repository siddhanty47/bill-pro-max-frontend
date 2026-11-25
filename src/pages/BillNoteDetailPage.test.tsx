import { afterEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { BillNoteDetailPage } from './BillNoteDetailPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import { makeBillNote } from '../test/factories';
import type { BillNote, Party } from '../types';

const BASE = '/businesses/biz-1/bill-notes/n1';

function useApi(note: BillNote = makeBillNote({ _id: 'n1' })) {
  let current = note;
  const gets = { count: 0 };
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl(BASE), () => {
      gets.count += 1;
      return ok(current);
    }),
    http.get(apiUrl('/businesses/biz-1/parties'), () =>
      HttpResponse.json({
        success: true,
        data: [{ _id: 'p1', name: 'Mehta Builders' }] as Party[],
        pagination: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
      })
    )
  );
  return {
    gets,
    setNote: (n: BillNote) => {
      current = n;
    },
  };
}

function capture(method: 'patch' | 'post', path: string, reply: () => Response = () => ok({})) {
  const bodies: unknown[] = [];
  server.use(
    http[method](apiUrl(path), async ({ request }) => {
      bodies.push(await request.json().catch(() => null));
      return reply();
    })
  );
  return bodies;
}

const fail = (status: number, code: string, message: string) => () =>
  HttpResponse.json({ success: false, error: { code, message } }, { status });

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/bill-notes/:noteId" element={<BillNoteDetailPage />} />
    </Routes>,
    { preloadedState: signedIn(), route: '/bill-notes/n1' }
  );
}

afterEach(() => vi.restoreAllMocks());

describe('BillNoteDetailPage', () => {
  it('shows a spinner, then the error with a retry', async () => {
    useApi();
    server.use(http.get(apiUrl(BASE), fail(404, 'NOT_FOUND', 'Note not found')));
    renderPage();
    expect(screen.getByText('Loading note…')).toBeInTheDocument();
    expect(await screen.findByText(/Note not found/)).toBeInTheDocument();
  });

  it('renders a draft credit note: details, lines and negative totals', async () => {
    useApi();
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Credit note', level: 1 })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Notes' })).toHaveAttribute(
      'href',
      '/bill-notes'
    );

    const details = screen.getByRole('heading', { name: 'Details' }).closest('section')!;
    expect(within(details).getAllByText('Draft').length).toBeGreaterThan(0);
    expect(within(details).getByRole('link', { name: 'INV-2026-27-0007' })).toHaveAttribute(
      'href',
      '/bills/bill-1'
    );
    expect(await within(details).findByRole('link', { name: 'Mehta Builders' })).toHaveAttribute(
      'href',
      '/parties/p1'
    );
    expect(within(details).getByRole('link', { name: 'AG-001' })).toHaveAttribute(
      'href',
      '/agreements/AG-001'
    );
    expect(within(details).getByText('Manual')).toBeVisible();

    expect(screen.getByText('Rate agreed lower')).toBeVisible();
    const lines = screen.getByRole('table', { name: 'Lines' });
    expect(within(lines).getByText('Prop hire')).toBeVisible();
    expect(within(lines).getByText('-₹1,000')).toHaveClass('mono');

    const summary = screen.getByRole('table', { name: 'Summary' });
    const row = (label: string) => within(summary).getByText(label).closest('tr')!;
    expect(within(row('Subtotal')).getByText('-₹1,000')).toBeVisible();
    expect(within(row('SGST')).getByText('-₹90')).toBeVisible();
    expect(within(row('CGST')).getByText('-₹90')).toBeVisible();
    expect(within(row('Total')).getByText('-₹1,180')).toBeVisible();
    expect(screen.queryByText('IGST')).not.toBeInTheDocument();
  });

  it('shows an issued debit note with its number, IGST and + signed totals', async () => {
    useApi(
      makeBillNote({
        _id: 'n1',
        type: 'debit',
        status: 'issued',
        noteNumber: 'DN/2026-27/0003',
        noteDate: '2026-11-21T00:00:00.000Z',
        taxMode: 'inter',
        sgstRate: 0,
        cgstRate: 0,
        igstRate: 18,
        sgstAmount: 0,
        cgstAmount: 0,
        igstAmount: 180,
      })
    );
    renderPage();
    expect(await screen.findByRole('heading', { name: 'DN/2026-27/0003', level: 1 })).toBeVisible();
    const summary = screen.getByRole('table', { name: 'Summary' });
    expect(within(summary).getByText('+₹180')).toBeVisible();
    expect(within(summary).getByText('+₹1,180')).toBeVisible();
    expect(screen.getByText('21 Nov')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Issue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('lists auto note causes linked to their challan or agreement', async () => {
    useApi(
      makeBillNote({
        _id: 'n1',
        source: 'auto',
        causes: [
          {
            kind: 'challan',
            id: 'c1',
            label: 'Challan D-0004',
            reason: 'Qty fixed',
            at: '2026-11-18T10:00:00.000Z',
          },
          {
            kind: 'agreement',
            id: 'AG-001',
            label: 'Agreement AG-001',
            at: '2026-11-19T10:00:00.000Z',
          },
          { kind: 'system', id: 'mig', label: 'Pricing check', at: '2026-11-19T11:00:00.000Z' },
        ],
      })
    );
    renderPage();
    const causes = await screen.findByRole('table', { name: 'Causes' });
    expect(within(causes).getByRole('link', { name: 'Challan D-0004' })).toHaveAttribute(
      'href',
      '/challans/c1'
    );
    expect(within(causes).getByRole('link', { name: 'Agreement AG-001' })).toHaveAttribute(
      'href',
      '/agreements/AG-001'
    );
    expect(within(causes).getByText('Pricing check')).toBeVisible();
    expect(within(causes).getByText('Qty fixed')).toBeVisible();
    expect(within(causes).getByText('18 Nov')).toBeVisible();
  });

  it('issues a draft after confirming', async () => {
    useApi();
    const bodies = capture('post', `${BASE}/issue`, () => ok(makeBillNote({ _id: 'n1' })));
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Issue' }));
    const dialog = screen.getByRole('dialog', { name: 'Issue note' });
    expect(dialog).toHaveTextContent(
      "Issue this note? It gets the next number and can't be changed after."
    );
    await user.click(within(dialog).getByRole('button', { name: 'Issue note' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Issue note' })).not.toBeInTheDocument()
    );
  });

  it('disables Edit and Cancel note while the issue request is in flight', async () => {
    useApi();
    let release: () => void = () => {};
    server.use(
      http.post(
        apiUrl(`${BASE}/issue`),
        () =>
          new Promise<Response>(resolve => {
            release = () => resolve(ok(makeBillNote({ _id: 'n1' })));
          })
      )
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Issue' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Issue note' })).getByRole('button', {
        name: 'Issue note',
      })
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeDisabled());
    expect(screen.getByRole('button', { name: 'More actions' })).toBeDisabled();
    release();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Edit' })).toBeEnabled());
  });

  it('on NOTE_OUT_OF_DATE asks to review again and refetches', async () => {
    const api = useApi();
    capture('post', `${BASE}/issue`, fail(409, 'NOTE_OUT_OF_DATE', 'stale'));
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Issue' }));
    const before = api.gets.count;
    await user.click(
      within(screen.getByRole('dialog', { name: 'Issue note' })).getByRole('button', {
        name: 'Issue note',
      })
    );
    expect(
      await screen.findByText('The amount changed since you opened this note. Review it again.')
    ).toBeVisible();
    await waitFor(() => expect(api.gets.count).toBeGreaterThan(before));
  });

  it('shows the server message when the credit exceeds the bill', async () => {
    useApi();
    capture(
      'post',
      `${BASE}/issue`,
      fail(400, 'CREDIT_EXCEEDS_BILL', 'Credit is more than the bill amount')
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Issue' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Issue note' })).getByRole('button', {
        name: 'Issue note',
      })
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Credit is more than the bill amount'
    );
  });

  it('edits a manual draft: lines and reason', async () => {
    useApi();
    const bodies = capture('patch', BASE, () => ok(makeBillNote({ _id: 'n1' })));
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit note' });
    const amount = within(dialog).getByLabelText('Amount for line 1');
    await user.clear(amount);
    await user.type(amount, '500');
    await user.click(within(dialog).getByRole('button', { name: 'Save note' }));
    await waitFor(() =>
      expect(bodies).toEqual([
        {
          reason: 'Rate agreed lower',
          lines: [{ kind: 'hire', description: 'Prop hire', amount: 500 }],
        },
      ])
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Edit note' })).not.toBeInTheDocument()
    );
  });

  it('edits only the reason of an auto draft and shows a save error', async () => {
    useApi(makeBillNote({ _id: 'n1', source: 'auto' }));
    const bodies = capture('patch', BASE, fail(409, 'NOTE_ISSUED', 'This note is already issued'));
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit note' });
    expect(within(dialog).queryByRole('table', { name: 'Note lines' })).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Reason/), ' and dates');
    await user.click(within(dialog).getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(bodies).toEqual([{ reason: 'Rate agreed lower and dates' }]));
    expect(await within(dialog).findByText('This note is already issued')).toBeVisible();
  });

  it('edits only the reason of a full-value credit and shows its discount as a deduction', async () => {
    useApi(
      makeBillNote({
        _id: 'n1',
        fullValue: true,
        subtotal: 1000,
        discountAmount: 100,
        sgstAmount: 81,
        cgstAmount: 81,
        taxAmount: 162,
        totalAmount: 1062,
      })
    );
    const bodies = capture('patch', BASE, () => ok(makeBillNote({ _id: 'n1' })));
    const { user } = renderPage();
    const summary = await screen.findByRole('table', { name: 'Summary' });
    const discount = within(summary).getByText('Discount').closest('tr')!;
    expect(within(discount).getByText('-₹100')).toBeVisible();
    expect(within(summary).getByText('-₹1,062')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit note' });
    expect(within(dialog).queryByRole('table', { name: 'Note lines' })).not.toBeInTheDocument();
    await user.type(within(dialog).getByLabelText(/Reason/), ' in full');
    await user.click(within(dialog).getByRole('button', { name: 'Save note' }));
    await waitFor(() => expect(bodies).toEqual([{ reason: 'Rate agreed lower in full' }]));
  });

  it('explains that cancelling an auto draft dismisses it until the next change', async () => {
    useApi(makeBillNote({ _id: 'n1', source: 'auto' }));
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancel note' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel note' });
    expect(dialog).toHaveTextContent(
      "This dismisses the current draft. A new one is drafted on the next change to this bill's data."
    );
  });

  it('cancels a draft from the menu after confirming', async () => {
    useApi();
    const bodies = capture('post', `${BASE}/cancel`, () => ok(makeBillNote({ _id: 'n1' })));
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancel note' }));
    const dialog = screen.getByRole('dialog', { name: 'Cancel note' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel note' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
  });

  it('keeps the draft when the cancel dialog is dismissed', async () => {
    useApi();
    const bodies = capture('post', `${BASE}/cancel`);
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('menuitem', { name: 'Cancel note' }));
    await user.click(screen.getByRole('button', { name: 'Keep note' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(bodies).toHaveLength(0);
  });

  it('sends an issued note by email and downloads its PDF', async () => {
    useApi(makeBillNote({ _id: 'n1', status: 'issued', noteNumber: 'CN/2026-27/0001' }));
    const sends = capture('post', `${BASE}/send`);
    server.use(
      http.get(
        apiUrl(`${BASE}/pdf`),
        () => new HttpResponse('%PDF', { headers: { 'Content-Type': 'application/pdf' } })
      )
    );
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:note'), revokeObjectURL });
    const names: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      names.push(this.download);
    });
    const { user } = renderPage();

    await user.click(await screen.findByRole('button', { name: 'Send email' }));
    await waitFor(() => expect(sends).toHaveLength(1));
    expect(await screen.findByText('Note sent')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Download PDF' }));
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:note'));
    expect(names).toEqual(['note-CN-2026-27-0001.pdf']);
  });

  it('shows a send error from the server', async () => {
    useApi(makeBillNote({ _id: 'n1', status: 'issued', noteNumber: 'CN/2026-27/0001' }));
    capture(
      'post',
      `${BASE}/send`,
      fail(400, 'VALIDATION', 'Party does not have an email address')
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: 'Send email' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Party does not have an email address'
    );
  });

  it('a cancelled note has no actions', async () => {
    useApi(makeBillNote({ _id: 'n1', status: 'cancelled' }));
    renderPage();
    await screen.findByRole('heading', { name: 'Credit note', level: 1 });
    expect(screen.queryByRole('button', { name: 'Issue' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send email' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More actions' })).not.toBeInTheDocument();
  });

  it('loads the change history for documentType BillNote', async () => {
    useApi();
    let historyUrl = '';
    server.use(
      http.get(apiUrl('/businesses/biz-1/audit-logs/BillNote/n1'), ({ request }) => {
        historyUrl = request.url;
        return HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
        });
      })
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Change history' }));
    await waitFor(() => expect(historyUrl).toContain('/audit-logs/BillNote/n1'));
  });
});
