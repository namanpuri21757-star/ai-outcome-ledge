import { useMemo, useState } from 'react';
import type { CompanyProfile } from '../lib/companies';
import type { Filters } from '../lib/filters';
import {
  GROUP_MODES, SORT_MODES, groupProfiles, marginSeries, relatedSlugs,
  type GroupMode, type SortMode,
} from '../lib/patterns';
import { GapBar } from '../components/GapBar';
import { Sparkline } from '../components/Sparkline';
import { Chip } from '../components/Chip';
import { usd } from '../lib/format';
import { destination } from '../lib/labels';

/* ===================================================================
   PATTERNS — all forty-five at once

   The connection-making surface. One card per company, no prose,
   because density is the point: the repetition of a shape down a
   column is the finding, and a paragraph on each card would hide it.

   Hovering a card raises every other company sharing its destination
   or its condition count, so the cohort is visible without leaving
   the grid or clicking anything.
   =================================================================== */

export function PatternsView({
  profiles, max, filters, onFilters, onCompany, pinned, onTogglePin,
}: {
  profiles: CompanyProfile[];
  max: number;
  filters: Filters;
  onFilters: (f: Filters) => void;
  onCompany: (slug: string, context: string) => void;
  pinned: string[];
  onTogglePin: (slug: string) => void;
}) {
  const [groupMode, setGroupMode] = useState<GroupMode>('destination');
  const [sortMode, setSortMode] = useState<SortMode>('claimed');
  const [hovered, setHovered] = useState<string | null>(null);

  const groups = useMemo(
    () => groupProfiles(profiles, groupMode, sortMode),
    [profiles, groupMode, sortMode],
  );

  const target = hovered ? profiles.find((p) => p.slug === hovered) ?? null : null;
  const related = useMemo(
    () => (target ? relatedSlugs(target, profiles) : new Set<string>()),
    [target, profiles],
  );

  if (profiles.length === 0) {
    return (
      <div className="empty">
        <strong>No company matches this selection.</strong>
        <span>Every company has been filtered out. Remove a chip above to bring some back.</span>
      </div>
    );
  }

  return (
    <div className="patterns">
      <div className="pattern-controls">
        <fieldset>
          <legend>Group by</legend>
          {GROUP_MODES.map((g) => (
            <button
              key={g.mode}
              type="button"
              className={'seg' + (groupMode === g.mode ? ' is-on' : '')}
              aria-pressed={groupMode === g.mode}
              onClick={() => setGroupMode(g.mode)}
            >
              {g.label}
            </button>
          ))}
        </fieldset>
        <fieldset>
          <legend>Sort by</legend>
          {SORT_MODES.map((s) => (
            <button
              key={s.mode}
              type="button"
              className={'seg' + (sortMode === s.mode ? ' is-on' : '')}
              aria-pressed={sortMode === s.mode}
              onClick={() => setSortMode(s.mode)}
            >
              {s.label}
            </button>
          ))}
        </fieldset>
      </div>

      {target && (
        <p className="pattern-hint" role="status">
          <strong>{target.name}</strong>{' '}
          {related.size > 0 ? (
            <>shares its position with {related.size} other {related.size === 1 ? 'company' : 'companies'}, raised below.</>
          ) : (
            <>has no coded destination or condition count, so it has no cohort to compare against.</>
          )}
        </p>
      )}

      {groups.map((g) => (
        <section key={g.key} className={'pattern-group' + (g.unknown ? ' is-unknown' : '')}>
          <header className="pattern-group-head">
            <h3>{g.label}</h3>
            <span className="count">
              {g.members.length} {g.members.length === 1 ? 'company' : 'companies'}
            </span>
            <span className="figure">{usd(g.claimedUsd)} claimed</span>
            <span className="figure is-gap">{usd(g.untracedUsd)} not traceable</span>
          </header>
          {g.meaning && <p className="pattern-group-meaning">{g.meaning}</p>}

          <ul className="pattern-grid">
            {g.members.map((p) => (
              <PatternCard
                key={p.slug}
                profile={p}
                max={max}
                filters={filters}
                onFilters={onFilters}
                onCompany={onCompany}
                onHover={setHovered}
                lit={hovered !== null && (p.slug === hovered || related.has(p.slug))}
                dimmed={hovered !== null && p.slug !== hovered && !related.has(p.slug)}
                pinned={pinned.includes(p.slug)}
                onTogglePin={onTogglePin}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PatternCard({
  profile: p, max, filters, onFilters, onCompany, onHover, lit, dimmed, pinned, onTogglePin,
}: {
  profile: CompanyProfile;
  max: number;
  filters: Filters;
  onFilters: (f: Filters) => void;
  onCompany: (slug: string, context: string) => void;
  onHover: (slug: string | null) => void;
  lit: boolean;
  dimmed: boolean;
  pinned: boolean;
  onTogglePin: (slug: string) => void;
}) {
  const series = marginSeries(p);
  const d = p.dominantDestination;

  return (
    <li
      className={'pattern-card' + (lit ? ' is-lit' : '') + (dimmed ? ' is-dim' : '') + (pinned ? ' is-pinned' : '')}
      onMouseEnter={() => onHover(p.slug)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="pattern-card-head">
        <button
          type="button"
          className="pattern-name"
          onClick={() => onCompany(p.slug, 'the pattern grid')}
          onFocus={() => onHover(p.slug)}
          onBlur={() => onHover(null)}
        >
          {p.name}
        </button>
        <button
          type="button"
          className={'pin' + (pinned ? ' is-on' : '')}
          aria-pressed={pinned}
          title={pinned ? `Remove ${p.name} from the comparison tray` : `Pin ${p.name} to compare`}
          onClick={() => onTogglePin(p.slug)}
        >
          {pinned ? '−' : '+'}
        </button>
      </div>

      <GapBar claimed={p.claimedUsd} traced={p.tracedUsd} max={max} />

      <div className="pattern-card-figures">
        <span className="mono">{p.claimedUsd > 0 ? usd(p.claimedUsd) : '—'}</span>
        <Sparkline values={series} />
      </div>

      <div className="pattern-card-tags">
        {d !== null ? (
          <Chip small target={{ kind: 'destination', rank: d }} filters={filters} onChange={onFilters} />
        ) : (
          <span className="chip is-void" title="No destination has been coded for this company.">
            Not coded
          </span>
        )}
        {p.conditionsPassed !== null ? (
          <Chip
            small
            target={{ kind: 'conditionCount', count: p.conditionsPassed }}
            filters={filters}
            onChange={onFilters}
          />
        ) : (
          <span className="chip is-void" title="At least one condition is unrecorded, so this company has no count.">
            Conditions uncoded
          </span>
        )}
      </div>

      <span className="sr-only">
        {p.name}. {p.claimedUsd > 0 ? `${usd(p.claimedUsd)} claimed, ${usd(p.untracedUsd)} not traceable.` : 'No dollar figure.'}
        {d !== null ? ` Gains ${destination(d).verb}.` : ''}
      </span>
    </li>
  );
}
