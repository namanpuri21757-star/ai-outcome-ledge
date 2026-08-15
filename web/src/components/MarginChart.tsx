import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { syntheticMargins, useFixtures } from '../lib/devData';
import { TimeSeriesChart } from './TimeSeriesChart';
import type { SeriesPoint } from '../lib/chart';

/* ===================================================================
   The only element in this application that is not somebody's
   assertion. Everything else is a claim that was made; this is what
   the company's own filings did afterwards, rebuilt from SEC XBRL on
   every collector run.

   It used to sit inside an accordion, inside the raw table, three
   clicks from the front door. It now leads the company page, because
   it is the answer to the only question that matters: did it work.
   =================================================================== */

type Point = SeriesPoint;

export interface MarginChartProps {
  companySlug: string;
  /** Vertical rules drawn at claim dates, so claims and outcomes share an axis. */
  markers?: Array<{ date: string; label: string }>;
  height?: number;
  /** Rendered when the company has no series at all. */
  emptyNote?: string;
}

const CACHE = new Map<string, Point[]>();

export function MarginChart({ companySlug, markers = [], height = 220, emptyNote }: MarginChartProps) {
  const [points, setPoints] = useState<Point[] | null>(CACHE.get(companySlug) ?? null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (CACHE.has(companySlug)) {
      setPoints(CACHE.get(companySlug)!);
      return;
    }
    setPoints(null);
    setFailed(null);

    // Dropped from production builds with the rest of the fixture
    // module; see devData.ts.
    if (useFixtures) {
      setPoints(syntheticMargins(companySlug));
      return;
    }

    (async () => {
      const { data: co, error: coErr } = await supabase
        .from('companies')
        .select('id')
        .eq('slug', companySlug)
        .maybeSingle();

      if (coErr) {
        if (alive) setFailed('Could not look up this company.');
        return;
      }
      if (!co) {
        if (alive) setFailed(null);
        if (alive) setPoints([]);
        return;
      }

      const { data, error } = await supabase
        .from('observations')
        .select('observed_at,value')
        .eq('company_id', (co as { id: string }).id)
        .eq('series_key', 'operating_margin_q')
        .order('observed_at', { ascending: true })
        .limit(400);

      if (!alive) return;
      if (error) {
        setFailed('Could not load the margin series.');
        return;
      }
      const rows = ((data ?? []) as Array<{ observed_at: string; value: number | string }>).map((d) => ({
        date: d.observed_at,
        margin: Number(d.value),
      }));
      CACHE.set(companySlug, rows);
      setPoints(rows);
    })();

    return () => {
      alive = false;
    };
  }, [companySlug]);

  if (failed) {
    return <div className="chart-empty">{failed}</div>;
  }

  if (points === null) {
    return <div className="chart-empty">Loading the margin series…</div>;
  }

  if (points.length === 0) {
    return (
      <div className="chart-empty">
        {emptyNote ??
          'No operating-margin series for this company. It is either private or files outside the SEC, so there is nothing to measure the claim against.'}
      </div>
    );
  }

  return <TimeSeriesChart points={points} markers={markers} height={height} />;
}
