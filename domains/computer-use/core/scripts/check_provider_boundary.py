"""Reject newly added legacy adapters; intended for CI and pre-submit checks."""

from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    process = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=A", "--cached"],
        cwd=ROOT, capture_output=True, text=True, check=False,
    )
    if process.returncode != 0:
        print(process.stderr.strip())
        return process.returncode
    violations = []
    for value in process.stdout.splitlines():
        path = Path(value)
        parts = path.parts
        if "domains" not in parts or "computer-use" not in parts or "core" not in parts:
            continue
        core_index = parts.index("core")
        relative = Path(*parts[core_index + 1:])
        if not relative.parts or relative.parts[0] != "adapters":
            continue
        if relative.name == "adapter.py" or relative.name.endswith("_adapter.py"):
            violations.append(str(relative))
    if violations:
        print("New direct adapters are frozen; implement a canonical provider/backend:")
        for violation in violations:
            print(f"  {violation}")
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
