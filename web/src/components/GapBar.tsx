import { usd } from '../lib/format';
import { COPY } from '../lib/labels';

/**
 * The signature element. One bar per claim:
 *   solid green  the portion matched to a disclosed line item
 *   hatched red  asserted, but not matched to one
 *   empty        the rest of the scale, so bars compare to each other
 *
 * Repeated down a list it stops being a chart and becomes the argument.
 */
export function GapBar({
  claimed, traced, max, large,
}: { claimed: number | null; traced: number | null; max: number; large?: boolean }) {
  const c = claimed ?? 0;
  const t = Math.max(0, Math.min(traced ?? 0, c));
  const scale = max > 0 ? max : 1;
  const tracedPct = (t / scale) * 100;
  const gapPct = ((c - t) / scale) * 100;

  const label =
    c === 0
      ? 'No dollar figure attached'
      : `${usd(c)} claimed · ${usd(t)} traceable to a filing line · ${usd(c - t)} not`;

  return (
    <div className={'gapbar' + (large ? ' gapbar-lg' : '')} role="img" aria-label={label} title={label}>
      {tracedPct > 0 && <div className="seg-traced" style={{ width: `${tracedPct}%` }} />}
      {gapPct > 0 && <div className="seg-gap" style={{ width: `${gapPct}%` }} />}
      <div className="seg-empty" />
    </div>
  );
}

export function GapLegend() {
  return (
    <div className="gap-legend">
      <span><i className="swatch traced" /> {COPY.traced}</span>
      <span title={COPY.untracedMeaning}><i className="swatch gap" /> {COPY.untraced}</span>
      <span><i className="swatch transfer" /> {COPY.absorbed}</span>
    </div>
  );
}
