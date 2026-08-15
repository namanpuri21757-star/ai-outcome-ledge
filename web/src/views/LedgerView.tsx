import { Fragment, useMemo, useState } from 'react';
import type { LedgerRow } from '../lib/types';
import { sortRows, type SortKey } from '../lib/filters';
import { usd, bps, shortDate, clip } from '../lib/format';
import { basis } from '../lib/labels';
import { GapBar } from '../components/GapBar';
import { ClaimTags } from '../components/Tag';
import { DestinationLadder } from '../components/DestinationLadder';
import { ClaimCard } from '../components/ClaimCard';

/**
 * The raw table, demoted to where it belongs: an appendix rather than a
 * front door. Sort any column, open any row.
 *
 * Rows open into the same ClaimCard used on the company page, so a claim
 * reads identically wherever you meet it.
 *
 * Below `--table-stack` the table stops being a table. A seven-column
 * grid on a 390px screen scrolled sideways, and everything after the
 * claim text — the dollar figure, the reconciliation bar, where it
 * landed, what the margin did — sat off the right-hand edge. Those are
 * the columns the page exists for. Each row becomes a block instead,
 * carrying its own column names, and nothing scrolls sideways.
 */

/** Column names, declared once and used for both the header cell and
 *  the label each cell carries when the table stacks. Two copies of a
 *  column name is two things to forget to change. */
const COLUMNS = {
  company: 'Company',
  claim: 'Claim',
  date: 'Date',
  claimed: 'Claimed',
  reconciliation: 'Reconciliation',
  destination: 'Where it landed',
  margin: 'Margin +1y',
} as const;
export function LedgerView({
  rows, max, onCompany,
}: { rows: LedgerRow[]; max: number; onCompany: (slug: string, context: string) => void }) {
  const [key, setKey] = useState<SortKey>('claim_date');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const [openId, setOpenId] = useState<string | null>(null);

  const sorted = useMemo(() => sortRows(rows, key, dir), [rows, key, dir]);

  const head = (k: SortKey, label: string, cls = '') => (
    <th
      className={cls}
      onClick={() => {
        if (k === key) setDir(dir === 'asc' ? 'desc' : 'asc');
        else { setKey(k); setDir('desc'); }
      }}
      aria-sort={k === key ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      {label} {k === key && <span className="dir">{dir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  );

  if (rows.length === 0) {
    return (
      <div className="empty">
        <strong>No rows match this selection.</strong>
        Remove a filter chip above to widen it.
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table className="ledger">
        <thead>
          <tr>
            {head('company_name', COLUMNS.company)}
            <th>{COLUMNS.claim}</th>
            {head('claim_date', COLUMNS.date, 'num')}
            {head('claimed_amount_usd', COLUMNS.claimed, 'num')}
            <th>{COLUMNS.reconciliation}</th>
            {head('destination', COLUMNS.destination)}
            {head('margin_delta_4q_bps', COLUMNS.margin, 'num')}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const open = openId === r.id;
            return (
              // The key belongs on the fragment: it is the array element.
              // With it on the inner rows React saw an unkeyed list and
              // reused the wrong row when the sort changed.
              <Fragment key={r.id}>
                <tr
                  className={open ? 'is-open' : ''}
                  onClick={() => setOpenId(open ? null : r.id)}
                >
                  <td className="company-cell" data-label={COLUMNS.company}>
                    <button
                      type="button"
                      className="linklike"
                      onClick={(e) => { e.stopPropagation(); onCompany(r.company_slug, 'the ledger'); }}
                    >
                      {r.company_name}
                    </button>
                    <span className="grp">{r.sector ?? ''}</span>
                  </td>
                  <td className="claim-cell" data-label={COLUMNS.claim}>
                    <div className="headline">{clip(r.headline, 110)}</div>
                    <div className="meta"><ClaimTags row={r} /></div>
                  </td>
                  <td className="num" data-label={COLUMNS.date}>{shortDate(r.claim_date)}</td>
                  <td className={'num ' + (r.claimed_amount_usd ? '' : 'is-null')} data-label={COLUMNS.claimed}>
                    {r.claimed_amount_usd ? usd(r.claimed_amount_usd) : '—'}
                  </td>
                  <td data-label={COLUMNS.reconciliation}>
                    {r.claimed_amount_usd ? (
                      <GapBar claimed={r.claimed_amount_usd} traced={r.traceable_to_pl_usd} max={max} />
                    ) : (
                      <span className="small is-null">no dollar figure</span>
                    )}
                  </td>
                  <td data-label={COLUMNS.destination}><DestinationLadder rank={r.destination} compact /></td>
                  <td
                    data-label={COLUMNS.margin}
                    className={'num ' + (r.margin_delta_4q_bps === null ? 'is-null'
                      : r.margin_delta_4q_bps > 0 ? 'is-traced' : 'is-gap')}
                  >
                    {bps(r.margin_delta_4q_bps)}
                  </td>
                </tr>
                {open && (
                  <tr className="detail-row">
                    <td colSpan={7}>
                      <ClaimCard row={r} max={max} onCompany={(s) => onCompany(s, 'the ledger')} />
                      <p className="small is-null" style={{ padding: '0 18px 14px' }}>
                        Measurement basis code: <code>{r.measurement_basis}</code> ·{' '}
                        {basis(r.measurement_basis).name} · destination code{' '}
                        <code>{r.destination}</code> · row ref <code>{r.ref}</code>
                      </p>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
