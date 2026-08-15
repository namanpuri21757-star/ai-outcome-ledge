import { useEffect, useState } from 'react';
import type { Dataset, FetchRun } from '../lib/types';
import { latestByJob, runState, warnings } from '../lib/health';
import { loadRuns, supabase } from '../lib/supabase';
import { useFixtures } from '../lib/devData';
import { plural } from '../lib/aggregate';
import { sourceLinks } from '../lib/sourceLinks';
import { verification } from '../lib/labels';

/* ===================================================================
   The one maintenance surface.

   Everything operational lives here and nowhere else: what the collector
   did, what is standing and expected, what needs a primary source, and
   the inbox for a new claim. A reader of the ledger never has to see any
   of it, because none of it changes how a claim should be read — the one
   thing that does, how current the filing figures are, is stated on the
   ledger in the ledger's own words.
   =================================================================== */

interface Props {
  data: Dataset;
  onClaim: (ref: string) => void;
}

export function MaintenanceView({ data, onClaim }: Props) {
  const [runs, setRuns] = useState<FetchRun[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  useEffect(() => {
    if (useFixtures) {
      setRuns([]);
      return;
    }
    let alive = true;
    loadRuns()
      .then((r) => alive && setRuns(r))
      .catch((e) => alive && setRunError(String(e?.message ?? e)));
    return () => {
      alive = false;
    };
  }, []);

  const queue = data.rows.filter(
    (r) => r.verification_status === 'needs_primary_source' || r.verification_status === 'disputed',
  );

  return (
    <article className="doc">
      <header className="doc-head">
        <h2>Maintenance</h2>
        <p className="section-lede">
          Half of this ledger is hand-coded and half is machine-maintained. This page is the
          machine-maintained half reporting on itself, plus the work queue for the other half.
        </p>
      </header>

      <section aria-labelledby="mt-runs">
        <h3 id="mt-runs">The collector</h3>
        {runError && <p className="claim-flag">Could not read the run log: {runError}</p>}
        {runs === null && !runError && <p className="is-null">Reading the run log…</p>}
        {runs !== null && runs.length === 0 && (
          <p className="is-null">
            No collector run is on record. Either the pipeline has never run, or this is a fixture
            build with no database behind it.
          </p>
        )}

        {runs !== null && runs.length > 0 && (
          <>
            <ul className="runlist">
              {latestByJob(runs).map((r) => {
                const s = runState(r);
                return (
                  <li key={r.id} className={'runlist-item is-' + s.tone}>
                    <div className="runlist-head">
                      <span className="runlist-job">{r.job}</span>
                      <span className={'runlist-state is-' + s.tone}>{s.label}</span>
                    </div>
                    <p className="runlist-when">
                      Started {r.started_at.replace('T', ' ').slice(0, 19)} ·{' '}
                      {r.finished_at
                        ? `wrote ${r.rows_written.toLocaleString()} ${plural(
                            r.rows_written,
                            'row',
                          )} across ${r.companies_attempted} ${
                            r.companies_attempted === 1 ? 'company' : 'companies'
                          }`
                        : 'never recorded a finish, which means the invocation was killed part-way through'}
                    </p>
                    {r.notes && <p className="runlist-notes">{r.notes}</p>}
                  </li>
                );
              })}
            </ul>
            <Warnings runs={runs} />
          </>
        )}
      </section>

      <section aria-labelledby="mt-queue">
        <h3 id="mt-queue">Rows waiting on a primary source</h3>
        {queue.length === 0 ? (
          <p className="is-null">
            Every row in the ledger has been checked against a primary or secondary source. Nothing
            is waiting.
          </p>
        ) : (
          <>
            <p className="section-lede">
              {queue.length} {plural(queue.length, 'row')} of {data.rows.length}. Each carries the
              exact next step, written when the row was coded.
            </p>
            <ul className="queue">
              {queue.map((r) => (
                <li key={r.id}>
                  <button type="button" className="queue-headline" onClick={() => onClaim(r.ref)}>
                    {r.headline}
                  </button>
                  <p className="queue-meta">
                    {r.company_name} · {r.claim_date} · {verification(r.verification_status).name}
                  </p>
                  {r.verify_hint && <p className="queue-hint">{r.verify_hint}</p>}
                  {sourceLinks(r).length > 0 && (
                    <p className="claim-lookups">
                      <span>Look it up:</span>
                      {sourceLinks(r).map((l) => (
                        <a key={l.href} href={l.href} target="_blank" rel="noreferrer noopener">
                          {l.label}
                        </a>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <Submit />
    </article>
  );
}

function Warnings({ runs }: { runs: FetchRun[] }) {
  const { problems, expected } = warnings(runs);

  return (
    <>
      <h4>
        {problems.length === 0
          ? 'No problems on record'
          : `${problems.length} ${plural(problems.length, 'problem')} on record`}
      </h4>
      {problems.length === 0 ? (
        <p className="is-null">
          Across the last {runs.length} {plural(runs.length, 'run')}, nothing failed that was not
          expected to.
        </p>
      ) : (
        <ul className="warnlist">
          {problems.map((w) => (
            <li key={w.scope + w.message}>
              <span className="warnlist-scope">{w.scope}</span>
              <span className="warnlist-message">{w.message}</span>
              <span className="warnlist-meta">
                seen in {w.occurrences} {plural(w.occurrences, 'run')}, most recently{' '}
                {w.lastSeen.slice(0, 10)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {expected.length > 0 && (
        <>
          <h4>Standing, and not a fault</h4>
          <p className="section-lede">
            Permanent facts about a company rather than failures. They are recorded so a gap never
            becomes invisible, and they do not make a run unhealthy.
          </p>
          <ul className="warnlist is-expected">
            {expected.map((w) => (
              <li key={w.scope + w.message}>
                <span className="warnlist-scope">{w.scope}</span>
                <span className="warnlist-message">{w.message}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Submit() {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const company_name = String(form.get('company_name') ?? '').trim();
    const headline = String(form.get('headline') ?? '').trim();
    if (!company_name || !headline) {
      setState('error');
      setMessage('A company and a headline are the two things a submission cannot do without.');
      return;
    }

    setState('sending');
    const { error } = await supabase.from('claim_submissions').insert({
      company_name,
      headline,
      claim_detail: String(form.get('claim_detail') ?? '').trim() || null,
      source_url: String(form.get('source_url') ?? '').trim() || null,
      claim_date: String(form.get('claim_date') ?? '').trim() || null,
      submitter: String(form.get('submitter') ?? '').trim() || null,
    });

    if (error) {
      setState('error');
      setMessage(error.message);
      return;
    }
    setState('done');
    setMessage('');
    e.currentTarget.reset();
  }

  return (
    <section aria-labelledby="mt-submit">
      <h3 id="mt-submit">Add a claim</h3>
      <p className="section-lede">
        Submissions go to an inbox, not to the ledger. Nothing appears in the record until it has
        been read, coded by hand against a source, and given a destination.
      </p>

      {state === 'done' ? (
        <p className="form-done">
          Filed. It will appear in the ledger only once it has been coded.{' '}
          <button type="button" className="linklike" onClick={() => setState('idle')}>
            Add another
          </button>
        </p>
      ) : (
        <form className="submit" onSubmit={onSubmit}>
          <label className="form-field">
            <span>Company *</span>
            <input name="company_name" required />
          </label>
          <label className="form-field">
            <span>The claim, in one line *</span>
            <input name="headline" required />
          </label>
          <label className="form-field">
            <span>Any detail worth keeping</span>
            <textarea name="claim_detail" rows={3} />
          </label>
          <label className="form-field">
            <span>Source URL</span>
            <input name="source_url" type="url" placeholder="https://" />
          </label>
          <label className="form-field">
            <span>Date of the claim</span>
            <input name="claim_date" type="date" />
          </label>
          <label className="form-field">
            <span>Your name or handle, if you want it recorded</span>
            <input name="submitter" />
          </label>

          {state === 'error' && <p className="form-error">{message}</p>}

          <button type="submit" className="btn" disabled={state === 'sending'}>
            {state === 'sending' ? 'Filing…' : 'File it'}
          </button>
        </form>
      )}
    </section>
  );
}
