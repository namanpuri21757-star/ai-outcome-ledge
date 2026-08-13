/** Display formatting. Pure and centralised, because a table where the
 *  numbers are formatted three slightly different ways reads as unfinished. */

export function usd(n: number | null | undefined, opts: { sign?: boolean } = {}): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const sign = opts.sign && n > 0 ? '+' : n < 0 ? '−' : '';
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${sign}$${trim(abs / 1e12)}T`;
  if (abs >= 1e9) return `${sign}$${trim(abs / 1e9)}B`;
  if (abs >= 1e6) return `${sign}$${trim(abs / 1e6)}M`;
  if (abs >= 1e3) return `${sign}$${trim(abs / 1e3)}K`;
  return `${sign}$${Math.round(abs)}`;
}

function trim(n: number): string {
  const s = n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2);
  return s.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
}

export function bps(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(Math.round(n))}bp`;
}

export function pct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : n < 0 ? '−' : '';
  return `${sign}${Math.abs(n).toFixed(digits)}%`;
}

/** Ratio (0.211) to a margin percentage string (21.1%). */
export function ratioAsPct(n: number | null | undefined, digits = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${(n * 100).toFixed(digits)}%`;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m] = iso.split('-');
  const mi = Number(m) - 1;
  if (!MONTHS[mi]) return iso;
  return `${MONTHS[mi]} ${y}`;
}

export function claimedValue(value: number | null, unit: string | null): string {
  if (value === null || value === undefined) return '—';
  switch (unit) {
    case 'usd': return usd(value >= 1000 ? value : value * 1e6);
    case 'pct': return `${value}%`;
    case 'bps': return bps(value);
    case 'fte': return `${value.toLocaleString()} FTE`;
    case 'hours': return `${value.toLocaleString()} hrs`;
    case 'time': return `${value} d`;
    default: return String(value);
  }
}

/** Sentence-safe truncation on a word boundary. */
export function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const space = cut.lastIndexOf(' ');
  return (space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd() + '…';
}
