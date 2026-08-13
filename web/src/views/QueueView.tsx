import type { LedgerRow } from '../lib/types';
import { sourceLinks } from '../lib/sourceLinks';
import { shortDate, clip } from '../lib/format';
import { VERIFICATION } from '../lib/labels';

/**
 * The work queue. Every row whose next verification step is known but
 * not yet done, with the step written out and the search that starts it
 * one click away.
 */
export function QueueView({
  rows, onCompany,
}: { rows: LedgerRow[]; onCompany: (slug: string, context: string) => void }) {
  const queue = rows
    .filter((r) => r.verification_status === 'needs_primary_source' || r.verification_status === 'disputed')
    .sort((a, b) => (b.claimed_amount_usd ?? 0) - (a.claimed_amount_usd ?? 0));

  if (queue.length === 0) {
    return (
      <div className="empty">
        <strong>Nothing waiting in this selection.</strong>
        Every row here has been checked against a primary source.
      </div>
    );
  }

  return (
    <>
      <p className="note">
        {queue.length} row{queue.length === 1 ? '' : 's'} waiting, largest claim first. Each one names
        the exact next step, so this is a list of tasks rather than a list of doubts.
      </p>
      <div className="queue">
        {queue.map((r) => (
          <article key={r.id} className="queue-item">
            <header>
              <button type="button" className="linklike"
                onClick={() => onCompany(r.company_slug, 'verification queue')}>
                {r.company_name}
              </button>
              <span className="small is-null"> · {shortDate(r.claim_date)}</span>
              <span className={'tag ' + (r.verification_status === 'disputed' ? 'alert' : 't3')}>
                {VERIFICATION[r.verification_status].name}
              </span>
            </header>
            <p className="headline">{clip(r.headline, 140)}</p>
            {r.verify_hint && <p className="mono small">{r.verify_hint}</p>}
            <div className="links">
              {sourceLinks(r).map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noreferrer noopener">{l.label} →</a>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
