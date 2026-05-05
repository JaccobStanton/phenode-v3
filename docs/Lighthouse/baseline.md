# Lighthouse Performance Baseline — V2

**As of:** 2026-05-05 (run via `make audit` from repo root)
**Profile:** Lighthouse 12.8.2, mobile form factor, simulated throttling, emulated as a *moto g power 2022*
**Route audited:** `http://localhost:4173/login` (production preview build)
**Source:** `~/Coding/PheNode/Lighthouse_Reports/lighthouse-login.json`

This doc is the reference point future audits should diff against. If a
re-audit lands meaningfully below these scores, something regressed. If
it lands above them, update this baseline (and note the change in §6).

---

## 1. Headline scores

| Category          | Score | Threshold for "good" |
| ----------------- | ----- | -------------------- |
| **Performance**   | **91** | ≥ 90 |
| **Accessibility** | **100** | ≥ 90 |
| **Best Practices**| **100** | ≥ 90 |
| **SEO**           | **100** | ≥ 90 |

All four categories at or above the green threshold. Performance is the
one we'd push higher first if any of the next 5 LCP/FCP work lands.

---

## 2. Core Web Vitals (mobile, simulated)

| Metric                  | Value     | Score | Good threshold |
| ----------------------- | --------- | ----- | -------------- |
| **FCP** (First Contentful Paint) | 2.7 s | 0.61  | < 1.8 s        |
| **LCP** (Largest Contentful Paint) | 2.9 s | 0.80 | < 2.5 s        |
| **TBT** (Total Blocking Time) | 26 ms | 1.00 | < 200 ms      |
| **CLS** (Cumulative Layout Shift) | 0.0005 | 1.00 | < 0.1     |
| Speed Index             | 2.7 s     | 0.97  | < 3.4 s        |
| TTI (Time to Interactive) | 2.9 s   | 0.96  | < 3.8 s        |

TBT and CLS are essentially perfect — the page is interactive almost
immediately and doesn't shift visually as resources arrive. FCP and LCP
are in the "needs improvement" band — see §5 for what's blocking them
from "good" and why those changes weren't worth the risk *now*.

---

## 3. Network surface on `/login`

| Resource type | Count | Total transfer |
| ------------- | ----- | -------------- |
| JS            | 12    | **190 KB**     |
| CSS           | **0** | **0 KB** (inlined into `index.html`) |
| Fonts         | 4     | ~30 KB (304 cached after first visit) |

JS breakdown (verified from `audits["network-requests"]`):

```
148 KB  High  /js/index-zazFUVdT.js          ← entry chunk
 20 KB  High  /js/CircularProgress-…js       ← Suspense fallback for lazy DashboardLayout
  7 KB        /js/AuthLogin-…js
  5 KB        /js/OutlinedInput-…js
  +small chunks (IconButton, InputAdornment, sx-tokens, LogoIcon, Close, etc.)
─────
190 KB  total
```

The `mui-charts`, `mui-pickers`, and dashboard chrome chunks **do not
load on /login** — confirmed by their absence from the network log and
from the `unused-javascript` items list.

---

## 4. What got us here — the four fixes that worked

| # | File | Change | Effect on audit |
| - | ---- | ------ | --------------- |
| 1 | `phenodeV3/index.html` | Wrapped the `ResizeObserver` polyfill in `if (!('ResizeObserver' in window))` so modern browsers skip the request | `render-blocking-resources` audit dropped 802 ms penalty (third-party CDN polyfill no longer fetched on modern browsers). |
| 2 | `phenodeV3/src/routes/MainRoutes.jsx` | `DashboardLayout` is now `Loadable(lazy(() => import('layout/Dashboard')))` instead of a static import | Entry chunk shrunk 244 KB → 148 KB (−39%). `unused-javascript` halved (105 KiB → 50 KiB). |
| 3 | `phenodeV3/public/robots.txt` (new) | Real `robots.txt` with crawler rules and sitemap pointer | SEO 92 → 100 (eliminated 44 syntax-error lines from "robots.txt is not valid" audit, which had been parsing the SPA's `index.html` as robots directives). |
| 4 | `phenodeV3/src/sections/auth/AuthLogin.jsx:384` | `ariaLabel="Sign in with email and password"` → `ariaLabel="Login — sign in with email and password"` | The `label-content-name-mismatch` audit cleared (visible "LOGIN" text now contained in the accessible name, satisfying WCAG 2.5.3). |
| 5 | `phenodeV3/vite.config.mjs` | New `inlineEntryCss()` build plugin that swaps `<link rel="stylesheet">` for inline `<style>` and deletes the now-orphan CSS from `dist/` | `render-blocking-resources` audit cleared (no external CSS request to block on). |

---

## 5. Lessons learned — what NOT to do

These two ideas seemed obvious but actively regressed performance.
Documented here so the next person doesn't repeat the experiments.

### 5.1 Do not use the `media="print" onload="this.media='all'"` CSS deferral trick on this app

**Why it backfired:** the auth surface depends on CSS for first paint
(layered gradients, `backdrop-filter` on the pill, neon hover treatments
on the button chrome). The `media="print"` swap forces the browser to
render an unstyled DOM first, then re-paint when the CSS swaps in,
producing a brief FOUC (Flash of Unstyled Content). Lighthouse rewarded
the `render-blocking-resources` audit (cleared from "fail" to "pass"),
but the actual user-visible **FCP regressed by ~800 ms** (3.0 s → 3.8 s)
because the meaningful first paint is the *styled* paint.

**Recorded as:** during fix iteration on 2026-05-05, the `media="print"`
plugin was tried and reverted within minutes after the regression
showed in the audit. The block comment in `vite.config.mjs` documents
why we don't do this.

**The right fix instead:** inline the CSS in the document HTML. Same
audit win, no FOUC, no FCP regression. See §4 fix #5.

### 5.2 Do not use object-form `manualChunks` to split lazy-only deps

```js
// Tried this — DOES NOT WORK as expected:
manualChunks: {
  'mui-charts': ['@mui/x-charts'],
  'mui-pickers': ['@mui/x-date-pickers']
}
```

**Why it backfired:** in object form, `manualChunks` instructs Rollup to
create named shared chunks. Even when the source modules (`@mui/x-charts`,
`@mui/x-date-pickers`) are only reachable via `lazy(() => import(...))`,
the named chunks end up as static dependencies of the entry chunk. The
chunks are then loaded with `High` priority on every route — including
`/login`, which never imports them. **Net result on the failed audit
attempt:** `/login` shipped 386 KB of JS instead of the previous 244 KB,
and `unused-javascript` more than doubled (105 KiB → 229 KiB).

The escape hatch — `build.modulePreload: { polyfill: false, resolveDependencies: () => [] }` —
turned off the `<link rel="modulepreload">` tags but **did not stop the
chunks from being fetched** on routes that don't import them. They were
still showing up as `High`-priority script requests on `/login`.

**Recorded as:** the comment block in
`phenodeV3/vite.config.mjs` (in the `rollupOptions.output` block where
`manualChunks` would otherwise live) preserves the failed config and the
diagnosis so it doesn't get reintroduced.

**The right fix instead:** lazy-load at the layout level, not the
package level. Making `DashboardLayout` itself lazy in `MainRoutes.jsx`
means *every* dashboard-only dependency (charts, pickers, header chrome,
drawer chrome, navigation menus, MUI extensions) flows naturally into
the lazy chunk via Vite's automatic per-`import()` code-splitting — no
hand-curated chunk lists, no eager preloading. See §4 fix #2.

### 5.3 If you must split with `manualChunks`, use the function form

Untested as of this baseline, but recorded as the next thing to try if
performance work resumes:

```js
manualChunks(id) {
  if (id.includes('node_modules/@mui/x-charts')) return 'mui-charts';
  if (id.includes('node_modules/@mui/x-date-pickers')) return 'mui-pickers';
}
```

The function form fires per-module and only produces a named chunk if a
module actually matches. The object form expects an array of *modules to
include*, which Rollup interprets differently and aggressively. This
hasn't been tested against the same dataset yet — if anyone tries it,
add results below.

---

## 6. Audits still failing (small remaining surface)

| Audit | Cost | Why we're not chasing it now |
| ----- | ---- | ---------------------------- |
| `unused-javascript` | 50 KiB / 300 ms in the 148 KB entry | Each additional lazy split adds Suspense fallback complexity. The biggest single win (DashboardLayout) is already taken. Diminishing returns. |
| `largest-contentful-paint-element` | LCP at 2,920 ms | Lighthouse couldn't pin the LCP node (`details.items[].node` came back null). Likely a styled `<Typography>` or `<Box>`. Not actionable without more diagnostic work. |
| `network-dependency-tree-insight` | informational | Already well within "good" territory. Lighthouse flags this on virtually every SPA. |
| `legacy-javascript` | 0 KiB savings | Marginal — flags 303 bytes of `@babel/plugin-transform-classes` polyfill. Bumping Vite's `build.target` to `baseline-widely-available` would clear it but ship would be ~zero. |

---

## 7. How to re-audit and diff against this baseline

```bash
cd ~/Coding/PheNode
make audit
```

That writes a fresh report to `Lighthouse_Reports/lighthouse-login.json`.
To diff scores at a glance:

```bash
jq '{
  performance:  (.categories.performance.score * 100),
  accessibility: (.categories.accessibility.score * 100),
  bestPractices: (.categories["best-practices"].score * 100),
  seo:          (.categories.seo.score * 100),
  fcp_ms:       (.audits["first-contentful-paint"].numericValue | round),
  lcp_ms:       (.audits["largest-contentful-paint"].numericValue | round),
  unused_js_kb: ((.audits["unused-javascript"].details.overallSavingsBytes // 0) / 1024 | round),
  failed_audits: [.audits | to_entries[] | select(.value.score != null and .value.score < 1) | .key]
}' Lighthouse_Reports/lighthouse-login.json
```

Compare each value to the table in §1 + §2. If the diff is significant
(score change ≥ 3, FCP/LCP regression ≥ 200 ms, unused-JS regression
≥ 20 KB), flag it before merging the change that caused it.

---

## 8. Change log

| Date | Audit version | Change | Performance | FCP | LCP | Unused JS |
| ---- | ------------- | ------ | ----------- | --- | --- | --------- |
| 2026-05-05 | initial baseline | (no fixes yet) | 86 | 3.0 s | 3.4 s | 105 KiB |
| 2026-05-05 | iteration | applied all 5 priorities (incl. CSS deferral + manualChunks) | 79 | 3.8 s | 4.0 s | 229 KiB |
| 2026-05-05 | iteration | reverted CSS deferral; kept manualChunks + modulePreload guard | 80 | 3.3 s | 4.1 s | 229 KiB |
| 2026-05-05 | iteration | reverted manualChunks too | 88 | 2.9 s | 3.2 s | 105 KiB |
| 2026-05-05 | **baseline V2** | inlined CSS + lazy `DashboardLayout` | **91** | **2.7 s** | **2.9 s** | **50 KiB** |

Update this table whenever the baseline shifts.
