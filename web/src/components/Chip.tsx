import type { Filters } from '../lib/filters';
import {
  applyChip, chipActive, chipLabel, chipTitle, chipTone, type ChipTarget,
} from '../lib/chips';

/**
 * A coded value, everywhere it appears, as a way of asking who else is
 * like this.
 *
 * The same component renders in the flow diagram's caption, on a
 * company page, in the ledger and in the pattern grid, so the reader
 * learns the affordance once. Pressed state is real `aria-pressed`,
 * because a filter that is on and a filter that is off must be
 * distinguishable without seeing colour.
 */
export function Chip({
  target, filters, onChange, small,
}: {
  target: ChipTarget;
  filters: Filters;
  onChange: (next: Filters) => void;
  small?: boolean;
}) {
  const active = chipActive(target, filters);
  const label = chipLabel(target);

  return (
    <button
      type="button"
      className={
        'chip' + (active ? ' is-on' : '') + (small ? ' chip-sm' : '') +
        (chipTone(target) ? ' ' + chipTone(target) : '')
      }
      aria-pressed={active}
      title={chipTitle(target)}
      onClick={(e) => {
        e.stopPropagation();
        onChange(applyChip(target, filters));
      }}
    >
      {label}
    </button>
  );
}

/** Several chips in a row, with the spacing set once. */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return <span className="chip-row">{children}</span>;
}
