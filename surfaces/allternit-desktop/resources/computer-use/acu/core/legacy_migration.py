"""Idempotent import of legacy JSONL recordings into canonical events."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path
from typing import Any, Dict

from core.canonical_events import EventLedger


class LegacyMigrationService:
    def __init__(
        self, path: str | Path, events: EventLedger, *, allowed_roots: tuple[str | Path, ...],
    ) -> None:
        self._events = events
        self._allowed_roots = tuple(Path(root).expanduser().resolve() for root in allowed_roots)
        self._connection = sqlite3.connect(str(path), check_same_thread=False)
        with self._connection:
            self._connection.execute(
                """CREATE TABLE IF NOT EXISTS canonical_migrations (
                    source_sha256 TEXT PRIMARY KEY, source_path TEXT NOT NULL,
                    session_id TEXT NOT NULL, imported_events INTEGER NOT NULL
                )"""
            )

    def import_recording(self, path: str | Path) -> Dict[str, Any]:
        source = Path(path).expanduser().resolve()
        if not any(source.is_relative_to(root) for root in self._allowed_roots):
            raise ValueError("Migration source is outside configured recording roots")
        if not source.is_file() or source.suffix != ".jsonl":
            raise ValueError("Migration source must be an existing JSONL recording")
        payload = source.read_bytes()
        digest = hashlib.sha256(payload).hexdigest()
        existing = self._connection.execute(
            "SELECT session_id, imported_events FROM canonical_migrations WHERE source_sha256 = ?",
            (digest,),
        ).fetchone()
        if existing:
            return {"source_sha256": digest, "session_id": existing[0], "imported_events": existing[1], "already_imported": True}
        lines = [json.loads(line) for line in payload.decode("utf-8").splitlines() if line.strip()]
        if not lines:
            raise ValueError("Legacy recording is empty")
        manifest = lines[0]
        session_id = str(manifest.get("session_id") or f"migrated_{digest[:24]}")
        imported = 0
        for sequence, value in enumerate(lines):
            if not isinstance(value, dict):
                continue
            self._events.append(
                "legacy.recording.manifest" if sequence == 0 else "legacy.recording.frame",
                session_id=session_id,
                run_id=str(value.get("run_id")) if value.get("run_id") else None,
                transaction_id=None,
                payload={
                    "legacy_sequence": sequence, "source_sha256": digest,
                    "legacy_payload": value, "migrated_read_only": True,
                },
            )
            imported += 1
        with self._connection:
            self._connection.execute(
                "INSERT INTO canonical_migrations VALUES (?, ?, ?, ?)",
                (digest, str(source), session_id, imported),
            )
        return {"source_sha256": digest, "session_id": session_id, "imported_events": imported, "already_imported": False}

    def import_receipts(self, path: str | Path, *, session_id: str) -> Dict[str, Any]:
        source = Path(path).expanduser().resolve()
        if not any(source.is_relative_to(root) for root in self._allowed_roots):
            raise ValueError("Migration source is outside configured recording roots")
        if not source.is_file() or source.suffix not in {".json", ".jsonl"}:
            raise ValueError("Receipt migration source must be JSON or JSONL")
        payload = source.read_bytes()
        digest = hashlib.sha256(payload).hexdigest()
        migration_key = hashlib.sha256(f"receipts:{session_id}:{digest}".encode()).hexdigest()
        existing = self._connection.execute(
            "SELECT imported_events FROM canonical_migrations WHERE source_sha256 = ?", (migration_key,)
        ).fetchone()
        if existing:
            return {"source_sha256": digest, "session_id": session_id, "imported_receipts": existing[0], "already_imported": True}
        text = payload.decode("utf-8")
        if source.suffix == ".jsonl":
            values = [json.loads(line) for line in text.splitlines() if line.strip()]
        else:
            decoded = json.loads(text)
            values = decoded if isinstance(decoded, list) else [decoded]
        imported = 0
        for sequence, value in enumerate(values):
            if not isinstance(value, dict):
                continue
            self._events.append(
                "legacy.receipt.imported", session_id=session_id,
                run_id=str(value.get("run_id")) if value.get("run_id") else None,
                payload={
                    "legacy_sequence": sequence, "source_sha256": digest,
                    "legacy_receipt": value, "canonical_receipt": False,
                    "migrated_read_only": True,
                },
            )
            imported += 1
        with self._connection:
            self._connection.execute(
                "INSERT INTO canonical_migrations VALUES (?, ?, ?, ?)",
                (migration_key, str(source), session_id, imported),
            )
        return {"source_sha256": digest, "session_id": session_id, "imported_receipts": imported, "already_imported": False}

    def close(self) -> None:
        self._connection.close()
