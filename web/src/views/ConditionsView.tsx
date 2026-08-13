import { useMemo } from 'react';
import { conditionCells } from '../lib/filters';
import { bps } from '../lib/format';
import type { LedgerRow } from '../lib/types';

/**
 * The three conditions, as a 2x2x2, populated with live data.
 *
 *   1. The billing unit survives the automation
 *   2. There is a demand sink for the freed capacity
 *   3. There is permission to act on it
 *
 * The claim in the source research is that meeting two of three produces
 * operational improvement and no EBIT effect, and that meeting all three is
 * what the roughly 6% of high performers have. This is where that claim gets
 * tested rather than repeated: the mean margin movement per cell comes from
 * SEC filings, not from coding.
 */
export function ConditionsView({
  rows, onPick,
}: { rows: LedgerRow[]; onPick: (slug: string) => void }) {
  const cells = useMemo(() => conditionCells(rows).filter((c) => c.rows.length > 0), [rows]);
  const uncoded = rows.filter(
    (r) => r.cond_billing_unit_survives === null || r.cond_demand_sink === null || r.cond_permission_to_act === null,
  ).length;

  if (cells.length === 0) {
    return (
      <div className="empty">
        <strong>No rows in this selection have all three conditions coded.</strong>
        Clear the filters, or code the conditions on more rows.
      </div>
    );
  }

  return (
    <>
      <div className="cond-grid">
        {cells.map((c) => {
          const key = `${c.billing}-${c.sink}-${c.permission}`;
          const companies = [...new Set(c.rows.map((r) => r.company_slug))];
          return (
            <div className={`cond-cell pass-${c.passes}`} key={key}>
              <div className="flags">
                <span className={'flagpill ' + (c.billing ? 'on' : 'off')}>billing unit</span>
                <span className={'flagpill ' + (c.sink ? 'on' : 'off')}>demand sink</span>
                <span className={'flagpill ' + (c.permission ? 'on' : 'off')}>permission</span>
              </div>
              <span className="n">{c.rows.length}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-3)' }}>
                {' '}rows · {companies.length} companies · {c.passes}/3 conditions
              </span>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 4 }}>
                mean margin +1y:{' '}
                <strong style={{ color: c.meanMarginDelta4qBps === null ? 'var(--ink-3)'
                  : c.meanMarginDelta4qBps > 0 ? 'var(--traced)' : 'var(--gap)' }}>
                  {bps(c.meanMarginDelta4qBps)}
                </strong>
              </div>
              <ul>
                {c.rows.slice(0, 8).map((r) => (
                  <li key={r.id} onClick={() => onPick(r.company_slug)}>
                    <strong>{r.company_name}</strong> — {r.headline.slice(0, 58)}
                    {r.headline.length > 58 ? '…' : ''}
                  </li>
                ))}
                {c.rows.length > 8 && <li style={{ color: 'var(--ink-3)' }}>+{c.rows.length - 8} more</li>}
              </ul>
            </div>
          );
        })}
      </div>

      <p className="note" style={{ marginTop: 18 }}>
        Cells outlined in green pass all three conditions; the one outlined in red passes none.
        {uncoded > 0 && ` ${uncoded} rows in this selection are not yet coded on all three and are excluded.`}
        {' '}The mean margin figure is only as good as the number of public filers in each cell — treat a
        cell with two companies as a prompt to look, not as a result.
      </p>
    </>
  );
}
