import { useId, useState } from 'react';
import { define, type DefinitionKind } from '../lib/labels';

/* ===================================================================
   The one way a coded term is explained.

   Every destination name, measurement basis, verification status,
   evidence tier, epistemic tag, condition and company type in the
   interface renders through this component, and the words come from
   `define()` in labels.ts. There is no second copy of any definition.

   ── Why it is not a tooltip ───────────────────────────────────────

   The previous build leaned on native `title` attributes for about
   thirty definitions. Those are invisible on touch, unreachable by
   keyboard, uncopyable, and slow; and the one real overlay it did have —
   the chart readout — sat on top of the plot area and covered the
   figures a reader was about to read.

   So this expands *in flow*. It pushes the content below it down rather
   than covering anything, which means it can never hide the row it is
   explaining. It is a real `<button>`, so Tab reaches it and Enter opens
   it, and Escape closes it.
   =================================================================== */

interface Props {
  kind: DefinitionKind;
  code: string | number;
  /** Overrides the label from labels.ts — for a heading that reads differently. */
  children?: React.ReactNode;
  /** `inline` sits in a sentence; `block` is a standalone heading. */
  as?: 'inline' | 'block';
}

export function Term({ kind, code, children, as = 'inline' }: Props) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const def = define(kind, code);

  // A term with no definition must still render its own text rather
  // than disappearing — a missing definition is a bug in labels.ts, not
  // a reason to lose the word on screen.
  if (!def) return <>{children ?? String(code)}</>;

  return (
    <span className={'term term-' + as}>
      <button
        type="button"
        className="term-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      >
        {children ?? def.label}
        <span className="term-mark" aria-hidden="true">
          {open ? '−' : '?'}
        </span>
        <span className="sr-only">{open ? ' — hide definition' : ' — what does this mean?'}</span>
      </button>

      {open && (
        <span className="term-body" id={id} role="note">
          <span className="term-body-label">{def.label}</span>
          <span className="term-body-text">{def.body}</span>
          {def.extra?.map((line) => (
            <span className="term-body-extra" key={line}>
              {line}
            </span>
          ))}
        </span>
      )}
    </span>
  );
}

/**
 * A whole vocabulary opened at once, for a column heading that governs a
 * set of coded values rather than a single one — so a dense table needs
 * one control per column instead of one per cell.
 */
export function TermSet({
  heading,
  kind,
  codes,
}: {
  heading: string;
  kind: DefinitionKind;
  codes: Array<string | number>;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const defs = codes.map((c) => define(kind, c)).filter((d): d is NonNullable<typeof d> => !!d);
  if (defs.length === 0) return <>{heading}</>;

  return (
    <span className="term term-block">
      <button
        type="button"
        className="term-trigger"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
      >
        {heading}
        <span className="term-mark" aria-hidden="true">{open ? '−' : '?'}</span>
        <span className="sr-only">
          {open ? ' — hide these definitions' : ` — define all ${defs.length} values`}
        </span>
      </button>

      {open && (
        <span className="term-body" id={id} role="note">
          {defs.map((d) => (
            <span className="term-body-row" key={d.label}>
              <span className="term-body-label">{d.label}</span>
              <span className="term-body-text">{d.body}</span>
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
