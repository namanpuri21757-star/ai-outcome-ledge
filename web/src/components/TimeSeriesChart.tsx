import { useEffect, useMemo, useRef, useState } from 'react';
import {
  indexAtX, linear, marginDomain, nearestIndex, seriesPath, ticks, type SeriesPoint,
} from '../lib/chart';
import { ratioAsPct, shortDate } from '../lib/format';

/* ===================================================================
   THE MARGIN SERIES

   One chart, used by the company page and by the expanded row, so the
   two cannot drift apart. It was two Recharts configurations that had
   already drifted: the row version carried three hard-coded hexes
   where the page version carried tokens.

   Everything here is the ledger's own vocabulary — mono figures,
   square corners, the audit red for a claim date, the claimed blue
   for the line. Nothing is a library default that had to be argued
   down.
   =================================================================== */

const PAD = { top: 10, right: 12, bottom: 20, left: 46 };

export interface TimeSeriesChartProps {
  points: SeriesPoint[];
  /** Vertical rules at claim dates, so claims and outcomes share an axis. */
  markers?: Array<{ date: string; label: string }>;
  height?: number;
  /** Describes the series for a reader who cannot see it. */
  label?: string;
}

export function TimeSeriesChart({
  points, markers = [], height = 220, label = 'Operating margin by quarter',
}: TimeSeriesChartProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const innerW = Math.max(80, width - PAD.left - PAD.right);
  const innerH = Math.max(60, height - PAD.top - PAD.bottom);

  const { x, y, path, gridTicks, dateTicks } = useMemo(() => {
    const domain = marginDomain(points.map((p) => p.margin));
    // Index-based rather than time-based: the observations are quarter
    // ends at even spacing, and an even axis keeps the last point off
    // the right-hand edge where it would be clipped.
    const xs = linear([0, Math.max(1, points.length - 1)], [0, innerW]);
    const ys = linear(domain, [innerH, 0]);

    // One label per roughly 64px, so the axis thins out instead of
    // overprinting itself on a narrow card.
    const stride = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(innerW / 64))));

    return {
      x: xs,
      y: ys,
      path: seriesPath(points, xs, ys),
      gridTicks: ticks(domain[0], domain[1], 4),
      dateTicks: points.map((p, i) => ({ ...p, i })).filter((p) => p.i % stride === 0),
    };
  }, [points, innerW, innerH]);

  if (points.length === 0) return null;

  const active = hover != null ? points[hover] : null;
  const summary =
    `${label}. ${points.length} observations from ${shortDate(points[0].date)} to ` +
    `${shortDate(points[points.length - 1].date)}.`;

  return (
    <div className="chart-wrap" ref={wrapRef} style={{ height }}>
      <svg
        className="chart-svg"
        width={width}
        height={height}
        role="img"
        aria-label={summary}
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          setHover(indexAtX(points.length, x, e.clientX - box.left - PAD.left));
        }}
        onMouseLeave={() => setHover(null)}
      >
        <g transform={`translate(${PAD.left},${PAD.top})`}>
          {gridTicks.map((t) => (
            <g key={t}>
              <line
                className={'chart-grid' + (t === 0 ? ' is-zero' : '')}
                x1={0}
                x2={innerW}
                y1={y(t)}
                y2={y(t)}
              />
              <text className="chart-axis" x={-8} y={y(t)} textAnchor="end" dominantBaseline="middle">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}

          {markers.map((m) => {
            const i = nearestIndex(points, m.date);
            if (i < 0) return null;
            return (
              <line
                key={m.date + m.label}
                className="chart-marker"
                x1={x(i)}
                x2={x(i)}
                y1={0}
                y2={innerH}
              >
                <title>{m.label}</title>
              </line>
            );
          })}

          <path className="chart-line" d={path} />

          {dateTicks.map((p) => (
            <text
              key={p.date}
              className="chart-axis"
              x={x(p.i)}
              y={innerH + 14}
              textAnchor="middle"
            >
              {p.date.slice(2, 7)}
            </text>
          ))}

          {active && typeof active.margin === 'number' && (
            <g className="chart-readout" aria-hidden="true">
              <line x1={x(hover!)} x2={x(hover!)} y1={0} y2={innerH} />
              <circle cx={x(hover!)} cy={y(active.margin)} r={3} />
            </g>
          )}
        </g>
      </svg>

      {/* Outside the SVG so it inherits the page's type rather than
          needing an SVG text layout of its own. */}
      {active && typeof active.margin === 'number' && (
        <div
          className="chart-tip"
          style={{ left: Math.min(innerW - 40, Math.max(0, x(hover!))) + PAD.left }}
        >
          <strong>{ratioAsPct(active.margin)}</strong>
          <span>{shortDate(active.date)}</span>
        </div>
      )}
    </div>
  );
}
