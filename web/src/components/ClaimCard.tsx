import type { LedgerRow } from '../lib/types';
import { basis, destination, COPY } from '../lib/labels';
import { usd, shortDate, claimedValue } from '../lib/format';
import { sourceLinks } from '../lib/sourceLinks';
import { ClaimTags } from './Tag';
import { GapBar } from './GapBar';
import { DestinationLadder } from './DestinationLadder';
import { ConditionFlags } from './ConditionFlags';

/**
 * One claim, fully unpacked. Used on the company page and in the ledger
 * so a claim reads identically wherever you meet it — the same fields in
 * the same order, which is what lets you compare two of them.
 */
export function ClaimCard({
  row, max, onCompany,
}: { row: LedgerRow; max: number; onCompany?: (slug: string) => void }) {
  const d = destination(row.destination);
  const b = basis(row.measurement_basis);
  const links = sourceLinks(row);
  const hasMoney = (row.claimed_amount_usd ?? 0) > 0;

  return (
    <article className="claimcard">
      <header>
        <div className="claimcard-head">
          <h4 className="headline">{row.headline}</h4>
          <div className="claimcard-meta">
            <button
              type="button"
              className="linklike"
              onClick={() => onCompany?.(row.company_slug)}
              disabled={!onCompany}
            >
              {row.company_name}
            </button>
            <span className="dot-sep">·</span>
            <span>{shortDate(row.claim_date)}</span>
            {row.period_label && <><span className="dot-sep">·</span><span>{row.period_label}</span></>}
          </div>
        </div>
        <div className="claimcard-tags"><ClaimTags row={row} /></div>
      </header>

      <div className="claimcard-body">
        <div className="claimcard-main">
          {row.claim_detail && (
            <Field label="What was said">
              <p>{row.claim_detail}</p>
            </Field>
          )}

          <Field label={`What the number actually is — ${b.name.toLowerCase()}`}>
            <p>{row.measurement_definition ?? b.meaning}</p>
          </Field>

          {row.destination_rationale && (
            <Field label={`Where it landed — ${d.name.toLowerCase()}`}>
              <p>{row.destination_rationale}</p>
            </Field>
          )}

          {row.reconciliation_note && (
            <Field label="Reconciliation">
              <p>{row.reconciliation_note}</p>
            </Field>
          )}

          {row.observed_counter_move && (
            <Field label="What moved the other way">
              <p className="counter">{row.observed_counter_move}</p>
            </Field>
          )}

          {row.counterparty_absorbed && (
            <Field label="Who paid for it">
              <p>
                {row.counterparty_name
                  ? `Absorbed by ${row.counterparty_name}.`
                  : 'A supplier absorbed the loss, but nobody has established which one.'}
                {row.counterparty_note ? ` ${row.counterparty_note}` : ''}
              </p>
            </Field>
          )}

          {row.conditions_note && (
            <Field label="Conditions"><p>{row.conditions_note}</p></Field>
          )}

          {row.verify_hint && (
            <Field label="Next step to verify">
              <p className="mono">{row.verify_hint}</p>
            </Field>
          )}

          <Field label="Source">
            <p className="mono">
              {[row.source_name, row.source_type?.replace(/_/g, ' '), shortDate(row.source_date)]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {links.length > 0 && (
              <div className="links">
                {links.map((l) => (
                  <a key={l.href} href={l.href} target="_blank" rel="noreferrer noopener">
                    {l.label} →
                  </a>
                ))}
              </div>
            )}
          </Field>
        </div>

        <aside className="claimcard-side">
          <Field label="Where it landed">
            <DestinationLadder rank={row.destination} />
            <p className="small">{d.meaning}</p>
          </Field>

          {hasMoney && (
            <Field label="Reconciliation">
              <GapBar
                claimed={row.claimed_amount_usd}
                traced={row.traceable_to_pl_usd}
                max={max}
                large
              />
              <dl className="kv">
                <dt>Claimed</dt>
                <dd>{usd(row.claimed_amount_usd)}</dd>
                <dt>{COPY.tracedShort}</dt>
                <dd className="is-traced">{usd(row.traceable_to_pl_usd ?? 0)}</dd>
                <dt title={COPY.untracedMeaning}>{COPY.untracedShort}</dt>
                <dd className="is-gap">{usd(row.unreconciled_usd ?? 0)}</dd>
              </dl>
            </Field>
          )}

          {!hasMoney && row.claimed_value !== null && (
            <Field label="Claimed">
              <p className="mono big">{claimedValue(row.claimed_value, row.claimed_unit)}</p>
              <p className="small">No dollar figure attached, so this row does not enter the money totals.</p>
            </Field>
          )}

          <Field label="Three conditions">
            <ConditionFlags
              state={{
                billing: row.cond_billing_unit_survives,
                sink: row.cond_demand_sink,
                permission: row.cond_permission_to_act,
              }}
            />
          </Field>
        </aside>
      </div>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <h5>{label}</h5>
      {children}
    </div>
  );
}
