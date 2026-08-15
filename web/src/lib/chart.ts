import { line as d3Line, curveMonotoneX } from 'd3-shape';

/* ===================================================================
   CHART ARITHMETIC

   The margin series is the only element in this application that is
   not somebody's assertion, so the chart that draws it should be made
   of parts that can be checked. Recharts drew it before: a large
   dependency whose defaults — rounded tooltips, animated entry, its
   own type stack — had to be argued back down to the ledger's own
   marks on every prop, and which pinned the app to React 18.

   Scales, domains and tick selection live here, out of the component,
   so the numbers behind a pixel position are testable without a
   browser. Only the path assembly uses d3-shape, which is already a
   dependency for the sparkline.
   =================================================================== */

export interface Scale {
  (value: number): number;
  invert(px: number): number;
  domain: readonly [number, number];
  range: readonly [number, number];
}

/**
 * A linear scale. Degenerate domains — one observation, or a series
 * that never moved — map to the middle of the range rather than
 * dividing by zero and painting NaN into the `d` attribute.
 */
export function linear(domain: readonly [number, number], range: readonly [number, number]): Scale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;

  const scale = ((value: number) =>
    span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0)) as Scale;

  scale.invert = (px: number) => (r1 - r0 === 0 ? d0 : d0 + ((px - r0) / (r1 - r0)) * span);
  scale.domain = domain;
  scale.range = range;
  return scale;
}

/**
 * The vertical extent for a margin series.
 *
 * Zero is always included: an operating margin that went from 8% to
 * 11% is a different story from one that crossed into loss, and a
 * chart whose baseline floats hides which one happened.
 */
export function marginDomain(
  values: Array<number | null | undefined>,
  padFraction = 0.15,
  minPad = 0.02,
): [number, number] {
  const real = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
  if (real.length === 0) return [-0.5, 0.5];
  const lo = Math.min(...real, 0);
  const hi = Math.max(...real, 0);
  const pad = Math.max((hi - lo) * padFraction, minPad);
  return [lo - pad, hi + pad];
}

/**
 * Tick values at 1, 2 or 5 times a power of ten.
 *
 * Percentages read as round numbers or they are not read: −2.5%, 0%,
 * 2.5% is legible where −2.37%, 0.14%, 2.65% is noise on the axis.
 */
export function ticks(lo: number, hi: number, target = 4): number[] {
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi <= lo || target < 1) return [];

  const rawStep = (hi - lo) / target;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const error = rawStep / magnitude;

  // d3's thresholds — the geometric midpoints between 1, 2, 5 and 10
  // rather than the arithmetic ones. Rounding at 2 and 5 overshoots:
  // a margin domain of [-2%, 13%] asked for four gridlines and got
  // eight, which is a hatch pattern rather than an axis.
  const step =
    magnitude * (error >= Math.sqrt(50) ? 10 : error >= Math.sqrt(10) ? 5 : error >= Math.sqrt(2) ? 2 : 1);

  const out: number[] = [];
  // Rounded before comparing: floating point makes 0.1 * 3 exceed 0.3
  // and silently drops the last tick on a third of all domains.
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-9; v += step) {
    out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toFixed(10)));
  }
  return out;
}

export interface SeriesPoint {
  date: string;
  margin: number | null;
}

/**
 * The index of the observation closest to a date.
 *
 * A claim is dated the day it was made; the filing that would show it
 * lands at a quarter end. The marker snaps to the observation rather
 * than floating between two of them.
 */
export function nearestIndex(points: SeriesPoint[], targetDate: string): number {
  if (points.length === 0) return -1;
  const t = Date.parse(targetDate + 'T00:00:00Z');
  if (Number.isNaN(t)) return -1;

  let best = 0;
  let bestGap = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const gap = Math.abs(Date.parse(points[i].date + 'T00:00:00Z') - t);
    if (gap < bestGap) {
      bestGap = gap;
      best = i;
    }
  }
  return best;
}

/** The index whose plotted x is nearest a pointer position, for the readout. */
export function indexAtX(count: number, x: Scale, px: number): number {
  if (count === 0) return -1;
  const i = Math.round(x.invert(px));
  return Math.min(count - 1, Math.max(0, i));
}

/**
 * The line itself.
 *
 * `defined` is the point: a company that stopped filing for two
 * quarters has a hole in its series, and drawing straight through it
 * invents four observations that were never made.
 */
export function seriesPath(points: SeriesPoint[], x: Scale, y: Scale): string {
  const generator = d3Line<SeriesPoint>()
    .defined((p) => typeof p.margin === 'number' && Number.isFinite(p.margin))
    .x((_p, i) => x(i))
    .y((p) => y(p.margin as number))
    .curve(curveMonotoneX);
  return generator(points) ?? '';
}
