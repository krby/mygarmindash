# sync — local SQLite → Turso

## First-time setup

Requires [uv](https://docs.astral.sh/uv/). `uv sync` creates `.venv` and installs
deps from `pyproject.toml`; `uv run` resolves that env from the project directory,
so there's no venv to activate.

```sh
uv sync                                    # create .venv + install deps
copy .env.example .env                     # then fill in TURSO_URL + TURSO_AUTH_TOKEN

uv run sync_to_cloud.py --init-schema      # creates tables on Turso from local DDL
uv run sync_to_cloud.py --discover-tables  # prints any tables not in config.toml
# Review config.toml, classify each unclassified table as incremental or replace.

uv run sync_to_cloud.py                    # initial backfill (may take a few minutes)
uv run sync_to_cloud.py --status           # confirm local vs remote counts match
```

## Daily use

```sh
uv run sync_to_cloud.py                  # incremental; runs in seconds when caught up
uv run sync_to_cloud.py --tables sleep,activity  # subset
uv run sync_to_cloud.py --full           # re-push everything (rarely needed)
uv run sync_to_cloud.py --status
```

## Windows Task Scheduler

1. Run `garmin-givemydata` daily at your chosen time (it sets up its own task).
2. Import `scheduled-task.xml` to run this script 30 minutes later. Or add manually:
   - **Trigger:** daily, 30 min after step 1
   - **Action:** `<repo>\sync\.venv\Scripts\python.exe` (created by `uv sync`) with argument `<repo>\sync\sync_to_cloud.py`
   - **Start in:** `<repo>\sync`
   - **Settings:** *Run task as soon as possible after a scheduled start is missed* = on
3. Edit `scheduled-task.xml` paths to your install location before importing.

## Logs

`logs/sync.log`, rotated manually. Failures also go to stderr (visible in Task
Scheduler's Last Run Result and event history).
