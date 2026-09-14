"""
HAR network traces — deterministic end-to-end chain (har-network-traces H3).

One command runs the full record → teach → batch (1 grant) → verify chain
against a local canned form site:

    python domains/computer-use/core/scripts/har_chain_e2e.py

Chain legs (all deterministic — same site state, same verdict, every time):

  1. RECORD  — ActionRecorder with HAR capture on a real Playwright context.
               The recorder scrubs the HAR BEFORE storage; a planted
               credential canary must appear nowhere (fail closed).
  2. TEACH    — the scrubbed HAR is distilled into a NetworkTrace (shapes
               only) and attached to a BrowserWorkflowSpec.
  3. BATCH    — WorkflowRunner compiles the spec's whitelisted steps into ONE
               grant-bound batch through a local executor (same
               BatchDispatchResult contract as AciBatchClient): the first
               dispatch returns confirmation_required, the approval callback
               grants once, the retry executes the steps in a fresh context
               with its own live HAR capture and returns a content-derived
               deterministic receipt.
  4. VERIFY   — the runner compares the live NetworkTrace against the
               recorded one (exact ordered match → ReplayDeviation-style
               entries + receipt fragments on any mismatch) and the script
               diffs the recorded vs live DOM through the existing a11y
               diff_tree machinery.

``run_chain(artifact_dir)`` returns the verdict dict; ``main()`` runs the
chain twice and asserts identical verdicts and identical receipt hashes.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]
for _extra in (str(DOMAIN_CORE_ROOT), str(DOMAIN_CORE_ROOT / "gateway")):
    if _extra not in sys.path:
        sys.path.insert(0, _extra)

CANARY = "sk-cu27-e2e-canary-1123581321345589"
CANARY_COOKIE = "cu27e2esesscookycanary22360679"
SITE_PORT = 8734
GRANT_ID = "grant-cu27-e2e"
RECIPIENT_NAME = "Eoj"
RECIPIENT_EMAIL = "eoj@example.com"

FORM_HTML = (
    "<html><head><link rel=\"icon\" href=\"data:,\"></head><body>"
    "<form id=\"f\">"
    "<input id=\"name\" name=\"name\">"
    "<input id=\"email\" name=\"email\">"
    "<button id=\"submit\" type=\"button\">Go</button>"
    "</form>"
    "<script>document.getElementById('submit').onclick = () => fetch("
    "'/submit', {method: 'POST', headers: {'Content-Type': "
    "'application/json'}, body: JSON.stringify({name: document."
    "getElementById('name').value, email: document.getElementById("
    "'email').value, csrf_token: '" + CANARY + "'})});</script>"
    "</body></html>"
)


def _canonical_hash(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


class _SiteHandler(BaseHTTPRequestHandler):
    """Canned form site. Deterministic: fixed responses, no clocks, no uuids."""

    def log_message(self, *args):
        pass

    def _respond(self, code: int, body: str, content_type: str = "text/html",
                 cookie: Optional[str] = None) -> None:
        data = body.encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if self.path.startswith("/form"):
            self._respond(200, FORM_HTML, cookie="session=" + CANARY_COOKIE)
        elif self.path.startswith("/favicon.ico"):
            self._respond(204, "")
        else:
            self._respond(404, "not found", "text/plain")

    def do_POST(self):
        if self.path.startswith("/submit"):
            length = int(self.headers.get("Content-Length", 0))
            self.rfile.read(length)
            self._respond(200, '{"ok": true}', "application/json")
        else:
            self._respond(404, "not found", "text/plain")


def _start_site() -> ThreadingHTTPServer:
    server = ThreadingHTTPServer(("127.0.0.1", SITE_PORT), _SiteHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server


_DOM_SNAPSHOT_JS = """
() => {
  const label = (el) => {
    if (el.id) return '#' + el.id;
    const text = (el.childNodes.length === 1 && el.firstChild.nodeType === 3)
      ? el.textContent.trim().slice(0, 40) : '';
    return text;
  };
  const walk = (el) => ({
    role: el.tagName.toLowerCase(),
    name: label(el),
    value: ('value' in el) ? String(el.value) : '',
    children: Array.from(el.children).map(walk),
  });
  return walk(document.body);
}
"""


def _dict_to_ax_node(data: Dict[str, Any]) -> Any:
    """Convert a DOM snapshot dict into an AccessibilityNode for diff_tree."""
    from core.accessibility_inspector import AccessibilityNode

    return AccessibilityNode(
        role=str(data.get("role", "")),
        name=str(data.get("name", "")),
        value=str(data.get("value", "")),
        bounds=(0.0, 0.0, 0.0, 0.0),
        children=[_dict_to_ax_node(child) for child in data.get("children", [])],
    )


def _diff_summary(old_dict: Dict[str, Any], new_dict: Dict[str, Any]) -> Dict[str, int]:
    """a11y leg: run the recorded vs live DOM through the existing diff_tree."""
    from core.accessibility_inspector import diff_tree

    summary = {"added": 0, "removed": 0, "modified": 0}

    def _count(node: Any) -> None:
        change = getattr(node, "change_type", None)
        if change in summary:
            summary[change] += 1
        for child in getattr(node, "children", []) or []:
            _count(child)

    diffed = diff_tree(_dict_to_ax_node(old_dict), _dict_to_ax_node(new_dict))
    if diffed is not None:
        _count(diffed)
    return summary


async def _drive_form(page: Any, name: str, email: str) -> None:
    """The canned form-fill task: fill name, fill email, click submit."""
    await page.fill("#name", name)
    await page.fill("#email", email)
    async with page.expect_response(lambda resp: resp.url.endswith("/submit")) as info:
        await page.click("#submit")
    await info.value


class _NoopAdapter:
    """Fallback adapter (only used if the batch path declines)."""

    async def execute(self, req):
        return type("R", (), {"status": "completed", "error": None})()


class _LocalBatchExecutor:
    """Deterministic local batch executor with the AciBatchClient contract.

    First dispatch: confirmation_required (the one-grant gate). Approved
    retry: executes the whitelist steps in a fresh Playwright context with
    live HAR capture and returns a content-derived receipt — no timestamps,
    no uuids, so receipt hashes are reproducible.
    """

    def __init__(self, raw_live_har: Path) -> None:
        self._raw_live_har = raw_live_har
        self.receipt_id: Optional[str] = None
        self.descriptor_hash: Optional[str] = None
        self.receipt: Optional[Dict[str, Any]] = None
        self.live_dom: Optional[Dict[str, Any]] = None
        self.grant_requests = 0

    async def execute_batch(self, *, steps, mode, origin="aci.batch", session=None,
                            page_url=None, approval_id=None, step_approval_ids=None,
                            headless=True):
        from core.batch_dispatch import BatchDispatchResult

        if approval_id != GRANT_ID:
            self.grant_requests += 1
            return BatchDispatchResult(
                executed=False,
                confirmation_required=True,
                approval_id=GRANT_ID,
                action_hash="ahash-" + _canonical_hash({"steps": steps})[:12],
                status_code=403,
            )

        from playwright.async_api import async_playwright

        pw = await async_playwright().start()
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(record_har_path=str(self._raw_live_har))
        try:
            page = await context.new_page()
            if page_url:
                await page.goto(page_url)
            receipt_steps: List[Dict[str, Any]] = []
            halted_at = None
            for index, step in enumerate(steps):
                ok = await self._run_step(page, step)
                receipt_steps.append({
                    "index": index,
                    "status": "completed" if ok else "failed",
                    "method": step["method"],
                    "selector": step["selector"],
                })
                if not ok:
                    halted_at = index
                    break
            self.live_dom = await page.evaluate(_DOM_SNAPSHOT_JS)
            status = "completed" if halted_at is None else "halted"
        finally:
            # Closing the context flushes the live HAR before the runner's
            # har_finalizer reads it.
            await context.close()
            await browser.close()
            await pw.stop()

        receipt = {"status": status, "halted_at": halted_at, "steps": receipt_steps}
        self.receipt = receipt
        self.receipt_id = "rcpt-" + _canonical_hash(receipt)[:16]
        self.descriptor_hash = "desc-" + _canonical_hash({"steps": steps})[:16]
        return BatchDispatchResult(
            executed=True,
            descriptor_hash=self.descriptor_hash,
            receipt_id=self.receipt_id,
            receipt=receipt,
            enforcement="one_grant",
            status_code=200,
        )

    async def _run_step(self, page: Any, step: Dict[str, Any]) -> bool:
        method = step["method"]
        selector = step["selector"]
        arguments = step.get("arguments") or []
        try:
            if method == "click":
                async with page.expect_response(
                    lambda resp: resp.url.endswith("/submit"), timeout=5000
                ) as info:
                    await page.click(selector)
                await info.value
            elif method == "fill":
                await page.fill(selector, arguments[0] if arguments else "")
            elif method == "press":
                await page.press(selector, arguments[0] if arguments else "Enter")
            elif method == "scrollTo":
                await page.evaluate("() => window.scrollTo(0, 0)")
            else:
                return False
            return True
        except Exception:
            return False


def _spec(trace_dict: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "schemaVersion": "1.0",
        "workflowId": "wf-cu27-e2e-form",
        "title": "CU27 canned form fill",
        "sourceRunId": "run-cu27-e2e",
        "provider": "playwright",
        "inputs": [],
        "steps": [
            {"id": "s1", "kind": "type", "target": {"ref": "#name"},
             "input": {"text": RECIPIENT_NAME}, "reason": "fill name"},
            {"id": "s2", "kind": "type", "target": {"ref": "#email"},
             "input": {"text": RECIPIENT_EMAIL}, "reason": "fill email"},
            {"id": "s3", "kind": "click", "target": {"ref": "#submit"},
             "input": {}, "reason": "submit the form"},
        ],
        "safety": {"requiresApprovalFor": [], "redactions": []},
        "networkTrace": trace_dict,
    }


async def _record_leg(artifacts: Path, site_url: str) -> Dict[str, Any]:
    """H0+H1: record the canned task with HAR capture, teach the trace."""
    from core.action_recorder import ActionRecorder, RecordedFrame
    from core.network_trace import distill_har, load_har

    recorder = ActionRecorder(
        recording_id="rec-cu27-e2e",
        task="canned form fill",
        session_id="cu27-e2e",
        run_id="run-cu27-e2e",
        output_dir=artifacts,
        record_har=True,
    )
    await recorder.start()

    from playwright.async_api import async_playwright

    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=True)
    context = await browser.new_context(**recorder.har_context_options())
    try:
        page = await context.new_page()
        await page.goto(f"{site_url}/form?token={CANARY}")
        await page.fill("#name", RECIPIENT_NAME)
        await recorder.record_frame(RecordedFrame(
            recording_id=recorder.recording_id, step=1, action_type="type",
            action_target="#name",
        ))
        await page.fill("#email", RECIPIENT_EMAIL)
        await recorder.record_frame(RecordedFrame(
            recording_id=recorder.recording_id, step=2, action_type="type",
            action_target="#email",
        ))
        async with page.expect_response(lambda resp: resp.url.endswith("/submit")) as info:
            await page.click("#submit")
        await info.value
        await recorder.record_frame(RecordedFrame(
            recording_id=recorder.recording_id, step=3, action_type="click",
            action_target="#submit",
        ))
        recorded_dom = await page.evaluate(_DOM_SNAPSHOT_JS)
    finally:
        await context.close()
        await browser.close()
        await pw.stop()

    await recorder.stop()  # scrubs the HAR; HarScrubError fails closed

    har_file = Path(recorder.manifest.har_path)
    stored = har_file.read_text(encoding="utf-8")
    if CANARY in stored or CANARY_COOKIE in stored:
        raise RuntimeError("canary leaked into stored HAR — chain refused")

    trace = distill_har(load_har(har_file))
    return {"trace": trace, "recorded_dom": recorded_dom}


async def _run_chain_async(artifacts: Path) -> Dict[str, Any]:
    from core.network_trace import load_har, store_scrubbed_har
    from core.workflow_runner import WorkflowRunner

    artifacts.mkdir(parents=True, exist_ok=True)
    site_url = f"http://127.0.0.1:{SITE_PORT}"
    server = _start_site()
    try:
        record = await _record_leg(artifacts, site_url)

        raw_live = artifacts / ".live.raw.har"
        scrubbed_live = artifacts / "live.har"
        executor = _LocalBatchExecutor(raw_live)

        async def _finalize_live_har() -> Dict[str, Any]:
            # Scrub failure raises HarScrubError — the chain fails closed.
            store_scrubbed_har(raw_live, scrubbed_live)
            return load_har(scrubbed_live)

        approvals: List[str] = []
        runner = WorkflowRunner(
            adapter=_NoopAdapter(),
            session_id="cu27-e2e",
            batch_client=executor,
            batch_page_url=f"{site_url}/form",
            batch_enabled=True,
            approval_callback=lambda pause: approvals.append(pause.kind) or True,
            har_finalizer=_finalize_live_har,
        )
        result = await runner.run(_spec(record["trace"].to_dict()))
        if raw_live.is_file():
            raw_live.unlink()

        for canary in (CANARY, CANARY_COOKIE):
            if canary in json.dumps(record["trace"].to_dict(), sort_keys=True):
                raise RuntimeError("canary leaked into NetworkTrace — chain refused")
            if scrubbed_live.is_file() and canary in scrubbed_live.read_text("utf-8"):
                raise RuntimeError("canary leaked into live HAR — chain refused")

        a11y = _diff_summary(record["recorded_dom"], executor.live_dom or {})

        receipt_hash = _canonical_hash(executor.receipt or {})
        (artifacts / "receipt.json").write_text(
            json.dumps(executor.receipt, indent=2, sort_keys=True), encoding="utf-8"
        )

        return {
            "network": {
                "status": "pass" if not result.network_deviations else "deviated",
                "deviations": result.network_deviations,
            },
            "workflow_status": result.status,
            "grant_requests": executor.grant_requests,
            "approvals": sorted(approvals),
            "receipt_id": executor.receipt_id,
            "receipt_hash": receipt_hash,
            "descriptor_hash": executor.descriptor_hash,
            "trace": record["trace"].to_dict(),
            "a11y": a11y,
            "canary_absent": True,
        }
    finally:
        server.shutdown()
        server.server_close()


def run_chain(artifact_dir: Any) -> Dict[str, Any]:
    """Run the full chain once and return the deterministic verdict dict."""
    return asyncio.run(_run_chain_async(Path(artifact_dir)))


def main() -> int:
    import tempfile

    base = Path(tempfile.mkdtemp(prefix="cu27-har-chain-"))
    verdict_a = run_chain(base / "run-a")
    verdict_b = run_chain(base / "run-b")
    if verdict_a != verdict_b:
        raise SystemExit(
            "chain is NOT deterministic:\n"
            + json.dumps({"run_a": verdict_a, "run_b": verdict_b},
                         indent=2, sort_keys=True, default=str)
        )
    if verdict_a["receipt_hash"] != verdict_b["receipt_hash"]:
        raise SystemExit("receipt hashes differ across runs")
    print(json.dumps({"deterministic": True, "verdict": verdict_a},
                     indent=2, sort_keys=True))
    print(f"\nartifacts: {base}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
