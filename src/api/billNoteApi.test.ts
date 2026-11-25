import { describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { server } from '../test/msw/server';
import { apiUrl, ok, pagedOk } from '../test/msw/handlers';
import { setupStore } from '../store';
import { billNoteApi } from './billNoteApi';
import { billApi } from './billApi';
import { shareLinkApi } from './shareLinkApi';

const note = { _id: 'n1', type: 'credit', status: 'draft', totalAmount: 100 };

describe('billNoteApi', () => {
  it('lists notes with only the non-empty filters and unwraps the page', async () => {
    const store = setupStore();
    let search = '';
    server.use(
      http.get(apiUrl('/businesses/b1/bill-notes'), ({ request }) => {
        search = new URL(request.url).search;
        return Response.json({
          success: true,
          data: [note],
          pagination: { page: 2, pageSize: 10, total: 11, totalPages: 2 },
        });
      })
    );
    const res = await store.dispatch(
      billNoteApi.endpoints.getBillNotes.initiate({
        businessId: 'b1',
        page: 2,
        pageSize: 10,
        status: 'draft',
        type: undefined,
        billId: 'bill1',
      })
    );
    expect(res.data).toEqual({ rows: [note], page: 2, pageSize: 10, total: 11 });
    const params = new URLSearchParams(search);
    expect(params.get('status')).toBe('draft');
    expect(params.get('billId')).toBe('bill1');
    expect(params.has('type')).toBe(false);
  });

  it('loads every page of notes with only the non-empty filters', async () => {
    const store = setupStore();
    const rows = Array.from({ length: 150 }, (_, i) => ({ ...note, _id: `n${i}` }));
    const seen: URLSearchParams[] = [];
    server.use(
      http.get(apiUrl('/businesses/b1/bill-notes'), ({ request }) => {
        seen.push(new URL(request.url).searchParams);
        return pagedOk(rows, request);
      })
    );
    const res = await store.dispatch(
      billNoteApi.endpoints.getAllBillNotes.initiate({
        businessId: 'b1',
        status: 'issued',
        type: undefined,
      })
    );
    expect(res.data).toHaveLength(150);
    expect(seen.map(q => q.get('page'))).toEqual(['1', '2']);
    expect(seen[0].get('status')).toBe('issued');
    expect(seen[0].has('type')).toBe(false);
  });

  it('loads all notes with no filters', async () => {
    const store = setupStore();
    let search = 'unset';
    server.use(
      http.get(apiUrl('/businesses/b1/bill-notes'), ({ request }) => {
        search = new URL(request.url).search;
        return pagedOk([note], request);
      })
    );
    const res = await store.dispatch(
      billNoteApi.endpoints.getAllBillNotes.initiate({ businessId: 'b1' })
    );
    expect(res.data).toEqual([note]);
    expect(search).toBe('?page=1&pageSize=100');
  });

  it('gets one note', async () => {
    const store = setupStore();
    server.use(http.get(apiUrl('/businesses/b1/bill-notes/n1'), () => ok(note)));
    const res = await store.dispatch(
      billNoteApi.endpoints.getBillNote.initiate({ businessId: 'b1', noteId: 'n1' })
    );
    expect(res.data).toEqual(note);
  });

  it('creates and updates with the right method and body', async () => {
    const store = setupStore();
    const seen: Array<{ method: string; body: unknown }> = [];
    server.use(
      http.post(apiUrl('/businesses/b1/bill-notes'), async ({ request }) => {
        seen.push({ method: 'POST', body: await request.json() });
        return ok(note);
      }),
      http.patch(apiUrl('/businesses/b1/bill-notes/n1'), async ({ request }) => {
        seen.push({ method: 'PATCH', body: await request.json() });
        return ok(note);
      })
    );
    const data = { billId: 'bill1', type: 'credit' as const, reason: 'Rate fix', fullValue: true };
    await store.dispatch(billNoteApi.endpoints.createBillNote.initiate({ businessId: 'b1', data }));
    await store.dispatch(
      billNoteApi.endpoints.updateBillNote.initiate({
        businessId: 'b1',
        noteId: 'n1',
        data: { reason: 'New' },
      })
    );
    expect(seen).toEqual([
      { method: 'POST', body: data },
      { method: 'PATCH', body: { reason: 'New' } },
    ]);
  });

  it('issue and cancel POST to their routes and refetch bills, notes and nav counts', async () => {
    const store = setupStore();
    const posts: string[] = [];
    let billGets = 0;
    let noteGets = 0;
    let navGets = 0;
    server.use(
      http.get(apiUrl('/businesses/b1/bills/bill1'), () => {
        billGets += 1;
        return ok({ _id: 'bill1' });
      }),
      http.get(apiUrl('/businesses/b1/bill-notes/n1'), () => {
        noteGets += 1;
        return ok(note);
      }),
      http.get(apiUrl('/businesses/b1/dashboard/nav-counts'), () => {
        navGets += 1;
        return ok({ draftNotes: 1 });
      }),
      http.post(apiUrl('/businesses/b1/bill-notes/n1/issue'), ({ request }) => {
        posts.push(new URL(request.url).pathname);
        return ok(note);
      }),
      http.post(apiUrl('/businesses/b1/bill-notes/n1/cancel'), ({ request }) => {
        posts.push(new URL(request.url).pathname);
        return ok(note);
      })
    );
    const subs = [
      store.dispatch(billApi.endpoints.getBill.initiate({ businessId: 'b1', billId: 'bill1' })),
      store.dispatch(
        billNoteApi.endpoints.getBillNote.initiate({ businessId: 'b1', noteId: 'n1' })
      ),
      store.dispatch(
        (await import('./dashboardApi')).dashboardApi.endpoints.getNavCounts.initiate('b1')
      ),
    ];
    await Promise.all(subs);
    await store.dispatch(
      billNoteApi.endpoints.issueBillNote.initiate({ businessId: 'b1', noteId: 'n1' })
    );
    await new Promise(r => setTimeout(r, 50));
    expect([billGets, noteGets, navGets]).toEqual([2, 2, 2]);
    await store.dispatch(
      billNoteApi.endpoints.cancelBillNote.initiate({ businessId: 'b1', noteId: 'n1' })
    );
    await new Promise(r => setTimeout(r, 50));
    expect([billGets, noteGets, navGets]).toEqual([3, 3, 3]);
    expect(posts.map(p => p.split('/').pop())).toEqual(['issue', 'cancel']);
    subs.forEach(s => s.unsubscribe());
  });

  it('sends a note email', async () => {
    const store = setupStore();
    let called = false;
    server.use(
      http.post(apiUrl('/businesses/b1/bill-notes/n1/send'), () => {
        called = true;
        return ok(null);
      })
    );
    const res = await store.dispatch(
      billNoteApi.endpoints.sendBillNote.initiate({ businessId: 'b1', noteId: 'n1' })
    );
    expect('error' in res).toBe(false);
    expect(called).toBe(true);
  });

  it('saves the note PDF under the given name and keeps no Blob in the store', async () => {
    const store = setupStore();
    server.use(
      http.get(
        apiUrl('/businesses/b1/bill-notes/n1/pdf'),
        () => new Response('%PDF', { headers: { 'Content-Type': 'application/pdf' } })
      )
    );
    const saved: Array<{ name: string; size: number }> = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      saved.push({ name: '', size: blob.size });
      return 'blob:note';
    });
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      saved[saved.length - 1].name = this.download;
    });

    const res = await store.dispatch(
      billNoteApi.endpoints.downloadBillNotePdf.initiate({
        businessId: 'b1',
        noteId: 'n1',
        fileName: 'note-CN-2026-27-0001.pdf',
      })
    );
    expect('error' in res).toBe(false);
    expect(res.data).toBeNull();
    expect(saved).toEqual([{ name: 'note-CN-2026-27-0001.pdf', size: 4 }]);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:note');
    click.mockRestore();
  });

  it('returns the PDF error without saving anything', async () => {
    const store = setupStore();
    server.use(
      http.get(apiUrl('/businesses/b1/bill-notes/n1/pdf'), () =>
        Response.json({ success: false, error: { message: 'No PDF' } }, { status: 500 })
      )
    );
    const createObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const res = await store.dispatch(
      billNoteApi.endpoints.downloadBillNotePdf.initiate({
        businessId: 'b1',
        noteId: 'n1',
        fileName: 'x.pdf',
      })
    );
    expect('error' in res && res.error).toMatchObject({
      status: 500,
      data: { error: { message: 'No PDF' } },
    });
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe('portal notes', () => {
  it('lists portal notes and downloads a portal note PDF', async () => {
    const store = setupStore();
    let search = '';
    server.use(
      http.get(apiUrl('/share/tok/notes'), ({ request }) => {
        search = new URL(request.url).search;
        return Response.json({
          success: true,
          data: [{ _id: 'n1', noteNumber: 'CN/2026-27/0001', type: 'credit' }],
          pagination: { page: 1, pageSize: 5, total: 1, totalPages: 1 },
        });
      }),
      http.get(
        apiUrl('/share/tok/notes/n1/pdf'),
        () => new Response('%PDF', { headers: { 'Content-Type': 'application/pdf' } })
      )
    );
    const list = await store.dispatch(
      shareLinkApi.endpoints.getPortalNotes.initiate({ token: 'tok', pageSize: 5 })
    );
    expect(list.data?.data[0]._id).toBe('n1');
    expect(search).toBe('?pageSize=5');
    const pdf = await store.dispatch(
      shareLinkApi.endpoints.getPortalNotePdf.initiate({ token: 'tok', noteId: 'n1' })
    );
    expect(pdf.data).toMatchObject({ size: 4, type: 'application/pdf' });
  });
});
