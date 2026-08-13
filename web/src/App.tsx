import { useEffect, useMemo, useState } from 'react';
import { supabase, configError } from './lib/supabase';
import type { LedgerRow } from './lib/types';
import { EMPTY_FILTERS, applyFilters, totals, type Filters } from './lib/filters';
import { buildProfiles, findProfile } from './lib/companies';
import { findingById, type Finding } from './lib/findings';
import { parseHash, navigate, companyRoute, type Route, type ViewName } from './lib/route';
import { toCsv, downloadCsv } from './lib/csv';
import { usd } from './lib/format';
import { COPY } from './lib/labels';

import { FilterBar } from './components/FilterBar';
import { ActiveFilters } from './components/ActiveFilters';
import { HealthStrip } from './components/HealthStrip';
import { GapLegend } from './components/GapBar';

import { FindingsView, FindingView } from './views/FindingsView';
import { CompaniesView } from './views/CompaniesView';
import { CompanyView } from './views/CompanyView';
import { DestinationsView } from './views/DestinationsView';
import { ConditionsView } from './views/ConditionsView';
import { TransfersView } from './views/TransfersView';
import { LedgerView } from './views/LedgerView';
import { QueueView } from './views/QueueView';
import { SubmitView } from './views/SubmitView';
import { MethodView } from './views/MethodView';

/* ===================================================================
   Navigation order is an argument about what this thing is for.

   Findings first, because the reader arrives with a question. Companies
   second, because that is the unit they think in. The raw table last,
   because it is an appendix — it was the front door before, and being
   met by 84 undifferentiated rows behind six rows of filter chips is
   what made the app feel like a database rather than a set of answers.
   =================================================================== */

const NAV: Array<{ view: ViewName; label: string; blurb: string; section: string }> = [
  { view: 'findings', label: 'Findings', section: 'Read',
    blurb: 'The questions this ledger exists to answer, computed from the rows on every load.' },
  { view: 'companies', label: 'Companies', section: 'Read',
    blurb: 'Every company in the ledger, one line each. Open one for its whole picture.' },
  { view: 'destinations', label: 'Where gains landed', section: 'Read',
    blurb: 'Five destinations, ordered by distance from profit. Only the last one is margin.' },
  { view: 'conditions', label: 'Three conditions', section: 'Read',
    blurb: 'Billing unit, somewhere for the capacity to go, permission to act — tested against live filing data.' },
  { view: 'transfers', label: 'Who paid', section: 'Read',
    blurb: "A buyer's saving is often a supplier's revenue decline. This is the map of whose." },
  { view: 'ledger', label: 'All rows', section: 'Read',
    blurb: 'The full record. Sort any column, open any row for its coding and its source.' },
  { view: 'queue', label: 'Needs checking', section: 'Maintain',
    blurb: 'Rows waiting on a primary source, each with the exact next step written out.' },
  { view: 'submit', label: 'Add a claim', section: 'Maintain',
    blurb: 'Post a claim to the inbox. Nothing appears in the ledger until it has been coded by hand.' },
  { view: 'method', label: 'Method', section: 'Maintain',
    blurb: 'The coding rules, in the same words the rest of the interface uses.' },
];

export default function App() {
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [error, setError] = useState<string | null>(configError);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (configError) return;
    let alive = true;
    supabase
      .from('v_ledger')
      .select('*')
      .order('claim_date', { ascending: false })
      .limit(2000)
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) {
          setError(
            err.message.includes('does not exist')
              ? 'The database views are missing. Run the SQL files in order in the Supabase SQL editor.'
              : err.message,
          );
          return;
        }
        setRows((data as LedgerRow[]) ?? []);
      });
    return () => { alive = false; };
  }, []);

  const all = rows ?? [];
  const filtered = useMemo(() => applyFilters(all, filters), [all, filters]);
  const profiles = useMemo(() => buildProfiles(filtered), [filtered]);
  const allProfiles = useMemo(() => buildProfiles(all), [all]);

  /** One scale for every reconciliation bar in the app, so two bars in
   *  different views are still comparable to each other. */
  const max = useMemo(
    () => Math.max(...all.filter((r) => r.claim_kind === 'gain_claim')
      .map((r) => r.claimed_amount_usd ?? 0), 1),
    [all],
  );

  const t = totals(filtered);

  const go = (view: ViewName) => navigate({ view, id: null, context: null });
  const openCompany = (slug: string, context?: string) => navigate(companyRoute(slug, context ?? null));
  const openFinding = (f: Finding) => {
    setFilters(f.filter);
    navigate({ view: 'finding', id: f.id, context: null });
  };

  const current = NAV.find((n) => n.view === route.view);
  const finding = route.view === 'finding' ? findingById(route.id ?? '') : null;
  const showChrome = !['submit', 'method', 'company', 'finding'].includes(route.view);

  const heading =
    route.view === 'company'
      ? (findProfile(allProfiles, route.id ?? '')?.name ?? 'Company')
      : route.view === 'finding'
        ? 'Finding'
        : (current?.label ?? 'Findings');

  return (
    <div className="shell">
      <nav className="rail">
        <div className="rail-brand">
          <h1>AI Outcome Ledger</h1>
          <p>{all.length} rows · {allProfiles.length} companies</p>
        </div>

        {['Read', 'Maintain'].map((section) => (
          <div key={section}>
            <div className="rail-section">{section}</div>
            <div className="rail-nav">
              {NAV.filter((n) => n.section === section).map((n) => (
                <button
                  key={n.view}
                  type="button"
                  onClick={() => go(n.view)}
                  aria-current={
                    route.view === n.view ||
                    (n.view === 'companies' && route.view === 'company') ||
                    (n.view === 'findings' && route.view === 'finding')
                  }
                >
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="rail-section">Selection</div>
        <div className="rail-selection">
          <div>{t.claims} rows</div>
          <div>{usd(t.claimedUsd)} claimed</div>
          <div className="is-traced">{usd(t.tracedUsd)} traceable</div>
          <div className="is-gap" title={COPY.untracedMeaning}>{usd(t.unreconciledUsd)} not</div>
        </div>
      </nav>

      <main className="main">
        <div className="view-head">
          <span className="eyebrow">
            {route.view === 'company' ? 'Read / Companies /' : `${current?.section ?? 'Read'} /`}{' '}
            {heading}
          </span>
          {route.view !== 'company' && route.view !== 'finding' && (
            <>
              <h2>{current?.label}</h2>
              <p>{current?.blurb}</p>
            </>
          )}
        </div>

        {error && (
          <div className="health failed">
            <span className="dot" />
            <span>{error}</span>
          </div>
        )}
        {!error && <HealthStrip />}

        {rows === null && !error && <div className="empty">Loading the ledger…</div>}

        {rows !== null && showChrome && (
          <>
            <FilterBar
              filters={filters}
              onChange={setFilters}
              rows={all}
              matched={filtered.length}
              onExport={() => downloadCsv(`ai-outcome-ledger-${today()}.csv`, toCsv(filtered))}
            />
            <ActiveFilters
              filters={filters}
              onChange={setFilters}
              matched={filtered.length}
              total={all.length}
            />
          </>
        )}

        {rows !== null && (route.view === 'ledger' || route.view === 'destinations' || route.view === 'companies') && (
          <div style={{ margin: '0 0 14px' }}><GapLegend /></div>
        )}

        {rows !== null && route.view === 'findings' && (
          <FindingsView rows={filtered} allRows={all} onOpen={openFinding} onCompany={openCompany} />
        )}

        {rows !== null && route.view === 'finding' && (
          finding ? (
            <FindingView
              finding={finding}
              rows={filtered}
              filters={filters}
              onCompany={openCompany}
              onBack={() => go('findings')}
            />
          ) : (
            <div className="empty">
              <strong>No finding by that name.</strong>
              <button type="button" className="btn" onClick={() => go('findings')}>All findings</button>
            </div>
          )
        )}

        {rows !== null && route.view === 'companies' && (
          <CompaniesView profiles={profiles} max={max} onCompany={(s) => openCompany(s)} />
        )}

        {rows !== null && route.view === 'company' && (
          <CompanyView
            profile={findProfile(allProfiles, route.id ?? '')}
            context={route.context}
            max={max}
            onCompany={(s) => openCompany(s)}
            onBack={() => window.history.back()}
          />
        )}

        {rows !== null && route.view === 'destinations' && (
          <DestinationsView
            rows={filtered}
            max={max}
            onCompany={openCompany}
            onFilterDestination={(rank) => setFilters({ ...filters, destinations: [rank] })}
          />
        )}

        {rows !== null && route.view === 'conditions' && (
          <ConditionsView rows={filtered} onCompany={openCompany} />
        )}

        {rows !== null && route.view === 'transfers' && (
          <TransfersView rows={filtered} onCompany={openCompany} />
        )}

        {rows !== null && route.view === 'ledger' && (
          <LedgerView rows={filtered} max={max} onCompany={openCompany} />
        )}

        {rows !== null && route.view === 'queue' && (
          <QueueView rows={filtered} onCompany={openCompany} />
        )}

        {route.view === 'submit' && <SubmitView />}
        {route.view === 'method' && <MethodView />}
      </main>
    </div>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
