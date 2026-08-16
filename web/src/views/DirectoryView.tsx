import { motion, useReducedMotion } from 'motion/react';

import type { Dataset } from '../lib/types';
import type { ViewName } from '../lib/route';
import { plural } from '../lib/aggregate';
import { directoryBarMax, directoryCards } from '../lib/cover';
import { claimedValue, usd } from '../lib/format';
import { destination, group, kind, LANDING_COPY } from '../lib/labels';
import { CoverBar } from '../components/CoverBar';
import { GapBar } from '../components/GapBar';

/* ===================================================================
   The directory: one card per company the ledger actually codes.

   Every card is a real company with real rows. There is no placeholder
   card, no "coming soon", and no company invented to square off the
   grid — a short grid is a true statement about how much has been coded,
   and padding it would be the first lie on the site.

   The card reuses what a ledger row already uses: the headline, the
   claimed figure, and the gap bar on the shared scale, so the same
   quantity looks the same here as it does in the ledger. A company with
   no dollar figure keeps its card and says so.
   =================================================================== */

interface Props {
  data: Dataset | null;
  error: string | null;
  onGo: (view: ViewName) => void;
  onCompany: (slug: string) => void;
}

/* Fixed per-card step, and a ceiling on it. Index times a constant is
   the same on every load; the ceiling stops the 40th card arriving two
   seconds after the first. */
const STEP = 0.022;
const LAST_ENTRANCE = 0.55;

export function DirectoryView({ data, error, onGo, onCompany }: Props) {
  const reduced = useReducedMotion() ?? false;
  const rows = data?.rows ?? [];
  const cards = rows.length ? directoryCards(rows) : [];
  const max = directoryBarMax(cards);

  return (
    <div className="cover directory">
      <div className="cover-frame" aria-hidden="true" />

      <div className="cover-inner">
        <CoverBar onGo={onGo} />

        <main className="directory-main">
          <p className="cover-eyebrow">The record</p>
          <h1 className="directory-title">{LANDING_COPY.directoryHead}</h1>
          {cards.length > 0 && (
            <p className="directory-count">
              <span className="num">{cards.length}</span> coded so far, largest claim first.
              Every card is a company with rows in the ledger; nothing here is a placeholder.
            </p>
          )}

          {error && <p className="cover-empty">{error}</p>}
          {!error && data === null && <p className="cover-empty">Loading the record…</p>}
          {!error && data !== null && cards.length === 0 && (
            <p className="cover-empty">No company in the loaded rows has been coded yet.</p>
          )}

          <ul className="grid">
            {cards.map(({ profile, lead }, i) => {
              const d =
                profile.dominantDestination === null
                  ? null
                  : destination(profile.dominantDestination);
              const claimed = profile.totals.claimedUsd;

              return (
                <motion.li
                  key={profile.slug}
                  className="gridcard"
                  initial={reduced ? false : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.32,
                    delay: reduced ? 0 : Math.min(i * STEP, LAST_ENTRANCE),
                    ease: [0.2, 0.6, 0.35, 1],
                  }}
                >
                  <div className="gridcard-head">
                    <button
                      type="button"
                      className="gridcard-name"
                      onClick={() => onCompany(profile.slug)}
                    >
                      {profile.name}
                    </button>
                    <span className="gridcard-group">{group(profile.groupCode).name}</span>
                  </div>

                  <div className="gridcard-body">
                    <p className="gridcard-figure">
                      <span className="num">
                        {claimed > 0
                          ? usd(claimed)
                          : lead && lead.claimed_value !== null
                            ? claimedValue(lead.claimed_value, lead.claimed_unit)
                            : 'No figure stated'}
                      </span>
                      {/* The figure is a company total when the company
                          claims dollars, and one row's figure when it does
                          not — so the label says which, and what kind of
                          row that figure came off. */}
                      <span className="gridcard-figure-label">
                        {claimed > 0
                          ? `claimed across ${profile.totals.dollarClaims} ${plural(profile.totals.dollarClaims, 'claim')}`
                          : lead
                            ? kind(lead.claim_kind).name
                            : 'nothing coded yet'}
                      </span>
                    </p>

                    {lead ? (
                      <p className="gridcard-claim">{lead.headline}</p>
                    ) : (
                      <p className="gridcard-claim is-null">
                        This company appears in the ledger without a claim of its own.
                      </p>
                    )}

                    {claimed > 0 ? (
                      <GapBar claimed={claimed} traced={profile.totals.tracedUsd} max={max} />
                    ) : (
                      <p className="gridcard-null">
                        No claim by this company states a figure in dollars, so nothing here
                        enters the reconciliation.
                      </p>
                    )}
                  </div>

                  <div className="gridcard-foot">
                    <span className={'gridcard-dest' + (d ? ' tone-text-' + d.tone : '')}>
                      {d ? d.name : 'No destination coded'}
                    </span>
                    <button
                      type="button"
                      className="gridcard-open"
                      onClick={() => onCompany(profile.slug)}
                    >
                      {LANDING_COPY.cardOpen}
                    </button>
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </main>
      </div>
    </div>
  );
}
