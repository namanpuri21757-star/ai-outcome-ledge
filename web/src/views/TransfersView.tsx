import { useMemo } from 'react';
import { transferEdges } from '../lib/filters';
import { usd } from '../lib/format';
import type { LedgerRow } from '../lib/types';

/**
 * When an enterprise reports "we saved $5M with AI", a large share of the
 * time a supplier lost $5M of revenue. That is a transfer, not a productivity
 * gain, and it nets to roughly zero in national accounts. This is the map of
 * who is taking it from whom.
 */
export function TransfersView({
  rows, onPick,
}: { rows: LedgerRow[]; onPick: (slug: string) => void }) {
  const edges = useMemo(() => transferEdges(rows), [rows]);

  if (edges.length === 0) {
    return (
      <div className="empty">
        <strong>No counterparty transfers in this selection.</strong>
        Turn on the "counterparty" filter, or clear the filters, to see the claims where somebody
        else's revenue line paid for the saving.
      </div>
    );
  }

  const sources = unique(edges.map((e) => ({ slug: e.fromSlug, name: e.fromName })));
  const sinks = unique(edges.map((e) => ({ slug: e.toSlug ?? 'unnamed', name: e.toName })));

  const rowH = 34;
  const height = Math.max(sources.length, sinks.length) * rowH + 60;
  const width = 900;
  const leftX = 210;
  const rightX = width - 210;
  const maxAmount = Math.max(1, ...edges.map((e) => e.amountUsd));

  const yOf = (list: Array<{ slug: string }>, slug: string) =>
    40 + list.findIndex((n) => n.slug === slug) * rowH;

  return (
    <>
      <svg className="transfer-svg" viewBox={`0 0 ${width} ${height}`} role="img"
           aria-label="Map of claimed savings and the counterparties that absorbed them">
        <text x={leftX} y={22} textAnchor="end" className="muted">CLAIMS THE SAVING</text>
        <text x={rightX} y={22} className="muted">ABSORBS THE LOSS</text>

        {edges.map((e) => {
          const y1 = yOf(sources, e.fromSlug);
          const y2 = yOf(sinks, e.toSlug ?? 'unnamed');
          const w = e.amountUsd > 0 ? 1 + (e.amountUsd / maxAmount) * 9 : 1;
          const mid = (leftX + rightX) / 2;
          return (
            <path
              key={`${e.fromSlug}-${e.toSlug}`}
              className="edge"
              strokeWidth={w}
              d={`M ${leftX + 8} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${rightX - 8} ${y2}`}
            >
              <title>
                {e.fromName} → {e.toName}: {e.claims} claim{e.claims === 1 ? '' : 's'}
                {e.amountUsd > 0 ? `, ${usd(e.amountUsd)} identified` : ', amount not established'}
              </title>
            </path>
          );
        })}

        {sources.map((n) => (
          <g key={n.slug} onClick={() => onPick(n.slug)} style={{ cursor: 'pointer' }}>
            <circle className="node" cx={leftX + 8} cy={yOf(sources, n.slug)} r={5} />
            <text x={leftX - 6} y={yOf(sources, n.slug) + 4} textAnchor="end">{n.name}</text>
          </g>
        ))}

        {sinks.map((n) => (
          <g key={n.slug} onClick={() => n.slug !== 'unnamed' && onPick(n.slug)}
             style={{ cursor: n.slug === 'unnamed' ? 'default' : 'pointer' }}>
            <circle className="node sink" cx={rightX - 8} cy={yOf(sinks, n.slug)} r={5} />
            <text x={rightX + 6} y={yOf(sinks, n.slug) + 4}
                  className={n.slug === 'unnamed' ? 'muted' : ''}>{n.name}</text>
          </g>
        ))}
      </svg>

      <p className="note" style={{ marginTop: 14 }}>
        Line thickness is the identified transfer amount; a hairline means a counterparty absorbed the
        loss but nobody has established how much. If a thesis helps a firm convert AI capacity into
        margin, this is the map of whose revenue line it comes from.
      </p>

      <div className="table-wrap" style={{ marginTop: 14 }}>
        <table className="ledger">
          <thead>
            <tr><th>Claims the saving</th><th>Absorbs the loss</th><th>Rows</th><th style={{ textAlign: 'right' }}>Identified</th></tr>
          </thead>
          <tbody>
            {edges.map((e) => (
              <tr key={`${e.fromSlug}-${e.toSlug}`} onClick={() => onPick(e.fromSlug)}>
                <td className="company-cell">{e.fromName}</td>
                <td>{e.toName}</td>
                <td className="num">{e.claims}</td>
                <td className="num">{e.amountUsd > 0 ? usd(e.amountUsd) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function unique(nodes: Array<{ slug: string; name: string }>): Array<{ slug: string; name: string }> {
  const map = new Map<string, string>();
  for (const n of nodes) if (!map.has(n.slug)) map.set(n.slug, n.name);
  return [...map.entries()].map(([slug, name]) => ({ slug, name }));
}
