import { DESTINATION_ORDER, destination } from '../lib/labels';
import { usd } from '../lib/format';
import { GapBar } from './GapBar';
import type { FlowModel } from '../lib/flow';

/* ===================================================================
   THE FLOW, ON A NARROW SCREEN

   A four-column Sankey needs about 840px before its labels stop
   colliding. Below that the old behaviour was a horizontal scrollbar,
   which put the last column — whether the money can be found in a
   filing — off the right-hand edge. The one thing this page exists to
   say was the one thing a phone could not show without panning for it.

   So below the breakpoint the diagram becomes what it already is
   underneath: the reconciliation bar, once per destination, stacked in
   ladder order. Same two marks, same order, same figures, no panning.
   It is not a fallback for the diagram; it is the same argument in the
   shape a narrow column can hold.
   =================================================================== */

export interface FlowLadderProps {
  model: FlowModel;
  onSelectDestination?: (rank: number) => void;
  focusRank?: number | null;
}

export function FlowLadder({ model, onSelectDestination, focusRank }: FlowLadderProps) {
  // Every destination present, in the one ladder order, largest scale
  // shared so the rungs compare to each other.
  const rungs = DESTINATION_ORDER
    .map((rank) => {
      const node = model.nodes.find((n) => n.column === 'destination' && n.rank === rank);
      if (!node) return null;

      // What reached a filing from this destination, read off the links
      // rather than recomputed, so the ladder and the diagram cannot
      // disagree about the same number.
      const traced = model.links
        .filter((l) => l.source === node.id && l.target === 'out:traced')
        .reduce((sum, l) => sum + l.value, 0);

      return { rank, label: destination(rank).name, claimed: node.value, traced };
    })
    .filter((r): r is { rank: number; label: string; claimed: number; traced: number } => r !== null);

  if (rungs.length === 0) return null;

  const max = Math.max(...rungs.map((r) => r.claimed), 1);

  return (
    <ol className="flow-ladder" aria-label="Claimed dollars by where the gain landed, furthest from profit first">
      {rungs.map((r) => (
        <li
          key={r.rank}
          className={'ladder-rung' + (focusRank === r.rank ? ' is-focused' : '')}
        >
          <button
            type="button"
            onClick={() => onSelectDestination?.(r.rank)}
            aria-pressed={focusRank === r.rank}
          >
            <span className="rung-head">
              <span className="rung-name">{r.label}</span>
              <span className="rung-value">{usd(r.claimed)}</span>
            </span>
            <GapBar claimed={r.claimed} traced={r.traced} max={max} />
            <span className="rung-split">
              <span className="is-traced">{usd(r.traced)} traceable</span>
              <span className="is-gap">{usd(r.claimed - r.traced)} not</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
