import { useState, type CSSProperties } from 'react';
import { useReducedMotion } from 'motion/react';

import type { Dataset } from '../lib/types';
import type { ViewName } from '../lib/route';
import { blueprint, type Stage } from '../lib/cover';
import { pct, usd } from '../lib/format';
import { COPY, LANDING_COPY } from '../lib/labels';
import { CoverBar } from '../components/CoverBar';
import { Term } from '../components/Term';
import CountUp from '../vendor/reactbits/CountUp';
import BlurText from '../vendor/reactbits/BlurText';

/* ===================================================================
   The blueprint: what happens to a claimed dollar, drawn rather than
   described.

   A reader who has just met this project needs the argument before any
   row of it, and the argument is a path with four stages and one place
   it usually stops. So the page is a drawing of that path — stages as
   marks on a sheet, the movement between them as the thing you can
   click — with the prose underneath rather than in front.

   Every figure on the drawing comes from `blueprint()`, which reads the
   rows through `totals()`. Every definition comes from `define()` by way
   of <Term>, so a term explained here is explained in the same words as
   on the ledger. Nothing on this page is a new definition and nothing on
   it is a typed number.
   =================================================================== */

interface Props {
  data: Dataset | null;
  error: string | null;
  onGo: (view: ViewName) => void;
}

/* One formatter per shape of figure, defined once. A formatter built
   inside the render is a new function every time, and a counter that
   watches its formatter for changes repaints itself when it sees one. */
const asUsd = (n: number) => usd(n);
const asCount = (n: number) => String(Math.round(n));
const asPct = (n: number) => pct(n).replace('+', '');

/** Ruler marks down the left edge and across the top. Fixed, not random. */
const COLUMNS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const ROWS = ['A', 'B', 'C', 'D', 'E', 'F'];

function figureOf(stage: Stage, still: boolean) {
  if ('usd' in stage.value) {
    return (
      <CountUp
        to={stage.value.usd}
        duration={1.4}
        still={still}
        format={asUsd}
        className="num"
      />
    );
  }
  if ('count' in stage.value) {
    return (
      <CountUp
        to={stage.value.count}
        duration={1.2}
        still={still}
        format={asCount}
        className="num"
      />
    );
  }
  if (stage.value.pct === null) return <span className="num">no figure yet</span>;
  return (
    <CountUp
      to={stage.value.pct}
      duration={1.6}
      still={still}
      format={asPct}
      className="num"
    />
  );
}

export function ThesisView({ data, error, onGo }: Props) {
  const reduced = useReducedMotion() ?? false;
  const rows = data?.rows ?? [];
  const stages = rows.length ? blueprint(rows) : [];
  const [open, setOpen] = useState<string | null>(null);
  const selected = stages.find((s) => s.key === open) ?? null;

  return (
    <div className="cover thesis">
      <div className="cover-frame" aria-hidden="true" />

      <div className="cover-inner">
        <CoverBar onGo={onGo} />

        <main className="thesis-main">
          <p className="cover-eyebrow">Sheet 1 of 1 · the argument, before the evidence</p>

          <BlurText
            tag="h1"
            still={reduced}
            className="thesis-title"
            text="Where a claimed dollar actually goes"
            animateBy="words"
            direction="top"
            delay={55}
            stepDuration={0.28}
          />

          <div className="thesis-lede">
            <p>
              Companies are spending enormous sums on AI and saying, in public, that it is
              working. The figures are large, specific and quotable, and most of them are
              repeated without anybody checking what they were counting.
            </p>
            <p>
              For most of those claims the answer cannot be checked at all, because the
              number never reaches a financial statement. The distance between what was{' '}
              <Term kind="phrase" code="claimed">claimed</Term> and what is{' '}
              <Term kind="phrase" code="traceable">traceable</Term> is not a detail of this
              project. It is the project.
            </p>
            <p>
              So this is a record you can check yourself, one claim at a time: what was said,
              what was actually <Term kind="phrase" code="basis">measured</Term>, where the
              gain <Term kind="phrase" code="destination">landed</Term>, and whether a filing
              shows it. Take nobody's word for it, this project's included.
            </p>
          </div>

          {error && <p className="cover-empty">{error}</p>}
          {!error && data === null && <p className="cover-empty">Loading the corpus…</p>}

          {stages.length > 0 && (
            <>
              <section className="sheet" aria-labelledby="sheet-h">
                <h2 id="sheet-h" className="sr-only">
                  The four stages, with the corpus figure at each
                </h2>

                <div className="sheet-ruler sheet-ruler-top" aria-hidden="true">
                  {COLUMNS.map((c) => (
                    <span key={c}>{c}</span>
                  ))}
                </div>
                <div className="sheet-ruler sheet-ruler-side" aria-hidden="true">
                  {ROWS.map((r) => (
                    <span key={r}>{r}</span>
                  ))}
                </div>

                <ol className="sheet-stages">
                  {stages.map((stage, i) => (
                    <li key={stage.key} className="stage" style={{ '--i': i } as CSSProperties}>
                      <button
                        type="button"
                        className={'stage-node' + (open === stage.key ? ' is-open' : '')}
                        aria-expanded={open === stage.key}
                        aria-controls="sheet-readout"
                        onClick={() => setOpen((v) => (v === stage.key ? null : stage.key))}
                      >
                        <span className="stage-mark">{stage.mark}</span>
                        <span className="stage-title">{stage.title}</span>
                        <span className="stage-figure">{figureOf(stage, reduced)}</span>
                        <span className="stage-caption">{stage.caption}</span>
                      </button>

                      {i < stages.length - 1 && (
                        <span className="stage-arrow" aria-hidden="true">
                          <svg viewBox="0 0 120 24" preserveAspectRatio="none" focusable="false">
                            <line x1="0" y1="12" x2="106" y2="12" />
                            <polyline points="98,6 112,12 98,18" />
                          </svg>
                          <span className="stage-arrow-label">then</span>
                        </span>
                      )}
                    </li>
                  ))}
                </ol>

                <div className="sheet-readout" id="sheet-readout" role="region" aria-live="polite">
                  {selected ? (
                    <>
                      <p className="sheet-readout-mark">{selected.mark}</p>
                      <p className="sheet-readout-text">{selected.reads}</p>
                      <p className="sheet-readout-figure">
                        <span className="num">{figureOf(selected, true)}</span>
                        <span>{selected.caption}</span>
                      </p>
                    </>
                  ) : (
                    <p className="sheet-readout-text is-idle">
                      Every stage on this sheet is a control. Open one to read what it means
                      and what the corpus says at that point.
                    </p>
                  )}
                </div>
              </section>

              <p className="thesis-standing">{COPY.untracedMeaning}</p>
            </>
          )}

          <p className="cover-actions">
            <button type="button" className="cover-cta" onClick={() => onGo('directory')}>
              {LANDING_COPY.dive}
            </button>
          </p>
        </main>
      </div>
    </div>
  );
}
