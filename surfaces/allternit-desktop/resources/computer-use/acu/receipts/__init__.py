"""
Allternit Computer Use — Receipt Writer
G3 receipt guarantee: Every significant action emits a receipt
with integrity hash, evidence, and policy decision linkage.

Wraps and normalizes the existing receipt generation from
brain_adapter.py (generate_allternit_receipt).
"""

from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
import asyncio
import logging
import uuid
import hashlib
import json
import os

logger = logging.getLogger(__name__)


@dataclass
class Evidence:
    """Before/after evidence for a receipt."""
    dom_hash: Optional[str] = None
    screenshot_hash: Optional[str] = None
    url: Optional[str] = None

    def to_dict(self) -> Optional[Dict[str, str]]:
        result = {}
        if self.dom_hash:
            result["dom_hash"] = self.dom_hash
        if self.screenshot_hash:
            result["screenshot_hash"] = self.screenshot_hash
        if self.url:
            result["url"] = self.url
        return result if result else None


@dataclass
class ActionReceipt:
    """
    Normalized action receipt — matches receipt.schema.json.
    Every significant action must produce one.
    """
    receipt_id: str = field(default_factory=lambda: f"rcpt_{uuid.uuid4().hex[:12]}")
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    run_id: str = ""
    session_id: str = ""
    action_type: str = ""
    adapter_id: str = ""
    target: str = ""
    status: str = "success"  # success, failure, skipped
    before_evidence: Optional[Evidence] = None
    after_evidence: Optional[Evidence] = None
    integrity_hash: str = ""
    policy_decision_id: Optional[str] = None
    duration_ms: int = 0
    error: Optional[str] = None
    artifact_refs: List[str] = field(default_factory=list)

    def compute_integrity(self, action_data: Dict, result_data: Dict) -> str:
        """Compute SHA-256 integrity hash over action + result."""
        payload = json.dumps(
            {"action": action_data, "result": result_data},
            sort_keys=True,
            default=str,
        )
        self.integrity_hash = hashlib.sha256(payload.encode()).hexdigest()
        return self.integrity_hash

    def to_dict(self) -> Dict[str, Any]:
        return {
            "receipt_id": self.receipt_id,
            "timestamp": self.timestamp,
            "run_id": self.run_id,
            "session_id": self.session_id,
            "action_type": self.action_type,
            "adapter_id": self.adapter_id,
            "target": self.target,
            "status": self.status,
            "before_evidence": self.before_evidence.to_dict() if self.before_evidence else None,
            "after_evidence": self.after_evidence.to_dict() if self.after_evidence else None,
            "integrity_hash": self.integrity_hash,
            "policy_decision_id": self.policy_decision_id,
            "duration_ms": self.duration_ms,
            "error": self.error,
            "artifact_refs": self.artifact_refs,
        }


class ReceiptWriter:
    """
    Writes receipts to local storage and optionally forwards
    to the governance kernel.

    Storage: ~/.allternit/receipts/{receipt_id}.json (backward compatible
    with existing brain_adapter.py receipt path).
    """

    def __init__(
        self,
        receipts_dir: Optional[str] = None,
        gateway_url: Optional[str] = None,
        receipt_forward_url: Optional[str] = None,
    ):
        self._receipts_dir = Path(receipts_dir or os.path.expanduser("~/.allternit/receipts"))
        self._gateway_url = gateway_url or os.getenv("BRAIN_GATEWAY_URL", "http://localhost:3000")
        # Optional forwarding to the computer-use gateway's /v1/receipts endpoint.
        # Reads from ALLTERNIT_RECEIPT_GATEWAY if not passed explicitly.
        self._receipt_forward_url: Optional[str] = (
            receipt_forward_url or os.getenv("ALLTERNIT_RECEIPT_GATEWAY") or None
        )
        self._receipts: List[ActionReceipt] = []
        self._receipts_dir.mkdir(parents=True, exist_ok=True)

    def emit(
        self,
        *,
        run_id: str,
        session_id: str,
        action_type: str,
        adapter_id: str,
        target: str,
        action_data: Dict[str, Any],
        result_data: Dict[str, Any],
        status: str = "success",
        before_evidence: Optional[Evidence] = None,
        after_evidence: Optional[Evidence] = None,
        policy_decision_id: Optional[str] = None,
        duration_ms: int = 0,
        error: Optional[str] = None,
        artifact_refs: Optional[List[str]] = None,
    ) -> ActionReceipt:
        """Emit a receipt for a significant action."""
        receipt = ActionReceipt(
            run_id=run_id,
            session_id=session_id,
            action_type=action_type,
            adapter_id=adapter_id,
            target=target,
            status=status,
            before_evidence=before_evidence,
            after_evidence=after_evidence,
            policy_decision_id=policy_decision_id,
            duration_ms=duration_ms,
            error=error,
            artifact_refs=artifact_refs or [],
        )
        receipt.compute_integrity(action_data, result_data)

        # Persist locally
        self._write_to_disk(receipt)
        self._receipts.append(receipt)

        # Fire-and-forget forward to gateway if configured
        if self._receipt_forward_url:
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self._forward_receipt(receipt.to_dict()))
            except RuntimeError:
                # No running event loop — skip forwarding (sync call context)
                pass

        return receipt

    def emit_route_decision(
        self,
        *,
        run_id: str,
        session_id: str,
        route_decision: Dict[str, Any],
        policy_decision_id: Optional[str] = None,
    ) -> ActionReceipt:
        """Emit a receipt for a routing decision (G5)."""
        return self.emit(
            run_id=run_id,
            session_id=session_id,
            action_type="route_decision",
            adapter_id="router",
            target=route_decision.get("primary_adapter", ""),
            action_data=route_decision,
            result_data={"routed": True},
            policy_decision_id=policy_decision_id,
        )

    def get_receipt(self, receipt_id: str) -> Optional[Dict[str, Any]]:
        """Read a receipt from disk."""
        path = self._receipts_dir / f"{receipt_id}.json"
        if path.exists():
            with open(path) as f:
                return json.load(f)
        return None

    def list_receipts(self, session_id: Optional[str] = None) -> List[ActionReceipt]:
        """List receipts, optionally filtered by session."""
        if session_id:
            return [r for r in self._receipts if r.session_id == session_id]
        return list(self._receipts)

    def _write_to_disk(self, receipt: ActionReceipt) -> None:
        """Persist receipt to ~/.allternit/receipts/."""
        path = self._receipts_dir / f"{receipt.receipt_id}.json"
        try:
            with open(path, "w") as f:
                json.dump(receipt.to_dict(), f, indent=2)
        except OSError as e:
            logger.error("Failed to write receipt %s: %s", receipt.receipt_id, e)

    async def _forward_receipt(self, data: dict) -> None:
        """
        Fire-and-forget HTTP POST of a receipt dict to self._receipt_forward_url/v1/receipts.
        Tries aiohttp first; falls back to urllib.request in an executor if unavailable.
        """
        url = f"{self._receipt_forward_url}/v1/receipts"
        try:
            import aiohttp
            async with aiohttp.ClientSession() as s:
                await s.post(url, json=data, timeout=aiohttp.ClientTimeout(total=5))
        except ImportError:
            # aiohttp not available — use urllib.request in executor
            import urllib.request
            import urllib.error
            payload = json.dumps(data).encode()

            def _post() -> None:
                req = urllib.request.Request(
                    url,
                    data=payload,
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                try:
                    with urllib.request.urlopen(req, timeout=5):
                        pass
                except urllib.error.URLError as _err:
                    logger.debug("Receipt forward (urllib) failed: %s", _err)

            try:
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(None, _post)
            except Exception as e:
                logger.debug("Receipt forward executor failed: %s", e)
        except Exception as e:
            logger.debug("Receipt forward failed: %s", e)

    async def forward_to_gateway(self, receipt: ActionReceipt) -> None:
        """Forward receipt to governance kernel (best-effort)."""
        try:
            import httpx
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{self._gateway_url}/v1/governance/receipts",
                    json=receipt.to_dict(),
                    timeout=1.0,
                )
        except Exception:
            pass  # Best-effort forwarding
