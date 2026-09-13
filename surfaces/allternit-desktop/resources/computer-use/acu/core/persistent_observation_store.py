"""SQLite-backed immutable canonical observation storage."""

from __future__ import annotations

import sqlite3
from pathlib import Path
from threading import RLock
from typing import Optional

from contracts.canonical import Observation
from contracts.codec import observation_from_json, observation_to_json
from core.canonical_runtime import CanonicalRuntimeError, StateNotFoundError, StateScopeError


class SQLiteObservationStore:
    """Durable bounded store; replacement of an existing state is forbidden."""

    def __init__(self, path: str | Path, limit: int = 2048) -> None:
        if limit < 1:
            raise ValueError("Observation store limit must be positive")
        self._path = str(path)
        self._limit = limit
        self._lock = RLock()
        self._connection = sqlite3.connect(self._path, check_same_thread=False)
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute("PRAGMA foreign_keys=ON")
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS canonical_observations (
                sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                state_id TEXT NOT NULL UNIQUE,
                session_id TEXT NOT NULL,
                environment_id TEXT NOT NULL,
                resource_id TEXT NOT NULL,
                epoch INTEGER NOT NULL CHECK(epoch >= 0),
                payload TEXT NOT NULL
            )
            """
        )
        self._connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_canonical_observations_scope "
            "ON canonical_observations(session_id, environment_id, resource_id, epoch)"
        )
        self._connection.commit()

    def put(self, observation: Observation) -> None:
        payload = observation_to_json(observation)
        with self._lock:
            existing = self._connection.execute(
                "SELECT payload FROM canonical_observations WHERE state_id = ?",
                (observation.state_id,),
            ).fetchone()
            if existing is not None:
                if existing[0] != payload:
                    raise CanonicalRuntimeError(
                        f"Observation {observation.state_id!r} is immutable and cannot be replaced"
                    )
                return
            with self._connection:
                self._connection.execute(
                    """
                    INSERT INTO canonical_observations
                        (state_id, session_id, environment_id, resource_id, epoch, payload)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        observation.state_id,
                        observation.session_id,
                        observation.environment_id,
                        observation.resource_id,
                        observation.epoch,
                        payload,
                    ),
                )
                self._connection.execute(
                    """
                    DELETE FROM canonical_observations
                    WHERE sequence IN (
                        SELECT sequence FROM canonical_observations
                        ORDER BY sequence DESC LIMIT -1 OFFSET ?
                    )
                    """,
                    (self._limit,),
                )

    def get(self, state_id: str) -> Observation:
        with self._lock:
            row = self._connection.execute(
                "SELECT payload FROM canonical_observations WHERE state_id = ?",
                (state_id,),
            ).fetchone()
        if row is None:
            raise StateNotFoundError(f"Unknown or evicted state {state_id!r}")
        return observation_from_json(row[0])

    def require_scope(
        self,
        state_id: str,
        *,
        session_id: str,
        environment_id: str,
        resource_id: str,
    ) -> Observation:
        observation = self.get(state_id)
        actual = (
            observation.session_id,
            observation.environment_id,
            observation.resource_id,
        )
        expected = (session_id, environment_id, resource_id)
        if actual != expected:
            raise StateScopeError(
                f"State {state_id!r} belongs to {actual!r}, not {expected!r}"
            )
        return observation

    def latest(
        self,
        *,
        session_id: str,
        environment_id: str,
        resource_id: str,
    ) -> Optional[Observation]:
        with self._lock:
            row = self._connection.execute(
                """
                SELECT payload FROM canonical_observations
                WHERE session_id = ? AND environment_id = ? AND resource_id = ?
                ORDER BY epoch DESC, sequence DESC LIMIT 1
                """,
                (session_id, environment_id, resource_id),
            ).fetchone()
        return observation_from_json(row[0]) if row is not None else None

    def list_session(self, session_id: str, *, limit: int = 5000) -> tuple[Observation, ...]:
        bounded = max(1, min(limit, 5000))
        with self._lock:
            rows = self._connection.execute(
                """SELECT payload FROM canonical_observations
                   WHERE session_id = ? ORDER BY sequence ASC LIMIT ?""",
                (session_id, bounded),
            ).fetchall()
        return tuple(observation_from_json(row[0]) for row in rows)

    def clear(self) -> None:
        with self._lock, self._connection:
            self._connection.execute("DELETE FROM canonical_observations")

    def close(self) -> None:
        with self._lock:
            self._connection.close()

    def __len__(self) -> int:
        with self._lock:
            row = self._connection.execute(
                "SELECT COUNT(*) FROM canonical_observations"
            ).fetchone()
        return int(row[0]) if row is not None else 0
