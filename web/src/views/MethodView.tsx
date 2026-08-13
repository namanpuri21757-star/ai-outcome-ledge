/** The coding rules, in the app rather than only in a file, because a
 *  taxonomy nobody can see gets applied inconsistently within a month. */
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

      <h3>Measurement basis</h3>
      <p>The single field that decides whether a claim means anything.</p>
      <ul>
        <li><code>gross_capacity</code> — hours or heads freed, valued at loaded cost. Not a cost line. The most common and most consequential category.</li>
        <li><code>net_pl</code> — a disclosed line item moved, or an audited saving.</li>
        <li><code>unit_economics</code> — a price or margin per unit of output.</li>
        <li><code>headcount</code>, <code>time</code>, <code>quality</code>, <code>activity</code> — real measures that are not money.</li>
        <li><code>unverified</code> — the source does not say what it measured. Not a criticism, a status.</li>
      </ul>

      <h3>Destination</h3>
      <p>Where the gain landed. Only the fifth is P&amp;L margin.</p>
      <ul>
        <li><strong>1 Worker slack</strong> — absorbed; nothing changes financially.</li>
        <li><strong>2 Quality</strong> — converted to quality or wellbeing; real gain, no financial trace.</li>
        <li><strong>3 Counterparty</strong> — transferred off a supplier's revenue line. A transfer, not a productivity gain.</li>
        <li><strong>4 Price</strong> — passed to the customer. Captured by the buyer of AI, not the seller.</li>
        <li><strong>5 Margin</strong> — retained. Requires all three conditions at once.</li>
      </ul>

      <h3>Reconciliation</h3>
      <p>
        <code>traceable_to_pl_usd</code> defaults to zero and only moves when a named line item can be
        pointed at. That is why almost every bar is mostly hatched. The hatching is not an accusation
        that a claim is false — several of them are audited and true. It marks the distance between a
        number being real and a number being locatable in a set of financial statements.
      </p>

      <h3>Evidence tier and epistemic tag</h3>
      <p>
        Tier 1 is a filing, administrative dataset or peer-reviewed paper. Tier 2 is vendor- or
        self-originated. Tier 3 is press. Separately, each row is tagged fact, strong, inference,
        speculation or unknown. A tier-1 source can still carry an inference, and a tier-3 source can
        still report a fact; conflating the two is how vendor ROI figures end up quoted as measurements.
      </p>

      <h3>Rules the corpus follows</h3>
      <ul>
        <li>Ranges are never averaged. A source that says "$2–10M annually" keeps its range; collapsing it to $6M invents precision the source does not have.</li>
        <li>A row that cannot be computed stays in the ledger flagged as uncomputable, rather than being deleted. Deleting it is how it quietly re-enters an argument later.</li>
        <li>Conflict of interest is recorded as a fact about the source, not as a reason to exclude it.</li>
        <li>Counter-evidence lives in the same table as the claims it contradicts, keyed to the same company.</li>
        <li>No source URL is stored unless it was confirmed. Rows without one carry the exact next step instead.</li>
      </ul>

      <h3>The three conditions</h3>
      <p>
        A gain reaches margin only where the billing unit survives the automation, there is a demand
        sink for the freed capacity, and there is permission to act on it. The Conditions view is
        where that hypothesis meets live filing data rather than being restated.
      </p>
    </div>
  );
}
