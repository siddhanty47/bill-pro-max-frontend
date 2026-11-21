import { describe, expect, it } from 'vitest';
import {
  navFromPage,
  navPosition,
  navStep,
  readRecordNav,
  recordNavState,
  SERVER_ROW_PATH,
  type RecordNav,
  type RecordNavServer,
} from './recordNav';

const server = (page: number, total = 132): RecordNavServer => ({
  source: { list: 'challans', args: { businessId: 'b1', pageSize: 25 } },
  page,
  total,
});

describe('readRecordNav', () => {
  it('returns null for malformed state', () => {
    expect(readRecordNav(undefined, '/a')).toBeNull();
    expect(readRecordNav({}, '/a')).toBeNull();
    expect(readRecordNav({ recordNav: { paths: 'x', index: 0 } }, '/a')).toBeNull();
    expect(readRecordNav({ recordNav: { paths: ['/a', 1], index: 0 } }, '/a')).toBeNull();
    expect(readRecordNav({ recordNav: { paths: ['/a'], index: 'x' } }, '/a')).toBeNull();
    expect(readRecordNav({ recordNav: { paths: ['/a'], index: 0, server: {} } }, '/a')).toBeNull();
    expect(readRecordNav({ recordNav: { paths: ['/a'], index: 0 } }, '/zzz')).toBeNull();
  });
  it('re-derives index from pathname', () => {
    const nav = readRecordNav({ recordNav: { paths: ['/a', '/b', '/c'], index: 0 } }, '/b');
    expect(nav?.index).toBe(1);
  });
  it('compares decoded paths', () => {
    const nav = readRecordNav(
      { recordNav: { paths: ['/agreements/AGR 1/x'], index: 0 } },
      '/agreements/AGR%201/x'
    );
    expect(nav?.index).toBe(0);
  });
  it('keeps a valid server', () => {
    const s = server(2);
    const nav = readRecordNav({ recordNav: { paths: ['/a'], index: 0, server: s } }, '/a');
    expect(nav?.server).toEqual(s);
  });
});

describe('recordNavState / SERVER_ROW_PATH', () => {
  it('wraps nav', () => {
    const nav: RecordNav = { paths: ['/a'], index: 0 };
    expect(recordNavState(nav)).toEqual({ recordNav: nav });
    expect(SERVER_ROW_PATH.challans('1')).toBe('/challans/1');
    expect(SERVER_ROW_PATH.bills('1')).toBe('/bills/1');
  });
});

describe('navPosition', () => {
  it('client', () => {
    expect(navPosition({ paths: ['/a', '/b', '/c'], index: 1 })).toEqual({ current: 2, total: 3 });
  });
  it('server', () => {
    expect(navPosition({ paths: ['/a'], index: 0, server: server(2) })).toEqual({
      current: 26,
      total: 132,
    });
  });
});

describe('navStep client', () => {
  const nav: RecordNav = { paths: ['/a', '/b', '/c'], index: 1 };
  it('steps within list', () => {
    const s = navStep(nav, 1);
    expect(s).toMatchObject({ kind: 'go', to: '/c', nav: { index: 2 } });
    expect(navStep(nav, -1)).toMatchObject({ kind: 'go', to: '/a' });
  });
  it('stops at ends', () => {
    expect(navStep({ ...nav, index: 2 }, 1)).toBeNull();
    expect(navStep({ ...nav, index: 0 }, -1)).toBeNull();
  });
});

describe('navStep server', () => {
  const paths = ['/a', '/b'];
  it('fetches next page at last index', () => {
    expect(navStep({ paths, index: 1, server: server(1) }, 1)).toEqual({
      kind: 'fetch',
      page: 2,
      land: 'first',
    });
  });
  it('null at the very end', () => {
    expect(navStep({ paths, index: 1, server: server(6) }, 1)).toBeNull();
  });
  it('fetches prev page at index 0', () => {
    expect(navStep({ paths, index: 0, server: server(2) }, -1)).toEqual({
      kind: 'fetch',
      page: 1,
      land: 'last',
    });
    expect(navStep({ paths, index: 0, server: server(1) }, -1)).toBeNull();
  });
  it('go keeps server unchanged', () => {
    const s = server(2);
    const r = navStep({ paths, index: 0, server: s }, 1);
    expect(r).toMatchObject({ kind: 'go', to: '/b', nav: { index: 1, server: s } });
  });
});

describe('navFromPage', () => {
  it('null for empty', () => {
    expect(navFromPage(server(1), 2, [], 'first')).toBeNull();
  });
  it('lands first/last and updates page', () => {
    const nav = navFromPage(server(1), 2, ['/a', '/b', '/c'], 'last');
    expect(nav).toMatchObject({ index: 2, server: { page: 2, total: 132 } });
    expect(navFromPage(server(1), 2, ['/a', '/b'], 'first')?.index).toBe(0);
  });
});
