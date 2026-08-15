import { useMemo } from 'react';
import type { Dataset } from '../lib/types';
import { buildProfiles, emptyProfileNote, findProfile, verdict } from '../lib/companies';
import { plural } from '../lib/aggregate';
import { CONDITION_LIST, destination, kind } from '../lib/labels';
import { shortDate, usd } from '../lib/format';
import { MARGIN_SERIES, marginWindow, measuredCount } from '../lib/outcome';
import { GapBar, GapKey } from '../components/GapBar';
import { Term } from '../components/Term';
import { MarginLine } from '../components/MarginWindow';

/* ===================================================================
   One company's whole record.

   Scope is stated, and it is absolute: this page is built from every
   row belonging to the company, never from the ledger's selection. The
   previous build handed it the active filter and then printed its own
   unfiltered figures beside the filtered sidebar, so the same screen
   said "10 rows · $4.15B" and "6 gain claims worth $4.26B" at once.
   `route.ts` now makes that impossible — the route carries no filter.
   =================================================================== */

interface Props {
  data: Dataset;
  slug: string;
  onClaim: (ref: string) => void;
  onCompany: (slug: string) => void;
  onBack: () => void;
}

export function CompanyView({ data, slug, onClaim, onCompany, onBack }: Props) {
  const profiles = useMemo(() => buildProfiles(data.rows), [data.rows]);
  const p = findProfile(profiles, slug);

  if (!p) {
    return (
      <div className="empty">
        <p><strong>No company by that name in the ledger.</strong></p>
        <p>{emptyProfileNote(slug)}</p>
        <button type="button" className="btn" onClick={onBack}>Back to the ledger</button>
      </div>
    );
  }

  const t = p.totals;
  const margin = data.series.get(p.slug)?.get(MARGIN_SERIES);
  const windows = p.gains.map((r) => marginWindow(r, margin));
  const counted = measuredCount(windows);
  const rowMax = Math.max(...p.rows.map((r) => r.claimed_amount_usd ?? 0), 1);

  return (
    <article className="company">
      <nav className="crumb">
        <button type="button" onClick={onBack}>The ledger</button>
      </nav>

      <header className="company-head">
        <h2>{p.name}</h2>
        <p className="company-idents">
          <Term kind="group" code={p.groupCode ?? ''}>{p.groupName}</Term>
          {p.sector && <><span aria-hidden="true">·</span><span>{p.sector}</span></>}
          {p.ticker && <><span aria-hidden="true">·</span><span className="mono">{p.ticker}</span></>}
          <span aria-hidden="true">·</span>
          <span>{p.isPublic ? 'Files with the SEC' : 'Does not file with the SEC'}</span>
        </p>
      </header>

      {/* The most important prose on the site. Serif, sentence case,
          normal weight, generous measure — it was four lines of
          all-caps condensed serif and nobody could read it. */}
      <p className="company-verdict">{verdict(p, usd)}</p>

      <p className="company-scope">
        This page shows all {t.rows} {plural(t.rows, 'row')} recorded for {p.name}, between{' '}
        {shortDate(p.firstClaim)} and {shortDate(p.lastClaim)}. Filters set on the ledger are not
        applied here.
      </p>

      {/* ── Reconciliation ─────────────────────────────────────── */}
      <section className="company-block" aria-labelledby="co-recon">
        <h3 id="co-recon">What was claimed, and what can be found</h3>
        {t.dollarClaims > 0 ? (
          <>
            <dl className="kv">
              <div>
                <dt><Term kind="phrase" code="claimed">Claimed</Term></dt>
                <dd className="num">{usd(t.claimedUsd)}</dd>
              </div>
              <div>
                <dt><Term kind="phrase" code="traceable">Traceable</Term></dt>
                <dd className="num is-traced">{usd(t.tracedUsd)}</dd>
              </div>
              <div>
                <dt><Term kind="phrase" code="untraceable">Not traceable</Term></dt>
                <dd className="num is-gap">{usd(t.untracedUsd)}</dd>
              </div>
            </dl>
            <GapBar claimed={t.claimedUsd} traced={t.tracedUsd} max={t.claimedUsd} labels={false} />
          </>
        ) : (
          <p className="claim-null">
            {t.gainClaims === 0
              ? `${p.name} makes no gain claim in this ledger, so there is nothing to reconcile.`
              : `None of ${p.name}'s ${t.gainClaims} gain ${plural(t.gainClaims, 'claim')} names a figure in dollars, so there is no reconciliation total for this company.`}
            {t.tracedOutsideDenominatorUsd > 0 &&
              ` ${usd(t.tracedOutsideDenominatorUsd)} is nonetheless traceable to a filing line.`}
          </p>
        )}
      </section>

      {/* ── Destination mix ────────────────────────────────────── */}
      {p.destinationMix.length > 0 && (
        <section className="company-block" aria-labelledby="co-dest">
          <h3 id="co-dest">
            <Term kind="phrase" code="destination" as="block">Where the gains landed</Term>
          </h3>
          <ul className="destmix">
            {p.destinationMix.map((m) => {
              const d = destination(m.rank);
              return (
                <li key={m.rank} className={'tone-' + d.tone}>
                  <span className="destmix-name">
                    <Term kind="destination" code={m.rank}>{d.name}</Term>
                  </span>
                  <span className="destmix-count">
                    {m.rows} {plural(m.rows, 'claim')}
                    {m.claimedUsd > 0 ? ` · ${usd(m.claimedUsd)}` : ' · no dollar figure'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ── Conditions ─────────────────────────────────────────── */}
      <section className="company-block" aria-labelledby="co-cond">
        <h3 id="co-cond">
          <Term kind="phrase" code="conditions" as="block">The three conditions</Term>
        </h3>
        <ul className="conditions">
          {CONDITION_LIST.map((c) => {
            const v = p.conditions[c.key];
            return (
              <li key={c.key} className={'condition is-' + (v === true ? 'pass' : v === false ? 'fail' : 'void')}>
                <span className="condition-mark" aria-hidden="true">
                  {v === true ? '✓' : v === false ? '✗' : '–'}
                </span>
                <span className="condition-body">
                  <Term kind="condition" code={c.key}>{c.name}</Term>
                  <span className="condition-state">
                    {v === true ? c.passes
                      : v === false ? c.fails
                      : "Not coded consistently across this company's rows, so no single answer is given."}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ── What the filings show ──────────────────────────────── */}
      <section className="company-block" aria-labelledby="co-margin">
        <h3 id="co-margin">
          <Term kind="phrase" code="margin_window" as="block">What the filings show</Term>
        </h3>
        {p.gains.length === 0 ? (
          <p className="claim-null">
            There is no gain claim here to measure against a filing.
          </p>
        ) : (
          <>
            <p className="section-lede">
              {counted.measured} of {p.gains.length} gain {plural(p.gains.length, 'claim')} can be
              measured against a filed operating margin
              {counted.tooSoon > 0 && `, ${counted.tooSoon} not yet`}
              {counted.impossible > 0 && `, and ${counted.impossible} not at all`}.
            </p>
            <ul className="marginlist">
              {p.gains.map((r, i) => (
                <li key={r.id}>
                  <button type="button" className="marginlist-headline" onClick={() => onClaim(r.ref)}>
                    {r.headline}
                  </button>
                  <MarginLine row={r} margin={margin} />
                  <span className="marginlist-meta">
                    {r.claim_date} · {windows[i].status === 'measured' ? 'measured' : 'not measured'}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {/* ── Transfers ──────────────────────────────────────────── */}
      {(p.counterparties.length > 0 || p.absorbedFrom.length > 0) && (
        <section className="company-block" aria-labelledby="co-transfer">
          <h3 id="co-transfer">Whose revenue line paid</h3>
          {p.counterparties.length > 0 && (
            <ul className="transferlist">
              {p.counterparties.map((c) => (
                <li key={c.slug ?? c.name}>
                  {c.slug ? (
                    <button type="button" className="linklike" onClick={() => onCompany(c.slug!)}>
                      {c.name}
                    </button>
                  ) : (
                    <span className="is-null">Supplier not established</span>
                  )}
                  <span className="transferlist-meta">
                    {c.rows} {plural(c.rows, 'row')}
                    {c.amountUsd > 0 ? ` · ${usd(c.amountUsd)} identified` : ' · no amount identified'}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {p.absorbedFrom.length > 0 && (
            <>
              <p className="section-lede">Savings claimed by others that land on this company:</p>
              <ul className="transferlist">
                {p.absorbedFrom.map((c) => (
                  <li key={c.slug}>
                    <button type="button" className="linklike" onClick={() => onCompany(c.slug)}>
                      {c.name}
                    </button>
                    <span className="transferlist-meta">
                      {c.rows} {plural(c.rows, 'row')}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* ── Every row ──────────────────────────────────────────── */}
      <section className="company-block" aria-labelledby="co-rows">
        <h3 id="co-rows">Every row for {p.name}</h3>
        <GapKey />
        <ul className="claimlist">
          {p.rows.map((r) => (
            <li className="claimrow" key={r.id}>
              <div className="claimrow-head">
                <span className="claimrow-date">{shortDate(r.claim_date)}</span>
                <span className="claimrow-kind">{kind(r.claim_kind).name}</span>
              </div>
              <button type="button" className="claimrow-headline" onClick={() => onClaim(r.ref)}>
                {r.headline}
              </button>
              {r.claim_kind === 'gain_claim' && (r.claimed_amount_usd ?? 0) > 0 ? (
                <GapBar
                  claimed={r.claimed_amount_usd ?? 0}
                  traced={r.traceable_to_pl_usd ?? 0}
                  max={rowMax}
                />
              ) : (
                <p className="claimrow-note is-null">{kind(r.claim_kind).meaning}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
