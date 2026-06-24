"""Shared fixtures for the sync test suite.

Tests run against a tiny synthetic SQLite DB (built per-test in a temp dir) and a
temp libSQL `file:` database acting as the stand-in remote — the same technique
used to verify the sync checklist by hand. Never uses the real garmin.db.
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

import pytest

# Make sync_to_cloud.py importable (it lives one level up from tests/).
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

# Synthetic schema mirroring the real garmin.db row *shapes* (not the data):
#  - incremental tables with a watermark column
#  - one replace table (no date column)
#  - one deliberately unclassified table (in neither config class)
SCHEMA = """
CREATE TABLE daily_summary (
    calendar_date TEXT PRIMARY KEY,
    total_steps   INTEGER
);
CREATE TABLE sleep (
    calendar_date      TEXT PRIMARY KEY,
    sleep_time_seconds INTEGER
);
CREATE TABLE activity (
    activity_id      INTEGER PRIMARY KEY,
    start_time_local TEXT,
    activity_type    TEXT
);
CREATE TABLE personal_record (
    id            INTEGER PRIMARY KEY,
    activity_type TEXT,
    pr_type       TEXT,
    value         REAL
);
CREATE TABLE respiration (
    calendar_date TEXT PRIMARY KEY,
    avg_value     REAL
);
CREATE INDEX idx_activity_start ON activity (start_time_local);
"""

# Row counts the assertions key off of (deterministic — we create them).
SEED = {
    "daily_summary": [("2024-01-01", 1000), ("2024-01-02", 2000), ("2024-01-03", 3000)],
    "sleep": [("2024-01-01", 28800), ("2024-01-02", 25200), ("2024-01-03", 30600)],
    "activity": [(1, "2024-01-02 07:00:00", "running"), (2, "2024-01-03 18:30:00", "strength")],
    "personal_record": [(1, "running", "5k", 1500.0), (2, "running", "1mi", 380.0)],
    "respiration": [("2024-01-01", 14.5), ("2024-01-02", 13.9)],
}


@pytest.fixture
def db_path(tmp_path: Path) -> Path:
    """A freshly built synthetic local garmin.db."""
    p = tmp_path / "garmin.db"
    con = sqlite3.connect(p)
    con.executescript(SCHEMA)
    con.executemany("INSERT INTO daily_summary VALUES (?, ?)", SEED["daily_summary"])
    con.executemany("INSERT INTO sleep VALUES (?, ?)", SEED["sleep"])
    con.executemany("INSERT INTO activity VALUES (?, ?, ?)", SEED["activity"])
    con.executemany("INSERT INTO personal_record VALUES (?, ?, ?, ?)", SEED["personal_record"])
    con.executemany("INSERT INTO respiration VALUES (?, ?)", SEED["respiration"])
    con.commit()
    con.close()
    return p


@pytest.fixture
def local(db_path: Path):
    """Read-only LocalDB handle over the synthetic DB."""
    from sync_to_cloud import LocalDB

    db = LocalDB(db_path)
    yield db
    db.close()


@pytest.fixture
def remote(tmp_path: Path):
    """A temp libSQL `file:` database standing in for Turso."""
    from sync_to_cloud import open_remote

    url = "file:" + (tmp_path / "remote.db").as_posix()
    with open_remote(url, "dummy") as client:
        yield client


@pytest.fixture
def config() -> dict:
    """Classifies the synthetic tables; `respiration` is left unclassified."""
    return {
        "sync": {"batch_size": 500},
        "tables": {
            "incremental": {
                "daily_summary": "calendar_date",
                "sleep": "calendar_date",
                "activity": "start_time_local",
            },
            "replace": {"tables": ["personal_record"]},
        },
    }


def remote_count(remote, table: str) -> int:
    return remote.execute(f'SELECT COUNT(*) FROM "{table}"').rows[0][0]
