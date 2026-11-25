import { describe, expect, it } from 'vitest';
import { http } from 'msw';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import { setupStore } from '../store';
import { billApi } from './billApi';
import { challanApi } from './challanApi';
import { agreementApi } from './agreementApi';
import { partyApi } from './partyApi';
import { billNoteApi } from './billNoteApi';
import { isDryRunResult } from './changeGate';
import { getApiError, hasApiErrorCode } from '../utils/apiError';
import type { GateReport } from '../types';

const report: GateReport = {
  affected: [{ billId: 'bill1', billNumber: 'B-1', status: 'sent', issued: true }],
  negative: [],
  requiresReason: true,
  blocked: null,
};

describe('bill integrity API', () => {
  it('refreshes a bill with POST /refresh and refetches the bill', async () => {
    const store = setupStore();
    let gets = 0;
    let posted = '';
    server.use(
      http.get(apiUrl('/businesses/b1/bills/bill1'), () => {
        gets += 1;
        return ok({ _id: 'bill1', drift: gets === 1 ? { causes: [] } : null });
      }),
      http.post(apiUrl('/businesses/b1/bills/bill1/refresh'), ({ request }) => {
        posted = new URL(request.url).pathname;
        return ok({ _id: 'bill1', drift: null });
      })
    );
    const sub = store.dispatch(
      billApi.endpoints.getBill.initiate({ businessId: 'b1', billId: 'bill1' })
    );
    await sub;
    const res = await store.dispatch(
      billApi.endpoints.refreshBill.initiate({ businessId: 'b1', billId: 'bill1' })
    );
    expect('data' in res && res.data).toMatchObject({ _id: 'bill1', drift: null });
    expect(posted).toMatch(/bills\/bill1\/refresh$/);
    await new Promise(r => setTimeout(r, 50));
    expect(gets).toBe(2);
    sub.unsubscribe();
  });

  it('sends ?dryRun=true and returns the typed report without extra body fields', async () => {
    const store = setupStore();
    let query = '';
    let body: unknown;
    server.use(
      http.patch(apiUrl('/businesses/b1/challans/c1/date'), async ({ request }) => {
        query = new URL(request.url).search;
        body = await request.json();
        return ok({ dryRun: true, report });
      })
    );
    const res = await store.dispatch(
      challanApi.endpoints.updateChallanDate.initiate({
        businessId: 'b1',
        challanId: 'c1',
        date: '2026-01-05',
        dryRun: true,
      })
    );
    const data = 'data' in res ? res.data : undefined;
    expect(query).toBe('?dryRun=true');
    expect(body).toEqual({ date: '2026-01-05' });
    expect(isDryRunResult(data)).toBe(true);
    if (isDryRunResult(data)) expect(data.report.requiresReason).toBe(true);
  });

  it('sends reason and confirmNegative in the body, no dryRun query on a real write', async () => {
    const store = setupStore();
    let query = 'unset';
    let body: unknown;
    server.use(
      http.patch(apiUrl('/businesses/b1/agreements/a1'), async ({ request }) => {
        query = new URL(request.url).search;
        body = await request.json();
        return ok({ _id: 'a1' });
      })
    );
    const res = await store.dispatch(
      agreementApi.endpoints.updateAgreement.initiate({
        businessId: 'b1',
        agreementId: 'a1',
        data: { notes: 'x' } as never,
        reason: 'rate fix',
        confirmNegative: true,
      })
    );
    expect('data' in res && isDryRunResult(res.data)).toBe(false);
    expect(query).toBe('');
    expect(body).toEqual({ notes: 'x', reason: 'rate fix', confirmNegative: true });
  });

  it('supports dryRun on challan item, agreement rate and create-agreement writes', async () => {
    const store = setupStore();
    const seen: string[] = [];
    const record = ({ request }: { request: Request }) => {
      seen.push(`${request.method} ${new URL(request.url).pathname}${new URL(request.url).search}`);
      return ok({ dryRun: true, report });
    };
    server.use(
      http.post(apiUrl('/businesses/b1/challans/c1/confirm'), record),
      http.delete(apiUrl('/businesses/b1/challans/c1/items/i1'), record),
      http.post(apiUrl('/businesses/b1/agreements/a1/change-rates'), record),
      http.post(apiUrl('/businesses/b1/parties/p1/agreements'), record)
    );
    await store.dispatch(
      challanApi.endpoints.confirmChallan.initiate({
        businessId: 'b1',
        challanId: 'c1',
        confirmedBy: 'me',
        dryRun: true,
      })
    );
    await store.dispatch(
      challanApi.endpoints.deleteChallanItem.initiate({
        businessId: 'b1',
        challanId: 'c1',
        itemId: 'i1',
        dryRun: true,
      })
    );
    await store.dispatch(
      agreementApi.endpoints.changeAgreementRates.initiate({
        businessId: 'b1',
        agreementId: 'a1',
        data: {} as never,
        dryRun: true,
      })
    );
    await store.dispatch(
      partyApi.endpoints.createAgreement.initiate({
        businessId: 'b1',
        partyId: 'p1',
        data: {} as never,
        dryRun: true,
      })
    );
    expect(seen).toEqual([
      expect.stringMatching(/POST .*\/c1\/confirm\?dryRun=true$/),
      expect.stringMatching(/DELETE .*\/items\/i1\?dryRun=true$/),
      expect.stringMatching(/POST .*\/change-rates\?dryRun=true$/),
      expect.stringMatching(/POST .*\/p1\/agreements\?dryRun=true$/),
    ]);
  });

  it('sends acknowledgeNegative on status change and send, and none on delete', async () => {
    const store = setupStore();
    const bodies: Record<string, unknown> = {};
    let deleteUrl = '';
    server.use(
      http.patch(apiUrl('/businesses/b1/bills/bill1/status'), async ({ request }) => {
        bodies.status = await request.json();
        return ok({ _id: 'bill1' });
      }),
      http.post(apiUrl('/businesses/b1/bills/bill1/send'), async ({ request }) => {
        bodies.send = await request.json();
        return ok({});
      }),
      http.delete(apiUrl('/businesses/b1/bills/bill1'), ({ request }) => {
        deleteUrl = request.url;
        return ok({});
      })
    );
    await store.dispatch(
      billApi.endpoints.updateBillStatus.initiate({
        businessId: 'b1',
        billId: 'bill1',
        status: 'sent',
        acknowledgeNegative: true,
      })
    );
    await store.dispatch(
      billApi.endpoints.sendBillEmail.initiate({
        businessId: 'b1',
        billId: 'bill1',
        acknowledgeNegative: true,
      })
    );
    await store.dispatch(
      billApi.endpoints.deleteBill.initiate({ businessId: 'b1', billId: 'bill1' })
    );
    expect(bodies.status).toEqual({ status: 'sent', acknowledgeNegative: true });
    expect(bodies.send).toEqual({ acknowledgeNegative: true });
    expect(deleteUrl).not.toContain('force');
  });
});

describe('gated mutation invalidation', () => {
  it('a dry run leaves a subscribed bill alone, a real write and an agreement edit refetch it', async () => {
    const store = setupStore();
    let gets = 0;
    server.use(
      http.get(apiUrl('/businesses/b1/bills/bill1'), () => {
        gets += 1;
        return ok({ _id: 'bill1' });
      }),
      http.patch(apiUrl('/businesses/b1/challans/c1/date'), ({ request }) =>
        new URL(request.url).searchParams.get('dryRun')
          ? ok({ dryRun: true, report })
          : ok({ _id: 'c1' })
      ),
      http.patch(apiUrl('/businesses/b1/agreements/a1'), () => ok({ _id: 'a1' })),
      http.post(apiUrl('/businesses/b1/agreements/a1/rates'), () => ok({ _id: 'a1' })),
      http.patch(apiUrl('/businesses/b1/agreements/a1/rates/i1'), () => ok({ _id: 'a1' }))
    );
    const sub = store.dispatch(
      billApi.endpoints.getBill.initiate({ businessId: 'b1', billId: 'bill1' })
    );
    await sub;
    const settle = () => new Promise(r => setTimeout(r, 60));
    const date = { businessId: 'b1', challanId: 'c1', date: '2026-01-05' };

    await store.dispatch(
      challanApi.endpoints.updateChallanDate.initiate({ ...date, dryRun: true })
    );
    await settle();
    expect(gets).toBe(1);

    await store.dispatch(challanApi.endpoints.updateChallanDate.initiate(date));
    await settle();
    expect(gets).toBe(2);

    const ag = { businessId: 'b1', agreementId: 'a1' };
    await store.dispatch(
      agreementApi.endpoints.updateAgreement.initiate({ ...ag, data: {} as never })
    );
    await settle();
    expect(gets).toBe(3);
    await store.dispatch(
      agreementApi.endpoints.addAgreementRate.initiate({ ...ag, data: {} as never })
    );
    await settle();
    expect(gets).toBe(4);
    await store.dispatch(
      agreementApi.endpoints.updateAgreementRate.initiate({
        ...ag,
        itemId: 'i1',
        data: {} as never,
      })
    );
    await settle();
    expect(gets).toBe(5);
    sub.unsubscribe();
  });
});

describe('gated mutations refetch bill notes', () => {
  it('a challan, agreement and party agreement write refetch a subscribed note; dry runs do not', async () => {
    const store = setupStore();
    let gets = 0;
    const gated = ({ request }: { request: Request }) =>
      new URL(request.url).searchParams.get('dryRun')
        ? ok({ dryRun: true, report })
        : ok({ _id: 'x' });
    server.use(
      http.get(apiUrl('/businesses/b1/bill-notes/n1'), () => {
        gets += 1;
        return ok({ _id: 'n1' });
      }),
      http.patch(apiUrl('/businesses/b1/challans/c1/date'), gated),
      http.patch(apiUrl('/businesses/b1/agreements/a1'), gated),
      http.post(apiUrl('/businesses/b1/parties/p1/agreements'), gated)
    );
    const sub = store.dispatch(
      billNoteApi.endpoints.getBillNote.initiate({ businessId: 'b1', noteId: 'n1' })
    );
    await sub;
    const settle = () => new Promise(r => setTimeout(r, 60));
    const challan = { businessId: 'b1', challanId: 'c1', date: '2026-01-05' };
    const agreement = { businessId: 'b1', agreementId: 'a1', data: {} as never };
    const party = { businessId: 'b1', partyId: 'p1', data: {} as never };

    await store.dispatch(
      challanApi.endpoints.updateChallanDate.initiate({ ...challan, dryRun: true })
    );
    await store.dispatch(
      agreementApi.endpoints.updateAgreement.initiate({ ...agreement, dryRun: true })
    );
    await store.dispatch(partyApi.endpoints.createAgreement.initiate({ ...party, dryRun: true }));
    await settle();
    expect(gets).toBe(1);

    await store.dispatch(challanApi.endpoints.updateChallanDate.initiate(challan));
    await settle();
    expect(gets).toBe(2);
    await store.dispatch(agreementApi.endpoints.updateAgreement.initiate(agreement));
    await settle();
    expect(gets).toBe(3);
    await store.dispatch(partyApi.endpoints.createAgreement.initiate(party));
    await settle();
    expect(gets).toBe(4);
    sub.unsubscribe();
  });
});

describe('getApiError', () => {
  it('reads code and details from a backend error response', async () => {
    const store = setupStore();
    server.use(
      http.post(apiUrl('/businesses/b1/bills/bill1/refresh'), () =>
        Response.json(
          {
            success: false,
            error: {
              code: 'NEGATIVE_STOCK_ACK_REQUIRED',
              message: 'ack',
              details: { negativeStock: [{ itemId: 'i1' }] },
            },
          },
          { status: 409 }
        )
      )
    );
    const res = await store.dispatch(
      billApi.endpoints.refreshBill.initiate({ businessId: 'b1', billId: 'bill1' })
    );
    const error = 'error' in res ? res.error : undefined;
    expect(getApiError(error)).toMatchObject({
      status: 409,
      code: 'NEGATIVE_STOCK_ACK_REQUIRED',
      message: 'ack',
      details: { negativeStock: [{ itemId: 'i1' }] },
    });
    expect(hasApiErrorCode(error, 'NEGATIVE_STOCK_ACK_REQUIRED')).toBe(true);
    expect(hasApiErrorCode(error, 'OTHER')).toBe(false);
  });

  it('handles flat bodies and non-error values', () => {
    expect(getApiError({ status: 400, data: { code: 'REASON_REQUIRED' } }).code).toBe(
      'REASON_REQUIRED'
    );
    expect(getApiError(null)).toEqual({});
    expect(getApiError({ status: 'FETCH_ERROR', error: 'x' })).toEqual({
      status: 'FETCH_ERROR',
      code: undefined,
      message: undefined,
      details: undefined,
    });
  });
});
