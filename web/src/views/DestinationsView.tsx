import type { LedgerRow } from '../lib/types';
import { DESTINATION_ORDER, destination } from '../lib/labels';
import { usd } from '../lib/format';
import { GapBar } from '../components/GapBar';

/**
 * Five columns, ordered left to right by how far the gain ended up from
 * profit. The ordering is the argument, so it is carried by position
 * rather than by a numeral printed in front of each heading.
 *
 * Clicking a company here now opens that company's page carrying the
 * destination in the breadcrumb, instead of dumping the reader into a
 * filtered table that has forgotten which column they came from.
 */
export function DestinationsView({
  rows, max, onCompany, onFilterDestination,
}: {
  rows: LedgerRow[];
  max: number;
  onCompany: (slug: string, context: string) => void;
  onFilterDestination: (rank: number) => void;
}) {
  const gains = rows.filter((r) => r.claim_kind === 'gain_claim');

  return (
    <>
      <div className="dest-grid">
        {DESTINATION_ORDER.map((rank) => {
          const d = destination(rank);
          const inCol = gains.filter((r) => r.destination === rank);
          const claimed = inCol.reduce((a, r) => a + (r.claimed_amount_usd ?? 0), 0);
          const traced = inCol.reduce((a, r) => a + (r.traceable_to_pl_usd ?? 0), 0);

          return (
            <section key={rank} className={`dest-col tone-${d.tone}`}>
              <header>
                <span className="n">
                  {rank === 0 ? 'Not coded' : `Step ${rank} of 5 · ${rank === 5 ? 'reaches profit' : 'short of profit'}`}
                </span>
                <h3>{d.name}</h3>
                <span className="amount">{claimed > 0 ? usd(claimed) : '—'}</span>
                <span className="n">
                  {inCol.length} claim{inCol.length === 1 ? '' : 's'}
                  {claimed > 0 && traced > 0 ? ` · ${usd(traced)} traceable` : ''}
                </span>
                {claimed > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <GapBar claimed={claimed} traced={traced} max={max} />
                  </div>
                )}
              </header>

              <p className="why">{d.meaning}</p>

              {inCol.length === 0 ? (
                <p className="small is-null">Nothing in this selection landed here.</p>
              ) : (
                <div className="dest-items">
                  {inCol.slice(0, 8).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      className="dest-item"
                      onClick={() => onCompany(r.company_slug, d.name.toLowerCase())}
                    >
                      <span className="co">{r.company_name}</span>
                      <span className="amt">
                        {r.claimed_amount_usd ? usd(r.claimed_amount_usd) : 'no dollar figure'}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {inCol.length > 0 && (
                <button type="button" className="linklike dest-more" onClick={() => onFilterDestination(rank)}>
                  Filter everything to this →
                </button>
              )}
            </section>
          );
        })}
      </div>

      <p className="note">
        Only the last column is profit. A gain can be entirely real and still stop in one of the
        first four — that is the finding, not a failure of measurement.
      </p>
    </>
  );
}
