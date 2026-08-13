import type { ReactNode } from 'react';
import type { LedgerRow } from '../lib/types';
import { BASIS_LABEL, KIND_LABEL } from '../lib/types';

export function Tag({
  children, kind, title,
}: { children: ReactNode; kind?: 't1' | 't2' | 't3' | 'alert' | 'solid'; title?: string }) {
  return <span className={'tag' + (kind ? ' ' + kind : '')} title={title}>{children}</span>;
}

const TIER_TITLE: Record<number, string> = {
  1: 'Tier 1: primary source — a filing, administrative data, or peer review',
  2: 'Tier 2: vendor- or self-originated',
  3: 'Tier 3: press or secondary reporting',
};

/** The row's epistemic status, at a glance and in a fixed order so the eye
 *  learns where to look. */
export function ClaimTags({ row }: { row: LedgerRow }) {
  return (
    <>
      <Tag
        kind={row.evidence_tier === 1 ? 't1' : row.evidence_tier === 2 ? 't2' : 't3'}
        title={TIER_TITLE[row.evidence_tier]}
      >
        T{row.evidence_tier}
      </Tag>
      <Tag title={`Measurement basis: ${BASIS_LABEL[row.measurement_basis]}`}>
        {BASIS_LABEL[row.measurement_basis]}
      </Tag>
      {row.claim_kind !== 'gain_claim' && (
        <Tag kind="solid" title="Not an assertion that AI produced a gain; excluded from the money totals">
          {KIND_LABEL[row.claim_kind]}
        </Tag>
      )}
      {row.conflict_of_interest && (
        <Tag kind="alert" title={row.coi_note ?? 'The source sells the thing this number validates'}>COI</Tag>
      )}
      {row.verification_status === 'needs_primary_source' && (
        <Tag kind="t3" title={row.verify_hint ?? 'No primary source yet'}>Unverified</Tag>
      )}
      {row.verification_status === 'disputed' && (
        <Tag kind="alert" title={row.verify_hint ?? 'Sources conflict'}>Disputed</Tag>
      )}
    </>
  );
}
