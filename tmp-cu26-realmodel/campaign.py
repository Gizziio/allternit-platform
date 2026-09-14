#!/usr/bin/env python3
"""cu26 — F1 (observation-disconnect fix) real-model re-run campaign.

Reuses the cu22 D3 campaign harness verbatim where possible (same five task
shapes, same brain path — codex CLI / gpt-6-astra through
tmp-cu26-realmodel/brain_wrapper.py, same Rust grant gate with the harness
playing the human) so the numbers are directly comparable to
tmp-cu22-realmodel/evidence/campaign-summary.json.

Deltas vs the cu22 harness, all campaign-side (no product code touched):
  - THREE arms over the same tasks:
      (a) per-step baseline            — mode=per-step
      (c) batch dispatch with F1 fixed — mode=batched --arm f1 (main as-is,
          post_batch_observation preferred by the loop's OBSERVE phase)
      (b) batch dispatch pre-F1        — mode=batched --arm pre-f1; the harness
          strips post_batch_observation from the AciBatchClient result BEFORE
          the planning loop sees it, which reproduces pre-PR#480 semantics
          exactly (pre-F1 code never produced the field; the loop then observes
          through the stale adapter path — the cu22 condition).
  - The cu22 shims are dropped because cu24 landed them as product behavior:
      * PerStepVocabularyAdapter — F2 (PR #480, PLAN_ACTION_MAP) translates
        plan vocabulary at the executor boundary.
      * CampaignVisionProvider 170 s override — F3 made the brain timeout
        configurable (ALLTERNIT_BRAIN_TIMEOUT_S, default 240 s CLI path).
  - Own ports/profile so this campaign never touches the cu22 leftovers:
    site :18081, CDP :9333, API :18113, /tmp/cu26-chrome-profile.
  - Per-arm evidence dirs: evidence/<arm>/brain_calls.jsonl + campaign/.

Usage:
  python campaign.py --arm f1 [--task NAME] [--mode batched|per-step] [--list]
  python campaign.py --arm pre-f1 --mode batched
"""

import argparse
import asyncio
import json
import logging
import os
import sys
import time
import urllib.request
from pathlib import Path
from typing import List
from urllib.parse import urlparse

REPO = Path(__file__).resolve().parents[1]
CORE = REPO / "domains/computer-use/core"
sys.path.insert(0, str(CORE))

API = os.environ.get("ALLTERNIT_API_URL", "http://127.0.0.1:18113")
SITE = os.environ.get("CU26_SITE", "http://127.0.0.1:18081")
CDP_PORT = int(os.environ.get("ACU_CDP_PORT", "9333"))
ARM = os.environ.get("CU26_ARM", "f1")
EVIDENCE_DIR = Path(__file__).parent / "evidence" / ARM

TASKS = [
    {
        "name": "form-fill",
        "state_key": "form",
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
        "state_key": "nav",
        "start": f"{SITE}/nav.html",
        "prompt": (
            "Navigate this 3-step wizard: click the link to go to step 2, then the "
            "link to step 3, then press the Finish navigation button."
        ),
        "success": lambda st: any(t["task"] == "nav" for t in st),
    },
    {
        "name": "select-submit",
        "state_key": "select",
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
        "state_key": "extract",
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
        "state_key": "branch",
        "start": f"{SITE}/branch.html?weather=rain",
        "prompt": (
            "Check the weather status on this page. If it says rainy, press the "
            "'Take umbrella' button; if it says sunny, press 'Take sunglasses'."
        ),
        "success": lambda st: any(
            t["task"] == "branch" and t["fields"].get("choice") == "umbrella" for t in st),
    },
]


# ── Log capture ──────────────────────────────────────────────────────────────
class _LogCapture(logging.Handler):
    lines: list = []

    def emit(self, record):
        self.lines.append(record.getMessage())


# ── Grant-recording batch client (plays the human on the Rust gate) ─────────
class CampaignBatchClient:
    """Wraps AciBatchClient; auto-approves grant requests via the handoff
    surface and records every grant event for the campaign table.

    --arm pre-f1: strips post_batch_observation from the result before the
    planning loop sees it, reproducing pre-PR#480 OBSERVE semantics on fixed
    code (the cu22 stale-adapter condition) without touching product code.
    """

    def __init__(self, strip_observation: bool = False):
        from core.batch_dispatch import AciBatchClient
        self._inner = AciBatchClient()
        self.grants = []  # {approval_id, action_hash, phase}
        self.strip_observation = strip_observation

    @property
    def base_url(self):
        return self._inner.base_url

    async def execute_batch(self, **kwargs):
        from core.batch_dispatch import BatchDispatchResult
        result = await self._inner.execute_batch(**kwargs)
        if self.strip_observation and isinstance(result, BatchDispatchResult):
            result.post_batch_observation = None
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
    port = urlparse(SITE).port or 80
    conn = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    conn.request("GET", "/state.json")
    resp = conn.getresponse()
    return json.loads(resp.read() or b"[]")


def _reset_task_state(state_key):
    state = [s for s in _site_state() if s.get("task") != state_key]
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
        "--user-data-dir=/tmp/cu26-chrome-profile", "--no-first-run",
        "--window-size=1280,900", "about:blank",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


async def _navigate_adapter(executor, session_id, url):
    from core.base_adapter import ActionRequest
    req = ActionRequest(action_type="navigate", target=url, parameters={})
    result = await executor.execute(req, session_id=session_id, run_id="cu26-setup")
    return result.to_dict() if result else {}


async def run_one(task, mode, executor, session_id):
    from core.planning_loop import PlanningLoop, PlanningLoopConfig
    from core.vision_providers import SubprocessVisionProvider

    provider = SubprocessVisionProvider()
    client = CampaignBatchClient(strip_observation=(ARM == "pre-f1" and mode == "batched"))
    events = []

    brain_log = Path(os.environ.get("CU26_EVIDENCE", str(EVIDENCE_DIR / "brain_calls.jsonl")))
    brain_pos = brain_log.stat().st_size if brain_log.exists() else 0
    log_lines: List[str] = []

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
    capture = _LogCapture()
    capture.lines = log_lines
    for logger_name in ("core.computer_use_executor", "core.planning_loop",
                        "core.batch_dispatch", "adapters.browser.cdp_adapter"):
        logging.getLogger(logger_name).addHandler(capture)
    loop = PlanningLoop(
        vision_provider=provider,
        adapter=executor,
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
    try:
        result = await loop.run(task=task["prompt"], session_id=session_id,
                                run_id=f"cu26-{task['name']}-{mode}-{ARM}")
    finally:
        for logger_name in ("core.computer_use_executor", "core.planning_loop",
                            "core.batch_dispatch", "adapters.browser.cdp_adapter"):
            logging.getLogger(logger_name).removeHandler(capture)
    wall_s = round(time.time() - started, 1)

    state = _site_state()
    brain_calls, brain_tokens = _brain_delta(brain_log, brain_pos)
    step_details = [{
        "step": s.step,
        "action_type": s.action_type,
        "target": s.action_target,
        "ok": _step_ok(s),
        "error": s.error,
        "receipt_id": (s.action_params or {}).get("receipt_id"),
    } for s in result.steps]
    return {
        "task": task["name"],
        "mode": mode,
        "arm": ARM,
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
        "events": events,
        "dispatch_log": log_lines,
    }


async def main_async(args):
    _launch_chrome()
    from core.computer_use_executor import ComputerUseExecutor
    from adapters.browser.cdp_adapter import PlaywrightCDPAdapter

    executor = ComputerUseExecutor()
    cdp = PlaywrightCDPAdapter(port=CDP_PORT)
    await cdp.initialize()
    executor.register("browser.cdp", cdp)
    print(f"adapters: {executor.registered_adapters()}  arm={ARM}", flush=True)

    tasks = [t for t in TASKS if args.task in (None, t["name"])]
    modes = ["batched", "per-step"] if args.mode == "both" else [args.mode]
    results = []
    for task in tasks:
        for mode in modes:
            _reset_task_state(task["state_key"])
            session = f"cu26-{task['name']}-{mode}-{ARM}"
            print(f"--- {task['name']} [{mode}] arm={ARM} ---", flush=True)
            try:
                r = await run_one(task, mode, executor, session)
            except Exception as exc:
                r = {"task": task["name"], "mode": mode, "arm": ARM,
                     "error": f"driver: {exc}"}
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
    ap.add_argument("--arm", default=os.environ.get("CU26_ARM", "f1"),
                    choices=["f1", "pre-f1"])
    ap.add_argument("--list", action="store_true")
    args = ap.parse_args()
    os.environ["CU26_ARM"] = args.arm
    global ARM, EVIDENCE_DIR
    ARM = args.arm
    EVIDENCE_DIR = Path(__file__).parent / "evidence" / ARM
    if args.list:
        for t in TASKS:
            print(t["name"], "—", t["start"])
        return
    os.environ.setdefault("ALLTERNIT_BRAIN_CMD", sys.executable)
    os.environ.setdefault("ALLTERNIT_BRAIN_ARGS",
                          str(Path(__file__).parent / "brain_wrapper.py"))
    os.environ.setdefault("ALLTERNIT_BRAIN_TIMEOUT_S", "240")
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
