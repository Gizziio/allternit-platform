#!/usr/bin/env python3
"""cu22 campaign — real-brain wrapper speaking the SubprocessVisionProvider protocol.

Reads {"prompt": str, "screenshot_b64": str} on stdin, asks the real frontier
vision model (codex CLI, default gpt-6-astra) with the screenshot attached,
and prints one ActionPlan JSON object on stdout (the shape parsed by
core.vision_providers._parse_action_plan).

Every call is appended to evidence/brain_calls.jsonl:
  {ts, model, latency_s, input_tokens, output_tokens, screenshot_bytes, ok}

This is the "real model, not a scripted provider" path: no canned outputs,
every plan comes from a live multimodal inference.

Env:
  CU26_BRAIN_MODEL   — codex model id (default: unset = codex default, gpt-6-astra)
  CU26_EVIDENCE      — JSONL evidence path (default: ./evidence/brain_calls.jsonl)
"""

import base64
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

MODEL = os.environ.get("CU26_BRAIN_MODEL") or None  # None = codex configured default
EVIDENCE = Path(os.environ.get("CU26_EVIDENCE", "evidence/brain_calls.jsonl"))

PLAN_INSTRUCTIONS = """

Return EXACTLY one JSON object (no prose, no markdown fences) with keys:
- "reasoning": one sentence
- "plan_steps": remaining high-level steps (array of strings)
- "immediate_action": {"type", "target", "reason", "text"?} — the ONE next action.
  type is one of: click, type, fill, select, scroll, screenshot, done,
  navigate. For a <select> dropdown use type "select" with target = the
  select's selector and "text" = the option value to choose.
  target MUST be a CSS selector, and when the element has an id attribute
  ALWAYS use "#id" (e.g. "#submit", "#name", "#email", "#next", "#plan",
  "#entry", "#enter", "#umbrella"). Only use other selector forms (tag,
  //xpath) when no id exists. A bare element description is a last resort.
  For type/fill/select include "text". Use type "done" with done=true when
  the task is complete. Use type "navigate" with target = the URL when the
  task needs a different page. NEVER invent actions outside this vocabulary.
- "confidence": 0..1
- "done": true only when the task is fully complete on this page
- "requires_approval": false
- "batch": OPTIONAL array of the FURTHER actions on the SAME page after the
  immediate one, same object shape as immediate_action (without nesting
  batch). Include only actions that are safe to run back-to-back with NO
  observation in between (e.g. fill then click submit). Omit otherwise."""


def main() -> int:
    raw = sys.stdin.read()
    payload = json.loads(raw)
    prompt = payload["prompt"]
    screenshot_b64 = payload.get("screenshot_b64") or ""

    evidence = {"ts": time.time(), "model": MODEL or "codex-default(gpt-6-astra)", "ok": False}
    with tempfile.TemporaryDirectory(prefix="cu26-brain-") as tmp:
        img = Path(tmp) / "screen.png"
        if screenshot_b64:
            img.write_bytes(base64.b64decode(screenshot_b64))
        args = ["codex", "exec", "--skip-git-repo-check", "--json"]
        if MODEL:
            args += ["-m", MODEL]
        if screenshot_b64:
            # NOTE: --image must precede -o — with `-o` first, codex 0.154
            # silently drops the positional prompt and reads stdin instead.
            args += ["--image", str(img)]
        args += ["-o", str(Path(tmp) / "out.txt")]
        args.append(prompt + PLAN_INSTRUCTIONS)

        started = time.time()
        proc = subprocess.run(args, capture_output=True, text=True, timeout=180,
                              stdin=subprocess.DEVNULL)
        evidence["latency_s"] = round(time.time() - started, 3)

        input_tokens = output_tokens = 0
        for line in (proc.stdout or "").splitlines():
            try:
                event = json.loads(line)
            except Exception:
                continue
            if event.get("type") == "turn.completed":
                usage = event.get("usage") or {}
                input_tokens = usage.get("input_tokens", 0)
                output_tokens = usage.get("output_tokens", 0)
        evidence["input_tokens"] = input_tokens
        evidence["output_tokens"] = output_tokens
        evidence["screenshot_bytes"] = len(screenshot_b64)

        out_file = Path(tmp) / "out.txt"
        if proc.returncode != 0 or not out_file.exists():
            # Capture real failure causes from the JSON event stream (usage
            # limits, auth errors) — the plain stderr tail can be just
            # "Reading additional input from stdin..." which masks them.
            events_err = ""
            for line in (proc.stdout or "").splitlines():
                try:
                    event = json.loads(line)
                except Exception:
                    continue
                if event.get("type") in ("error", "turn.failed"):
                    msg = (event.get("error") or {}).get("message") or event.get("message") or ""
                    if msg:
                        events_err = msg
                        break
            evidence["error"] = events_err or (proc.stderr or proc.stdout or "")[-300:]
            _record(evidence)
            print(json.dumps({"error": "brain_failed", "detail": evidence["error"]}))
            return 1

        text = out_file.read_text().strip()
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            evidence["error"] = "no JSON in brain output: " + text[-200:]
            _record(evidence)
            print(json.dumps({"error": "no_json", "raw": text[-300:]}))
            return 1
        plan = json.loads(text[start:end + 1])
        evidence["ok"] = True
        evidence["plan_action"] = (plan.get("immediate_action") or {}).get("type")
        evidence["plan_batch_len"] = len(plan.get("batch") or [])
        _record(evidence)
        print(text[start:end + 1])
        return 0


def _record(entry):
    EVIDENCE.parent.mkdir(parents=True, exist_ok=True)
    with EVIDENCE.open("a") as f:
        f.write(json.dumps(entry) + "\n")


if __name__ == "__main__":
    sys.exit(main())
