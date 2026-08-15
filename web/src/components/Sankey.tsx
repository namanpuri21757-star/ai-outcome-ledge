import { useEffect, useMemo, useRef, useState } from 'react';
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey';
import type { SankeyGraph, SankeyNode, SankeyLink } from 'd3-sankey';
import { columnOrder, FLOW_COLUMNS, type FlowModel, type FlowNode, type FlowLink } from '../lib/flow';
import { usd } from '../lib/format';

/* ===================================================================
   THE FLOW DIAGRAM

   Not a new visual language. The reconciliation bar already taught the
   reader that solid green is matched to a filing and diagonal hatching
   is asserted but not matched. This is that bar unrolled across the
   whole dataset, using the same two marks, so nothing has to be
   learned twice.

   d3-sankey does the layout arithmetic and nothing else. Every colour,
   every stroke and the node ordering are set here, because the default
   ordering minimises line crossings — which would reorder the
   destination column and destroy the one thing its position means.

   Two states, deliberately different marks:

     hover  — a preview. Everything else fades a little. Transient,
              and it follows the pointer.
     focus  — an answer. Set by a click or by Enter, held in the URL,
              cleared by Escape. Everything else fades a lot, and the
              focused node keeps a ring so it is findable after the
              eye has been to the detail list and come back.

   Making a click behave exactly like a hover was the old bug: the
   diagram was described as filtering the ledger, did so, and then
   looked identical, so nothing told the reader it had worked.
   =================================================================== */

type LayoutNode = SankeyNode<FlowNode, FlowLink>;
type LayoutLink = SankeyLink<FlowNode, FlowLink>;

const NODE_WIDTH = 13;
const ROW_MIN = 3;
const MARGIN = { top: 34, right: 186, bottom: 26, left: 184 };

/**
 * Below this the four columns and their labels cannot coexist, so the
 * diagram stops shrinking and the wrapper scrolls instead.
 *
 * It must match `.flow-svg { min-width }`. If the measured width were
 * used below it, the layout would be computed for a narrow box while
 * CSS stretched the element to this one, and every label would land in
 * the wrong place.
 */
export const MIN_WIDTH = 840;

export interface SankeyProps {
  model: FlowModel;
  /** Height and node padding, decided by `planFlow` from the data. */
  height: number;
  nodePadding: number;
  onSelectNode?: (node: FlowNode) => void;
  /** Node under the pointer or keyboard cursor. Transient. */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
  /** Node the reader has committed to. Held in the URL. */
  focusId?: string | null;
  onClearFocus?: () => void;
}

export function Sankey({
  model, height, nodePadding, onSelectNode, activeId, onActiveChange, focusId, onClearFocus,
}: SankeyProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1000);

  // Measured rather than assumed: a viewBox would scale the type down
  // with the chart and the figures are the point.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) setWidth(Math.max(MIN_WIDTH, w));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escape belongs to the window, not to the diagram: a reader who has
  // moved focus to the panel beside it, or reloaded into a held state
  // with nothing focused at all, still expects Escape to let go. Bound
  // to a div it only fired while a node happened to have focus.
  useEffect(() => {
    if (focusId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClearFocus?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [focusId, onClearFocus]);

  const innerW = Math.max(320, width - MARGIN.left - MARGIN.right);

  const graph = useMemo<SankeyGraph<FlowNode, FlowLink> | null>(() => {
    if (model.nodes.length === 0 || model.links.length === 0) return null;

    // d3-sankey mutates what it is given.
    const nodes = model.nodes.map((n) => ({ ...n }));
    const links = model.links.map((l) => ({ ...l }));

    try {
      const layout = d3Sankey<FlowNode, FlowLink>()
        .nodeId((d) => d.id)
        .nodeWidth(NODE_WIDTH)
        // The gap between two nodes is one label tall, so the labels
        // hanging off them cannot meet. See lib/flowLayout.ts.
        .nodePadding(nodePadding)
        // Ordering is the encoding. The default minimises crossings,
        // which would shuffle the destination ladder out of rank order.
        .nodeSort((a, b) => columnOrder(a as FlowNode) - columnOrder(b as FlowNode))
        .extent([[0, 0], [innerW, height]]);
      return layout({ nodes, links });
    } catch {
      return null;
    }
  }, [model, innerW, height, nodePadding]);

  if (!graph) {
    return (
      <div className="flow-empty" ref={wrapRef}>
        <strong>Nothing to draw at this selection.</strong>
        <span>
          The diagram follows claimed dollars, so it needs at least one gain claim carrying a
          figure. Clear a filter to widen the selection.
        </span>
      </div>
    );
  }

  const path = sankeyLinkHorizontal<FlowNode, FlowLink>();

  // Focus outranks hover: once the reader has committed to a node,
  // moving the pointer across the diagram must not quietly redraw the
  // answer they are reading.
  const anchor = focusId ?? activeId ?? null;
  const committed = focusId != null;

  const touches = (l: LayoutLink) =>
    (l.source as LayoutNode).id === anchor || (l.target as LayoutNode).id === anchor;

  const linkClass = (l: LayoutLink) => {
    if (!anchor) return 'flow-link';
    if (!touches(l)) return committed ? 'flow-link is-muted' : 'flow-link is-dim';
    return 'flow-link is-lit';
  };

  return (
    <div className={'flow-wrap' + (committed ? ' is-focused' : '')} ref={wrapRef}>
      <svg
        className="flow-svg"
        width={width}
        height={height + MARGIN.top + MARGIN.bottom}
        role="img"
        aria-label={`Flow of ${usd(model.claimedUsd)} in claimed gains, from company to measurement basis to destination to whether it is traceable to a filing.`}
      >
        <defs>
          {/* The same 45° audit hatch the reconciliation bar uses. */}
          <pattern id="flow-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <rect width="6" height="6" fill="var(--gap)" fillOpacity="0.13" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--gap)" strokeWidth="1.5" />
          </pattern>
        </defs>

        <g transform={`translate(${MARGIN.left},${MARGIN.top})`}>
          {FLOW_COLUMNS.map(({ column, label }) => {
            const first = (graph.nodes as LayoutNode[]).find((n) => n.column === column);
            if (!first) return null;
            return (
              <text key={column} className="flow-col-head" x={(first.x0 ?? 0) + NODE_WIDTH / 2} y={-16}>
                {label}
              </text>
            );
          })}

          <g className="flow-links">
            {(graph.links as LayoutLink[]).map((l, i) => {
              const target = l.target as LayoutNode;
              const untraced = target.id === 'out:untraced';
              const traced = target.id === 'out:traced';
              return (
                <path
                  key={i}
                  className={linkClass(l)}
                  d={path(l) ?? undefined}
                  strokeWidth={Math.max(1, l.width ?? 1)}
                  stroke={
                    untraced ? 'url(#flow-hatch)' : traced ? 'var(--traced)' : 'var(--claimed)'
                  }
                  strokeOpacity={untraced ? 1 : traced ? 0.5 : 0.28}
                />
              );
            })}
          </g>

          <g className="flow-nodes">
            {(graph.nodes as LayoutNode[]).map((n) => {
              const clickable = n.column !== 'outcome';
              const h = Math.max(ROW_MIN, (n.y1 ?? 0) - (n.y0 ?? 0));
              const isOutcome = n.column === 'outcome';
              const rightHand = n.column === 'outcome';
              const isFocused = n.id === focusId;
              const faded = anchor != null && n.id !== anchor;

              return (
                <g
                  key={n.id}
                  className={
                    'flow-node' +
                    (clickable ? ' is-clickable' : '') +
                    (isFocused ? ' is-focused' : '') +
                    (faded ? (committed ? ' is-muted' : ' is-dim') : '')
                  }
                  transform={`translate(${n.x0 ?? 0},${n.y0 ?? 0})`}
                  tabIndex={clickable ? 0 : -1}
                  role={clickable ? 'button' : undefined}
                  aria-pressed={clickable ? isFocused : undefined}
                  aria-label={
                    clickable
                      ? `${n.label}, ${usd(n.value ?? 0)}.${
                          isFocused ? ' Showing only this. Press Escape to clear.' : ' Filter the ledger to this.'
                        }`
                      : `${n.label}, ${usd(n.value ?? 0)}`
                  }
                  onMouseEnter={() => onActiveChange?.(n.id)}
                  onMouseLeave={() => onActiveChange?.(null)}
                  onFocus={() => onActiveChange?.(n.id)}
                  onBlur={() => onActiveChange?.(null)}
                  onClick={() => clickable && onSelectNode?.(n)}
                  onKeyDown={(e) => {
                    if (clickable && (e.key === 'Enter' || e.key === ' ')) {
                      e.preventDefault();
                      onSelectNode?.(n);
                    }
                  }}
                >
                  {isFocused && (
                    <rect
                      className="flow-node-ring"
                      x={-3}
                      y={-3}
                      width={NODE_WIDTH + 6}
                      height={h + 6}
                    />
                  )}
                  <rect
                    width={NODE_WIDTH}
                    height={h}
                    fill={
                      isOutcome
                        ? n.traced
                          ? 'var(--traced)'
                          : 'url(#flow-hatch)'
                        : 'var(--ink-2)'
                    }
                    stroke={isOutcome && !n.traced ? 'var(--gap)' : 'none'}
                    strokeWidth={isOutcome && !n.traced ? 1 : 0}
                  />
                  <text
                    className="flow-node-label"
                    x={rightHand ? NODE_WIDTH + 10 : -10}
                    y={h / 2}
                    textAnchor={rightHand ? 'start' : 'end'}
                  >
                    {/* Names are no longer cut. The gutters are sized for
                        the longest one, because a company called
                        "International Business Machines" truncated to
                        "ational Business Machines" reads as a different
                        company rather than as a shortened one. */}
                    <tspan className="flow-node-name">{n.label}</tspan>
                    <tspan className="flow-node-value" x={rightHand ? NODE_WIDTH + 10 : -10} dy="1.15em">
                      {usd(n.value ?? 0)}
                    </tspan>
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
    </div>
  );
}
