import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { PaymentsPage } from './PaymentsPage';
import { renderWithProviders, signedIn } from '../test/render';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import type { Bill, CreatePaymentInput } from '../types';

// The form is covered by its own tests; here it only hands a payment to the page.
vi.mock('../components/forms/PaymentForm', () => ({
  PaymentForm: ({ onSubmit }: { onSubmit: (d: CreatePaymentInput) => Promise<void> }) => (
    <button
      onClick={() =>
        onSubmit({
          type: 'receivable',
          partyId: 'p1',
          billId: 'b1',
          amount: 100,
          method: 'cash',
          date: '2026-05-01',
        })
      }
    >
      Submit payment
    </button>
  ),
}));

const span = {
  itemId: 'i1',
  itemName: 'Prop',
  from: '2026-04-02T00:00:00.000Z',
  to: '2026-04-05T00:00:00.000Z',
  minQty: -3,
};

function useApi(bill: Partial<Bill>) {
  const bodies: Record<string, unknown>[] = [];
  server.use(
    http.get(apiUrl('/businesses'), () => ok([{ _id: 'biz-1', name: 'Patel Scaffold Co.' }])),
    http.get(apiUrl('/businesses/biz-1/payments'), () => ok([])),
    http.get(apiUrl('/businesses/biz-1/parties'), () => ok([])),
    http.get(apiUrl('/businesses/biz-1/bills'), () =>
      ok([{ _id: 'b1', billNumber: 'B-1', partyId: 'p1', status: 'draft', ...bill }])
    ),
    http.post(apiUrl('/businesses/biz-1/payments'), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      bodies.push(body);
      if (!body.acknowledgeNegative && (bill.negativeStock?.length ?? 0) > 0) {
        return HttpResponse.json(
          {
            success: false,
            error: { code: 'NEGATIVE_STOCK_ACK_REQUIRED', message: 'ack', details: {} },
          },
          { status: 409 }
        );
      }
      return ok({ _id: 'pay1', ...body });
    })
  );
  return bodies;
}

async function submit() {
  const { user } = renderWithProviders(<PaymentsPage />, { preloadedState: signedIn() });
  await user.click((await screen.findAllByRole('button', { name: /record payment/i }))[0]);
  await user.click(await screen.findByRole('button', { name: 'Submit payment' }));
  return user;
}

describe('PaymentsPage paying a draft bill', () => {
  it('asks about negative stock first and sends the ack once confirmed', async () => {
    const bodies = useApi({ negativeStock: [span] as never });
    const user = await submit();

    expect(await screen.findByRole('dialog', { name: 'Stock went below zero' })).toBeVisible();
    expect(screen.getByText(/Recording a payment sends the bill/)).toBeVisible();
    expect(bodies).toHaveLength(0);

    await user.click(screen.getByRole('button', { name: 'Record payment anyway' }));
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatchObject({ billId: 'b1', acknowledgeNegative: true });
  });

  it('blocks an out-of-date draft with a refresh prompt', async () => {
    const bodies = useApi({ drift: { delta: 10, causes: [] } as never });
    await submit();

    expect(await screen.findByRole('dialog', { name: 'Bill is out of date' })).toBeVisible();
    expect(bodies).toHaveLength(0);
  });

  it('records a payment on a clean draft without asking', async () => {
    const bodies = useApi({});
    await submit();

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).not.toHaveProperty('acknowledgeNegative');
  });
});
