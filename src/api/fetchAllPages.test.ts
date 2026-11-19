import { describe, expect, it, vi } from 'vitest';
import { fetchAllPages } from './fetchAllPages';
import { listParams, toPagedList } from './listPage';

const pageOf = (rows: number[], page: number, totalPages: number) => ({
  data: {
    success: true,
    data: rows,
    pagination: {
      page,
      pageSize: 100,
      total: 0,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  },
});

describe('fetchAllPages', () => {
  it('requests every page at the maximum size and joins the rows', async () => {
    const baseQuery = vi.fn(async (arg: unknown) => {
      const page = Number(new URLSearchParams(String(arg).split('?')[1]).get('page'));
      return pageOf([page * 10, page * 10 + 1], page, 3);
    });

    const result = await fetchAllPages<number>('/businesses/b/parties', baseQuery as never);

    expect(result).toEqual({ data: [10, 11, 20, 21, 30, 31] });
    expect(baseQuery.mock.calls.map(c => c[0])).toEqual([
      '/businesses/b/parties?page=1&pageSize=100',
      '/businesses/b/parties?page=2&pageSize=100',
      '/businesses/b/parties?page=3&pageSize=100',
    ]);
  });

  it('appends to an existing query string', async () => {
    const baseQuery = vi.fn(async () => pageOf([1], 1, 1));
    await fetchAllPages<number>('/bills?partyId=p1', baseQuery as never);
    expect(baseQuery).toHaveBeenCalledWith('/bills?partyId=p1&page=1&pageSize=100');
  });

  it('stops after one page when the response has no pagination', async () => {
    const baseQuery = vi.fn(async () => ({ data: { success: true, data: [1, 2] } }));
    expect(await fetchAllPages<number>('/x', baseQuery as never)).toEqual({ data: [1, 2] });
    expect(baseQuery).toHaveBeenCalledTimes(1);
  });

  it('returns the first error', async () => {
    const error = { status: 500, data: 'down' };
    const baseQuery = vi.fn(async () => ({ error }));
    expect(await fetchAllPages<number>('/x', baseQuery as never)).toEqual({ error });
  });
});

describe('listPage helpers', () => {
  it('drops empty filters from the params', () => {
    expect(
      listParams({ page: 1, pageSize: 25, search: '', status: undefined, type: 'return' })
    ).toEqual({
      page: 1,
      pageSize: 25,
      type: 'return',
    });
  });

  it('maps the backend envelope to a paged list, tolerating a missing pagination block', () => {
    expect(
      toPagedList({
        success: true,
        message: '',
        timestamp: '',
        data: ['a'],
        pagination: {
          page: 2,
          pageSize: 25,
          total: 26,
          totalPages: 2,
          hasNext: false,
          hasPrev: true,
        },
      })
    ).toEqual({ rows: ['a'], page: 2, pageSize: 25, total: 26 });
    expect(toPagedList({ data: ['a', 'b'] } as never)).toEqual({
      rows: ['a', 'b'],
      page: 1,
      pageSize: 2,
      total: 2,
    });
  });
});
