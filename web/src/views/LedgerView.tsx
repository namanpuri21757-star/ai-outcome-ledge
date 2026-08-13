import { useMemo, useState } from 'react';
import { ClaimDetail } from '../components/ClaimDetail';
import { GapBar, GapLegend } from '../components/GapBar';
import { ClaimTags } from '../components/Tag';
import { bps, shortDate, usd } from '../lib/format';
import { sortRows, type SortKey } from '../lib/filters';
import { DESTINATIONS, type LedgerRow } from '../lib/types';

const COLUMNS: Array<{ key: SortKey; label: string; numeric?: boolean }> = [
  { key: 'company_name', label: 'Company' },
  { key: 'claim_date', label: 'Date' },
  { key: 'claimed_amount_usd', label: 'Claimed', numeric: true },
  { key: 'unreconciled_usd', label: 'Reconciliation' },
  { key: 'destination', label: 'Destination' },
  { key: 'margin_delta_4q_bps', label: 'Margin +1y', numeric: true },
];

export function LedgerView({
  rows, onFilterCompany,
}: { rows: LedgerRow[]; onFilterCompany: (slug: string) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'claim_date', dir: 'desc',
  });
  const [open, setOpen] = useState<string | null>(null);

  const sorted = useMemo(() => sortRows(rows, sort.key, sort.dir), [rows, sort]);
  const max = useMemo(
    () => Math.max(1, ...rows.filter((r) => r.claim_kind === 'gain_claim').map((r) => r.claimed_amount_usd ?? 0)),
    [rows],
  );

  const clickHeader = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }));

  if (rows.length === 0) {
    return (
      <div className="empty">
        <strong>Nothing matches those filters.</strong>
        Widen the search, or clear the filters to see all rows.
      </div>
    );
  }

  return (
    <>
      <div style={{ marginBottom: 10 }}><GapLegend /></div>
      <div className="table-wrap">
        <table className="ledger">
          <thead>
            <tr>
              <th style={{ cursor: 'default' }}>Claim</th>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  onClick={() => clickHeader(c.key)}
                  style={{ textAlign: c.numeric ? 'right' : 'left' }}
                  scope="col"
                >
                  {c.label}
                  {sort.key === c.key && <span className="dir"> {sort.dir === 'asc' ? '↑' : '↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isOpen = open === r.id;
              return (
                <>
                  <tr
                    key={r.id}
                    className={isOpen ? 'is-open' : ''}
                    onClick={() => setOpen(isOpen ? null : r.id)}
                  >
                    <td className="claim-cell">
                      <div className="headline">{r.headline}</div>
                      <div className="meta"><ClaimTags row={r} /></div>
                    </td>
                    <td className="company-cell">
                      {r.company_name}
                      <span className="grp">{r.group_code} · {r.sector}</span>
                    </td>
                    <td className="num">{shortDate(r.claim_date)}</td>
                    <td className={'num' + (r.claimed_amount_usd ? '' : ' is-null')}>
                      {r.claimed_amount_usd ? usd(r.claimed_amount_usd) : '—'}
                    </td>
                    <td style={{ minWidth: 130 }}>
                      {r.claim_kind === 'gain_claim' && r.claimed_amount_usd ? (
                        <GapBar claimed={r.claimed_amount_usd} traced={r.traceable_to_pl_usd} max={max} />
                      ) : (
                        <span className="num is-null" style={{ fontSize: 11 }}>n/a</span>
                      )}
                    </td>
                    <td style={{ whiteSpace: 'nowrap', fontSize: 13 }} title={DESTINATIONS[r.destination].long}>
                      {r.destination === 0 ? '—' : `${r.destination} ${DESTINATIONS[r.destination].short}`}
                    </td>
                    <td className={'num ' + deltaClass(r.margin_delta_4q_bps)}>
                      {bps(r.margin_delta_4q_bps)}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={r.id + '-detail'}>
                      <td colSpan={7} style={{ padding: 0 }}>
                        <ClaimDetail row={r} onFilterCompany={onFilterCompany} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function deltaClass(n: number | null): string {
  if (n === null || n === undefined) return 'is-null';
  return n > 0 ? 'is-traced' : n < 0 ? 'is-gap' : '';
}
