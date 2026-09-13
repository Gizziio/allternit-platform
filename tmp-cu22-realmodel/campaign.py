#!/usr/bin/env python3
"""cu22 — D3 real-model batch validation campaign driver.

Runs the computer-use PlanningLoop (domains/computer-use/core) in-process,
driven by a REAL frontier vision model through tmp-cu22-realmodel/brain_wrapper.py
(codex CLI, gpt-6-astra), against the local multi-page test site
(tmp-cu22-realmodel/site/server.py). Each task runs twice:
  - batched   (batch_enabled=True,  one grant-bound batch per plan)
  - per-step  (batch_enabled=False, forced step-by-step)

Batch grants are auto-approved through the real Rust grant gate
(POST /api/aci/handoff/:id/approve on allternit-api) — the campaign harness
plays the human; every grant request/approval/receipt is recorded.

Usage:
  python campaign.py [--task NAME] [--mode batched|per-step] [--list]
"""

import argparse
import asyncio
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
CORE = REPO / "domains/computer-use/core"
sys.path.insert(0, str(CORE))

API = os.environ.get("ALLTERNIT_API_URL", "http://127.0.0.1:18113")
SITE = os.environ.get("CU22_SITE", "http://127.0.0.1:18080")
CDP_PORT = int(os.environ.get("ACU_CDP_PORT", "9222"))
EVIDENCE_DIR = Path(__file__).parent / "evidence"

TASKS = [
    {
        "name": "form-fill",
        "start": f"{SITE}/form.html",
        "prompt": (
            "On this page there is a registration form. Fill the name field with "
            "'Ada Lovelace', fill the email field with 'ada@example.com', then "
            "press the Register button. The page ends on a 'Done' page."
        ),
        "success": lambda st: any(
            t["task"] == "form"
            and t["fields"].get("name") == "Ada Lovelace"
            and t["fields"].get("email") == "ada@example.com"
            for t in st),
    },
    {
        "name": "multi-click-nav",
        "start": f"{SITE}/nav.html",
        "prompt": (
            "Navigate this 3-step wizard: click the link to go to step 2, then the "
            "link to step 3, then press the Finish navigation button."
        ),
        "success": lambda st: any(t["task"] == "nav" for t in st),
    },
    {
        "name": "select-submit",
        "start": f"{SITE}/select.html",
        "prompt": (
            "On this page choose the 'pro' option in the plan dropdown, then press "
            "the Subscribe button."
        ),
        "success": lambda st: any(
            t["task"] == "select" and t["fields"].get("plan") == "pro" for t in st),
    },
    {
        "name": "extract-then-act",
        "start": f"{SITE}/extract.html",
        "prompt": (
            "This page shows a one-time code. Read the code, type it into the entry "
            "box, and press the Verify button."
        ),
        "success": lambda st: any(
            t["task"] == "extract" and t["fields"].get("code") == "AUTH-7391" for t in st),
    },
    {
        "name": "conditional-branch",
        "start": f"{SITE}/branch.html?weather=rain",
        "prompt": (
            "Check the weather status on this page. If it says rainy, press the "
            "'Take umbrella' button; if it says sunny, press 'Take sunglasses'."
        ),
        "success": lambda st: any(
            t["task"] == "branch" and t["fields"].get("choice") == "umbrella" for t in st),
    },
]


# ── Vocabulary shim ─────────────────────────────────────────────────────────
class PerStepVocabularyAdapter:
    """Translate the plan/whitelist vocabulary (click/press) to the executor's
    native action types (left_click/key) for the per-step leg.

    Campaign harness shim, not product code: it papers over a real gap the
    campaign surfaces — the planning loop passes vision-action types straight
    to the executor, whose supported set is the Claude 9 + extension list, so
    a plan saying 'click' is rejected as unsupported per-step while the same
    plan batch-grounds fine. Named in the attestation.
    """

    _MAP = {"click": "left_click", "press": "key", "double_click": "double_click"}

    def __init__(self, inner):
        self._inner = inner

    def __getattr__(self, name):
        return getattr(self._inner, name)

    async def execute(self, action, session_id=None, run_id=None, **kwargs):
        mapped = self._MAP.get(action.action_type)
        if mapped:
            fields = {k: getattr(action, k, None) for k in
                      ("action_id", "action_type", "target", "parameters",
                       "timeout_ms", "retry_count")}
            fields["action_type"] = mapped
            action = type("ActionRequest", (), fields)()
        return await self._inner.execute(action, session_id=session_id,
                                         run_id=run_id or "cu22", **kwargs)


# ── Grant-recording batch client (plays the human on the Rust gate) ─────────
class CampaignBatchClient:
    """Wraps AciBatchClient; auto-approves grant requests via the handoff
    surface and records every grant event for the campaign table."""

    def __init__(self):
        from core.batch_dispatch import AciBatchClient
        self._inner = AciBatchClient()
        self.grants = []  # {approval_id, action_hash, phase}

    @property
    def base_url(self):
        return self._inner.base_url

    async def execute_batch(self, **kwargs):
        from core.batch_dispatch import BatchDispatchResult
        result = await self._inner.execute_batch(**kwargs)
        if getattr(result, "confirmation_required", False) and result.approval_id:
            self.grants.append({"approval_id": result.approval_id,
                                "action_hash": result.action_hash, "phase": "requested"})
            _post_json(f"/api/aci/handoff/{result.approval_id}/approve", {})
            self.grants[-1]["phase"] = "approved"
        return result


def _step_ok(step) -> bool:
    result = getattr(step, "adapter_result", None) or {}
    if not isinstance(result, dict):
        return bool(getattr(step, "action_succeeded", False))
    receipt = result.get("batch_receipt")
    if isinstance(receipt, dict):
        return receipt.get("status") == "completed"
    status = result.get("status")
    if status is not None:
        return status == "completed"
    return bool(getattr(step, "action_succeeded", False))


def _brain_delta(log: Path, pos: int):
    if not log.exists():
        return 0, (0, 0)
    with log.open() as f:
        f.seek(pos)
        calls = [json.loads(l) for l in f if l.strip()]
    return len(calls), (sum(c.get("input_tokens", 0) for c in calls),
                        sum(c.get("output_tokens", 0) for c in calls))


def _post_json(path, body):
    req = urllib.request.Request(
        API + path, data=json.dumps(body).encode(),
        headers={"content-type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=30))


def _site_state():
    import http.client
    conn = http.client.HTTPConnection("127.0.0.1", 18080, timeout=5)
    conn.request("GET", "/state.json")
    resp = conn.getresponse()
    return json.loads(resp.read() or b"[]")


def _reset_task_state(task_name):
    state = [s for s in _site_state() if s.get("task") != task_name]
    (Path(__file__).parent / "site" / "state.json").write_text(json.dumps(state))


def _launch_chrome():
    """Headless Chrome with CDP, unless one is already listening."""
    import socket
    with socket.socket() as s:
        if s.connect_ex(("127.0.0.1", CDP_PORT)) == 0:
            return None
    import subprocess
    chrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    return subprocess.Popen([
        chrome, "--headless=new", f"--remote-debugging-port={CDP_PORT}",
        "--user-data-dir=/tmp/cu22-chrome-profile", "--no-first-run",
        "--window-size=1280,900", "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


async def _navigate_adapter(executor, session_id, url):
    from core.base_adapter import ActionRequest
    req = ActionRequest(action_type="navigate", target=url, parameters={})
    result = await executor.execute(req, session_id=session_id, run_id="cu22-setup")
    return result.to_dict() if result else {}


async def run_one(task, mode, executor, session_id):
    from core.planning_loop import PlanningLoop, PlanningLoopConfig
    from core.vision_providers import SubprocessVisionProvider

    provider = SubprocessVisionProvider()
    client = CampaignBatchClient()
    events = []

    brain_log = Path(os.environ.get("CU22_EVIDENCE", "evidence/brain_calls.jsonl"))
    brain_pos = brain_log.stat().st_size if brain_log.exists() else 0

    async def approval_callback(step):
        events.append({"type": "approval.auto", "step": getattr(step, "step", None)})
        return True  # the campaign harness plays the human

    config = PlanningLoopConfig(
        max_steps=12,
        approval_policy="on-risk",
        record=False,
        reflect_after_each_step=False,   # keep model-turn counting clean
        batch_enabled=(mode == "batched"),
        batch_mode="batch",
        batch_page_url=task["start"],
        timeout_ms=600_000,
        max_cost_usd=50.0,
    )
    loop_adapter = executor if mode == "batched" else PerStepVocabularyAdapter(executor)
    loop = PlanningLoop(
        vision_provider=provider,
        adapter=loop_adapter,
        config=config,
        recorder=None,
        event_callback=lambda e: events.append(e),
        approval_callback=approval_callback,
        ledger=lambda et, payload: events.append({"type": et, "ledger": payload}),
        batch_client=client,
    )

    await _navigate_adapter(executor, session_id, task["start"])
    await asyncio.sleep(1.0)  # let the page settle before the first screenshot

    started = time.time()
    result = await loop.run(task=task["prompt"], session_id=session_id,
                            run_id=f"cu22-{task['name']}-{mode}")
    wall_s = round(time.time() - started, 1)

    state = _site_state()
    brain_calls, brain_tokens = _brain_delta(brain_log, brain_pos)
    step_details = [{
        "step": s.step,
        "action_type": s.action_type,
        "target": s.action_target,
        # per-step success is NOT step.action_succeeded (the loop sets it
        # unconditionally) — read the adapter/batch result instead.
        "ok": _step_ok(s),
        "error": s.error,
        "receipt_id": (s.action_params or {}).get("receipt_id"),
    } for s in result.steps]
    return {
        "task": task["name"],
        "mode": mode,
        "status": result.status,
        "stop_reason": str(result.stop_reason),
        "model_turns": getattr(result, "model_turns", None),
        "brain_calls": brain_calls,
        "brain_input_tokens": brain_tokens[0],
        "brain_output_tokens": brain_tokens[1],
        "steps_attempted": len(result.steps),
        "steps_completed": sum(1 for d in step_details if d["ok"]),
        "step_details": step_details,
        "total_tokens": result.total_tokens,
        "input_tokens": result.total_input_tokens,
        "output_tokens": result.total_output_tokens,
        "wall_s": wall_s,
        "grants": client.grants,
        "n_grants": len(client.grants),
        "batch_events": [e for e in events if str(e.get("type", "")).startswith("batch.")],
        "receipt_ids": [g["approval_id"] for g in client.grants],
        "ground_truth_success": bool(task["success"](state)),
        "error": result.error,
    }


async def main_async(args):
    _launch_chrome()
    from core.computer_use_executor import ComputerUseExecutor
    from adapters.browser.cdp_adapter import PlaywrightCDPAdapter

    executor = ComputerUseExecutor()
    cdp = PlaywrightCDPAdapter(port=CDP_PORT)
    await cdp.initialize()
    executor.register("browser.cdp", cdp)
    print(f"adapters: {executor.registered_adapters()}", flush=True)

    tasks = [t for t in TASKS if args.task in (None, t["name"])]
    modes = ["batched", "per-step"] if args.mode == "both" else [args.mode]
    results = []
    for task in tasks:
        for mode in modes:
            _reset_task_state(task["name"])
            session = f"cu22-{task['name']}-{mode}"
            print(f"--- {task['name']} [{mode}] ---", flush=True)
            try:
                r = await run_one(task, mode, executor, session)
            except Exception as exc:
                r = {"task": task["name"], "mode": mode, "error": f"driver: {exc}"}
            results.append(r)
            print(json.dumps(r, default=str)[:600], flush=True)
            (EVIDENCE_DIR / "campaign").mkdir(parents=True, exist_ok=True)
            out = EVIDENCE_DIR / "campaign" / f"{task['name']}-{mode}.json"
            out.write_text(json.dumps(r, indent=2, default=str))
    summary = EVIDENCE_DIR / "campaign-summary.json"
    summary.write_text(json.dumps(results, indent=2, default=str))
    print(f"\nsummary → {summary}")
    return results


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--task", default=None)
    ap.add_argument("--mode", default="both", choices=["both", "batched", "per-step"])
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()
    if args.list:
        for t in TASKS:
            print(t["name"], "—", t["start"])
        return
    os.environ.setdefault("ALLTERNIT_BRAIN_CMD", sys.executable)
    os.environ.setdefault("ALLTERNIT_BRAIN_ARGS",
                          str(Path(__file__).parent / "brain_wrapper.py"))
    EVIDENCE_DIR.mkdir(exist_ok=True)
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
