import { useReducedMotion } from 'motion/react';

import type { Dataset } from '../lib/types';
import type { ViewName } from '../lib/route';
import { barMax } from '../lib/aggregate';
import { shortDate, usd } from '../lib/format';
import { primeClaim, primeMissing } from '../lib/home';
import { COPY, destination, LANDING_COPY, verification } from '../lib/labels';
import { CoverBar } from '../components/CoverBar';
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

   The ground is dark here, on the blueprint and on the directory, and
   nowhere else. These are covers, not reading surfaces: no row is coded
   on them and no figure is compared. The moment a reader crosses into
   the ledger they are back on paper.

   The example row is drawn on the same dark stock as the page rather
   than on a white card. The card was a piece of another product sitting
   on this one — its own surface, its own type, its own borders, related
   to nothing around it. What makes it a distinct block now is the same
   hairline rule the rest of the page is built from, and its own mark in
   the corner, the way a figure is marked on a drawing.
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
    <div className="cover home">
      <div className="cover-field" aria-hidden="true">
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

      <div className="cover-frame" aria-hidden="true" />

      <div className="cover-inner">
        <CoverBar onGo={onGo} />

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
            <h2 id="home-example-head" className="cover-eyebrow">
              <span className="cover-eyebrow-mark">01</span>
              {LANDING_COPY.exampleHead}
            </h2>

            {error && <p className="cover-empty">{error}</p>}

            {!error && data === null && <p className="cover-empty">Loading the row…</p>}

            {!error && data !== null && claim === null && (
              <p className="cover-empty">{primeMissing(rows)}</p>
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

                <p className="home-card-foot">
                  <button
                    type="button"
                    className="home-card-open"
                    onClick={() => onClaim(claim.ref)}
                  >
                    {LANDING_COPY.openRow}
                  </button>
                </p>
              </div>
            )}
          </section>

          {/* Two ways in, and they are different questions. The first
              hands off to the blueprint and the ledger — one company's
              claim, checked against that company's filings. The second
              asks the same thing of a market: if the work got cheaper,
              did the price. Neither replaces the other. */}
          <p className="cover-actions">
            <button type="button" className="cover-cta" onClick={() => onGo('thesis')}>
              {LANDING_COPY.enter}
            </button>
            <button type="button" className="cover-cta is-secondary" onClick={() => onGo('prices')}>
              {LANDING_COPY.prices}
            </button>
          </p>
        </main>
      </div>
    </div>
  );
}
