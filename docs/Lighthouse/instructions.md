# Lighthouse Auditing — Setup & Run Guide

**Audience:** Anyone running performance / accessibility / SEO audits against the PheNode V3 frontend.
**TL;DR:**

```bash
cd ~/Coding/PheNode
make audit
```

Reports land at `~/Coding/PheNode/Lighthouse_Reports/lighthouse-login.json`
and `…/lighthouse-register.json`.

---

## 1. What this is

Lighthouse is Google's open-source web auditing tool. It loads a page in
headless Chrome, drives it through a battery of checks (performance,
accessibility, best practices, SEO, PWA), and emits a report with
numerical scores plus an itemized list of problems and suggested fixes.

In this repo, Lighthouse runs against the **production preview build**
(`vite build` + `vite preview`), not the dev server. Dev mode is
no-bundle / no-minify and gives misleading scores; prod is what users
actually hit. The two routes audited are `/login` and `/register` — the
unauthenticated surface. (Authenticated routes like
`/dashboard/fleet-overview` need a stored auth cookie to audit; that's a
follow-up if you need it.)

---

## 2. Prerequisites — install once

You need:

- **Node + npm** — already required for the rest of the project.
- **Google Chrome (or Chromium)** — Lighthouse drives a real headless
  Chrome instance to load the page. macOS ships Safari; install Chrome
  from <https://www.google.com/chrome/> if you haven't.
- **The `lighthouse` npm package** — declared as a devDependency in
  `phenodeV3/package.json`. It installs automatically the first time
  you run `make audit` (or whenever you `npm install` in `phenodeV3/`).

Nothing else. There is no SaaS, no API key, no plugin to enable.

---

## 3. The files involved

| Path                                       | Role                                                                 |
| ------------------------------------------ | -------------------------------------------------------------------- |
| `phenodeV3/package.json`                   | Declares `lighthouse` as a devDep. Defines `audit:login`, `audit:register`, and `audit` npm scripts. |
| `scripts/lighthouse-audit.sh`              | Shell script that runs the full lifecycle (build → preview → audit → cleanup). |
| `Makefile`                                 | `make audit` target that calls the shell script.                     |
| `Lighthouse_Reports/`                      | Where JSON reports land. The folder itself is git-tracked via a self-ignoring `.gitignore`; the `*.json` reports inside are not committed. |

---

## 4. The primary command

```bash
make audit
```

That's it. From the repo root (`~/Coding/PheNode/`). It does seven things
in sequence:

1. **Ensures `Lighthouse_Reports/` exists** (`mkdir -p` is idempotent).
2. **Installs deps if missing.** If `phenodeV3/node_modules/lighthouse`
   doesn't exist, runs `npm install` in `phenodeV3/`. Subsequent runs
   skip this — it's only first-time cost (50–80 MB of lighthouse +
   transitive deps).
3. **Builds the V3 frontend.** Runs `npm run build` (i.e. `vite build`)
   to produce the production-style bundle in `phenodeV3/dist/`.
4. **Starts the preview server in the background.** Runs `npm run
   preview` (i.e. `vite preview`) which serves `dist/` on
   `http://localhost:4173`. Server stdout/stderr is redirected to
   `/tmp/phenode-lh-preview.log` so it doesn't clutter the audit output.
5. **Waits for the preview server to respond.** Polls
   `http://localhost:4173/` every 0.5s for up to 15 seconds. If the
   server doesn't come up in time, the script tails
   `/tmp/phenode-lh-preview.log` and exits with a non-zero status.
6. **Runs Lighthouse against `/login`, then `/register`.** Each run
   takes 30–60 seconds (Lighthouse intentionally slows the network /
   CPU to simulate a mid-tier mobile device).
7. **Tears down the preview server.** A `trap cleanup EXIT` handler in
   the shell script kills the backgrounded `vite preview` process even
   if Lighthouse fails midway.

When it finishes, you'll see something like:

```
✓ Audit complete. Reports:
   /Users/jstanton/Coding/PheNode/Lighthouse_Reports/lighthouse-login.json (2034512 bytes)
   /Users/jstanton/Coding/PheNode/Lighthouse_Reports/lighthouse-register.json (1981334 bytes)
```

---

## 5. The npm scripts (per-route invocations)

These run only the Lighthouse step — they assume the preview server is
already up on port 4173. Use them when you want to re-audit one route
quickly without rebuilding.

```bash
cd phenodeV3
npm run audit:login        # /login only
npm run audit:register     # /register only
npm run audit              # both, in sequence
```

### What each one does, character by character

```
lighthouse http://localhost:4173/login \
  --output=json \
  --output-path=../Lighthouse_Reports/lighthouse-login.json \
  --chrome-flags="--headless=new --no-sandbox" \
  --quiet
```

| Flag                                       | Meaning                                                                                |
| ------------------------------------------ | -------------------------------------------------------------------------------------- |
| `lighthouse <URL>`                         | Run the audit against this URL.                                                        |
| `--output=json`                            | Emit a JSON report (parseable, structured). HTML is also possible — see §9.            |
| `--output-path=…`                          | Where to write the report. The path is relative to `phenodeV3/` (where `npm run …` executes), so `../Lighthouse_Reports/…` resolves to `~/Coding/PheNode/Lighthouse_Reports/…`. |
| `--chrome-flags="--headless=new --no-sandbox"` | Tells the underlying Chrome launcher to run headless (no GUI). `--headless=new` uses Chrome's modern headless mode (the legacy `--headless` is deprecated in newer Chrome). `--no-sandbox` is needed in some sandboxed environments (CI containers) and harmless on macOS. |
| `--quiet`                                  | Suppress Lighthouse's own progress chatter. Errors still print.                        |

The `audit` script (no suffix) is just `audit:login && audit:register`
chained with `&&`, so register only runs if login succeeded.

---

## 6. The shell script — `scripts/lighthouse-audit.sh`

The script is what `make audit` calls. It exists as a separate file (not
inline in the Makefile) for two reasons:

- Makefile recipes execute each line in a separate shell unless you opt
  into `.ONESHELL:`. Background-process management (`&`, `$!`,
  `trap … EXIT`) is awkward across multiple shells.
- The script can be invoked directly without `make`:
  `bash scripts/lighthouse-audit.sh`. Useful in CI or one-offs.

Walking through what it does, by section:

**Resolve paths.** `REPO_ROOT` is computed from the script's own
location (`$(dirname "${BASH_SOURCE[0]}")/..`), so the script works no
matter where it's invoked from. `PHENODE_V3` and `REPORTS` are derived
from that.

**Set strict mode.** `set -euo pipefail` makes the script fail on any
unhandled error or undefined variable rather than continuing silently.

**Install deps if missing.** Checks for `node_modules/lighthouse`
specifically (not just `node_modules/`) so a partial install state still
triggers reinstall.

**Build.** `npm run build` produces `dist/`.

**Background the preview server.** `npm run preview > … 2>&1 &` runs
the server detached, with stdout+stderr redirected to a log file. `$!`
captures its PID into `PREVIEW_PID`.

**Set the cleanup trap.** `trap cleanup EXIT` registers a function
that's guaranteed to run when the script exits — for any reason
(success, failure, Ctrl-C). The function checks if the preview process
is still alive (`kill -0`) and kills it if so.

**Wait for readiness.** A 30-iteration loop hits `http://localhost:4173/`
with `curl -fsS` (`-f`: fail on HTTP errors, `-s`: silent, `-S`: still
show errors when silent). Sleeps 0.5s between attempts. Total wait
budget: 15 seconds.

**Run the two audits.** `npm run audit:login` and `npm run audit:register`
in sequence.

**Print summary.** `ls -la "$REPORTS"/*.json | awk` formats the report
files with sizes.

---

## 7. The Makefile target

```make
audit:
	@bash scripts/lighthouse-audit.sh
```

Two things to know:

- The `@` prefix suppresses Make's default echoing of the command. The
  script's own output is what you see.
- `audit` is registered in `.PHONY` so Make doesn't get confused into
  thinking there's a file called `audit` it should check timestamps on.

You can run the same thing with `bash scripts/lighthouse-audit.sh`
directly — `make audit` is just sugar.

---

## 8. Where reports land + the report folder convention

```
~/Coding/PheNode/
└── Lighthouse_Reports/
    ├── .gitignore               ← committed; ignores everything else
    ├── lighthouse-login.json    ← generated, ~2 MB
    └── lighthouse-register.json ← generated, ~2 MB
```

The `.gitignore` inside `Lighthouse_Reports/` is the standard
"track-the-folder-but-not-its-contents" pattern:

```gitignore
*
!.gitignore
```

Translated: ignore everything in this directory, then un-ignore the
`.gitignore` itself. Result: `git status` never shows the report
JSONs as new/changed, but the empty folder is still in the repo so
fresh clones don't have to `mkdir` it.

---

## 9. Reading the reports

Each JSON file is the full Lighthouse Report v5 schema — about 2 MB,
single-line. Useful sections:

- `categories.performance.score` — 0.0 to 1.0, multiply by 100 for the
  familiar 0–100 score.
- `categories.accessibility.score`, `categories.best-practices.score`,
  `categories.seo.score`.
- `audits` — every individual check, keyed by id. Each has a `score`,
  a `title`, a `description`, and `details` with specifics.
- `audits["largest-contentful-paint"].numericValue` — milliseconds.
- `audits["cumulative-layout-shift"].numericValue` — unitless score.
- `audits["unused-javascript"].details.items[]` — list of files with
  bytes-could-save numbers.

You can also generate an HTML report side-by-side by changing the
`--output=json` flag to `--output=json,html`. With both formats, the
`--output-path` is treated as a base path and Lighthouse appends
`.report.json` and `.report.html` to it. To switch to HTML-only:

```bash
lighthouse http://localhost:4173/login \
  --output=html \
  --output-path=../Lighthouse_Reports/lighthouse-login.html \
  --chrome-flags="--headless=new --no-sandbox" --view
```

The `--view` flag opens the HTML report in your default browser as soon
as the audit finishes.

---

## 10. Troubleshooting

**`Chrome not found` / `No usable sandbox`.** Install Google Chrome
from <https://www.google.com/chrome/>. The `chrome-launcher` library
that lighthouse depends on auto-detects an installed Chrome — there's
no path to configure manually if Chrome is in the standard
`/Applications/Google Chrome.app/`.

**`Preview server didn't come up within 15s`.** The shell script tails
`/tmp/phenode-lh-preview.log` automatically when this happens. Common
causes:

- Port 4173 is already in use. `lsof -i :4173` to see who. Kill them or
  change the port in `phenodeV3/vite.config.mjs`'s `preview.port`
  block.
- Vite build failed. The script runs `npm run build` before starting
  preview — if the build fails, the script exits there and never gets
  to the preview step. The build output is on stdout, not in the log
  file.

**`Audit took 5+ minutes`.** Lighthouse intentionally throttles to
emulate a slow mid-tier mobile device. If 5 minutes is too long for
your iteration loop, add `--throttling-method=devtools` (uses simulated
throttling instead of applied throttling, ~3× faster).

**JSON report is too big to read in chat.** Each report is ~2 MB. Don't
paste the raw file. Instead, use `jq` to extract just the categories:

```bash
jq '{
  performance: (.categories.performance.score * 100),
  accessibility: (.categories.accessibility.score * 100),
  bestPractices: (.categories["best-practices"].score * 100),
  seo: (.categories.seo.score * 100),
  failedAudits: [.audits | to_entries[] | select(.value.score != null and .value.score < 1) | .key]
}' Lighthouse_Reports/lighthouse-login.json
```

That gives a one-screen summary plus the list of failed audit IDs.

**Audit fails with `NO_NAVSTART` / `NO_FCP`.** Usually means Chrome
crashed or the page didn't render. Open the URL in regular Chrome to
verify the page actually loads, then re-run.

---

## 11. Extending the setup

### Add a new route to audit

1. Add an npm script in `phenodeV3/package.json`:
   ```json
   "audit:approval-pending": "lighthouse http://localhost:4173/approval-pending --output=json --output-path=../Lighthouse_Reports/lighthouse-approval-pending.json --chrome-flags=\"--headless=new --no-sandbox\" --quiet",
   ```
2. Update the chained `audit` script to include it:
   ```json
   "audit": "npm run audit:login && npm run audit:register && npm run audit:approval-pending",
   ```
3. The Makefile target still works as-is (it just calls `audit` via the
   shell script's `npm run audit:login && npm run audit:register`
   sequence — adjust the script if you want it to call the chained
   `audit` script instead of named ones individually).

### Audit an authenticated route

Authenticated routes (e.g. `/dashboard/fleet-overview`) need a session.
Lighthouse's `--extra-headers` flag lets you inject an
`Authorization: Bearer <token>` header. Or, store a sign-in cookie via
a Puppeteer pre-step. This is non-trivial; bring it up when you actually
need it and we'll wire it up properly.

### Run Lighthouse against production (not local preview)

```bash
cd phenodeV3
lighthouse https://phenode.live/login \
  --output=json \
  --output-path=../Lighthouse_Reports/lighthouse-login-prod.json \
  --chrome-flags="--headless=new"
```

Production audits include real network latency and TLS handshake time —
useful for measuring what users actually feel.

### Run in CI

Lighthouse has an official CI tool: `@lhci/cli`. It runs Lighthouse on
every PR, posts the scores to the PR description, and can fail the
build under threshold. Setup is a few lines of YAML; not yet wired in
this repo.

---

## 12. Quick reference

| Want to…                                 | Run                                          |
| ---------------------------------------- | -------------------------------------------- |
| Audit both `/login` and `/register`       | `make audit`                                 |
| Audit one route (preview already running) | `cd phenodeV3 && npm run audit:login`        |
| See report scores                        | `jq '{performance: (.categories.performance.score * 100)}' Lighthouse_Reports/lighthouse-login.json` |
| Open the report visually                 | Use the [Lighthouse Viewer](https://googlechrome.github.io/lighthouse/viewer/) and drag the JSON in |
| Re-build dependencies                    | `cd phenodeV3 && npm install`                |
| Find what's listening on :4173           | `lsof -i :4173`                              |
| Stop a stuck preview server              | `pkill -f "vite preview"`                    |
