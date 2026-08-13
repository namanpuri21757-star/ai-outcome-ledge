import { useEffect, useMemo, useState } from 'react';
import { FilterBar } from './components/FilterBar';
import { HealthStrip } from './components/HealthStrip';
import { ConditionsView } from './views/ConditionsView';
import { DestinationsView } from './views/DestinationsView';
import { LedgerView } from './views/LedgerView';
import { MethodView } from './views/MethodView';
import { QueueView } from './views/QueueView';
import { ReconciliationView } from './views/ReconciliationView';
import { SubmitView } from './views/SubmitView';
import { TransfersView } from './views/TransfersView';
import { downloadCsv, toCsv } from './lib/csv';
import { EMPTY_FILTERS, applyFilters, totals, type Filters } from './lib/filters';
import { usd } from './lib/format';
import { configError, supabase } from './lib/supabase';
import type { LedgerRow } from './lib/types';

type ViewId = 'ledger' | 'reconciliation' | 'destinations' | 'transfers' | 'conditions' | 'queue' | 'submit' | 'method';

const VIEWS: Array<{ id: ViewId; label: string; blurb: string; section?: string }> = [
  { id: 'reconciliation', label: 'Reconciliation', blurb: 'Every dollar claim on one scale. Solid green is the portion tied to a disclosed line; hatched red is the rest.', section: 'Read' },
  { id: 'ledger', label: 'Ledger', blurb: 'The full record. Sort any column, open any row for the coding, the source, and what the margin did afterwards.' },
  { id: 'destinations', label: 'Destinations', blurb: 'Where the gains landed. Only the fifth column is P&L margin.' },
  { id: 'transfers', label: 'Transfers', blurb: "Who is taking it from whom. A buyer's saving is often a supplier's revenue decline, which nets to roughly zero in aggregate." },
  { id: 'conditions', label: 'Conditions', blurb: 'Billing unit, demand sink, permission to act. The hypothesis, tested against live filing data.' },
  { id: 'queue', label: 'Verification', blurb: 'What still needs a primary source, and the exact next step for each one.', section: 'Maintain' },
  { id: 'submit', label: 'Add a claim', blurb: 'Post something you have found into the inbox. Coding stays manual.' },
  { id: 'method', label: 'Method', blurb: 'The coding rules, and the rules the corpus follows.' },
];

export default function App() {
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [error, setError] = useState<string | null>(configError);
  const [view, setView] = useState<ViewId>('reconciliation');
  const [filters, setFilters] = useState<Filters>({ ...EMPTY_FILTERS });

  useEffect(() => {
    if (configError) return;
    let alive = true;
    supabase
      .from('v_ledger')
      .select('*')
      .order('claim_date', { ascending: false })
      .then(({ data, error: err }) => {
        if (!alive) return;
        if (err) {
          setError(
            `${err.message}. If this says the relation does not exist, the SQL files have not been run yet.`,
          );
          setRows([]);
          return;
        }
        setRows((data as LedgerRow[]) ?? []);
      });
    return () => { alive = false; };
  }, []);

  const filtered = useMemo(() => (rows ? applyFilters(rows, filters) : []), [rows, filters]);
  const t = useMemo(() => totals(filtered), [filtered]);
  const current = VIEWS.find((v) => v.id === view)!;

  const focusCompany = (slug: string) => {
    setFilters({ ...EMPTY_FILTERS, companies: [slug] });
    setView('ledger');
  };

  return (
    <div className="shell">
      <nav className="rail">
        <div className="rail-brand">
          <h1>AI Outcome Ledger</h1>
          <p>{rows ? `${rows.length} rows · ${t.companies} entities` : 'loading…'}</p>
        </div>
        <div className="rail-nav">
          {VIEWS.map((v) => (
            <div key={v.id}>
              {v.section && <div className="rail-section">{v.section}</div>}
              <button
                aria-current={view === v.id}
                onClick={() => setView(v.id)}
                style={{ width: '100%' }}
              >
                {v.label}
              </button>
            </div>
          ))}
        </div>
        <div className="rail-section">Selection</div>
        <div style={{ padding: '0 18px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--ink-2)' }}>
          <div>{filtered.length} rows</div>
          <div>{usd(t.claimedUsd)} claimed</div>
          <div style={{ color: 'var(--gap)' }}>{usd(t.unreconciledUsd)} not tied out</div>
        </div>
      </nav>

      <main className="main">
        <div className="view-head">
          <span className="eyebrow">{current.section ?? 'Read'} / {current.label}</span>
          <h2>{current.label}</h2>
          <p>{current.blurb}</p>
        </div>

        {error && (
          <div className="health failed">
            <span className="dot" />
            <span>{error}</span>
          </div>
        )}

        {!error && <HealthStrip />}

        {rows === null && <div className="empty">Loading the ledger…</div>}

        {rows !== null && view !== 'submit' && view !== 'method' && (
          <FilterBar
            filters={filters}
            onChange={setFilters}
            rows={rows}
            matched={filtered.length}
            onExport={() => downloadCsv(`ai-outcome-ledger-${today()}.csv`, toCsv(filtered))}
          />
        )}

        {rows !== null && view === 'reconciliation' && (
          <ReconciliationView rows={filtered} onSelect={focusCompany} />
        )}
        {rows !== null && view === 'ledger' && (
          <LedgerView rows={filtered} onFilterCompany={focusCompany} />
        )}
        {rows !== null && view === 'destinations' && (
          <DestinationsView
            rows={filtered}
            onPick={(d) => { setFilters({ ...filters, destinations: [d] }); setView('ledger'); }}
          />
        )}
        {rows !== null && view === 'transfers' && (
          <TransfersView rows={filtered} onPick={focusCompany} />
        )}
        {rows !== null && view === 'conditions' && (
          <ConditionsView rows={filtered} onPick={focusCompany} />
        )}
        {rows !== null && view === 'queue' && <QueueView rows={filtered} />}
        {view === 'submit' && <SubmitView />}
        {view === 'method' && <MethodView />}
      </main>
    </div>
  );
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
