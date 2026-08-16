import { useReducedMotion } from 'motion/react';

import type { Dataset } from '../lib/types';
import type { ViewName } from '../lib/route';
import { barMax } from '../lib/aggregate';
import { shortDate, usd } from '../lib/format';
import { primeClaim, primeMissing } from '../lib/home';
import { COPY, destination, LANDING_COPY, NAV, verification } from '../lib/labels';
import { GapBar } from '../components/GapBar';

import BlurText from '../vendor/reactbits/BlurText';
import Waves from '../vendor/reactbits/Waves';

/* ===================================================================
   The landing page: the only surface a stranger sees before they know
   what any of this is.

   It has one job and one hand-off. The job is to state the question in
   the visitor's own terms and then answer it once, with a real row —
   IBM's $3.5B, the figure most people arriving here have already seen
   quoted somewhere. The hand-off is the ledger.

   The example is not written. It is looked up by reference and every
   figure in it is a field of that row, so the page cannot come to
   disagree with the ledger it is advertising.

   The ground is dark here and nowhere else. This page is a cover, not a
   reading surface: no row is coded on it and no figure is compared. The
   moment a reader crosses into the ledger they are back on paper.
   =================================================================== */

interface Props {
  data: Dataset | null;
  error: string | null;
  onGo: (view: ViewName) => void;
  onClaim: (ref: string) => void;
}

/** Fixed, so the field is the same picture on every load. */
const WAVE_SEED = 20260815;

export function HomeView({ data, error, onGo, onClaim }: Props) {
  const reduced = useReducedMotion() ?? false;
  const rows = data?.rows ?? [];
  const claim = primeClaim(rows);

  return (
    <div className="home">
      <div className="home-field" aria-hidden="true">
        <Waves
          seed={WAVE_SEED}
          paused={reduced}
          lineColor="rgba(237, 240, 243, 0.13)"
          backgroundColor="transparent"
          xGap={34}
          yGap={48}
          waveAmpX={18}
          waveAmpY={10}
        />
      </div>

      <div className="home-frame" aria-hidden="true" />

      <div className="home-inner">
        <header className="home-bar">
          <button type="button" className="home-mark" onClick={() => onGo('ledger')}>
            {COPY.title}
          </button>
          <nav className="home-nav" aria-label="Sections">
            {NAV.map((n) => (
              <button key={n.view} type="button" onClick={() => onGo(n.view)}>
                {n.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="home-main">
          <BlurText
            tag="h1"
            still={reduced}
            className="home-headline"
            text={LANDING_COPY.headline}
            animateBy="words"
            direction="top"
            delay={45}
            stepDuration={0.28}
          />

          <p className="home-standfirst">{LANDING_COPY.standfirst}</p>

          <section className="home-example" aria-labelledby="home-example-head">
            <h2 id="home-example-head" className="home-eyebrow">
              {LANDING_COPY.exampleHead}
            </h2>

            {error && <p className="home-example-empty">{error}</p>}

            {!error && data === null && (
              <p className="home-example-empty">Loading the row…</p>
            )}

            {!error && data !== null && claim === null && (
              <p className="home-example-empty">{primeMissing(rows)}</p>
            )}

            {claim && (
              <div className="home-card">
                <p className="home-card-meta">
                  <span className="home-card-co">{claim.company_name}</span>
                  <span className="num">{claim.period_label ?? shortDate(claim.claim_date)}</span>
                  <span>
                    {claim.source_name ?? 'Source not named'}, {shortDate(claim.source_date)}
                  </span>
                  <span>{verification(claim.verification_status).name}</span>
                </p>

                <p className="home-card-claim">{claim.headline}</p>

                <div className="home-card-figures">
                  <div className="home-card-fig">
                    <span className="home-card-fig-label">Claimed</span>
                    <span className="num home-card-fig-value">
                      {usd(claim.claimed_amount_usd)}
                    </span>
                  </div>
                  <div className="home-card-fig">
                    <span className="home-card-fig-label">{COPY.traced}</span>
                    <span className="num home-card-fig-value is-traced">
                      {usd(claim.traceable_to_pl_usd)}
                    </span>
                  </div>
                  <div className="home-card-fig">
                    <span className="home-card-fig-label">Where it landed</span>
                    <span className="home-card-fig-value">
                      {destination(claim.destination).name}
                    </span>
                  </div>
                </div>

                <GapBar
                  claimed={claim.claimed_amount_usd ?? 0}
                  traced={claim.traceable_to_pl_usd ?? 0}
                  max={barMax(rows)}
                  size="lg"
                  labels={false}
                />

                <p className="home-card-note">{COPY.untracedMeaning}</p>

                <button
                  type="button"
                  className="home-card-open"
                  onClick={() => onClaim(claim.ref)}
                >
                  {LANDING_COPY.openRow}
                </button>
              </div>
            )}
          </section>

          <p className="home-actions">
            <button type="button" className="home-cta" onClick={() => onGo('ledger')}>
              {LANDING_COPY.enter}
            </button>
            <button type="button" className="home-ghost" onClick={() => onGo('method')}>
              {LANDING_COPY.method}
            </button>
          </p>
        </main>
      </div>
    </div>
  );
}
