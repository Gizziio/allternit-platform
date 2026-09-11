"""
Allternit Computer Use — Run Record Persistence

SQLite-backed durable store for gateway run records and the recordings
index, living alongside the canonical authorities under
``~/.allternit/computer-use/`` (``ALLTERNIT_COMPUTER_STATE_DIR`` overrides).

Why this exists: the in-memory RunStore loses every run when the gateway
process exits. Persisting terminal run records (and an index of
recordings) lets GET endpoints answer for historical runs after a
restart, and keeps the recordings index table maintained as recordings
start/complete — no new infra, just the existing SQLite authority
pattern (see core/canonical_events.py).
"""

from __future__ import annotations

import json
import logging
import os
import sqlite3
from pathlib import Path
from threading import RLock
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

TERMINAL_STATUSES = {"completed", "failed", "cancelled", "abandoned", "deviated", "needs_approval"}

# Cost-accounting columns added after the initial schema. Existing databases
# get them via the guarded ALTER TABLE in RunPersistence.__init__.
_COST_COLUMNS = (
    ("input_tokens", "INTEGER NOT NULL DEFAULT 0"),
    ("output_tokens", "INTEGER NOT NULL DEFAULT 0"),
    ("total_tokens", "INTEGER NOT NULL DEFAULT 0"),
    ("est_cost_usd", "REAL NOT NULL DEFAULT 0"),
)


def default_state_dir() -> Path:
    return Path(os.environ.get("ALLTERNIT_COMPUTER_STATE_DIR", "~/.allternit/computer-use")).expanduser()


class RunPersistence:
    """Durable run records + recordings index in a single SQLite authority."""

    def __init__(self, path: Optional[Path] = None) -> None:
        self._lock = RLock()
        state_dir = default_state_dir()
        state_dir.mkdir(parents=True, exist_ok=True)
        self._path = Path(path) if path is not None else state_dir / "runs.sqlite3"
        self._connection = sqlite3.connect(str(self._path), check_same_thread=False)
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS runs (
                run_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                mode TEXT NOT NULL,
                target_scope TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                result_json TEXT,
                error TEXT,
                input_tokens INTEGER NOT NULL DEFAULT 0,
                output_tokens INTEGER NOT NULL DEFAULT 0,
                total_tokens INTEGER NOT NULL DEFAULT 0,
                est_cost_usd REAL NOT NULL DEFAULT 0
            )
            """
        )
        # Migrate databases created before cost accounting existed.
        # SQLite raises OperationalError on duplicate column — that means the
        # column is already there, so swallow it.
        for column, ddl in _COST_COLUMNS:
            try:
                self._connection.execute(f"ALTER TABLE runs ADD COLUMN {column} {ddl}")
            except sqlite3.OperationalError:
                pass
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS recordings_index (
                recording_id TEXT PRIMARY KEY,
                task TEXT NOT NULL,
                session_id TEXT NOT NULL,
                run_id TEXT,
                status TEXT NOT NULL,
                started_at TEXT NOT NULL,
                completed_at TEXT,
                total_steps INTEGER DEFAULT 0,
                path TEXT,
                gif_path TEXT
            )
            """
        )
        self._connection.commit()

    @property
    def path(self) -> Path:
        return self._path

    # ── runs ────────────────────────────────────────────────────────────────

    def upsert_run(self, state: Any) -> None:
        """Insert or update a run record from a RunState-like object."""
        result_json = None
        if getattr(state, "result", None) is not None:
            try:
                result_json = json.dumps(state.result, sort_keys=True, default=str)
            except Exception as exc:
                logger.warning("run result serialization failed for %s: %s", state.run_id, exc)
        cost = getattr(state, "cost", None) or {}
        with self._lock, self._connection:
            self._connection.execute(
                """
                INSERT INTO runs (run_id, session_id, mode, target_scope, status,
                                  created_at, updated_at, result_json, error,
                                  input_tokens, output_tokens, total_tokens, est_cost_usd)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(run_id) DO UPDATE SET
                    session_id=excluded.session_id,
                    mode=excluded.mode,
                    target_scope=excluded.target_scope,
                    status=excluded.status,
                    updated_at=excluded.updated_at,
                    result_json=excluded.result_json,
                    error=excluded.error,
                    input_tokens=excluded.input_tokens,
                    output_tokens=excluded.output_tokens,
                    total_tokens=excluded.total_tokens,
                    est_cost_usd=excluded.est_cost_usd
                """,
                (
                    state.run_id,
                    state.session_id,
                    state.mode,
                    state.target_scope,
                    state.status,
                    state.created_at,
                    state.updated_at,
                    result_json,
                    getattr(state, "error", None),
                    int(cost.get("input_tokens") or 0),
                    int(cost.get("output_tokens") or 0),
                    int(cost.get("total_tokens") or 0),
                    float(cost.get("est_cost_usd") or 0.0),
                ),
            )

    def get_run(self, run_id: str) -> Optional[Dict[str, Any]]:
        with self._lock:
            row = self._connection.execute(
                "SELECT * FROM runs WHERE run_id = ?", (run_id,)
            ).fetchone()
        return self._row_to_run(row) if row else None

    def list_runs(self, limit: int = 200) -> List[Dict[str, Any]]:
        bounded = max(1, min(limit, 2000))
        with self._lock:
            rows = self._connection.execute(
                "SELECT * FROM runs ORDER BY updated_at DESC LIMIT ?", (bounded,)
            ).fetchall()
        return [self._row_to_run(row) for row in rows]

    def cost_summary(self) -> Dict[str, Any]:
        """Aggregate cost observability across all persisted runs.

        Success rate counts only terminal outcomes; avg cost/task averages
        est_cost_usd over completed runs (runs that never produced token
        data contribute an honest 0.0 to the average).
        """
        with self._lock:
            row = self._connection.execute(
                """
                SELECT COUNT(*),
                       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END),
                       SUM(CASE WHEN status IN ('completed','failed','cancelled',
                                                'abandoned','deviated','interrupted')
                                THEN 1 ELSE 0 END),
                       SUM(est_cost_usd),
                       SUM(CASE WHEN status = 'completed' THEN est_cost_usd ELSE 0 END),
                       SUM(total_tokens)
                FROM runs
                """
            ).fetchone()
        total_runs = int(row[0] or 0)
        completed = int(row[1] or 0)
        terminal = int(row[2] or 0)
        total_est_cost = float(row[3] or 0.0)
        completed_cost = float(row[4] or 0.0)
        total_tokens = int(row[5] or 0)
        return {
            "total_runs": total_runs,
            "completed": completed,
            "terminal_runs": terminal,
            "success_rate": round(completed / terminal, 4) if terminal else 0.0,
            "total_est_cost_usd": round(total_est_cost, 8),
            "avg_cost_per_task_usd": round(completed_cost / completed, 8) if completed else 0.0,
            "avg_tokens_per_run": round(total_tokens / total_runs, 2) if total_runs else 0.0,
        }

    def mark_interrupted(self) -> int:
        """Mark non-terminal runs as interrupted (called at startup after a crash)."""
        with self._lock, self._connection:
            cursor = self._connection.execute(
                """
                UPDATE runs SET status = 'interrupted', updated_at = ?
                WHERE status NOT IN ('completed', 'failed', 'cancelled', 'abandoned',
                                     'deviated', 'needs_approval', 'interrupted')
                """,
                (_utcnow(),),
            )
        return cursor.rowcount

    @staticmethod
    def _row_to_run(row: sqlite3.Row) -> Dict[str, Any]:
        run = {
            "run_id": row[0],
            "session_id": row[1],
            "mode": row[2],
            "target_scope": row[3],
            "status": row[4],
            "created_at": row[5],
            "updated_at": row[6],
            "result": json.loads(row[7]) if row[7] else None,
            "error": row[8],
            "input_tokens": row[9] or 0,
            "output_tokens": row[10] or 0,
            "total_tokens": row[11] or 0,
            "est_cost_usd": row[12] or 0.0,
        }
        return run

    # ── recordings index ────────────────────────────────────────────────────

    def upsert_recording(self, recording: Dict[str, Any]) -> None:
        with self._lock, self._connection:
            self._connection.execute(
                """
                INSERT INTO recordings_index (recording_id, task, session_id, run_id,
                                              status, started_at, completed_at,
                                              total_steps, path, gif_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(recording_id) DO UPDATE SET
                    task=excluded.task,
                    session_id=excluded.session_id,
                    run_id=excluded.run_id,
                    status=excluded.status,
                    started_at=excluded.started_at,
                    completed_at=excluded.completed_at,
                    total_steps=excluded.total_steps,
                    path=excluded.path,
                    gif_path=excluded.gif_path
                """,
                (
                    recording.get("recording_id", ""),
                    recording.get("task", ""),
                    recording.get("session_id", ""),
                    recording.get("run_id"),
                    recording.get("status", "unknown"),
                    recording.get("started_at", _utcnow()),
                    recording.get("completed_at"),
                    int(recording.get("total_steps") or 0),
                    recording.get("path"),
                    recording.get("gif_path"),
                ),
            )

    def list_recordings_index(self, limit: int = 500) -> List[Dict[str, Any]]:
        bounded = max(1, min(limit, 2000))
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT recording_id, task, session_id, run_id, status, started_at,
                       completed_at, total_steps, path, gif_path
                FROM recordings_index ORDER BY started_at DESC LIMIT ?
                """,
                (bounded,),
            ).fetchall()
        return [
            {
                "recording_id": row[0],
                "task": row[1],
                "session_id": row[2],
                "run_id": row[3],
                "status": row[4],
                "started_at": row[5],
                "completed_at": row[6],
                "total_steps": row[7],
                "path": row[8],
                "gif_path": row[9],
            }
            for row in rows
        ]

    def close(self) -> None:
        with self._lock:
            self._connection.close()


def _utcnow() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()
