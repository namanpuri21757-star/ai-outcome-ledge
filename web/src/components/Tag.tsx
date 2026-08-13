import type { ReactNode } from 'react';
import type { LedgerRow } from '../lib/types';
import { basis, KINDS, TIERS, VERIFICATION } from '../lib/labels';

export function Tag({
  children, kind, title,
}: { children: ReactNode; kind?: 't1' | 't2' | 't3' | 'alert' | 'solid'; title?: string }) {
  return <span className={'tag' + (kind ? ' ' + kind : '')} title={title}>{children}</span>;
}

/**
 * A row's standing, at a glance, in a fixed order so the eye learns where
 * to look. Every tag reads as words rather than as a code, and every one
 * carries its definition in the tooltip so nothing needs looking up
 * elsewhere.
 */
export function ClaimTags({ row }: { row: LedgerRow }) {
  const b = basis(row.measurement_basis);
  return (
    <>
      <Tag
        kind={row.evidence_tier === 1 ? 't1' : row.evidence_tier === 2 ? 't2' : 't3'}
        title={TIERS[row.evidence_tier]}
      >
        {row.evidence_tier === 1 ? 'Primary' : row.evidence_tier === 2 ? 'Self-reported' : 'Press'}
      </Tag>
      <Tag title={b.meaning}>{b.name}</Tag>
      {row.claim_kind !== 'gain_claim' && (
        <Tag kind="solid" title={KINDS[row.claim_kind].meaning}>{KINDS[row.claim_kind].name}</Tag>
      )}
      {row.conflict_of_interest && (
        <Tag kind="alert" title={row.coi_note ?? 'The source sells the thing this number validates.'}>
          Sells the thing
        </Tag>
      )}
      {row.verification_status === 'needs_primary_source' && (
        <Tag kind="t3" title={row.verify_hint ?? VERIFICATION.needs_primary_source.meaning}>
          Needs checking
        </Tag>
      )}
      {row.verification_status === 'disputed' && (
        <Tag kind="alert" title={row.verify_hint ?? VERIFICATION.disputed.meaning}>Disputed</Tag>
      )}
    </>
  );
}
