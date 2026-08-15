import { describe, expect, it } from 'vitest';
import { STALE_AFTER_DAYS, freshness, latestByJob, runState, warnings } from '../src/lib/health';
import type { FetchRun } from '../src/lib/types';

const run = (patch: Partial<FetchRun> = {}): FetchRun => ({
  id: 1,
  trigger: '15 6 * * *',
  job: 'outcomes',
  started_at: '2026-08-15T06:16:04.000+00:00',
  finished_at: '2026-08-15T06:16:09.000+00:00',
  ok: true,
  companies_attempted: 45,
  rows_written: 86,
  errors: [],
  notes: '84 published claims across 45 companies.',
  ...patch,
});

const NOW = new Date('2026-08-15T12:00:00Z');

describe('freshness: the one operational fact a reader needs', () => {
  it('states when the filing figures were collected, in the ledger’s own words', () => {
    const f = freshness([run()], NOW);
    expect(f.stale).toBe(false);
    expect(f.collectedAt).toBe('2026-08-15');
    expect(f.sentence).toBe('Filing figures collected 2026-08-15 from SEC XBRL company facts.');
  });

  it('never uses operational language for a healthy pipeline', () => {
    const s = freshness([run()], NOW).sentence;
    for (const word of ['job', 'collector', 'error', 'warning', 'failed', 'run']) {
      expect(s.toLowerCase()).not.toContain(word);
    }
  });

  it('says the figures may be out of date when the last attempt never finished', () => {
    // This is the exact shape every outcomes row had in production.
    const f = freshness([run({ finished_at: null, ok: null, rows_written: 0, notes: null })], NOW);
    expect(f.stale).toBe(true);
    expect(f.sentence).toContain('did not complete');
    expect(f.sentence).toContain('may be out of date');
  });

  it('falls back to an older completed run rather than reporting nothing', () => {
    const f = freshness(
      [run({ id: 2, finished_at: null }), run({ id: 1, finished_at: '2026-08-14T06:16:09.000+00:00' })],
      NOW,
    );
    expect(f.collectedAt).toBe('2026-08-14');
  });

  it('says so when the last collection is older than the staleness window', () => {
    const f = freshness([run({ finished_at: '2026-07-01T06:00:00.000+00:00' })], NOW);
    expect(f.stale).toBe(true);
    expect(f.sentence).toContain(String(STALE_AFTER_DAYS));
    expect(f.sentence).toContain('may be missing');
  });

  it('says so when the run finished but derived nothing', () => {
    const f = freshness([run({ rows_written: 0 })], NOW);
    expect(f.stale).toBe(true);
    expect(f.sentence).toContain('without deriving any figures');
  });

  it('says so when there is no record of a run at all', () => {
    const f = freshness([], NOW);
    expect(f.stale).toBe(true);
    expect(f.collectedAt).toBeNull();
    expect(f.sentence).toContain('No collection run is on record');
  });

  it('ignores runs of other jobs when judging the filing figures', () => {
    const f = freshness([run({ job: 'fundamentals', finished_at: '2026-08-15T06:00:00.000+00:00' })], NOW);
    expect(f.sentence).toContain('No collection run is on record');
  });

  it('always returns a full sentence', () => {
    for (const runs of [[], [run()], [run({ finished_at: null })], [run({ rows_written: 0 })]]) {
      const s = freshness(runs, NOW).sentence;
      expect(s.trim().endsWith('.')).toBe(true);
      expect(s.length).toBeGreaterThan(20);
    }
  });
});

describe('warnings', () => {
  const runs = [
    run({ id: 3, started_at: '2026-08-15T06:00:00Z', errors: [
      { scope: 'klarna', message: 'No us-gaap concepts.', expected: true },
      { scope: 'sec', message: 'Rate limited.' },
    ] }),
    run({ id: 2, started_at: '2026-08-14T06:00:00Z', errors: [
      { scope: 'klarna', message: 'No us-gaap concepts.', expected: true },
    ] }),
    run({ id: 1, started_at: '2026-08-13T06:00:00Z', errors: [
      { scope: 'klarna', message: 'No us-gaap concepts.', expected: true },
    ] }),
  ];

  it('counts one repeated message as one fact, not as many warnings', () => {
    // Three runs × one standing fact was reported as three warnings before.
    const { expected } = warnings(runs);
    expect(expected).toHaveLength(1);
    expect(expected[0].occurrences).toBe(3);
  });

  it('separates a standing fact about a company from a real problem', () => {
    const { problems, expected } = warnings(runs);
    expect(problems.map((p) => p.scope)).toEqual(['sec']);
    expect(expected.map((p) => p.scope)).toEqual(['klarna']);
  });

  it('records when each was last seen', () => {
    expect(warnings(runs).expected[0].lastSeen).toBe('2026-08-15T06:00:00Z');
  });

  it('is empty and safe for runs with no errors', () => {
    expect(warnings([run()])).toEqual({ problems: [], expected: [] });
    expect(warnings([])).toEqual({ problems: [], expected: [] });
  });

  it('survives a run whose errors field is missing', () => {
    expect(() => warnings([run({ errors: undefined as never })])).not.toThrow();
  });
});

describe('latestByJob and runState', () => {
  it('keeps only the newest run of each job', () => {
    const rows = [
      run({ id: 1, job: 'outcomes', started_at: '2026-08-13T06:00:00Z' }),
      run({ id: 2, job: 'outcomes', started_at: '2026-08-15T06:00:00Z' }),
      run({ id: 3, job: 'fundamentals', started_at: '2026-08-14T06:00:00Z' }),
    ];
    const latest = latestByJob(rows);
    expect(latest).toHaveLength(2);
    expect(latest.find((r) => r.job === 'outcomes')!.id).toBe(2);
  });

  it('reads a null finish as "did not finish", the honest signal', () => {
    expect(runState(run({ finished_at: null }))).toEqual({ label: 'Did not finish', tone: 'bad' });
  });

  it('distinguishes finishing badly from not finishing', () => {
    expect(runState(run({ ok: false })).label).toBe('Finished with problems');
    expect(runState(run({ rows_written: 0 })).label).toBe('Finished, wrote nothing');
    expect(runState(run()).label).toBe('Finished');
  });
});
