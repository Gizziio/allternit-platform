"""Live smoke for record→teach→batch (spec stagehand-batch-fork deferral A).

Leg 1: POST /v1/browser-skills/run with a 3-step batchable workflow against a
LIVE allternit-api (:18113). Expect: compile → ONE batch grant request →
approve → batch executes in the vendored sidecar Chrome → receipt completed
3/3, one grant only, ledger batch.context.opened/closed + model_turns_saved=2.

Leg 2 (opt-out): same workflow with the API restarted under
ALLTERNIT_WORKFLOW_BATCH=0 → per-step path through the CDP adapter, no batch
events, no grant request.

Usage: python3 smoke.py <leg: 1|2>
"""

import json
import sys
import threading
import time
import urllib.request

GW = "http://127.0.0.1:18760"   # Python ACU gateway (browser-skills, runs)
API = "http://127.0.0.1:18113"  # Rust allternit-api (aci batch + receipts)
LEG = sys.argv[1] if len(sys.argv) > 1 else "1"

WORKFLOW = {
    "schemaVersion": "1.0",
    "workflowId": "wf-cu20-smoke",
    "title": "cu20 record→teach→batch smoke",
    "sourceRunId": "run-cu20-smoke",
    "inputs": [],
    "steps": [
        {"id": "s1", "kind": "click", "target": {"ref": "#open"},
         "input": {}, "reason": "open the form"},
        {"id": "s2", "kind": "type", "target": {"ref": "#name"},
         "input": {"text": "Eoj"}, "reason": "fill the name"},
        {"id": "s3", "kind": "click", "target": {"ref": "#submit"},
         "input": {}, "reason": "submit"},
    ],
    "safety": {"requiresApprovalFor": [], "redactions": []},
}


def post(path, body):
    req = urllib.request.Request(
        GW + path, data=json.dumps(body).encode(),
        headers={"content-type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=60))


def get(path):
    base = GW if path.startswith("/v1/") else API
    return json.load(urllib.request.urlopen(base + path, timeout=60))


def post_rust(path, body):
    req = urllib.request.Request(
        API + path, data=json.dumps(body).encode(),
        headers={"content-type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(req, timeout=60))
    except urllib.error.HTTPError as exc:
        return {"status_code": exc.code, "body": exc.read().decode("utf-8", "replace")[:200]}


failures = []


def check(name, cond, detail=""):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name}" + (f" — {detail}" if detail and not cond else ""))
    if not cond:
        failures.append(name)


def sse_events(run_id, sink, done):
    # Frames are `data: {json}\n\n` — the event type lives inside the
    # payload as event_type (see _sse_line in computer_use_router.py).
    req = urllib.request.Request(f"{GW}/v1/computer-use/runs/{run_id}/events")
    resp = urllib.request.urlopen(req, timeout=180)
    data_lines = []
    for raw in resp:
        line = raw.decode("utf-8", "replace").rstrip("\n").rstrip("\r")
        if line.startswith("data: "):
            data_lines.append(line[6:])
        elif line == "" and data_lines:
            try:
                payload = json.loads(" ".join(data_lines))
            except Exception:
                payload = {"raw": " ".join(data_lines)}
            sink.append(payload)
            if payload.get("event_type") == "run.ended":
                done["ended"] = payload
                return
            data_lines = []


def main():
    started = post("/v1/browser-skills/run?wait=false", {
        "workflow": WORKFLOW,
        "session_id": "cu20-smoke-session",
        "run_id": f"cu20-smoke-leg{LEG}-{int(time.time())}",
        "batch_page_url": "http://127.0.0.1:18080/form.html",
    })
    run_id = started["run_id"]
    print(f"leg {LEG}: run {run_id} started")

    events, done = [], {}
    thread = threading.Thread(target=sse_events, args=(run_id, events, done), daemon=True)
    thread.start()

    approved = False
    deadline = time.time() + 150
    while time.time() < deadline and "ended" not in done:
        for e in events:
            data = e.get("data") or {}
            # The runner's raw approval.required carries the Rust approval_id;
            # the router's run-level push re-states the pause without it. Only
            # the former can redeem the grant.
            if (e.get("event_type") == "approval.required"
                    and isinstance(data, dict)
                    and data.get("kind") == "workflow.batch_grant"
                    and data.get("approval_id")
                    and not approved):
                approval_id = data.get("approval_id")
                print(f"leg {LEG}: batch grant requested (approval_id={approval_id}) — approving")
                # Redeem the grant on the Rust handoff surface first, then
                # resolve the run-level approval pause.
                handoff = post_rust(f"/api/aci/handoff/{approval_id}/approve", {})
                if handoff.get("status") != "approved":
                    check("rust handoff approve", False, str(handoff))
                    sys.exit(1)
                post(f"/v1/computer-use/runs/{run_id}/approve", {"decision": "approve"})
                approved = True
        time.sleep(0.2)

    if "ended" not in done:
        check("run finished", False, f"timed out; events so far: {[e['event'] for e in events]}")
        sys.exit(1)

    final = get(f"/v1/computer-use/runs/{run_id}")
    wf_events = [e for e in events
                 if isinstance(e.get("data"), dict) and e["data"].get("type", "").startswith("workflow.")]
    batch_events = [e["data"] for e in wf_events if e["data"].get("type") == "workflow.batch"]
    step_events = [e["data"] for e in wf_events if e["data"].get("type") == "workflow.step"]
    approval_reqs = [e for e in events
                     if e.get("event_type") == "approval.required"
                     and isinstance(e.get("data"), dict)
                     and e["data"].get("kind") == "workflow.batch_grant"
                     and e["data"].get("approval_id")]
    result = final.get("result") or {}

    if LEG == "1":
        check("run completed", final.get("status") == "completed", str(final.get("status")))
        check("exactly one batch grant requested", len(approval_reqs) == 1,
              f"got {len(approval_reqs)}")
        check("compiled + executed batch events",
              any(e.get("phase") == "compiled" for e in batch_events)
              and any(e.get("phase") == "executed" for e in batch_events),
              str([e.get("phase") for e in batch_events]))
        executed = [e for e in batch_events if e.get("phase") == "executed"]
        check("batch receipt completed", executed and executed[0].get("status") == "completed",
              str(executed))
        check("three workflow.step events via batch",
              len(step_events) == 3 and all(e.get("via") == "batch" for e in step_events),
              str([(e.get("step"), e.get("via")) for e in step_events]))
        steps = result.get("steps") or []
        check("all 3 steps ok in result", len(steps) == 3 and all(s.get("status") == "ok" for s in steps),
              str([(s.get("step_id"), s.get("status")) for s in steps]))
        receipt_id = executed and executed[0].get("receipt_id")
        check("descriptor hash present", bool(executed and executed[0].get("descriptor_hash")))
        if receipt_id:
            receipt = get(f"/api/aci/batch/receipts/{receipt_id}")
            check("rust receipt completed 3/3",
                  receipt.get("status") == "completed"
                  and len(receipt.get("steps") or []) == 3
                  and all(s.get("status") == "completed" for s in receipt.get("steps") or []),
                  str(receipt)[:200])
        # no per-step adapter dispatch happened: every step event is via=batch
    else:
        check("run completed", final.get("status") == "completed", str(final.get("status")))
        check("no batch events under opt-out", batch_events == [], str(batch_events))
        check("no approval requests under opt-out", approval_reqs == [],
              str([e.get("data") for e in approval_reqs]))
        check("three per-step workflow.step events",
              len(step_events) == 3 and all("via" not in e for e in step_events),
              str([(e.get("step"), e.get("via")) for e in step_events]))
        steps = result.get("steps") or []
        check("all 3 steps ok in result", len(steps) == 3 and all(s.get("status") == "ok" for s in steps),
              str([(s.get("step_id"), s.get("status")) for s in steps]))

    if failures:
        print(f"\nleg {LEG}: {len(failures)} FAILURE(S): {failures}")
        sys.exit(1)
    print(f"\nleg {LEG}: ALL CHECKS PASS")


if __name__ == "__main__":
    main()
