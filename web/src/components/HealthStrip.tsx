import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { FetchRun } from '../lib/types';

const DAY = 86400000;

/**
 * A pipeline that stops running silently is worse than one that errors,
 * because you keep reading a chart that froze three weeks ago. This is the
 * visible failure path: amber when the last clean run is over two days old,
 * red when the most recent run failed.
 */
export function HealthStrip() {
  const [runs, setRuns] = useState<FetchRun[] | null>(null);

  useEffect(() => {
    let alive = true;
    supabase
      .from('fetch_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(6)
      .then(({ data }) => { if (alive) setRuns((data as FetchRun[]) ?? []); });
    return () => { alive = false; };
  }, []);

  if (runs === null) return null;

  if (runs.length === 0) {
    return (
      <div className="health stale">
        <span className="dot" />
        <strong>No collector runs recorded yet.</strong>
        <span>Trigger the Worker once at /run?job=all&amp;token=… to populate the live series.</span>
      </div>
    );
  }

  const last = runs[0];
  const lastOk = runs.find((r) => r.ok);
  const ageDays = lastOk ? (Date.now() - Date.parse(lastOk.started_at)) / DAY : Infinity;
  const state = last.ok === false ? 'failed' : ageDays > 2 ? 'stale' : 'ok';
  const errors = runs.flatMap((r) => r.errors ?? []);

  return (
    <div className={'health' + (state === 'ok' ? '' : ' ' + state)}>
      <span className="dot" />
      <span>
        Last run <strong>{last.job}</strong> {relative(last.started_at)}
        {last.ok === false ? ' — failed' : ` — ${(last.rows_written ?? 0).toLocaleString()} rows`}
      </span>
      {lastOk && state !== 'ok' && <span>Last clean run {relative(lastOk.started_at)}.</span>}
      {errors.length > 0 && (
        <span title={errors.map((e) => `${e.scope}: ${e.message}`).join('\n')}>
          {errors.length} collector warning{errors.length === 1 ? '' : 's'} (hover)
        </span>
      )}
    </div>
  );
}

function relative(iso: string): string {
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 60) return `${mins}m ago`;
  if (mins < 60 * 36) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}
