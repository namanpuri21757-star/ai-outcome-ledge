import { useState } from 'react';
import type { LedgerRow, ClaimKind, EpistemicTag, MeasurementBasis } from '../lib/types';
import type { Filters } from '../lib/filters';
import { isFilterActive, toggle } from '../lib/filters';
import { BASES, DESTINATION_ORDER, GROUPS, KINDS, destination } from '../lib/labels';

/**
 * The filter wall used to be the first thing on every page: six rows of
 * codes, open by default, before any data. It is capability the app needs
 * and almost never the thing a reader wants first, so it collapses.
 *
 * Search stays visible, because search is how most people actually look
 * for something.
 */
export function FilterBar({
  filters, onChange, rows, matched, onExport,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  rows: LedgerRow[];
  matched: number;
  onExport: () => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const groupsPresent = [...new Set(rows.map((r) => r.group_code).filter(Boolean))] as string[];
  groupsPresent.sort();

  return (
    <div className="filterbar">
      <div className="filterbar-row">
        <input
          className="search"
          type="search"
          placeholder="Search claims, companies, notes…"
          value={filters.search}
          onChange={(e) => set({ search: e.target.value })}
          aria-label="Search the ledger"
        />
        <button
          type="button"
          className={'btn ghost' + (isFilterActive(filters) ? ' has-filters' : '')}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Hide filters' : 'Refine'}
        </button>
        <span className="matched">
          {matched} of {rows.length}
        </span>
        <button type="button" className="btn ghost" onClick={onExport}>
          Export CSV
        </button>
      </div>

      {open && (
        <>
          <Row label="Where the gain landed">
            {DESTINATION_ORDER.map((d) => (
              <Chip
                key={d}
                on={filters.destinations.includes(d)}
                title={destination(d).meaning}
                onClick={() => set({ destinations: toggle(filters.destinations, d) })}
              >
                {destination(d).name}
              </Chip>
            ))}
          </Row>

          <Row label="What the number is">
            {(Object.keys(BASES) as MeasurementBasis[]).map((b) => (
              <Chip
                key={b}
                on={filters.bases.includes(b)}
                title={BASES[b].meaning}
                onClick={() => set({ bases: toggle(filters.bases, b) })}
              >
                {BASES[b].name}
              </Chip>
            ))}
          </Row>

          <Row label="Kind of row">
            {(Object.keys(KINDS) as ClaimKind[]).map((k) => (
              <Chip
                key={k}
                on={filters.kinds.includes(k)}
                title={KINDS[k].meaning}
                onClick={() => set({ kinds: toggle(filters.kinds, k) })}
              >
                {KINDS[k].name}
              </Chip>
            ))}
          </Row>

          <Row label="Kind of company">
            {groupsPresent.map((g) => (
              <Chip
                key={g}
                on={filters.groups.includes(g)}
                title={GROUPS[g]?.blurb}
                onClick={() => set({ groups: toggle(filters.groups, g) })}
              >
                {GROUPS[g]?.name ?? g}
              </Chip>
            ))}
          </Row>

          <Row label="How good the evidence is">
            <Chip on={filters.tiers.includes(1)} title="Filings, administrative data, peer review"
              onClick={() => set({ tiers: toggle(filters.tiers, 1) })}>Primary</Chip>
            <Chip on={filters.tiers.includes(2)} title="Vendor- or self-originated"
              onClick={() => set({ tiers: toggle(filters.tiers, 2) })}>Self-reported</Chip>
            <Chip on={filters.tiers.includes(3)} title="Press or secondary reporting"
              onClick={() => set({ tiers: toggle(filters.tiers, 3) })}>Press</Chip>
            {(['fact', 'strong', 'inference', 'speculation', 'unknown'] as EpistemicTag[]).map((t) => (
              <Chip key={t} on={filters.tags.includes(t)}
                onClick={() => set({ tags: toggle(filters.tags, t) })}>{t}</Chip>
            ))}
          </Row>

          <Row label="Only show">
            <Chip on={filters.counterpartyOnly} title="Rows where a supplier absorbed the loss"
              onClick={() => set({ counterpartyOnly: !filters.counterpartyOnly })}>A supplier paid</Chip>
            <Chip on={filters.conflictOnly} title="The source sells the thing the number validates"
              onClick={() => set({ conflictOnly: !filters.conflictOnly })}>Conflicted source</Chip>
            <Chip on={filters.unverifiedOnly} title="Not yet checked against a primary source"
              onClick={() => set({ unverifiedOnly: !filters.unverifiedOnly })}>Not primary-sourced</Chip>
            <Chip on={filters.dollarsOnly} title="Rows carrying a dollar figure"
              onClick={() => set({ dollarsOnly: !filters.dollarsOnly })}>Has a dollar figure</Chip>
          </Row>
        </>
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="filterbar-row">
      <span className="grouplabel">{label}</span>
      <div className="chip-group">{children}</div>
    </div>
  );
}

function Chip({
  children, on, onClick, title,
}: { children: React.ReactNode; on: boolean; onClick: () => void; title?: string }) {
  return (
    <button type="button" className="chip" aria-pressed={on} onClick={onClick} title={title}>
      {children}
    </button>
  );
}
