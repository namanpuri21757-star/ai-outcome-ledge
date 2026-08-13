import { BASES, CONDITION_LIST, DESTINATION_ORDER, KINDS, TIERS, destination, COPY } from '../lib/labels';
import type { MeasurementBasis, ClaimKind } from '../lib/types';

/**
 * The coding rules. Written in the same words the interface uses, so a
 * reader can move between this page and a row without translating.
 */
export function MethodView() {
  return (
    <div className="doc">
      <h3>What this is</h3>
      <p>
        A maintained record of every public claim of an AI gain, coded against what was actually
        measured. Half of it is typed by hand; half is machine-maintained. The hand half is the
        coding: what the number is, where the gain landed, whose revenue line paid for it. The
        machine half is what the company's own filings did afterwards — operating margin, revenue,
        share price — pulled from SEC XBRL and rebuilt on every run.
      </p>

      <h3>What the number is</h3>
      <p>The single field that decides whether a claim means anything.</p>
      <dl className="doc-list">
        {(Object.keys(BASES) as MeasurementBasis[]).map((k) => (
          <div key={k}>
            <dt>{BASES[k].name}</dt>
            <dd>{BASES[k].meaning}</dd>
          </div>
        ))}
      </dl>

      <h3>Where the gain landed</h3>
      <p>
        Five destinations, ordered by how far the gain ended up from profit. Only the last one is
        profit. The ordering is real information, so the interface shows it as position on a ladder
        rather than as a number printed in front of a word — a leading "5" reads as a quantity, and
        it is a rank.
      </p>
      <dl className="doc-list">
        {DESTINATION_ORDER.filter((r) => r > 0).map((r) => (
          <div key={r}>
            <dt>
              {destination(r).name} <span className="small is-null">step {r} of 5</span>
            </dt>
            <dd>{destination(r).meaning}</dd>
          </div>
        ))}
      </dl>

      <h3>The three conditions</h3>
      <p>
        The claim under test: meeting two of these three produces measurable operational improvement
        and no effect on profit. Meeting all three is what the rare high performers have.
      </p>
      <dl className="doc-list">
        {CONDITION_LIST.map((c) => (
          <div key={c.key}>
            <dt>{c.name}</dt>
            <dd>
              {c.question} <strong>Met:</strong> {c.passes} <strong>Not met:</strong> {c.fails}
            </dd>
          </div>
        ))}
      </dl>

      <h3>Traceable, and not traceable</h3>
      <p>
        A claim's <em>traceable</em> amount starts at zero and only moves when a named line item in a
        financial statement can be pointed at. That is why almost every reconciliation bar is mostly
        hatched.
      </p>
      <p>
        <strong>{COPY.untraced} does not mean the claim is false.</strong> {COPY.untracedMeaning}
      </p>

      <h3>Kinds of row</h3>
      <p>
        Not every row asserts that AI produced a gain. A market-capitalisation figure, an acquisition
        price, and a $60M savings claim are different objects, and summing them would make the
        headline number meaningless. Only gain claims enter the money totals.
      </p>
      <dl className="doc-list">
        {(Object.keys(KINDS) as ClaimKind[]).map((k) => (
          <div key={k}>
            <dt>{KINDS[k].name}</dt>
            <dd>{KINDS[k].meaning}</dd>
          </div>
        ))}
      </dl>

      <h3>How much to trust a row</h3>
      <dl className="doc-list">
        {[1, 2, 3].map((t) => (
          <div key={t}>
            <dt>{t === 1 ? 'Primary' : t === 2 ? 'Self-reported' : 'Press'}</dt>
            <dd>{TIERS[t]}</dd>
          </div>
        ))}
      </dl>
      <p>
        A source that sells the thing its number validates is marked <em>sells the thing</em>. It is
        a disclosure, not a dismissal: several of the best-documented deployments in the ledger come
        from vendors.
      </p>

      <h3>Where a source link is missing</h3>
      <p>
        Most rows deliberately carry no stored URL. A link written from memory is worse than none,
        because it looks verified. Those rows carry the exact next step to check them instead, and
        the app turns it into a one-click EDGAR or Scholar search.
      </p>

      <h3>What is generated, and what is typed</h3>
      <p>
        Every sentence on the findings page and every company verdict is assembled from the rows at
        render time. None of it is typed prose about the data, so recoding a row or a fresh collector
        run changes the answer rather than leaving a stale paragraph behind. When a query returns
        nothing, the page says so rather than falling back to copy describing data that is not there.
      </p>
    </div>
  );
}
