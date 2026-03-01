#!/usr/bin/env bash
set -euo pipefail

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [ -x ".venv-law/bin/python" ]; then
  PYTHON_BIN=".venv-law/bin/python"
fi

boot_dir=".a2r/boot"
manifest_path="$boot_dir/boot_manifest.json"

mkdir -p "$boot_dir"

cat > "$manifest_path" <<'JSON'
{
  "b0_version": "v0.1",
  "timestamp": "2026-01-01T00:00:00Z",
  "loaded_files": ["/SOT.md"],
  "hashes": {"/SOT.md": "deadbeef"},
  "env": {"profile": "test"}
}
JSON

"$PYTHON_BIN" scripts/validate_law.py --validate-boot-manifest

rm -f "$manifest_path"
