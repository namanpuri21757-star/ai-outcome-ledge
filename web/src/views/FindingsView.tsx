import type { LedgerRow } from '../lib/types';
import type { Filters } from '../lib/filters';
import { FINDINGS, type Finding } from '../lib/findings';
import { totals } from '../lib/filters';
import { usd } from '../lib/format';
import { COPY } from '../lib/labels';

/* ===================================================================
   FINDINGS — the front door

   The old front door was a wall of filter chips: it offered dimensions
   and assumed you already knew the coding scheme. This offers the
   questions instead, and opening one sets the filters that produced it,
   so the filter system gets taught by demonstration rather than by menu.

   Every sentence below is generated from the rows on each render. If a
   query returns nothing, the finding says so rather than falling back
   to copy describing data that is not there.
   =================================================================== */

export function FindingsView({
  rows, allRows, onOpen, onCompany,
}: {
  rows: LedgerRow[];
  allRows: LedgerRow[];
  onOpen: (finding: Finding) => void;
  onCompany: (slug: string, context: string) => void;
}) {
  const t = totals(rows);

  return (
    <div className="findings">
      <section className="headline-figure">
        <div>
          <span className="eyebrow">The gap, in one number</span>
          <p className="big-claim">
            <strong>{usd(t.claimedUsd)}</strong> of AI savings has been claimed across{' '}
            {t.dollarClaims} disclosures. <strong className="is-traced">{usd(t.tracedUsd)}</strong>{' '}
            of it can be matched to a line item in a financial statement.
          </p>
          <p className="small" title={COPY.untracedMeaning}>
            The remaining {usd(t.unreconciledUsd)} is not an accusation. Several of these claims are
            audited and true. It measures the distance between a number being real and a number being
            locatable.
          </p>
        </div>
      </section>

      <div className="finding-grid">
        {FINDINGS.map((f) => {
          const result = f.run(rows);
          return (
            <article key={f.id} className="finding-card">
              <button type="button" className="finding-open" onClick={() => onOpen(f)}>
                <h3>{f.question}</h3>
              </button>
              <p className="premise">{f.premise}</p>

              {result.empty ? (
                <p className="finding-empty">{result.empty}</p>
              ) : (
                <>
                  <p className="finding-answer">{result.answer}</p>

                  <div className="finding-stats">
                    {result.stats.map((s) => (
                      <div key={s.label} className="finding-stat">
                        <span className="label">{s.label}</span>
                        <span className={'value' + (s.tone === 'gap' ? ' is-gap' : s.tone === 'traced' ? ' is-traced' : '')}>
                          {s.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <ul className="finding-entries">
                    {result.entries.slice(0, 6).map((e) => (
                      <li key={e.slug}>
                        <button
                          type="button"
                          className="entry-name"
                          onClick={() => onCompany(e.slug, f.question)}
                        >
                          {e.name}
                        </button>
                        <span className="entry-figure">{e.figure}</span>
                        <span className="entry-why">{e.why}</span>
                      </li>
                    ))}
                  </ul>

                  {result.entries.length > 6 && (
                    <button type="button" className="linklike" onClick={() => onOpen(f)}>
                      See all {result.entries.length} →
                    </button>
                  )}
                </>
              )}
            </article>
          );
        })}
      </div>

      {rows.length !== allRows.length && (
        <p className="note">
          These answers are computed over the {rows.length} rows currently selected, not all{' '}
          {allRows.length}. Clear the filters above to ask the questions of the whole ledger.
        </p>
      )}
    </div>
  );
}

/** One finding, opened: the same answer with every entry rather than six. */
export function FindingView({
  finding, rows, onCompany, onBack, filters,
}: {
  finding: Finding;
  rows: LedgerRow[];
  onCompany: (slug: string, context: string) => void;
  onBack: () => void;
  filters: Filters;
}) {
  const result = finding.run(rows);
  const filtered = filters.destinations.length > 0 || filters.counterpartyOnly || filters.bases.length > 0;

  return (
    <div className="finding-full">
      <button type="button" className="linklike back" onClick={onBack}>← All findings</button>
      <h2>{finding.question}</h2>
      <p className="premise">{finding.premise}</p>

      {result.empty ? (
        <p className="finding-empty">{result.empty}</p>
      ) : (
        <>
          <p className="finding-answer big">{result.answer}</p>

          <div className="finding-stats wide">
            {result.stats.map((s) => (
              <div key={s.label} className="finding-stat">
                <span className="label">{s.label}</span>
                <span className={'value' + (s.tone === 'gap' ? ' is-gap' : s.tone === 'traced' ? ' is-traced' : '')}>
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          {filtered && (
            <p className="note small">
              The filters above have been set to match this question. Every other view now shows the
              same subset, and removing a chip widens all of them at once.
            </p>
          )}

          <ul className="finding-entries full">
            {result.entries.map((e) => (
              <li key={e.slug}>
                <button type="button" className="entry-name" onClick={() => onCompany(e.slug, finding.question)}>
                  {e.name}
                </button>
                <span className="entry-figure">{e.figure}</span>
                <span className="entry-why">{e.why}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
