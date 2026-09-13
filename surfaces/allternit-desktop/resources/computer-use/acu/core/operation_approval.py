"""Single-use approvals for non-transaction environment operations."""

from __future__ import annotations

import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from threading import RLock
from typing import Any, Dict
from uuid import uuid4


@dataclass(frozen=True)
class OperationApproval:
    approval_id: str
    operation_hash: str
    approved_by: str
    expires_at: float


class OperationApprovalAuthority:
    def __init__(self, key: bytes) -> None:
        self._key = key
        self._grants: Dict[str, OperationApproval] = {}
        self._lock = RLock()

    @staticmethod
    def digest(environment_id: str, holder_id: str, operation: str, payload: Dict[str, Any]) -> str:
        encoded = json.dumps({
            "environment_id": environment_id, "holder_id": holder_id,
            "operation": operation, "payload": payload,
        }, sort_keys=True, separators=(",", ":"), default=str).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()

    def issue(
        self, *, environment_id: str, holder_id: str, operation: str,
        payload: Dict[str, Any], approved_by: str, ttl_seconds: int,
    ) -> OperationApproval:
        if not approved_by.strip():
            raise ValueError("Approver identity is required")
        digest = self.digest(environment_id, holder_id, operation, payload)
        nonce = uuid4().hex
        signature = hmac.new(self._key, f"{nonce}:{digest}".encode(), hashlib.sha256).hexdigest()[:32]
        grant = OperationApproval(
            f"operation_approval_{nonce}_{signature}", digest, approved_by,
            time.time() + max(1, min(ttl_seconds, 600)),
        )
        with self._lock:
            self._grants[grant.approval_id] = grant
        return grant

    def consume(
        self, approval_id: str, *, environment_id: str, holder_id: str,
        operation: str, payload: Dict[str, Any],
    ) -> OperationApproval:
        with self._lock:
            grant = self._grants.pop(approval_id, None)
        if grant is None:
            raise ValueError("Operation approval is unknown, used, or revoked")
        if time.time() > grant.expires_at:
            raise ValueError("Operation approval expired")
        actual = self.digest(environment_id, holder_id, operation, payload)
        if not hmac.compare_digest(actual, grant.operation_hash):
            raise ValueError("Operation approval does not match the exact operation")
        return grant
