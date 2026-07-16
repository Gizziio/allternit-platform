"""Append-only receipts for canonical computer-use transactions."""

from __future__ import annotations

import hashlib
import json
import sqlite3
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock
from typing import Any, Dict, Optional
from uuid import uuid4

from contracts.canonical import ActionTransaction, TransactionOutcome
from core.canonical_approval import transaction_action_hash


@dataclass(frozen=True)
class CanonicalReceipt:
    receipt_id: str
    occurred_at: str
    transaction_id: str
    session_id: str
    environment_id: str
    resource_id: str
    base_state_id: str
    successor_state_id: Optional[str]
    provider_id: str
    execution_mode: str
    outcome_status: str
    action_hash: str
    outcome_hash: str
    approval_id: Optional[str]
    approved_by: Optional[str]
    integrity_hash: str


def _digest(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class ReceiptLedger:
    def __init__(self, path: str | Path) -> None:
        self._lock = RLock()
        self._connection = sqlite3.connect(str(path), check_same_thread=False)
        self._connection.execute("PRAGMA journal_mode=WAL")
        self._connection.execute(
            """
            CREATE TABLE IF NOT EXISTS canonical_receipts (
                sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                receipt_id TEXT NOT NULL UNIQUE,
                transaction_id TEXT NOT NULL,
                session_id TEXT NOT NULL,
                integrity_hash TEXT NOT NULL,
                payload TEXT NOT NULL
            )
            """
        )
        self._connection.commit()

    def append(
        self,
        transaction: ActionTransaction,
        outcome: TransactionOutcome,
        *,
        provider_id: str,
        approved_by: Optional[str] = None,
    ) -> CanonicalReceipt:
        outcome_hash = _digest(asdict(outcome))
        values: Dict[str, Any] = {
            "receipt_id": f"receipt_{uuid4().hex}",
            "occurred_at": datetime.now(timezone.utc).isoformat(),
            "transaction_id": transaction.transaction_id,
            "session_id": transaction.session_id,
            "environment_id": transaction.environment_id,
            "resource_id": transaction.resource_id,
            "base_state_id": transaction.base_state_id,
            "successor_state_id": outcome.successor_state_id,
            "provider_id": provider_id,
            "execution_mode": transaction.mode,
            "outcome_status": outcome.status,
            "action_hash": transaction_action_hash(transaction),
            "outcome_hash": outcome_hash,
            "approval_id": transaction.approval_id,
            "approved_by": approved_by,
        }
        values["integrity_hash"] = _digest(values)
        receipt = CanonicalReceipt(**values)
        payload = json.dumps(asdict(receipt), sort_keys=True, separators=(",", ":"))
        with self._lock, self._connection:
            self._connection.execute(
                """
                INSERT INTO canonical_receipts
                    (receipt_id, transaction_id, session_id, integrity_hash, payload)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    receipt.receipt_id,
                    receipt.transaction_id,
                    receipt.session_id,
                    receipt.integrity_hash,
                    payload,
                ),
            )
        return receipt

    def get(self, receipt_id: str) -> CanonicalReceipt:
        with self._lock:
            row = self._connection.execute(
                "SELECT payload FROM canonical_receipts WHERE receipt_id = ?",
                (receipt_id,),
            ).fetchone()
        if row is None:
            raise KeyError(f"Unknown receipt {receipt_id!r}")
        return CanonicalReceipt(**json.loads(row[0]))

    def verify(self, receipt: CanonicalReceipt) -> bool:
        values = asdict(receipt)
        claimed = values.pop("integrity_hash")
        return claimed == _digest(values)

    def close(self) -> None:
        with self._lock:
            self._connection.close()

