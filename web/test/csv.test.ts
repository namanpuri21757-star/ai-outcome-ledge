import { describe, expect, it } from 'vitest';
import { EXPORT_COLUMNS, csvCell, toCsv } from '../src/lib/csv';
import { CORPUS, row } from './fixtures';

describe('csvCell', () => {
  it('quotes a value containing a comma', () => {
    expect(csvCell('a, b')).toBe('"a, b"');
  });
  it('doubles embedded quotes', () => {
    expect(csvCell('he said "no"')).toBe('"he said ""no"""');
  });
  it('quotes a value containing a newline', () => {
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
  });
  it('renders null and undefined as empty, not as the word null', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
  it('leaves a plain value unquoted', () => {
    expect(csvCell('plain')).toBe('plain');
  });
});

describe('toCsv', () => {
  it('emits a header plus one line per row', () => {
    const lines = toCsv(CORPUS).split('\r\n');
    expect(lines).toHaveLength(CORPUS.length + 1);
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(','));
  });

  it('keeps the raw codes so nothing is lost when the interface hides them', () => {
    expect(EXPORT_COLUMNS).toContain('destination');
    expect(EXPORT_COLUMNS).toContain('measurement_basis');
    expect(EXPORT_COLUMNS).toContain('epistemic_tag');
  });

  it('survives a headline containing a comma and a quote', () => {
    const csv = toCsv([row({ headline: 'IBM says "productivity", not cost' })]);
    expect(csv).toContain('"IBM says ""productivity"", not cost"');
    expect(csv.split('\r\n')).toHaveLength(2);
  });
});
