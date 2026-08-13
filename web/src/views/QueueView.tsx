import { useMemo } from 'react';
import { ClaimTags } from '../components/Tag';
import { shortDate } from '../lib/format';
import { sourceLinks } from '../lib/sourceLinks';
import type { LedgerRow } from '../lib/types';

const ORDER: Record<string, number> = {
  disputed: 0,
  needs_primary_source: 1,
  secondary_only: 2,
  verified_primary: 3,
};

/**
 * The verification queue. Most rows deliberately carry no stored URL, because
 * a URL written from memory is worse than none: it looks verified. Each row
 * carries the exact next step instead, and a link straight to the index where
 * that step gets done.
 */
export function QueueView({ rows }: { rows: LedgerRow[] }) {
  const queue = useMemo(
    () =>
      rows
        .filter((r) => r.verification_status !== 'verified_primary')
        .sort(
          (a, b) =>
            (ORDER[a.verification_status] ?? 9) - (ORDER[b.verification_status] ?? 9) ||
            (b.claimed_amount_usd ?? 0) - (a.claimed_amount_usd ?? 0),
        ),
    [rows],
  );

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.verification_status] = (acc[r.verification_status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      <div className="figures">
        <div className="figure">
          <span className="label">Verified primary</span>
          <span className="value is-traced">{counts.verified_primary ?? 0}</span>
          <span className="sub">filing, administrative data or peer review</span>
        </div>
        <div className="figure">
          <span className="label">Secondary only</span>
          <span className="value">{counts.secondary_only ?? 0}</span>
          <span className="sub">usable, not yet tied to a primary</span>
        </div>
        <div className="figure">
          <span className="label">Needs a primary source</span>
          <span className="value is-gap">{counts.needs_primary_source ?? 0}</span>
          <span className="sub">work queue</span>
        </div>
        <div className="figure">
          <span className="label">Disputed</span>
          <span className="value is-gap">{counts.disputed ?? 0}</span>
          <span className="sub">sources conflict; do not cite</span>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="empty"><strong>Everything in this selection has a primary source.</strong></div>
      ) : (
        <div className="table-wrap">
          <table className="ledger">
            <thead>
              <tr>
                <th>Row</th><th>Status</th><th>Next step</th><th>Go</th>
              </tr>
            </thead>
            <tbody>
              {queue.map((r) => (
                <tr key={r.id} style={{ cursor: 'default' }}>
                  <td className="claim-cell">
                    <div className="headline">{r.headline}</div>
                    <div className="meta">
                      {r.company_name} · {shortDate(r.claim_date)} <ClaimTags row={r} />
                    </div>
                  </td>
                  <td style={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                    {r.verification_status.replace(/_/g, ' ')}
                  </td>
                  <td style={{ fontFamily: 'var(--font-serif)', fontSize: 14, maxWidth: '38ch' }}>
                    {r.verify_hint ?? '—'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {sourceLinks(r).map((l) => (
                      <div key={l.href}>
                        <a href={l.href} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>{l.label} →</a>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
