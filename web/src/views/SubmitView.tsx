import { useState } from 'react';
import { supabase } from '../lib/supabase';

/** Anyone can post a claim; only the maintainer can read the inbox. */
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
      setMessage('A company name and a one-line claim are both required.');
      return;
    }
    setState('sending');
    const { error } = await supabase.from('claim_submissions').insert({
      ...form,
      claim_date: form.claim_date || null,
    });
    if (error) {
      setState('error');
      setMessage(error.message);
      return;
    }
    setState('sent');
    setMessage('');
    setForm({ company_name: '', headline: '', claim_detail: '', source_url: '', claim_date: '', submitter: '' });
  }

  if (state === 'sent') {
    return (
      <div className="empty">
        <strong>Received.</strong>
        It goes into the inbox and gets coded by hand before it appears in the ledger.
        <div style={{ marginTop: 14 }}>
          <button type="button" className="btn" onClick={() => setState('idle')}>Add another</button>
        </div>
      </div>
    );
  }

  return (
    <div className="submit">
      <p className="note">
        Nothing posted here appears in the ledger automatically. Submissions are coded by hand —
        what the number is, where the gain landed, whose revenue line paid — because that coding is
        the whole point and a machine cannot do it yet.
      </p>

      <div className="form-field">
        <label htmlFor="co">Company</label>
        <input id="co" value={form.company_name} onChange={set('company_name')} placeholder="Who made the claim" />
      </div>
      <div className="form-field">
        <label htmlFor="hl">The claim, in one line</label>
        <input id="hl" value={form.headline} onChange={set('headline')} placeholder="What they said, as they said it" />
      </div>
      <div className="form-field">
        <label htmlFor="dt">More detail</label>
        <textarea id="dt" value={form.claim_detail} onChange={set('claim_detail')}
          placeholder="Paraphrase rather than quote at length." />
      </div>
      <div className="form-field">
        <label htmlFor="url">Source link</label>
        <input id="url" value={form.source_url} onChange={set('source_url')}
          placeholder="Only if you opened it yourself" />
      </div>
      <div className="form-field">
        <label htmlFor="dat">Date of the claim</label>
        <input id="dat" type="date" value={form.claim_date} onChange={set('claim_date')} />
      </div>
      <div className="form-field">
        <label htmlFor="sub">Your name or handle (optional)</label>
        <input id="sub" value={form.submitter} onChange={set('submitter')} />
      </div>

      {state === 'error' && <p className="form-error">{message}</p>}

      <button type="button" className="btn" onClick={submit} disabled={state === 'sending'}>
        {state === 'sending' ? 'Sending…' : 'Submit claim'}
      </button>
    </div>
  );
}
