"""Durable logical session/resource bindings across computer-use providers."""

from __future__ import annotations

import json
import sqlite3
import threading
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

from contracts.canonical import Root


@dataclass(frozen=True)
class ResourceBinding:
    session_id: str
    environment_id: str
    resource_id: str
    provider_id: str
    root_id: str
    kind: str
    title: str
    application: str
    last_seen_at: str


class SessionAuthority:
    def __init__(self, path: str | Path) -> None:
        self._connection = sqlite3.connect(str(path), check_same_thread=False)
        self._connection.row_factory = sqlite3.Row
        self._lock = threading.RLock()
        with self._connection:
            self._connection.execute(
                """CREATE TABLE IF NOT EXISTS canonical_resource_bindings (
                    session_id TEXT NOT NULL, environment_id TEXT NOT NULL,
                    resource_id TEXT NOT NULL, provider_id TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    PRIMARY KEY(session_id, environment_id, resource_id, provider_id)
                )"""
            )

    def bind_roots(
        self, *, session_id: str, environment_id: str,
        provider_id: str, roots: tuple[Root, ...],
    ) -> tuple[ResourceBinding, ...]:
        seen = datetime.now(timezone.utc).isoformat()
        bindings = tuple(ResourceBinding(
            session_id, environment_id, root.resource_id, provider_id,
            root.root_id, root.kind, root.title, root.application, seen,
        ) for root in roots)
        with self._lock, self._connection:
            for binding in bindings:
                self._connection.execute(
                    """INSERT INTO canonical_resource_bindings
                       (session_id, environment_id, resource_id, provider_id, payload)
                       VALUES (?, ?, ?, ?, ?)
                       ON CONFLICT(session_id, environment_id, resource_id, provider_id)
                       DO UPDATE SET payload = excluded.payload""",
                    (session_id, environment_id, binding.resource_id, provider_id,
                     json.dumps(asdict(binding), sort_keys=True)),
                )
        return bindings

    def list_bindings(
        self, session_id: str, *, environment_id: Optional[str] = None,
    ) -> tuple[ResourceBinding, ...]:
        if environment_id is None:
            rows = self._connection.execute(
                "SELECT payload FROM canonical_resource_bindings WHERE session_id = ? ORDER BY resource_id, provider_id",
                (session_id,),
            ).fetchall()
        else:
            rows = self._connection.execute(
                "SELECT payload FROM canonical_resource_bindings WHERE session_id = ? AND environment_id = ? ORDER BY resource_id, provider_id",
                (session_id, environment_id),
            ).fetchall()
        return tuple(ResourceBinding(**json.loads(row["payload"])) for row in rows)

    def require_provider(self, session_id: str, environment_id: str, resource_id: str, provider_id: str) -> None:
        row = self._connection.execute(
            """SELECT 1 FROM canonical_resource_bindings
               WHERE session_id = ? AND environment_id = ? AND resource_id = ? AND provider_id = ?""",
            (session_id, environment_id, resource_id, provider_id),
        ).fetchone()
        if row is None:
            raise KeyError(
                f"Resource {resource_id!r} is not bound to provider {provider_id!r} in session {session_id!r}"
            )

    def close(self) -> None:
        self._connection.close()
