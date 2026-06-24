# My Garmin Dash

Personal PWA over your own Garmin Connect data. Daily sync from local `garmin.db` (via [`garmin-givemydata`](https://github.com/nrvim/garmin-givemydata)) to Turso, served by a Cloudflare Worker, displayed by a React PWA with interactive Chart.js visualizations.

## Architecture

The laptop can be off and the dashboard still works as data lives in the cloud (sqlite host Turso)


```
┌──────────────┐   garmin-givemydata    ┌──────────┐
│ Garmin Connect│ ─────────────────────▶ │ garmin.db│  (local SQLite)
└──────────────┘                         └────┬─────┘
                                              │ sync/  (daily, Python)
                                              ▼
                                         ┌──────────┐
                                         │  Turso   │  (libSQL, cloud)
                                         └────┬─────┘
                                              │ read-only SQL
                                              ▼
   phone ──HTTPS──▶  ┌──────────────────────────────┐
                     │ worker/  Cloudflare Worker    │
                     │  • bearer-auth read-only API  │
                     │  • static host for the PWA    │
                     └──────────────┬───────────────┘
                                    │ serves
                                    ▼
                              ┌──────────┐
                              │  pwa/    │  React + TanStack Query + Chart.js
                              └──────────┘
```

This repo is the three boxes with trailing slashes; everything else (Garmin Connect, `garmin.db`, Turso) is external.

- **sync/** — Python job: pushes the local `garmin.db` to Turso daily. Runs on the laptop when it's on.
- **worker/** — Cloudflare Worker: read-only, bearer-token API over Turso plus static host for the PWA. One deploy unit.
- **pwa/** — React PWA: offline-capable dashboard with cached queries and interactive charts. Installable on mobile.


## Setup

### 1. Turso

```sh
turso db create mygarmindash
turso db show mygarmindash --url             # → TURSO_URL  (prints libsql://…)
turso db tokens create mygarmindash          # → TURSO_AUTH_TOKEN
```

### 2. Sync

```sh
cd sync
uv sync                                      # creates .venv + installs deps (needs uv: https://docs.astral.sh/uv/)
copy .env.example .env                       # then edit and fill in TURSO_URL + TURSO_AUTH_TOKEN
uv run sync_to_cloud.py --init-schema        # first-run only
uv run sync_to_cloud.py --discover-tables    # one-time: prints unclassified tables
# review config.toml, classify any missing tables
uv run sync_to_cloud.py                      # initial backfill
uv run sync_to_cloud.py --status             # sanity check
```

### 3. Worker + PWA

```sh
cd worker
npm install
npx wrangler secret put TURSO_URL
npx wrangler secret put TURSO_AUTH_TOKEN
npx wrangler secret put APP_TOKEN            # generate with: openssl rand -hex 32

cd ../pwa
npm install
npm run build                                # outputs to ../worker/dist/pwa via vite config

cd ../worker
npx wrangler deploy
```

### 4. Open on phone

Visit the Worker URL on Android. In Settings, paste your `APP_TOKEN`. The Home view should show your latest strength workout.

### 5. Schedule daily sync 

#### Windows
Import `sync/scheduled-task.xml` into Task Scheduler, or create manually.

- The expectation is that `garmin-givemydata` runs daily at your chosen time.
- `sync_to_cloud.py` 15 minutes after (uses `.venv\Scripts\python.exe`, created by `uv sync`).


## Local development (offline, against your local garmin.db)

For PWA dev without touching Turso cloud, run `turso dev` as a libSQL HTTP gateway in front of your local `garmin.db`
The Worker code is identical to production and only the URL changes.

**Quick start (Windows):** `.\dev.ps1` does all three steps below in one shot.
Override the db with `.\dev.ps1 -DbFile <path>`. If a run dies uncleanly, a stray `turso dev` can hog port 8080 
Clear it with `wsl -d Ubuntu -- pkill -f 'turso dev'`.

The manual steps (what the script automates):
```sh
# 1. Install the Turso CLI once.
#    https://docs.turso.tech/cli/installation
#    note `turso` has no native Windows build so it uses WSL
turso dev --db-file [path-to-garmin.db]
# serves libSQL at http://127.0.0.1:8080

# 2. Worker (in a second terminal)
cd worker
npm install
npx wrangler dev          # reads worker/.dev.vars

# 3. PWA (in a third terminal)
cd pwa
npm install
npm run dev               # http://127.0.0.1:5173 — Vite proxies /api → :8787
```

Then open the PWA, go to **Settings**, and paste the dev `APP_TOKEN`
(defaults to `devtoken` in [worker/.dev.vars](worker/.dev.vars)).

`worker/.dev.vars` is git-ignored; edit it locally to change the dev token
or point at a different db.

The garmin.db cannot be in WAL mode (such as when open in DBeaver)


## Testing

Each component has its own suite (per-toolchain). They run against small synthetic fixtures never the real garmin.db

```sh
cd sync   && uv run pytest        # sync sequence: schema, idempotency, watermark, deltas
cd worker && npm test             # bearer-auth gate + query helpers (clampDays, metric registry)
cd pwa    && npm test             # garmin.ts derivations + format.ts conversions
```

## Follow-ups / known limitations

- **Upstream patch: promote `raw_json` fields to typed columns in
  `garmin-givemydata`.** Several `garmin.db` tables leave useful data buried in
  `raw_json` even though typed columns exist for it. Concrete known cases:
  - `activity_exercise_sets.exercise_name` / `exercise_category` are NULL on
    every row, but `raw_json.exercises[0].category` has the exercise
    (`SHOULDER_PRESS`, `CURL`, `ROW`, …) and `raw_json.setType` has
    `ACTIVE` / `REST`. Fix at write time in the garmin-givemydata fork.
  - Audit other tables (`activity`, `sleep`, etc.) for the same pattern —
    one survey pass, then a single coherent patch upstream.
  - PWA currently parses these out in [pwa/src/lib/garmin.ts](pwa/src/lib/garmin.ts)
    as a **stopgap**. Once the columns are populated upstream, drop the
    parsing helpers and read the typed columns directly.
  - High-cardinality timeseries (per-minute sleep stages, body battery curve,
    FIT streams) should NOT be promoted — those need a dedicated timeseries
    table, not column explosion.

- **Sync watermarks for activity-child tables.** `activity_splits`,
  `activity_hr_zones`, `activity_weather`, `activity_exercise_sets` have no
  date column — currently classified as `replace` in [sync/config.toml](sync/config.toml),
  which means full re-insert each run. Replace with per-activity child sync
  driven by the parent `activity` watermark.

- **Upstream patch: tz-aware activity timestamp column.** `activity.start_time_local`
  and `start_time_gmt` are both naive strings (`YYYY-MM-DD HH:MM:SS`, no offset).
  The Worker filters on `start_time_gmt` to keep day-boundary comparisons in UTC
  ([worker/src/queries.ts](worker/src/queries.ts) `activities()`), but **display**
  still uses `start_time_local` and JS `new Date()` interprets that string in the
  *viewer's* tz, not the activity's tz. For non-travelers this is invisible. For
  travelers it shifts the displayed wall-clock by their offset delta. Real fix:
  promote `raw_json.timezoneOffset` (or recompute from `beginTimestamp`) to a
  typed column in the garmin-givemydata fork, sync it, then format with that
  offset in [pwa/src/lib/format.ts](pwa/src/lib/format.ts). Bundle with the
  `raw_json → typed columns` patch above.

