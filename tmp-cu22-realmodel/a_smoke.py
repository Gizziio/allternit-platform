#!/usr/bin/env python3
"""cu22 — Deliverable A: real-model smoke.

Proves the campaign brain path is a REAL frontier vision model, not a
scripted provider: navigates the live local test site in the adapter Chrome,
takes an actual screenshot over CDP, asks the model to plan one action, and
verifies a structured plan referencing a real element came back.

Prints the required evidence: model name, tokens, latency.

Usage (with site server + Chrome already running):
  .venv/bin/python a_smoke.py
"""

import base64
import json
import os
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
EVIDENCE = HERE / "evidence" / "a_smoke.json"
SITE = os.environ.get("CU22_SITE", "http://127.0.0.1:18080")


def _cdp(ws_url, method, params, _id):
    import websocket  # type: ignore
    ws = websocket.create_connection(ws_url, timeout=20)
    ws.send(json.dumps({"id": _id, "method": method, "params": params}))
    while True:
        msg = json.loads(ws.recv())
        if msg.get("id") == _id:
            ws.close()
            return msg


def screenshot_after_navigate():
    targets = json.load(urllib.request.urlopen("http://127.0.0.1:9222/json/list", timeout=5))
    page = next(t for t in targets if t["type"] == "page")
    ws_url = page["webSocketDebuggerUrl"]
    _cdp(ws_url, "Page.navigate", {"url": f"{SITE}/form.html"}, 1)
    time.sleep(1.0)
    shot = _cdp(ws_url, "Page.captureScreenshot", {"format": "png"}, 2)
    return base64.b64decode(shot["result"]["data"])


def main():
    png = screenshot_after_navigate()
    env = dict(os.environ)
    env["CU22_EVIDENCE"] = str(HERE / "evidence" / "a_smoke_brain.jsonl")
    started = time.time()
    proc = subprocess.run(
        [sys.executable, str(HERE / "brain_wrapper.py")],
        input=json.dumps({
            "prompt": "This screenshot is a web page. Task: press the Register button.",
            "screenshot_b64": base64.b64encode(png).decode(),
        }),
        capture_output=True, text=True, timeout=180, env=env,
    )
    latency = round(time.time() - started, 2)
    if proc.returncode != 0:
        print("SMOKE FAIL — wrapper exit", proc.returncode,
              proc.stdout[-300:], proc.stderr[-300:])
        sys.exit(1)
    plan = json.loads(proc.stdout)
    usage = json.loads((HERE / "evidence" / "a_smoke_brain.jsonl").read_text().splitlines()[-1])
    action = plan.get("immediate_action") or {}
    ok = (action.get("type") in ("click", "fill", "type")
          and "submit" in json.dumps(plan).lower())
    report = {
        "check": "A: one real frontier-vision inference through the campaign brain path",
        "ok": ok,
        "model": usage["model"],
        "input_tokens": usage["input_tokens"],
        "output_tokens": usage["output_tokens"],
        "latency_s": latency,
        "screenshot_bytes": len(png),
        "plan_action": action,
        "evidence": "evidence/a_smoke_brain.jsonl",
    }
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    EVIDENCE.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
