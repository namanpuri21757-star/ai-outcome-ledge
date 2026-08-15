import { glossary } from '../lib/labels';
import {
  BASELINE_LOOKBACK_DAYS, MARGIN_SERIES, Q1_TOLERANCE_DAYS, Q4_TOLERANCE_DAYS, REVENUE_SERIES,
} from '../lib/outcome';

/* ===================================================================
   How a row is coded, and how every figure on this site is computed.

   The vocabulary section is generated from `glossary()` in labels.ts, so
   a term cannot exist in the interface without appearing here, and the
   words are the same words — there is no second copy to fall out of step.
   =================================================================== */

export function MethodView() {
  const sections = glossary();

  return (
    <article className="doc">
      <header className="doc-head">
        <h2>Method</h2>
        <p className="section-lede">
          What each coded value means, and exactly how every number on this site is arrived at.
          Nothing below is typed twice: the definitions are the ones the interface itself uses.
        </p>
      </header>

      <section aria-labelledby="m-arith">
        <h3 id="m-arith">How the money figures are computed</h3>
        <ul className="doc-list">
          <li>
            <strong>Only gain claims enter a money total.</strong> A market capitalisation, an
            acquisition price and a cost saving are different objects. Counter-evidence, context,
            pricing and research rows are recorded in full and excluded from every sum.
          </li>
          <li>
            <strong>The denominator is claims that named dollars.</strong> A claim stated as “opex
            down 33%” contributes nothing to a dollar total, so dollars traced against it cannot
            count toward the traceable share either. Those are reported separately and always shown
            when non-zero, rather than folded in or dropped.
          </li>
          <li>
            <strong>Traceable is not clamped.</strong> If a row is coded with more traceable than
            claimed, the interface says so on that row. That is a defect in the research to fix, not
            an arithmetic edge to hide.
          </li>
          <li>
            <strong>Nulls are a real state.</strong> A missing figure is not zero and not the
            smallest value. It sorts last in both directions and is written out in words rather than
            rendered as a dash.
          </li>
          <li>
            <strong>One function adds up.</strong> Every total on every screen is a field returned
            by one function over one set of rows, so two figures for one quantity cannot appear.
          </li>
        </ul>
      </section>

      <section aria-labelledby="m-margin">
        <h3 id="m-margin">How the filing figures are derived</h3>
        <ul className="doc-list">
          <li>
            Quarterly <code>{MARGIN_SERIES}</code> and <code>{REVENUE_SERIES}</code> values are
            collected from SEC XBRL company facts by a scheduled Cloudflare Worker. Nothing on this
            site is typed by hand into those series.
          </li>
          <li>
            The baseline is the last operating margin filed at or before the claim date, provided it
            is no more than {BASELINE_LOOKBACK_DAYS} days earlier. Quarterly filings arrive months
            after the period they describe, so a shorter window rejects claims the data can answer.
          </li>
          <li>
            The one-quarter reading is the filed quarter nearest to 91 days after the claim, within{' '}
            {Q1_TOLERANCE_DAYS} days. The one-year reading is nearest to 365 days after, within{' '}
            {Q4_TOLERANCE_DAYS} days. A reading further off than that is a different quarter, not a
            data point.
          </li>
          <li>
            <strong>A margin that moved is not evidence.</strong> Operating margin moves for pricing,
            mix, headcount and one-off charges at once. No part of any movement shown here has been
            attributed to AI, and the interface says so beside every figure.
          </li>
          <li>
            Where a claim cannot be measured, the reason is stated on the row and names the dates
            involved — whether the company files at all, whether a series exists, and how far it
            reaches.
          </li>
        </ul>
      </section>

      <section aria-labelledby="m-prices">
        <h3 id="m-prices">What is not collected</h3>
        <ul className="doc-list">
          <li>
            Share prices are not collected. The free source used until August 2026 began serving a
            proof-of-work interstitial to automated clients instead of data. Solving it would be
            working around a site declining access, so the job is kept and switched off until a
            different source is chosen. No price figure appears anywhere on this site.
          </li>
          <li>
            Three companies in the ledger do not file with the SEC at all. No margin series is
            possible for them, and that is stated on their rows as a fact about the company rather
            than reported as a fault.
          </li>
        </ul>
      </section>

      <section aria-labelledby="m-vocab">
        <h3 id="m-vocab">The vocabulary</h3>
        <p className="section-lede">
          Every coded value in the ledger, with the definition the interface shows when a reader
          opens it in place. Stored codes are in the right-hand column and in the CSV export.
        </p>

        {sections.map((s) => (
          <div className="glossary" key={s.heading}>
            <h4>{s.heading}</h4>
            <dl>
              {s.items.map((item) => (
                <div key={item.code}>
                  <dt>
                    {item.label}
                    <span className="glossary-code mono">{item.code}</span>
                  </dt>
                  <dd>
                    {item.body}
                    {item.extra?.map((line) => (
                      <span className="glossary-extra" key={line}>{line}</span>
                    ))}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </section>

      <section aria-labelledby="m-limits">
        <h3 id="m-limits">What this cannot tell you</h3>
        <ul className="doc-list">
          <li>
            Whether a claim is true. “Not traceable to a filing line” measures locatability, not
            honesty. Several of these claims are audited and true.
          </li>
          <li>
            Whether AI caused anything. Every figure here is an association in time between a stated
            claim and a disclosed number.
          </li>
          <li>
            What is not in the ledger. This is a hand-built record of public claims, not a survey.
            Absence from it is not evidence of anything.
          </li>
        </ul>
      </section>
    </article>
  );
}
