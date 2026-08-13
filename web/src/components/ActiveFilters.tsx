import type { Filters } from '../lib/filters';
import { activeFilterChips, EMPTY_FILTERS } from '../lib/filters';

/**
 * "I can't tell if the filters work" was never a logic problem — they
 * always worked. It was a feedback problem: the only confirmation lived
 * in a sidebar far from the click, and the row count was the sole signal.
 *
 * This sits directly under the page heading, states the selection in
 * words, and lets any single part of it be removed. It renders nothing
 * when nothing is filtered, so it never adds noise to a clean view.
 */
export function ActiveFilters({
  filters, onChange, matched, total,
}: { filters: Filters; onChange: (f: Filters) => void; matched: number; total: number }) {
  const chips = activeFilterChips(filters);
  if (chips.length === 0) return null;

  return (
    <div className="active-filters">
      <span className="count">
        Showing <strong>{matched}</strong> of {total}
      </span>
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          className="active-chip"
          onClick={() => onChange(c.clear(filters))}
          title="Remove this filter"
        >
          {c.label}
          <span aria-hidden="true">×</span>
          <span className="sr-only">Remove filter</span>
        </button>
      ))}
      <button type="button" className="active-clear" onClick={() => onChange(EMPTY_FILTERS)}>
        Clear all
      </button>
    </div>
  );
}
