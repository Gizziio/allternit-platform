"""
Allternit Computer Use — Network Traces Router (har-network-traces surfaces).

/v1/browser-skills distilled-shape surface for the landed record → teach →
batch → verify capability (spec: Research/specs/har-network-traces.md, PR #499):

  GET  /v1/browser-skills                     → list workflow specs (distilled)
  GET  /v1/browser-skills/{skill_id}          → inspect one spec (distilled,
                                                incl. the NetworkTrace)
  POST /v1/browser-skills/verify              → run the deterministic chain
                                                (canned self-check, or
                                                batch+verify a spec'd
                                                workflow against a target URL)
  GET  /v1/browser-skills/verify/{verify_id}  → stored verify verdict
                                                (network deviations, a11y,
                                                receipts)
  GET  /v1/browser-skills/verify/{verify_id}/receipt/check
                                              → recompute the content-derived
                                                receipt hash (existing
                                                verify machinery)

Product contract (binding, same as the spec):
  * Raw HAR never crosses this API — responses carry distilled NetworkTrace
    shapes only. Raw + scrubbed live HAR files are deleted before the verdict
    is published; only the distilled verdict is retained (in-memory, like the
    RunStore).
  * Scrub failure = verify refused (fail closed), never a partial verdict.
  * Deterministic verdicts only; nothing fuzzy.
  * Additive: no grant-semantics / scrub / compare changes — this router only
    orchestrates the landed machinery (WorkflowRunner, network_trace,
    scripts/har_chain_e2e).
"""

from __future__ import annotations

import asyncio
import json
import logging
import tempfile
import uuid
from collections import OrderedDict
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

try:
    import sys as _sys
    from os import path as _opath

    _sys.path.insert(0, _opath.join(_opath.dirname(__file__), ".."))
    from core.network_trace import load_har, store_scrubbed_har
    from core.workflow_runner import WorkflowRunner, WorkflowValidationError, load_workflow_spec
    from scripts.har_chain_e2e import (  # noqa: F401  (namespace pkg: core root on sys.path)
        _LocalBatchExecutor,
        _NoopAdapter,
        _canonical_hash,
        run_chain,
    )
    from browser_skills_router import _SKILLS_DIR, _resolve_skill_workflow

    _traces_available = True
except ImportError:  # pragma: no cover - import guard mirrors browser_skills_router
    load_har = None  # type: ignore[assignment]
    store_scrubbed_har = None  # type: ignore[assignment]
    WorkflowRunner = None  # type: ignore[assignment,misc]
    WorkflowValidationError = ValueError  # type: ignore[assignment,misc]
    load_workflow_spec = None  # type: ignore[assignment]
    _traces_available = False

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/v1/browser-skills", tags=["browser-skills", "network-traces"])

_MAX_STORED_VERDICTS = 100


class _VerifyStore:
    """In-memory verify verdict store (same lifecycle idiom as RunStore)."""

    def __init__(self) -> None:
        self._entries: "OrderedDict[str, Dict[str, Any]]" = OrderedDict()

    def create(self, verify_id: str, mode: str, meta: Dict[str, Any]) -> Dict[str, Any]:
        entry = {
            "verify_id": verify_id,
            "status": "running",
            "mode": mode,
            "error": None,
            **meta,
        }
        self._entries[verify_id] = entry
        self._entries.move_to_end(verify_id)
        while len(self._entries) > _MAX_STORED_VERDICTS:
            self._entries.popitem(last=False)
        return entry

    def finish(self, verify_id: str, verdict: Dict[str, Any]) -> None:
        entry = self._entries.get(verify_id)
        if entry is None:
            return
        entry.update(verdict)
        entry["status"] = "completed"
        self._entries.move_to_end(verify_id)

    def fail(self, verify_id: str, error: str) -> None:
        entry = self._entries.get(verify_id)
        if entry is None:
            return
        entry["status"] = "failed"
        entry["error"] = error

    def get(self, verify_id: str) -> Optional[Dict[str, Any]]:
        return self._entries.get(verify_id)


_verify_store = _VerifyStore()


# ---------------------------------------------------------------------------
# Distilled projections — raw HAR never crosses these shapes
# ---------------------------------------------------------------------------

def _distill_spec(spec: Dict[str, Any]) -> Dict[str, Any]:
    """Project a normalized BrowserWorkflowSpec to its distilled shape.

    Step bodies carry operator-entered input values; surfaces get the shape
    (id / kind / target ref / reason), never the payload values.
    """
    steps = []
    for step in spec.get("steps") or []:
        if not isinstance(step, dict):
            continue
        target = step.get("target") if isinstance(step.get("target"), dict) else {}
        steps.append({
            "id": step.get("id"),
            "kind": step.get("kind"),
            "target": target.get("ref"),
            "reason": step.get("reason"),
        })
    safety = spec.get("safety") if isinstance(spec.get("safety"), dict) else {}
    redactions = safety.get("redactions")
    return {
        "workflowId": spec.get("workflowId"),
        "title": spec.get("title"),
        "provider": spec.get("provider"),
        "schemaVersion": spec.get("schemaVersion"),
        "sourceRunId": spec.get("sourceRunId"),
        "inputCount": len(spec.get("inputs") or []),
        "steps": steps,
        "stepCount": len(steps),
        "safety": {
            "requiresApprovalFor": list(safety.get("requiresApprovalFor") or []),
            "redactionCount": len(redactions) if isinstance(redactions, list) else 0,
        },
        "networkTrace": spec.get("networkTrace"),
    }


def _scan_skill_specs() -> List[Dict[str, Any]]:
    """List skill packages on disk as distilled summaries (never step bodies)."""
    specs: List[Dict[str, Any]] = []
    if not _SKILLS_DIR.is_dir():
        return specs
    candidates: List[tuple] = []
    for path in sorted(_SKILLS_DIR.glob("*.json")):
        candidates.append((path.stem, path))
    for sub in sorted(_SKILLS_DIR.iterdir()):
        workflow = sub / "workflow.json"
        if sub.is_dir() and workflow.is_file():
            candidates.append((sub.name, workflow))
    for skill_id, path in candidates:
        item: Dict[str, Any] = {
            "skill_id": skill_id,
            "source": str(path),
            "valid": False,
            "error": None,
        }
        try:
            package = json.loads(path.read_text(encoding="utf-8"))
            spec = load_workflow_spec(package)
            distilled = _distill_spec(spec)
            trace = distilled["networkTrace"]
            item.update({
                "valid": True,
                "workflowId": distilled["workflowId"],
                "title": distilled["title"],
                "provider": distilled["provider"],
                "stepCount": distilled["stepCount"],
                "hasNetworkTrace": isinstance(trace, dict),
                "networkTraceEntries": len(trace.get("entries") or []) if isinstance(trace, dict) else 0,
            })
        except Exception as exc:
            item["error"] = str(exc)
        specs.append(item)
    return specs


# ---------------------------------------------------------------------------
# Routes — list / inspect
# ---------------------------------------------------------------------------

@router.get("")
async def list_workflow_specs() -> Dict[str, Any]:
    """List workflow specs (skill packages) as distilled summaries.

    Shapes only: id/title/step counts and whether a NetworkTrace is attached.
    """
    if not _traces_available:
        raise HTTPException(status_code=503, detail="workflow machinery not available (import error)")
    specs = await asyncio.to_thread(_scan_skill_specs)
    return {
        "specs": specs,
        "count": len(specs),
        "skills_dir": str(_SKILLS_DIR),
    }


@router.get("/{skill_id}")
async def inspect_workflow_spec(skill_id: str) -> Dict[str, Any]:
    """Inspect one workflow spec: distilled shape incl. the NetworkTrace.

    The NetworkTrace is shapes-only by construction (method / host / path
    template / payload key-set hash) — raw HAR never crosses this API.
    """
    if not _traces_available:
        raise HTTPException(status_code=503, detail="workflow machinery not available (import error)")
    package = _resolve_skill_workflow(skill_id)
    try:
        spec = load_workflow_spec(package)
    except WorkflowValidationError as exc:
        raise HTTPException(status_code=422, detail=f"Invalid workflow spec: {exc}")
    return {
        "skill_id": skill_id,
        "workflow": _distill_spec(spec),
    }


# ---------------------------------------------------------------------------
# Routes — verify (deterministic chain)
# ---------------------------------------------------------------------------

class VerifyBody(BaseModel):
    """Body for POST /v1/browser-skills/verify."""
    workflow: Optional[Dict[str, Any]] = None
    skill_id: Optional[str] = None
    # Canned self-check when omitted; otherwise batch+verify this spec'd
    # workflow against the target URL (http/https only).
    target_url: Optional[str] = None
    wait: bool = False


def _validate_target_url(target_url: str) -> str:
    normalized = target_url.strip()
    if not normalized.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=400,
            detail="target_url must be an absolute http(s) URL",
        )
    return normalized


async def _run_canned_verify(verify_id: str) -> None:
    """Deterministic self-check: the landed H3 chain, verbatim machinery."""
    try:
        with tempfile.TemporaryDirectory(prefix="cu28-verify-") as tmp:
            run_dir = Path(tmp) / "run"
            verdict = await asyncio.to_thread(run_chain, run_dir)
            # run_chain persists the receipt next to the run artifacts; pull
            # the distilled receipt before the temp dir is cleaned up.
            receipt_path = run_dir / "receipt.json"
            receipt = (
                json.loads(receipt_path.read_text(encoding="utf-8"))
                if receipt_path.is_file() else {}
            )
        _verify_store.finish(verify_id, {
            "workflow_id": "wf-cu27-e2e-form",
            "network": verdict.get("network"),
            "a11y": verdict.get("a11y"),
            "workflow_status": verdict.get("workflow_status"),
            "grant_requests": verdict.get("grant_requests"),
            "approvals": verdict.get("approvals"),
            "receipt_id": verdict.get("receipt_id"),
            "receipt_hash": verdict.get("receipt_hash"),
            "receipt": receipt,
            "trace": verdict.get("trace"),
            "canary_absent": verdict.get("canary_absent"),
        })
    except Exception as exc:  # noqa: BLE001 - fail closed into the verdict store
        logger.exception("Canned verify chain failed: %s", exc)
        _verify_store.fail(verify_id, f"chain refused: {exc}")


async def _run_target_verify(verify_id: str, spec: Dict[str, Any], target_url: str) -> None:
    """Batch+verify a spec'd workflow against a target URL.

    Reuses the chain's one-grant local executor with live HAR capture and the
    WorkflowRunner's H2 verify — deterministic, additive, no semantics changed.
    """
    raw_live: Optional[Path] = None
    try:
        with tempfile.TemporaryDirectory(prefix="cu28-verify-") as tmp:
            artifacts = Path(tmp)
            raw_live = artifacts / ".live.raw.har"
            scrubbed_live = artifacts / "live.har"
            executor = _LocalBatchExecutor(raw_live)

            async def _finalize_live_har() -> Dict[str, Any]:
                # HarScrubError propagates — the verify is refused, fail closed.
                store_scrubbed_har(raw_live, scrubbed_live)
                return load_har(scrubbed_live)

            approvals: List[str] = []

            async def _auto_approve(pause: Any) -> bool:
                kind = getattr(pause, "kind", "workflow.pause")
                approvals.append(str(kind))
                return True

            runner = WorkflowRunner(
                adapter=_NoopAdapter(),
                session_id=f"verify-{verify_id}",
                batch_client=executor,
                batch_page_url=target_url,
                batch_enabled=True,
                approval_callback=_auto_approve,
                har_finalizer=_finalize_live_har,
            )
            result = await runner.run(spec)

            deviations = result.network_deviations
            network_status = "pass" if not deviations else "deviated"
            _verify_store.finish(verify_id, {
                "workflow_id": spec.get("workflowId"),
                "target_url": target_url,
                "network": {"status": network_status, "deviations": deviations},
                # No recorded DOM accompanies an arbitrary target — the a11y
                # leg is honestly unverifiable, never guessed.
                "a11y": {"status": "unverifiable"},
                "workflow_status": result.status,
                "approvals": sorted(approvals),
                "receipt_id": executor.receipt_id,
                "receipt_hash": _canonical_hash(executor.receipt or {}),
                "receipt": executor.receipt or {},
                "trace": spec.get("networkTrace"),
            })
    except Exception as exc:  # noqa: BLE001 - fail closed into the verdict store
        logger.exception("Target verify failed: %s", exc)
        _verify_store.fail(verify_id, f"verify refused: {exc}")


@router.post("/verify")
async def run_verify(
    body: VerifyBody,
    wait: bool = Query(default=False),
) -> Any:
    """Run the deterministic record → teach → batch → verify chain.

    Without target_url: the canned self-check (local test site, planted
    credential canary must stay absent — fail closed). With target_url and a
    workflow/skill carrying a NetworkTrace: batch+verify that spec against the
    target. Returns a verify_id; poll GET /v1/browser-skills/verify/{verify_id}.
    """
    if not _traces_available:
        raise HTTPException(status_code=503, detail="workflow machinery not available (import error)")

    wait = wait or body.wait
    verify_id = f"verify-{uuid.uuid4().hex[:12]}"

    if body.target_url is None and body.workflow is None and body.skill_id is None:
        _verify_store.create(verify_id, mode="canned", meta={})
        task = asyncio.create_task(_run_canned_verify(verify_id))
        if wait:
            await task
            return _verify_store.get(verify_id)
        return {
            "verify_id": verify_id,
            "status": "running",
            "mode": "canned",
            "poll": f"/v1/browser-skills/verify/{verify_id}",
        }

    if body.workflow is not None:
        spec_source = body.workflow
    else:
        spec_source = _resolve_skill_workflow(body.skill_id or "")

    try:
        spec = load_workflow_spec(spec_source)
    except WorkflowValidationError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid workflow spec: {exc}")

    if not spec.get("networkTrace"):
        raise HTTPException(
            status_code=400,
            detail="spec has no networkTrace to verify against — teach the "
                   "recorded trace first (nothing to compare is a refusal, "
                   "never a guess)",
        )
    target_url = _validate_target_url(body.target_url or "")

    _verify_store.create(verify_id, mode="target", meta={
        "workflow_id": spec.get("workflowId"),
        "target_url": target_url,
    })
    task = asyncio.create_task(_run_target_verify(verify_id, spec, target_url))
    if wait:
        await task
        return _verify_store.get(verify_id)
    return {
        "verify_id": verify_id,
        "status": "running",
        "mode": "target",
        "workflow_id": spec.get("workflowId"),
        "target_url": target_url,
        "poll": f"/v1/browser-skills/verify/{verify_id}",
    }


@router.get("/verify/{verify_id}")
async def get_verify_result(verify_id: str) -> Dict[str, Any]:
    """Fetch a stored verify verdict: network deviations, a11y, receipts."""
    if not _traces_available:
        raise HTTPException(status_code=503, detail="workflow machinery not available (import error)")
    entry = _verify_store.get(verify_id)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Verify '{verify_id}' not found")
    # The receipt dict is stored for the check endpoint; responses carry the
    # distilled receipt id/hash only.
    distilled = {k: v for k, v in entry.items() if k != "receipt"}
    return distilled


@router.get("/verify/{verify_id}/receipt/check")
async def check_verify_receipt(verify_id: str) -> Dict[str, Any]:
    """Recompute the content-derived receipt hash — existing verify machinery.

    Same canonical-hash construction as the chain and the workflow receipts:
    SHA-256 over canonical JSON of the receipt. Deterministic; tampering or a
    store inconsistency surfaces as valid=false.
    """
    if not _traces_available:
        raise HTTPException(status_code=503, detail="workflow machinery not available (import error)")
    entry = _verify_store.get(verify_id)
    if entry is None:
        raise HTTPException(status_code=404, detail=f"Verify '{verify_id}' not found")
    if entry.get("status") != "completed":
        raise HTTPException(status_code=409, detail=f"Verify '{verify_id}' is {entry.get('status')}")
    receipt = entry.get("receipt") or {}
    stored_hash = entry.get("receipt_hash") or ""
    recomputed = _canonical_hash(receipt)
    valid = stored_hash == recomputed and bool(stored_hash)
    return {
        "verify_id": verify_id,
        "receipt_id": entry.get("receipt_id"),
        "valid": valid,
        "stored_hash": stored_hash,
        "recomputed_hash": recomputed,
        "tampered": not valid,
    }
