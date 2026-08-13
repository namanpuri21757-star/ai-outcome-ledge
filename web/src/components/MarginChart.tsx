import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { ratioAsPct, shortDate } from '../lib/format';

/* ===================================================================
   The only element in this application that is not somebody's
   assertion. Everything else is a claim that was made; this is what
   the company's own filings did afterwards, rebuilt from SEC XBRL on
   every collector run.

   It used to sit inside an accordion, inside the raw table, three
   clicks from the front door. It now leads the company page, because
   it is the answer to the only question that matters: did it work.
   =================================================================== */

interface Point {
  date: string;
  margin: number | null;
}

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

  const domain = useMemo(() => {
    if (!points || points.length === 0) return [-0.5, 0.5] as [number, number];
    const vals = points.map((p) => p.margin ?? 0);
    const lo = Math.min(...vals, 0);
    const hi = Math.max(...vals, 0);
    const pad = Math.max((hi - lo) * 0.15, 0.02);
    return [lo - pad, hi + pad] as [number, number];
  }, [points]);

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

  return (
    <div className="chart-wrap" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          <CartesianGrid stroke="var(--rule)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--ink-3)' }}
            tickFormatter={(d: string) => d.slice(2, 7)}
            minTickGap={28}
            stroke="var(--rule-strong)"
          />
          <YAxis
            domain={domain}
            tick={{ fontSize: 10, fontFamily: 'var(--font-mono)', fill: 'var(--ink-3)' }}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
            width={44}
            stroke="var(--rule-strong)"
          />
          <ReferenceLine y={0} stroke="var(--rule-strong)" />
          {markers.map((m) => (
            <ReferenceLine
              key={m.date + m.label}
              x={nearestDate(points, m.date)}
              stroke="var(--gap)"
              strokeDasharray="3 3"
            />
          ))}
          <Tooltip
            contentStyle={{
              background: 'var(--paper-raised)',
              border: '1px solid var(--rule-strong)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              borderRadius: 0,
            }}
            labelFormatter={(d: string) => shortDate(d)}
            formatter={(v: number) => [ratioAsPct(v), 'Operating margin']}
          />
          <Line
            type="monotone"
            dataKey="margin"
            stroke="var(--claimed)"
            strokeWidth={1.6}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Recharts draws a reference line on a category axis only when the value
 *  is an actual tick, so a claim date is snapped to the nearest period end. */
export function nearestDate(points: Point[], target: string): string {
  if (points.length === 0) return target;
  let best = points[0].date;
  let bestGap = Infinity;
  const t = Date.parse(target + 'T00:00:00Z');
  for (const p of points) {
    const gap = Math.abs(Date.parse(p.date + 'T00:00:00Z') - t);
    if (gap < bestGap) {
      bestGap = gap;
      best = p.date;
    }
  }
  return best;
}
