/* ===================================================================
   LIST PRICES — the market-level answer to "where did the AI money go".

   The ledger answers that question one company at a time: a claimed
   dollar, and whether a filing shows it. This file answers it from the
   other end. If AI had driven the cost of a service down, the service's
   own list price is where it would show, because a list price is the
   one number a seller publishes and has to stand behind.

   ── Why this file holds its own data ──────────────────────────────

   Everything else in `src/lib` reads the corpus. This does not, and
   must not: these are published list prices for two services, not
   coded claims, and they have no company row, no destination and no
   traceable figure. Wiring them into the ledger would put a price per
   audio minute into a total of claimed savings. So the table below is
   the whole of this page's data, it is hardcoded, and it reaches no
   network.

   ── The rule for anything in this file ────────────────────────────

   Every date, price and source URL below was supplied and checked by
   hand. Nothing here may be interpolated, rounded, extended or
   estimated, and no point may be added between two given ones. A price
   with no source URL is not a price this page can show, which is why
   `source` is a required field rather than a nullable one.

   Each of these is a publication dated on the day shown. None of them
   is an archive capture, and none may be described as one.
   =================================================================== */

export interface PricePoint {
  /** ISO date of the publication that states the price. */
  date: string;
  /** The list price on that date, in dollars, exactly as published. */
  usd: number;
  /** The tier the price belongs to, where the source names one. */
  tier: string | null;
  /** The publication. Required: a point with no source cannot be shown. */
  source: string;
}

export interface PriceSeries {
  key: string;
  /** What is priced. */
  name: string;
  /** What one unit of it is. */
  unit: string;
  points: PricePoint[];
  /**
   * Which points may be joined by a drawn line, as index runs.
   *
   * A run is a stretch over which the same thing was priced the same
   * way. A repackaging ends a run: the line stops, and the points on
   * the far side stand alone. This is the mechanism that keeps a chart
   * from drawing a price cut that never happened — see BREAK below.
   */
  runs: number[][];
}

/** Rev.com, human transcription and captions, per audio minute. */
export const REV_HUMAN: PriceSeries = {
  key: 'rev-human',
  name: 'Rev.com human transcription',
  unit: 'per audio minute',
  points: [
    { date: '2016-05-11', usd: 1.0, tier: null, source: 'https://sites.duke.edu/ddmc/2016/05/11/help-us-test-a-captioning-vendor/' },
    { date: '2017-12-07', usd: 1.0, tier: null, source: 'https://sites.duke.edu/ddmc/2017/12/07/new-features-at-rev-com/' },
    { date: '2020-03-11', usd: 1.25, tier: null, source: 'https://www.thejapanguy.com/ultimate-rev-transcription-review/' },
    { date: '2023-07-20', usd: 1.5, tier: null, source: 'https://www.rev.com/blog/why-rev/cheap-transcription-services-how-rev-measures-up-in-price' },
    { date: '2026-08-16', usd: 1.99, tier: null, source: 'https://support.rev.com/hc/en-us/articles/18893487380365-Pricing' },
  ],
  runs: [[0, 1, 2, 3, 4]],
};

/** Rev.com, AI transcription, per audio minute. The same seller's own machine tier. */
export const REV_AI: PriceSeries = {
  key: 'rev-ai',
  name: 'Rev.com AI transcription',
  unit: 'per audio minute',
  points: [
    { date: '2019-06-13', usd: 0.1, tier: null, source: 'https://sites.duke.edu/ddmc/2019/06/13/new-machine-transcription-option-from-rev/' },
    { date: '2026-08-16', usd: 0.25, tier: null, source: 'https://support.rev.com/hc/en-us/articles/18893487380365-Pricing' },
  ],
  runs: [[0, 1]],
};

/**
 * Grammarly Business, per seat per month, annual billing, entry tier.
 *
 * The last two points share a date and are two tiers of one repackaging,
 * not one price moving. So the runs stop at index 2 and each 2026 point
 * stands on its own: a line drawn from 2025-05-08 to the 2026 $12.00
 * would read as a price cut, and there was no price cut.
 */
export const GRAMMARLY: PriceSeries = {
  key: 'grammarly',
  name: 'Grammarly Business',
  unit: 'per seat, per month, billed annually',
  points: [
    { date: '2021-07-06', usd: 12.5, tier: null, source: 'https://theurbanwriters.com/blogs/publishing/final-verdict-grammarly-business' },
    { date: '2023-06-03', usd: 15.0, tier: null, source: 'https://streetwisejournal.com/grammarly-business-pricing/' },
    { date: '2025-05-08', usd: 15.0, tier: null, source: 'https://www.techrepublic.com/article/grammarly-business-review/' },
    { date: '2026-07-15', usd: 12.0, tier: 'Pro', source: 'https://www.usecarly.com/blog/grammarly-pricing/' },
    { date: '2026-07-15', usd: 33.0, tier: 'new Business tier, Superhuman suite', source: 'https://www.usecarly.com/blog/grammarly-pricing/' },
  ],
  runs: [[0, 1, 2], [3], [4]],
};

/**
 * The structural break, rendered rather than smoothed.
 *
 * `at` positions the marker and is a coordinate, not a published figure:
 * the source dates the repackaging to a month, so the first of that
 * month is where the rule is drawn. `label` is what a reader sees, and
 * it says the month, which is as precise as the source is.
 */
export const BREAK = {
  series: 'grammarly',
  at: '2025-10-01',
  label: 'Oct 2025 — Business plan folded into Pro',
  source: 'https://fluentatdesk.com/grammarly-pricing/',
} as const;

/** The finding, in one sentence. Fixed text, checked against the table by test. */
export const TAKEAWAY =
  "Rev's human transcription price rose 99% between 2016 and 2026 and its own AI tier rose 150%, " +
  "while Grammarly's apparent 2026 price drop is a plan repackaging — in neither market did AI push list prices down.";

/** Said once, in the reader's words, because the sourcing is the point. */
export const SOURCING_NOTE =
  'Every price here comes from a publication dated on the day shown, not from an archive capture of a pricing page.';

export const PANELS: Array<{ key: string; heading: string; series: PriceSeries[] }> = [
  { key: 'rev', heading: 'Rev.com, per audio minute', series: [REV_HUMAN, REV_AI] },
  { key: 'grammarly', heading: 'Grammarly Business, per seat per month', series: [GRAMMARLY] },
];

/* ===================================================================
   GEOMETRY

   Pure, and out of the component, so the shape of a chart can be
   asserted without a browser. Nothing here invents a value: the ticks
   are the published prices and the published dates, so every number
   printed on an axis is a number from the table above.
   =================================================================== */

export interface PlotPoint extends PricePoint {
  x: number;
  y: number;
  /** Position in the series, so a label can name the point it belongs to. */
  index: number;
  seriesKey: string;
}

export interface PlotSeries {
  key: string;
  name: string;
  unit: string;
  points: PlotPoint[];
  /** Runs of two or more points, as drawable polyline coordinates. */
  paths: PlotPoint[][];
}

export interface Plot {
  width: number;
  height: number;
  pad: { l: number; r: number; t: number; b: number };
  series: PlotSeries[];
  /** A gridline at every published price. Lines only, so none collide. */
  yTicks: Array<{ usd: number; y: number }>;
  /**
   * The two the axis is written at: the lowest and highest published
   * price on the panel. Both are real prices from the table, and they
   * are far enough apart to set without one label sitting on another —
   * which is why the rest of the prices are printed on their own points
   * instead of down the side.
   */
  yLabels: Array<{ usd: number; y: number }>;
  xTicks: Array<{ date: string; x: number }>;
  break: { x: number; label: string; source: string } | null;
}

/* The viewBox is close to the width the panel is actually drawn at, so a
   user unit is close to a CSS pixel and text in the chart lands on the
   type ramp rather than being shrunk by the scale factor. Below that
   width the frame scrolls rather than the type getting smaller. */
const W = 680;
const H = 300;
const PAD = { l: 58, r: 26, t: 26, b: 44 };

const at = (iso: string): number => Date.parse(`${iso}T00:00:00Z`);

/** Ascending, de-duplicated, and never reordered by anything but value. */
const uniqueSorted = (ns: number[]): number[] =>
  [...new Set(ns)].sort((a, b) => a - b);

/**
 * Lay a panel out.
 *
 * The y domain starts at zero, because a price axis that starts
 * somewhere else exaggerates every move on it, and this page is an
 * argument about how much prices moved.
 */
export function plot(series: PriceSeries[], showBreak = false): Plot {
  const all = series.flatMap((s) => s.points);
  const xs = all.map((p) => at(p.date));
  const breakX = showBreak ? at(BREAK.at) : null;

  const minX = Math.min(...xs, ...(breakX === null ? [] : [breakX]));
  const maxX = Math.max(...xs, ...(breakX === null ? [] : [breakX]));
  const maxY = Math.max(...all.map((p) => p.usd));

  const spanX = maxX - minX || 1;
  // Headroom is layout, not data: it keeps the top point off the frame.
  const spanY = maxY * 1.12 || 1;

  const sx = (ms: number) => PAD.l + ((ms - minX) / spanX) * (W - PAD.l - PAD.r);
  const sy = (usd: number) => H - PAD.b - (usd / spanY) * (H - PAD.t - PAD.b);

  const laid: PlotSeries[] = series.map((s) => {
    const points: PlotPoint[] = s.points.map((p, index) => ({
      ...p,
      index,
      seriesKey: s.key,
      x: sx(at(p.date)),
      y: sy(p.usd),
    }));
    return {
      key: s.key,
      name: s.name,
      unit: s.unit,
      points,
      // A run of one is a point standing alone. It is drawn as a point
      // and never as a line, which is the whole of the break mechanism.
      paths: s.runs.filter((r) => r.length > 1).map((r) => r.map((i) => points[i])),
    };
  });

  const yTicks = uniqueSorted(all.map((p) => p.usd)).map((usd) => ({ usd, y: sy(usd) }));

  return {
    width: W,
    height: H,
    pad: PAD,
    series: laid,
    yTicks,
    yLabels: yTicks.length < 2 ? yTicks : [yTicks[0], yTicks[yTicks.length - 1]],
    xTicks: uniqueSorted(xs).map((ms) => ({
      date: all.find((p) => at(p.date) === ms)!.date,
      x: sx(ms),
    })),
    break: breakX === null ? null : { x: sx(breakX), label: BREAK.label, source: BREAK.source },
  };
}

/** `M x y L x y …`, so a path is one string and one place computes it. */
export function pathD(points: PlotPoint[]): string {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
}

/**
 * What a point says when a reader lands on it, in words rather than a
 * pair of coordinates. Used for the accessible name and for the readout,
 * so the two cannot come to say different things.
 */
export function readPoint(series: PlotSeries, p: PlotPoint): string {
  const tier = p.tier ? ` (${p.tier})` : '';
  return `${series.name}, ${p.date}: ${listPrice(p.usd)}${tier} ${series.unit}`;
}

/**
 * A list price, written the way a seller writes one.
 *
 * `usd()` in lib/format.ts rounds to whole dollars below a thousand,
 * because everything it was built for is a corporate total where cents
 * are noise. Here the cents are the subject — $1.99 is not $2 — so this
 * is the one other money formatter in the app, kept beside the only
 * data that needs it.
 */
export function listPrice(n: number): string {
  return `$${n.toFixed(2)}`;
}
