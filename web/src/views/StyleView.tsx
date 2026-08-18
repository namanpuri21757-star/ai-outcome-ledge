import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import {
  AXIS_TICKS, CLASSIFICATION_LABEL, CLASSIFICATION_NOTE, COST_LINE, NICHES, RAMP,
  STATUS_LABEL, STATUS_TONE, TIERS, bands, emptied, logPos, readSweep, survives,
  tierMark, weakest,
  type Niche, type Tier, type Tiered,
} from '../lib/style';

/* ===================================================================
   THE STYLE PROOF — one static page, built to be judged.

   It reads nothing. No Supabase, no corpus row, no collector, no
   props: every figure on it is written into `lib/style.ts` beside the
   sentence that describes it. That is deliberate and it is the only
   condition under which a page in this app is allowed to state a fact
   about data in typed prose — the same exemption the price page has,
   and for the same reason. If this page is ever wired to a query, the
   sentences have to become assembled ones.

   ── What it is proving ────────────────────────────────────────────

   The old product derived its readings from filed accounts. This one
   argues a conviction from evidence of uneven quality, and the design's
   single job is to make that downgrade impossible to miss without the
   page reading as an apology. So the epistemics are structural rather
   than written: a figure is a `Tiered` value or it cannot be rendered,
   every tickmark is defined in a legend on the page, and the filter at
   the end is allowed to gut the table in place.

   ── The one moment ────────────────────────────────────────────────

   The lead schedule's rows arrive on a spring, 24ms apart, once. Every
   other thing on the page is static, and under `prefers-reduced-motion`
   the rows are simply there — which is the same page, not a broken one,
   because nothing is animated that carries meaning.
   =================================================================== */

const SWEEP = { w: 640, h: 360, l: 92, r: 24, t: 20, b: 56 };
const PLOT_TOP = SWEEP.t;
const PLOT_BOTTOM = SWEEP.h - SWEEP.b;
const PLOT_LEFT = SWEEP.l;
const PLOT_RIGHT = SWEEP.w - SWEEP.r;
const PLOT_H = PLOT_BOTTOM - PLOT_TOP;
const PLOT_W = PLOT_RIGHT - PLOT_LEFT;

/** Cost on the log axis, in SVG user units. */
const y = (value: number): number => PLOT_TOP + (1 - logPos(value) / 100) * PLOT_H;

const COL_W = PLOT_W / NICHES.length;
const cx = (i: number): number => PLOT_LEFT + COL_W * (i + 0.5);
const BAR_W = 92;

/** 24ms a row: enough to read as a sequence, too short to wait for. */
const ROW_STEP = 0.024;

function TierChip({ tier }: { tier: Tier }) {
  const t = tierMark(tier);
  return (
    <span className="tick" data-tier={tier}>
      <span className="tick-mark" aria-hidden="true">{t.mark}</span>
      <span className="tick-label">{t.label}</span>
    </span>
  );
}

/** A figure and the tier it was learned at. There is no other way to draw one. */
function Figure({ figure }: { figure: Tiered }) {
  return (
    <span className="figure">
      <span className={figure.unresolved ? 'figure-value is-unresolved' : 'figure-value num'}>
        {figure.value}
      </span>
      <TierChip tier={figure.tier} />
      <span className="figure-source">{figure.source}</span>
      {figure.formula && (
        <span className="figure-formula">
          <span className="figure-formula-label">How it was derived</span>
          {figure.formula}
        </span>
      )}
    </span>
  );
}

/** The cell a struck figure leaves behind. Same box, nothing in it. */
function Struck({ figure }: { figure: Tiered }) {
  return (
    <span className="struck">
      <span className="struck-box" aria-hidden="true" />
      <span className="struck-why">
        Withheld at this tier. It was <strong>{tierMark(figure.tier).label.toLowerCase()}</strong>.
      </span>
    </span>
  );
}

function StatusCell({ niche }: { niche: Niche }) {
  return (
    <span className="status" data-tone={STATUS_TONE[niche.status]}>
      <span className="status-name">{STATUS_LABEL[niche.status]}</span>
      <span className="status-since num">Set {niche.statusChanged}</span>
    </span>
  );
}

export function StyleView() {
  const reduced = useReducedMotion() ?? false;
  const [floor, setFloor] = useState<Tier>('observed');

  const cut = emptied(NICHES, floor);
  const sweep = bands(NICHES);

  return (
    <div className="proof">
      <header className="proof-head">
        <p className="proof-index">
          <span className="proof-index-ref num">S-1</span>
          <span>Style proof</span>
          <span className="proof-index-state">Prepared, not reviewed</span>
        </p>

        <h2>The threshold ledger, drawn before it is built</h2>

        <p className="proof-lede">
          This page is the design in one screen: the type, the marks, one populated lead
          schedule, one frame of the sweep, and what is left when the reader asks to see only
          what can be checked. Nothing on it is fetched. Every figure is written into the
          source beside the sentence that describes it, so the page can be judged on its own
          terms and then promoted or thrown away.
        </p>

        <dl className="proof-block">
          <div>
            <dt>Prepared by</dt>
            <dd>Machine, from the seed record</dd>
          </div>
          <div>
            <dt>Reviewed by</dt>
            <dd className="is-open">Not yet reviewed</dd>
          </div>
          <div>
            <dt>Basis</dt>
            <dd>Argued conviction, assembled evidence</dd>
          </div>
          <div>
            <dt>Period</dt>
            <dd className="num">2026-02 to 2026-08</dd>
          </div>
        </dl>

        <p className="proof-warning">
          Nothing on this page is derived from a filed financial statement. The old ledger
          reconciled claims to disclosed accounts; this one does not, and no mark on this page
          should be read as though it did.
        </p>
      </header>

      {/* 1 ─────────────────────────────────────────────────────────── */}
      <section className="proof-section" aria-labelledby="s-type">
        <p className="proof-mark num">S-1.1</p>
        <h3 id="s-type">The type scale</h3>
        <p className="proof-note">
          IBM Plex Sans Condensed for structure, Serif for anything argued rather than
          measured, Mono for every figure. Each rung is a token, never a typed pixel value,
          and every numeral on this page is set in tabular figures so a column of them lines
          up and a changing one does not reflow the sentence around it.
        </p>

        <ul className="ramp">
          {RAMP.map((rung) => (
            <li className="ramp-row" key={rung.token}>
              <span className="ramp-meta">
                <span className="ramp-token num">{rung.token}</span>
                <span className="ramp-size num">{rung.size}</span>
                <span className="ramp-use">{rung.use}</span>
              </span>
              <span
                className={`ramp-specimen is-${rung.family}`}
                style={{ fontSize: `var(${rung.token})` }}
              >
                {rung.family === 'mono' ? '$1–10 · 22.9 · 56.1' : 'Cost fell through the floor'}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* 2 ─────────────────────────────────────────────────────────── */}
      <section className="proof-section" aria-labelledby="s-ticks">
        <p className="proof-mark num">S-1.2</p>
        <h3 id="s-ticks">The evidence tickmarks</h3>
        <p className="proof-note">
          A tickmark in a workpaper is a promise about an action the preparer took, which is
          why these are marks with a stated meaning rather than coloured pills. They carry no
          colour at all. A figure cannot be drawn on this page without one.
        </p>

        <ul className="ticklist">
          {TIERS.map((t) => (
            <li className="tickrow" key={t.tier}>
              <span className="tickrow-mark" aria-hidden="true">{t.mark}</span>
              <span className="tickrow-body">
                <span className="tickrow-label">{t.label}</span>
                <span className="tickrow-meaning">{t.meaning}</span>
              </span>
            </li>
          ))}
        </ul>

        <p className="proof-note proof-note-tight">
          Shown in place, as they appear against a figure:
        </p>
        <p className="tickdemo">
          {TIERS.map((t) => (
            <TierChip key={t.tier} tier={t.tier} />
          ))}
        </p>
      </section>

      {/* 3 ─────────────────────────────────────────────────────────── */}
      <section className="proof-section" aria-labelledby="s-schedule">
        <p className="proof-mark num">S-1.3</p>
        <h3 id="s-schedule">Lead schedule: three niches</h3>
        <p className="proof-note">
          One row per niche, cross-referenced to the evidence that supports it. The
          classification column separates the two claims that must never be merged: thin
          content inside a well-served language is a different argument from a language that
          is itself under-served.
        </p>

        <div className="sched-frame">
          <table className="sched">
            <caption className="sr-only">
              Three niche records with cost, willingness to pay, status and the weakest tier
              each row rests on.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="sched-ref">Ref</th>
                <th scope="col">Niche</th>
                <th scope="col">Classification</th>
                <th scope="col">Cost per finished minute</th>
                <th scope="col">Willingness to pay</th>
                <th scope="col">Status</th>
                <th scope="col">Rests on</th>
              </tr>
            </thead>
            <tbody>
              {NICHES.map((n, i) => (
                <motion.tr
                  key={n.ref}
                  initial={reduced ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { type: 'spring', stiffness: 240, damping: 28, delay: i * ROW_STEP }
                  }
                >
                  <th scope="row" className="sched-ref num">{n.ref}</th>
                  <td>
                    <span className="sched-name">{n.name}</span>
                    <span className="sched-note">{n.note}</span>
                  </td>
                  <td>
                    <span className="sched-class">{CLASSIFICATION_LABEL[n.classification]}</span>
                    <span className="sched-note">{CLASSIFICATION_NOTE[n.classification]}</span>
                  </td>
                  <td><Figure figure={n.cost} /></td>
                  <td><Figure figure={n.wtp} /></td>
                  <td>
                    <StatusCell niche={n} />
                    <span className="sched-note">{n.statusReason}</span>
                  </td>
                  <td><TierChip tier={weakest(n)} /></td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4>Supporting evidence, by reference</h4>
        <ul className="evlist">
          {NICHES.flatMap((n) =>
            n.evidence.map((e) => (
              <li className="evrow" key={e.ref}>
                <span className="evrow-ref num">{e.ref}</span>
                <span className="evrow-body">
                  <span className="evrow-text">{e.text}</span>
                  <span className="evrow-foot">
                    <TierChip tier={e.tier} />
                    <span className="evrow-source">{e.source}</span>
                  </span>
                </span>
              </li>
            )),
          )}
        </ul>
      </section>

      {/* 4 ─────────────────────────────────────────────────────────── */}
      <section className="proof-section" aria-labelledby="s-sweep">
        <p className="proof-mark num">S-1.4</p>
        <h3 id="s-sweep">The threshold sweep, one frame</h3>
        <p className="proof-note">
          Cost per finished minute on a log axis, because the record spans two orders of
          magnitude. Each niche is its willingness-to-pay band, drawn as an interval because
          the estimate is a range and a point would claim a precision nobody has. The rule
          across the page is what production costs today. Where the rule sits below a band,
          the threshold is crossed; where it sits inside one, the honest reading is contested.
          A band is filled solid only where somebody observed it; below that tier it keeps
          the accent but is drawn as a hatch, so the least certain thing on the drawing is
          not also the most emphatic.
        </p>

        <div className="sweep-frame">
          <svg
            className="sweep"
            viewBox={`0 0 ${SWEEP.w} ${SWEEP.h}`}
            role="img"
            aria-label="Cost axis from one to two hundred dollars per finished minute, with one willingness-to-pay band drawn and two absent."
          >
            <defs>
              <pattern
                id="sweep-absent"
                width="8"
                height="8"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="8" className="sweep-hatch" />
              </pattern>
              {/* A band nobody observed is drawn as a hatch, not a solid.
                  The most uncertain object on the page must not also be
                  the most confident-looking one, and this is the same
                  45° mark the ledger already uses for a figure that has
                  not been tied out. */}
              <pattern
                id="sweep-band-crossed"
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="7" height="7" className="sweep-band-ground" />
                <line x1="0" y1="0" x2="0" y2="7" className="sweep-stripe-crossed" />
              </pattern>
              <pattern
                id="sweep-band-against"
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <rect width="7" height="7" className="sweep-band-ground" />
                <line x1="0" y1="0" x2="0" y2="7" className="sweep-stripe-against" />
              </pattern>
            </defs>

            {AXIS_TICKS.map((t) => (
              <g key={t}>
                <line
                  x1={PLOT_LEFT}
                  y1={y(t)}
                  x2={PLOT_RIGHT}
                  y2={y(t)}
                  className="sweep-grid"
                />
                <text x={PLOT_LEFT - 12} y={y(t) + 4} className="sweep-axis" textAnchor="end">
                  {`$${t}`}
                </text>
              </g>
            ))}

            <line
              x1={PLOT_LEFT}
              y1={PLOT_TOP}
              x2={PLOT_LEFT}
              y2={PLOT_BOTTOM}
              className="sweep-spine"
            />

            {/* Today's production cost: a zone, then the rule at its conservative edge. */}
            <rect
              x={PLOT_LEFT}
              y={y(COST_LINE.high)}
              width={PLOT_W}
              height={y(COST_LINE.low) - y(COST_LINE.high)}
              className="sweep-cost-zone"
            />
            <line
              x1={PLOT_LEFT}
              y1={y(COST_LINE.high)}
              x2={PLOT_RIGHT}
              y2={y(COST_LINE.high)}
              className="sweep-cost-line"
            />
            {/* Left-anchored: the only reliably empty region on the
                drawing is between the rule and the one band above it,
                and a label that crosses a hatched column is unreadable. */}
            <text x={PLOT_LEFT + 8} y={y(COST_LINE.high) - 10} className="sweep-cost-label">
              Production cost today, $1–10
            </text>

            {sweep.map((b, i) => {
              const reading = readSweep(b, COST_LINE.high);
              const tone = reading ? STATUS_TONE[reading] : 'ink';
              return (
                <g key={b.ref}>
                  {b.low !== null && b.high !== null ? (
                    <rect
                      x={cx(i) - BAR_W / 2}
                      y={y(b.high)}
                      width={BAR_W}
                      height={y(b.low) - y(b.high)}
                      className="sweep-band"
                      data-tone={tone}
                      data-tier={b.tier}
                    />
                  ) : (
                    <rect
                      x={cx(i) - BAR_W / 2}
                      y={PLOT_TOP}
                      width={BAR_W}
                      height={PLOT_H}
                      className="sweep-absent"
                      fill="url(#sweep-absent)"
                    />
                  )}

                  <text x={cx(i)} y={PLOT_BOTTOM + 22} className="sweep-ref" textAnchor="middle">
                    {b.ref}
                  </text>
                  <text x={cx(i)} y={PLOT_BOTTOM + 40} className="sweep-read" textAnchor="middle">
                    {reading ? STATUS_LABEL[reading] : 'No band'}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <ul className="sweeplist">
          {sweep.map((b) => {
            const reading = readSweep(b, COST_LINE.high);
            return (
              <li className="sweeprow" key={b.ref}>
                <span className="sweeprow-ref num">{b.ref}</span>
                <span className="sweeprow-body">
                  {b.low !== null && b.high !== null ? (
                    <span>
                      Band <span className="num">${b.low}</span> to{' '}
                      <span className="num">${b.high}</span>. The rule at{' '}
                      <span className="num">${COST_LINE.high}</span> sits below it, so the
                      reading is <strong>{reading ? STATUS_LABEL[reading].toLowerCase() : 'unread'}</strong>.
                    </span>
                  ) : (
                    <span>
                      No band is drawn: {b.absence?.toLowerCase()}. A rectangle here would look
                      like an answer, so the column is left hatched and the sweep says nothing
                      about this niche.
                    </span>
                  )}
                  <TierChip tier={b.tier} />
                </span>
              </li>
            );
          })}
        </ul>

        <p className="proof-aside">
          Two of the three niches cannot be drawn. That is the frame working: the sweep can
          only place a niche whose willingness to pay somebody has estimated, and for the case
          the thesis most needs, nobody has.
        </p>
      </section>

      {/* 5 ─────────────────────────────────────────────────────────── */}
      <section className="proof-section" aria-labelledby="s-empty">
        <p className="proof-mark num">S-1.5</p>
        <h3 id="s-empty">Filtered to what can be checked</h3>
        <p className="proof-note">
          The tier filter is allowed to gut this page, and the emptied cells stay where they
          were rather than closing up. A table that reflowed into a tidy short list would hide
          the size of the hole.
        </p>

        <div className="seg proof-seg" role="group" aria-label="Evidence tier floor">
          <button
            type="button"
            aria-pressed={floor === 'asserted'}
            onClick={() => setFloor('asserted')}
          >
            Every tier
          </button>
          <button
            type="button"
            aria-pressed={floor === 'observed'}
            onClick={() => setFloor('observed')}
          >
            Observed only
          </button>
        </div>

        <p className="proof-count">
          At this setting <span className="num">{cut.figuresLost}</span> of{' '}
          <span className="num">{NICHES.length * 2}</span> figures are withheld,{' '}
          <span className="num">{cut.gutted}</span> of{' '}
          <span className="num">{NICHES.length}</span> rows keep no figure at all, and{' '}
          <span className="num">{cut.evidenceKept}</span> of{' '}
          <span className="num">{cut.evidenceKept + cut.evidenceLost}</span> pieces of evidence
          still stand.
        </p>

        <div className="sched-frame">
          <table className="sched is-filtered">
            <caption className="sr-only">
              The same three records with every figure below the chosen tier withheld.
            </caption>
            <thead>
              <tr>
                <th scope="col" className="sched-ref">Ref</th>
                <th scope="col">Niche</th>
                <th scope="col">Cost per finished minute</th>
                <th scope="col">Willingness to pay</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {NICHES.map((n) => {
                const costOk = survives(n.cost.tier, floor);
                const wtpOk = survives(n.wtp.tier, floor);
                const anyOk = costOk || wtpOk;
                return (
                  <tr key={n.ref} className={anyOk ? undefined : 'is-gutted'}>
                    <th scope="row" className="sched-ref num">{n.ref}</th>
                    <td><span className="sched-name">{n.name}</span></td>
                    <td>{costOk ? <Figure figure={n.cost} /> : <Struck figure={n.cost} />}</td>
                    <td>{wtpOk ? <Figure figure={n.wtp} /> : <Struck figure={n.wtp} />}</td>
                    <td>
                      {anyOk ? (
                        <StatusCell niche={n} />
                      ) : (
                        <span className="struck">
                          <span className="struck-box" aria-hidden="true" />
                          <span className="struck-why">
                            No status. It was read off figures that are all withheld here.
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <h4>What still stands</h4>
        <ul className="evlist">
          {NICHES.flatMap((n) =>
            n.evidence.filter((e) => survives(e.tier, floor)).map((e) => (
              <li className="evrow" key={e.ref}>
                <span className="evrow-ref num">{e.ref}</span>
                <span className="evrow-body">
                  <span className="evrow-text">{e.text}</span>
                  <span className="evrow-foot">
                    <TierChip tier={e.tier} />
                    <span className="evrow-source">{e.source}</span>
                  </span>
                </span>
              </li>
            )),
          )}
        </ul>

        {floor === 'observed' && (
          <p className="proof-aside is-hard">
            Every price on this page is gone, both sides of the comparison, in all three rows.
            What survives is a product launch and a benchmark gap, and the benchmark gap is
            evidence against the thesis rather than for it. The argument may still be right;
            this is what it currently rests on.
          </p>
        )}
      </section>
    </div>
  );
}
