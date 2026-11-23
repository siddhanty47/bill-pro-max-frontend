import { describe, expect, it } from 'vitest';
import { http } from 'msw';
import { server } from '../test/msw/server';
import { apiUrl, ok } from '../test/msw/handlers';
import { setupStore } from '../store';
import { dashboardApi } from './dashboardApi';
import { paymentApi } from './paymentApi';

describe('dashboardApi', () => {
  it('unwraps nav-counts, summary and series from the response envelope', async () => {
    const store = setupStore();
    server.use(
      http.get(apiUrl('/businesses/b1/dashboard/nav-counts'), () => ok({ inventory: 4 })),
      http.get(apiUrl('/businesses/b1/dashboard/summary'), () => ok({ activeSites: 2 })),
      http.get(apiUrl('/businesses/b1/dashboard/series'), ({ request }) =>
        ok({
          metric: 'steel',
          range: new URL(request.url).searchParams.get('range'),
          bucket: 'month',
          points: [],
        })
      )
    );

    const nav = await store.dispatch(dashboardApi.endpoints.getNavCounts.initiate('b1'));
    const summary = await store.dispatch(dashboardApi.endpoints.getDashboardSummary.initiate('b1'));
    const series = await store.dispatch(
      dashboardApi.endpoints.getDashboardSeries.initiate({
        businessId: 'b1',
        metric: 'steel',
        range: '3Y',
      })
    );

    expect(nav.data).toEqual({ inventory: 4 });
    expect(summary.data).toEqual({ activeSites: 2 });
    expect(series.data).toMatchObject({ metric: 'steel', range: '3Y' });
  });

  it('refetches nav-counts after a payment is created', async () => {
    const store = setupStore();
    let navRequests = 0;
    server.use(
      http.get(apiUrl('/businesses/b1/dashboard/nav-counts'), () => {
        navRequests += 1;
        return ok({ overdueBills: navRequests });
      }),
      http.post(apiUrl('/businesses/b1/payments'), () => ok({ _id: 'p1' }))
    );

    const sub = store.dispatch(dashboardApi.endpoints.getNavCounts.initiate('b1'));
    await sub;
    expect(navRequests).toBe(1);

    await store.dispatch(
      paymentApi.endpoints.createPayment.initiate({ businessId: 'b1', data: {} as never })
    );

    await expect.poll(() => navRequests).toBe(2);
    sub.unsubscribe();
  });
});
