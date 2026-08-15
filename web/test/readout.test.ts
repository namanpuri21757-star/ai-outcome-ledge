import { describe, expect, it } from 'vitest';
import { corpusNote, landedIn, readout } from '../src/lib/readout';
import { applyFilters, EMPTY_FILTERS } from '../src/lib/filters';
import { totals } from '../src/lib/aggregate';
import { usd } from '../src/lib/format';
import { CORPUS, row } from './fixtures';

const items = readout(CORPUS, usd);
const byId = (id: string) => items.find((i) => i.id === id)!;

describe('every statement survives an empty corpus', () => {
  const empty = readout([], usd);

  it('produces the same set of statements rather than disappearing', () => {
    expect(empty.map((i) => i.id)).toEqual(items.map((i) => i.id));
  });

  it('states its own emptiness in words, never as a zero', () => {
    for (const i of empty) {
      expect(i.answer.length).toBeGreaterThan(20);
      expect(i.answer.trim().endsWith('.')).toBe(true);
      expect(i.rowCount).toBe(0);
      expect(i.select).toBeNull();
      expect(i.answer).not.toContain('undefined');
      expect(i.answer).not.toContain('NaN');
      expect(i.answer).not.toMatch(/\b0 rows carrying \$0\b/);
    }
  });
});

describe('every statement rests on the rows it names', () => {
  it('the selection it offers really produces the count it claims', () => {
    for (const item of items) {
      if (!item.select) continue;
      const rows = applyFilters(CORPUS, { ...EMPTY_FILTERS, ...item.select });
      expect(rows.length, item.id).toBe(item.rowCount);
    }
  });

  it('never offers a selection that matches nothing', () => {
    for (const item of items) {
      if (!item.select) continue;
      expect(item.rowCount, item.id).toBeGreaterThan(0);
    }
  });

  it('regenerates when the rows change', () => {
    const other = readout(CORPUS.filter((r) => r.destination !== 5), usd);
    expect(other.map((i) => i.answer)).not.toEqual(items.map((i) => i.answer));
  });
});

describe('where it landed', () => {
  it('names the largest destination and its own meaning', () => {
    const it_ = byId('landed');
    expect(it_.answer).toContain('Absorbed as slack');
    expect(it_.answer).toContain('Nothing left the cost base');
  });

  it('gives the share of claimed dollars it represents', () => {
    expect(byId('landed').answer).toMatch(/\d+% of every claimed dollar/);
  });

  it('does not claim a dollar share when nothing is stated in dollars', () => {
    const rows = [row({ claimed_amount_usd: null, destination: 1 })];
    expect(readout(rows, usd).find((i) => i.id === 'landed')!.answer)
      .toContain('no dollar figure between them');
  });
});

describe('did anything reach profit', () => {
  it('reports the claims coded as kept as margin', () => {
    const answer = byId('margin').answer;
    expect(answer).toContain('kept as margin');
    expect(answer).toContain('$428M');
  });

  it('states the absence as the finding when nothing reached margin', () => {
    const rows = CORPUS.filter((r) => r.destination !== 5);
    const answer = readout(rows, usd).find((i) => i.id === 'margin')!.answer;
    expect(answer).toContain('Not one gain claim');
    expect(answer).toContain('That is the finding, not a gap');
  });
});

describe('contradicted and uninterpretable', () => {
  it('counts the counter-evidence rows', () => {
    expect(byId('contradicted').answer).toContain('1 row');
  });

  it('counts rows whose measurement is undefined or whose sources conflict', () => {
    // `cursor-unusable` is both unverified and disputed — it must count once.
    expect(byId('uninterpretable').rowCount).toBe(1);
  });

  it('says so when every row is interpretable', () => {
    const clean = CORPUS.filter(
      (r) => r.measurement_basis !== 'unverified' && r.verification_status !== 'disputed',
    );
    expect(readout(clean, usd).find((i) => i.id === 'uninterpretable')!.answer)
      .toContain('has a stated measurement basis');
  });
});

describe('the offer never promises more than it delivers', () => {
  it('offers gain claims in a destination, not every row in it', () => {
    // Rows of other kinds share the destination; the button filters to
    // gain claims, so its count must be gain claims.
    const rows = [
      row({ ref: 'a', destination: 1, claim_kind: 'gain_claim', claimed_amount_usd: 10 }),
      row({ ref: 'b', destination: 1, claim_kind: 'context', claimed_amount_usd: null }),
    ];
    const landed = readout(rows, usd).find((i) => i.id === 'landed')!;
    expect(landed.rowCount).toBe(1);
    expect(applyFilters(rows, { ...EMPTY_FILTERS, ...landed.select! })).toHaveLength(1);
  });

  it('names the narrower subset when the sentence spans two dimensions', () => {
    const rows = [
      row({ ref: 'a', measurement_basis: 'unverified', verification_status: 'verified_primary' }),
      row({ ref: 'b', measurement_basis: 'net_pl', verification_status: 'disputed' }),
    ];
    const item = readout(rows, usd).find((i) => i.id === 'uninterpretable')!;
    expect(item.answer).toContain('2 rows');
    expect(item.rowCount).toBe(1);
    expect(item.selectLabel).toBeTruthy();
    expect(applyFilters(rows, { ...EMPTY_FILTERS, ...item.select! })).toHaveLength(item.rowCount);
  });

  it('needs no label when the selection covers the whole statement', () => {
    const rows = [row({ measurement_basis: 'unverified', verification_status: 'secondary_only' })];
    const item = readout(rows, usd).find((i) => i.id === 'uninterpretable')!;
    expect(item.rowCount).toBe(1);
    expect(item.selectLabel).toBeNull();
  });

  it('offers the disputed rows when they outnumber the undefined ones', () => {
    const rows = [
      row({ ref: 'a', measurement_basis: 'net_pl', verification_status: 'disputed' }),
      row({ ref: 'b', measurement_basis: 'net_pl', verification_status: 'disputed' }),
      row({ ref: 'c', measurement_basis: 'unverified', verification_status: 'verified_primary' }),
    ];
    const item = readout(rows, usd).find((i) => i.id === 'uninterpretable')!;
    expect(item.select).toEqual({ verification: ['disputed'] });
    expect(item.rowCount).toBe(2);
  });

  it('gives every item the selectLabel field, even when it is null', () => {
    for (const item of readout(CORPUS, usd)) {
      expect(item).toHaveProperty('selectLabel');
    }
  });
});

describe('the corpus note', () => {
  it('agrees with the totals it describes', () => {
    const t = totals(CORPUS);
    const note = corpusNote(CORPUS, usd);
    expect(note).toContain(`${t.rows} rows`);
    expect(note).toContain(`${t.gainClaims} of them assert a gain`);
    expect(note).toContain(`${t.dollarClaims} of those name a figure in dollars`);
  });

  it('mentions the research rows as the counterweight', () => {
    expect(corpusNote(CORPUS, usd)).toContain('population-level research');
  });

  it('omits the research clause when there is none', () => {
    const rows = CORPUS.filter((r) => r.claim_kind !== 'research_finding');
    expect(corpusNote(rows, usd)).not.toContain('population-level research');
  });
});

describe('landedIn', () => {
  it('lists destinations in ladder order, not by size', () => {
    expect(landedIn(CORPUS)).toBe('absorbed as slack, taken from a supplier and kept as margin');
  });
  it('is empty when there is no gain claim', () => {
    expect(landedIn([row({ claim_kind: 'context' })])).toBe('');
  });
});
