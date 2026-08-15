import type { FetchRun } from './types';

/* ===================================================================
   The collector's health, and the one part of it a reader needs.

   The previous build put a strip on every screen, on every load, with a
   "Show 22 warnings" control — for a maintenance-state problem nobody
   reading the ledger could act on. Operational health belongs on one
   maintenance surface.

   The exception is a defect that changes how a reader should interpret
   what they are seeing. Exactly one qualifies here: whether the filing
   figures on screen are current. `freshness()` states that as a fact
   about the data, in the ledger's own words, and says nothing at all
   when the answer is "collected today and fine".
   =================================================================== */

export const STALE_AFTER_DAYS = 7;

export interface Freshness {
  /** When the outcomes job last completed. */
  collectedAt: string | null;
  stale: boolean;
  /** One sentence for the ledger. Never operational language. */
  sentence: string;
}

export function freshness(runs: FetchRun[], now = new Date()): Freshness {
  const outcomes = runs.filter((r) => r.job === 'outcomes');
  const done = outcomes.find((r) => r.finished_at !== null);

  if (outcomes.length === 0) {
    return {
      collectedAt: null,
      stale: true,
      sentence:
        'No collection run is on record, so the operating-margin figures below may be missing rather than absent.',
    };
  }

  if (!done) {
    return {
      collectedAt: null,
      stale: true,
      sentence:
        'The last attempt to derive the filing figures did not complete, so the operating-margin readings below may be out of date.',
    };
  }

  const at = done.finished_at!;
  const days = (now.getTime() - Date.parse(at)) / 86_400_000;
  const day = at.slice(0, 10);

  if (days > STALE_AFTER_DAYS) {
    return {
      collectedAt: day,
      stale: true,
      sentence: `Filing figures were last collected on ${day}, more than ${STALE_AFTER_DAYS} days ago. Readings for recent claims may be missing.`,
    };
  }

  if (done.ok === false || done.rows_written === 0) {
    return {
      collectedAt: day,
      stale: true,
      sentence: `The collection run on ${day} finished without deriving any figures, so the operating-margin readings below are from an earlier run.`,
    };
  }

  return {
    collectedAt: day,
    stale: false,
    sentence: `Filing figures collected ${day} from SEC XBRL company facts.`,
  };
}

/* ------------------------------------------------------------------ */

export interface Warning {
  scope: string;
  message: string;
  expected: boolean;
  /** How many of the runs on record carry this same message. */
  occurrences: number;
  lastSeen: string;
}

/**
 * The same message repeating across runs is one fact, not twenty. The
 * old strip counted every occurrence separately, which is how three
 * standing facts about three non-SEC filers became "22 warnings".
 */
export function warnings(runs: FetchRun[]): { problems: Warning[]; expected: Warning[] } {
  const byMessage = new Map<string, Warning>();

  for (const run of runs) {
    for (const e of run.errors ?? []) {
      const key = `${e.scope}::${e.message}`;
      const at = byMessage.get(key);
      if (at) {
        at.occurrences += 1;
        if (run.started_at > at.lastSeen) at.lastSeen = run.started_at;
      } else {
        byMessage.set(key, {
          scope: e.scope,
          message: e.message,
          expected: e.expected === true,
          occurrences: 1,
          lastSeen: run.started_at,
        });
      }
    }
  }

  const all = [...byMessage.values()].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  return {
    problems: all.filter((w) => !w.expected),
    expected: all.filter((w) => w.expected),
  };
}

/** The most recent run of each job, which is what a maintainer reads first. */
export function latestByJob(runs: FetchRun[]): FetchRun[] {
  const seen = new Set<string>();
  const out: FetchRun[] = [];
  for (const r of [...runs].sort((a, b) => b.started_at.localeCompare(a.started_at))) {
    if (seen.has(r.job)) continue;
    seen.add(r.job);
    out.push(r);
  }
  return out;
}

/** Plain words for a run's state. `finished_at` is the honest signal. */
export function runState(run: FetchRun): { label: string; tone: 'ok' | 'warn' | 'bad' } {
  if (run.finished_at === null) {
    return { label: 'Did not finish', tone: 'bad' };
  }
  if (run.ok === false) return { label: 'Finished with problems', tone: 'warn' };
  if (run.rows_written === 0) return { label: 'Finished, wrote nothing', tone: 'warn' };
  return { label: 'Finished', tone: 'ok' };
}
