#!/usr/bin/env python3
"""Project a native session via vendored session-migrate. Read-only. Prints JSON."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "vendor" / "session-migrate" / "src"))

from session_migrate.conversion import load_session  # noqa: E402
from session_migrate.model import AgentFormat  # noqa: E402


def main() -> int:
    if len(sys.argv) < 3:
        print(json.dumps({"error": "usage: project_native.py <harness> <path>"}))
        return 2
    harness, raw_path = sys.argv[1], sys.argv[2]
    path = Path(raw_path.split("#", 1)[0])
    session_id = raw_path.split("#", 1)[1] if "#" in raw_path else None
    try:
        fmt = AgentFormat(harness)
    except ValueError:
        print(json.dumps({"error": f"unsupported harness {harness}"}))
        return 2
    try:
        if harness == "hermes":
            from session_migrate.formats import hermes as hermes_fmt
            session = hermes_fmt.parse_session(path, session_id)
        elif harness == "mastracode":
            from session_migrate.formats import mastracode as mastra_fmt
            session = mastra_fmt.parse_session(path, session_id)
        elif harness == "devin":
            from session_migrate.formats import devin as devin_fmt
            session = devin_fmt.parse_session(path, session_id)
        else:
            session = load_session(path, fmt)
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        return 1
    events = []
    for event in session.events:
        if session_id and getattr(event.provenance, "source_id", None) not in {None, session_id}:
            continue
        events.append(
            {
                "kind": event.kind.value,
                "role": event.role.value if event.role else None,
                "text": event.text,
                "toolName": event.tool_name,
                "toolId": event.tool_call_id,
                "recordIndex": event.provenance.record_index,
                "sourceId": event.provenance.source_id,
                "inert": True,
            }
        )
    json.dump(
        {
            "sessionId": session.session_id,
            "title": session.title,
            "cwd": str(session.cwd) if session.cwd else None,
            "events": events,
        },
        sys.stdout,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
