"""Single-use approvals bound to exact canonical transaction state."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import asdict, dataclass
from threading import RLock
from typing import Dict
from uuid import uuid4

from contracts.canonical import ActionTransaction
from core.canonical_runtime import CanonicalRuntimeError


class ApprovalError(CanonicalRuntimeError):
    pass


@dataclass(frozen=True)
class ApprovalGrant:
    approval_id: str
    action_hash: str
    approved_by: str
    issued_at: float
    expires_at: float


def transaction_action_hash(transaction: ActionTransaction) -> str:
    value = asdict(transaction)
    value["approval_id"] = None
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class ApprovalAuthority:
    def __init__(self, signing_key: bytes, maximum_ttl_seconds: int = 600) -> None:
        if not signing_key:
            raise ValueError("Approval signing key cannot be empty")
        self._key = signing_key
        self._maximum_ttl = maximum_ttl_seconds
        self._grants: Dict[str, ApprovalGrant] = {}
        self._lock = RLock()

    def issue(
        self,
        transaction: ActionTransaction,
        *,
        approved_by: str,
        ttl_seconds: int = 120,
    ) -> ApprovalGrant:
        if not approved_by.strip():
            raise ApprovalError("Approver identity is required")
        ttl = max(1, min(ttl_seconds, self._maximum_ttl))
        issued_at = time.time()
        action_hash = transaction_action_hash(transaction)
        nonce = uuid4().hex
        signature = hmac.new(
            self._key,
            f"{nonce}:{action_hash}:{issued_at}".encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()[:32]
        grant = ApprovalGrant(
            approval_id=f"approval_{nonce}_{signature}",
            action_hash=action_hash,
            approved_by=approved_by,
            issued_at=issued_at,
            expires_at=issued_at + ttl,
        )
        with self._lock:
            self._grants[grant.approval_id] = grant
        return grant

    def consume(self, transaction: ActionTransaction) -> ApprovalGrant:
        if not transaction.approval_id:
            raise ApprovalError("Transaction does not include an approval_id")
        with self._lock:
            grant = self._grants.pop(transaction.approval_id, None)
        if grant is None:
            raise ApprovalError("Approval is unknown, already used, or revoked")
        if time.time() > grant.expires_at:
            raise ApprovalError("Approval expired")
        actual_hash = transaction_action_hash(transaction)
        if not hmac.compare_digest(grant.action_hash, actual_hash):
            raise ApprovalError("Approval does not match this transaction state and action")
        return grant

    def revoke(self, approval_id: str) -> bool:
        with self._lock:
            return self._grants.pop(approval_id, None) is not None

