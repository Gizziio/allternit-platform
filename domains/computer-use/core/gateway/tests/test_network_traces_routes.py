#!/usr/bin/env python3
"""
Tests for the network-traces surface routes (har-network-traces surfaces, cu28).

Contract under test: gateway/network_traces_router.py — the distilled-shape
/v1/browser-skills list/inspect/verify API. Raw HAR never crosses these
routes; refusal cases (no trace, bad target, unknown skill) are pinned here.

Run from domains/computer-use/core/gateway:
    PYTHONPATH=".." python -m pytest tests/test_network_traces_routes.py -q
"""

import hashlib
import json
import sys
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

GATEWAY_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(GATEWAY_DIR.parent))  # domains/computer-use/core

from core.network_trace import _payload_key_hash  # noqa: E402
from gateway import network_traces_router  # noqa: E402
from gateway.network_traces_router import router as network_traces_router_module  # noqa: E402

try:
    from scripts.har_chain_e2e import _start_site as _start_canned_site
    _PLAYWRIGHT_AVAILABLE = True
except Exception:  # pragma: no cover
    _PLAYWRIGHT_AVAILABLE = False

SITE_PORT = 8734


def _spec(trace_entries, workflow_id="wf-test-target"):
    return {
        "schemaVersion": "1.0",
        "workflowId": workflow_id,
        "title": "cu28 target verify test",
        "provider": "playwright",
        "inputs": [],
        "steps": [
            {"id": "s1", "kind": "type", "target": {"ref": "#name"},
             "input": {"text": "Eoj"}, "reason": "fill name"},
            {"id": "s2", "kind": "type", "target": {"ref": "#email"},
             "input": {"text": "eoj@example.com"}, "reason": "fill email"},
            {"id": "s3", "kind": "click", "target": {"ref": "#submit"},
             "input": {}, "reason": "submit the form"},
        ],
        "safety": {"requiresApprovalFor": [], "redactions": []},
        "networkTrace": {"version": 1, "entries": trace_entries},
    }


def _form_submit_payload_hash():
    body = {"csrf_token": "", "email": "eoj@example.com", "name": "Eoj"}
    return _payload_key_hash({"text": json.dumps(body)})


def _matching_trace_entries(host):
    """Trace distilled from the canned site: GET /form then POST /submit."""
    return [
        {"method": "GET", "host": host, "pathTemplate": "/form",
         "payloadKeysHash": None, "verifiable": True},
        {"method": "POST", "host": host, "pathTemplate": "/submit",
         "payloadKeysHash": _form_submit_payload_hash(), "verifiable": True},
    ]


@pytest.fixture()
def client():
    app = FastAPI()
    app.include_router(network_traces_router_module)
    return TestClient(app)


@pytest.fixture()
def skills_dir(tmp_path, monkeypatch):
    """Point both routers' skill store at a temp dir."""
    root = tmp_path / "browser-skills"
    root.mkdir()
    monkeypatch.setattr(network_traces_router, "_SKILLS_DIR", root)
    import browser_skills_router
    monkeypatch.setattr(browser_skills_router, "_SKILLS_DIR", root)
    return root


@pytest.fixture()
def canned_site():
    """Run the deterministic canned form site on its fixed port."""
    if not _PLAYWRIGHT_AVAILABLE:
        pytest.skip("har_chain_e2e unavailable")
    server = _start_canned_site()
    try:
        yield f"http://127.0.0.1:{SITE_PORT}"
    finally:
        server.shutdown()
        server.server_close()


def _write_skill(skills_dir: Path, skill_id: str, spec: dict) -> Path:
    path = skills_dir / f"{skill_id}.json"
    path.write_text(json.dumps(spec), encoding="utf-8")
    return path


# ---------------------------------------------------------------------------
# List / inspect — distilled shapes only
# ---------------------------------------------------------------------------

def test_list_empty_when_no_skills_dir(client, skills_dir):
    body = client.get("/v1/browser-skills").json()
    assert body["specs"] == []
    assert body["count"] == 0


def test_list_returns_distilled_summaries(client, skills_dir):
    _write_skill(skills_dir, "skill-with-trace",
                 _spec(_matching_trace_entries("example.test"), "wf-a"))
    _write_skill(skills_dir, "skill-broken", {"not": "a spec"})

    body = client.get("/v1/browser-skills").json()
    assert body["count"] == 2
    by_id = {s["skill_id"]: s for s in body["specs"]}

    good = by_id["skill-with-trace"]
    assert good["valid"] is True
    assert good["workflowId"] == "wf-a"
    assert good["stepCount"] == 3
    assert good["hasNetworkTrace"] is True
    assert good["networkTraceEntries"] == 2
    # Distilled list: no step bodies, no trace payload.
    assert "steps" not in good
    assert "networkTrace" not in good

    broken = by_id["skill-broken"]
    assert broken["valid"] is False
    assert broken["error"]


def test_inspect_returns_distilled_shape(client, skills_dir):
    secret_value = "super-secret-input-value-998877"
    spec = _spec(_matching_trace_entries("example.test"))
    spec["steps"][0]["input"]["text"] = secret_value
    _write_skill(skills_dir, "skill-detail", spec)

    body = client.get("/v1/browser-skills/skill-detail").json()
    workflow = body["workflow"]
    assert workflow["workflowId"] == "wf-test-target"
    assert workflow["stepCount"] == 3
    assert [s["kind"] for s in workflow["steps"]] == ["type", "type", "click"]
    assert workflow["steps"][0]["target"] == "#name"
    # Step payload values are distilled away — never cross the API.
    assert secret_value not in json.dumps(body)
    # The NetworkTrace DOES cross (shapes only by construction).
    trace = workflow["networkTrace"]
    assert trace["version"] == 1
    assert {e["pathTemplate"] for e in trace["entries"]} == {"/form", "/submit"}
    for entry in trace["entries"]:
        assert set(entry) == {"method", "host", "pathTemplate", "payloadKeysHash", "verifiable"}


def test_inspect_unknown_skill_404(client, skills_dir):
    resp = client.get("/v1/browser-skills/nope")
    assert resp.status_code == 404


def test_inspect_invalid_spec_422(client, skills_dir):
    _write_skill(skills_dir, "skill-invalid", {"workflowId": "wf-x", "steps": []})
    resp = client.get("/v1/browser-skills/skill-invalid")
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Refusal cases
# ---------------------------------------------------------------------------

def test_verify_refuses_spec_without_network_trace(client, canned_site):
    spec = _spec([])
    spec.pop("networkTrace")
    resp = client.post("/v1/browser-skills/verify", json={
        "workflow": spec,
        "target_url": canned_site + "/form",
    })
    assert resp.status_code == 400
    assert "networkTrace" in resp.json()["detail"]


def test_verify_refuses_non_http_target(client):
    spec = _spec(_matching_trace_entries("example.test"))
    resp = client.post("/v1/browser-skills/verify", json={
        "workflow": spec,
        "target_url": "file:///etc/passwd",
    })
    assert resp.status_code == 400


def test_verify_unknown_skill_404(client, skills_dir):
    resp = client.post("/v1/browser-skills/verify", json={
        "skill_id": "missing",
        "target_url": "http://127.0.0.1:8734/form",
    })
    assert resp.status_code == 404


def test_verify_result_unknown_404(client):
    resp = client.get("/v1/browser-skills/verify/verify-nope")
    assert resp.status_code == 404


def test_receipt_check_refuses_while_running(client):
    entry = network_traces_router._verify_store.create("verify-running", mode="canned", meta={})
    resp = client.get("/v1/browser-skills/verify/verify-running/receipt/check")
    assert resp.status_code == 409
    assert entry["status"] == "running"


# ---------------------------------------------------------------------------
# Deterministic verify runs (real chain machinery, local canned site)
# ---------------------------------------------------------------------------

@pytest.mark.skipif(not _PLAYWRIGHT_AVAILABLE, reason="har_chain_e2e/playwright unavailable")
def test_canned_verify_deterministic_pass(client):
    resp = client.post("/v1/browser-skills/verify?wait=true", json={})
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "completed"
    assert body["mode"] == "canned"
    assert body["network"]["status"] == "pass"
    assert body["network"]["deviations"] == []
    assert body["canary_absent"] is True
    assert body["a11y"] == {"added": 0, "removed": 0, "modified": 0}

    # Distilled GET: receipt dict itself stays server-side.
    fetched = client.get(f"/v1/browser-skills/verify/{body['verify_id']}").json()
    assert fetched["receipt_id"] == body["receipt_id"]
    assert fetched["receipt_hash"] == body["receipt_hash"]
    assert "receipt" not in fetched
    # The planted canary never appears anywhere in the API surface.
    assert "sk-cu27" not in json.dumps(fetched)

    check = client.get(
        f"/v1/browser-skills/verify/{body['verify_id']}/receipt/check"
    ).json()
    assert check["valid"] is True
    assert check["tampered"] is False
    assert check["stored_hash"] == check["recomputed_hash"] == body["receipt_hash"]


@pytest.mark.skipif(not _PLAYWRIGHT_AVAILABLE, reason="har_chain_e2e/playwright unavailable")
def test_target_verify_pass_and_receipt_check(client, canned_site):
    host = f"127.0.0.1:{SITE_PORT}"
    spec = _spec(_matching_trace_entries(host))
    resp = client.post("/v1/browser-skills/verify?wait=true", json={
        "workflow": spec,
        "target_url": canned_site + "/form",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "completed"
    assert body["mode"] == "target"
    assert body["workflow_status"] == "completed"
    assert body["network"]["status"] == "pass"
    assert body["network"]["deviations"] == []
    # No recorded DOM accompanies an arbitrary target.
    assert body["a11y"] == {"status": "unverifiable"}
    assert body["receipt_id"] and body["receipt_hash"]

    check = client.get(
        f"/v1/browser-skills/verify/{body['verify_id']}/receipt/check"
    ).json()
    assert check["valid"] is True


@pytest.mark.skipif(not _PLAYWRIGHT_AVAILABLE, reason="har_chain_e2e/playwright unavailable")
def test_target_verify_mismatch_is_first_class_deviation(client, canned_site):
    host = f"127.0.0.1:{SITE_PORT}"
    # Recorded trace expects POST /submit-order (the site serves /submit):
    # deterministic DEV_MISSING + DEV_EXTRA, verdict deviated.
    entries = _matching_trace_entries(host)
    entries[1]["pathTemplate"] = "/submit-order"
    spec = _spec(entries, workflow_id="wf-test-drift")

    resp = client.post("/v1/browser-skills/verify?wait=true", json={
        "workflow": spec,
        "target_url": canned_site + "/form",
    })
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "completed"
    assert body["network"]["status"] == "deviated"
    kinds = {d["kind"] for d in body["network"]["deviations"]}
    assert "missing_call" in kinds
    assert "extra_call" in kinds
    # Deviation entries carry distilled shapes only.
    for deviation in body["network"]["deviations"]:
        blob = json.dumps(deviation)
        assert "payloadKeysHash" in blob or deviation["kind"] == "extra"

    # The deviation verdict is still receipt-backed and verifiable.
    check = client.get(
        f"/v1/browser-skills/verify/{body['verify_id']}/receipt/check"
    ).json()
    assert check["valid"] is True


@pytest.mark.skipif(not _PLAYWRIGHT_AVAILABLE, reason="har_chain_e2e/playwright unavailable")
def test_target_verify_deterministic_same_verdict_twice(client, canned_site):
    host = f"127.0.0.1:{SITE_PORT}"
    spec = _spec(_matching_trace_entries(host), workflow_id="wf-test-determinism")
    verdicts = []
    for _ in range(2):
        resp = client.post("/v1/browser-skills/verify?wait=true", json={
            "workflow": spec,
            "target_url": canned_site + "/form",
        })
        body = resp.json()
        assert body["status"] == "completed"
        verdicts.append({
            "network": body["network"],
            "receipt_hash": body["receipt_hash"],
            "workflow_status": body["workflow_status"],
        })
    assert verdicts[0] == verdicts[1]
