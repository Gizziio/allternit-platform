#!/usr/bin/env python3
"""
Allternit Echo Brain — lightweight dev/test subprocess provider for Gizzi.

Reads stream-json input on stdin and emits stream-json events on stdout.
Compatible with Gizzi's subprocess language model contract:
  Input:  {"type":"user","message":{"role":"user","content":[{"type":"text","text":"..."}]}}
  Output: {"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Echo: ..."}]}}
          {"type":"result","usage":{"input_tokens":N,"output_tokens":M}}
"""
import json
import sys


def main() -> None:
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except Exception:
            continue

        msg = req.get("message", {}) if isinstance(req, dict) else {}
        content = msg.get("content", []) if isinstance(msg, dict) else []
        texts = [
            str(part.get("text", ""))
            for part in content
            if isinstance(part, dict) and part.get("type") == "text"
        ]
        user_text = " ".join(texts).strip() or "(empty)"

        response = {
            "type": "assistant",
            "message": {
                "role": "assistant",
                "content": [{"type": "text", "text": f"Echo: {user_text}"}],
            },
        }
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()

        result = {
            "type": "result",
            "usage": {
                "input_tokens": len(user_text.split()),
                "output_tokens": 2 + len(user_text.split()),
            },
        }
        sys.stdout.write(json.dumps(result) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
