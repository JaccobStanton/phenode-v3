#!/usr/bin/env node
// =============================================================================
// dev-login.mjs — open Chrome and auto-fill the PheNode login on localhost.
// =============================================================================
// Convenience for local dev so you don't paste the long superuser password
// every time. Credentials are NOT stored in this file — they come from:
//   1. env vars PHENODE_DEV_USER / PHENODE_DEV_PASS, or
//   2. a `.phenode_dev_login` file (KEY=VALUE) found by walking up from here.
// The creds file lives OUTSIDE the git repos and is chmod 600.
//
// Run:  node scripts/dev-login.mjs        (from phenode_frontend/)
// Env:  PHENODE_DEV_URL  (default http://localhost:3000)
//       CHROME_PATH      (override Chrome executable if auto-detect fails)
// Uses puppeteer-core (already a dependency) driving your installed Chrome.

import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_URL = process.env.PHENODE_DEV_URL || 'http://localhost:3000';

function findCredsFile() {
  let dir = __dirname;
  for (let i = 0; i < 8; i += 1) {
    const f = path.join(dir, '.phenode_dev_login');
    if (fs.existsSync(f)) return f;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadCreds() {
  let user = process.env.PHENODE_DEV_USER;
  let pass = process.env.PHENODE_DEV_PASS;
  if (!user || !pass) {
    const f = findCredsFile();
    if (f) {
      for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*(PHENODE_DEV_USER|PHENODE_DEV_PASS)\s*=\s*(.*?)\s*$/);
        if (!m) continue;
        if (m[1] === 'PHENODE_DEV_USER') user = user || m[2];
        else pass = pass || m[2];
      }
    }
  }
  return { user, pass };
}

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser'
  ];
  return candidates.find((c) => fs.existsSync(c)) || null;
}

const { user, pass } = loadCreds();
if (!user || !pass) {
  console.error('✗ Missing credentials. Set PHENODE_DEV_USER/PHENODE_DEV_PASS or create a .phenode_dev_login file.');
  process.exit(1);
}
const chrome = findChrome();
if (!chrome) {
  console.error('✗ Could not locate Chrome. Set CHROME_PATH=/path/to/Chrome and retry.');
  process.exit(1);
}

const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: false,
  defaultViewport: null,
  // Dedicated throwaway profile so this never touches your real Chrome profile,
  // and so the session persists between runs (you stay logged in).
  userDataDir: path.join(os.tmpdir(), 'phenode-dev-chrome'),
  args: ['--no-first-run', '--no-default-browser-check', '--start-maximized']
});
browser.on('disconnected', () => process.exit(0));

const page = (await browser.pages())[0] ?? (await browser.newPage());
try {
  await page.goto(`${APP_URL}/login`, { waitUntil: 'domcontentloaded', timeout: 20000 });
} catch {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => {});
}

const emailSel = 'input[name="email"]';
const passSel = 'input[name="password"]';
const formReady = await page.waitForSelector(emailSel, { timeout: 8000 }).catch(() => null);

if (formReady) {
  await page.click(emailSel, { clickCount: 3 });
  await page.type(emailSel, user, { delay: 8 });
  await page.type(passSel, pass, { delay: 8 });
  const submit = await page.$('button[type="submit"]');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {}),
    submit ? submit.click() : page.keyboard.press('Enter')
  ]);
  console.log(`✓ Submitted login as ${user}. Chrome should now be on the dashboard.`);
} else {
  console.log('✓ Login form not present — you appear to be already logged in (persistent profile).');
}
console.log('Leave this terminal open. Close the Chrome window (or press Ctrl+C) when you are done.');
