import type { LedgerRow } from './types';

/* ===================================================================
   The landing page's one example.

   A stranger who has just read the headline needs one row, not a
   summary: a real company, the number it said out loud, and what
   happened when that number was looked for in a filing. IBM's $3.5B is
   the clearest instance in the corpus — the company states the figure
   openly, states what it measured, and states that the capacity was
   redeployed rather than removed.

   Nothing here is typed out. The row is looked up by its reference and
   every figure on the page is a field of it, so if the coding of that
   row changes, the landing page changes with it.
   =================================================================== */

export const PRIME_REF = 'ibm-productivity-3-5b-2024';

export function primeClaim(rows: LedgerRow[]): LedgerRow | null {
  return rows.find((r) => r.ref === PRIME_REF) ?? null;
}

/**
 * Why the example is not on screen, in the shape the rest of the app
 * uses: name the thing that is missing and the set it was looked for in,
 * so a reader can tell a broken lookup from an empty database.
 */
export function primeMissing(rows: LedgerRow[]): string {
  return rows.length === 0
    ? 'No rows have loaded yet, so the example below is not on screen.'
    : `The row ${PRIME_REF} is not among the ${rows.length} loaded, so the example below is not on screen.`;
}
