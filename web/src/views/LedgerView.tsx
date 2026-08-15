import { useMemo, useState } from 'react';
import type { Dataset, LedgerRow } from '../lib/types';
import {
  barMax, byDestination, destinationBarMax, headline, plural, totals,
} from '../lib/aggregate';
import { applyFilters, isFilterActive, sortRows, type Filters, type SortKey } from '../lib/filters';
import { buildProfiles } from '../lib/companies';
import { corpusNote, readout } from '../lib/readout';
import { COPY, destination } from '../lib/labels';
import { usd } from '../lib/format';
import type { Freshness } from '../lib/health';
import { toCsv, downloadCsv } from '../lib/csv';

import { GapBar, GapKey } from '../components/GapBar';
import { Term } from '../components/Term';
import { FilterPanel } from '../components/FilterPanel';
import { ClaimRow, CompanyRow } from '../components/ClaimRow';

/* ===================================================================
   The front door.

   Order is the argument: the finding, then why the rest of it is not in
   a filing, then what that means, then the rows. A reader who stops
   after the first screen has the finding; everything under it is
   elaboration, and it is set at elaboration's weight.
   =================================================================== */

interface Props {
  data: Dataset;
  filters: Filters;
  onFilters: (f: Filters) => void;
  freshness: Freshness;
  onClaim: (ref: string) => void;
  onCompany: (slug: string) => void;
}

type Grouping = 'claim' | 'company';

export function LedgerView({ data, filters, onFilters, freshness, onClaim, onCompany }: Props) {
  const all = data.rows;
  const [grouping, setGrouping] = useState<Grouping>('claim');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({
    key: 'claimed_amount_usd',
    dir: 'desc',
  });

  const filtered = useMemo(() => applyFilters(all, filters), [all, filters]);
  const max = useMemo(() => barMax(all), [all]);
  const destMax = useMemo(() => destinationBarMax(all), [all]);
  const h = useMemo(() => headline(all, usd), [all]);
  const items = useMemo(() => readout(all, usd), [all]);
  const filtering = isFilterActive(filters);

  return (
    <>
      {/* ── 1. The finding ─────────────────────────────────────── */}
      <section className="finding" aria-labelledby="finding-h">
        <h2 id="finding-h" className="sr-only">
          The finding
        </h2>

        {h.sharePct === null ? (
          <p className="finding-null">{h.sentence}</p>
        ) : (
          <p className="finding-line">
            <span className="finding-figure">{h.sharePct.toFixed(1)}%</span>
            <span className="finding-say">{h.sentence}</span>
          </p>
        )}

        <div className="finding-bar">
          <GapBar claimed={h.claimedUsd} traced={h.tracedUsd} max={h.claimedUsd || 1} size="lg" labels={false} />
          <div className="finding-split">
            <span className="is-traced">
              <strong>{usd(h.tracedUsd)}</strong> <Term kind="phrase" code="traceable" />
            </span>
            <span className="is-gap">
              <strong>{usd(h.untracedUsd)}</strong> <Term kind="phrase" code="untraceable" />
            </span>
          </div>
        </div>

        <p className="finding-clarify">{COPY.untracedMeaning}</p>

        {h.asideSentence && <p className="finding-aside">{h.asideSentence}</p>}

        <p className="finding-provenance">
          {corpusNote(all, usd)} {freshness.sentence}
        </p>
      </section>

      {/* ── 2. Where it went instead ──────────────────────────── */}
      <section className="breakdown" aria-labelledby="breakdown-h">
        <h2 id="breakdown-h">
          <Term kind="phrase" code="destination" as="block">
            Where the claimed dollars went instead
          </Term>
        </h2>
        <p className="section-lede">
          Five places a freed hour can end up, ordered by distance from profit. Only the last of
          them is margin.
        </p>
        <GapKey />

        <ol className="breakdown-list">
          {byDestination(all).map((b) => {
            const d = destination(b.key);
            const t = b.totals;
            return (
              <li key={b.key} className={'breakdown-item tone-' + d.tone}>
                <div className="breakdown-head">
                  <h3>
                    <Term kind="destination" code={b.key} as="block" />
                  </h3>
                  <span className="breakdown-count">
                    {t.gainClaims} gain {plural(t.gainClaims, 'claim')}
                    {t.rows > t.gainClaims && ` · ${t.rows - t.gainClaims} other ${plural(t.rows - t.gainClaims, 'row')}`}
                  </span>
                </div>

                {t.gainClaims === 0 ? (
                  <p className="breakdown-empty">
                    No gain claim in the ledger is coded here. An empty destination is a finding,
                    not a gap.
                  </p>
                ) : t.claimedUsd > 0 ? (
                  <GapBar claimed={t.claimedUsd} traced={t.tracedUsd} max={destMax} />
                ) : (
                  <p className="breakdown-empty">
                    {t.gainClaims} {plural(t.gainClaims, 'claim')} land here, none of them stated in
                    dollars.
                  </p>
                )}

                <button
                  type="button"
                  className="breakdown-open"
                  onClick={() =>
                    onFilters({ ...filters, destinations: [b.key], kinds: ['gain_claim'] })
                  }
                  disabled={b.rows.length === 0}
                >
                  Show these {b.rows.length} {plural(b.rows.length, 'row')} below
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {/* ── 3. What that means ────────────────────────────────── */}
      <section className="readout" aria-labelledby="readout-h">
        <h2 id="readout-h">What the rows say</h2>
        <p className="section-lede">
          Every sentence here is assembled from the rows at the moment the page renders, so it
          cannot disagree with the ledger below it.
        </p>
        <dl className="readout-list">
          {items.map((it) => (
            <div className="readout-item" key={it.id}>
              <dt>{it.question}</dt>
              <dd>
                <p>{it.answer}</p>
                {it.select && it.rowCount > 0 && (
                  <button
                    type="button"
                    className="readout-open"
                    onClick={() =>
                      onFilters({
                        search: '', kinds: [], bases: [], destinations: [],
                        verification: [], groups: [], companies: [], dollarsOnly: false,
                        ...it.select,
                      })
                    }
                  >
                    Show the {it.rowCount} {plural(it.rowCount, 'row')}{' '}
                    {it.selectLabel ?? 'behind this'}
                  </button>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {/* ── 4. The rows ───────────────────────────────────────── */}
      <section className="rows" aria-labelledby="rows-h" id="rows">
        <h2 id="rows-h">The record</h2>
        <p className="section-lede">
          All {all.length} rows, hand-coded. Open one for its coding, its source, and what the
          filings show.
        </p>

        <FilterPanel
          all={all}
          filters={filters}
          onChange={onFilters}
          matched={filtered.length}
          onExport={() =>
            downloadCsv(`ai-outcome-ledger-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(filtered))
          }
        />

        <div className="rows-controls">
          <div className="seg" role="group" aria-label="Group the record by">
            <button
              type="button"
              aria-pressed={grouping === 'claim'}
              onClick={() => setGrouping('claim')}
            >
              By claim
            </button>
            <button
              type="button"
              aria-pressed={grouping === 'company'}
              onClick={() => setGrouping('company')}
            >
              By company
            </button>
          </div>

          {grouping === 'claim' && (
            <label className="rows-sort">
              <span>Sort</span>
              <select
                value={`${sort.key}:${sort.dir}`}
                onChange={(e) => {
                  const [key, dir] = e.target.value.split(':');
                  setSort({ key: key as SortKey, dir: dir as 'asc' | 'desc' });
                }}
              >
                <option value="claimed_amount_usd:desc">Largest claim first</option>
                <option value="traceable_to_pl_usd:desc">Most traceable first</option>
                <option value="claim_date:desc">Newest first</option>
                <option value="claim_date:asc">Oldest first</option>
                <option value="company_name:asc">Company A–Z</option>
              </select>
            </label>
          )}

          <p className="rows-scope">
            {filtering
              ? `${filtered.length} of ${all.length} rows match this selection.`
              : `All ${all.length} rows.`}
          </p>
        </div>

        <GapKey />

        {filtered.length === 0 ? (
          <EmptySelection filters={filters} onClear={() => onFilters({
            search: '', kinds: [], bases: [], destinations: [],
            verification: [], groups: [], companies: [], dollarsOnly: false,
          })} />
        ) : grouping === 'claim' ? (
          <ul className="claimlist">
            {sortRows(filtered, sort.key, sort.dir).map((r) => (
              <ClaimRow key={r.id} row={r} max={max} onOpen={onClaim} onCompany={onCompany} />
            ))}
          </ul>
        ) : (
          <CompanyList rows={filtered} max={max} onCompany={onCompany} />
        )}
      </section>
    </>
  );
}

/* ------------------------------------------------------------------ */

function CompanyList({
  rows, max, onCompany,
}: {
  rows: LedgerRow[];
  max: number;
  onCompany: (slug: string) => void;
}) {
  const profiles = useMemo(() => buildProfiles(rows), [rows]);
  const companyMax = useMemo(
    () => Math.max(...profiles.map((p) => p.totals.claimedUsd), 1),
    [profiles],
  );
  void max;

  return (
    <ul className="companylist">
      {profiles.map((p) => (
        <CompanyRow
          key={p.slug}
          max={companyMax}
          onCompany={onCompany}
          entry={{
            slug: p.slug,
            name: p.name,
            groupName: p.groupName,
            rows: p.totals.rows,
            gainClaims: p.totals.gainClaims,
            claimedUsd: p.totals.claimedUsd,
            tracedUsd: p.totals.tracedUsd,
            dominant: p.dominantDestination,
          }}
        />
      ))}
    </ul>
  );
}

/**
 * A selection that matches nothing states which parts of itself are
 * responsible, so a reader can undo the one that went too far rather
 * than clearing everything and starting over.
 */
function EmptySelection({ filters, onClear }: { filters: Filters; onClear: () => void }) {
  const parts: string[] = [];
  if (filters.search.trim()) parts.push(`the text “${filters.search.trim()}”`);
  if (filters.kinds.length) parts.push('the kind of row');
  if (filters.destinations.length) parts.push('where the gain landed');
  if (filters.bases.length) parts.push('what was measured');
  if (filters.verification.length) parts.push('how well sourced');
  if (filters.groups.length) parts.push('the kind of company');
  if (filters.companies.length) parts.push('the company');
  if (filters.dollarsOnly) parts.push('claims stated in dollars');

  return (
    <div className="empty">
      <p>
        <strong>No row matches this selection.</strong>
      </p>
      <p>
        {parts.length > 1
          ? `Nothing in the ledger satisfies all of ${parts.length} filters at once — ${parts.join(', ')}. Removing one will bring rows back.`
          : parts.length === 1
            ? `Nothing in the ledger matches ${parts[0]}.`
            : 'The ledger is empty.'}
      </p>
      <button type="button" className="btn" onClick={onClear}>
        Clear the selection
      </button>
    </div>
  );
}

/** Kept beside the view it belongs to. */
export function ledgerTotalsFor(rows: LedgerRow[]) {
  return totals(rows);
}
