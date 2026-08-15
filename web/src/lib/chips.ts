import type { MeasurementBasis } from './types';
import { basis, destination, group, CONDITIONS } from './labels';
import { toggle, type ConditionKey, type Filters } from './filters';

/* ===================================================================
   CHIPS

   One idea: every coded value the reader can see is also a way of
   asking "who else is like this". A destination on a company page, a
   basis in the ledger, a condition in the checklist — all the same
   object, all clickable, all landing in the same shared selection.

   The logic lives here rather than in the component so that "what does
   clicking this do" is a testable question. A chip is a pure function
   from the thing you clicked to the next selection.
   =================================================================== */

export type ChipTarget =
  | { kind: 'destination'; rank: number }
  | { kind: 'basis'; basis: MeasurementBasis }
  | { kind: 'condition'; key: ConditionKey }
  | { kind: 'conditionCount'; count: number }
  | { kind: 'sector'; sector: string }
  | { kind: 'group'; code: string }
  | { kind: 'company'; slug: string; name: string };

/** What the chip reads as. Always words, never a database code. */
export function chipLabel(t: ChipTarget): string {
  switch (t.kind) {
    case 'destination': return destination(t.rank).name;
    case 'basis': return basis(t.basis).name;
    case 'condition': return CONDITIONS[t.key].name;
    case 'conditionCount':
      return t.count === 3 ? 'All three met' : `${t.count} of three met`;
    case 'sector': return t.sector;
    case 'group': return group(t.code).name;
    case 'company': return t.name;
  }
}

/** The sentence a reader gets on hover, so nothing needs looking up. */
export function chipTitle(t: ChipTarget): string {
  switch (t.kind) {
    case 'destination': return destination(t.rank).meaning;
    case 'basis': return basis(t.basis).meaning;
    case 'condition': return CONDITIONS[t.key].question;
    case 'conditionCount':
      return t.count === 3
        ? 'Every one of the three conditions is met. This is the cohort that converts.'
        : `${t.count} of the three conditions are met.`;
    case 'sector': return `Everything in ${t.sector}.`;
    case 'group': return group(t.code).blurb;
    case 'company': return `Everything recorded for ${t.name}.`;
  }
}

/** Is this chip currently part of the selection? */
export function chipActive(t: ChipTarget, f: Filters): boolean {
  switch (t.kind) {
    case 'destination': return f.destinations.includes(t.rank);
    case 'basis': return f.bases.includes(t.basis);
    case 'condition': return f.conditionsMet.includes(t.key);
    case 'conditionCount': return f.conditionCounts.includes(t.count);
    case 'sector': return f.sectors.includes(t.sector);
    case 'group': return f.groups.includes(t.code);
    case 'company': return f.companies.includes(t.slug);
  }
}

/**
 * Clicking a chip toggles it.
 *
 * Toggle rather than replace, because the second click on the thing you
 * just clicked should undo it. Replacing would make the only way back a
 * trip to the filter bar.
 */
export function applyChip(t: ChipTarget, f: Filters): Filters {
  switch (t.kind) {
    case 'destination': return { ...f, destinations: toggle(f.destinations, t.rank) };
    case 'basis': return { ...f, bases: toggle(f.bases, t.basis) };
    case 'condition': return { ...f, conditionsMet: toggle(f.conditionsMet, t.key) };
    case 'conditionCount': return { ...f, conditionCounts: toggle(f.conditionCounts, t.count) };
    case 'sector': return { ...f, sectors: toggle(f.sectors, t.sector) };
    case 'group': return { ...f, groups: toggle(f.groups, t.code) };
    case 'company': return { ...f, companies: toggle(f.companies, t.slug) };
  }
}

/** The accent class, so a destination chip carries its own tone. */
export function chipTone(t: ChipTarget): string {
  if (t.kind === 'destination') return `tone-${destination(t.rank).tone}`;
  if (t.kind === 'conditionCount' && t.count === 3) return 'tone-margin';
  return '';
}
