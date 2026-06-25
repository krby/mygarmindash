#!/usr/bin/env python3
"""Push new rows from the local garmin.db (SQLite) up to Turso (libSQL).

Runs daily on the laptop after garmin-givemydata refreshes garmin.db, so the
PWA can read the data while the laptop is off. Idempotent and resumable: state
lives only in the remote, never locally.

How it works:
  - The local DB is opened read-only (`mode=ro`); reads retry with exponential
    backoff on `database is locked`, since garmin-givemydata may still be
    writing.
  - The remote schema is bootstrapped from the local `sqlite_master` DDL
    (`--init-schema`); libSQL accepts SQLite DDL verbatim, so no translation.
  - Tables are classified in config.toml as either *incremental* (a monotonic
    date column; sync rows newer than the remote `MAX(col)` watermark) or
    *replace* (small lookup / activity-child tables; wipe and re-insert).
    Unclassified local tables are reported and skipped — run
    `--discover-tables` and classify them explicitly.
  - Writes go in batches; a failed batch is retried row-by-row and bad rows are
    skipped and logged rather than aborting the whole run.

Secrets (TURSO_URL, TURSO_AUTH_TOKEN) come from .env; structure (batch size,
table classes) from config.toml. See CLAUDE.md for the operational conventions.

Usage:
    uv run sync_to_cloud.py --init-schema       # first run: create remote tables
    uv run sync_to_cloud.py --discover-tables   # list tables not yet in config
    uv run sync_to_cloud.py                      # incremental sync (the daily run)
    uv run sync_to_cloud.py --full               # re-push every row
    uv run sync_to_cloud.py --tables sleep,activity
    uv run sync_to_cloud.py --status             # local vs. remote row counts

Exit codes: 0 ok; 1 a table failed; 2 missing config (no garmin.db / no creds).
"""

from __future__ import annotations

import argparse
import logging
import os
import re
import sqlite3
import sys
import time
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

try:
    import tomllib
except ImportError:
    import tomli as tomllib  # type: ignore

import libsql_client
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent
DEFAULT_GARMIN_DIR = Path.home() / ".garmin-givemydata"

logger = logging.getLogger("sync")


def load_config(path: Path) -> dict:
    with path.open("rb") as f:
        return tomllib.load(f)


def setup_logging(log_path: Path, level: str) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    fmt = "%(asctime)s %(levelname)s %(message)s"
    handlers: list[logging.Handler] = [
        logging.FileHandler(log_path, encoding="utf-8"),
        logging.StreamHandler(sys.stderr),
    ]
    logging.basicConfig(level=level.upper(), format=fmt, handlers=handlers)


_IDENT = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def qident(name: str) -> str:
    if not _IDENT.match(name):
        raise ValueError(f"unsafe SQL identifier: {name!r}")
    return f'"{name}"'


class LocalDB:
    """Read-only handle to garmin.db with explicit retry on busy/locked.

    SQLite's built-in timeout already covers most cases, but garmin-givemydata
    may hold a writer lock during commit while we're reading. The explicit
    backoff loop lets the sync run while garmin-givemydata is still finishing.
    """

    def __init__(self, db_path: Path, timeout: float = 30.0,
                 max_retries: int = 6, base_backoff: float = 0.5) -> None:
        self.path = db_path
        self.max_retries = max_retries
        self.base_backoff = base_backoff
        uri = f"file:{db_path.as_posix()}?mode=ro"
        self.conn = sqlite3.connect(uri, uri=True, timeout=timeout)
        self.conn.row_factory = sqlite3.Row

    def execute(self, sql: str, params: tuple = ()) -> sqlite3.Cursor:
        for attempt in range(self.max_retries):
            try:
                return self.conn.execute(sql, params)
            except sqlite3.OperationalError as e:
                msg = str(e).lower()
                if "locked" not in msg and "busy" not in msg:
                    raise
                wait = self.base_backoff * (2 ** attempt)
                logger.warning("local DB busy (try %d/%d, sleep %.2fs): %s",
                               attempt + 1, self.max_retries, wait, e)
                time.sleep(wait)
        raise sqlite3.OperationalError(
            f"local DB still busy after {self.max_retries} retries: {sql[:80]}")

    def close(self) -> None:
        self.conn.close()

    def __enter__(self) -> "LocalDB":
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()


@contextmanager
def open_remote(url: str, token: str) -> Iterator[Any]:
    client = libsql_client.create_client_sync(url=url, auth_token=token)
    try:
        yield client
    finally:
        try:
            client.close()
        except Exception:
            pass


def enumerate_tables(local: LocalDB) -> dict[str, str]:
    rows = local.execute(
        "SELECT name, sql FROM sqlite_master "
        "WHERE type='table' AND name NOT LIKE 'sqlite_%'"
    ).fetchall()
    return {r["name"]: r["sql"] for r in rows if r["sql"]}


def get_columns(local: LocalDB, table: str) -> list[str]:
    rows = local.execute(f"PRAGMA table_info({qident(table)})").fetchall()
    return [r["name"] for r in rows]


# ── DDL ───────────────────────────────────────────────────────────────────────

_CREATE_TABLE_RE = re.compile(r"^\s*CREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS)", re.IGNORECASE)
_CREATE_INDEX_RE = re.compile(r"^\s*CREATE\s+(UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS)",
                              re.IGNORECASE)


def _idempotent_ddl(sql: str) -> str:
    if _CREATE_TABLE_RE.match(sql):
        return _CREATE_TABLE_RE.sub("CREATE TABLE IF NOT EXISTS ", sql, count=1)
    if _CREATE_INDEX_RE.match(sql):
        return _CREATE_INDEX_RE.sub(
            lambda m: f"CREATE {m.group(1) or ''}INDEX IF NOT EXISTS ",
            sql, count=1)
    return sql


# ── Sync strategies ───────────────────────────────────────────────────────────

def _flush(remote: Any, insert_sql: str, batch: list[list[Any]],
           table: str) -> tuple[int, int]:
    if not batch:
        return 0, 0
    try:
        stmts = [libsql_client.Statement(insert_sql, args=row) for row in batch]
        remote.batch(stmts)
        return len(batch), 0
    except Exception as e:
        logger.warning("[%s] batch failed (%s); retrying row-by-row", table, e)
        ok = fail = 0
        for row in batch:
            try:
                remote.execute(insert_sql, row)
                ok += 1
            except Exception as inner:
                fail += 1
                logger.warning("[%s] skipping row: %s", table, inner)
        return ok, fail


def sync_incremental(local: LocalDB, remote: Any, table: str, ts_col: str,
                     columns: list[str], batch_size: int,
                     full: bool) -> tuple[int, int]:
    qt = qident(table)
    qc = qident(ts_col)

    watermark = None
    if not full:
        rs = remote.execute(f"SELECT MAX({qc}) FROM {qt}")
        if rs.rows and rs.rows[0][0] is not None:
            watermark = rs.rows[0][0]
            logger.info("[%s] watermark %s = %s", table, ts_col, watermark)
        else:
            logger.info("[%s] no watermark on remote — initial backfill", table)

    cols_sql = ", ".join(qident(c) for c in columns)
    if watermark is None:
        cur = local.execute(f"SELECT {cols_sql} FROM {qt}")
    else:
        cur = local.execute(
            f"SELECT {cols_sql} FROM {qt} WHERE {qc} > ? ORDER BY {qc} ASC",
            (watermark,),
        )

    placeholders = ", ".join("?" for _ in columns)
    insert_sql = f"INSERT OR IGNORE INTO {qt} ({cols_sql}) VALUES ({placeholders})"

    total = skipped = 0
    batch: list[list[Any]] = []
    for row in cur:
        batch.append([row[c] for c in columns])
        if len(batch) >= batch_size:
            ok, fail = _flush(remote, insert_sql, batch, table)
            total += ok
            skipped += fail
            batch = []
    if batch:
        ok, fail = _flush(remote, insert_sql, batch, table)
        total += ok
        skipped += fail

    logger.info("[%s] incremental: inserted=%d skipped=%d", table, total, skipped)
    return total, skipped


def sync_replace(local: LocalDB, remote: Any, table: str, columns: list[str],
                 batch_size: int) -> tuple[int, int]:
    qt = qident(table)
    cols_sql = ", ".join(qident(c) for c in columns)
    placeholders = ", ".join("?" for _ in columns)
    insert_sql = f"INSERT INTO {qt} ({cols_sql}) VALUES ({placeholders})"

    rows: list[list[Any]] = [
        [r[c] for c in columns]
        for r in local.execute(f"SELECT {cols_sql} FROM {qt}")
    ]

    remote.execute(f"DELETE FROM {qt}")
    inserted = skipped = 0
    for i in range(0, len(rows), batch_size):
        ok, fail = _flush(remote, insert_sql, rows[i:i + batch_size], table)
        inserted += ok
        skipped += fail
    logger.info("[%s] replace: inserted=%d skipped=%d", table, inserted, skipped)
    return inserted, skipped


# ── Commands ──────────────────────────────────────────────────────────────────

def cmd_init_schema(local: LocalDB, remote: Any) -> int:
    table_ddl = enumerate_tables(local)
    created = failed = 0
    for name, ddl in table_ddl.items():
        try:
            remote.execute(_idempotent_ddl(ddl))
            logger.info("created/verified table %s", name)
            created += 1
        except Exception as e:
            logger.warning("DDL failed for %s: %s", name, e)
            failed += 1

    idx_rows = local.execute(
        "SELECT name, sql FROM sqlite_master "
        "WHERE type='index' AND name NOT LIKE 'sqlite_%' AND sql IS NOT NULL"
    ).fetchall()
    for r in idx_rows:
        try:
            remote.execute(_idempotent_ddl(r["sql"]))
            logger.info("created/verified index %s", r["name"])
        except Exception as e:
            logger.warning("index DDL failed for %s: %s", r["name"], e)

    logger.info("init-schema: %d tables OK, %d failed", created, failed)
    return 0 if failed == 0 else 1


def cmd_discover_tables(local: LocalDB, config: dict) -> int:
    discovered = set(enumerate_tables(local).keys())
    inc = set(config.get("tables", {}).get("incremental", {}).keys())
    rep_cfg = config.get("tables", {}).get("replace", {})
    rep = set(rep_cfg.get("tables", []) if isinstance(rep_cfg, dict) else [])
    unclassified = sorted(discovered - inc - rep)

    if not unclassified:
        print(f"All {len(discovered)} local tables are classified in config.toml.")
        return 0

    print(f"{len(unclassified)} unclassified tables "
          f"(of {len(discovered)} local). Add to config.toml:\n")
    for name in unclassified:
        cols = get_columns(local, name)
        date_like = [c for c in cols if any(
            k in c.lower() for k in ("date", "time", "timestamp"))]
        if date_like:
            print(f'  {name:<35} # [tables.incremental] candidate cols: {date_like}')
        else:
            print(f'  {name:<35} # → [tables.replace] (no obvious watermark)')
    return 0


def cmd_status(local: LocalDB, remote: Any) -> int:
    local_tables = sorted(enumerate_tables(local).keys())
    print(f"{'TABLE':<35} {'LOCAL':>10} {'REMOTE':>10} {'DELTA':>10}")
    print("-" * 70)
    for name in local_tables:
        try:
            lc = local.execute(f"SELECT COUNT(*) FROM {qident(name)}").fetchone()[0]
        except Exception:
            lc = None
        try:
            rs = remote.execute(f"SELECT COUNT(*) FROM {qident(name)}")
            rc = rs.rows[0][0]
        except Exception:
            rc = None
        delta = (lc - rc) if isinstance(lc, int) and isinstance(rc, int) else "?"
        print(f"{name:<35} {str(lc):>10} {str(rc):>10} {str(delta):>10}")
    return 0


def cmd_sync(local: LocalDB, remote: Any, config: dict, full: bool,
             tables_arg: str | None) -> int:
    sync_cfg = config.get("sync", {})
    batch_size = int(sync_cfg.get("batch_size", 500))
    inc_cfg: dict[str, str] = config.get("tables", {}).get("incremental", {}) or {}
    rep_cfg = config.get("tables", {}).get("replace", {}) or {}
    rep_tables: list[str] = rep_cfg.get("tables", []) if isinstance(rep_cfg, dict) else []

    local_tables = enumerate_tables(local)
    selected = set(t.strip() for t in tables_arg.split(",")) if tables_arg else None

    classified = set(inc_cfg.keys()) | set(rep_tables)
    unclassified = sorted(set(local_tables) - classified)
    if unclassified and not selected:
        logger.warning("skipping %d unclassified tables (run --discover-tables): %s",
                       len(unclassified),
                       ", ".join(unclassified[:5]) +
                       ("..." if len(unclassified) > 5 else ""))

    total_inserted = total_skipped = 0
    failed: list[str] = []

    for table, ts_col in inc_cfg.items():
        if selected and table not in selected:
            continue
        if table not in local_tables:
            logger.warning("[%s] in config but missing locally — skipping", table)
            continue
        try:
            cols = get_columns(local, table)
            i, s = sync_incremental(local, remote, table, ts_col, cols,
                                    batch_size, full=full)
            total_inserted += i
            total_skipped += s
        except Exception as e:
            logger.exception("[%s] sync failed: %s", table, e)
            failed.append(table)

    for table in rep_tables:
        if selected and table not in selected:
            continue
        if table not in local_tables:
            logger.warning("[%s] in config but missing locally — skipping", table)
            continue
        try:
            cols = get_columns(local, table)
            i, s = sync_replace(local, remote, table, cols, batch_size)
            total_inserted += i
            total_skipped += s
        except Exception as e:
            logger.exception("[%s] replace failed: %s", table, e)
            failed.append(table)

    logger.info("sync done: inserted=%d skipped=%d failed_tables=%d",
                total_inserted, total_skipped, len(failed))
    if failed:
        logger.error("failed tables: %s", ", ".join(failed))
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Sync local garmin.db → Turso.")
    parser.add_argument("--init-schema", action="store_true",
                        help="Push CREATE TABLE/INDEX DDL to Turso. First-run.")
    parser.add_argument("--full", action="store_true",
                        help="Re-push every row (ignore watermark).")
    parser.add_argument("--tables",
                        help="Comma-separated subset of tables to sync.")
    parser.add_argument("--status", action="store_true",
                        help="Print row counts local vs. remote and exit.")
    parser.add_argument("--discover-tables", action="store_true",
                        help="List tables present locally but not in config.toml.")
    parser.add_argument("--config", default=str(ROOT / "config.toml"))
    parser.add_argument("--env", default=str(ROOT / ".env"))
    args = parser.parse_args(argv)

    if Path(args.env).exists():
        load_dotenv(args.env)
    else:
        load_dotenv()

    config = load_config(Path(args.config))

    log_cfg = config.get("sync", {})
    setup_logging(ROOT / log_cfg.get("log_path", "logs/sync.log"),
                  log_cfg.get("log_level", "INFO"))

    garmin_dir = Path(os.environ.get("GARMIN_DATA_DIR") or DEFAULT_GARMIN_DIR)
    db_path = garmin_dir / "garmin.db"
    if not db_path.exists():
        logger.error("local garmin.db not found at %s — set GARMIN_DATA_DIR "
                     "or verify garmin-givemydata install", db_path)
        return 2

    turso_url = os.environ.get("TURSO_URL")
    turso_token = os.environ.get("TURSO_AUTH_TOKEN")
    if not turso_url or not turso_token:
        logger.error("TURSO_URL and TURSO_AUTH_TOKEN must be set (see .env.example)")
        return 2

    with LocalDB(db_path) as local, open_remote(turso_url, turso_token) as remote:
        if args.init_schema:
            return cmd_init_schema(local, remote)
        if args.discover_tables:
            return cmd_discover_tables(local, config)
        if args.status:
            return cmd_status(local, remote)
        return cmd_sync(local, remote, config, full=args.full,
                        tables_arg=args.tables)


if __name__ == "__main__":
    sys.exit(main())
