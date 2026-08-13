import { useEffect, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { bps, pct, ratioAsPct, shortDate, usd } from '../lib/format';
import { sourceLinks } from '../lib/sourceLinks';
import { DESTINATIONS } from '../lib/labels';
import type { LedgerRow } from '../lib/types';
import { GapBar } from './GapBar';

/** The expanded row. Everything the coding says, plus the machine-maintained
 *  half: what the operating margin actually did on either side of the claim. */
export function ClaimDetail({ row, onFilterCompany }: { row: LedgerRow; onFilterCompany: (slug: string) => void }) {
  const links = sourceLinks(row);

  return (
    <div className="detail">
      <div className="detail-inner">
        <div>
          <div className="field">
            <h4>Claim</h4>
            <p>{row.claim_detail ?? row.headline}</p>
          </div>

          <div className="field">
            <h4>What the number actually is</h4>
            <p>{row.measurement_definition ?? 'Not established. Until it is, this row cannot be coded.'}</p>
          </div>

          <div className="field">
            <h4>Where it landed — {DESTINATIONS[row.destination].name}</h4>
            <p>{row.destination_rationale ?? DESTINATIONS[row.destination].meaning}</p>
          </div>

          {row.reconciliation_note && (
            <div className="field">
              <h4>Reconciliation</h4>
              <p>{row.reconciliation_note}</p>
            </div>
          )}

          {row.observed_counter_move && (
            <div className="field counter">
              <h4>What moved the other way</h4>
              <p>{row.observed_counter_move}</p>
            </div>
          )}

          {row.counterparty_absorbed && (
            <div className="field">
              <h4>Counterparty</h4>
              <p>
                {row.counterparty_name
                  ? `${row.counterparty_name} is on the receiving end of this transfer.`
                  : 'A counterparty absorbed the loss, but no specific firm has been established.'}
                {row.counterparty_note ? ` ${row.counterparty_note}` : ''}
              </p>
            </div>
          )}

          {row.conditions_note && (
            <div className="field">
              <h4>Three conditions</h4>
              <p>{row.conditions_note}</p>
            </div>
          )}

          {row.verify_hint && (
            <div className="field">
              <h4>Next step to verify</h4>
              <p className="mono">{row.verify_hint}</p>
            </div>
          )}

          <div className="field">
            <h4>Source</h4>
            <p className="mono">
              {row.source_name ?? 'unattributed'}
              {row.source_type ? ` · ${row.source_type.replace(/_/g, ' ')}` : ''}
              {row.source_date ? ` · ${shortDate(row.source_date)}` : ''}
            </p>
            <div className="links">
              {links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer">{l.label} →</a>
              ))}
              <button className="btn ghost" onClick={() => onFilterCompany(row.company_slug)}>
                All {row.company_name} rows
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="field">
            <h4>Reconciliation</h4>
            <GapBar
              claimed={row.claimed_amount_usd}
              traced={row.traceable_to_pl_usd}
              max={row.claimed_amount_usd ?? 1}
              large
            />
            <dl className="kv" style={{ marginTop: 8 }}>
              <dt>Claimed</dt><dd>{usd(row.claimed_amount_usd)}</dd>
              <dt>Tied to a line</dt><dd>{usd(row.traceable_to_pl_usd)}</dd>
              <dt>Not tied out</dt><dd style={{ color: 'var(--gap)' }}>{usd(row.unreconciled_usd)}</dd>
              {row.transfer_amount_usd ? (
                <>
                  <dt>Transferred</dt><dd style={{ color: 'var(--transfer)' }}>{usd(row.transfer_amount_usd)}</dd>
                </>
              ) : null}
            </dl>
          </div>

          <div className="field">
            <h4>Operating margin, measured</h4>
            <MarginChart slug={row.company_slug} claimDate={row.claim_date} />
            <dl className="kv" style={{ marginTop: 6 }}>
              <dt>At the claim</dt><dd>{ratioAsPct(row.margin_baseline)}</dd>
              <dt>One quarter later</dt><dd>{bps(row.margin_delta_1q_bps)}</dd>
              <dt>One year later</dt>
              <dd style={{ color: deltaColor(row.margin_delta_4q_bps) }}>{bps(row.margin_delta_4q_bps)}</dd>
              <dt>Share price, one year</dt><dd>{pct(row.price_delta_4q)}</dd>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function deltaColor(n: number | null): string {
  if (n === null || n === undefined) return 'inherit';
  return n > 0 ? 'var(--traced)' : n < 0 ? 'var(--gap)' : 'inherit';
}

/**
 * The margin series for this company with a rule at the claim date. The
 * chart is deliberately small and unlabelled beyond the axis: the question
 * it answers is "did the line move", and anything more competes with the
 * numbers beside it.
 */
function MarginChart({ slug, claimDate }: { slug: string; claimDate: string }) {
  const [data, setData] = useState<Array<{ date: string; margin: number }> | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: co } = await supabase.from('companies').select('id').eq('slug', slug).limit(1);
      const id = co?.[0]?.id;
      if (!id) { if (alive) setData([]); return; }
      const { data: obs } = await supabase
        .from('observations')
        .select('observed_at,value')
        .eq('company_id', id)
        .eq('series_key', 'operating_margin_q')
        .order('observed_at', { ascending: true });
      if (alive) {
        setData((obs ?? []).map((o: any) => ({ date: o.observed_at, margin: Number(o.value) * 100 })));
      }
    })();
    return () => { alive = false; };
  }, [slug]);

  if (data === null) return <p className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>Loading…</p>;
  if (data.length < 2) {
    return (
      <p className="mono" style={{ fontSize: 12, color: 'var(--ink-3)' }}>
        No margin series. Either the entity does not file with the SEC, or the collector has not run yet.
      </p>
    );
  }

  return (
    <div style={{ height: 150 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 6, right: 8, bottom: 0, left: -14 }}>
          <CartesianGrid stroke="#c9d2d9" strokeDasharray="2 3" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }}
            tickFormatter={(d: string) => d.slice(2, 7)}
            stroke="#7c8b97"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 10, fontFamily: 'IBM Plex Mono' }}
            stroke="#7c8b97"
            tickFormatter={(v: number) => `${v.toFixed(0)}%`}
            width={44}
          />
          <Tooltip
            formatter={(v: any) => [`${Number(v).toFixed(2)}%`, 'Operating margin']}
            contentStyle={{ fontFamily: 'IBM Plex Mono', fontSize: 12, border: '1px solid #a5b3bd' }}
          />
          <ReferenceLine x={nearestDate(data, claimDate)} stroke="#a8391f" strokeDasharray="4 2" />
          <Line type="monotone" dataKey="margin" stroke="#2c5c8c" strokeWidth={1.6} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Recharts needs a category value that exists in the data, so snap the claim
 *  date to the nearest observed period rather than dropping the marker. */
function nearestDate(data: Array<{ date: string }>, target: string): string | undefined {
  let best: string | undefined;
  let bestGap = Infinity;
  for (const d of data) {
    const gap = Math.abs(Date.parse(d.date) - Date.parse(target));
    if (gap < bestGap) { bestGap = gap; best = d.date; }
  }
  return best;
}


