import { useEffect, useMemo, useState } from 'react';
import type { Dataset, FetchRun } from './lib/types';
import { configError, friendlyError, loadDataset, loadRuns } from './lib/supabase';
import { syntheticDataset, useFixtures } from './lib/devData';
import { freshness } from './lib/health';
import { COPY, NAV } from './lib/labels';
import {
  claimRoute, companyRoute, isCover, ledgerRoute, navigate, parseHash, type Route, type ViewName,
} from './lib/route';
import type { Filters } from './lib/filters';

import { HomeView } from './views/HomeView';
import { ThesisView } from './views/ThesisView';
import { DirectoryView } from './views/DirectoryView';
import { LedgerView } from './views/LedgerView';
import { ClaimView } from './views/ClaimView';
import { CompanyView } from './views/CompanyView';
import { MethodView } from './views/MethodView';
import { MaintenanceView } from './views/MaintenanceView';

/* ===================================================================
   The shell: load once, route, and get out of the way.

   Three items in the nav, down from ten. Two more surfaces exist —
   one claim and one company — and both are reached by clicking a thing
   rather than by choosing a place, which is why neither is in the nav.

   There is no global sidebar and no global totals. Every figure belongs
   to the view that computes it, from the rows that view is actually
   showing, which is what makes a filter applied in one place unable to
   change a number in another.

   Three views render outside this shell — the landing page, the
   blueprint and the directory. They have no masthead and no footer
   because they are a cover: one shared top bar is the whole of their
   chrome, and its nav labels come from the same list the masthead
   reads, so a section cannot come to be called two things.
   =================================================================== */

export default function App() {
  const [data, setData] = useState<Dataset | null>(null);
  const [runs, setRuns] = useState<FetchRun[]>([]);
  const [error, setError] = useState<string | null>(configError);
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(window.location.hash));
      window.scrollTo({ top: 0, behavior: 'auto' });
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    // Local rendering only. `useFixtures` is false in every production
    // build, so the bundler drops this branch and the module with it.
    if (useFixtures) {
      setData(syntheticDataset());
      setError(null);
      return;
    }
    if (configError) return;

    let alive = true;
    loadDataset()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(friendlyError(String(e?.message ?? e))));
    // The run log is only needed for one sentence on the ledger, so a
    // failure to read it must never stop the ledger from rendering.
    loadRuns()
      .then((r) => alive && setRuns(r))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const fresh = useMemo(() => freshness(runs), [runs]);

  const go = (view: ViewName) =>
    navigate(view === 'ledger' ? ledgerRoute(route.filters) : { view, id: null, filters: route.filters });
  const setFilters = (f: Filters) => navigate(ledgerRoute(f));
  const openClaim = (ref: string) => navigate(claimRoute(ref));
  const openCompany = (slug: string) => navigate(companyRoute(slug));
  const back = () => {
    if (window.history.length > 1) window.history.back();
    else navigate(ledgerRoute(route.filters));
  };

  // Before the shell, because they replace it rather than sitting inside
  // it. Every hook above has already run, so the early return is safe.
  if (isCover(route.view)) {
    if (route.view === 'thesis') return <ThesisView data={data} error={error} onGo={go} />;
    if (route.view === 'directory') {
      return <DirectoryView data={data} error={error} onGo={go} onCompany={openCompany} />;
    }
    return <HomeView data={data} error={error} onGo={go} onClaim={openClaim} />;
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>

      <header className="masthead">
        <div className="masthead-brand">
          <button type="button" className="masthead-title" onClick={() => go('ledger')}>
            {COPY.title}
          </button>
          <p>{COPY.strapline}</p>
        </div>

        <nav className="masthead-nav" aria-label="Sections">
          {NAV.map((n) => (
            <button
              key={n.view}
              type="button"
              onClick={() => go(n.view)}
              aria-current={
                route.view === n.view ||
                (n.view === 'ledger' && (route.view === 'claim' || route.view === 'company'))
                  ? 'page'
                  : undefined
              }
            >
              {n.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="main" id="main">
        {error && (
          <div className="failure" role="alert">
            <h2>The ledger could not be loaded</h2>
            <p>{error}</p>
          </div>
        )}

        {!error && data === null && (
          <div className="empty">
            <p>Loading the ledger…</p>
          </div>
        )}

        {!error && data !== null && (
          <>
            {route.view === 'ledger' && (
              <LedgerView
                data={data}
                filters={route.filters}
                onFilters={setFilters}
                freshness={fresh}
                onClaim={openClaim}
                onCompany={openCompany}
              />
            )}

            {route.view === 'claim' && (
              <ClaimView
                data={data}
                claimRef={route.id ?? ''}
                onCompany={openCompany}
                onBack={back}
              />
            )}

            {route.view === 'company' && (
              <CompanyView
                data={data}
                slug={route.id ?? ''}
                onClaim={openClaim}
                onCompany={openCompany}
                onBack={back}
              />
            )}

            {route.view === 'method' && <MethodView />}

            {route.view === 'maintenance' && (
              <MaintenanceView data={data} onClaim={openClaim} />
            )}
          </>
        )}
      </main>

      <footer className="footer">
        <p>
          A maintained record of public claims of an AI gain, coded against what was actually
          measured. Half hand-coded, half collected from SEC filings.
        </p>
      </footer>
    </div>
  );
}
