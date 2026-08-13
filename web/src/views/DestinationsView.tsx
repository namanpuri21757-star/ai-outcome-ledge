import { useMemo } from 'react';
import { usd } from '../lib/format';
import { DESTINATIONS, type LedgerRow } from '../lib/types';

const ORDER = [1, 2, 3, 4, 5];

/**
 * The five destinations as five columns. Only the fifth is P&L margin, and
 * seeing the other four fill up is the fastest way to internalise why
 * use-case gains and EBIT impact are different questions.
 */
export function DestinationsView({
  rows, onPick,
}: { rows: LedgerRow[]; onPick: (destination: number) => void }) {
  const byDest = useMemo(() => {
    const map = new Map<number, LedgerRow[]>();
    for (const r of rows) {
      const list = map.get(r.destination) ?? [];
      list.push(r);
      map.set(r.destination, list);
    }
    return map;
  }, [rows]);

  const uncoded = byDest.get(0) ?? [];

  return (
    <>
      <div className="dest-grid">
        {ORDER.map((d) => {
          const list = (byDest.get(d) ?? []).sort(
            (a, b) => (b.claimed_amount_usd ?? 0) - (a.claimed_amount_usd ?? 0),
          );
          const money = list
            .filter((r) => r.claim_kind === 'gain_claim')
            .reduce((s, r) => s + (r.claimed_amount_usd ?? 0), 0);
          return (
            <div className="dest-col" key={d}>
              <header>
                <span className="n">Destination {d}</span>
                <h3>{DESTINATIONS[d].short}</h3>
                <div className="amount">{money > 0 ? usd(money) : '—'}</div>
                <div className="n">{list.length} row{list.length === 1 ? '' : 's'}</div>
              </header>
              <p className="why">{DESTINATIONS[d].long}</p>
              <div style={{ marginTop: 10 }}>
                {list.slice(0, 14).map((r) => (
                  <div className="dest-item" key={r.id} onClick={() => onPick(d)}>
                    <span className="co">{r.company_name}</span>
                    <div className="amt">
                      {r.claimed_amount_usd ? usd(r.claimed_amount_usd) + ' · ' : ''}
                      {r.headline.slice(0, 64)}{r.headline.length > 64 ? '…' : ''}
                    </div>
                  </div>
                ))}
                {list.length > 14 && (
                  <div className="dest-item" onClick={() => onPick(d)}>
                    <span className="amt">+{list.length - 14} more →</span>
                  </div>
                )}
                {list.length === 0 && <div className="amt" style={{ fontSize: 12, color: 'var(--ink-3)' }}>Empty in this selection.</div>}
              </div>
            </div>
          );
        })}
      </div>

      {uncoded.length > 0 && (
        <p className="note" style={{ marginTop: 16 }}>
          <strong>{uncoded.length}</strong> rows are uncoded — either the source never defined what was
          measured, or the row is context rather than a gain. Filter to destination "Uncoded" to work
          through them; each one that gets coded moves a number in the reconciliation.
        </p>
      )}
    </>
  );
}
