import { useEffect, useMemo, useState } from 'react';
import { supabase, configError } from './lib/supabase';
import { syntheticRows, useFixtures } from './lib/devData';
import type { LedgerRow } from './lib/types';
import { applyFilters, totals, type Filters } from './lib/filters';
import { buildProfiles, findProfile } from './lib/companies';
import { findingById, type Finding } from './lib/findings';
import {
  parseHash, navigate, companyRoute, togglePinned, type Route, type ViewName,
} from './lib/route';
import { selectionForNode, type FlowNode } from './lib/flow';
import { toCsv, downloadCsv } from './lib/csv';
import { usd } from './lib/format';
import { COPY } from './lib/labels';

import { FilterBar } from './components/FilterBar';
import { ActiveFilters } from './components/ActiveFilters';
import { HealthStrip } from './components/HealthStrip';
import { GapLegend } from './components/GapBar';
import { CompareTray } from './components/CompareTray';

import { FlowView } from './views/FlowView';
import { PatternsView } from './views/PatternsView';
import { FindingView } from './views/FindingsView';
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

   Flow first, because the shape of the dataset is the thing a reader
   cannot get anywhere else: how much was claimed, and how little of it
   reaches a filing. Patterns second, because the next question after
   "how big is the gap" is "who else is stuck like this".

   The three analytical cuts — destination, conditions, transfers — sit
   in a second row rather than competing with the two views that show
   everything at once. They are still linkable and unchanged; the flow
   diagram's own columns are now the natural way in.
   =================================================================== */

const NAV: Array<{ view: ViewName; label: string; blurb: string; section: string }> = [
  { view: 'flow', label: 'Flow', section: 'Read',
    blurb: 'Every claimed dollar, followed from the company that claimed it to whether a filing can show it.' },
  { view: 'patterns', label: 'Patterns', section: 'Read',
    blurb: 'All companies at once, grouped so that the ones stuck for the same reason sit together.' },
  { view: 'companies', label: 'Companies', section: 'Read',
    blurb: 'Every company in the ledger, one line each. Open one for its whole picture.' },
  { view: 'ledger', label: 'All rows', section: 'Read',
    blurb: 'The full record. Sort any column, open any row for its coding and its source.' },
  { view: 'destinations', label: 'Where gains landed', section: 'Lenses',
    blurb: 'Five destinations, ordered by distance from profit. Only the last one is margin.' },
  { view: 'conditions', label: 'Three conditions', section: 'Lenses',
    blurb: 'Billing unit, somewhere for the capacity to go, permission to act — tested against live filing data.' },
  { view: 'transfers', label: 'Who paid', section: 'Lenses',
    blurb: "A buyer's saving is often a supplier's revenue decline. This is the map of whose." },
  { view: 'queue', label: 'Needs checking', section: 'Maintain',
    blurb: 'Rows waiting on a primary source, each with the exact next step written out.' },
  { view: 'submit', label: 'Add a claim', section: 'Maintain',
    blurb: 'Post a claim to the inbox. Nothing appears in the ledger until it has been coded by hand.' },
  { view: 'method', label: 'Method', section: 'Maintain',
    blurb: 'The coding rules, in the same words the rest of the interface uses.' },
];

const SECTIONS = ['Read', 'Lenses', 'Maintain'];

export default function App() {
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [error, setError] = useState<string | null>(configError);
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHash = () => setRoute(parseHash(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    // Local rendering only. `useFixtures` is false in every production
    // build, so the bundler drops this branch and the module with it.
    if (useFixtures) {
      setRows(syntheticRows());
      setError(null);
      return;
    }
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

  const { filters, pinned } = route;

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

  // Every navigation carries the selection with it, because a filter
  // that survives one click and not the next is worse than no filter.
  const go = (view: ViewName) => navigate({ view, id: null, context: null, filters, pinned, focus: null });
  const setFilters = (next: Filters) =>
    navigate({ ...route, filters: next });
  const openCompany = (slug: string, context?: string) =>
    navigate(companyRoute(slug, context ?? null, filters, pinned));
  // A finding carries a complete selection, not a patch: opening one
  // reproduces exactly the question it answers rather than intersecting
  // it with whatever was already in force.
  const openFinding = (f: Finding) =>
    navigate({ view: 'finding', id: f.id, context: null, filters: f.filter, pinned, focus: null });
  const onTogglePin = (slug: string) =>
    navigate({ ...route, pinned: togglePinned(pinned, slug) });

  const onFlowSelect = (node: FlowNode) => {
    const patch = selectionForNode(node);
    // Carrying a node's selection out to every other view drops the
    // focus with it: the reader has asked to leave the diagram behind.
    if (patch) navigate({ ...route, filters: { ...filters, ...patch }, focus: null });
  };

  const onFocus = (id: string | null) => navigate({ ...route, focus: id });

  const current = NAV.find((n) => n.view === route.view);
  const finding = route.view === 'finding' ? findingById(route.id ?? '') : null;
  const showChrome = !['submit', 'method', 'company', 'finding'].includes(route.view);

  const heading =
    route.view === 'company'
      ? (findProfile(allProfiles, route.id ?? '')?.name ?? 'Company')
      : route.view === 'finding'
        ? 'Finding'
        : (current?.label ?? 'Flow');

  return (
    <div className={'shell' + (pinned.length ? ' has-tray' : '')}>
      <a className="skip-link" href="#main">Skip to content</a>

      <nav className="rail">
        <div className="rail-brand">
          <h1>AI Outcome Ledger</h1>
          <p>{all.length} rows · {allProfiles.length} companies</p>
        </div>

        {SECTIONS.map((section) => (
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
                    (n.view === 'flow' && route.view === 'finding')
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

      <main className="main" id="main">
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

        {rows !== null && route.view === 'flow' && (
          <FlowView
            rows={filtered}
            allRows={all}
            onSelect={onFlowSelect}
            onOpenFinding={openFinding}
            onCompany={openCompany}
            focus={route.focus}
            onFocus={onFocus}
          />
        )}

        {rows !== null && route.view === 'patterns' && (
          <PatternsView
            profiles={profiles}
            max={max}
            filters={filters}
            onFilters={setFilters}
            onCompany={openCompany}
            pinned={pinned}
            onTogglePin={onTogglePin}
          />
        )}

        {rows !== null && route.view === 'finding' && (
          finding ? (
            <FindingView
              finding={finding}
              rows={filtered}
              filters={filters}
              onCompany={openCompany}
              onBack={() => go('flow')}
            />
          ) : (
            <div className="empty">
              <strong>No finding by that name.</strong>
              <button type="button" className="btn" onClick={() => go('flow')}>Back to the flow</button>
            </div>
          )
        )}

        {rows !== null && route.view === 'companies' && (
          <CompaniesView profiles={profiles} max={max} onCompany={(s) => openCompany(s)} />
        )}

        {rows !== null && route.view === 'company' && (
          <CompanyView
            profile={findProfile(allProfiles, route.id ?? '')}
            allProfiles={allProfiles}
            context={route.context}
            max={max}
            filters={filters}
            onFilters={setFilters}
            pinned={pinned}
            onTogglePin={onTogglePin}
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

      {rows !== null && (
        <CompareTray
          profiles={allProfiles}
          pinned={pinned}
          max={max}
          onUnpin={onTogglePin}
          onClear={() => navigate({ ...route, pinned: [] })}
          onCompany={openCompany}
        />
      )}
    </div>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
