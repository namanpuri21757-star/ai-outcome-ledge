import { useState } from 'react';
import { supabase } from '../lib/supabase';

/**
 * The "living record" inlet. Anyone can post a claim they have found; nobody
 * but the maintainer can read the inbox back. Promotion into the ledger stays
 * manual on purpose — the coding is the whole value, and an automatic
 * pipeline into `claims` would fill the table with untagged rows.
 */
export function SubmitView() {
  const [form, setForm] = useState({
    company_name: '', headline: '', claim_detail: '', source_url: '', claim_date: '', submitter: '',
  });
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit() {
    if (!form.company_name.trim() || !form.headline.trim()) {
      setState('error');
      setMessage('A company and a one-line claim are the minimum. Everything else can follow.');
      return;
    }
    setState('sending');
    const { error } = await supabase.from('claim_submissions').insert({
      ...form,
      claim_date: form.claim_date || null,
    });
    if (error) {
      setState('error');
      setMessage(`Could not save: ${error.message}`);
      return;
    }
    setState('sent');
    setMessage('Saved to the inbox. Read it with: select * from claim_submissions where not reviewed;');
    setForm({ company_name: '', headline: '', claim_detail: '', source_url: '', claim_date: '', submitter: '' });
  }

  return (
    <div style={{ maxWidth: 680 }}>
      <div className="form-field">
        <label htmlFor="co">Company</label>
        <input id="co" value={form.company_name} onChange={set('company_name')} placeholder="Who made the claim" />
      </div>
      <div className="form-field">
        <label htmlFor="hl">The claim, in one line</label>
        <input id="hl" value={form.headline} onChange={set('headline')} placeholder="e.g. Reports $120M saved in support operations" />
      </div>
      <div className="form-field">
        <label htmlFor="dt">What exactly was measured, if the source says</label>
        <textarea id="dt" value={form.claim_detail} onChange={set('claim_detail')}
                  placeholder="Hours freed? A cost line that moved? A deflection rate? This is the field that decides how the row gets coded." />
      </div>
      <div className="form-field">
        <label htmlFor="url">Source URL</label>
        <input id="url" value={form.source_url} onChange={set('source_url')} placeholder="https://" />
      </div>
      <div className="form-field">
        <label htmlFor="cd">Claim date</label>
        <input id="cd" type="date" value={form.claim_date} onChange={set('claim_date')} />
      </div>
      <div className="form-field">
        <label htmlFor="sb">Who is submitting (optional)</label>
        <input id="sb" value={form.submitter} onChange={set('submitter')} />
      </div>

      <button className="btn" onClick={submit} disabled={state === 'sending'}>
        {state === 'sending' ? 'Saving…' : 'Add to the inbox'}
      </button>

      {message && (
        <p className="note" style={{ marginTop: 12, color: state === 'error' ? 'var(--gap)' : 'var(--traced)' }}>
          {message}
        </p>
      )}

      <p className="note" style={{ marginTop: 24 }}>
        Submissions land in a separate table and never appear in the ledger until they are coded by
        hand. The coding — measurement basis, destination, counterparty, reconciliation — is the part
        that makes the row worth having, and it cannot be inferred from a headline.
      </p>
    </div>
  );
}
