import { useReducedMotion } from 'motion/react';

import type { ViewName } from '../lib/route';
import { PANELS, SOURCING_NOTE, TAKEAWAY } from '../lib/prices';
import { LANDING_COPY } from '../lib/labels';
import { CoverBar } from '../components/CoverBar';
import { PriceChart } from '../components/PriceChart';

import BlurText from '../vendor/reactbits/BlurText';

/* ===================================================================
   The price page: the same question as the ledger, asked from the
   market rather than from the company.

   The ledger takes one firm's claimed saving and looks for it in that
   firm's filings. This takes the other end of the same trade. If AI had
   made a service cheaper to produce, and if competition had pushed that
   saving through, it would show up in what the service costs to buy —
   and a list price is the one number a seller publishes and then has to
   stand behind.

   So the page shows two markets where AI is doing the work, over the
   decade AI arrived in them, and prints what the sellers were actually
   charging. It reaches no network and reads no row: the ten prices and
   the one break below are hardcoded in `lib/prices.ts`, each with the
   dated publication that states it.

   This is the one surface in the app that carries a written finding
   rather than an assembled one, and it can, because unlike the ledger
   its data cannot change underneath the sentence: the table and the
   sentence are in the same file and a test checks the sentence's two
   percentages against the table's prices on every run.
   =================================================================== */

interface Props {
  onGo: (view: ViewName) => void;
}

export function PricesView({ onGo }: Props) {
  const reduced = useReducedMotion() ?? false;

  return (
    <div className="cover prices">
      <div className="cover-frame" aria-hidden="true" />

      <div className="cover-inner">
        <CoverBar onGo={onGo} />

        <main className="prices-main">
          <p className="cover-eyebrow">
            <span className="cover-eyebrow-mark">02</span>
            The market, not the company
          </p>

          <BlurText
            tag="h1"
            still={reduced}
            className="prices-title"
            text="If AI made the work cheaper, the price should have fallen"
            animateBy="words"
            direction="top"
            delay={45}
            stepDuration={0.28}
          />

          <p className="prices-takeaway">{TAKEAWAY}</p>

          <p className="prices-sourcing">{SOURCING_NOTE}</p>

          <div className="prices-panels">
            {PANELS.map((panel) => (
              <PriceChart
                key={panel.key}
                id={panel.key}
                heading={panel.heading}
                series={panel.series}
                showBreak={panel.key === 'grammarly'}
              />
            ))}
          </div>

          <p className="cover-actions">
            <button type="button" className="cover-cta" onClick={() => onGo('ledger')}>
              {LANDING_COPY.dive}
            </button>
          </p>
        </main>
      </div>
    </div>
  );
}
