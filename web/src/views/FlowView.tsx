import { useEffect, useMemo, useState } from 'react';
import type { LedgerRow } from '../lib/types';
import type { Finding } from '../lib/findings';
import { buildFlow, selectionForNode, type FlowNode } from '../lib/flow';
import { planFlow } from '../lib/flowLayout';
import { applyFilters, EMPTY_FILTERS, totals } from '../lib/filters';
import { Sankey, MIN_WIDTH } from '../components/Sankey';
import { FlowLadder } from '../components/FlowLadder';
import { GapBar } from '../components/GapBar';
import { FindingGrid, SelectionNote } from './FindingsView';
import { COPY } from '../lib/labels';
import { usd } from '../lib/format';

/* ===================================================================
   FLOW — the front door

   The question this page answers before you read a word: how much of
   what was claimed can be found in a filing, and where does the rest
   go instead. The pipe narrowing is the answer.

   Order matters and it changed. The diagram used to sit under a
   heading, three lines of explanation and a legend, so a reader met
   about five hundred pixels of prose before meeting the thing the
   prose was about. The explanation has not been deleted or shortened —
   it is one disclosure away, under the diagram, for the reader who
   wants it rather than in front of the reader who does not.
   =================================================================== */

/** Below this the Sankey cannot lay out four columns; see FlowLadder. */
const WIDE = MIN_WIDTH + 260;

function useIsWide(): boolean {
  const [wide, setWide] = useState(
    () => typeof window === 'undefined' || window.innerWidth >= WIDE,
  );
  useEffect(() => {
    const mq = window.matchMedia(`(min-width: ${WIDE}px)`);
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

export function FlowView({
  rows, allRows, onSelect, onOpenFinding, onCompany, focus, onFocus,
}: {
  rows: LedgerRow[];
  allRows: LedgerRow[];
  onSelect: (node: FlowNode) => void;
  onOpenFinding: (f: Finding) => void;
  onCompany: (slug: string, context: string) => void;
  focus: string | null;
  onFocus: (id: string | null) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const wide = useIsWide();

  // The plan is computed from the shape of the selection, then handed
  // to buildFlow, so the number of named lanes and the height they are
  // drawn in are decided together rather than by two rules that can
  // disagree.
  const shape = useMemo(() => {
    const gains = rows.filter((r) => r.claim_kind === 'gain_claim' && (r.claimed_amount_usd ?? 0) > 0);
    return {
      companies: new Set(gains.map((r) => r.company_slug)).size,
      bases: new Set(gains.map((r) => r.measurement_basis)).size,
      destinations: new Set(gains.map((r) => r.destination)).size,
    };
  }, [rows]);

  const plan = useMemo(() => planFlow({ ...shape, ceiling: 10 }), [shape]);
  const model = useMemo(() => buildFlow(rows, plan.maxNamed), [rows, plan.maxNamed]);

  const focusNode = focus ? model.nodes.find((n) => n.id === focus) ?? null : null;
  // A focus that no longer exists — because a filter changed under it —
  // is dropped rather than left pointing at nothing.
  useEffect(() => {
    if (focus && !focusNode) onFocus(null);
  }, [focus, focusNode, onFocus]);

  return (
    <div className="flow-view">
      <FlowHeadline model={model} />

      <div className={'flow-stage' + (focusNode ? ' has-focus' : '')}>
        <section className="flow-panel">
          {wide ? (
            <Sankey
              model={model}
              height={plan.height}
              nodePadding={plan.nodePadding}
              activeId={active}
              onActiveChange={setActive}
              focusId={focus}
              onClearFocus={() => onFocus(null)}
              onSelectNode={(n) => onFocus(n.id === focus ? null : n.id)}
            />
          ) : (
            <FlowLadder
              model={model}
              focusRank={focusNode?.rank ?? null}
              onSelectDestination={(rank) => {
                const id = `dest:${rank}`;
                onFocus(id === focus ? null : id);
              }}
            />
          )}

          <div className="flow-legend">
            <span><i className="swatch traced" /> {COPY.traced}</span>
            <span title={COPY.untracedMeaning}><i className="swatch gap" /> {COPY.untraced}</span>
          </div>

          <details className="flow-howto">
            <summary>How to read this</summary>
            <div>
              <p>
                Each ribbon is claimed money. It runs from the company that claimed it, through what
                was actually measured, to where the gain landed, and finally to whether it can be
                matched to a disclosed line. Width is dollars throughout, so a ribbon that stays
                thick all the way across is a claim that survived the whole journey.
              </p>
              <p>
                Companies are ranked largest first. The ones too small to label are gathered into a
                single node at the bottom, which opens into exactly those companies when you click
                it. Destinations keep their ladder order — furthest from profit at the top, kept as
                margin at the bottom — so vertical position always means the same thing.
              </p>
              <p>
                Click any node to hold it. The rest of the diagram fades, the rows behind it appear
                beside it, and the URL updates so the view can be sent to someone. Escape clears it.
              </p>
              <FlowExclusions model={model} />
            </div>
          </details>
        </section>

        {focusNode && (
          <FocusPanel
            node={focusNode}
            rows={rows}
            onClear={() => onFocus(null)}
            onFilter={() => onSelect(focusNode)}
            onCompany={onCompany}
          />
        )}
      </div>

      <div className="flow-orientation">
        <span className="eyebrow">What the shape means</span>
        <FindingGrid rows={rows} onOpen={onOpenFinding} onCompany={onCompany} />
        <SelectionNote rows={rows} allRows={allRows} />
      </div>
    </div>
  );
}

/**
 * The one number the page exists to say, above the diagram that
 * explains it — the arrangement Our World in Data uses, and for the
 * same reason: the takeaway should not depend on reading a chart
 * correctly, and the chart should not be redundant once you have.
 */
function FlowHeadline({ model }: { model: ReturnType<typeof buildFlow> }) {
  const share = model.claimedUsd > 0 ? model.tracedUsd / model.claimedUsd : 0;

  return (
    <section className="flow-headline">
      {/* Each figure and its label wrap as one unit. Left to wrap
          freely they broke mid-phrase on a phone — "$2.19B" on one
          line and "traceable to a filing" on the next. */}
      <p className="flow-headline-line">
        <span><strong className="mono">{usd(model.claimedUsd)}</strong> claimed</span>
        <span className="flow-headline-sep">·</span>
        <span><strong className="mono is-traced">{usd(model.tracedUsd)}</strong> traceable to a filing</span>
        <span className="flow-headline-sep">·</span>
        <span><strong className="mono is-gap">{usd(model.untracedUsd)}</strong> not</span>
      </p>
      <GapBar claimed={model.claimedUsd} traced={model.tracedUsd} max={model.claimedUsd || 1} large />
      <p className="flow-headline-note small">
        {(share * 100).toFixed(share < 0.1 ? 1 : 0)}% of what was claimed can be matched to a line
        item. The rest is not an accusation: several of these claims are audited and true.
      </p>
    </section>
  );
}

/**
 * What the reader gets for committing to a node.
 *
 * It sits beside the diagram rather than under it, because the point
 * of a drill-down is to see the detail without losing the shape it
 * came out of.
 */
function FocusPanel({
  node, rows, onClear, onFilter, onCompany,
}: {
  node: FlowNode;
  rows: LedgerRow[];
  onClear: () => void;
  onFilter: () => void;
  onCompany: (slug: string, context: string) => void;
}) {
  const selection = selectionForNode(node);
  const matched = useMemo(
    () => (selection ? applyFilters(rows, { ...EMPTY_FILTERS, ...selection }) : []),
    [rows, selection],
  );
  const t = totals(matched);
  const max = Math.max(...matched.map((r) => r.claimed_amount_usd ?? 0), 1);

  return (
    <aside className="focus-panel" aria-label={`Rows behind ${node.label}`}>
      <div className="focus-head">
        <span className="eyebrow">Holding</span>
        <h3>{node.label}</h3>
        <p className="mono small">
          {usd(node.value)} · {t.claims} row{t.claims === 1 ? '' : 's'}
        </p>
        <button type="button" className="btn" onClick={onClear}>Clear</button>
      </div>

      {matched.length === 0 ? (
        <p className="note small">
          Nothing in the current selection sits behind this node.
        </p>
      ) : (
        <ul className="focus-rows">
          {matched.slice(0, 12).map((r) => (
            <li key={r.id}>
              <button type="button" className="linklike" onClick={() => onCompany(r.company_slug, node.label)}>
                {r.company_name}
              </button>
              <GapBar claimed={r.claimed_amount_usd} traced={r.traceable_to_pl_usd} max={max} />
              <span className="mono">{r.claimed_amount_usd == null ? '—' : usd(r.claimed_amount_usd)}</span>
            </li>
          ))}
        </ul>
      )}

      {matched.length > 12 && (
        <p className="note small">{matched.length - 12} more not shown.</p>
      )}

      {selection && (
        <button type="button" className="btn focus-apply" onClick={onFilter}>
          Filter the whole ledger to this
        </button>
      )}
    </aside>
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
