import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

import {
  pathD, plot, readPoint, listPrice,
  type PlotPoint, type PlotSeries, type PriceSeries,
} from '../lib/prices';

/* ===================================================================
   One panel of the price page: a set of series on shared axes.

   Three things this chart does that a chart library would have to be
   argued out of.

   **It only prints numbers that were published.** The y axis is ticked
   at the list prices themselves and the x axis at the publication
   dates, so there is no rounded axis label anywhere on it that no
   source ever stated.

   **It refuses to join two points across a repackaging.** A series
   carries runs rather than one list of points, and only a run of two or
   more is drawn as a line. That is why the Grammarly line stops in May
   2025 and the two 2026 tiers sit on their own: drawing through them
   would show a price cut, and the price was not cut.

   **Every point is a link to the publication it came from.** Not a
   tooltip and not a title attribute — an anchor, so it is reachable by
   keyboard, openable on a phone, and copyable. Hovering or focusing one
   also writes it out underneath, in flow, because a mark on a chart at
   390px is smaller than a fingertip.

   The draw-in is deterministic: every duration and delay is a constant
   or an index, and prefers-reduced-motion renders the finished chart
   with no animation at all.
   =================================================================== */

interface Props {
  id: string;
  heading: string;
  series: PriceSeries[];
  /** Draw the structural-break rule. Only the series that has one passes this. */
  showBreak?: boolean;
}

const DRAW = 1.1;
const STEP = 0.08;

export function PriceChart({ id, heading, series, showBreak = false }: Props) {
  const reduced = useReducedMotion() ?? false;
  const p = plot(series, showBreak);
  const [read, setRead] = useState<string | null>(null);

  const clear = () => setRead(null);
  const show = (s: PlotSeries, pt: PlotPoint) => () => setRead(readPoint(s, pt));

  return (
    <section className="pricepanel" aria-labelledby={`${id}-h`}>
      <h3 id={`${id}-h`} className="pricepanel-head">{heading}</h3>

      <p className="pricepanel-key">
        {p.series.map((s, i) => (
          <span key={s.key} className="pricekey" data-tone={i}>
            <span className="pricekey-mark" aria-hidden="true" />
            {s.name}
          </span>
        ))}
      </p>

      <div className="pricechart-frame">
        <svg
          className="pricechart"
          viewBox={`0 0 ${p.width} ${p.height}`}
          role="group"
          aria-label={`${heading}. Every point links to the publication that states the price.`}
        >
          {/* A gridline at every published price, and no gridline anywhere
              else, so the chart's own furniture states nothing that was
              not published. */}
          {p.yTicks.map((t) => (
            <line
              key={t.usd}
              className="pricechart-grid"
              x1={p.pad.l}
              y1={t.y}
              x2={p.width - p.pad.r}
              y2={t.y}
            />
          ))}

          {p.yLabels.map((t) => (
            <text
              key={t.usd}
              className="pricechart-y"
              x={p.pad.l - 10}
              y={t.y}
              dominantBaseline="middle"
              textAnchor="end"
            >
              {listPrice(t.usd)}
            </text>
          ))}

          <line
            className="pricechart-axis"
            x1={p.pad.l}
            y1={p.height - p.pad.b}
            x2={p.width - p.pad.r}
            y2={p.height - p.pad.b}
          />

          {/* First and last published date only. Every other date is on
              its own point and in the list underneath. */}
          {[p.xTicks[0], p.xTicks[p.xTicks.length - 1]].map((t, i) => (
            <text
              key={t.date}
              className="pricechart-x"
              x={t.x}
              y={p.height - p.pad.b + 24}
              textAnchor={i === 0 ? 'start' : 'end'}
            >
              {t.date}
            </text>
          ))}

          {p.break && (
            <g className="pricechart-break">
              <line x1={p.break.x} y1={p.pad.t} x2={p.break.x} y2={p.height - p.pad.b} />
              <a
                href={p.break.source}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${p.break.label}. Opens the source in a new tab.`}
                onMouseEnter={() => setRead(p.break!.label)}
                onFocus={() => setRead(p.break!.label)}
                onMouseLeave={clear}
                onBlur={clear}
              >
                {/* The rule sits late in the series, so the label is set
                    back towards the middle rather than off the frame. */}
                <text
                  x={p.break.x + (p.break.x > p.width / 2 ? -10 : 10)}
                  y={p.pad.t + 12}
                  textAnchor={p.break.x > p.width / 2 ? 'end' : 'start'}
                >
                  {p.break.label}
                </text>
              </a>
            </g>
          )}

          {p.series.map((s, si) => (
            <g key={s.key} className="pricechart-series" data-tone={si}>
              {s.paths.map((run, ri) => (
                <motion.path
                  key={ri}
                  className="pricechart-line"
                  d={pathD(run)}
                  initial={reduced ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: DRAW, delay: si * STEP, ease: 'easeInOut' }}
                />
              ))}

              {s.points.map((pt) => (
                <motion.g
                  key={`${pt.date}-${pt.usd}`}
                  initial={reduced ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25, delay: reduced ? 0 : DRAW + pt.index * STEP }}
                >
                  <a
                    href={pt.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${readPoint(s, pt)}. Opens the source in a new tab.`}
                    onMouseEnter={show(s, pt)}
                    onFocus={show(s, pt)}
                    onMouseLeave={clear}
                    onBlur={clear}
                  >
                    {/* A circle and a square, so two series on one panel
                        are told apart without reading the key. */}
                    {si === 0 ? (
                      <circle className="pricechart-dot" cx={pt.x} cy={pt.y} r={6} />
                    ) : (
                      <rect className="pricechart-dot" x={pt.x - 5} y={pt.y - 5} width={10} height={10} />
                    )}
                    <text className="pricechart-value" x={pt.x} y={pt.y - 13} textAnchor="middle">
                      {listPrice(pt.usd)}
                    </text>
                  </a>
                </motion.g>
              ))}
            </g>
          ))}
        </svg>
      </div>

      <p className="pricechart-readout" role="status">
        {read ?? 'Every point on this chart opens the publication that states the price.'}
      </p>

      <ol className="pricelist">
        {p.series.flatMap((s, si) =>
          s.points.map((pt) => (
            <li key={`${s.key}-${pt.date}-${pt.usd}`} className="priceitem" data-tone={si}>
              <span className="num priceitem-date">{pt.date}</span>
              <span className="num priceitem-price">{listPrice(pt.usd)}</span>
              <span className="priceitem-what">
                {s.name}
                {pt.tier ? ` (${pt.tier})` : ''}, {s.unit}
              </span>
              <a
                className="priceitem-source"
                href={pt.source}
                target="_blank"
                rel="noopener noreferrer"
              >
                Source, {pt.date}
              </a>
            </li>
          )),
        )}
        {p.break && (
          <li className="priceitem is-break">
            <span className="priceitem-what">{p.break.label}</span>
            <a
              className="priceitem-source"
              href={p.break.source}
              target="_blank"
              rel="noopener noreferrer"
            >
              Source
            </a>
          </li>
        )}
      </ol>
    </section>
  );
}
