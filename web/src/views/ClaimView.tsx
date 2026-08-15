import type { Dataset, LedgerRow } from '../lib/types';
import {
  CONDITION_LIST, TIERS, basis, destination, epistemic, kind, verification,
} from '../lib/labels';
import type { ConditionKey } from '../lib/labels';
import { claimedValue, usd } from '../lib/format';
import { MARGIN_SERIES, REVENUE_SERIES } from '../lib/outcome';
import { sourceLinks } from '../lib/sourceLinks';
import { GapBar } from '../components/GapBar';
import { Term } from '../components/Term';
import { MarginWindow } from '../components/MarginWindow';

/* ===================================================================
   One claim, fully unpacked. The only place a row is shown whole.

   This page is what makes "every number traceable to its row and its
   cited source in two clicks" true: the ledger lists it, this opens it,
   and the source sits on this page rather than one more click away.
   =================================================================== */

const CONDITION_FIELD: Record<ConditionKey, keyof LedgerRow> = {
  billing: 'cond_billing_unit_survives',
  sink: 'cond_demand_sink',
  permission: 'cond_permission_to_act',
};

interface Props {
  data: Dataset;
  claimRef: string;
  onCompany: (slug: string) => void;
  onBack: () => void;
}

export function ClaimView({ data, claimRef, onCompany, onBack }: Props) {
  const row = data.rows.find((r) => r.ref === claimRef);

  if (!row) {
    return (
      <div className="empty">
        <p>
          <strong>No claim with the reference “{claimRef}”.</strong>
        </p>
        <p>
          Every row in this ledger has a stable reference, so a link that used to work should still
          work. This one does not match any of the {data.rows.length} published rows — it may have
          been retracted, or renamed during coding.
        </p>
        <button type="button" className="btn" onClick={onBack}>
          Back to the ledger
        </button>
      </div>
    );
  }

  const d = destination(row.destination);
  const b = basis(row.measurement_basis);
  const claimed = row.claimed_amount_usd ?? 0;
  const traced = row.traceable_to_pl_usd ?? 0;
  const series = data.series.get(row.company_slug);
  const links = sourceLinks(row);

  const counterEvidence = data.rows.filter(
    (r) =>
      r.company_slug === row.company_slug &&
      r.ref !== row.ref &&
      (r.claim_kind === 'counter_evidence' || r.observed_counter_move),
  );

  return (
    <article className="claim">
      <nav className="crumb">
        <button type="button" onClick={onBack}>
          The ledger
        </button>
        <span aria-hidden="true">/</span>
        <button type="button" onClick={() => onCompany(row.company_slug)}>
          {row.company_name}
        </button>
      </nav>

      <header className="claim-head">
        <p className="claim-meta">
          <span>{row.company_name}</span>
          <span aria-hidden="true">·</span>
          <span>{row.claim_date}</span>
          {row.period_label && (
            <>
              <span aria-hidden="true">·</span>
              <span>{row.period_label}</span>
            </>
          )}
          <span aria-hidden="true">·</span>
          <Term kind="kind" code={row.claim_kind}>
            {kind(row.claim_kind).name}
          </Term>
        </p>

        {/* Serif, because this is the claim as asserted — quoted disclosure. */}
        <h2 className="claim-headline">{row.headline}</h2>
        {row.claim_detail && <p className="claim-detail">{row.claim_detail}</p>}
      </header>

      {/* ── Reconciliation ─────────────────────────────────────── */}
      <section className="claim-block" aria-labelledby="recon-h">
        <h3 id="recon-h">Can this number be found in a filing?</h3>

        {row.claim_kind !== 'gain_claim' ? (
          <p className="claim-null">
            This row is coded as <Term kind="kind" code={row.claim_kind} />, not as a gain claim, so
            it is not reconciled against a filing and it does not enter any money total on this
            site. {kind(row.claim_kind).meaning}
          </p>
        ) : claimed > 0 ? (
          <>
            <dl className="kv">
              <div>
                <dt>
                  <Term kind="phrase" code="claimed">Claimed</Term>
                </dt>
                <dd className="num">{usd(claimed)}</dd>
              </div>
              <div>
                <dt>
                  <Term kind="phrase" code="traceable">Traceable to a filing line</Term>
                </dt>
                <dd className="num is-traced">{usd(traced)}</dd>
              </div>
              <div>
                <dt>
                  <Term kind="phrase" code="untraceable">Not traceable</Term>
                </dt>
                <dd className="num is-gap">{usd(claimed - traced)}</dd>
              </div>
            </dl>
            <GapBar claimed={claimed} traced={traced} max={claimed} labels={false} />
          </>
        ) : (
          <p className="claim-null">
            This claim is stated as{' '}
            <strong>{claimedValue(row.claimed_value, row.claimed_unit)}</strong>, not as a dollar
            figure, so it contributes nothing to the reconciliation total.
            {traced > 0 && (
              <>
                {' '}
                Research has nonetheless matched <strong>{usd(traced)}</strong> to a filing line for
                this row. That figure is reported separately on the ledger rather than folded into
                the percentage, because its claim contributes nothing to the denominator.
              </>
            )}
          </p>
        )}

        {row.reconciliation_note && <p className="claim-note">{row.reconciliation_note}</p>}
      </section>

      {/* ── Coding ─────────────────────────────────────────────── */}
      <section className="claim-block" aria-labelledby="coding-h">
        <h3 id="coding-h">How this row is coded</h3>

        <dl className="claim-coding">
          <div>
            <dt>
              <Term kind="phrase" code="basis">What was measured</Term>
            </dt>
            <dd>
              <Term kind="basis" code={row.measurement_basis}>
                {b.name}
              </Term>
              {row.measurement_definition && (
                <p className="claim-note">
                  The source defines it as: {row.measurement_definition}
                </p>
              )}
            </dd>
          </div>

          <div>
            <dt>
              <Term kind="phrase" code="destination">Where it landed</Term>
            </dt>
            <dd>
              <span className={'tone-text-' + d.tone}>
                <Term kind="destination" code={row.destination}>
                  {d.name}
                </Term>
              </span>
              {row.destination_rationale && <p className="claim-note">{row.destination_rationale}</p>}
            </dd>
          </div>

          {row.counterparty_absorbed && (
            <div>
              <dt>Whose revenue line paid</dt>
              <dd>
                {row.counterparty_name ? (
                  <button
                    type="button"
                    className="linklike"
                    onClick={() => row.counterparty_slug && onCompany(row.counterparty_slug)}
                    disabled={!row.counterparty_slug}
                  >
                    {row.counterparty_name}
                  </button>
                ) : (
                  <span className="is-null">
                    A supplier absorbed the loss, but this row does not establish which one. That is
                    a real and common state, not a missing value.
                  </span>
                )}
                {row.transfer_amount_usd !== null && (
                  <p className="claim-note">Identified transfer: {usd(row.transfer_amount_usd)}</p>
                )}
                {row.counterparty_note && <p className="claim-note">{row.counterparty_note}</p>}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* ── The three conditions ───────────────────────────────── */}
      <section className="claim-block" aria-labelledby="cond-h">
        <h3 id="cond-h">
          <Term kind="phrase" code="conditions" as="block">
            The three conditions
          </Term>
        </h3>
        <ul className="conditions">
          {CONDITION_LIST.map((c) => {
            const value = row[CONDITION_FIELD[c.key]] as boolean | null;
            return (
              <li key={c.key} className={'condition is-' + state(value)}>
                <span className="condition-mark" aria-hidden="true">
                  {value === true ? '✓' : value === false ? '✗' : '–'}
                </span>
                <span className="condition-body">
                  <Term kind="condition" code={c.key}>
                    {c.name}
                  </Term>
                  <span className="condition-state">
                    {value === true ? c.passes : value === false ? c.fails : 'Not coded for this row. An uncoded condition is not a failed one.'}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        {row.conditions_note && <p className="claim-note">{row.conditions_note}</p>}
      </section>

      {/* ── What the filings show ──────────────────────────────── */}
      <MarginWindow
        row={row}
        margin={series?.get(MARGIN_SERIES)}
        revenue={series?.get(REVENUE_SERIES)}
      />

      {/* ── Counter-evidence ───────────────────────────────────── */}
      {counterEvidence.length > 0 && (
        <section className="claim-block" aria-labelledby="counter-h">
          <h3 id="counter-h">What runs against this, from the same company</h3>
          <ul className="counterlist">
            {counterEvidence.map((r) => (
              <li key={r.id}>
                <p className="counterlist-headline">{r.headline}</p>
                {r.observed_counter_move && (
                  <p className="claim-note">Observed: {r.observed_counter_move}</p>
                )}
                <p className="counterlist-meta">
                  {r.claim_date} · {kind(r.claim_kind).name} · {r.source_name ?? 'source not named'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {row.observed_counter_move && (
        <section className="claim-block" aria-labelledby="move-h">
          <h3 id="move-h">What moved the other way</h3>
          <p>{row.observed_counter_move}</p>
        </section>
      )}

      {/* ── Source ─────────────────────────────────────────────── */}
      <section className="claim-block" aria-labelledby="source-h">
        <h3 id="source-h">Where this came from</h3>

        <dl className="kv kv-wide">
          <div>
            <dt>Source</dt>
            <dd>{row.source_name ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Kind of source</dt>
            <dd>{sourceTypeName(row.source_type)}</dd>
          </div>
          <div>
            <dt>Dated</dt>
            <dd>{row.source_date ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt>
              <Term kind="tier" code={row.evidence_tier}>Evidence tier</Term>
            </dt>
            <dd>{TIERS[row.evidence_tier] ?? 'Not recorded'}</dd>
          </div>
          <div>
            <dt>Checked</dt>
            <dd>
              <Term kind="verification" code={row.verification_status}>
                {verification(row.verification_status).name}
              </Term>
            </dd>
          </div>
          <div>
            <dt>
              <Term kind="epistemic" code={row.epistemic_tag}>Confidence in the coding</Term>
            </dt>
            <dd>{epistemic(row.epistemic_tag).name}</dd>
          </div>
        </dl>

        {row.conflict_of_interest && (
          <p className="claim-flag">
            The source has an interest in the claim being believed.
            {row.coi_note ? ` ${row.coi_note}` : ''}
          </p>
        )}

        {row.source_url ? (
          <p>
            <a className="btn" href={row.source_url} target="_blank" rel="noreferrer noopener">
              Open the source
            </a>
          </p>
        ) : (
          <p className="claim-null">
            No source URL is recorded on this row. The source is identified by name and date above;
            a URL written from memory would look verified without being so, and is deliberately left
            null.
          </p>
        )}

        {links.length > 0 && (
          <p className="claim-lookups">
            <span>Look it up:</span>
            {links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noreferrer noopener">
                {l.label}
              </a>
            ))}
          </p>
        )}

        {row.verify_hint && (
          <p className="claim-note">
            <strong>Next step to verify:</strong> {row.verify_hint}
          </p>
        )}
      </section>

      {/* ── The fine print ─────────────────────────────────────── */}
      <details className="claim-raw">
        <summary>Stored codes for this row</summary>
        <dl className="kv kv-mono">
          <div><dt>ref</dt><dd>{row.ref}</dd></div>
          <div><dt>claim_kind</dt><dd>{row.claim_kind}</dd></div>
          <div><dt>measurement_basis</dt><dd>{row.measurement_basis}</dd></div>
          <div><dt>destination</dt><dd>{row.destination}</dd></div>
          <div><dt>epistemic_tag</dt><dd>{row.epistemic_tag}</dd></div>
          <div><dt>evidence_tier</dt><dd>{row.evidence_tier}</dd></div>
          <div><dt>verification_status</dt><dd>{row.verification_status}</dd></div>
          <div><dt>claimed_amount_usd</dt><dd>{row.claimed_amount_usd ?? 'null'}</dd></div>
          <div><dt>traceable_to_pl_usd</dt><dd>{row.traceable_to_pl_usd ?? 'null'}</dd></div>
        </dl>
        <p className="claim-note">
          These are the values as stored. They are shown here, and in the CSV export, so that
          nothing the interface renders in words is lost for analysis.
        </p>
      </details>
    </article>
  );
}

function state(v: boolean | null): string {
  return v === true ? 'pass' : v === false ? 'fail' : 'void';
}

const SOURCE_TYPES: Record<string, string> = {
  sec_filing: 'SEC filing',
  earnings_call: 'Earnings call',
  press_release: 'Company press release',
  press: 'Press reporting',
  peer_reviewed: 'Peer-reviewed paper',
  vendor_report: 'Vendor report',
  industry_survey: 'Industry survey',
  interview: 'Interview',
};

function sourceTypeName(t: string | null): string {
  if (!t) return 'Not recorded';
  return SOURCE_TYPES[t] ?? t;
}
