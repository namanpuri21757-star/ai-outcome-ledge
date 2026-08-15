import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { FetchRun } from '../lib/types';

const DAY = 86400000;

/**
 * A pipeline that stops silently is worse than one that errors, because
 * you keep reading a chart that froze three weeks ago.
 *
 * The previous version put the warnings in a `title` tooltip. Tooltips do
 * not exist on touch devices, cannot be copied, and hid the fact that all
 * nine warnings were three messages repeated three times. They now expand
 * inline, deduplicated, with a count.
 */
export function HealthStrip() {
  const [runs, setRuns] = useState<FetchRun[] | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    supabase
      .from('fetch_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(12)
      .then(({ data }) => {
        if (alive) setRuns((data as FetchRun[]) ?? []);
      });
    return () => {
      alive = false;
    };
  }, []);

  if (runs === null) return null;

  if (runs.length === 0) {
    return (
      <div className="health stale">
        <span className="dot" />
        <strong>No collector runs recorded yet.</strong>
        <span>Trigger the worker once to populate the measured series.</span>
      </div>
    );
  }

  const last = runs[0];
  const lastOk = runs.find((r) => r.ok);
  const ageDays = lastOk ? (Date.now() - Date.parse(lastOk.started_at)) / DAY : Infinity;
  const outcomes = runs.find((r) => r.job === 'outcomes');
  const outcomesEmpty = outcomes ? (outcomes.rows_written ?? 0) === 0 : false;

  const state = last.ok === false ? 'failed' : outcomesEmpty || ageDays > 2 ? 'stale' : 'ok';
  const { problems, standing } = partitionWarnings(dedupe(runs.flatMap((r) => r.errors ?? [])));
  const shown = problems.length + standing.length;

  return (
    <div className={'health' + (state === 'ok' ? '' : ' ' + state)}>
      <div className="health-line">
        <span className="dot" />
        <span>
          Last run <strong>{last.job}</strong> {relative(last.started_at)}
          {last.ok === false ? ' — failed' : ` — ${(last.rows_written ?? 0).toLocaleString()} rows`}
        </span>
        {outcomesEmpty && (
          <span className="health-flag">
            The outcomes job wrote no rows, so every measured margin figure is blank.
          </span>
        )}
        {shown > 0 && (
          <button type="button" className="linklike" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide' : 'Show'} {problems.length > 0
              ? `${problems.length} warning${problems.length === 1 ? '' : 's'}`
              : 'collector notes'}
          </button>
        )}
      </div>

      {open && shown > 0 && (
        <div className="health-detail">
          {problems.length > 0 && (
            <ul className="health-warnings">
              {problems.map((w) => (
                <li key={w.scope + w.message}>
                  <code>{w.scope}</code> {w.message}
                  {occurrenceText(w.count, runs.length) && <em> {occurrenceText(w.count, runs.length)}</em>}
                </li>
              ))}
            </ul>
          )}

          {standing.length > 0 && (
            <>
              <p className="health-standing-head">
                Expected, and not a fault: these companies do not file the data, so the
                figure reads as a dash rather than a guess.
              </p>
              <ul className="health-warnings standing">
                {standing.map((w) => (
                  <li key={w.scope + w.message}>
                    <code>{w.scope}</code> {w.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export interface CountedWarning {
  scope: string;
  message: string;
  count: number;
  expected: boolean;
}

/** The same three warnings repeated once per run read as nine problems.
 *  They are three. */
export function dedupe(
  errors: Array<{ scope: string; message: string; expected?: boolean }>,
): CountedWarning[] {
  const map = new Map<string, CountedWarning>();
  for (const e of errors) {
    const key = `${e.scope}|${e.message}`;
    const cur = map.get(key) ?? { scope: e.scope, message: e.message, count: 0, expected: !!e.expected };
    cur.count += 1;
    // One run recording it as expected settles it: the condition is a
    // fact about the company, and an older run that predates the
    // distinction should not drag it back into the problem list.
    cur.expected = cur.expected || !!e.expected;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.scope.localeCompare(b.scope));
}

/**
 * Split what someone should act on from what is simply true.
 *
 * Teleperformance, Klarna and CBA do not file with the SEC, so no margin
 * series is possible for them. That is the answer, not a fault, and
 * listing it beside a real outage teaches the reader to skip both.
 */
export function partitionWarnings(warnings: CountedWarning[]): {
  problems: CountedWarning[];
  standing: CountedWarning[];
} {
  return {
    problems: warnings.filter((w) => !w.expected),
    standing: warnings.filter((w) => w.expected),
  };
}

/**
 * A repeated warning is one standing condition, not N incidents.
 *
 * "×4" read as four failures. It was one unchanged fact, observed in
 * four consecutive runs.
 */
export function occurrenceText(count: number, runsScanned: number): string | null {
  if (count <= 1) return null;
  return `in ${count} of the last ${runsScanned} runs`;
}

function relative(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 36) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}
