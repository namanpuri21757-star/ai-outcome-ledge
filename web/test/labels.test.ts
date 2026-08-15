import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  BASES, BASIS_ORDER, CONDITION_LIST, COPY, DESTINATION_ORDER, DESTINATIONS, EPISTEMIC, GROUPS,
  KINDS, KIND_ORDER, PHRASES, TIERS, VERIFICATION, VERIFICATION_ORDER,
  basis, define, destination, epistemic, glossary, group, kind, verification,
} from '../src/lib/labels';

describe('database codes never reach the interface', () => {
  it('gives no destination a name beginning with its rank', () => {
    for (const d of Object.values(DESTINATIONS)) {
      expect(d.name).not.toMatch(/^\d/);
      expect(d.verb).not.toMatch(/^\d/);
    }
  });

  it('gives every label words rather than the stored enum', () => {
    for (const b of Object.values(BASES)) expect(b.name).not.toContain('_');
    for (const k of Object.values(KINDS)) expect(k.name).not.toContain('_');
    for (const v of Object.values(VERIFICATION)) expect(v.name).not.toContain('_');
    for (const e of Object.values(EPISTEMIC)) expect(e.name).not.toContain('_');
  });
});

describe('the one ladder order', () => {
  it('is furthest from profit first, uncoded last', () => {
    expect(DESTINATION_ORDER).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it('covers every destination exactly once', () => {
    expect([...DESTINATION_ORDER].sort()).toEqual(Object.keys(DESTINATIONS).map(Number).sort());
  });

  it('has an order list for every vocabulary that is offered as a filter', () => {
    expect(new Set(BASIS_ORDER).size).toBe(Object.keys(BASES).length);
    expect(new Set(KIND_ORDER).size).toBe(Object.keys(KINDS).length);
    expect(new Set(VERIFICATION_ORDER).size).toBe(Object.keys(VERIFICATION).length);
  });
});

describe('lookups never throw on an unknown key', () => {
  it('falls back rather than crashing', () => {
    expect(destination(99).name).toBe('Not coded');
    expect(destination(null).name).toBe('Not coded');
    expect(basis('nonsense' as never).name).toBe("Source doesn't say");
    expect(group(null).name).toBe('Unclassified');
    expect(group('ZZ').name).toBe('Unclassified');
    expect(epistemic('nope' as never).name).toBe('Unclassified');
    expect(kind('nope' as never).name).toBe('nope');
    expect(verification('nope' as never).name).toBe('nope');
  });
});

describe('every coded value carries a definition', () => {
  it('defines every destination', () => {
    for (const r of DESTINATION_ORDER) expect(define('destination', r)?.body.length).toBeGreaterThan(30);
  });
  it('defines every measurement basis', () => {
    for (const b of BASIS_ORDER) expect(define('basis', b)?.body.length).toBeGreaterThan(30);
  });
  it('defines every kind of row', () => {
    for (const k of KIND_ORDER) expect(define('kind', k)?.body.length).toBeGreaterThan(20);
  });
  it('defines every verification status and evidence tier', () => {
    for (const v of VERIFICATION_ORDER) expect(define('verification', v)?.body).toBeTruthy();
    for (const t of [1, 2, 3]) expect(define('tier', t)?.body).toBeTruthy();
  });
  it('defines every epistemic tag — these were raw enum strings before', () => {
    for (const e of Object.keys(EPISTEMIC)) expect(define('epistemic', e)?.body).toBeTruthy();
  });
  it('defines every condition, with what passing and failing look like', () => {
    for (const c of CONDITION_LIST) {
      const d = define('condition', c.key)!;
      expect(d.body).toContain('?');
      expect(d.extra).toHaveLength(2);
      expect(d.extra![0]).toContain('Passes when');
      expect(d.extra![1]).toContain('Fails when');
    }
  });
  it('defines every company type', () => {
    for (const g of Object.keys(GROUPS)) expect(define('group', g)?.body).toBeTruthy();
  });
  it('defines every standing phrase', () => {
    for (const p of Object.keys(PHRASES)) expect(define('phrase', p)?.body).toBeTruthy();
  });
  it('returns null for a term that does not exist, rather than an empty box', () => {
    expect(define('basis', 'nope')).toBeNull();
    expect(define('phrase', 'nope')).toBeNull();
  });
  it('writes every definition as a full sentence', () => {
    for (const s of glossary()) {
      for (const item of s.items) {
        expect(item.body.trim(), `${s.heading}/${item.code}`).toMatch(/[.?]$/);
        expect(item.label.length).toBeGreaterThan(1);
      }
    }
  });
});

describe('the glossary is generated, so nothing can be missing from it', () => {
  const sections = glossary();
  const codes = new Set(sections.flatMap((s) => s.items.map((i) => `${s.heading}::${i.code}`)));

  it('includes every destination, basis, kind, condition, tier and group', () => {
    expect(codes.size).toBe(
      DESTINATION_ORDER.length + BASIS_ORDER.length + KIND_ORDER.length +
      CONDITION_LIST.length + VERIFICATION_ORDER.length + Object.keys(TIERS).length +
      Object.keys(EPISTEMIC).length + Object.keys(GROUPS).length + Object.keys(PHRASES).length,
    );
  });

  it('never leaves a section empty', () => {
    for (const s of sections) expect(s.items.length, s.heading).toBeGreaterThan(0);
  });
});

describe('standing copy', () => {
  it('always says that not traceable does not mean false', () => {
    expect(COPY.untracedMeaning).toContain('does not mean the claim is false');
    expect(COPY.untracedMeaning).toContain('audited and true');
  });
});

/* ===================================================================
   The vocabulary rule, enforced by reading the tree.
   =================================================================== */

describe('one vocabulary file', () => {
  const SRC = new URL('../src', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');

  function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((entry) => {
      const full = join(dir, entry);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  }
  const files = walk(SRC).filter((f) => /\.tsx?$/.test(f) && !f.endsWith('labels.ts'));

  it('never writes a destination name as a string literal outside labels.ts', () => {
    const names = DESTINATION_ORDER.map((r) => destination(r).name);
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const name of names) {
        expect(text, `${file} hard-codes the destination name "${name}"`).not.toContain(`'${name}'`);
        expect(text, `${file} hard-codes the destination name "${name}"`).not.toContain(`"${name}"`);
      }
    }
  });

  it('never writes a basis or verification name as a string literal', () => {
    const names = [
      ...BASIS_ORDER.map((b) => basis(b).name),
      ...VERIFICATION_ORDER.map((v) => verification(v).name),
    ];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const name of names) {
        expect(text, `${file} hard-codes "${name}"`).not.toContain(`'${name}'`);
      }
    }
  });

  it('never hard-codes a user-facing name in the stylesheet', () => {
    const css = readFileSync(join(SRC, 'styles.css'), 'utf8');
    for (const r of DESTINATION_ORDER) {
      expect(css).not.toContain(destination(r).name);
    }
    // The `content` property, not `justify-content`. A user-facing name
    // injected from CSS is invisible to search, to translation and to
    // this test suite, which is why it is banned.
    expect(css).not.toMatch(/(^|[^-\w])content\s*:/m);
  });
});
