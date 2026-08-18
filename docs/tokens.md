# Design tokens actually in use

Read out of the source on 2026-08-17. Every value below is cited to the file and
line it is declared on. Nothing here is a typical value, a rounded value, or a
value carried over from another project. Where a color, size or width is used
but has no token, it is listed as a literal so the gap is visible.

Source of record: `web/src/styles.css` unless stated otherwise.

Every line number below was read against the stylesheet as it stood at line
1,623 — the app before `#/style` was added. The proof page's block was appended
after that point, so all citations here still resolve unchanged, and none of
them describe the proof page. Verified 2026-08-17.

---

## 1. Color

### 1.1 Paper palette — `:root`

| Token | Value | Line |
|---|---|---|
| `--paper` | `#edf0f3` | 20 |
| `--paper-raised` | `#f7f9fa` | 21 |
| `--paper-sunk` | `#e2e7ec` | 22 |
| `--paper-deep` | `#d7dee4` | 23 |
| `--ink` | `#111a22` | 25 |
| `--ink-2` | `#46555f` | 26 |
| `--ink-3` | `#6b7a86` | 27 |
| `--rule` | `#c9d2d9` | 29 |
| `--rule-strong` | `#a5b3bd` | 30 |
| `--traced` | `#146b52` | 32 |
| `--claimed` | `#2c5c8c` | 33 |
| `--gap` | `#a8391f` | 34 |
| `--transfer` | `#8a6420` | 35 |
| `--quality` | `#5b4a86` | 36 |

`color-scheme: light` (69). There is no dark-mode media query in the file; the
dark surfaces are a scoped class, not a theme.

### 1.2 Cover palette — scoped to `.cover`, not `:root` (941-949)

| Token | Value | Line |
|---|---|---|
| `--cover-ground` | `#0a1018` | 942 |
| `--cover-raised` | `rgba(238, 241, 244, 0.035)` | 943 |
| `--cover-ink` | `#eef1f4` | 944 |
| `--cover-ink-2` | `#9dacb7` | 945 |
| `--cover-ink-3` | `#6d7d89` | 946 |
| `--cover-rule` | `rgba(238, 241, 244, 0.22)` | 947 |
| `--cover-rule-soft` | `rgba(238, 241, 244, 0.12)` | 948 |
| `--cover-rule-strong` | `rgba(238, 241, 244, 0.42)` | 949 |

### 1.3 Price palette — scoped to `.cover.prices` (1438-1442)

| Token | Value | Line | Derivation stated in source |
|---|---|---|---|
| `--price-1` | `#6fa8d8` | 1439 | `--claimed`, raised for the dark ground |
| `--price-2` | `#d3a34e` | 1440 | `--transfer`, raised the same way |
| `--price-break` | `#e0705a` | 1441 | the audit red, raised |

### 1.4 Color literals reachable through no token

| Value | Where | Line |
|---|---|---|
| `#cfe0d8` | `::selection` background | 103 |
| `#f2dcd6` | gap-bar hatch ground | 325 |
| `#f2dcd6` | same hatch, legend swatch | 365 |
| `rgba(238, 241, 244, 0.02)` | `.sheet` ground | 1170 |
| `rgba(10, 16, 24, 0.72)` | `.stage-node` fill | 1199 |
| `rgba(238, 241, 244, 0.06)` | `.stage-node.is-open` | 1209 |
| `rgba(238, 241, 244, 0.08)` | `.gridcard-open:hover` | 1349 |
| `rgba(238, 241, 244, 0.05)` | `.cover .gapbar` track | 1365 |
| `rgba(168, 57, 31, 0.28)` | `.cover .gapbar-fill` | 1368 |
| `#1e9a74` | `.cover .gapbar-traced` | 1369 |
| `#4fc59d` | `.cover .is-traced` | 1378 |
| `#e0705a` | `.cover .is-gap` | 1379 |
| `rgba(238, 241, 244, 0.06)` | `.cover .term-body` | 1388 |
| `rgba(238, 241, 244, 0.08)` | `.cover-cta.is-secondary:hover` | 1578 |

**Accent count on paper: five** (`--traced`, `--claimed`, `--gap`, `--transfer`,
`--quality`), plus dark-ground lifts of three of them.

---

## 2. Font stacks — `:root` (38-40)

```css
--font-display: 'IBM Plex Sans Condensed', 'Helvetica Neue', sans-serif;   /* 38 */
--font-serif:   'IBM Plex Serif', Georgia, serif;                          /* 39 */
--font-mono:    'IBM Plex Mono', 'SF Mono', monospace;                     /* 40 */
```

Roles, stated at 11-14: condensed sans for structure, serif for claims so they
read as quoted disclosure, mono for every number so columns align. `body` is
`--font-display` at `--t-md` (84-85).

**Weights actually available**, from the one font link at `web/index.html:9`:

| Family | Weights loaded |
|---|---|
| IBM Plex Mono | 400, 500, 600 |
| IBM Plex Sans Condensed | 400, 500, 600, 700 |
| IBM Plex Serif | 400, 500, 600, italic 400 |

Loaded from Google Fonts with `&display=swap`, not self-hosted
(`web/index.html:7-9`).

---

## 3. Type ramp — `:root` (46-54)

| Token | Value | Stated use | Line |
|---|---|---|---|
| `--t-2xs` | `11px` | column heads, eyebrows — tracked, uppercase | 46 |
| `--t-xs` | `13px` | dense metadata | 47 |
| `--t-sm` | `16px` | the floor: table body, chips, captions | 48 |
| `--t-md` | `17px` | reading text | 49 |
| `--t-lg` | `21px` | panel headings | 50 |
| `--t-xl` | `25px` | view headings | 51 |
| `--t-2xl` | `30px` | section statements | 52 |
| `--t-3xl` | `44px` | the one number the page exists to say | 53 |
| `--t-4xl` | `68px` | — | 54 |

Described at 42-45 as geometric, ratio 1.2, anchored at 16. True mid-scale
(21/17 = 1.24, 25/21 = 1.19, 30/25 = 1.20), deliberately wider at the display end
(44/30 = 1.47, 68/44 = 1.55). It is hand-tuned, not computed — do not regenerate
it from a formula.

Ramp overrides by viewport, the only place sizes change:

- `@media (max-width: 720px)` — `--t-3xl: 34px; --t-4xl: 48px; --t-2xl: 26px; --t-xl: 22px` (1602)
- `@media (max-width: 420px)` — `--t-4xl: 40px` (1613)

The 16px floor is never overridden. The only non-ramp sizes are two `em` values:
`.term-mark` `0.7em` (280) and `.doc code` `0.9em` (851).

`font-variant-numeric: tabular-nums` is set on `.mono` and `.num` (211-212) and
repeated on eight number elements (344, 391, 411, 457, 631, 767, 1222).

---

## 4. Font weights in use

Four values, no others.

| Weight | Count | Representative lines |
|---|---|---|
| 400 | 4 | `.term-body` 293, `.claim-headline` 652, `.company-verdict` 821 |
| 500 | 1 | `.home-card-claim` 1104 |
| 600 | 20 | `h2,h3,h4` 199, `.finding-figure` 388, `.claimrow-company` 603, `.cover-mark` 1007, `.home-headline` 1064, `.thesis-title` 1143, `.gridcard-name` 1304 |
| 700 | 1 | `.masthead-title` 161 |

600 is the structural weight. 700 appears once. 400 is the serif voice.

---

## 5. Letter-spacing

Negative on display type, positive on small uppercase labels, nothing between.

| Value | Where | Lines |
|---|---|---|
| `-0.03em` | `.finding-figure` | 390 |
| `-0.02em` | `.home-headline`, `.thesis-title` | 1063, 1143 |
| `-0.015em` | `.directory-title` | 1275 |
| `-0.01em` | `.masthead-title`, `.claim-headline`, `.prices-title` | 161, 653, 1451 |
| `-0.005em` | `h2, h3, h4` | 199 |
| `0` | explicit resets, so tracking cannot leak into a definition | 296, 687, 695, 819, 1227 |
| `.01em` / `.02em` / `.04em` / `.06em` | `.cover-cta`, `.home-card-open`, `.pricechart-break text`, `.gridcard-group` | 1039, 1128, 1534, 1311 |
| `.07em` | uppercase label sets (`.kv dt`, `.claim-coding dt`, `.marginwin-step-label`, `.form-field span`, `.claimrow-kind`) | 612, 680, 693, 763, 916 |
| `.08em` | `.filters-group-head`, `.glossary h4`, `.home-card-meta`, `.gridcard-name` and four more | 547, 857, 1031, 1099, 1117, 1305, 1322, 1338 |
| `.1em` | `.sheet-ruler`, `.stage-arrow-label` | 1179, 1241 |
| `.12em` | `.cover-nav button` | 1014 |
| `.14em` | `.cover-eyebrow`, `.stage-mark`, `.sheet-readout-mark` | 1026, 1213, 1253 |
| `.18em` | `.cover-mark` — widest in the app | 1007 |

Ledger surfaces track at `.07–.08em`; covers track wider, `.12–.18em`.

---

## 6. Line-height

| Value | Where | Lines |
|---|---|---|
| `1` | `.term-mark`, `.finding-figure` | 282, 389 |
| `1.04` / `1.06` | `.home-headline`, `.prices-title` / `.thesis-title` | 1062, 1451 / 1142 |
| `1.1` | figure values, `.directory-title` | 1120, 1221, 1274, 1318 |
| `1.2` / `1.25` | `.marginwin-step-value` / `.claim-headline`, `.stage-title` | 768 / 652, 1216 |
| `1.32` / `1.35` | `.prices-takeaway` / `.finding-say`, `.home-card-claim` | 1459 / 397, 1105 |
| `1.4` / `1.45` | `.claimrow-headline`, `.gridcard-claim` / `.home-standfirst`, `.stage-caption` | 621, 706, 1325 / 1072, 1226, 1256 |
| `1.5` / `1.55` | `.term-body`, `.company-verdict` / `body`, `.thesis-lede p` | 294, 818 / 86, 1154 |

---

## 7. Spacing — `:root` (56-59)

A 4px grid, named by multiple. There is no `--s-7`, `--s-9`, `--s-11`, `--s-13`
to `--s-15`, or `--s-17` to `--s-19`.

```
--s-1:  4px   --s-2:  8px   --s-3: 12px   --s-4: 16px
--s-5: 20px   --s-6: 24px   --s-8: 32px   --s-10: 40px
--s-12: 48px  --s-16: 64px  --s-20: 80px
```

Off-scale pixel values, all structural rather than rhythmic: `3px` scrollbar
thumb border (109), `2px` outline-offset (117), `1px` sr-only box (131), `-60px`
skip-link park (137), `1px 5px` `.filters-count` (523), `0 3px` `.doc code` (852),
text-underline-offset `2px`/`3px` (239, 251, 604, 623, 799).

---

## 8. Border widths

| Width | Use | Lines |
|---|---|---|
| `1px` | the default hairline everywhere — panels, rows, chips, inputs, frame | 172, 189, 275, 577, 1012 |
| `1.5px` | the audit hatch stripe inside the gap bar gradient | 328-329, 367 |
| `2px` | masthead base, section heads, `.claim-head`, `.company-head`, `.doc-head`, `.home-card` left edge, `.prices-takeaway` left edge, focus ring | 152, 643, 805, 845, 1091, 1461, 116 |
| `3px` | left edges: `.term-body`, `.finding-clarify`, `.finding-aside`, `.claim-flag`, `.marginwin-step`; scrollbar thumb border | 291, 419, 428, 671, 757, 109 |
| `4px` | left accents: `.failure`, `.breakdown-item`, `.runlist-item` | 259, 472, 875 |

SVG stroke widths: `1` (1237, 1503, 1504), `1.5` (1530), `2` (1511, 1516).

---

## 9. Border radius

**Zero. One declaration in the whole stylesheet, and it is a reset:**

```css
:focus-visible { ... border-radius: 0; }   /* 118 */
```

There is no other `border-radius` in the stylesheet.
`test/interface.test.ts:199` fails on any `border-radius: [1-9]`.

---

## 10. Motion — `:root` (62-64)

```css
--motion-fast: 120ms;
--motion-base: 200ms;
--motion-ease: cubic-bezier(.2, .6, .35, 1);
```

`--motion-fast` drives every hover transition; `--motion-base` drives the single
shell `settle` fade (98-101), itself wrapped in
`@media (prefers-reduced-motion: no-preference)`. The global reduce block at
121-128 collapses all animation, transition and `scroll-behavior` to `0.001ms`.

JS motion is **not** on these tokens — it is per-call-site:

| Value | Where |
|---|---|
| word stagger `45ms` | `views/HomeView.tsx:84`, `views/PricesView.tsx:62` |
| word stagger `55ms` | `views/ThesisView.tsx:107` |
| CountUp duration `1.4s` / `1.2s` / `1.6s` | `views/ThesisView.tsx:53`, `:64`, `:75` |
| card entrance `0.32s`, delay `min(i * STEP, LAST_ENTRANCE)` | `views/DirectoryView.tsx:82-84` |
| spring `damping = 20 + 40*(1/d)`, `stiffness = 100*(1/d)` | `vendor/reactbits/CountUp.tsx:77-78` |
| chart draw `DRAW = 1.1s`, `STEP = 0.08s` | `components/PriceChart.tsx:45-46` |

---

## 11. Layout constants

| Value | Meaning | Line |
|---|---|---|
| `--measure: 68ch` | the reading measure | 66 |
| `--page: 1080px` | max width of `.main` and `.cover-inner` | 67 |
| `820px` | `.claim`, `.company`, `.doc` | 641 |
| `520px` | `.submit` | 912 |
| `28px` | ruled-paper repeat on `body` | 90 |
| `56px` | drafting-grid repeat on `.sheet` | 1172-1173 |
| `680px` | `.pricechart` min-width, the one sideways-scrolling frame | 1501 |
| Breakpoints | `900px` (1395), `720px` (1405, 1582, 1601), `420px` (1612) | — |

Global: `html, body { overflow-x: hidden; max-width: 100% }` (1621).

---

## 12. What the repurpose has to change

Two gaps against the audit-workpaper mandate, both real:

1. **Accent count.** Five semantic hues on paper, against a cap of two. The
   mapping that survives is `--traced` (32) for `threshold crossed` and `--gap`
   (34) for `contradicted`. `--claimed`, `--transfer` and `--quality` have no
   role in the new vocabulary.
2. **The workpaper vernacular does not exist yet.** No tickmark system, no
   cross-reference index, no preparer block, no lead schedule. The closest
   existing marks are four one-offs: `.cover-eyebrow-mark` (1029), `.stage-mark`
   (1211), `.sheet-ruler` (1176), `.condition-mark` (704). They are marks
   without a legend, which is decoration rather than a system.
