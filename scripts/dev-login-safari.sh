#!/usr/bin/env bash
# =============================================================================
# dev-login-safari.sh — open Safari and auto-fill the PheNode login (localhost).
# =============================================================================
# Safari can't be driven by Puppeteer (no DevTools Protocol), so this uses
# AppleScript to open your REAL Safari and inject the form-fill via JavaScript.
#
# ONE-TIME SETUP (required for AppleScript -> JS):
#   1. Safari ▸ Settings ▸ Advanced ▸ check "Show features for web developers".
#   2. Develop menu ▸ check "Allow JavaScript from Apple Events".
#   3. On first run macOS prompts to let your terminal control Safari — Allow.
#
# Credentials come from env (PHENODE_DEV_USER / PHENODE_DEV_PASS) or the
# .phenode_dev_login file found by walking up from this script.
# Env: PHENODE_DEV_URL (default http://localhost:3000)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE="${PHENODE_DEV_URL:-http://localhost:3000}"
URL="${BASE%/}/login"
# host:port used to find an already-open Safari tab on the dev server (any path)
MATCH="${BASE#*://}"; MATCH="${MATCH%%/*}"

USER_VAL="${PHENODE_DEV_USER:-}"
PASS_VAL="${PHENODE_DEV_PASS:-}"
if [[ -z "$USER_VAL" || -z "$PASS_VAL" ]]; then
  d="$SCRIPT_DIR"
  for _ in 1 2 3 4 5 6 7 8; do
    if [[ -f "$d/.phenode_dev_login" ]]; then
      creds="$d/.phenode_dev_login"
      [[ -z "$USER_VAL" ]] && USER_VAL="$(grep -E '^PHENODE_DEV_USER=' "$creds" | head -1 | cut -d= -f2-)"
      [[ -z "$PASS_VAL" ]] && PASS_VAL="$(grep -E '^PHENODE_DEV_PASS=' "$creds" | head -1 | cut -d= -f2-)"
      break
    fi
    d="$(dirname "$d")"
  done
fi
if [[ -z "$USER_VAL" || -z "$PASS_VAL" ]]; then
  echo "✗ Missing credentials. Set PHENODE_DEV_USER/PHENODE_DEV_PASS or create a .phenode_dev_login file." >&2
  exit 1
fi

# Build the form-fill JS in bash (single-quoted JS strings; values interpolated).
# NOTE: assumes username/password contain no single quotes or backslashes
# (true for the current creds). React/MUI inputs need the native value setter +
# an 'input' event so onChange fires, hence the descriptor dance.
read -r -d '' JS <<JSEOF || true
(function(){
  function setVal(sel, val){
    var el = document.querySelector(sel);
    if(!el) return false;
    var setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
    setter.call(el, val);
    el.dispatchEvent(new Event('input',{bubbles:true}));
    return true;
  }
  var a = setVal('input[name=email]','${USER_VAL}');
  var b = setVal('input[name=password]','${PASS_VAL}');
  var btn = document.querySelector('button[type=submit]');
  if(a && b && btn){ btn.click(); return 'submitted'; }
  return 'form-not-found';
})();
JSEOF

osascript - "$URL" "$JS" "$MATCH" <<'OSA'
on run {theURL, theJS, theMatch}
  tell application "Safari"
    activate
    set theTab to missing value
    -- Reuse a tab already on the dev server (any window) instead of opening a
    -- new window. Match on host:port so any path on localhost:3000 counts.
    repeat with w in windows
      repeat with t in tabs of w
        try
          if (URL of t) contains theMatch then
            set theTab to t
            set current tab of w to t
            set index of w to 1
            exit repeat
          end if
        end try
      end repeat
      if theTab is not missing value then exit repeat
    end repeat
    -- Nothing open on the dev server yet -> open one tab/window.
    if theTab is missing value then
      make new document with properties {URL:theURL}
      set theTab to current tab of front window
    end if
    repeat 40 times
      try
        if (do JavaScript "document.readyState" in theTab) is "complete" then exit repeat
      end try
      delay 0.5
    end repeat
    delay 0.5
    do JavaScript theJS in theTab
  end tell
end run
OSA

echo "✓ Triggered Safari login as ${USER_VAL} (if the login form was present)."
