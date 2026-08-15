import type { CompanyProfile } from './companies';
import { destination, group, DESTINATION_ORDER } from './labels';

/** One ordering for the ladder, shared with the flow diagram. */
const DEST_ORDER_INDEX = new Map(DESTINATION_ORDER.map((rank, i) => [rank, i]));

/* ===================================================================
   THE PATTERN GRID

   The ledger could always tell you about one company. It could not
   tell you that six companies are stuck for the same structural
   reason, because you could only ever see one of them at a time.

   This groups the whole roster on one screen so the repetition
   becomes visible. Everything here is derived from the profiles, and
   every bucket carries its members rather than just a count, so a
   heading can say what it contains rather than asserting a total.
   =================================================================== */

export type GroupMode = 'destination' | 'conditions' | 'sector' | 'none';
export type SortMode = 'claimed' | 'untraced' | 'margin' | 'name';

export interface PatternGroup {
  key: string;
  /** Heading, in words. */
  label: string;
  /** One line saying what this bucket means. */
  meaning: string | null;
  members: CompanyProfile[];
  claimedUsd: number;
  untracedUsd: number;
  /** Sort position of the bucket itself. */
  order: number;
  /** True for the bucket that holds everything not yet coded. */
  unknown?: boolean;
}

/**
 * A company's margin readings, oldest first, for the sparkline.
 *
 * Rows with no measured movement are dropped rather than zeroed: the
 * sparkline draws what was measured, and a gap in measurement is not a
 * flat quarter.
 */
export function marginSeries(p: CompanyProfile): number[] {
  return p.rows
    .filter((r) => r.margin_delta_4q_bps !== null && r.margin_delta_4q_bps !== undefined)
    .sort((a, b) => a.claim_date.localeCompare(b.claim_date))
    .map((r) => r.margin_delta_4q_bps as number);
}

const SORTERS: Record<SortMode, (a: CompanyProfile, b: CompanyProfile) => number> = {
  claimed: (a, b) => b.claimedUsd - a.claimedUsd || a.name.localeCompare(b.name),
  untraced: (a, b) => b.untracedUsd - a.untracedUsd || a.name.localeCompare(b.name),
  name: (a, b) => a.name.localeCompare(b.name),
  // Nulls last in both directions: an unmeasured margin is not the
  // smallest one and must never lead the grid.
  margin: (a, b) => {
    const av = a.marginDelta4qBps;
    const bv = b.marginDelta4qBps;
    if (av === null && bv === null) return a.name.localeCompare(b.name);
    if (av === null) return 1;
    if (bv === null) return -1;
    return bv - av;
  },
};

export function sortProfiles(profiles: CompanyProfile[], mode: SortMode): CompanyProfile[] {
  return [...profiles].sort(SORTERS[mode]);
}

export function groupProfiles(
  profiles: CompanyProfile[],
  mode: GroupMode,
  sort: SortMode = 'claimed',
): PatternGroup[] {
  if (mode === 'none') {
    return [make('all', 'Every company', null, sortProfiles(profiles, sort), 0)];
  }

  const buckets = new Map<string, { label: string; meaning: string | null; order: number; unknown?: boolean; members: CompanyProfile[] }>();

  for (const p of profiles) {
    let key: string;
    let label: string;
    let meaning: string | null;
    let order: number;
    let unknown = false;

    if (mode === 'destination') {
      const rank = p.dominantDestination;
      if (rank === null) {
        key = 'dest:none';
        label = 'No coded destination';
        meaning = 'Either the source never said where the gain went, or this company has no gain claim carrying one.';
        order = 99;
        unknown = true;
      } else {
        const d = destination(rank);
        key = `dest:${rank}`;
        label = d.name;
        meaning = d.meaning;
        // The ladder's own order, not a second one invented here. The
        // flow diagram reads top-to-bottom in DESTINATION_ORDER, and a
        // grid that ran the other way would teach the reader that
        // position means nothing.
        order = DEST_ORDER_INDEX.get(rank) ?? 98;
      }
    } else if (mode === 'conditions') {
      const n = p.conditionsPassed;
      if (n === null) {
        key = 'cond:none';
        label = 'Conditions not fully coded';
        meaning = 'At least one of the three is unrecorded for this company, so it has no count. An uncoded condition is not a failed one.';
        order = 99;
        unknown = true;
      } else {
        key = `cond:${n}`;
        label = n === 3 ? 'All three conditions met' : `${n} of three conditions met`;
        meaning =
          n === 3
            ? 'The billing unit survives, the freed capacity has somewhere to go, and there is permission to act. This is the cohort that reaches margin.'
            : n === 0
              ? 'None of the three holds. A gain here has nowhere to become profit.'
              : `${n} of the three hold. The missing one is where the gain stops.`;
        order = 3 - n;
      }
    } else {
      const sector = p.sector;
      if (!sector) {
        key = 'sector:none';
        label = 'No sector recorded';
        meaning = null;
        order = 99;
        unknown = true;
      } else {
        key = `sector:${sector}`;
        label = sector;
        meaning = null;
        order = 50;
      }
    }

    const cur = buckets.get(key) ?? { label, meaning, order, unknown, members: [] };
    cur.members.push(p);
    buckets.set(key, cur);
  }

  return [...buckets.entries()]
    .map(([key, b]) => make(key, b.label, b.meaning, sortProfiles(b.members, sort), b.order, b.unknown))
    .sort((a, b) => a.order - b.order || b.members.length - a.members.length || a.label.localeCompare(b.label));
}

function make(
  key: string,
  label: string,
  meaning: string | null,
  members: CompanyProfile[],
  order: number,
  unknown?: boolean,
): PatternGroup {
  return {
    key,
    label,
    meaning,
    members,
    order,
    unknown,
    claimedUsd: members.reduce((a, p) => a + p.claimedUsd, 0),
    untracedUsd: members.reduce((a, p) => a + p.untracedUsd, 0),
  };
}

/**
 * The other companies that share this one's structural position.
 *
 * Same dominant destination or same condition count — the two axes the
 * grid groups on, so hovering a card lights up exactly the cohort the
 * headings describe. A company with neither coded has no cohort, which
 * is stated rather than papered over with an empty list.
 */
export function relatedSlugs(target: CompanyProfile, all: CompanyProfile[]): Set<string> {
  const out = new Set<string>();
  for (const p of all) {
    if (p.slug === target.slug) continue;
    const sameDest =
      target.dominantDestination !== null && p.dominantDestination === target.dominantDestination;
    const sameCount =
      target.conditionsPassed !== null && p.conditionsPassed === target.conditionsPassed;
    if (sameDest || sameCount) out.add(p.slug);
  }
  return out;
}

/**
 * Why two companies belong to the same cohort, in words.
 *
 * The grid highlights on hover; this is what the highlight means, so
 * the reader is never left guessing which axis lit the other cards.
 */
export function relationReason(target: CompanyProfile, other: CompanyProfile): string | null {
  const reasons: string[] = [];
  if (target.dominantDestination !== null && other.dominantDestination === target.dominantDestination) {
    reasons.push(destination(target.dominantDestination).verb);
  }
  if (target.conditionsPassed !== null && other.conditionsPassed === target.conditionsPassed) {
    reasons.push(
      target.conditionsPassed === 3
        ? 'meets all three conditions'
        : `meets ${target.conditionsPassed} of three conditions`,
    );
  }
  return reasons.length ? reasons.join(', ') : null;
}

export const GROUP_MODES: Array<{ mode: GroupMode; label: string }> = [
  { mode: 'destination', label: 'Where gains landed' },
  { mode: 'conditions', label: 'Conditions met' },
  { mode: 'sector', label: 'Sector' },
  { mode: 'none', label: 'Ungrouped' },
];

export const SORT_MODES: Array<{ mode: SortMode; label: string }> = [
  { mode: 'claimed', label: 'Claimed' },
  { mode: 'untraced', label: 'Not traceable' },
  { mode: 'margin', label: 'Margin move' },
  { mode: 'name', label: 'Name' },
];

/** Group label for a company, used by the comparison tray. */
export function groupNameFor(p: CompanyProfile): string {
  return group(p.groupCode).name;
}
