import { useMemo, useState } from 'react';
import type { LedgerRow } from '../lib/types';
import type { CompanyProfile } from '../lib/companies';
import { verdict } from '../lib/companies';
import { destination, group, COPY } from '../lib/labels';
import { usd, bps, shortDate } from '../lib/format';
import { LazyMarginChart } from '../components/LazyMarginChart';
import { GapBar } from '../components/GapBar';
import { ClaimCard } from '../components/ClaimCard';
import { ConditionFlags } from '../components/ConditionFlags';
import { DestinationLadder } from '../components/DestinationLadder';
import { Chip } from '../components/Chip';
import { Sparkline } from '../components/Sparkline';
import type { Filters } from '../lib/filters';
import { marginSeries, relatedSlugs, relationReason } from '../lib/patterns';

/* ===================================================================
   THE COMPANY PAGE

   This did not exist before, and its absence caused most of the
   confusion in the old app. The ledger's atom is a claim; the reader's
   atom is a company. Every click that named a company could only lead
   to a filtered list of claim rows, which is why arriving from the
   destinations view lost the destination.

   Order on this page is deliberate:
     1. the measured margin chart   — the only non-assertion here
     2. one generated verdict line  — what the rows add up to
     3. the reconciliation and the three conditions
     4. every claim, counter-evidence beside it rather than elsewhere

   Nothing on this page is typed prose about the data.
   =================================================================== */

export function CompanyView({
  profile, allProfiles, context, max, filters, onFilters, pinned, onTogglePin, onCompany, onBack,
}: {
  profile: CompanyProfile | null;
  allProfiles: CompanyProfile[];
  context: string | null;
  max: number;
  filters: Filters;
  onFilters: (f: Filters) => void;
  pinned: string[];
  onTogglePin: (slug: string) => void;
  onCompany: (slug: string) => void;
  onBack: () => void;
}) {
  const [tab, setTab] = useState<'all' | 'gains' | 'counter' | 'context'>('all');

  const markers = useMemo(
    () =>
      (profile?.gains ?? [])
        .filter((r) => r.claim_date)
        .map((r) => ({ date: r.claim_date, label: r.headline })),
    [profile],
  );

  if (!profile) {
    return (
      <div className="empty">
        <strong>No company by that name in the ledger.</strong>
        It may have been recoded or removed.
        <div style={{ marginTop: 14 }}>
          <button type="button" className="btn" onClick={onBack}>Back to companies</button>
        </div>
      </div>
    );
  }

  const p = profile;
  const g = group(p.groupCode);
  const rows = tab === 'gains' ? p.gains
    : tab === 'counter' ? p.counterEvidence
    : tab === 'context' ? p.context
    : p.rows;

  return (
    <div className="company">
      {context && (
        <div className="from-crumb">
          You came here from <strong>{context}</strong>.
          <button type="button" className="linklike" onClick={onBack}>Go back</button>
        </div>
      )}

      <header className="company-head">
        <div>
          <span className="eyebrow">{g.name}{p.sector ? ` · ${p.sector}` : ''}</span>
          <h2>{p.name}</h2>
          <p className="verdict">{verdict(p)}</p>
        </div>
        <div className="company-idents">
          {p.ticker && <span className="tag">{p.ticker}</span>}
          <span className="tag">{p.isPublic ? 'Public filer' : 'Private'}</span>
          <span className="tag">{p.rows.length} row{p.rows.length === 1 ? '' : 's'}</span>
          <button
            type="button"
            className={'pin pin-wide' + (pinned.includes(p.slug) ? ' is-on' : '')}
            aria-pressed={pinned.includes(p.slug)}
            onClick={() => onTogglePin(p.slug)}
          >
            {pinned.includes(p.slug) ? 'Pinned to compare' : 'Pin to compare'}
          </button>
        </div>
      </header>

      {/* 1. The measurement, before any assertion. */}
      <section className="company-chart">
        <div className="section-head">
          <h3>Operating margin, measured</h3>
          <p className="small">
            Rebuilt from this company's own SEC filings on every collector run. Dashed rules mark the
            dates of its claims.
          </p>
        </div>
        <LazyMarginChart companySlug={p.slug} markers={markers} height={240} />
        <dl className="kv wide">
          <dt>Margin one year after the latest measurable claim</dt>
          <dd className={p.marginDelta4qBps === null ? 'is-null' : p.marginDelta4qBps > 0 ? 'is-traced' : 'is-gap'}>
            {bps(p.marginDelta4qBps)}
          </dd>
          {p.marginMeasuredOn && (
            <>
              <dt>Measured against the claim dated</dt>
              <dd>{shortDate(p.marginMeasuredOn)}</dd>
            </>
          )}
        </dl>
      </section>

      {/* 2. What the rows add up to. */}
      <section className="company-summary">
        <div className="summary-block">
          <h3>Reconciliation</h3>
          {p.claimedUsd > 0 ? (
            <>
              <GapBar claimed={p.claimedUsd} traced={p.tracedUsd} max={max} large />
              <dl className="kv">
                <dt>Claimed across {p.gains.length} gain claim{p.gains.length === 1 ? '' : 's'}</dt>
                <dd>{usd(p.claimedUsd)}</dd>
                <dt>{COPY.traced}</dt>
                <dd className="is-traced">{usd(p.tracedUsd)}</dd>
                <dt title={COPY.untracedMeaning}>{COPY.untraced}</dt>
                <dd className="is-gap">{usd(p.untracedUsd)}</dd>
              </dl>
            </>
          ) : (
            <p className="small">
              No claim from this company carries a dollar figure, so there is nothing to reconcile.
              That is a fact about the disclosure, not about the company.
            </p>
          )}
        </div>

        <div className="summary-block">
          <h3>Where the gains landed</h3>
          {p.destinationMix.length === 0 ? (
            <p className="small">No gain claims recorded for this company.</p>
          ) : (
            <ul className="dest-mix">
              {p.destinationMix.map((m) => (
                <li key={m.rank}>
                  <DestinationLadder rank={m.rank} compact />
                  <span className="mix-count">
                    {m.rows} claim{m.rows === 1 ? '' : 's'}
                    {m.claimedUsd > 0 ? ` · ${usd(m.claimedUsd)}` : ''}
                  </span>
                  <Chip
                    small
                    target={{ kind: 'destination', rank: m.rank }}
                    filters={filters}
                    onChange={onFilters}
                  />
                </li>
              ))}
            </ul>
          )}
          {p.dominantDestination !== null && (
            <p className="small">{destination(p.dominantDestination).meaning}</p>
          )}
        </div>

        <div className="summary-block">
          <h3>The three conditions</h3>
          <ConditionFlags state={p.conditions} verbose />
          <p className="small">
            {p.conditionsPassed === null
              ? 'These rows do not agree on all three conditions, or some are uncoded, so no verdict is shown.'
              : p.conditionsPassed === 3
                ? 'All three met. This is the combination the hypothesis says is required to keep a gain as profit.'
                : `${p.conditionsPassed} of 3 met. The hypothesis says this produces operational improvement without a profit effect.`}
          </p>
          {p.conditionsPassed !== null && (
            <Chip
              small
              target={{ kind: 'conditionCount', count: p.conditionsPassed }}
              filters={filters}
              onChange={onFilters}
            />
          )}
        </div>
      </section>

      <SimilarCompanies profile={p} allProfiles={allProfiles} max={max} onCompany={onCompany} />

      {(p.counterparties.length > 0 || p.absorbedFrom.length > 0) && (
        <section className="company-transfers">
          <h3>Money crossing a company boundary</h3>
          {p.counterparties.length > 0 && (
            <div className="transfer-block">
              <h4>This company's savings came off</h4>
              <ul>
                {p.counterparties.map((c) => (
                  <li key={c.slug ?? 'unnamed'}>
                    {c.slug ? (
                      <button type="button" className="linklike" onClick={() => onCompany(c.slug!)}>
                        {c.name}
                      </button>
                    ) : (
                      <span className="unnamed">{c.name}</span>
                    )}
                    <span className="mono small">
                      {' '}· {c.rows} row{c.rows === 1 ? '' : 's'}
                      {c.amountUsd > 0 ? ` · ${usd(c.amountUsd)}` : ' · amount not established'}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {p.absorbedFrom.length > 0 && (
            <div className="transfer-block">
              <h4>This company absorbed the loss for</h4>
              <ul>
                {p.absorbedFrom.map((c) => (
                  <li key={c.slug}>
                    <button type="button" className="linklike" onClick={() => onCompany(c.slug)}>
                      {c.name}
                    </button>
                    <span className="mono small">
                      {' '}· {c.rows} row{c.rows === 1 ? '' : 's'}
                      {c.amountUsd > 0 ? ` · ${usd(c.amountUsd)}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* 4. Every row, with counter-evidence sitting beside the claims. */}
      <section className="company-rows">
        <div className="section-head">
          <h3>Every row on this company</h3>
          <div className="tabs">
            <Tab on={tab === 'all'} onClick={() => setTab('all')}>All ({p.rows.length})</Tab>
            <Tab on={tab === 'gains'} onClick={() => setTab('gains')}>Gain claims ({p.gains.length})</Tab>
            <Tab on={tab === 'counter'} onClick={() => setTab('counter')}>
              Counter-evidence ({p.counterEvidence.length})
            </Tab>
            <Tab on={tab === 'context'} onClick={() => setTab('context')}>Context ({p.context.length})</Tab>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="small">Nothing of that kind on this company.</p>
        ) : (
          <div className="claimlist">
            {rows.map((r: LedgerRow) => (
              <ClaimCard key={r.id} row={r} max={max} onCompany={onCompany} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * The connective tissue between one company and the shape of the whole
 * dataset.
 *
 * A reader who has just learned that IBM's gains were absorbed as slack
 * should be one click from the other companies that ended up in the
 * same place, because the repetition is the finding. The reason each
 * company is here is stated rather than implied — the two axes are
 * destination and condition count, and a card that matched on only one
 * of them should say which.
 */
export function SimilarCompanies({
  profile, allProfiles, max, onCompany,
}: {
  profile: CompanyProfile;
  allProfiles: CompanyProfile[];
  max: number;
  onCompany: (slug: string) => void;
}) {
  const similar = useMemo(() => {
    const slugs = relatedSlugs(profile, allProfiles);
    return allProfiles
      .filter((p) => slugs.has(p.slug))
      .sort((a, b) => b.claimedUsd - a.claimedUsd)
      .slice(0, 8);
  }, [profile, allProfiles]);

  if (profile.dominantDestination === null && profile.conditionsPassed === null) {
    return (
      <section className="company-similar">
        <h3>Similar companies</h3>
        <p className="small">
          This company has neither a coded destination nor a complete set of conditions, so there
          is nothing to match it against yet. That is a gap in the coding, not a finding about
          the company.
        </p>
      </section>
    );
  }

  if (similar.length === 0) {
    return (
      <section className="company-similar">
        <h3>Similar companies</h3>
        <p className="small">
          No other company in the current selection shares this one's destination or condition
          count. Clearing the filters may widen the comparison.
        </p>
      </section>
    );
  }

  return (
    <section className="company-similar">
      <div className="section-head">
        <h3>Similar companies</h3>
        <p className="small">
          Others that landed in the same place, or that meet the same number of the three
          conditions.
        </p>
      </div>

      <ul className="similar-list">
        {similar.map((s) => (
          <li key={s.slug}>
            <button type="button" className="similar-name" onClick={() => onCompany(s.slug)}>
              {s.name}
            </button>
            <span className="similar-why">{relationReason(profile, s)}</span>
            <GapBar claimed={s.claimedUsd} traced={s.tracedUsd} max={max} />
            <span className="similar-figure mono">
              {s.claimedUsd > 0 ? usd(s.claimedUsd) : '—'}
            </span>
            <Sparkline values={marginSeries(s)} width={54} height={16} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tab({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className="tab" aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}
