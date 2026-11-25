import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import { server } from '../test/msw/server';
import { apiUrl } from '../test/msw/handlers';
import { setupStore } from '../store';
import { billApi } from './billApi';
import { challanApi } from './challanApi';
import { shareLinkApi } from './shareLinkApi';
import { statementApi } from './statementApi';

// jsdom has no URL.createObjectURL, so the tests assign stubs; put the originals back.
const { createObjectURL, revokeObjectURL } = URL;
afterEach(() => {
  Object.assign(URL, { createObjectURL, revokeObjectURL });
  vi.restoreAllMocks();
});

/** Stub the object URL + anchor click and record each saved file's name and size. */
function captureSaves() {
  const saved: Array<{ name: string; size: number }> = [];
  Object.assign(URL, {
    createObjectURL: vi.fn((blob: Blob) => {
      saved.push({ name: '', size: blob.size });
      return 'blob:file';
    }),
    revokeObjectURL: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement
  ) {
    saved[saved.length - 1].name = this.download;
  });
  return saved;
}

const pdf = () => new Response('%PDF', { headers: { 'Content-Type': 'application/pdf' } });
const pdfError = () =>
  Response.json({ success: false, error: { message: 'No PDF' } }, { status: 500 });

type Store = ReturnType<typeof setupStore>;

const downloads: Array<{
  name: string;
  path: string;
  run: (store: Store) => Promise<{ data?: unknown; error?: unknown }>;
}> = [
  {
    name: 'bill PDF',
    path: '/businesses/b1/bills/bill1/pdf',
    run: store =>
      store.dispatch(
        billApi.endpoints.downloadBillPdf.initiate({
          businessId: 'b1',
          billId: 'bill1',
          fileName: 'out.pdf',
        })
      ),
  },
  {
    name: 'challan PDF',
    path: '/businesses/b1/challans/c1/pdf',
    run: store =>
      store.dispatch(
        challanApi.endpoints.downloadChallanPdf.initiate({
          businessId: 'b1',
          challanId: 'c1',
          fileName: 'out.pdf',
        })
      ),
  },
  {
    name: 'statement PDF',
    path: '/businesses/b1/parties/p1/statements/pdf',
    run: store =>
      store.dispatch(
        statementApi.endpoints.downloadStatementPdf.initiate({
          businessId: 'b1',
          partyId: 'p1',
          type: 'ledger',
          from: '2026-04-01',
          to: '2026-11-25',
          fileName: 'out.pdf',
        })
      ),
  },
  {
    name: 'portal challan PDF',
    path: '/share/tok/challans/c1/pdf',
    run: store =>
      store.dispatch(
        shareLinkApi.endpoints.downloadPortalChallanPdf.initiate({
          token: 'tok',
          challanId: 'c1',
          fileName: 'out.pdf',
        })
      ),
  },
  {
    name: 'portal bill PDF',
    path: '/share/tok/bills/bill1/pdf',
    run: store =>
      store.dispatch(
        shareLinkApi.endpoints.downloadPortalBillPdf.initiate({
          token: 'tok',
          billId: 'bill1',
          fileName: 'out.pdf',
        })
      ),
  },
  {
    name: 'portal note PDF',
    path: '/share/tok/notes/n1/pdf',
    run: store =>
      store.dispatch(
        shareLinkApi.endpoints.downloadPortalNotePdf.initiate({
          token: 'tok',
          noteId: 'n1',
          fileName: 'out.pdf',
        })
      ),
  },
];

describe.each(downloads)('$name download', ({ path, run }) => {
  it('saves the file under the given name and keeps the Blob out of the store', async () => {
    const store = setupStore();
    server.use(http.get(apiUrl(path), pdf));
    const saved = captureSaves();

    const res = await run(store);

    expect(res.error).toBeUndefined();
    expect(res.data).toBeNull();
    expect(saved).toEqual([{ name: 'out.pdf', size: 4 }]);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:file');
  });

  it('returns the JSON error without saving anything', async () => {
    const store = setupStore();
    server.use(http.get(apiUrl(path), pdfError));
    const saved = captureSaves();

    const res = await run(store);

    expect(res.error).toMatchObject({ status: 500, data: { error: { message: 'No PDF' } } });
    expect(saved).toEqual([]);
  });
});
