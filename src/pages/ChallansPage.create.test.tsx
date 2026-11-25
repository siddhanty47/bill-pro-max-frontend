/**
 * Creating a challan from the list page goes through the change gate: auto-adding an item's rate
 * to the agreement can touch billed months or a closed year.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { ChallansPage } from './ChallansPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok, pagedOk } from '../test/msw/handlers';
import type { CreateChallanInput } from '../types';

const INPUT = {
  type: 'delivery',
  partyId: 'p1',
  agreementId: 'a1',
  date: '2026-06-01',
  items: [{ itemId: 'i9', itemName: 'Ledger', quantity: 1 }],
} as unknown as CreateChallanInput;

vi.mock('../components/forms/ChallanForm', () => ({
  ChallanForm: ({ onSubmit }: { onSubmit: (data: CreateChallanInput) => void }) => (
    <button type="button" onClick={() => onSubmit(INPUT)}>
      Submit challan
    </button>
  ),
}));

function useApi() {
  server.use(
    http.get(apiUrl('/businesses'), () => ok([{ _id: 'biz-1', name: 'Patel Scaffold Co.' }])),
    http.get(apiUrl('/businesses/biz-1/challans'), ({ request }) => pagedOk([], request)),
    http.get(apiUrl('/businesses/biz-1/parties'), () => ok([])),
    http.get(apiUrl('/businesses/biz-1/inventory'), () => ok([]))
  );
}

async function openAndSubmit() {
  const view = renderWithProviders(<ChallansPage />, { preloadedState: signedIn() });
  await view.user.click((await screen.findAllByRole('button', { name: /New delivery/ }))[0]);
  await view.user.click(await screen.findByRole('button', { name: 'Submit challan' }));
  return view;
}

describe('ChallansPage create', () => {
  it('previews with a dry run, then creates and closes the modal', async () => {
    useApi();
    const calls: Array<{ dryRun: string | null; body: unknown }> = [];
    server.use(
      http.post(apiUrl('/businesses/biz-1/challans'), async ({ request }) => {
        const dryRun = new URL(request.url).searchParams.get('dryRun');
        calls.push({ dryRun, body: await request.json() });
        return dryRun
          ? ok({
              dryRun: true,
              report: { affected: [], negative: [], requiresReason: false, blocked: null },
            })
          : ok({ _id: 'c9', status: 'draft' });
      })
    );
    await openAndSubmit();

    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0]).toEqual({ dryRun: 'true', body: INPUT });
    expect(calls[1]).toEqual({ dryRun: null, body: INPUT });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('shows the closed-year dialog and keeps the form open when the year is closed', async () => {
    useApi();
    let writes = 0;
    server.use(
      http.post(apiUrl('/businesses/biz-1/challans'), ({ request }) => {
        if (!new URL(request.url).searchParams.get('dryRun')) writes++;
        return HttpResponse.json(
          {
            success: false,
            error: {
              code: 'YEAR_CLOSED',
              message: 'FY 2025-26 is closed for this site',
              details: { fy: '2025-26' },
            },
          },
          { status: 409 }
        );
      })
    );
    const { user } = await openAndSubmit();

    const closed = await screen.findByRole('dialog', { name: 'This year is closed' });
    expect(closed).toHaveTextContent('FY 2025-26 is closed for this site');
    const buttons = within(closed).getAllByRole('button', { name: 'Close' });
    await user.click(buttons[buttons.length - 1]);
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'This year is closed' })).not.toBeInTheDocument()
    );
    expect(screen.getByRole('button', { name: 'Submit challan' })).toBeVisible();
    expect(writes).toBe(0);
  });
});
