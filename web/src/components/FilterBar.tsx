import type { Filters } from '../lib/filters';
import { EMPTY_FILTERS, isFilterActive, toggle } from '../lib/filters';
import { BASIS_LABEL, DESTINATIONS, KIND_LABEL } from '../lib/types';
import type { ClaimKind, EpistemicTag, LedgerRow, MeasurementBasis } from '../lib/types';

/**
 * One control surface, shared by every view. Filtering on the transfer map
 * and then switching to the ledger shows the same subset — that continuity is
 * the difference between a tool for finding patterns and eight separate charts.
 */
export function FilterBar({
  filters,
  onChange,
  rows,
  matched,
  onExport,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  rows: LedgerRow[];
  matched: number;
  onExport: () => void;
}) {
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });
  const groups = uniqueGroups(rows);

  return (
    <div className="filterbar">
      <div className="filterbar-row">
        <input
          className="search"
          type="search"
          placeholder="Search claims, companies, measurement notes…"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          aria-label="Search the ledger"
        />
        <span className="num" style={{ color: 'var(--ink-3)', fontSize: 12 }}>
          {matched} of {rows.length}
        </span>
        <button className="btn ghost" onClick={onExport}>Export CSV</button>
        {isFilterActive(filters) && (
          <button className="btn ghost" onClick={() => onChange({ ...EMPTY_FILTERS })}>Clear</button>
        )}
      </div>

      <div className="filterbar-row">
        <div className="chip-group">
          <span className="grouplabel">Row kind</span>
          {(Object.keys(KIND_LABEL) as ClaimKind[]).map((k) => (
            <button
              key={k}
              className="chip"
              aria-pressed={filters.kinds.includes(k)}
              onClick={() => set({ kinds: toggle(filters.kinds, k) })}
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </div>

      <div className="filterbar-row">
        <div className="chip-group">
          <span className="grouplabel">Destination</span>
          {[5, 4, 3, 2, 1, 0].map((d) => (
            <button
              key={d}
              className="chip"
              title={DESTINATIONS[d].long}
              aria-pressed={filters.destinations.includes(d)}
              onClick={() => set({ destinations: toggle(filters.destinations, d) })}
            >
              {d === 0 ? 'Uncoded' : `${d} ${DESTINATIONS[d].short}`}
            </button>
          ))}
        </div>
      </div>

      <div className="filterbar-row">
        <div className="chip-group">
          <span className="grouplabel">Basis</span>
          {(Object.keys(BASIS_LABEL) as MeasurementBasis[]).map((b) => (
            <button
              key={b}
              className="chip"
              aria-pressed={filters.bases.includes(b)}
              onClick={() => set({ bases: toggle(filters.bases, b) })}
            >
              {BASIS_LABEL[b]}
            </button>
          ))}
        </div>
      </div>

      <div className="filterbar-row">
        <div className="chip-group">
          <span className="grouplabel">Evidence</span>
          {[1, 2, 3].map((t) => (
            <button
              key={t}
              className="chip"
              title={`Tier ${t}`}
              aria-pressed={filters.tiers.includes(t)}
              onClick={() => set({ tiers: toggle(filters.tiers, t) })}
            >
              T{t}
            </button>
          ))}
          {(['fact', 'strong', 'inference', 'speculation', 'unknown'] as EpistemicTag[]).map((t) => (
            <button
              key={t}
              className="chip"
              aria-pressed={filters.tags.includes(t)}
              onClick={() => set({ tags: toggle(filters.tags, t) })}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="chip-group">
          <span className="grouplabel">Only</span>
          <button
            className="chip chip-gap"
            aria-pressed={filters.counterpartyOnly}
            title="Claims where a supplier's revenue line absorbed the loss"
            onClick={() => set({ counterpartyOnly: !filters.counterpartyOnly })}
          >
            counterparty
          </button>
          <button
            className="chip chip-gap"
            aria-pressed={filters.conflictOnly}
            title="The source sells the thing the number validates"
            onClick={() => set({ conflictOnly: !filters.conflictOnly })}
          >
            conflicted
          </button>
          <button
            className="chip chip-gap"
            aria-pressed={filters.unverifiedOnly}
            title="Anything without a primary source"
            onClick={() => set({ unverifiedOnly: !filters.unverifiedOnly })}
          >
            unverified
          </button>
          <button
            className="chip"
            aria-pressed={filters.dollarsOnly}
            title="Only claims carrying a dollar figure"
            onClick={() => set({ dollarsOnly: !filters.dollarsOnly })}
          >
            has $
          </button>
        </div>
      </div>

      {groups.length > 1 && (
        <div className="filterbar-row">
          <div className="chip-group">
            <span className="grouplabel">Group</span>
            {groups.map((g) => (
              <button
                key={g.code}
                className="chip"
                title={g.label}
                aria-pressed={filters.groups.includes(g.code)}
                onClick={() => set({ groups: toggle(filters.groups, g.code) })}
              >
                {g.code} · {g.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function uniqueGroups(rows: LedgerRow[]): Array<{ code: string; label: string }> {
  const map = new Map<string, string>();
  for (const r of rows) {
    if (r.group_code && !map.has(r.group_code)) map.set(r.group_code, r.group_label ?? r.group_code);
  }
  return [...map.entries()]
    .map(([code, label]) => ({ code, label }))
    .sort((a, b) => a.code.localeCompare(b.code));
}
