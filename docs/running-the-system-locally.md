# Running PheNode Locally — Login Setup

**Status:** All bootstrap pieces are already wired up. From a clean clone
you can bring the full stack up with a single `make up` and sign in
end-to-end — either against the local docker stack or directly against
the production API.

**Scope:** This guide assumes Docker, Node 20+, and `npm` are installed,
and that both `phenodeV3` and `phenodeX` live under `~/Coding/PheNode/`.

---

## ⚠️ Vital — picking the API base URL

Both local and production mount every API route under `/api` (no
version segment). The two `VITE_API_URL` candidates are:

| Environment | Base URL                          |
| ----------- | --------------------------------- |
| Local       | `http://localhost:8000/api`       |
| Production  | `https://phenode.live/api`       |

Confirmed in `phenodeX/docs/frontend-backend-api.md` ("Production API
base URL: `https://phenode.live/api`") and in
`phenodeX/phenode_backend/core/config.py`
(`api_v1_prefix: str = "/api"` — the variable name is misleading, but
the value is just `/api`). There is no `/v1` segment in either
environment; every router is mounted directly under `/api` in
`phenodeX/phenode_backend/main.py`.

> Earlier guidance suggested the production base was
> `https://phenode.live/api/v1`. That was incorrect — that URL returns
> 404. The docs and config are the source of truth.

**Where this is set:** `phenodeV3/.env` has both URLs documented at the
top of the file. One line is active, the other is commented. To switch:
flip the comment, then **restart the vite dev server** (Vite reads
`.env` only at startup).

```env
## --- LOCAL (docker compose stack in phenodeX) -------------------------------
# VITE_API_URL = http://localhost:8000/api

## --- PRODUCTION (phenode.live) ---------------------------------------------
VITE_API_URL = https://phenode.live/api
```

**CORS caveat for production from localhost:** Hitting `phenode.live`
from a `localhost:3000` page is a cross-origin request. The local
backend has `localhost:3000` whitelisted in
`Settings.cors_allow_origins`, but production does not. If you get a
preflight CORS error in DevTools, the backend team needs to add
`http://localhost:3000` to the production CORS allowlist.

**Production data warning:** When pointed at the production URL, every
request hits real production records and tokens. Use a non-production
account for testing or switch to local.

---

## What's already in place

The repo ships with all the glue needed to run locally:

- **Root `Makefile`** — `make up`, `make backend`, `make frontend`,
  `make stop`, `make logs`, `make health`, `make signup`, `make clean`.
- **Root `README.md`** — quick reference for the make targets.
- **`phenodeV3/.env`** has both `VITE_API_URL` candidates documented
  (local and production). Production is the active default — flip the
  comment to point at the local docker stack.
- **`phenodeV3/package.json`** has both a `dev` and `start` script
  pointing at vite, so either `npm run dev` or `npm run start` works.
- **`phenodeX/.env.local`** is auto-seeded from `.env.example` the first
  time you run `make backend` or `make up` — no manual prep.
- **CORS** in the local `phenodeX` config already allows
  `http://localhost:3000` (V3 dev port) and `http://localhost:3002`
  (legacy frontend). Production allowlist is managed separately.
- **`phenodeV3/src/sections/auth/AuthLogin.jsx`** is wired to
  `${VITE_API_URL}/auth/login`. 200 stores both tokens in
  `localStorage` and routes to `/dashboard/fleet-overview`; 403 with a
  pending-approval detail routes to `/approval-pending`; 401/other
  failures render an inline themed `Alert`.

---

## TL;DR

### Against production (default)

`phenodeV3/.env` already points at `https://phenode.live/api`. So:

```bash
cd ~/Coding/PheNode
make frontend            # vite on http://localhost:3000
# → log in with your real production credentials
```

`make backend` is unnecessary for prod — you're hitting `phenode.live`,
not the local docker stack.

### Against local docker stack

```bash
# 1. Edit phenodeV3/.env — comment the production line, uncomment the local one.
cd ~/Coding/PheNode
make up                  # backend (detached) + frontend (foreground)
make signup              # create a SUPER_ADMIN test account
# → open http://localhost:3000, log in with that account
```

That's it. The rest of this doc is detail for when you need it.

---

## 1. `make up` — bring the local stack online

```bash
cd ~/Coding/PheNode
make up
```

What this does, in order:

1. If `phenodeX/.env.local` doesn't exist, it's seeded from `.env.example`.
2. The backend stack comes up in the background via
   `docker compose --profile local up --build -d api worker db redis minio`.
3. If `phenodeV3/node_modules` is missing, `npm install` runs.
4. The V3 dev server starts in the foreground on
   <http://localhost:3000>. Ctrl-C stops the frontend; the backend keeps
   running so subsequent `make frontend` calls are instant.

Useful URLs while it's up:

| Service          | URL                                |
| ---------------- | ---------------------------------- |
| V3 frontend      | <http://localhost:3000>            |
| Backend API      | <http://localhost:8000>            |
| Swagger UI       | <http://localhost:8000/docs>       |
| Postgres         | `localhost:5432` (postgres/postgres) |
| MinIO console    | <http://localhost:9001>            |

Health check from another shell:

```bash
make health
# → {"status":"ok","environment":"local"}
```

> **Reminder:** if `phenodeV3/.env` is pointed at production, the V3
> frontend won't talk to your local docker backend even when it's
> running. Flip the comment in `.env` and restart vite to switch.

---

## 2. `make signup` — create a test account (local only)

The login endpoint compares the submitted password against
`user.password_hash`. If your DB row was created via Google sign-in
historically, the hash will be `NULL` and login will fail. Fastest way to
get a usable account is the signup target:

```bash
make signup
```

That POSTs to `http://localhost:8000/api/auth/signup` (always local —
the Makefile target hard-codes the local URL) with the defaults baked in:

```
email:    jake@phenode.com
password: changeme123
full_name: Jake Stanton
```

Override any of them on the CLI:

```bash
make signup SIGNUP_EMAIL=alice@phenode.com SIGNUP_PASSWORD=hunter2 \
            SIGNUP_NAME="Alice Example"
```

Possible responses:

| Backend response                                      | Meaning                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `201` with `access_token` + `refresh_token`            | New user. Email is in `SUPER_ADMIN_EMAILS`, so auto-approved.          |
| `201` with `status: "pending_approval"` and no tokens  | New user but needs admin approval (regular non-super-admin path).      |
| `409` "An account already exists for this email…"      | Email already in DB. Use a different email or set the password via SQL — see below. |

> **Don't run `make signup` against production.** It's hard-coded to the
> local backend on purpose so you can't accidentally create test
> accounts on `phenode.live`. To create a real production account, talk
> to the backend team or use the production signup flow.

### If you hit a 409

The row exists with no `password_hash`. Two options:

**A. Pick a different email.** Easiest. Re-run `make signup` with
`SIGNUP_EMAIL=…`.

**B. Set a password on the existing row.** Generate a bcrypt hash inside
the running api container:

```bash
docker compose -f phenodeX/docker-compose.yml exec api python -c \
  "from phenode_backend.core.security import hash_password; \
   print(hash_password('your-strong-password'))"
```

Then update the row:

```bash
docker compose -f phenodeX/docker-compose.yml exec db \
  psql -U postgres -d phenode -c \
  "UPDATE users SET password_hash = '<paste-the-hash>' \
   WHERE email = 'jake@phenode.com';"
```

Only `email` + `password_hash` are read by `POST /api/auth/login`.

---

## 3. Sign in

1. Open <http://localhost:3000/> — you'll bounce to `/login`.
2. Type the email + password from step 2 (local) or your real production
   credentials.
3. Click **Login**.

| Result                                              | Backend response | UX                                                                     |
| --------------------------------------------------- | ---------------- | ---------------------------------------------------------------------- |
| ✅ Approved sign-in                                  | `200`            | `access_token` + `refresh_token` saved to `localStorage`; redirect to `/dashboard/fleet-overview`. |
| ❌ Wrong password / unknown email                   | `401`            | Inline red Alert: "Invalid email or password."                         |
| ⏳ Account pending approval                         | `403`            | Redirect to `/approval-pending` (polls `/api/user/devices` every 10s, routes onward when approved). |
| 💀 Network or CORS error                            | `fetch` rejects  | Inline red Alert: "Network error — please try again."                  |

Verify tokens persisted: DevTools → **Application** → **Local Storage**
→ `http://localhost:3000`. You should see `access_token` and
`refresh_token` keys.

The full URL the form posts to depends on `VITE_API_URL`:

- Local mode: `POST http://localhost:8000/api/auth/login`
- Production mode: `POST https://phenode.live/api/auth/login`

---

## Lifecycle reference

| Command          | What it does                                                              |
| ---------------- | ------------------------------------------------------------------------- |
| `make up`        | Local backend (detached) + frontend (foreground).                         |
| `make backend`   | Local backend stack only.                                                 |
| `make frontend`  | V3 dev server only. Targets whatever `VITE_API_URL` points at.            |
| `make stop`      | Stop the docker stack (volumes preserved).                                |
| `make logs`      | Tail the local backend `api` logs.                                        |
| `make health`    | Curl the local `/healthz`.                                                |
| `make signup`    | POST to local `/api/auth/signup`. Override defaults via env vars.          |
| `make clean`     | Stop + wipe docker volumes (full reset).                                  |
| `make install`   | npm install in V3 only (rarely needed; the other targets do it for you).  |

---

## Common gotchas

- **CORS error in console.** Means the backend isn't where `VITE_API_URL`
  thinks it is, or the origin isn't in the backend's allowlist. Local
  backend has `localhost:3000` allowlisted; production allowlist is
  managed by the backend team.
- **404 on `/auth/login`.** Means `VITE_API_URL` is missing the `/api`
  suffix or you typed `/auth/login/` with a trailing slash. Both local
  and production mount the API at `/api` — there is no `/v1` segment.
- **Vite ignored an env update.** It reads `.env*` only at startup —
  Ctrl-C the dev server and run `make frontend` again.
- **`verify_password` always fails.** Means the user row exists but has
  no `password_hash`. See step 2 → "If you hit a 409".
- **`docker compose` not found.** You're on an older Docker Desktop. The
  Makefile assumes Compose v2 plugin syntax (`docker compose …` not
  `docker-compose …`). Update Docker Desktop.

---

## Out of scope (not yet wired)

- **Google OAuth.** The button currently logs to the console. Wiring it
  requires adding an `/oauth/callback` page in V3 that reads `?token=…`,
  POSTs it to `/auth/token`, and dispatches via the same matrix as the
  email/password flow.
- **Token refresh on 401.** Once an `AuthContext` is added in V3, it
  should hit `POST /auth/refresh` with the stored `refresh_token` and
  retry the original request transparently.
- **Email/password signup UI.** The `/register` page is currently a
  Google-only CTA. The backend supports `POST /auth/signup` already
  (the `make signup` target proves it); adding the form is a
  straightforward follow-up.
