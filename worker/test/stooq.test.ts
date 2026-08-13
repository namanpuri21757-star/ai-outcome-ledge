import { describe, expect, it } from 'vitest';
import { StooqError, parseStooqCsv, stooqUrl } from '../src/stooq';

const csv = `Date,Open,High,Low,Close,Volume
2025-01-02,100.0,101.5,99.5,101.0,1000
2025-01-03,101.0,102.0,100.5,100.25,1200
2025-01-06,100.25,100.9,99.0,99.5,900`;

describe('stooqUrl', () => {
  it('builds the daily CSV endpoint', () => {
    expect(stooqUrl('ibm.us')).toBe('https://stooq.com/q/d/l/?s=ibm.us&i=d');
  });
  it('encodes symbols containing a caret, as indices do', () => {
    expect(stooqUrl('^spx')).toContain('s=%5Espx');
  });
});

describe('parseStooqCsv', () => {
  it('parses date and close and sorts ascending', () => {
    const rows = parseStooqCsv(csv, '2020-01-01');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ date: '2025-01-02', close: 101 });
    expect(rows[2].close).toBe(99.5);
  });

  it('applies the since cutoff', () => {
    expect(parseStooqCsv(csv, '2025-01-03')).toHaveLength(2);
  });

  it('skips N/D markers rather than turning them into zeros', () => {
    const withGap = `Date,Open,High,Low,Close,Volume
2025-01-02,100,101,99,N/D,0
2025-01-03,100,101,99,100.5,10`;
    const rows = parseStooqCsv(withGap, '2020-01-01');
    expect(rows).toHaveLength(1);
    expect(rows[0].close).toBe(100.5);
  });

  it('tolerates a different column order', () => {
    const reordered = `Date,Close,Open
2025-01-02,55.5,50`;
    expect(parseStooqCsv(reordered, '2020-01-01')[0].close).toBe(55.5);
  });

  // The failure modes below are the reason this parser exists at all: every
  // one of them returns HTTP 200 and would otherwise be stored as "no data".
  it('raises on an HTML error page', () => {
    expect(() => parseStooqCsv('<html><body>404</body></html>')).toThrow(StooqError);
  });

  it('raises on the daily hit limit message', () => {
    expect(() => parseStooqCsv('Exceeded the daily hits limit')).toThrow(/hit limit/i);
  });

  it('raises on an empty body', () => {
    expect(() => parseStooqCsv('   ')).toThrow(StooqError);
  });

  it('raises on a header-only response', () => {
    expect(() => parseStooqCsv('Date,Open,High,Low,Close,Volume')).toThrow(/no usable rows/);
  });

  it('raises when the window filters everything out', () => {
    expect(() => parseStooqCsv(csv, '2030-01-01')).toThrow(/no usable rows/);
  });

  it('raises when the Close column is missing', () => {
    expect(() => parseStooqCsv('Date,Open,High,Low,Volume\n2025-01-02,1,2,3,4')).toThrow(/missing a Date or Close/);
  });
});
