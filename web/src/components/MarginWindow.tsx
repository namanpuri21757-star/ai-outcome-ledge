import type { LedgerRow } from '../lib/types';
import {
  claimScale, marginCaveat, marginWindow, type Reading,
} from '../lib/outcome';
import { bps, pct, ratioAsPct, usd } from '../lib/format';
import { Term } from './Term';

/* ===================================================================
   "Does the claim show up in the financials?"

   Three readings and a delta, not a time series. The question a reader
   arrived with is answerable from a before and an after; a quarterly
   line swinging between −40% and +40% is not an answer, it is homework.

   Every branch that cannot produce a figure says why in a full sentence
   that names the dates involved, so a blank here is a statement about
   the company rather than a suspicion about the site.
   =================================================================== */

interface Props {
  row: LedgerRow;
  margin: Reading[] | undefined;
  revenue: Reading[] | undefined;
}

export function MarginWindow({ row, margin, revenue }: Props) {
  const w = marginWindow(row, margin);
  const scale = claimScale(row, revenue);

  return (
    <section className="marginwin" aria-labelledby="marginwin-h">
      <h3 id="marginwin-h">
        <Term kind="phrase" code="margin_window" as="block">
          What the filings show
        </Term>
      </h3>

      {w.hasFigure ? (
        <>
          <ol className="marginwin-steps">
            <Step
              label="Before the claim"
              reading={w.baseline}
              note="last operating margin filed before the claim date"
            />
            <Step
              label="One quarter after"
              reading={w.q1}
              delta={w.delta1qBps}
              note={w.q1 ? null : 'no filed quarter falls inside the tolerance window'}
            />
            <Step
              label="One year after"
              reading={w.q4}
              delta={w.delta4qBps}
              note={
                w.q4
                  ? null
                  : `the series runs to ${w.coverage?.last ?? 'an earlier quarter'}, which does not yet reach a year past the claim`
              }
            />
          </ol>

          <p className="marginwin-say">{w.reason}</p>
          <p className="marginwin-caveat">{marginCaveat(w, row)}</p>
        </>
      ) : (
        <p className="marginwin-absent">
          <strong>Not measurable.</strong> {w.reason}
        </p>
      )}

      {scale ? (
        <p className="marginwin-scale">
          For scale: the claim of {usd(row.claimed_amount_usd)} is{' '}
          <strong>{pct(scale.sharePct).replace('+', '')}</strong> of {row.company_name}&rsquo;s{' '}
          {usd(scale.revenueUsd)} of revenue over the four quarters ending {scale.toDate}. A gain of
          that size {scale.sharePct < 1 ? 'would be hard to see' : 'should be visible'} in a margin
          that moves by whole percentage points for other reasons.
        </p>
      ) : row.claimed_amount_usd ? (
        <p className="marginwin-scale is-null">
          The claim cannot be sized against revenue: four consecutive filed quarters of revenue
          before {row.claim_date} are not available for {row.company_name}.
        </p>
      ) : null}

      {w.coverage && (
        <p className="marginwin-coverage">
          Operating-margin readings collected for {row.company_name}: {w.coverage.first} to{' '}
          {w.coverage.last}, from SEC XBRL company facts.
        </p>
      )}
    </section>
  );
}

function Step({
  label,
  reading,
  delta,
  note,
}: {
  label: string;
  reading: Reading | null;
  delta?: number | null;
  note?: string | null;
}) {
  return (
    <li className={'marginwin-step' + (reading ? '' : ' is-absent')}>
      <span className="marginwin-step-label">{label}</span>
      {reading ? (
        <>
          <span className="marginwin-step-value">{ratioAsPct(reading.value)}</span>
          <span className="marginwin-step-date">quarter ending {reading.date}</span>
          {delta !== undefined && delta !== null && (
            <span className={'marginwin-step-delta ' + (delta >= 0 ? 'is-up' : 'is-down')}>
              {bps(delta)} against the baseline
            </span>
          )}
        </>
      ) : (
        <>
          <span className="marginwin-step-value is-null">Not filed yet</span>
          {note && <span className="marginwin-step-date">{note}</span>}
        </>
      )}
    </li>
  );
}

/**
 * The same status as one line, for a dense list where the full window
 * will not fit. Always words — never a bare dash.
 */
export function MarginLine({ row, margin }: { row: LedgerRow; margin: Reading[] | undefined }) {
  const w = marginWindow(row, margin);
  if (!w.hasFigure) {
    return <span className="marginline is-null">{w.reason}</span>;
  }
  const d = w.delta4qBps ?? w.delta1qBps!;
  const span = w.delta4qBps !== null ? 'a year on' : 'a quarter on';
  return (
    <span className={'marginline ' + (d >= 0 ? 'is-up' : 'is-down')}>
      Operating margin {bps(d)} {span}, from {ratioAsPct(w.baseline!.value)} to{' '}
      {ratioAsPct((w.q4 ?? w.q1)!.value)}
    </span>
  );
}
