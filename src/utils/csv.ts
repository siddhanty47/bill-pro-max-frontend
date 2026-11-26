/**
 * @fileoverview CSV export: RFC 4180 text with a UTF-8 BOM (so Excel reads ₹ and Indian
 * names), CRLF line endings and a guard against spreadsheet formula injection.
 * Export money as plain numbers (no ₹ or commas) and dates with `csvDate` (`YYYY-MM-DD`).
 */
import { saveBlob } from './download';

export type CsvValue = string | number | null | undefined;

const BOM = '﻿';
const NEEDS_QUOTES = /[",\r\n]/;
const FORMULA_START = /^[=+\-@]/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** One cell. Text starting with `=`, `+`, `-` or `@` gets a leading `'`; numbers stay numbers. */
function cell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return NEEDS_QUOTES.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The CSV text for a header row plus data rows. */
export function toCsv(header: string[], rows: CsvValue[][]): string {
  return BOM + [header, ...rows].map(row => row.map(cell).join(',')).join('\r\n');
}

/** `YYYY-MM-DD` for the local calendar day ('' when missing or invalid). */
export function csvDate(value: string | Date | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'string' && DATE_ONLY.test(value)) return value;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Saves `csv` (from `toCsv`) as a download named `fileName`. */
export function downloadCsv(fileName: string, csv: string): void {
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName);
}
