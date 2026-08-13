import { DESTINATION_ORDER, destination } from '../lib/labels';

/**
 * The five destinations are ordered by how far the gain ended up from
 * profit. That ordering is real information, so it is drawn as position
 * on a ladder rather than printed as a numeral in front of a word.
 *
 * "5 Margin" made a reader decode before they could read, and the 5 looked
 * like a quantity. This says the same thing without the decoding step.
 */
export function DestinationLadder({
  rank, showLabel = true, compact = false,
}: { rank: number; showLabel?: boolean; compact?: boolean }) {
  const d = destination(rank);
  const steps = DESTINATION_ORDER.filter((r) => r > 0);

  return (
    <span className={'ladder' + (compact ? ' ladder-compact' : '')} title={`${d.name} — ${d.meaning}`}>
      <span className="ladder-steps" aria-hidden="true">
        {steps.map((r) => (
          <i
            key={r}
            className={
              'step' + (r === rank ? ` on tone-${d.tone}` : '') + (rank > 0 && r < rank ? ' passed' : '')
            }
          />
        ))}
      </span>
      {showLabel && <span className={`ladder-label tone-text-${d.tone}`}>{d.name}</span>}
    </span>
  );
}
