import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { BusinessDetailPage } from './BusinessDetailPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Business } from '../types';

const BASE = '/businesses/biz-1';

const makeBusiness = (over: Partial<Business> = {}): Business =>
  ({
    _id: 'biz-1',
    name: 'Shree Scaffolding',
    ownerUserId: 'u1',
    address: '12 Market Road',
    phone: '9876543210',
    email: 'hello@shree.test',
    gst: '27ABCDE1234F1Z5',
    stateCode: '27',
    settings: {
      billingCycle: 'monthly',
      currency: 'INR',
      defaultTaxRate: 18,
      defaultSgstRate: 9,
      defaultCgstRate: 9,
      defaultIgstRate: 0,
      defaultPaymentDueDays: 15,
    },
    isActive: true,
    createdAt: '2025-01-05T08:30:00.000Z',
    updatedAt: '2025-02-06T08:30:00.000Z',
    ...over,
  }) as Business;

function useApi(business: Business = makeBusiness()) {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([])),
    http.get(apiUrl(BASE), () => ok(business))
  );
}

function capture() {
  const bodies: unknown[] = [];
  server.use(
    http.patch(apiUrl(BASE), async ({ request }) => {
      bodies.push(await request.json());
      return ok(makeBusiness());
    })
  );
  return bodies;
}

function renderPage(preloadedState = signedIn()) {
  return renderWithProviders(
    <Routes>
      <Route path="/business" element={<BusinessDetailPage />} />
      <Route path="/" element={<div>dashboard</div>} />
    </Routes>,
    { preloadedState, route: '/business' }
  );
}

describe('BusinessDetailPage', () => {
  it('redirects to the dashboard without a business', async () => {
    useApi();
    renderPage(signedIn(''));
    expect(await screen.findByText('dashboard')).toBeInTheDocument();
  });

  it('shows a spinner then the error with a retry', async () => {
    useApi();
    server.use(
      http.get(apiUrl(BASE), () =>
        HttpResponse.json({ success: false, error: { message: 'Business gone' } }, { status: 404 })
      )
    );
    renderPage();
    expect(screen.getByText('Loading business…')).toBeInTheDocument();
    expect(await screen.findByText(/Business gone/)).toBeInTheDocument();
  });

  it('renders header, one status chip, tabs, mono codes and the details sidebar', async () => {
    useApi();
    renderPage();
    expect(
      await screen.findByRole('heading', { name: 'Shree Scaffolding', level: 1 })
    ).toBeVisible();
    expect(screen.getAllByText('Active')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Back to Dashboard' })).toHaveAttribute('href', '/');
    expect(screen.getAllByRole('tab').map(t => t.textContent)).toEqual(['About', 'Change history']);
    expect(screen.getByRole('button', { name: /27ABCDE1234F1Z5/ })).toHaveClass('mono');
    expect(screen.getByRole('button', { name: /9876543210/ })).toHaveClass('mono');
    expect(screen.getByText('Monthly')).toBeVisible();

    const details = screen.getByRole('heading', { name: 'Details' }).closest('section')!;
    expect(within(details).queryByText('Status')).not.toBeInTheDocument();
    expect(within(details).getByText('5 Jan 2025')).toBeVisible();
    expect(within(details).getByText('6 Feb 2025')).toBeVisible();
  });

  it('shows an inactive status and placeholders for missing fields', async () => {
    useApi(makeBusiness({ isActive: false, address: undefined, gst: undefined }));
    renderPage();
    expect(await screen.findByText('Inactive')).toBeVisible();
    expect(screen.getAllByText('Not added').length).toBeGreaterThanOrEqual(2);
  });

  it('saves a top-level field with only that field in the PATCH body', async () => {
    useApi();
    const bodies = capture();
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: /9876543210/ }));
    const input = screen.getByRole('textbox', { name: 'Phone' });
    await user.clear(input);
    await user.type(input, '9000000000{Enter}');
    await waitFor(() => expect(bodies).toEqual([{ phone: '9000000000' }]));
  });

  it('saves a settings number with only that setting (the server merges the rest)', async () => {
    useApi();
    const bodies = capture();
    const { user } = renderPage();
    const row = (await screen.findByText('Payment due days')).closest('div')!;
    await user.click(within(row).getByRole('button', { name: /15/ }));
    const input = screen.getByRole('spinbutton', { name: 'Payment due days' });
    await user.clear(input);
    await user.type(input, '30{Enter}');
    await waitFor(() => expect(bodies).toEqual([{ settings: { defaultPaymentDueDays: 30 } }]));
  });

  describe('credit note deadline', () => {
    const deadlineRow = async () =>
      (await screen.findByText('Credit note deadline')).closest('div')!;

    it('shows the default 30 Nov with the GST helper when unset', async () => {
      useApi();
      renderPage();
      const row = await deadlineRow();
      expect(within(row).getByRole('button', { name: /30 Nov/ })).toBeVisible();
      expect(
        within(row).getByText(
          "Credit notes are refused after this day following the year's end (GST). Default 30 Nov."
        )
      ).toBeVisible();
    });

    it('shows a custom deadline and saves a valid MM-DD alone', async () => {
      useApi(
        makeBusiness({ settings: { ...makeBusiness().settings, creditNoteDeadline: '09-30' } })
      );
      const bodies = capture();
      const { user } = renderPage();
      const row = await deadlineRow();
      await user.click(within(row).getByRole('button', { name: /30 Sep/ }));
      const input = screen.getByRole('textbox', { name: 'Credit note deadline' });
      expect(input).toHaveValue('09-30');
      await user.clear(input);
      await user.type(input, '10-31{Enter}');
      await waitFor(() => expect(bodies).toEqual([{ settings: { creditNoteDeadline: '10-31' } }]));
    });

    it.each([
      ['02-29', 'Not a calendar day'],
      ['02-30', 'Not a calendar day'],
      ['13-01', 'Use MM-DD, e.g. 11-30'],
      ['30 Nov', 'Use MM-DD, e.g. 11-30'],
    ])('refuses %s without calling the API', async (value, message) => {
      useApi();
      const bodies = capture();
      const { user } = renderPage();
      const row = await deadlineRow();
      await user.click(within(row).getByRole('button', { name: /30 Nov/ }));
      const input = screen.getByRole('textbox', { name: 'Credit note deadline' });
      await user.clear(input);
      await user.type(input, `${value}{Enter}`);
      expect(await screen.findByText(message)).toBeVisible();
      expect(bodies).toEqual([]);
      expect(input).toHaveValue(value);
    });
  });

  it('saves the billing cycle select', async () => {
    useApi();
    const bodies = capture();
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: /Monthly/ }));
    await user.selectOptions(screen.getByRole('combobox', { name: 'Billing cycle' }), 'weekly');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(bodies).toEqual([{ settings: { billingCycle: 'weekly' } }]));
  });

  it('cancels an edit with Escape without saving', async () => {
    useApi();
    const bodies = capture();
    const { user } = renderPage();
    await user.click(await screen.findByRole('button', { name: /27ABCDE1234F1Z5/ }));
    await user.type(screen.getByRole('textbox', { name: 'GST' }), 'x{Escape}');
    expect(bodies).toEqual([]);
    expect(screen.getByRole('button', { name: /27ABCDE1234F1Z5/ })).toBeVisible();
  });

  it('loads the change history for the business', async () => {
    useApi();
    let url = '';
    server.use(
      http.get(apiUrl('/businesses/biz-1/audit-logs/business/biz-1'), ({ request }) => {
        url = request.url;
        return HttpResponse.json({
          success: true,
          data: [],
          pagination: { page: 1, pageSize: 15, total: 0, totalPages: 1 },
        });
      })
    );
    const { user } = renderPage();
    await user.click(await screen.findByRole('tab', { name: 'Change history' }));
    await waitFor(() => expect(url).toContain('/audit-logs/business/biz-1'));
  });
});
