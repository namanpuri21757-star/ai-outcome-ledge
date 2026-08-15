import { useMemo, useState } from 'react';
import type { LedgerRow } from '../lib/types';
import type { Finding } from '../lib/findings';
import { buildFlow, selectionForNode, type FlowNode } from '../lib/flow';
import { Sankey } from '../components/Sankey';
import { FindingGrid, HeadlineFigure, SelectionNote } from './FindingsView';
import { COPY } from '../lib/labels';

/* ===================================================================
   FLOW — the front door

   The question this page answers before you read a word: how much of
   what was claimed can be found in a filing, and where does the rest
   go instead. The pipe narrowing is the answer.

   The written analysis that used to be this page does not disappear.
   It sits underneath as orientation, which is the right order: see the
   shape, then read what it means, then go exploring.
   =================================================================== */

export function FlowView({
  rows, allRows, onSelect, onOpenFinding, onCompany,
}: {
  rows: LedgerRow[];
  allRows: LedgerRow[];
  onSelect: (node: FlowNode) => void;
  onOpenFinding: (f: Finding) => void;
  onCompany: (slug: string, context: string) => void;
}) {
  const model = useMemo(() => buildFlow(rows), [rows]);
  const [active, setActive] = useState<string | null>(null);

  return (
    <div className="flow-view">
      <HeadlineFigure rows={rows} />

      <section className="flow-panel">
        <div className="flow-head">
          <h3>Every claimed dollar, followed to a filing</h3>
          <p className="small">
            Each ribbon is claimed money. It runs from the company that claimed it, through what was
            actually measured, to where the gain landed, and finally to whether it can be matched to
            a disclosed line. Click any node to filter the whole ledger to it.
          </p>
        </div>

        <Sankey
          model={model}
          activeId={active}
          onActiveChange={setActive}
          onSelectNode={(n) => {
            if (selectionForNode(n)) onSelect(n);
          }}
        />

        {/* Shown only where the diagram is wider than the screen. */}
        <p className="flow-scroll-hint small">Scroll the diagram sideways to reach the last column.</p>

        <div className="flow-legend">
          <span><i className="swatch traced" /> {COPY.traced}</span>
          <span title={COPY.untracedMeaning}><i className="swatch gap" /> {COPY.untraced}</span>
        </div>

        <FlowExclusions model={model} />
      </section>

      <div className="flow-orientation">
        <span className="eyebrow">What the shape means</span>
        <FindingGrid rows={rows} onOpen={onOpenFinding} onCompany={onCompany} />
        <SelectionNote rows={rows} allRows={allRows} />
      </div>
    </div>
  );
}

/**
 * What the diagram cannot show.
 *
 * A claim with no dollar figure has no width, and a diagram about
 * missing numbers must not be the place where rows go missing. It is
 * stated rather than left to be noticed.
 */
export function FlowExclusions({ model }: { model: ReturnType<typeof buildFlow> }) {
  const parts: string[] = [];

  if (model.gainsWithoutAmount > 0) {
    parts.push(
      `${model.gainsWithoutAmount} gain claim${model.gainsWithoutAmount === 1 ? '' : 's'} carr${
        model.gainsWithoutAmount === 1 ? 'ies' : 'y'
      } no dollar figure, so ${model.gainsWithoutAmount === 1 ? 'it has' : 'they have'} no width here`,
    );
  }
  if (model.nonGainRows > 0) {
    parts.push(
      `${model.nonGainRows} row${model.nonGainRows === 1 ? '' : 's'} ${
        model.nonGainRows === 1 ? 'is' : 'are'
      } counter-evidence, context, pricing or research rather than a claimed gain`,
    );
  }

  if (parts.length === 0) return null;

  return (
    <p className="flow-exclusions note small">
      Not in the diagram: {parts.join('; ')}. They are still in the ledger and still counted
      everywhere else.
    </p>
  );
}
