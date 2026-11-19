export type PageItem = number | 'gap-start' | 'gap-end';

/** 1 … 4 5 6 … 20 — first, last, current ± 1; a single hidden page is shown instead of "…". */
export function pageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const from = Math.max(2, Math.min(page - 1, pageCount - 4));
  const to = Math.min(pageCount - 1, Math.max(page + 1, 5));
  const items: PageItem[] = [1];
  if (from === 3) items.push(2);
  else if (from > 3) items.push('gap-start');
  for (let p = from; p <= to; p++) items.push(p);
  if (to === pageCount - 2) items.push(pageCount - 1);
  else if (to < pageCount - 2) items.push('gap-end');
  items.push(pageCount);
  return items;
}
