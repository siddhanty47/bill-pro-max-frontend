import type { ListPageArgs } from '../types';

export type ServerListSource =
  | { list: 'challans'; args: Omit<ListPageArgs, 'page'> & { type?: string } }
  | { list: 'bills'; args: Omit<ListPageArgs, 'page'> };

export interface RecordNavServer {
  source: ServerListSource;
  page: number;
  total: number;
}

export interface RecordNav {
  paths: string[];
  index: number;
  server?: RecordNavServer;
}

export type RecordNavLocationState = { recordNav: RecordNav };

export const SERVER_ROW_PATH: Record<ServerListSource['list'], (id: string) => string> = {
  challans: id => `/challans/${id}`,
  bills: id => `/bills/${id}`,
};

export function recordNavState(nav: RecordNav): RecordNavLocationState {
  return { recordNav: nav };
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isServer(v: unknown): v is RecordNavServer {
  if (!isRecord(v)) return false;
  const { source, page, total } = v;
  if (typeof page !== 'number' || typeof total !== 'number') return false;
  if (!isRecord(source) || (source.list !== 'challans' && source.list !== 'bills')) return false;
  const args = source.args;
  return isRecord(args) && typeof args.pageSize === 'number';
}

export function readRecordNav(state: unknown, pathname: string): RecordNav | null {
  if (!isRecord(state) || !isRecord(state.recordNav)) return null;
  const { paths, index, server } = state.recordNav;
  if (!Array.isArray(paths) || !paths.every(p => typeof p === 'string')) return null;
  if (typeof index !== 'number') return null;
  if (server !== undefined && !isServer(server)) return null;
  const target = safeDecode(pathname);
  const found = (paths as string[]).findIndex(p => safeDecode(p) === target);
  if (found < 0) return null;
  return server === undefined
    ? { paths: paths as string[], index: found }
    : { paths: paths as string[], index: found, server };
}

export function navPosition(nav: RecordNav): { current: number; total: number } {
  if (nav.server) {
    const { page, source, total } = nav.server;
    return { current: (page - 1) * source.args.pageSize + nav.index + 1, total };
  }
  return { current: nav.index + 1, total: nav.paths.length };
}

export type NavStep =
  | { kind: 'go'; to: string; nav: RecordNav }
  | { kind: 'fetch'; page: number; land: 'first' | 'last' }
  | null;

export function navStep(nav: RecordNav, dir: -1 | 1): NavStep {
  const next = nav.index + dir;
  if (next >= 0 && next < nav.paths.length) {
    return { kind: 'go', to: nav.paths[next], nav: { ...nav, index: next } };
  }
  const { server } = nav;
  if (!server) return null;
  if (dir === 1) {
    return server.page * server.source.args.pageSize < server.total
      ? { kind: 'fetch', page: server.page + 1, land: 'first' }
      : null;
  }
  return server.page > 1 ? { kind: 'fetch', page: server.page - 1, land: 'last' } : null;
}

export function navFromPage(
  server: RecordNavServer,
  page: number,
  paths: string[],
  land: 'first' | 'last'
): RecordNav | null {
  if (paths.length === 0) return null;
  return {
    paths,
    index: land === 'first' ? 0 : paths.length - 1,
    server: { ...server, page },
  };
}
