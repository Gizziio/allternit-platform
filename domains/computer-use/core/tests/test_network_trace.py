"""
HAR network traces (har-network-traces spec) — H0/H1/H2 unit and integration tests.

Covers:
  * H0 scrub: planted credential canaries (authorization/cookie headers,
    query token, JSON + form payload secrets) must appear NOWHERE in the
    scrubbed HAR; unknown corners carrying a collected secret fail closed
    (HarScrubError, nothing stored).
  * H1 teach: path-template normalization (IDs), payload key-set hashing
    (shapes not values), unverifiable marking for ambiguous groups.
  * H2 verify: every deviation class — wrong method, reordered, extra call,
    missing call, payload key drift, unverifiable marking — plus the
    ReplayEngine / WorkflowRunner wiring and spec validation.
  * H3 chain: two full record → teach → batch (1 grant) → verify runs give
    identical verdicts and receipt hashes (skipped without Playwright).
"""

import asyncio
import hashlib
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

DOMAIN_CORE_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(DOMAIN_CORE_ROOT / "gateway"))
sys.path.insert(0, str(DOMAIN_CORE_ROOT))

_existing_core = sys.modules.get("core")
if _existing_core is not None:
    _existing_file = getattr(_existing_core, "__file__", "") or ""
    if Path(_existing_file).parent != DOMAIN_CORE_ROOT / "core":
        for _name in [
            m for m in list(sys.modules)
            if (m == "core" or m.startswith("core.")) and not m.startswith("core.tests")
        ]:
            del sys.modules[_name]

from core.action_recorder import ActionRecorder, RecordedFrame  # noqa: E402
from core.network_trace import (  # noqa: E402
    DEV_EXTRA,
    DEV_METHOD,
    DEV_MISSING,
    DEV_PAYLOAD,
    DEV_REORDERED,
    HarScrubError,
    NetworkEntry,
    NetworkTrace,
    compare_traces,
    distill_har,
    load_har,
    scrub_har,
    store_scrubbed_har,
)
from core.workflow_runner import (  # noqa: E402
    WorkflowRunner,
    WorkflowValidationError,
    load_workflow_spec,
)

CANARY = "sk-cu27-canary-9f8e7d6c5b4a"
CANARY_COOKIE = "sess-cu27-canary-1a2b3c4d5e6f"


def _entry(url, method="GET", headers=None, query=None, post_data=None,
           response_headers=None, comment=None):
    request = {
        "method": method,
        "url": url,
        "headers": headers or [],
        "queryString": query or [],
    }
    if post_data is not None:
        request["postData"] = post_data
    entry = {
        "request": request,
        "response": {"headers": response_headers or [], "cookies": []},
    }
    if comment is not None:
        entry["comment"] = comment
    return entry


def _har(*entries):
    return {"log": {"version": "1.2", "creator": {"name": "test", "version": "0"},
                    "entries": list(entries)}}


def _json_post(payload):
    return {
        "mimeType": "application/json",
        "text": json.dumps(payload),
    }


# ── H0: scrub ────────────────────────────────────────────────────────────────

class TestScrubHar:
    def test_canary_nowhere_in_scrubbed_har(self):
        har = _har(
            _entry(
                "https://api.example.com/v1/users?token=" + CANARY + "&page=1",
                headers=[
                    {"name": "Authorization", "value": "Bearer " + CANARY},
                    {"name": "Accept", "value": "application/json"},
                    {"name": "Cookie", "value": "session=" + CANARY_COOKIE},
                ],
                query=[
                    {"name": "token", "value": CANARY},
                    {"name": "page", "value": "1"},
                ],
                post_data=_json_post({
                    "name": "Eoj",
                    "nested": {"api_key": CANARY, "keep": "yes"},
                    "list": [{"password": CANARY}],
                }),
                response_headers=[{"name": "Set-Cookie", "value": "x=1"}],
            ),
            _entry(
                "https://api.example.com/v1/login",
                method="POST",
                post_data={
                    "mimeType": "application/x-www-form-urlencoded",
                    "text": "user=eoj&password=" + CANARY + "&session_token=" + CANARY,
                },
            ),
        )
        scrubbed = scrub_har(har)
        serialized = json.dumps(scrubbed, sort_keys=True)

        for canary in (CANARY, CANARY_COOKIE):
            assert canary not in serialized
        request = scrubbed["log"]["entries"][0]["request"]
        by_name = {h["name"]: h["value"] for h in request["headers"]}
        assert by_name["Authorization"] == "[REDACTED]"
        assert by_name["Cookie"] == "[REDACTED]"
        assert by_name["Accept"] == "application/json"
        # URL rebuilt with scrubbed query; non-sensitive param survives.
        assert "token=" + CANARY not in request["url"]
        assert "page=1" in request["url"]
        query_by_name = {q["name"]: q["value"] for q in request["queryString"]}
        assert query_by_name["token"] == "[REDACTED]"
        # JSON payload secrets redacted recursively, shapes kept.
        payload = json.loads(request["postData"]["text"])
        assert payload["nested"]["api_key"] == "[REDACTED]"
        assert payload["nested"]["keep"] == "yes"
        assert payload["list"][0]["password"] == "[REDACTED]"
        # Form body scrubbed.
        login = scrubbed["log"]["entries"][1]["request"]["postData"]["text"]
        assert "password=" + CANARY not in login
        assert "session_token=" + CANARY not in login
        assert "user=eoj" in login

    def test_response_cookie_values_redacted(self):
        har = _har(_entry(
            "https://x.example.com/",
            response_headers=[{"name": "Set-Cookie", "value": "session=" + CANARY}],
        ))
        har["log"]["entries"][0]["response"]["cookies"] = [
            {"name": "session", "value": CANARY_COOKIE},
        ]
        scrubbed = scrub_har(har)
        assert CANARY_COOKIE not in json.dumps(scrubbed, sort_keys=True)
        assert scrubbed["log"]["entries"][0]["response"]["cookies"][0]["value"] == "[REDACTED]"

    def test_survivor_fails_closed(self):
        # The secret is collected from the header and redacted there, but a
        # corner the scrubber does not rewrite carries it verbatim — the
        # post-scrub survivor check must refuse the whole document.
        har = _har(_entry(
            "https://x.example.com/",
            headers=[{"name": "Authorization", "value": "Bearer " + CANARY}],
            comment="echo " + CANARY,
        ))
        with pytest.raises(HarScrubError):
            scrub_har(har)

    def test_non_har_refused(self):
        with pytest.raises(HarScrubError):
            scrub_har({"not": "a har"})
        with pytest.raises(HarScrubError):
            scrub_har({"log": {"entries": "nope"}})

    def test_store_scrubbed_har_never_writes_on_failure(self, tmp_path):
        raw = tmp_path / "raw.har"
        out = tmp_path / "out.har"
        har = _har(_entry(
            "https://x.example.com/",
            headers=[{"name": "Authorization", "value": "Bearer " + CANARY}],
            comment="echo " + CANARY,
        ))
        raw.write_text(json.dumps(har), encoding="utf-8")
        with pytest.raises(HarScrubError):
            store_scrubbed_har(raw, out)
        assert not out.exists()


# ── H1: distill ──────────────────────────────────────────────────────────────

def _trace(*shapes):
    """shapes: (method, host, template, payload_hash, verifiable) tuples."""
    return NetworkTrace(entries=[
        NetworkEntry(method=m, host=h, path_template=t, payload_keys_hash=p, verifiable=v)
        for m, h, t, p, v in shapes
    ])


class TestDistillHar:
    def test_path_templates_normalize_ids(self):
        har = _har(
            _entry("https://h.example.com/users/123/profile"),
            _entry("https://h.example.com/users/456/profile"),
            _entry("https://h.example.com/orders/a1b2c3d4e5f6"),
            _entry("https://h.example.com/u/550e8400-e29b-41d4-a716-446655440000"),
            _entry("https://h.example.com/about"),
        )
        templates = [e.path_template for e in distill_har(har).entries]
        assert templates == [
            "/users/{id}/profile",
            "/users/{id}/profile",
            "/orders/{id}",
            "/u/{id}",
            "/about",
        ]

    def test_ambiguous_group_is_unverifiable_never_guessed(self):
        har = _har(
            _entry("https://h.example.com/x/123"),
            _entry("https://h.example.com/y/456"),
        )
        entries = distill_har(har).entries
        assert all(not e.verifiable for e in entries)
        # Distillation still records shapes; comparison must not assert paths.
        live = _trace(("GET", H, "/anything/else", None, True),
                      ("GET", H, "/more/stuff", None, True))
        assert compare_traces(NetworkTrace(entries=entries), live) == []
        # But count mismatch stays a deviation even for unverifiable entries.
        one_live = _trace(("GET", H, "/anything/else", None, True))
        assert [d.kind for d in compare_traces(
            NetworkTrace(entries=entries), one_live
        )] == [DEV_MISSING]

    def test_payload_key_hash_is_shape_only(self):
        har_a = _har(_entry(
            "https://h.example.com/submit", method="POST",
            post_data=_json_post({"name": "Eoj", "email": "e@x.com"}),
        ))
        har_b = _har(_entry(
            "https://h.example.com/submit", method="POST",
            post_data=_json_post({"name": "OTHER", "email": "o@y.com"}),
        ))
        hash_a = distill_har(har_a).entries[0].payload_keys_hash
        hash_b = distill_har(har_b).entries[0].payload_keys_hash
        assert hash_a == hash_b and hash_a is not None

        har_c = _har(_entry(
            "https://h.example.com/submit", method="POST",
            post_data=_json_post({"name": "Eoj", "phone": "1"}),
        ))
        hash_c = distill_har(har_c).entries[0].payload_keys_hash
        assert hash_c != hash_a

    def test_no_payload_hashes_to_none(self):
        har = _har(_entry("https://h.example.com/"))
        assert distill_har(har).entries[0].payload_keys_hash is None

    def test_non_http_entries_are_not_server_truth(self):
        har = _har(
            _entry("data:text/html,<h1>hi</h1>"),
            _entry("https://h.example.com/real"),
        )
        trace = distill_har(har)
        assert len(trace.entries) == 1
        assert trace.entries[0].host == "h.example.com"

    def test_trace_roundtrip_dict(self):
        har = _har(_entry("https://h.example.com/users/1"))
        trace = distill_har(har)
        assert NetworkTrace.from_dict(trace.to_dict()).to_dict() == trace.to_dict()
        with pytest.raises(ValueError):
            NetworkTrace.from_dict({"version": 99, "entries": []})


# ── H2: compare ──────────────────────────────────────────────────────────────

H = "h.example.com"


def _entry_get(template, host=H, payload=None, verifiable=True):
    return NetworkEntry(
        method="GET", host=host, path_template=template,
        payload_keys_hash=payload, verifiable=verifiable,
    )


class TestCompareTraces:
    def test_exact_match_no_deviations(self):
        recorded = _trace(("GET", H, "/a", None, True), ("POST", H, "/b", "h1", True))
        live = _trace(("GET", H, "/a", None, True), ("POST", H, "/b", "h1", True))
        assert compare_traces(recorded, NetworkTrace(entries=live.entries)) == []

    def test_wrong_method(self):
        recorded = _trace(("GET", H, "/a", None, True))
        live = _trace(("POST", H, "/a", None, True))
        deviations = compare_traces(recorded, NetworkTrace(entries=live.entries))
        assert [d.kind for d in deviations] == [DEV_METHOD]
        assert deviations[0].expected["method"] == "GET"
        assert deviations[0].actual["method"] == "POST"

    def test_reordered(self):
        recorded = _trace(("GET", H, "/a", None, True), ("GET", H, "/b", None, True))
        live = _trace(("GET", H, "/b", None, True), ("GET", H, "/a", None, True))
        deviations = compare_traces(recorded, NetworkTrace(entries=live.entries))
        assert [d.kind for d in deviations] == [DEV_REORDERED]
        # Greedy forward match pairs the first recorded entry wherever it
        # appears ahead; the LATER recorded entry is the one out of order.
        assert deviations[0].index == 1
        assert deviations[0].expected["pathTemplate"] == "/b"

    def test_extra_call(self):
        recorded = _trace(("GET", H, "/a", None, True))
        live = _trace(("GET", H, "/a", None, True), ("GET", H, "/b", None, True))
        deviations = compare_traces(recorded, NetworkTrace(entries=live.entries))
        assert [d.kind for d in deviations] == [DEV_EXTRA]
        assert deviations[0].actual["pathTemplate"] == "/b"

    def test_missing_call_is_count_mismatch(self):
        recorded = _trace(("GET", H, "/a", None, True), ("GET", H, "/b", None, True))
        live = _trace(("GET", H, "/a", None, True))
        deviations = compare_traces(recorded, NetworkTrace(entries=live.entries))
        assert [d.kind for d in deviations] == [DEV_MISSING]

    def test_payload_key_drift(self):
        recorded = _trace(("POST", H, "/submit", "hashA", True))
        live = _trace(("POST", H, "/submit", "hashB", True))
        deviations = compare_traces(recorded, NetworkTrace(entries=live.entries))
        assert [d.kind for d in deviations] == [DEV_PAYLOAD]

    def test_unverifiable_entry_matches_by_method_host_only(self):
        recorded = _trace(("GET", H, "/x/{id}", None, False))
        live = _trace(("GET", H, "/totally/different", "anything", True))
        assert compare_traces(recorded, NetworkTrace(entries=live.entries)) == []

    def test_unverifiable_entry_absent_is_missing(self):
        recorded = _trace(("GET", H, "/x/{id}", None, False))
        live = _trace(("GET", "other.example.com", "/totally/different", None, True))
        assert {d.kind for d in compare_traces(
            recorded, NetworkTrace(entries=live.entries)
        )} == {DEV_MISSING, DEV_EXTRA}

    def test_template_id_position_matches_any_id_like_segment(self):
        recorded = _trace(("GET", H, "/users/{id}", None, True))
        live = _trace(("GET", H, "/users/987654", None, True))
        assert compare_traces(recorded, NetworkTrace(entries=live.entries)) == []
        # A non-ID segment at an {id} position is an exact mismatch: the
        # recorded call is missing AND the live call is extra — two honest
        # deviations, never a fuzzy guess.
        live_literal = _trace(("GET", H, "/users/list", None, True))
        assert {d.kind for d in compare_traces(
            recorded, NetworkTrace(entries=live_literal.entries)
        )} == {DEV_MISSING, DEV_EXTRA}


# ── H1: spec validation ──────────────────────────────────────────────────────

def _spec(network_trace=None):
    spec = {
        "workflowId": "wf-net",
        "title": "Network verify",
        "sourceRunId": "run-1",
        "steps": [{"id": "s1", "kind": "click", "target": {"ref": "#go"},
                   "input": {}, "reason": "go"}],
        "safety": {"requiresApprovalFor": [], "redactions": []},
    }
    if network_trace is not None:
        spec["networkTrace"] = network_trace
    return spec


class TestNetworkTraceSpecValidation:
    def test_absent_trace_is_fine(self):
        load_workflow_spec(_spec())

    def test_valid_trace_accepted(self):
        spec = _spec({"version": 1, "entries": [
            {"method": "GET", "host": H, "pathTemplate": "/a",
             "payloadKeysHash": None, "verifiable": True},
        ]})
        load_workflow_spec(spec)

    @pytest.mark.parametrize("trace", [
        "not-a-dict",
        {"version": 2, "entries": []},
        {"version": 1},
        {"version": 1, "entries": [{"method": "GET", "host": H}]},
        {"version": 1, "entries": [{"method": "GET", "host": H, "pathTemplate": "/a",
                                     "payloadKeysHash": 5}]},
        {"version": 1, "entries": [{"method": "GET", "host": H, "pathTemplate": "/a",
                                     "verifiable": "yes"}]},
    ])
    def test_malformed_trace_refused(self, trace):
        with pytest.raises(WorkflowValidationError):
            load_workflow_spec(_spec(trace))


# ── H2: runner / replay wiring ───────────────────────────────────────────────

def _har_dict(*urls):
    return _har(*[_entry(u) for u in urls])


class _Result:
    def __init__(self, status="completed", error=None):
        self.status = status
        self.error = error


class _Adapter:
    async def execute(self, req):
        return _Result()


class TestWorkflowRunnerNetworkVerify:
    @pytest.mark.asyncio
    async def test_matching_trace_completes_clean(self):
        trace = {"version": 1, "entries": [
            {"method": "GET", "host": H, "pathTemplate": "/a",
             "payloadKeysHash": None, "verifiable": True},
        ]}
        runner = WorkflowRunner(
            adapter=_Adapter(), session_id="s", batch_enabled=False,
            har_finalizer=lambda: _har_dict("https://" + H + "/a"),
        )
        result = await runner.run(_spec(trace))
        assert result.status == "completed"
        assert result.network_deviations == []
        assert result.receipts == []

    @pytest.mark.asyncio
    async def test_deviation_deviates_and_emits_receipt(self):
        trace = {"version": 1, "entries": [
            {"method": "GET", "host": H, "pathTemplate": "/a",
             "payloadKeysHash": None, "verifiable": True},
        ]}
        runner = WorkflowRunner(
            adapter=_Adapter(), session_id="s", batch_enabled=False,
            har_finalizer=lambda: _har_dict(
                "https://" + H + "/a", "https://" + H + "/extra"),
        )
        result = await runner.run(_spec(trace))
        assert result.status == "deviated"
        assert [d["kind"] for d in result.network_deviations] == [DEV_EXTRA]
        assert len(result.receipts) == 1
        assert result.receipts[0]["type"] == "network.deviation"
        assert len(result.receipts[0]["deviation_hash"]) == 64
        # Deterministic receipt hash: same inputs, same hash.
        again = await WorkflowRunner(
            adapter=_Adapter(), session_id="s", batch_enabled=False,
            har_finalizer=lambda: _har_dict(
                "https://" + H + "/a", "https://" + H + "/extra"),
        ).run(_spec(trace))
        assert again.receipts[0]["deviation_hash"] == result.receipts[0]["deviation_hash"]

    @pytest.mark.asyncio
    async def test_deviation_with_approval_callback(self):
        trace = {"version": 1, "entries": [
            {"method": "GET", "host": H, "pathTemplate": "/a",
             "payloadKeysHash": None, "verifiable": True},
        ]}
        pauses = []
        runner = WorkflowRunner(
            adapter=_Adapter(), session_id="s", batch_enabled=False,
            approval_callback=lambda pause: pauses.append(pause) or True,
            har_finalizer=lambda: _har_dict("https://" + H + "/other"),
        )
        result = await runner.run(_spec(trace))
        assert result.status == "completed"  # approved → not deviated
        assert [p.kind for p in pauses] == ["workflow.network_deviation"]
        assert {d["kind"] for d in result.network_deviations} == {DEV_MISSING, DEV_EXTRA}

    @pytest.mark.asyncio
    async def test_no_finalizer_skips_verify_deterministically(self):
        trace = {"version": 1, "entries": [
            {"method": "GET", "host": H, "pathTemplate": "/a",
             "payloadKeysHash": None, "verifiable": True},
        ]}
        runner = WorkflowRunner(adapter=_Adapter(), session_id="s", batch_enabled=False)
        result = await runner.run(_spec(trace))
        assert result.status == "completed"
        assert result.network_deviations == []


class TestReplayEngineNetworkVerify:
    async def _write_recording(self, tmp_path):
        recorder = ActionRecorder(
            recording_id="rec-net", task="t", session_id="s", run_id="r",
            output_dir=tmp_path,
        )
        await recorder.start()
        await recorder.record_frame(RecordedFrame(
            recording_id="rec-net", step=1, action_type="click",
            action_target="#go",
        ))
        await recorder.stop()
        return tmp_path / "rec-net.jsonl"

    @pytest.mark.asyncio
    async def test_network_deviation_becomes_replay_deviation(self, tmp_path):
        from core.network_trace import NetworkTrace, distill_har
        from core.replay_engine import ReplayEngine

        recording = await self._write_recording(tmp_path)
        recorded_trace = distill_har(_har_dict("https://" + H + "/a"))
        engine = ReplayEngine(
            adapter=_Adapter(), session_id="s", deviation_threshold=None,
            network_trace=recorded_trace,
            har_finalizer=lambda: _har_dict("https://" + H + "/a",
                                             "https://" + H + "/extra"),
        )
        result = await engine.replay(recording)
        assert result.status == "deviated"
        kinds = [d.kind for d in result.deviations]
        assert kinds == ["network"]
        detail = json.loads(result.deviations[0].detail)
        assert detail["kind"] == DEV_EXTRA
        assert result.deviations[0].score == 1.0
        assert result.deviations[0].threshold == 0.0

    @pytest.mark.asyncio
    async def test_matching_trace_replay_completes(self, tmp_path):
        from core.network_trace import NetworkTrace, distill_har
        from core.replay_engine import ReplayEngine

        recording = await self._write_recording(tmp_path)
        recorded_trace = distill_har(_har_dict("https://" + H + "/a"))
        engine = ReplayEngine(
            adapter=_Adapter(), session_id="s", deviation_threshold=None,
            network_trace=recorded_trace,
            har_finalizer=lambda: _har_dict("https://" + H + "/a"),
        )
        result = await engine.replay(recording)
        assert result.status == "completed"
        assert result.deviations == []


# ── H0: recorder HAR integration ─────────────────────────────────────────────

class _CanaryHandler(BaseHTTPRequestHandler):
    """Canned form site: GET /form sets a cookie + serves a fetch-submission
    form; POST /submit echoes JSON. Deterministic responses."""

    def log_message(self, *args):  # keep test output clean
        pass

    def _respond(self, code, body, content_type="text/html", cookie=None):
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
            self._respond(
                200,
                "<html><body>"
                "<input id='name' name='name'>"
                "<input id='email' name='email'>"
                "<button id='submit' type='button'>Go</button>"
                "<script>document.getElementById('submit').onclick = () => fetch("
                "'/submit', {method: 'POST', headers: {'Content-Type': "
                "'application/json'}, body: JSON.stringify({name: document."
                "getElementById('name').value, email: document.getElementById("
                "'email').value, csrf_token: window.__csrf || ''})});"
                "</script></body></html>",
                cookie="session=" + CANARY_COOKIE,
            )
        else:
            self._respond(404, "not found", "text/plain")

    def do_POST(self):
        if self.path.startswith("/submit"):
            length = int(self.headers.get("Content-Length", 0))
            self.rfile.read(length)
            self._respond(200, '{"ok": true}', "application/json")
        else:
            self._respond(404, "not found", "text/plain")


def _playwright_available():
    try:
        import playwright  # noqa: F401
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            browser.close()
        return True
    except Exception:
        return False


PW = pytest.mark.skipif(not _playwright_available(), reason="playwright chromium unavailable")


@PW
class TestRecorderHarCapture:
    @pytest.mark.asyncio
    async def test_capture_scrub_and_storage(self, tmp_path):
        server = ThreadingHTTPServer(("127.0.0.1", 0), _CanaryHandler)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        url = f"http://127.0.0.1:{server.server_address[1]}/form"
        try:
            recorder = ActionRecorder(
                recording_id="rec-har", task="form", session_id="s", run_id="r",
                output_dir=tmp_path, record_har=True,
            )
            from playwright.async_api import async_playwright

            await recorder.start()
            pw = await async_playwright().start()
            browser = await pw.chromium.launch(headless=True)
            context = await browser.new_context(**recorder.har_context_options())
            try:
                page = await context.new_page()
                await page.goto(url)
                await page.evaluate(
                    "() => { window.__csrf = %s; }" % json.dumps(CANARY))
                await page.fill("#name", "Eoj")
                await page.fill("#email", "e@x.com")
                async with page.expect_response(
                    lambda r: r.url.endswith("/submit")
                ) as info:
                    await page.click("#submit")
                await info.value
                await recorder.record_frame(RecordedFrame(
                    recording_id="rec-har", step=1, action_type="click",
                    action_target="#submit",
                ))
            finally:
                await context.close()  # Playwright writes the raw HAR here
                await browser.close()
                await pw.stop()
            await recorder.stop()

            har_file = tmp_path / "rec-har.har"
            assert har_file.is_file()
            # Raw artifact destroyed; only the scrubbed HAR persists.
            assert not (tmp_path / ".rec-har.raw.har").exists()
            stored = har_file.read_text(encoding="utf-8")
            for canary in (CANARY, CANARY_COOKIE):
                assert canary not in stored
            assert "[REDACTED]" in stored

            from core.action_recorder import ActionRecorder as _AR
            manifest, _frames = _AR.load(tmp_path / "rec-har.jsonl")
            assert manifest.har_status == "captured"
            assert manifest.har_path == str(har_file)

            # Teach leg rides the scrubbed artifact: shapes only, canary-free.
            trace = distill_har(load_har(har_file))
            assert any(e.path_template == "/submit" for e in trace.entries)
            assert all(e.payload_keys_hash is not None
                       for e in trace.entries if e.path_template == "/submit")
        finally:
            server.shutdown()
            server.server_close()

    def test_scrub_failure_refuses_recording(self, tmp_path):
        recorder = ActionRecorder(
            recording_id="rec-refused", task="t", session_id="s", run_id="r",
            output_dir=tmp_path, record_har=True,
        )
        # Fabricate a raw HAR whose secret survives scrubbing (echoed in a
        # comment corner) — the recorder must refuse, destroy the raw file,
        # and never write the scrubbed artifact.
        raw = tmp_path / ".rec-refused.raw.har"
        raw.parent.mkdir(parents=True, exist_ok=True)
        raw.write_text(json.dumps(_har(
            _entry("https://x.example.com/",
                   headers=[{"name": "Authorization", "value": "Bearer " + CANARY}],
                   comment="echo " + CANARY),
        )), encoding="utf-8")

        loop = asyncio.new_event_loop()
        loop.run_until_complete(recorder.start())
        with pytest.raises(HarScrubError):
            loop.run_until_complete(recorder.stop())
        loop.close()

        assert not raw.exists()
        assert not (tmp_path / "rec-refused.har").exists()
        from core.action_recorder import ActionRecorder as _AR
        manifest, _frames = _AR.load(tmp_path / "rec-refused.jsonl")
        assert manifest.har_status == "refused"
        assert manifest.har_path is None


# ── H3: deterministic full chain ─────────────────────────────────────────────

@PW
class TestChainDeterminism:
    def test_two_full_chain_runs_identical_verdict_and_receipts(self, tmp_path):
        scripts_dir = DOMAIN_CORE_ROOT / "scripts"
        if not (scripts_dir / "har_chain_e2e.py").is_file():
            pytest.skip("har_chain_e2e.py not present")
        sys.path.insert(0, str(scripts_dir))
        try:
            import har_chain_e2e as chain
        finally:
            sys.path.remove(str(scripts_dir))

        verdict_a = chain.run_chain(tmp_path / "run-a")
        verdict_b = chain.run_chain(tmp_path / "run-b")
        assert verdict_a == verdict_b
        assert verdict_a["network"]["status"] == "pass"
        assert verdict_a["workflow_status"] == "completed"
        assert verdict_a["receipt_hash"] == verdict_b["receipt_hash"]
        assert verdict_a["canary_absent"] is True
        # Receipt hashes are content-derived and independently reproducible.
        receipt_a = json.loads((tmp_path / "run-a" / "receipt.json").read_text())
        digest = hashlib.sha256(
            json.dumps(receipt_a, sort_keys=True, separators=(",", ":")).encode("utf-8")
        ).hexdigest()
        assert digest == verdict_a["receipt_hash"]
