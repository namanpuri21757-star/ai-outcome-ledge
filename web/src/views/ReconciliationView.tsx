import { useMemo } from 'react';
import { GapBar, GapLegend } from '../components/GapBar';
import { shortDate, usd } from '../lib/format';
import { totals } from '../lib/filters';
import type { LedgerRow } from '../lib/types';
import { DESTINATIONS } from '../lib/labels';

/**
 * Every dollar claim in the current filter, largest first, drawn on one
 * shared scale. The point of the view is the shape: the hatching runs almost
 * the whole width of almost every bar.
 */
export function ReconciliationView({
  rows, onSelect,
}: { rows: LedgerRow[]; onSelect: (slug: string) => void }) {
  const gains = useMemo(
    () =>
      rows
        .filter((r) => r.claim_kind === 'gain_claim' && (r.claimed_amount_usd ?? 0) > 0)
        .sort((a, b) => (b.claimed_amount_usd ?? 0) - (a.claimed_amount_usd ?? 0)),
    [rows],
  );
  const t = totals(rows);
  const max = Math.max(1, ...gains.map((r) => r.claimed_amount_usd ?? 0));

  return (
    <>
      <div className="figures">
        <div className="figure">
          <span className="label">Claimed</span>
          <span className="value">{usd(t.claimedUsd)}</span>
          <span className="sub">{t.dollarClaims} claims carrying a dollar figure</span>
        </div>
        <div className="figure">
          <span className="label">Tied to a disclosed line</span>
          <span className="value is-traced">{usd(t.tracedUsd)}</span>
          <span className="sub">{t.reconciledPct === null ? '—' : `${t.reconciledPct.toFixed(1)}% of claimed`}</span>
        </div>
        <div className="figure">
          <span className="label">Not tied out</span>
          <span className="value is-gap">{usd(t.unreconciledUsd)}</span>
          <span className="sub">asserted, unlocated</span>
        </div>
        <div className="figure">
          <span className="label">Absorbed by counterparties</span>
          <span className="value">{usd(t.transferredUsd)}</span>
          <span className="sub">someone else's revenue line</span>
        </div>
      </div>

      <div style={{ marginBottom: 14 }}><GapLegend /></div>

      {gains.length === 0 ? (
        <div className="empty">
          <strong>No dollar-denominated gain claims in this selection.</strong>
          Most claims are made in percentages, hours or headcount. Clear the filters to see the ones that carry money.
        </div>
      ) : (
        <div>
          {gains.map((r) => (
            <div className="recon-row" key={r.id} onClick={() => onSelect(r.company_slug)}>
              <div className="who">
                {r.company_name}
                <small>{shortDate(r.claim_date)} · {DESTINATIONS[r.destination].name}</small>
              </div>
              <div className="bar-cell">
                <GapBar claimed={r.claimed_amount_usd} traced={r.traceable_to_pl_usd} max={max} large />
                <div className="caption">{r.headline}</div>
              </div>
              <div className="num" style={{ fontSize: 15 }}>
                {usd(r.claimed_amount_usd)}
                <div style={{ fontSize: 11, color: 'var(--gap)' }}>{usd(r.unreconciled_usd)} open</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}


