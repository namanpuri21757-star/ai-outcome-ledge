import type { LedgerRow } from '../lib/types';
import { conditionCells } from '../lib/filters';
import { CONDITION_LIST } from '../lib/labels';
import { bps, clip } from '../lib/format';
import { ConditionFlags } from '../components/ConditionFlags';

/**
 * The hypothesis, tested rather than restated: meeting two of three
 * produces operational improvement and no profit effect; meeting all
 * three is what the rare high performers have.
 *
 * The three conditions used to appear as three bare words. Each one now
 * carries its question and its meaning on the page itself, because a
 * reader who has to ask what "demand sink" means has been failed by the
 * label rather than by their own attention.
 */
export function ConditionsView({
  rows, onCompany,
}: { rows: LedgerRow[]; onCompany: (slug: string, context: string) => void }) {
  const cells = conditionCells(rows).filter((c) => c.rows.length > 0);
  const uncoded = rows.filter(
    (r) =>
      r.cond_billing_unit_survives === null ||
      r.cond_demand_sink === null ||
      r.cond_permission_to_act === null,
  ).length;

  return (
    <>
      <section className="cond-key">
        {CONDITION_LIST.map((c) => (
          <div key={c.key} className="cond-key-item">
            <h3>{c.name}</h3>
            <p className="question">{c.question}</p>
            <p className="small"><strong>Met:</strong> {c.passes}</p>
            <p className="small"><strong>Not met:</strong> {c.fails}</p>
          </div>
        ))}
      </section>

      {cells.length === 0 ? (
        <div className="empty">
          <strong>No rows in this selection have all three conditions coded.</strong>
          Clear the filters, or code the conditions on more rows.
        </div>
      ) : (
        <div className="cond-grid">
          {cells.map((c) => {
            const key = `${c.billing}-${c.sink}-${c.permission}`;
            return (
              <div className={`cond-cell pass-${c.passes}`} key={key}>
                <ConditionFlags state={{ billing: c.billing, sink: c.sink, permission: c.permission }} />

                <div className="cond-count">
                  <span className="n">{c.rows.length}</span>
                  <span className="small">
                    row{c.rows.length === 1 ? '' : 's'} · {c.companies.length} compan
                    {c.companies.length === 1 ? 'y' : 'ies'} · {c.passes} of 3 conditions met
                  </span>
                </div>

                <div className="cond-margin">
                  Margin a year later:{' '}
                  <strong className={c.meanMarginDelta4qBps === null ? 'is-null'
                    : c.meanMarginDelta4qBps > 0 ? 'is-traced' : 'is-gap'}>
                    {bps(c.meanMarginDelta4qBps)}
                  </strong>
                  <span className="small">
                    {c.measured === 0
                      ? ' — not measured on any row in this cell yet'
                      : ` — averaged over ${c.measured} of ${c.rows.length} rows`}
                  </span>
                </div>

                <ul>
                  {c.rows.slice(0, 8).map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        className="linklike"
                        onClick={() => onCompany(r.company_slug, `${c.passes} of 3 conditions met`)}
                      >
                        <strong>{r.company_name}</strong> — {clip(r.headline, 62)}
                      </button>
                    </li>
                  ))}
                  {c.rows.length > 8 && <li className="small is-null">and {c.rows.length - 8} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {uncoded > 0 && (
        <p className="note small">
          {uncoded} row{uncoded === 1 ? ' is' : 's are'} missing at least one condition and so
          appear{uncoded === 1 ? 's' : ''} in none of the cells above. Uncoded is a real state and is
          not silently treated as "not met".
        </p>
      )}
    </>
  );
}
