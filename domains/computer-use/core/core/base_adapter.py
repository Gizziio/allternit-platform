"""
A2R Computer Use — Base Adapter Interface
All adapters must implement this interface to participate in routing.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
import uuid
import hashlib
import json


@dataclass
class ActionRequest:
    """Canonical action request — matches action.schema.json"""
    action_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    action_type: str = ""  # goto, observe, act, extract, screenshot, download, upload, eval, inspect, handoff
    target: str = ""
    parameters: Dict[str, Any] = field(default_factory=dict)
    timeout_ms: int = 30000
    retry_count: int = 0


@dataclass
class Artifact:
    """Reference to a produced artifact"""
    artifact_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    type: str = ""  # screenshot, html, json, text, file, dom_snapshot
    path: str = ""
    hash: str = ""
    size_bytes: int = 0
    media_type: str = ""


@dataclass
class PolicyDecision:
    """Policy decision record"""
    decision_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    decision: str = "allow"  # allow, deny, require_approval, force_mode, force_adapter, require_headed, require_user_present
    reason: str = ""


@dataclass
class ResultEnvelope:
    """Normalized result envelope — G1 semantic guarantee.
    Matches result.schema.json."""
    run_id: str = ""
    session_id: str = ""
    adapter_id: str = ""
    family: str = ""       # browser, retrieval, desktop, hybrid
    mode: str = ""         # assist, execute, inspect, parallel, desktop, hybrid, crawl
    action: str = ""       # canonical action type
    target: str = ""
    status: str = "pending"  # pending, running, completed, failed, cancelled
    artifacts: List[Artifact] = field(default_factory=list)
    receipts: List[str] = field(default_factory=list)
    policy_decisions: List[PolicyDecision] = field(default_factory=list)
    trace_id: str = field(default_factory=lambda: str(uuid.uuid4()))
    fallbacks_used: List[str] = field(default_factory=list)
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    duration_ms: Optional[int] = None
    error: Optional[Dict[str, str]] = None
    extracted_content: Any = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "run_id": self.run_id,
            "session_id": self.session_id,
            "adapter_id": self.adapter_id,
            "family": self.family,
            "mode": self.mode,
            "action": self.action,
            "target": self.target,
            "status": self.status,
            "artifacts": [vars(a) for a in self.artifacts],
            "receipts": self.receipts,
            "policy_decisions": [vars(p) for p in self.policy_decisions],
            "trace_id": self.trace_id,
            "fallbacks_used": self.fallbacks_used,
            "started_at": self.started_at,
            "completed_at": self.completed_at,
            "duration_ms": self.duration_ms,
            "error": self.error,
            "extracted_content": self.extracted_content,
        }


@dataclass
class Receipt:
    """Action receipt — G3 receipt guarantee. Matches receipt.schema.json."""
    receipt_id: str = field(default_factory=lambda: f"rcpt_{uuid.uuid4().hex[:12]}")
    timestamp: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    run_id: str = ""
    session_id: str = ""
    action_type: str = ""
    adapter_id: str = ""
    target: str = ""
    status: str = "success"
    before_evidence: Optional[Dict[str, str]] = None
    after_evidence: Optional[Dict[str, str]] = None
    integrity_hash: str = ""
    policy_decision_id: Optional[str] = None
    duration_ms: int = 0
    error: Optional[str] = None
    artifact_refs: List[str] = field(default_factory=list)

    def compute_integrity_hash(self, action_data: Dict, result_data: Dict) -> str:
        payload = json.dumps({"action": action_data, "result": result_data}, sort_keys=True, default=str)
        self.integrity_hash = hashlib.sha256(payload.encode()).hexdigest()
        return self.integrity_hash


class BaseAdapter(ABC):
    """Base class for all computer-use adapters."""

    @property
    @abstractmethod
    def adapter_id(self) -> str:
        """Unique adapter identifier (e.g. 'browser.playwright')"""
        ...

    @property
    @abstractmethod
    def family(self) -> str:
        """Adapter family: browser, retrieval, desktop, hybrid"""
        ...

    @abstractmethod
    async def initialize(self) -> None:
        """Initialize adapter resources"""
        ...

    @abstractmethod
    async def execute(self, action: ActionRequest, session_id: str, run_id: str) -> ResultEnvelope:
        """Execute an action and return normalized result"""
        ...

    @abstractmethod
    async def close(self) -> None:
        """Clean up adapter resources"""
        ...

    def _make_envelope(self, action: ActionRequest, session_id: str, run_id: str, mode: str = "execute") -> ResultEnvelope:
        """Create a pre-filled result envelope"""
        return ResultEnvelope(
            run_id=run_id,
            session_id=session_id,
            adapter_id=self.adapter_id,
            family=self.family,
            mode=mode,
            action=action.action_type,
            target=action.target,
            status="running",
            started_at=datetime.utcnow().isoformat(),
        )

    def _emit_receipt(self, envelope: ResultEnvelope, action: ActionRequest, result_data: Dict = None) -> Receipt:
        """Emit a receipt for an action"""
        receipt = Receipt(
            run_id=envelope.run_id,
            session_id=envelope.session_id,
            action_type=action.action_type,
            adapter_id=self.adapter_id,
            target=action.target,
            status="success" if envelope.status == "completed" else "failure",
        )
        receipt.compute_integrity_hash(
            {"action_type": action.action_type, "target": action.target, "params": action.parameters},
            result_data or {}
        )
        envelope.receipts.append(receipt.receipt_id)
        return receipt
