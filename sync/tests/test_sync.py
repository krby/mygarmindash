"""Procedural version of the sync verification checklist.

Each test mirrors a manual checklist item, run against synthetic fixtures so the
assertions are deterministic (counts are values the fixtures create).
"""

from __future__ import annotations

import sqlite3

import pytest

from conftest import remote_count
from sync_to_cloud import (
    _idempotent_ddl,
    cmd_discover_tables,
    cmd_init_schema,
    cmd_status,
    cmd_sync,
    enumerate_tables,
    get_columns,
    qident,
    sync_incremental,
    sync_replace,
)

CONFIGURED = ["daily_summary", "sleep", "activity", "personal_record"]


def _sync(local, remote, config):
    return cmd_sync(local, remote, config, full=False, tables_arg=None)


# ── pure units ──────────────────────────────────────────────────────────────

def test_qident_quotes_valid_rejects_unsafe():
    assert qident("daily_summary") == '"daily_summary"'
    for bad in ["a b", "drop table x;", "a-b", "1abc", "", '"x"']:
        with pytest.raises(ValueError):
            qident(bad)


def test_idempotent_ddl_wraps_create_statements():
    assert "IF NOT EXISTS" in _idempotent_ddl("CREATE TABLE foo (id INTEGER)")
    assert "IF NOT EXISTS" in _idempotent_ddl("CREATE INDEX i ON foo(id)")
    assert "IF NOT EXISTS" in _idempotent_ddl("CREATE UNIQUE INDEX i ON foo(id)")
    # already-idempotent and non-DDL pass through unchanged
    passthrough = "CREATE TABLE IF NOT EXISTS foo (id INTEGER)"
    assert _idempotent_ddl(passthrough) == passthrough
    assert _idempotent_ddl("SELECT 1") == "SELECT 1"


# ── verification checklist ──────────────────────────────────────────────────

def test_init_schema_creates_all_tables(local, remote):
    # First run creates every local table on the remote.
    assert cmd_init_schema(local, remote) == 0
    local_tables = set(enumerate_tables(local))
    remote_tables = {
        r[0]
        for r in remote.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).rows
    }
    assert local_tables <= remote_tables
    # Re-running init-schema is idempotent (IF NOT EXISTS), no failures.
    assert cmd_init_schema(local, remote) == 0


def test_first_sync_inserts_rows(local, remote, config):
    cmd_init_schema(local, remote)
    assert _sync(local, remote, config) == 0
    assert remote_count(remote, "daily_summary") == 3
    assert remote_count(remote, "sleep") == 3
    assert remote_count(remote, "activity") == 2
    assert remote_count(remote, "personal_record") == 2


def test_resync_is_idempotent(local, remote, config):
    cmd_init_schema(local, remote)
    _sync(local, remote, config)
    before = {t: remote_count(remote, t) for t in CONFIGURED}

    # An incremental table inserts 0 new rows on re-sync.
    inserted, _ = sync_incremental(
        local, remote, "daily_summary", "calendar_date",
        get_columns(local, "daily_summary"), 500, full=False,
    )
    assert inserted == 0

    # A full re-run leaves every configured table's count unchanged.
    assert _sync(local, remote, config) == 0
    after = {t: remote_count(remote, t) for t in CONFIGURED}
    assert after == before


def test_status_deltas_zero_for_configured_tables(local, remote, config, capsys):
    cmd_init_schema(local, remote)
    _sync(local, remote, config)
    assert cmd_status(local, remote) == 0
    out = capsys.readouterr().out

    for t in CONFIGURED:
        local_n = local.execute(f"SELECT COUNT(*) FROM {qident(t)}").fetchone()[0]
        assert local_n == remote_count(remote, t)

    # The unclassified table appears in the status report (with a nonzero delta).
    assert "respiration" in out


def test_single_row_delta(local, remote, config, db_path):
    cmd_init_schema(local, remote)
    _sync(local, remote, config)
    before = remote_count(remote, "daily_summary")

    # Add exactly one new local row past the watermark.
    con = sqlite3.connect(db_path)
    con.execute("INSERT INTO daily_summary VALUES ('2024-02-01', 4242)")
    con.commit()
    con.close()

    _sync(local, remote, config)
    assert remote_count(remote, "daily_summary") == before + 1
    row = remote.execute(
        "SELECT total_steps FROM daily_summary WHERE calendar_date = '2024-02-01'"
    ).rows
    assert row and row[0][0] == 4242


def test_watermark_pulls_only_newer_rows(local, remote, config):
    cmd_init_schema(local, remote)
    # Pre-seed the remote with the first two dates only.
    remote.execute("INSERT INTO daily_summary (calendar_date, total_steps) VALUES ('2024-01-01', 1000)")
    remote.execute("INSERT INTO daily_summary (calendar_date, total_steps) VALUES ('2024-01-02', 2000)")

    inserted, _ = sync_incremental(
        local, remote, "daily_summary", "calendar_date",
        get_columns(local, "daily_summary"), 500, full=False,
    )
    assert inserted == 1  # only 2024-01-03 is newer than the watermark
    assert remote_count(remote, "daily_summary") == 3


def test_unclassified_tables_skipped(local, remote, config):
    cmd_init_schema(local, remote)
    _sync(local, remote, config)
    # `respiration` is in neither config class — created by init-schema but never synced.
    assert remote_count(remote, "respiration") == 0
    assert local.execute("SELECT COUNT(*) FROM respiration").fetchone()[0] == 2


def test_discover_tables_flags_unclassified(local, config, capsys):
    assert cmd_discover_tables(local, config) == 0
    out = capsys.readouterr().out
    assert "respiration" in out


def test_replace_table_wipes_and_reinserts(local, remote, config):
    cmd_init_schema(local, remote)
    _sync(local, remote, config)
    assert remote_count(remote, "personal_record") == 2

    # Running the replace strategy again wipes + reinserts — count stays 2, not 4.
    inserted, _ = sync_replace(
        local, remote, "personal_record", get_columns(local, "personal_record"), 500,
    )
    assert inserted == 2
    assert remote_count(remote, "personal_record") == 2
