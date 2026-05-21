#!/usr/bin/env node
// =============================================================================
// Lighthouse audit — authenticated dashboard routes
// =============================================================================
//
// Sister to scripts/lighthouse-audit.sh (at the repo root, which audits the
// unauthenticated /login and /register surface). This one audits routes
// inside the /dashboard/* tree, which need an authenticated session
// before they render anything useful.
//
// Why this script lives inside phenodeV3/ (not at repo root next to its
// bash sibling):
//
//   Node resolves ESM imports starting from the script file's directory.
//   The packages this script imports (puppeteer-core, chrome-launcher,
//   lighthouse) are installed in phenodeV3/node_modules — they're frontend
//   devDependencies. If the script lived at /scripts/, Node would walk
//   from /scripts/ → / looking for node_modules and fail. Co-locating
//   the script with the package.json that owns its deps fixes the
//   resolution path with zero extra plumbing.
//
// Why this is a Node script and not a bash one:
//
//   The bash sibling shells out to the `lighthouse` CLI directly. That
//   works for unauth routes because there's no setup needed — Lighthouse
//   opens the URL in a fresh Chrome and audits whatever renders. Auth'd
//   routes need a sign-in step BEFORE the audit, which means driving a
//   real browser. Lighthouse has a programmatic API where you can hand
//   it an already-launched Chrome (via `port`) and the localStorage we
//   set in that Chrome before the audit persists into the audit's
//   page-load. That's the pattern this script implements.
//
// Flow:
//
//   1. Read user / pass / VITE_API_URL from phenodeV3/.env (loaded via
//      Node 22's --env-file flag — see package.json's audit:authenticated
//      script).
//   2. POST to {VITE_API_URL}/auth/login → get { access_token, refresh_token }.
//      We hit the backend directly rather than driving the login form
//      because (a) it's faster, (b) it's robust to form-selector changes,
//      and (c) the V3 frontend stores tokens in localStorage anyway, so
//      setting them by API + injection is functionally identical.
//   3. Launch a single headless Chrome via chrome-launcher.
//   4. Use puppeteer-core to connect to it, navigate to a same-origin
//      page on the preview server (so localStorage is keyed correctly),
//      and inject the tokens. Disconnect puppeteer-core (Chrome stays).
//   5. For each protected route, call lighthouse() programmatically with
//      the same Chrome port. Lighthouse opens the URL in a new tab —
//      same origin, so localStorage is there, and the page renders
//      authenticated.
//   6. Write each route's report as JSON to <repo>/Lighthouse_Reports/.
//   7. Kill Chrome.
//
// Add a route: append to ROUTES below. The npm script + shell hook
// don't change.

import puppeteer from 'puppeteer-core';
import * as chromeLauncher from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// This file lives at <repo>/phenodeV3/scripts/, so the repo root is
// two levels up. If you move this script, update this join() to match.
const REPO_ROOT = join(__dirname, '..', '..');
const REPORTS_DIR = join(REPO_ROOT, 'Lighthouse_Reports');

// The preview server URL is fixed by scripts/lighthouse-audit.sh and
// vite's preview defaults. If you change vite.config.mjs's preview.port,
// update this constant to match.
const PREVIEW_URL = 'http://localhost:4173';

// Routes to audit. Each entry produces one report file:
//   Lighthouse_Reports/lighthouse-<name>.json
//
// Notes on sensor-measurements:
//   - The page accepts a `?device=` query param but falls back to the
//     most-recently-reporting device when omitted, so no auth-time
//     scaffolding is needed to give the page a real device to render.
//   - The page also reads `?view=map` and `?range=<label>` from the URL,
//     which is what the map-view + long-range audit routes below rely
//     on. URL-driven state is cleaner than driving a puppeteer click
//     here: the audit captures exactly the user-visible URL, and the
//     same URL is shareable / bookmarkable for real users.
//
// Three sensor-measurements audits to catch different performance
// profiles:
//
//   1. sensor-measurements           — Default state. Chart panel with
//                                      "Last 24 hours" of raw data
//                                      (~288 rows × 6 charts). The most
//                                      common user-visible state.
//   2. sensor-measurements-map       — Map view open. Captures the
//                                      Google Maps initial-load cost
//                                      and pin-rendering scaling with
//                                      fleet size. Different bottleneck
//                                      profile than the chart panel.
//   3. sensor-measurements-long-range — Chart panel with "Last 5 years"
//                                       (bucketed 1d → ~1,825 rows ×
//                                       6 charts). Stresses the
//                                       longest-range SVG paint path.
//                                       Watching this number tells us
//                                       whether the lite-glow + memo
//                                       optimizations are still pulling
//                                       their weight as data grows.
//
// `range` value is URL-encoded by the audit's `encodeURIComponent` call
// in auditRoute — the space in "Last 5 years" becomes %20 automatically.
const ROUTES = [
  { path: '/dashboard/fleet-overview', name: 'fleet-overview' },
  { path: '/dashboard/sensor-fleet-overview', name: 'sensor-fleet-overview' },
  { path: '/dashboard/sensor-measurements', name: 'sensor-measurements' },
  { path: '/dashboard/sensor-measurements?view=map', name: 'sensor-measurements-map' },
  { path: '/dashboard/sensor-measurements?range=Last%205%20years', name: 'sensor-measurements-long-range' },
  // ─────────────────────────────────────────────────────────────────
  // sensor-network — mirrors the sensor-measurements audit triplet.
  // The page accepts the same `?view=map` and `?range=<label>` URL
  // params as sensor-measurements (added in sensor-network.jsx the
  // same day this triplet was added), so the routes below deep-link
  // directly into specific UI states with no puppeteer scaffolding.
  //
  //   1. sensor-network            — Default state. Diagram block +
  //                                  Sensor Information / Soil Data
  //                                  card + Rename card up top;
  //                                  6-chart wireless-sensor panel
  //                                  below ("Last 24 hours" of raw
  //                                  data, dual-probe lines on Soil
  //                                  Temp / Moisture / Conductivity).
  //                                  The most common user-visible
  //                                  state.
  //   2. sensor-network-map        — Map view open. Captures the
  //                                  Google Maps initial-load cost
  //                                  for the WirelessSensorFleetMap
  //                                  AND the chart panel below it
  //                                  (always rendered now per the
  //                                  layout fix on May 17). Catches
  //                                  the worst-case "everything
  //                                  mounted" performance profile.
  //   3. sensor-network-long-range — Chart panel with "Last 5 years"
  //                                  (bucketed 1d) across the 6
  //                                  wireless-sensor charts. Stresses
  //                                  the multi-series SVG paint path
  //                                  — dual-probe charts have 2x the
  //                                  data points to render vs the
  //                                  single-series device charts, so
  //                                  this number tells us whether the
  //                                  shared chartSx + per-chart null
  //                                  handling are scaling.
  { path: '/dashboard/wireless-sensors', name: 'sensor-network' },
  { path: '/dashboard/wireless-sensors?view=map', name: 'sensor-network-map' },
  { path: '/dashboard/wireless-sensors?range=Last%205%20years', name: 'sensor-network-long-range' }
];

// localStorage keys the V3 frontend uses for the JWT pair. Mirror of
// services/fetcher.js — keep in sync if those keys ever change.
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function readCreds() {
  const username = process.env.user;
  const password = process.env.pass;
  const apiBase = process.env.VITE_API_URL;
  if (!username || !password) {
    fail('Missing `user` and/or `pass` in phenodeV3/.env. Add them and try again.');
  }
  if (!apiBase) {
    fail('Missing VITE_API_URL in phenodeV3/.env.');
  }
  return { username, password, apiBase };
}

async function login({ username, password, apiBase }) {
  const url = `${apiBase}/auth/login`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: username, password })
  });
  // Read the body ONCE as text. We then try to JSON.parse it in memory.
  // Earlier versions called res.json() then res.text() in a fallback —
  // that throws "Body is unusable" because the first read consumes the
  // stream. Reading once as text and parsing locally is the safe pattern.
  const rawBody = await res.text();
  let parsed = null;
  try {
    parsed = rawBody ? JSON.parse(rawBody) : null;
  } catch {
    // Leave parsed as null; body is non-JSON (HTML error page, plain text, etc.)
  }
  if (!res.ok) {
    const detail = parsed?.detail || (parsed && JSON.stringify(parsed)) || rawBody || '(empty response body)';
    fail(`Login failed at ${url} — HTTP ${res.status}: ${detail}`);
  }
  if (!parsed) {
    fail(`Login response was not JSON. HTTP ${res.status}. First 200 chars: ${rawBody.slice(0, 200)}`);
  }
  if (!parsed.access_token || !parsed.refresh_token) {
    fail(`Login response missing tokens. Got keys: ${Object.keys(parsed).join(', ')}`);
  }
  return { accessToken: parsed.access_token, refreshToken: parsed.refresh_token };
}

async function injectTokens(chromePort, { accessToken, refreshToken }) {
  // Connect puppeteer-core to the running Chrome. browserURL gets the
  // WebSocket endpoint via the DevTools http://host:port/json/version
  // probe — chrome-launcher exposes the port; puppeteer figures out
  // the rest.
  const browser = await puppeteer.connect({
    browserURL: `http://localhost:${chromePort}`,
    defaultViewport: null
  });
  try {
    const pages = await browser.pages();
    const page = pages[0] ?? (await browser.newPage());
    // Navigate to ANY page on the preview origin so localStorage is
    // keyed against http://localhost:4173. /login is fine — it's
    // unauthenticated and renders without redirecting (RequireAuth
    // gates /dashboard/*, not /login).
    await page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(
      (atKey, rtKey, at, rt) => {
        window.localStorage.setItem(atKey, at);
        window.localStorage.setItem(rtKey, rt);
      },
      ACCESS_TOKEN_KEY,
      REFRESH_TOKEN_KEY,
      accessToken,
      refreshToken
    );
  } finally {
    // Disconnect, don't close — Chrome must stay running for lighthouse
    // to reuse the port. close() would terminate the browser process.
    await browser.disconnect();
  }
}

async function auditRoute(chromePort, route) {
  const url = `${PREVIEW_URL}${route.path}`;
  console.log(`→ Auditing ${route.path}…`);
  const result = await lighthouse(
    url,
    {
      port: chromePort,
      output: 'json',
      logLevel: 'error',
      // Skip PWA — we're not a PWA and the category is going away in
      // future Lighthouse versions anyway.
      onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo']
    },
    // Use Lighthouse's default mobile config (Moto G Power emulation,
    // simulated throttling) so scores are directly comparable to the
    // unauth /login + /register baseline.
    undefined
  );
  const reportPath = join(REPORTS_DIR, `lighthouse-${route.name}.json`);
  writeFileSync(reportPath, result.report);

  const cats = result.lhr.categories;
  const score = (k) => Math.round((cats[k]?.score ?? 0) * 100);
  console.log(`  ✓ ${reportPath}`);
  console.log(
    `    Performance: ${score('performance')} · Accessibility: ${score('accessibility')} · ` +
      `Best Practices: ${score('best-practices')} · SEO: ${score('seo')}`
  );
}

async function checkPreviewServer() {
  // Fail fast with a useful message if the preview server isn't up.
  // The bash orchestrator (scripts/lighthouse-audit.sh) starts preview
  // before invoking this script, but someone running
  // `npm run audit:authenticated` standalone won't have preview up.
  // Without this preflight, the first failure is a cryptic puppeteer
  // ERR_CONNECTION_REFUSED stack trace after Chrome already launched.
  try {
    const res = await fetch(PREVIEW_URL, { method: 'GET' });
    if (!res.ok && res.status !== 304) {
      fail(
        `Preview server responded ${res.status} at ${PREVIEW_URL}. Expected a 200. ` +
          `Make sure \`npm run preview\` is serving the production build.`
      );
    }
  } catch (err) {
    fail(
      `Preview server not reachable at ${PREVIEW_URL} (${err.code || err.message}).\n` +
        `  Run \`make audit\` from the repo root (recommended — it handles build + preview lifecycle),\n` +
        `  OR in a separate terminal: \`cd phenodeV3 && npm run build && npm run preview\`, then retry.`
    );
  }
}

async function main() {
  mkdirSync(REPORTS_DIR, { recursive: true });

  await checkPreviewServer();

  const creds = readCreds();
  console.log(`→ Logging in as ${creds.username}…`);
  const tokens = await login(creds);
  console.log('  ✓ Tokens acquired.');

  console.log('→ Launching Chrome (headless)…');
  const chrome = await chromeLauncher.launch({
    chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu']
  });

  try {
    console.log('→ Injecting tokens into localStorage…');
    await injectTokens(chrome.port, tokens);
    console.log('  ✓ localStorage primed.');

    for (const route of ROUTES) {
      await auditRoute(chrome.port, route);
    }
  } finally {
    await chrome.kill();
    console.log('→ Chrome killed.');
  }

  console.log('\n✓ Authenticated audits complete.');
}

main().catch((err) => {
  console.error('\n✗ Audit failed:');
  console.error(err);
  process.exit(1);
});
