import { useEffect, useMemo, useRef, useState } from 'react';
import { sankey as d3Sankey, sankeyLinkHorizontal } from 'd3-sankey';
import type { SankeyGraph, SankeyNode, SankeyLink } from 'd3-sankey';
import { columnOrder, FLOW_COLUMNS, type FlowModel, type FlowNode, type FlowLink } from '../lib/flow';
import { clip, usd } from '../lib/format';

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
   =================================================================== */

type LayoutNode = SankeyNode<FlowNode, FlowLink>;
type LayoutLink = SankeyLink<FlowNode, FlowLink>;

const NODE_WIDTH = 13;
const NODE_PADDING = 15;
const ROW_MIN = 30;
const MARGIN = { top: 26, right: 152, bottom: 22, left: 150 };

/** Longest label the left gutter can hold. "International Business
 *  Machines" ran off the edge and read as "ational Business Machines",
 *  so names are cut here and the full one stays in the tooltip. */
const LABEL_MAX = 24;

/**
 * Below this the four columns and their labels cannot coexist, so the
 * diagram stops shrinking and the wrapper scrolls instead.
 *
 * It must match `.flow-svg { min-width }`. If the measured width were
 * used below it, the layout would be computed for a narrow box while
 * CSS stretched the element to this one, and every label would land in
 * the wrong place.
 */
const MIN_WIDTH = 660;

export interface SankeyProps {
  model: FlowModel;
  onSelectNode?: (node: FlowNode) => void;
  /** Node id currently held by the reader, for the dimming rule. */
  activeId?: string | null;
  onActiveChange?: (id: string | null) => void;
}

export function Sankey({ model, onSelectNode, activeId, onActiveChange }: SankeyProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(920);

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

  const perColumn = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of model.nodes) counts.set(n.column, (counts.get(n.column) ?? 0) + 1);
    return Math.max(1, ...counts.values());
  }, [model.nodes]);

  const height = Math.max(260, perColumn * ROW_MIN + (perColumn - 1) * 4);
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
        .nodePadding(NODE_PADDING)
        // Ordering is the encoding. The default minimises crossings,
        // which would shuffle the destination ladder out of rank order.
        .nodeSort((a, b) => columnOrder(a as FlowNode) - columnOrder(b as FlowNode))
        .extent([[0, 0], [innerW, height]]);
      return layout({ nodes, links });
    } catch {
      return null;
    }
  }, [model, innerW, height]);

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
  const dim = activeId != null;

  const isLit = (l: LayoutLink) =>
    !dim ||
    (l.source as LayoutNode).id === activeId ||
    (l.target as LayoutNode).id === activeId;

  return (
    <div className="flow-wrap" ref={wrapRef}>
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
              <text key={column} className="flow-col-head" x={(first.x0 ?? 0) + NODE_WIDTH / 2} y={-12}>
                {label}
              </text>
            );
          })}

          <g className="flow-links">
            {(graph.links as LayoutLink[]).map((l, i) => {
              const target = l.target as LayoutNode;
              const untraced = target.id === 'out:untraced';
              const traced = target.id === 'out:traced';
              const d = path(l) ?? undefined;
              return (
                <path
                  key={i}
                  className={'flow-link' + (isLit(l) ? '' : ' is-dim')}
                  d={d}
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
              const clickable = n.column !== 'outcome' && !n.aggregate;
              const h = Math.max(1, (n.y1 ?? 0) - (n.y0 ?? 0));
              const isOutcome = n.column === 'outcome';
              const rightHand = n.column === 'outcome';
              const faded = dim && n.id !== activeId;

              return (
                <g
                  key={n.id}
                  className={
                    'flow-node' +
                    (clickable ? ' is-clickable' : '') +
                    (faded ? ' is-dim' : '')
                  }
                  transform={`translate(${n.x0 ?? 0},${n.y0 ?? 0})`}
                  tabIndex={clickable ? 0 : -1}
                  role={clickable ? 'button' : undefined}
                  aria-label={
                    clickable
                      ? `${n.label}, ${usd(n.value ?? 0)}. Filter the ledger to this.`
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
                    x={rightHand ? NODE_WIDTH + 8 : -8}
                    y={h / 2}
                    textAnchor={rightHand ? 'start' : 'end'}
                  >
                    <title>{`${n.label} — ${usd(n.value ?? 0)}`}</title>
                    <tspan className="flow-node-name">{clip(n.label, LABEL_MAX)}</tspan>
                    <tspan className="flow-node-value" x={rightHand ? NODE_WIDTH + 8 : -8} dy="1.15em">
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
