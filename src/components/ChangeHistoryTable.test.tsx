import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import ChangeHistoryTable from './ChangeHistoryTable';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { AuditLogEntry } from '../types';

const HISTORY = '/businesses/biz-1/audit-logs/Bill/bill-1';

function entry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    _id: 'log-1',
    businessId: 'biz-1',
    documentId: 'bill-1',
    documentType: 'Bill',
    action: 'created',
    changes: [],
    performedBy: { userId: 'u-1', name: 'Asha' },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function page(data: AuditLogEntry[], pageNo = 1, totalPages = 1) {
  return HttpResponse.json({
    success: true,
    data,
    pagination: {
      page: pageNo,
      pageSize: 15,
      total: data.length,
      totalPages,
      hasNext: pageNo < totalPages,
      hasPrev: pageNo > 1,
    },
  });
}

function renderTable() {
  server.use(http.get(apiUrl('/businesses'), () => ok([])));
  return renderWithProviders(<ChangeHistoryTable documentType="Bill" documentId="bill-1" />, {
    preloadedState: signedIn(),
  });
}

describe('ChangeHistoryTable', () => {
  it('shows an empty message when there is no history', async () => {
    server.use(http.get(apiUrl(HISTORY), () => page([])));
    renderTable();
    expect(await screen.findByText('No changes yet')).toBeInTheDocument();
  });

  it('renders created, updated and deleted entries with status badges', async () => {
    const hourAgo = new Date(Date.now() - 2 * 3600_000).toISOString();
    server.use(
      http.get(apiUrl(HISTORY), () =>
        page([
          entry({ _id: 'a', action: 'created' }),
          entry({
            _id: 'b',
            action: 'updated',
            createdAt: hourAgo,
            changes: [
              { field: 'totalAmount', oldValue: 100, newValue: 250 },
              { field: 'notes', oldValue: null, newValue: 'Paid early' },
              { field: 'isPaid', oldValue: false, newValue: true },
              { field: 'items', oldValue: [1], newValue: [1, 2] },
              { field: 'meta.site', oldValue: { a: 1 }, newValue: '' },
              { field: 'dueDate', oldValue: '2026-01-02T00:00:00.000Z', newValue: undefined },
            ],
          }),
          entry({ _id: 'c', action: 'updated', changes: [] }),
          entry({ _id: 'd', action: 'deleted', createdAt: '2020-01-01T00:00:00.000Z' }),
        ])
      )
    );
    renderTable();

    expect((await screen.findAllByText('Document created')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Document updated').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Document deleted').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Total amount').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Meta > site').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Paid early').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2 items').length).toBeGreaterThan(0);
    expect(screen.getAllByText('{"a":1}').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not set').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^2 Jan/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Yes').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Created').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Updated').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Deleted').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/1 Jan 2020, /)[0]).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Change history' })).toBeInTheDocument();
  });

  it('pages through history', async () => {
    server.use(
      http.get(apiUrl(HISTORY), ({ request }) => {
        const p = Number(new URL(request.url).searchParams.get('page'));
        return page(
          [entry({ _id: `p${p}`, performedBy: { userId: 'u', name: `User ${p}` } })],
          p,
          2
        );
      })
    );
    const { user } = renderTable();

    expect(await screen.findByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('User 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('User 1')).toBeInTheDocument();
  });

  it('shows an error with a retry', async () => {
    server.use(
      http.get(apiUrl(HISTORY), () =>
        HttpResponse.json({ success: false, message: 'Nope' }, { status: 500 })
      )
    );
    renderTable();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
