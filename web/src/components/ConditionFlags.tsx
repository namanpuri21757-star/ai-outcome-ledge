import { CONDITION_LIST } from '../lib/labels';

export interface ConditionState {
  billing: boolean | null;
  sink: boolean | null;
  permission: boolean | null;
}

/**
 * The three conditions, always with their meaning attached. The old page
 * showed three bare words and expected the reader to know them; a reader
 * who has to ask what "demand sink" means has been failed by the label,
 * not by their own attention.
 */
export function ConditionFlags({ state, verbose }: { state: ConditionState; verbose?: boolean }) {
  const values: Record<string, boolean | null> = {
    billing: state.billing,
    sink: state.sink,
    permission: state.permission,
  };

  return (
    <div className={'cond-flags' + (verbose ? ' verbose' : '')}>
      {CONDITION_LIST.map((c) => {
        const v = values[c.key];
        const status = v === true ? 'on' : v === false ? 'off' : 'unknown';
        const explain = v === true ? c.passes : v === false ? c.fails : 'Not coded on these rows.';
        return (
          <div key={c.key} className={`cond-flag ${status}`} title={`${c.question} ${explain}`}>
            <span className="mark" aria-hidden="true">
              {v === true ? '✓' : v === false ? '✕' : '–'}
            </span>
            <span className="cond-name">{c.name}</span>
            {verbose && <span className="cond-why">{explain}</span>}
          </div>
        );
      })}
    </div>
  );
}
