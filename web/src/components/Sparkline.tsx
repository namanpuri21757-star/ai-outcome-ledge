import { useMemo } from 'react';
import { bps } from '../lib/format';

/**
 * A margin movement, small enough to repeat forty-five times.
 *
 * Hand-drawn rather than pulled from a chart library on purpose: at this
 * size every pixel of padding a library adds is a pixel of signal lost,
 * and the only marks needed are a zero rule, a line and an end point.
 *
 * A company with no measured margin does not get a flat line at zero.
 * A missing measurement is not a measurement of no change, and drawing
 * it as one would be the exact error this project documents.
 */
export function Sparkline({
  values, width = 68, height = 20,
}: {
  values: Array<number | null>;
  width?: number;
  height?: number;
}) {
  const points = useMemo(
    () => values.filter((v): v is number => v !== null && v !== undefined),
    [values],
  );

  if (points.length === 0) {
    return (
      <span className="spark spark-none" title="No measured margin movement for this company.">
        —
      </span>
    );
  }

  if (points.length === 1) {
    const only = points[0];
    return (
      <span
        className={'spark spark-single ' + (only >= 0 ? 'is-up' : 'is-down')}
        title={`One measured reading: ${bps(only)}`}
      >
        {bps(only)}
      </span>
    );
  }

  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const span = max - min || 1;
  const pad = 2;
  const usableH = height - pad * 2;

  const x = (i: number) => (i / (points.length - 1)) * width;
  const y = (v: number) => pad + (1 - (v - min) / span) * usableH;

  const d = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const zeroY = y(0);

  return (
    <svg
      className="spark"
      width={width}
      height={height}
      role="img"
      aria-label={`Margin movement across ${points.length} measured claims, ending at ${bps(last)}.`}
    >
      {/* Zero is the only reference that matters: above it margin widened. */}
      <line className="spark-zero" x1="0" y1={zeroY} x2={width} y2={zeroY} />
      <path className={'spark-line ' + (last >= 0 ? 'is-up' : 'is-down')} d={d} />
      <circle
        className={'spark-end ' + (last >= 0 ? 'is-up' : 'is-down')}
        cx={x(points.length - 1)}
        cy={y(last)}
        r="2"
      />
    </svg>
  );
}
