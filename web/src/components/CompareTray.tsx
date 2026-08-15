import type { CompanyProfile } from '../lib/companies';
import { GapBar } from './GapBar';
import { Sparkline } from './Sparkline';
import { marginSeries } from '../lib/patterns';
import { destination } from '../lib/labels';
import { usd, bps } from '../lib/format';
import { MAX_PINNED } from '../lib/route';

/* ===================================================================
   THE COMPARISON TRAY

   Pin up to four companies and their reconciliation bars stack
   directly above one another, on the one shared scale, which is the
   only arrangement in which two bars can actually be compared. Four
   is the cap because a fifth row pushes the first off the eye's reach
   and the comparison stops working.

   Pinned companies live in the URL, so a comparison is a link.
   =================================================================== */

export function CompareTray({
  profiles, pinned, max, onUnpin, onClear, onCompany,
}: {
  profiles: CompanyProfile[];
  pinned: string[];
  max: number;
  onUnpin: (slug: string) => void;
  onClear: () => void;
  onCompany: (slug: string, context: string) => void;
}) {
  // Keep the reader's pin order, not the roster's sort order.
  const rows = pinned
    .map((slug) => profiles.find((p) => p.slug === slug))
    .filter((p): p is CompanyProfile => !!p);

  if (rows.length === 0) return null;

  const missing = pinned.length - rows.length;

  return (
    <aside className="tray" aria-label="Pinned companies">
      <div className="tray-head">
        <strong>Comparing {rows.length}</strong>
        <span className="small">
          {rows.length < MAX_PINNED
            ? `Pin up to ${MAX_PINNED - rows.length} more.`
            : 'Tray full. Unpin one to add another.'}
        </span>
        <button type="button" className="linklike" onClick={onClear}>Clear</button>
      </div>

      <ul className="tray-rows">
        {rows.map((p) => {
          const d = p.dominantDestination;
          return (
            <li key={p.slug} className="tray-row">
              <button
                type="button"
                className="tray-name"
                onClick={() => onCompany(p.slug, 'the comparison tray')}
              >
                {p.name}
              </button>

              <GapBar claimed={p.claimedUsd} traced={p.tracedUsd} max={max} />

              <span className="tray-figure mono">{p.claimedUsd > 0 ? usd(p.claimedUsd) : '—'}</span>
              <span className="tray-figure mono is-gap">
                {p.claimedUsd > 0 ? usd(p.untracedUsd) : '—'}
              </span>
              <span className="tray-dest">
                {d !== null ? destination(d).name : <em>not coded</em>}
              </span>
              <span className="tray-cond mono">
                {p.conditionsPassed !== null ? `${p.conditionsPassed}/3` : '—'}
              </span>
              <span className="tray-margin mono">
                {p.marginDelta4qBps !== null ? bps(p.marginDelta4qBps) : '—'}
              </span>
              <Sparkline values={marginSeries(p)} width={52} height={16} />

              <button
                type="button"
                className="tray-remove"
                title={`Unpin ${p.name}`}
                onClick={() => onUnpin(p.slug)}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>

      {missing > 0 && (
        <p className="tray-missing small">
          {missing} pinned {missing === 1 ? 'company is' : 'companies are'} not in the current
          selection, so {missing === 1 ? 'it is' : 'they are'} not shown. Clear a filter to bring
          {missing === 1 ? ' it' : ' them'} back.
        </p>
      )}
    </aside>
  );
}
