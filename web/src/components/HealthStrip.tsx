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
  const warnings = dedupe(runs.flatMap((r) => r.errors ?? []));

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
        {warnings.length > 0 && (
          <button type="button" className="linklike" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide' : 'Show'} {warnings.length} warning{warnings.length === 1 ? '' : 's'}
          </button>
        )}
      </div>

      {open && warnings.length > 0 && (
        <ul className="health-warnings">
          {warnings.map((w) => (
            <li key={w.scope + w.message}>
              <code>{w.scope}</code> {w.message}
              {w.count > 1 && <em> ×{w.count}</em>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export interface CountedWarning {
  scope: string;
  message: string;
  count: number;
}

/** The same three warnings repeated once per run read as nine problems.
 *  They are three. */
export function dedupe(errors: Array<{ scope: string; message: string }>): CountedWarning[] {
  const map = new Map<string, CountedWarning>();
  for (const e of errors) {
    const key = `${e.scope}|${e.message}`;
    const cur = map.get(key) ?? { scope: e.scope, message: e.message, count: 0 };
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.scope.localeCompare(b.scope));
}

function relative(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 36) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}
