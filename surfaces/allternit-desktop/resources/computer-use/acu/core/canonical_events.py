"""Durable canonical event and trajectory ledger."""

from __future__ import annotations

import json
import sqlite3
from dataclasses import asdict
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any, Dict, List, Optional
from uuid import uuid4

from contracts.canonical import ComputerEvent


class EventLedger:
    def __init__(self, path: str | Path) -> None:
        self._lock = RLock()
        self._connection = sqlite3.connect(str(path), check_same_thread=False)
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS canonical_events (
                sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                event_id TEXT NOT NULL UNIQUE,
                event_type TEXT NOT NULL,
                session_id TEXT NOT NULL,
                run_id TEXT,
                state_id TEXT,
                transaction_id TEXT,
                occurred_at TEXT NOT NULL,
                payload TEXT NOT NULL
            )
            """
        )
        self._connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_canonical_events_session "
            "ON canonical_events(session_id, sequence)"
        )
        self._connection.commit()

    def append(
        self,
        event_type: str,
        *,
        session_id: str,
        payload: Dict[str, Any],
        run_id: Optional[str] = None,
        state_id: Optional[str] = None,
        transaction_id: Optional[str] = None,
        trace_id: Optional[str] = None,
    ) -> ComputerEvent:
        event = ComputerEvent(
            event_id=f"event_{uuid4().hex}",
            event_type=event_type,
            occurred_at=datetime.now(timezone.utc).isoformat(),
            session_id=session_id,
            payload=payload,
            run_id=run_id,
            state_id=state_id,
            transaction_id=transaction_id,
            trace_id=trace_id,
        )
        encoded = json.dumps(asdict(event), sort_keys=True, separators=(",", ":"), default=str)
        with self._lock, self._connection:
            self._connection.execute(
                """
                INSERT INTO canonical_events
                    (event_id, event_type, session_id, run_id, state_id,
                     transaction_id, occurred_at, payload)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    event.event_id,
                    event.event_type,
                    event.session_id,
                    event.run_id,
                    event.state_id,
                    event.transaction_id,
                    event.occurred_at,
                    encoded,
                ),
            )
        return event

    def list_session(self, session_id: str, *, after_sequence: int = 0, limit: int = 1000) -> List[Dict[str, Any]]:
        bounded_limit = max(1, min(limit, 5000))
        with self._lock:
            rows = self._connection.execute(
                """
                SELECT sequence, payload FROM canonical_events
                WHERE session_id = ? AND sequence > ?
                ORDER BY sequence ASC LIMIT ?
                """,
                (session_id, after_sequence, bounded_limit),
            ).fetchall()
        return [{"sequence": int(row[0]), **json.loads(row[1])} for row in rows]

    def close(self) -> None:
        with self._lock:
            self._connection.close()

