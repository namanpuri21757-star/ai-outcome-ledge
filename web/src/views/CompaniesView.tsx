import { useMemo, useState } from 'react';
import type { CompanyProfile } from '../lib/companies';
import { GROUPS, destination } from '../lib/labels';
import { usd, bps } from '../lib/format';
import { GapBar } from '../components/GapBar';
import { DestinationLadder } from '../components/DestinationLadder';

/**
 * Forty-five companies, one line each, sortable. The point of this page
 * is that a reader can find a company by name in two seconds without
 * knowing anything about the coding scheme.
 */
type SortKey = 'claimed' | 'untraced' | 'rows' | 'name' | 'margin';

export function CompaniesView({
  profiles, max, onCompany,
}: { profiles: CompanyProfile[]; max: number; onCompany: (slug: string) => void }) {
  const [sort, setSort] = useState<SortKey>('claimed');
  const [groupFilter, setGroupFilter] = useState<string | null>(null);

  const shown = useMemo(() => {
    const list = groupFilter ? profiles.filter((p) => p.groupCode === groupFilter) : profiles;
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sort) {
        case 'name': return a.name.localeCompare(b.name);
        case 'rows': return b.rows.length - a.rows.length;
        case 'untraced': return b.untracedUsd - a.untracedUsd;
        case 'margin': {
          const av = a.marginDelta4qBps, bv = b.marginDelta4qBps;
          if (av === null && bv === null) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          return bv - av;
        }
        default: return b.claimedUsd - a.claimedUsd;
      }
    });
    return sorted;
  }, [profiles, sort, groupFilter]);

  const groupsPresent = useMemo(
    () => [...new Set(profiles.map((p) => p.groupCode).filter(Boolean))].sort() as string[],
    [profiles],
  );

  return (
    <div className="companies">
      <div className="companies-controls">
        <div className="chip-group">
          <span className="grouplabel">Sort by</span>
          <Chip on={sort === 'claimed'} onClick={() => setSort('claimed')}>Claimed</Chip>
          <Chip on={sort === 'untraced'} onClick={() => setSort('untraced')}>Not traceable</Chip>
          <Chip on={sort === 'margin'} onClick={() => setSort('margin')}>Measured margin</Chip>
          <Chip on={sort === 'rows'} onClick={() => setSort('rows')}>Rows</Chip>
          <Chip on={sort === 'name'} onClick={() => setSort('name')}>Name</Chip>
        </div>
        <div className="chip-group">
          <span className="grouplabel">Kind of company</span>
          <Chip on={groupFilter === null} onClick={() => setGroupFilter(null)}>All</Chip>
          {groupsPresent.map((g) => (
            <Chip
              key={g}
              on={groupFilter === g}
              title={GROUPS[g]?.blurb}
              onClick={() => setGroupFilter(groupFilter === g ? null : g)}
            >
              {GROUPS[g]?.name ?? g}
            </Chip>
          ))}
        </div>
      </div>

      {shown.length === 0 ? (
        <div className="empty">
          <strong>No companies in this selection.</strong>
          Clear the filters above to see the whole ledger.
        </div>
      ) : (
        <ul className="company-list">
          {shown.map((p) => (
            <li key={p.slug}>
              <button type="button" className="company-row" onClick={() => onCompany(p.slug)}>
                <span className="col-name">
                  <strong>{p.name}</strong>
                  <small>{GROUPS[p.groupCode ?? '']?.name ?? 'Unclassified'}{p.sector ? ` · ${p.sector}` : ''}</small>
                </span>

                <span className="col-dest">
                  {p.dominantDestination !== null ? (
                    <DestinationLadder rank={p.dominantDestination} compact />
                  ) : (
                    <span className="small is-null">No coded gain</span>
                  )}
                </span>

                <span className="col-bar">
                  {p.claimedUsd > 0 ? (
                    <GapBar claimed={p.claimedUsd} traced={p.tracedUsd} max={max} />
                  ) : (
                    <span className="small is-null">No dollar figure</span>
                  )}
                </span>

                <span className="col-claimed num">{p.claimedUsd > 0 ? usd(p.claimedUsd) : '—'}</span>

                <span className={'col-margin num ' + (p.marginDelta4qBps === null ? 'is-null'
                  : p.marginDelta4qBps > 0 ? 'is-traced' : 'is-gap')}>
                  {bps(p.marginDelta4qBps)}
                </span>

                <span className="col-rows num is-null">{p.rows.length}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="note small">
        Margin is the measured change in operating margin one year after this company's most recent
        claim, rebuilt from its own filings. A dash means the company does not file with the SEC, or
        the series does not reach a year past the claim yet.
      </p>
      <p className="note small">
        Destination shown is where most of the company's gain claims landed:{' '}
        {[1, 2, 3, 4, 5].map((r) => destination(r).name.toLowerCase()).join(', ')}.
      </p>
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
