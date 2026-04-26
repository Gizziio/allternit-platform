#!/usr/bin/env python3
"""
Milestone 4 — Live Planner UX Smoke Test

Simulates the exact call sequence GIZZI's BrowserTool makes against the operator.
Passes if every step returns the expected shape and a real inline screenshot arrives.

Run:
    python3 smoke_test.py
    python3 smoke_test.py --url https://news.ycombinator.com   # any URL
"""

import sys
import json
import time
import uuid
import argparse
import urllib.request
import urllib.error

OPERATOR = "http://localhost:3010"
PASS = "\033[32m✓\033[0m"
FAIL = "\033[31m✗\033[0m"
WARN = "\033[33m⚠\033[0m"


def req(method: str, path: str, body=None) -> dict:
    url = OPERATOR + path
    data = json.dumps(body).encode() if body else None
    r = urllib.request.Request(url, data=data, method=method,
                               headers={"Content-Type": "application/json"} if data else {})
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read())


def check(label: str, cond: bool, detail: str = ""):
    icon = PASS if cond else FAIL
    print(f"  {icon}  {label}" + (f"  [{detail}]" if detail else ""))
    if not cond:
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="https://example.com")
    args = parser.parse_args()

    session_id = f"smoke-{uuid.uuid4().hex[:8]}"
    run_counter = [0]

    def run_id():
        run_counter[0] += 1
        return f"r{run_counter[0]}"

    print(f"\n{'='*60}")
    print("  Milestone 4 — Live Planner UX Smoke Test")
    print(f"  URL: {args.url}   session: {session_id}")
    print(f"{'='*60}\n")

    # ------------------------------------------------------------------
    # Step 0: Health
    # ------------------------------------------------------------------
    print("Step 0  — Health check")
    d = req("GET", "/health")
    check("operator healthy", d.get("status") == "healthy")
    check("gateway capability present", d.get("capabilities", {}).get("gateway") is True)
    check("/v1/execute endpoint reported", d.get("gateway_endpoint") == "/v1/execute")
    print()

    # ------------------------------------------------------------------
    # Step 1: goto  (GIZZI sends this first)
    # ------------------------------------------------------------------
    print(f"Step 1  — goto {args.url}")
    d = req("POST", "/v1/execute", {
        "action": "goto",
        "session_id": session_id,
        "run_id": run_id(),
        "target": args.url,
    })
    check("status completed", d["status"] == "completed", d["status"])
    check("adapter is playwright", "playwright" in d.get("adapter_id", ""), d.get("adapter_id"))
    check("family is browser", d.get("family") == "browser")
    check("extracted_content has url", bool((d.get("extracted_content") or {}).get("url")))
    check("receipt present", len(d.get("receipts", [])) > 0)
    title = (d.get("extracted_content") or {}).get("title", "")
    print(f"       page title: {title!r}")
    print()

    # ------------------------------------------------------------------
    # Step 2: screenshot  (GIZZI asks for screenshot after goto)
    # ------------------------------------------------------------------
    print("Step 2  — screenshot")
    d = req("POST", "/v1/execute", {
        "action": "screenshot",
        "session_id": session_id,
        "run_id": run_id(),
    })
    check("status completed", d["status"] == "completed")
    arts = d.get("artifacts", [])
    check("artifact returned", len(arts) > 0, f"{len(arts)} artifacts")
    if arts:
        url_val = arts[0].get("url", "")
        check("screenshot is inline base64 data URI", url_val.startswith("data:image/png;base64,"),
              url_val[:40] + "...")
        check("mime image/png", arts[0].get("mime") == "image/png")
        kb = len(url_val) * 3 // 4 // 1024  # approx decoded size
        print(f"       screenshot ≈ {kb} KB")
    print()

    # ------------------------------------------------------------------
    # Step 3: extract  (GIZZI pulls page text for context)
    # ------------------------------------------------------------------
    print("Step 3  — extract")
    d = req("POST", "/v1/execute", {
        "action": "extract",
        "session_id": session_id,
        "run_id": run_id(),
    })
    check("status completed", d["status"] == "completed")
    ec = d.get("extracted_content") or {}
    check("text extracted", len(ec.get("text", "")) > 0, f"{len(ec.get('text',''))} chars")
    check("html extracted", len(ec.get("html", "")) > 0)
    print()

    # ------------------------------------------------------------------
    # Step 4: session metadata  (GIZZI can inspect session state)
    # ------------------------------------------------------------------
    print("Step 4  — session metadata")
    d = req("GET", "/v1/sessions")
    sessions = {s["session_id"]: s for s in d.get("sessions", [])}
    check("session visible", session_id in sessions)
    s = sessions.get(session_id, {})
    check("session live", s.get("live") is True)
    check("last_url persisted", bool(s.get("last_url")), s.get("last_url"))
    print(f"       last_url: {s.get('last_url')!r}")
    print()

    # ------------------------------------------------------------------
    # Step 5: close session  (GIZZI closes when done)
    # ------------------------------------------------------------------
    print("Step 5  — close session")
    d = req("DELETE", f"/v1/sessions/{session_id}")
    check("closed", d.get("status") == "closed")
    d2 = req("GET", "/v1/sessions")
    remaining = {s["session_id"] for s in d2.get("sessions", [])}
    check("session gone from live list",
          session_id not in remaining or not [s for s in d2["sessions"] if s["session_id"] == session_id and s["live"]])
    print()

    # ------------------------------------------------------------------
    # Summary
    # ------------------------------------------------------------------
    print(f"{'='*60}")
    print(f"  {PASS}  Milestone 4 — PASSED")
    print(f"       goto → screenshot → extract → session close")
    print(f"       all steps returned correct shape")
    print(f"       screenshot returned as inline base64 data URI")
    print(f"       session metadata persisted and cleaned up")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    try:
        main()
    except urllib.error.URLError as e:
        print(f"\n  {FAIL}  Operator not reachable at {OPERATOR}: {e}")
        print("       Start it with:")
        print("       Allternit_COMPUTER_USE_PATH=packages/computer-use python3 -m uvicorn src.main:app --port 3010")
        sys.exit(1)
