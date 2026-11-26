import { afterEach, describe, expect, it, vi } from 'vitest';
import { csvDate, csvFileName, downloadCsv, toCsv } from './csv';
import * as download from './download';

const BOM = '﻿';

describe('toCsv', () => {
  it('starts with a BOM and joins rows with CRLF', () => {
    expect(toCsv(['Name', 'Amount'], [['Acme', 1200.5]])).toBe(`${BOM}Name,Amount\r\nAcme,1200.5`);
  });

  it('writes empty cells for null and undefined', () => {
    expect(toCsv(['a', 'b', 'c'], [[null, undefined, 0]])).toBe(`${BOM}a,b,c\r\n,,0`);
  });

  it('quotes values with a comma, a quote or a newline and doubles inner quotes', () => {
    const csv = toCsv(['v'], [['a,b'], ['say "hi"'], ['line1\nline2'], ['cr\rhere']]);
    expect(csv).toBe(`${BOM}v\r\n"a,b"\r\n"say ""hi"""\r\n"line1\nline2"\r\n"cr\rhere"`);
  });

  it('prefixes text that a spreadsheet would run as a formula', () => {
    const csv = toCsv(['v'], [['=SUM(A1)'], ['+SUM(1)'], ['-2'], ['@cmd'], ['=a,"b"']]);
    expect(csv).toBe(`${BOM}v\r\n'=SUM(A1)\r\n'+SUM(1)\r\n'-2\r\n'@cmd\r\n"'=a,""b"""`);
  });

  it('leaves phone numbers of + digits and spaces as they are', () => {
    const csv = toCsv(['Phone'], [['+91 98765 43210'], ['+919876543210']]);
    expect(csv).toBe(`${BOM}Phone\r\n+91 98765 43210\r\n+919876543210`);
  });

  it('still prefixes + text that is not digits and spaces only', () => {
    const csv = toCsv(['v'], [['+91-98765-43210'], ['+SUM(1)'], ['+ 91']]);
    expect(csv).toBe(`${BOM}v\r\n'+91-98765-43210\r\n'+SUM(1)\r\n'+ 91`);
  });

  it('prefixes text starting with a tab or a carriage return', () => {
    const csv = toCsv(['v'], [['\t=1'], ['\r=2']]);
    expect(csv).toBe(`${BOM}v\r\n'\t=1\r\n"'\r=2"`);
  });

  it('round-trips a comma, a quote, a newline and a leading = safely', () => {
    const csv = toCsv(['Name'], [['Shah, "Ravi"\n=HYPERLINK()']]);
    expect(csv).toBe(`${BOM}Name\r\n"Shah, ""Ravi""\n=HYPERLINK()"`);
    expect(toCsv(['Name'], [['=1+1']])).toBe(`${BOM}Name\r\n'=1+1`);
  });

  it('leaves numbers, negative ones included, as plain numbers', () => {
    expect(toCsv(['n'], [[-5], [3]])).toBe(`${BOM}n\r\n-5\r\n3`);
  });

  it('guards and quotes header cells too', () => {
    expect(toCsv(['=x', 'a,b'], [])).toBe(`${BOM}'=x,"a,b"`);
  });
});

describe('csvDate', () => {
  it('keeps a date-only string as that day', () => {
    expect(csvDate('2026-04-01')).toBe('2026-04-01');
  });

  it('formats a timestamp or Date as the local calendar day', () => {
    expect(csvDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(csvDate(new Date(2026, 10, 26, 10, 0).toISOString())).toBe('2026-11-26');
  });

  it('keeps a UTC-midnight timestamp on its UTC day, even west of UTC', () => {
    const tz = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      expect(new Date('2026-04-01T00:00:00.000Z').getDate()).toBe(31);
      expect(csvDate('2026-04-01T00:00:00.000Z')).toBe('2026-04-01');
      expect(csvDate(new Date('2026-04-01T00:00:00.000Z'))).toBe('2026-04-01');
      expect(csvDate('2026-04-01T15:00:00.000Z')).toBe('2026-04-01');
      expect(csvDate('2026-04-01T02:00:00.000Z')).toBe('2026-03-31');
    } finally {
      process.env.TZ = tz;
    }
  });

  it('is empty for missing or invalid values', () => {
    expect(csvDate(null)).toBe('');
    expect(csvDate(undefined)).toBe('');
    expect(csvDate('')).toBe('');
    expect(csvDate('not a date')).toBe('');
  });
});

describe('csvFileName', () => {
  it("names the file by prefix and today's day", () => {
    expect(csvFileName('payments', new Date(2026, 10, 26, 10, 0))).toBe('payments-2026-11-26.csv');
    expect(csvFileName('parties')).toMatch(/^parties-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});

describe('downloadCsv', () => {
  afterEach(() => vi.restoreAllMocks());

  it('saves the text as a UTF-8 CSV file', async () => {
    const save = vi.spyOn(download, 'saveBlob').mockImplementation(() => {});
    downloadCsv('payments-2026-11-26.csv', `${BOM}a\r\n1`);
    expect(save).toHaveBeenCalledTimes(1);
    const [blob, name] = save.mock.calls[0];
    expect(name).toBe('payments-2026-11-26.csv');
    expect(blob.type).toBe('text/csv;charset=utf-8');
    // Raw bytes: `text()` would decode away the BOM.
    const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
    expect(bytes).toEqual([0xef, 0xbb, 0xbf, 0x61, 0x0d, 0x0a, 0x31]);
  });
});
