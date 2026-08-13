import { useMemo } from 'react';
import type { LedgerRow } from '../lib/types';
import { transferEdges } from '../lib/filters';
import { usd } from '../lib/format';

/**
 * Who is taking it from whom. A buyer's saving is often a supplier's
 * revenue decline, which nets to roughly zero in aggregate — so if a
 * thesis helps a firm convert AI capacity into margin, this is the map
 * of whose revenue line it comes from.
 */
export function TransfersView({
  rows, onCompany,
}: { rows: LedgerRow[]; onCompany: (slug: string, context: string) => void }) {
  const edges = useMemo(() => transferEdges(rows), [rows]);

  const { lefts, rights } = useMemo(() => {
    const l = [...new Set(edges.map((e) => e.fromSlug))];
    const r = [...new Set(edges.map((e) => e.toSlug ?? 'unnamed'))];
    return { lefts: l, rights: r };
  }, [edges]);

  if (edges.length === 0) {
    return (
      <div className="empty">
        <strong>No transfers in this selection.</strong>
        No row here records a saving that came off another company's revenue line.
      </div>
    );
  }

  const rowH = 46;
  const height = Math.max(lefts.length, rights.length) * rowH + 48;
  const maxAmt = Math.max(...edges.map((e) => e.amountUsd), 1);
  const yLeft = (slug: string) => 30 + lefts.indexOf(slug) * rowH;
  const yRight = (slug: string) => 30 + rights.indexOf(slug) * rowH;

  return (
    <>
      <svg className="transfer-svg" viewBox={`0 0 900 ${height}`} role="img"
        aria-label="Flow of savings from the company claiming them to the supplier absorbing the loss">
        <text x="300" y="16" textAnchor="end" className="muted">CLAIMS THE SAVING</text>
        <text x="600" y="16" className="muted">ABSORBS THE LOSS</text>

        {edges.map((e) => {
          const y1 = yLeft(e.fromSlug);
          const y2 = yRight(e.toSlug ?? 'unnamed');
          const w = e.amountUsd > 0 ? 1.5 + (e.amountUsd / maxAmt) * 14 : 1;
          return (
            <path
              key={`${e.fromSlug}-${e.toSlug ?? 'unnamed'}`}
              className="edge"
              strokeWidth={w}
              d={`M310 ${y1} C 440 ${y1}, 460 ${y2}, 590 ${y2}`}
            >
              <title>
                {e.fromName} → {e.toName}: {e.claims} row{e.claims === 1 ? '' : 's'}
                {e.amountUsd > 0 ? `, ${usd(e.amountUsd)} identified` : ', amount not established'}
              </title>
            </path>
          );
        })}

        {lefts.map((slug) => {
          const e = edges.find((x) => x.fromSlug === slug)!;
          return (
            <g key={slug} onClick={() => onCompany(slug, 'claims the saving')} style={{ cursor: 'pointer' }}>
              <text x="298" y={yLeft(slug) + 4} textAnchor="end">{e.fromName}</text>
              <circle className="node" cx="310" cy={yLeft(slug)} r="6" />
            </g>
          );
        })}

        {rights.map((slug) => {
          const e = edges.find((x) => (x.toSlug ?? 'unnamed') === slug)!;
          const named = slug !== 'unnamed';
          return (
            <g key={slug}
              onClick={() => named && onCompany(slug, 'absorbs the loss')}
              style={{ cursor: named ? 'pointer' : 'default' }}>
              <circle className="node sink" cx="590" cy={yRight(slug)} r="6" />
              <text x="604" y={yRight(slug) + 4} className={named ? '' : 'muted'}>{e.toName}</text>
            </g>
          );
        })}
      </svg>

      <p className="note">
        Line thickness is the identified transfer amount. A hairline means a supplier absorbed the
        loss but nobody has established how much — which is the honest state of most of these rows.
      </p>

      <div className="table-wrap">
        <table className="ledger">
          <thead>
            <tr>
              <th>Claims the saving</th>
              <th>Absorbs the loss</th>
              <th className="num">Rows</th>
              <th className="num">Identified</th>
            </tr>
          </thead>
          <tbody>
            {edges.map((e) => (
              <tr key={`${e.fromSlug}-${e.toSlug ?? 'unnamed'}`}
                onClick={() => onCompany(e.fromSlug, 'claims the saving')}>
                <td><strong>{e.fromName}</strong></td>
                <td className={e.toSlug ? '' : 'is-null'}>{e.toName}</td>
                <td className="num">{e.claims}</td>
                <td className={'num ' + (e.amountUsd > 0 ? '' : 'is-null')}>
                  {e.amountUsd > 0 ? usd(e.amountUsd) : 'not established'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
