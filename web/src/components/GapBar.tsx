import { usd } from '../lib/format';
import { COPY } from '../lib/labels';

/* ===================================================================
   The signature element: solid ledger green for the traced portion,
   diagonal audit hatch in pencil red for the portion that is not.

   It is the argument of the whole project in one mark, so it is never
   restyled into a progress bar, never given rounded corners, and never
   drawn without its two figures written out beside it. An unlabelled
   hatched bar is not an encoding — the previous build had a whole table
   column of them, and a reader had to go hunting for a legend to learn
   that the hatch meant anything at all.
   =================================================================== */

interface Props {
  claimed: number;
  traced: number;
  /** Shared across the app so two bars in different places compare. */
  max: number;
  size?: 'row' | 'lg';
  /** Written out beside the bar. Off only where the same two figures
   *  are already set as their own typographic block. */
  labels?: boolean;
}

export function GapBar({ claimed, traced, max, size = 'row', labels = true }: Props) {
  const safeMax = Math.max(max, 1);
  const width = claimed > 0 ? Math.max((claimed / safeMax) * 100, 0.6) : 0;
  const tracedShare = claimed > 0 ? Math.min(Math.max(traced / claimed, 0), 1) * 100 : 0;
  const over = traced > claimed && claimed > 0;

  const text =
    claimed > 0
      ? `${usd(traced)} of ${usd(claimed)} traceable to a filing line`
      : 'No figure stated in dollars';

  return (
    <div className={'gapbar-wrap' + (size === 'lg' ? ' is-lg' : '')}>
      <div className="gapbar" role="img" aria-label={text}>
        {claimed > 0 ? (
          <div className="gapbar-fill" style={{ width: `${width}%` }}>
            <div className="gapbar-traced" style={{ width: `${tracedShare}%` }} />
          </div>
        ) : (
          <div className="gapbar-none" />
        )}
      </div>

      {labels && (
        <div className="gapbar-legend">
          {claimed > 0 ? (
            <>
              <span className="is-traced">{usd(traced)} traceable</span>
              <span className="is-gap">{usd(claimed - traced)} not</span>
            </>
          ) : (
            <span className="is-null">No figure stated in dollars</span>
          )}
        </div>
      )}

      {over && (
        <p className="gapbar-flag">
          More is coded as traceable ({usd(traced)}) than was claimed ({usd(claimed)}). That is a
          defect in the coding of this row, shown rather than clamped away.
        </p>
      )}
    </div>
  );
}

/** The key, rendered once per view that uses bars — never hunted for. */
export function GapKey() {
  return (
    <p className="gapkey">
      <span className="gapkey-swatch is-traced-swatch" aria-hidden="true" />
      <span>{COPY.traced}</span>
      <span className="gapkey-swatch is-gap-swatch" aria-hidden="true" />
      <span>{COPY.untraced}</span>
    </p>
  );
}
