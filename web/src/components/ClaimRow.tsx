import type { LedgerRow } from '../lib/types';
import { basis, destination, kind } from '../lib/labels';
import { claimedValue, shortDate, usd } from '../lib/format';
import { GapBar } from './GapBar';

/* ===================================================================
   One row of the ledger, as a block rather than a table row.

   A table needs a header to be readable, and below about 700px the
   header goes away and every cell becomes an unlabelled fragment. The
   previous build handled that by stacking cells with `attr(data-label)`
   pseudo-elements — which works, but leaves the reconciliation as an
   unlabelled hatched bar in a cell either way.

   This is the same information as a small piece of typeset text with
   the reconciliation written out in words, so it reads identically at
   1440px and at 390px and never needs a legend hunt.
   =================================================================== */

interface Props {
  row: LedgerRow;
  max: number;
  onOpen: (ref: string) => void;
  onCompany: (slug: string) => void;
}

export function ClaimRow({ row, max, onOpen, onCompany }: Props) {
  const d = destination(row.destination);
  const b = basis(row.measurement_basis);
  const isGain = row.claim_kind === 'gain_claim';
  const claimed = row.claimed_amount_usd ?? 0;

  return (
    <li className="claimrow">
      <div className="claimrow-head">
        <button type="button" className="claimrow-company" onClick={() => onCompany(row.company_slug)}>
          {row.company_name}
        </button>
        <span className="claimrow-date">{shortDate(row.claim_date)}</span>
        {!isGain && <span className="claimrow-kind">{kind(row.claim_kind).name}</span>}
      </div>

      <button type="button" className="claimrow-headline" onClick={() => onOpen(row.ref)}>
        {row.headline}
      </button>

      <div className="claimrow-coding">
        <span className="claimrow-figure">
          {claimed > 0
            ? usd(claimed)
            : row.claimed_value !== null
              ? claimedValue(row.claimed_value, row.claimed_unit)
              : 'No figure'}
        </span>
        <span className="claimrow-sep" aria-hidden="true">·</span>
        <span className="claimrow-basis">{b.name}</span>
        {isGain && (
          <>
            <span className="claimrow-sep" aria-hidden="true">·</span>
            <span className={'claimrow-dest tone-text-' + d.tone}>{d.name}</span>
          </>
        )}
      </div>

      {isGain && claimed > 0 ? (
        <GapBar claimed={claimed} traced={row.traceable_to_pl_usd ?? 0} max={max} />
      ) : isGain ? (
        <p className="claimrow-note is-null">
          Stated in {row.claimed_unit ?? 'units other than dollars'}, so it does not enter the
          reconciliation.
          {(row.traceable_to_pl_usd ?? 0) > 0 &&
            ` ${usd(row.traceable_to_pl_usd)} is nonetheless traceable to a filing line.`}
        </p>
      ) : (
        <p className="claimrow-note is-null">{kind(row.claim_kind).meaning}</p>
      )}
    </li>
  );
}

/* ------------------------------------------------------------------ */

export interface CompanySummaryRow {
  slug: string;
  name: string;
  groupName: string;
  rows: number;
  gainClaims: number;
  claimedUsd: number;
  tracedUsd: number;
  dominant: number | null;
}

export function CompanyRow({
  entry, max, onCompany,
}: {
  entry: CompanySummaryRow;
  max: number;
  onCompany: (slug: string) => void;
}) {
  const d = entry.dominant === null ? null : destination(entry.dominant);
  return (
    <li className="companyrow">
      <div className="companyrow-head">
        <button type="button" className="companyrow-name" onClick={() => onCompany(entry.slug)}>
          {entry.name}
        </button>
        <span className="companyrow-group">{entry.groupName}</span>
      </div>

      <div className="companyrow-coding">
        <span>
          {entry.rows} {entry.rows === 1 ? 'row' : 'rows'}
        </span>
        <span className="claimrow-sep" aria-hidden="true">·</span>
        <span>
          {entry.gainClaims} gain {entry.gainClaims === 1 ? 'claim' : 'claims'}
        </span>
        {d && (
          <>
            <span className="claimrow-sep" aria-hidden="true">·</span>
            <span className={'tone-text-' + d.tone}>mostly {d.verb}</span>
          </>
        )}
      </div>

      {entry.claimedUsd > 0 ? (
        <GapBar claimed={entry.claimedUsd} traced={entry.tracedUsd} max={max} />
      ) : (
        <p className="claimrow-note is-null">
          No claim by this {entry.groupName === 'Research' ? 'source' : 'company'} states a figure in
          dollars.
        </p>
      )}
    </li>
  );
}
