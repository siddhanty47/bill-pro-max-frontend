import { describe, expect, it } from 'vitest';
import { http } from 'msw';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import { setupStore } from '../store';
import { yearCloseApi } from './yearCloseApi';
import { billApi } from './billApi';
import { businessApi } from './businessApi';
import { billNoteApi } from './billNoteApi';

const row = {
  partyId: 'p1',
  partyName: 'Acme',
  partyCode: 'ACM',
  siteCode: 'S1',
  siteAddress: 'Site 1',
  lastBillableDay: '2026-03-31T00:00:00.000Z',
  closed: true,
  closingBillId: 'bill1',
  closingBillNumber: 'B-1',
};

describe('yearCloseApi', () => {
  it('loads the year status rows for an FY', async () => {
    const store = setupStore();
    let search = '';
    server.use(
      http.get(apiUrl('/businesses/b1/year-close'), ({ request }) => {
        search = new URL(request.url).search;
        return ok([row]);
      })
    );
    const res = await store.dispatch(
      yearCloseApi.endpoints.getYearStatus.initiate({ businessId: 'b1', fy: '2025-26' })
    );
    expect(res.data).toEqual([row]);
    expect(new URLSearchParams(search).get('fy')).toBe('2025-26');
  });

  it('unwraps the closedThrough envelope for a site', async () => {
    const store = setupStore();
    const closed = { fy: '2025-26', date: '2026-03-31', lockedThrough: '2026-03-31' };
    let search = '';
    server.use(
      http.get(apiUrl('/businesses/b1/year-close/site'), ({ request }) => {
        search = new URL(request.url).search;
        return ok({ closedThrough: closed });
      })
    );
    const res = await store.dispatch(
      yearCloseApi.endpoints.getSiteClosedThrough.initiate({
        businessId: 'b1',
        partyId: 'p1',
        agreementId: 'a1',
      })
    );
    expect(res.data).toEqual(closed);
    const params = new URLSearchParams(search);
    expect(params.get('partyId')).toBe('p1');
    expect(params.get('agreementId')).toBe('a1');
  });

  it('returns null for a site with no closed year', async () => {
    const store = setupStore();
    server.use(
      http.get(apiUrl('/businesses/b1/year-close/site'), () => ok({ closedThrough: null }))
    );
    const res = await store.dispatch(
      yearCloseApi.endpoints.getSiteClosedThrough.initiate({
        businessId: 'b1',
        partyId: 'p1',
        agreementId: 'a1',
      })
    );
    expect(res.data).toBeNull();
  });

  describe('invalidation', () => {
    let hits = 0;
    const setup = async () => {
      hits = 0;
      const store = setupStore();
      server.use(
        http.get(apiUrl('/businesses/b1/year-close'), () => {
          hits += 1;
          return ok([row]);
        }),
        http.patch(apiUrl('/businesses/b1/bills/bill1/status'), () => ok({ _id: 'bill1' })),
        http.post(apiUrl('/businesses/b1/bills/bill1/send'), () => ok({})),
        http.patch(apiUrl('/businesses/b1'), () => ok({ _id: 'b1' })),
        http.post(apiUrl('/businesses/b1/bill-notes/n1/issue'), () => ok({ _id: 'n1' }))
      );
      const sub = store.dispatch(
        yearCloseApi.endpoints.getYearStatus.initiate({ businessId: 'b1', fy: '2025-26' })
      );
      await sub;
      expect(hits).toBe(1);
      return store;
    };
    const settle = () => new Promise(r => setTimeout(r, 50));

    it('refetches after a bill status change', async () => {
      const store = await setup();
      await store.dispatch(
        billApi.endpoints.updateBillStatus.initiate({
          businessId: 'b1',
          billId: 'bill1',
          status: 'sent',
        })
      );
      await settle();
      expect(hits).toBe(2);
    });

    it('refetches after a bill is sent', async () => {
      const store = await setup();
      await store.dispatch(
        billApi.endpoints.sendBillEmail.initiate({ businessId: 'b1', billId: 'bill1' })
      );
      await settle();
      expect(hits).toBe(2);
    });

    it('refetches after the business is updated', async () => {
      const store = await setup();
      await store.dispatch(
        businessApi.endpoints.updateBusiness.initiate({ businessId: 'b1', data: {} })
      );
      await settle();
      expect(hits).toBe(2);
    });

    it('does not refetch after a note is issued', async () => {
      const store = await setup();
      await store.dispatch(
        billNoteApi.endpoints.issueBillNote.initiate({ businessId: 'b1', noteId: 'n1' })
      );
      await settle();
      expect(hits).toBe(1);
    });
  });
});
