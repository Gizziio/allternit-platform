#!/usr/bin/env python3
"""Convert a Claude JSONL into a NEW native target via session-migrate. Never overwrites."""

from __future__ import annotations

import json
import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(ROOT / "vendor" / "session-migrate" / "src"))

from session_migrate.conversion import (  # noqa: E402
    ConversionOptions,
    convert_session,
    load_session,
    write_artifact,
)
from session_migrate.model import TargetFormat  # noqa: E402


def main() -> int:
    if len(sys.argv) < 4:
        print(json.dumps({"error": "usage: export_native.py <claude.jsonl> <target> <output> [cwd]"}))
        return 2
    source, target, output = Path(sys.argv[1]), sys.argv[2], Path(sys.argv[3])
    cwd = Path(sys.argv[4]).resolve() if len(sys.argv) > 4 else Path.cwd()
    if output.exists():
        print(json.dumps({"error": f"refusing to overwrite {output}"}))
        return 2
    try:
        session = load_session(source)
        new_id = str(uuid.uuid4())
        artifact = convert_session(
            session,
            ConversionOptions(target_format=TargetFormat(target), session_id=new_id, cwd=cwd),
        )
        manifest = output.with_name(output.name + ".allternit-manifest.json")
        write_artifact(artifact, output_path=output, manifest_path=manifest)
        json.dump(
            {"sessionId": artifact.session_id, "path": str(output.resolve()), "harness": target},
            sys.stdout,
        )
        return 0
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
