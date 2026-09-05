#!/usr/bin/env python3
"""Rebrand gizzi-sdk + CLI imports off providers/anthropic."""
from __future__ import annotations

import os
import re
from pathlib import Path

ROOT = Path("/Users/joe/Desktop/allternit-workspace/allternit")
GIZZI = ROOT / "cmd/gizzi-code"
SDK = GIZZI / "packages/sdk"
EXTS = {".ts", ".tsx", ".js", ".mjs", ".json", ".md"}
SKIP_DIRS = {"node_modules", "dist", "vendored", ".git"}

PATH_REPLACES = [
    ("@allternit/sdk/providers/anthropic", "@allternit/sdk/providers/allternit"),
    ("providers/anthropic", "providers/allternit"),
]

# Capital-C Claude is product/brand; model ids are lowercase claude-*.
BRAND_REPLACES = [
    ("https://docs.anthropic.com", "https://docs.gizziio.com"),
    ("https://platform.claude.com", "https://docs.gizziio.com"),
    ("https://console.anthropic.com", "https://docs.gizziio.com"),
    ("https://www.anthropic.com", "https://allternit.com"),
    ("https://anthropic.com", "https://allternit.com"),
]

IDENT_REPLACES = [
    ("streamFromAnthropic", "streamFromAllternit"),
    ("convertToAnthropicMessages", "convertToAllternitMessages"),
    ("convertToAnthropicTool", "convertToAllternitTool"),
    ("processAnthropicStream", "processAllternitStream"),
    ("anthropicMessages", "allternitMessages"),
]


def walk(base: Path):
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS]
        for fn in filenames:
            p = Path(dirpath) / fn
            if p.suffix in EXTS:
                yield p


def transform(text: str, branding: bool) -> str:
    for old, new in PATH_REPLACES:
        text = text.replace(old, new)
    if not branding:
        return text
    for old, new in BRAND_REPLACES:
        text = text.replace(old, new)
    for old, new in IDENT_REPLACES:
        text = text.replace(old, new)
    # Do not touch AWS Bedrock model IDs: anthropic.claude-...
    text = re.sub(r"(?<![\w.])Anthropic(?![\w.])", "Allternit", text)
    text = re.sub(r"(?<![\w.])anthropic(?![\w.\-])", "allternit", text)
    text = re.sub(r"\bClaude\b", "Allternit", text)
    return text


def main() -> None:
    changed = 0
    # CLI + tsconfig: path remap only (don't rewrite Claude model names in the CLI).
    for p in walk(GIZZI / "src"):
        before = p.read_text(encoding="utf-8")
        after = transform(before, branding=False)
        if after != before:
            p.write_text(after, encoding="utf-8")
            changed += 1
    tsconfig = GIZZI / "tsconfig.json"
    t = tsconfig.read_text(encoding="utf-8")
    t2 = t.replace("providers/anthropic", "providers/allternit")
    t2 = t2.replace("@allternit/sdk/providers/anthropic", "@allternit/sdk/providers/allternit")
    if t2 != t:
        tsconfig.write_text(t2, encoding="utf-8")
        changed += 1

    # SDK: path + branding
    for p in walk(SDK):
        if "dist" in p.parts:
            continue
        before = p.read_text(encoding="utf-8")
        after = transform(before, branding=True)
        if after != before:
            p.write_text(after, encoding="utf-8")
            changed += 1
    print(f"changed {changed} files")


if __name__ == "__main__":
    main()
