import { useId, useState } from 'react';
import type { LedgerRow } from '../lib/types';
import {
  activeFilterChips, filterOptions, toggle, type Filters,
} from '../lib/filters';
import {
  BASIS_ORDER, DESTINATION_ORDER, KIND_ORDER, VERIFICATION_ORDER,
  basis, destination, group, kind, verification,
} from '../lib/labels';
import { Term, TermSet } from './Term';

/* ===================================================================
   The selection, and the fact that it is one.

   This panel lives inside the ledger view rather than in the shell,
   because the filter applies to the ledger and to nothing else. It
   states what it is doing in words above the rows, and every chip it
   offers is a value that exists in the corpus with the count beside it,
   so a reader can never pick a filter that matches nothing by accident.

   Choosing one that matches nothing on purpose — a search term plus a
   destination, say — is still possible, and the ledger says so.
   =================================================================== */

interface Props {
  all: LedgerRow[];
  filters: Filters;
  onChange: (f: Filters) => void;
  matched: number;
  onExport: () => void;
}

export function FilterPanel({ all, filters, onChange, matched, onExport }: Props) {
  const [open, setOpen] = useState(false);
  const searchId = useId();
  const panelId = useId();

  const options = filterOptions(all, {
    kinds: KIND_ORDER,
    destinations: DESTINATION_ORDER,
    bases: BASIS_ORDER,
    verification: VERIFICATION_ORDER,
  });
  const chips = activeFilterChips(filters);

  return (
    <div className="filters">
      <div className="filters-bar">
        <div className="filters-search">
          <label htmlFor={searchId} className="sr-only">
            Search claims, companies and coding notes
          </label>
          <input
            id={searchId}
            type="search"
            value={filters.search}
            placeholder="Search claims, companies, notes…"
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
          />
        </div>

        <button
          type="button"
          className="btn"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide filters' : 'Filters'}
          {chips.length > 0 && <span className="filters-count">{chips.length}</span>}
        </button>

        <button type="button" className="btn" onClick={onExport}>
          Export CSV
        </button>
      </div>

      {chips.length > 0 && (
        <div className="filters-active">
          <span className="filters-active-label">
            Showing {matched} of {all.length} rows, filtered by
          </span>
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              className="filters-chip is-on"
              onClick={() => onChange(c.clear(filters))}
            >
              {c.label}
              <span aria-hidden="true">×</span>
              <span className="sr-only"> — remove this filter</span>
            </button>
          ))}
          <button
            type="button"
            className="filters-clear"
            onClick={() =>
              onChange({
                search: '', kinds: [], bases: [], destinations: [],
                verification: [], groups: [], companies: [], dollarsOnly: false,
              })
            }
          >
            Clear all
          </button>
        </div>
      )}

      {open && (
        <div className="filters-panel" id={panelId}>
          <Group
            heading={
              <TermSet heading="Kind of row" kind="kind" codes={KIND_ORDER} />
            }
          >
            {options.kinds.map((o) => (
              <Chip
                key={o.value}
                on={filters.kinds.includes(o.value)}
                count={o.count}
                label={kind(o.value).name}
                onClick={() => onChange({ ...filters, kinds: toggle(filters.kinds, o.value) })}
              />
            ))}
          </Group>

          <Group
            heading={
              <TermSet heading="Where the gain landed" kind="destination" codes={DESTINATION_ORDER} />
            }
          >
            {options.destinations.map((o) => (
              <Chip
                key={o.value}
                on={filters.destinations.includes(o.value)}
                count={o.count}
                label={destination(o.value).name}
                tone={destination(o.value).tone}
                onClick={() =>
                  onChange({ ...filters, destinations: toggle(filters.destinations, o.value) })
                }
              />
            ))}
          </Group>

          <Group heading={<TermSet heading="What was measured" kind="basis" codes={BASIS_ORDER} />}>
            {options.bases.map((o) => (
              <Chip
                key={o.value}
                on={filters.bases.includes(o.value)}
                count={o.count}
                label={basis(o.value).name}
                onClick={() => onChange({ ...filters, bases: toggle(filters.bases, o.value) })}
              />
            ))}
          </Group>

          <Group
            heading={
              <TermSet heading="How well sourced" kind="verification" codes={VERIFICATION_ORDER} />
            }
          >
            {options.verification.map((o) => (
              <Chip
                key={o.value}
                on={filters.verification.includes(o.value)}
                count={o.count}
                label={verification(o.value).name}
                onClick={() =>
                  onChange({ ...filters, verification: toggle(filters.verification, o.value) })
                }
              />
            ))}
          </Group>

          <Group
            heading={
              <TermSet
                heading="Kind of company"
                kind="group"
                codes={options.groups.map((o) => o.value)}
              />
            }
          >
            {options.groups.map((o) => (
              <Chip
                key={o.value}
                on={filters.groups.includes(o.value)}
                count={o.count}
                label={group(o.value).name}
                onClick={() => onChange({ ...filters, groups: toggle(filters.groups, o.value) })}
              />
            ))}
          </Group>

          <Group heading={<Term kind="phrase" code="claimed" as="block">Figure stated</Term>}>
            <Chip
              on={filters.dollarsOnly}
              label="Only claims stated in dollars"
              count={all.filter((r) => (r.claimed_amount_usd ?? 0) > 0).length}
              onClick={() => onChange({ ...filters, dollarsOnly: !filters.dollarsOnly })}
            />
          </Group>
        </div>
      )}
    </div>
  );
}

function Group({ heading, children }: { heading: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="filters-group">
      <div className="filters-group-head">{heading}</div>
      <div className="filters-chips">{children}</div>
    </div>
  );
}

function Chip({
  on, label, count, tone, onClick,
}: {
  on: boolean;
  label: string;
  count: number;
  tone?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={'filters-chip' + (on ? ' is-on' : '') + (tone ? ' tone-' + tone : '')}
      aria-pressed={on}
      onClick={onClick}
    >
      {label}
      <span className="filters-chip-count">{count}</span>
    </button>
  );
}
