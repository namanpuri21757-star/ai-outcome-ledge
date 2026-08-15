import { describe, expect, it, vi, afterEach } from 'vitest';
import { StooqError, isChallengePage, parseStooqCsv, probeStooq, stooqUrl } from '../src/stooq';

/**
 * The response Stooq actually served on 2026-08-15, captured verbatim
 * apart from a shortened challenge string. Kept as a fixture because the
 * bug it stands for was invisible in unit tests: it arrives as HTTP 200
 * with a body that is neither an error nor data.
 */
const CHALLENGE = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"></head><body><noscript>This site requires JavaScript to verify your browser. Please enable JavaScript and reload.</noscript><script nonce="ZhV2WSt1ZSayylUdP9yjTQ">
(async()=>{const c="AAAAAGp_r5zVRhzIV8dbQ2mVwMGrpSXiL6Ybkr6",d=4,t="0".repeat(d),e=new TextEncoder;let n=0;while(1){const h=await crypto.subtle.digest("SHA-256",e.encode(c+n)),x=Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,"0")).join("");if(x.startsWith(t))break;n++}const r=await fetch("/__verify",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:"c="+encodeURIComponent(c)+"&n="+n,credentials:"same-origin"});if(r.ok)location.reload()})();
</script></body></html>`;

const csv = `Date,Open,High,Low,Close,Volume
2025-01-02,100.0,101.5,99.5,101.0,1000
2025-01-03,101.0,102.0,100.5,100.25,1200
2025-01-06,100.25,100.9,99.0,99.5,900`;

describe('stooqUrl', () => {
  it('builds the daily CSV endpoint', () => {
    expect(stooqUrl('ibm.us')).toBe('https://stooq.com/q/d/l/?s=ibm.us&i=d');
  });
  it('encodes symbols containing a caret, as indices do', () => {
    expect(stooqUrl('^spx')).toContain('s=%5Espx');
  });
});

describe('parseStooqCsv', () => {
  it('parses date and close and sorts ascending', () => {
    const rows = parseStooqCsv(csv, '2020-01-01');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ date: '2025-01-02', close: 101 });
    expect(rows[2].close).toBe(99.5);
  });

  it('applies the since cutoff', () => {
    expect(parseStooqCsv(csv, '2025-01-03')).toHaveLength(2);
  });

  it('skips N/D markers rather than turning them into zeros', () => {
    const withGap = `Date,Open,High,Low,Close,Volume
2025-01-02,100,101,99,N/D,0
2025-01-03,100,101,99,100.5,10`;
    const rows = parseStooqCsv(withGap, '2020-01-01');
    expect(rows).toHaveLength(1);
    expect(rows[0].close).toBe(100.5);
  });

  it('tolerates a different column order', () => {
    const reordered = `Date,Close,Open
2025-01-02,55.5,50`;
    expect(parseStooqCsv(reordered, '2020-01-01')[0].close).toBe(55.5);
  });

  // The failure modes below are the reason this parser exists at all: every
  // one of them returns HTTP 200 and would otherwise be stored as "no data".
  it('raises on an HTML error page', () => {
    expect(() => parseStooqCsv('<html><body>404</body></html>')).toThrow(StooqError);
  });

  it('raises on the daily hit limit message', () => {
    expect(() => parseStooqCsv('Exceeded the daily hits limit')).toThrow(/hit limit/i);
  });

  it('raises on an empty body', () => {
    expect(() => parseStooqCsv('   ')).toThrow(StooqError);
  });

  it('raises on a header-only response', () => {
    expect(() => parseStooqCsv('Date,Open,High,Low,Close,Volume')).toThrow(/no usable rows/);
  });

  it('raises when the window filters everything out', () => {
    expect(() => parseStooqCsv(csv, '2030-01-01')).toThrow(/no usable rows/);
  });

  it('raises when the Close column is missing', () => {
    expect(() => parseStooqCsv('Date,Open,High,Low,Volume\n2025-01-02,1,2,3,4')).toThrow(/missing a Date or Close/);
  });
});

// ---------------------------------------------------------------------------
// The browser-verification wall
//
// These are the tests that would have named the cause on day one instead
// of pointing at twenty correct ticker symbols.
// ---------------------------------------------------------------------------
describe('the browser-verification interstitial', () => {
  it('recognises the page Stooq actually serves', () => {
    expect(isChallengePage(CHALLENGE)).toBe(true);
  });

  it('does not mistake real CSV for a challenge', () => {
    expect(isChallengePage(csv)).toBe(false);
  });

  it('recognises it from the verify endpoint alone, if the copy changes', () => {
    expect(isChallengePage('<html><body><script>fetch("/__verify")</script></body></html>')).toBe(true);
  });

  it('recognises it from the hashing loop alone, if the endpoint moves', () => {
    expect(isChallengePage('<html><script>crypto.subtle.digest("SHA-256",x)</script></html>')).toBe(true);
  });

  it('classifies it as a challenge, not as a wrong symbol', () => {
    // The whole defect in one assertion: this response used to be
    // reported as "the symbol is probably wrong" for IBM.
    expect(() => parseStooqCsv(CHALLENGE)).toThrow(StooqError);
    try {
      parseStooqCsv(CHALLENGE);
    } catch (err) {
      expect((err as StooqError).kind).toBe('challenge');
      expect((err as StooqError).message).not.toMatch(/symbol is probably wrong/);
      expect((err as StooqError).message).toMatch(/every symbol, not this one/);
    }
  });

  it('is source-level, so the caller stops instead of asking again', () => {
    try {
      parseStooqCsv(CHALLENGE);
    } catch (err) {
      expect((err as StooqError).isSourceLevel).toBe(true);
    }
  });
});

describe('failure classification', () => {
  const kindOf = (body: string): string => {
    try {
      parseStooqCsv(body, '2020-01-01');
      return 'ok';
    } catch (err) {
      return (err as StooqError).kind;
    }
  };

  it('separates the source failing from the symbol being wrong', () => {
    expect(kindOf(CHALLENGE)).toBe('challenge');
    expect(kindOf('Exceeded the daily hits limit')).toBe('hit_limit');
    expect(kindOf('<html><body>404 Not Found</body></html>')).toBe('html');
    expect(kindOf('   ')).toBe('empty');
    expect(kindOf('Date,Open,Close')).toBe('no_rows');
    expect(kindOf('Symbol,Close\nIBM,1')).toBe('bad_header');
    expect(kindOf('Date,Open,Volume\n2025-01-02,1,2')).toBe('missing_column');
  });

  it('treats a hit limit as source-level and a bad symbol as not', () => {
    const sourceLevel = (body: string) => {
      try {
        parseStooqCsv(body, '2020-01-01');
        return null;
      } catch (err) {
        return (err as StooqError).isSourceLevel;
      }
    };
    expect(sourceLevel('Exceeded the daily hits limit')).toBe(true);
    expect(sourceLevel(CHALLENGE)).toBe(true);
    // A genuinely bad symbol says nothing about the next symbol.
    expect(sourceLevel('<html><body>404</body></html>')).toBe(false);
    expect(sourceLevel('Date,Open,Close')).toBe(false);
  });
});

describe('probeStooq', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports the diagnosis instead of throwing it', async () => {
    vi.stubGlobal('fetch', async () => new Response(CHALLENGE, { status: 200 }));
    const result = await probeStooq('ibm.us');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe('challenge');
  });

  it('confirms a healthy source with a row count and the latest date', async () => {
    vi.stubGlobal('fetch', async () => new Response(csv, { status: 200 }));
    const result = await probeStooq('ibm.us');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.rows).toBe(3);
      expect(result.latest).toBe('2025-01-06');
    }
  });

  it('reports a transport failure as source-level too', async () => {
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 502 }));
    const result = await probeStooq('ibm.us');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.kind).toBe('http');
  });
});
