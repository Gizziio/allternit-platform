#!/usr/bin/env python3
"""Second-pass branding purge: leftover identifiers + user-visible 'Claude Code'."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCOPES = ["src", "test", "script", "packages"]
EXTS = {".ts", ".tsx", ".txt", ".md", ".json"}
SKIP_DIR_NAMES = {"node_modules", "dist", "vendored", ".git"}
SKIP_FILES = {
    "script/purge-claude-naming.ts",
    "script/purge-claude-strings.py",
    "docs/legal-attribution.md",
    "CLAUDE_REFERENCES_INVENTORY.txt",
}

# Longest-first so suffixes don't eat the longer names.
IDENT_RENAMES: list[tuple[str, str]] = [
    ("GIZZI_DISABLE_CLAUDE_CODE_PROMPT", "GIZZI_DISABLE_LEGACY_PROMPT"),
    ("GIZZI_DISABLE_CLAUDE_CODE_SKILLS", "GIZZI_DISABLE_LEGACY_SKILLS"),
    ("GIZZI_DISABLE_CLAUDE_CODE", "GIZZI_DISABLE_LEGACY_INSTRUCTIONS"),
    ("GIZZI_CODE_DISABLE_CLAUDE_MDS", "GIZZI_DISABLE_GIZZI_MDS"),
    ("GIZZI_DISABLE_CLAUDE_MDS", "GIZZI_DISABLE_GIZZI_MDS"),
    ("ENABLE_CLAUDE_CODE_SM_COMPACT", "ENABLE_GIZZI_SM_COMPACT"),
    ("DISABLE_CLAUDE_CODE_SM_COMPACT", "DISABLE_GIZZI_SM_COMPACT"),
]

SKIP_SUBSTRINGS = (
    "github.com/anthropics/",
    "@anthropic-ai/claude-code",
    "claude-plugins-official",
    "claude-code-action",
    "claude-code-dist",
    "docs.claude.com",
    "api.anthropic.com",
    "mcp-proxy.anthropic.com",
)


def should_skip_dir(name: str) -> bool:
    return name in SKIP_DIR_NAMES


def walk() -> list[Path]:
    out: list[Path] = []
    for scope in SCOPES:
        base = ROOT / scope
        if not base.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if not should_skip_dir(d)]
            for fn in filenames:
                p = Path(dirpath) / fn
                if p.suffix not in EXTS:
                    continue
                rel = p.relative_to(ROOT).as_posix()
                if rel in SKIP_FILES:
                    continue
                out.append(p)
    return out


def transform_line(line: str) -> str:
    if any(s in line for s in SKIP_SUBSTRINGS):
        # Still rewrite product phrasing around keep-URLs, but not the URL tokens.
        if "Claude Code" in line or "claude code" in line:
            line = line.replace("Claude Code", "gizzi-code").replace("claude code", "gizzi-code")
        return line
    for old, new in IDENT_RENAMES:
        line = line.replace(old, new)
    line = line.replace("Claude Code", "gizzi-code")
    line = line.replace("claude code", "gizzi-code")
    return line


def main() -> None:
    files = walk()
    changed = 0
    for path in files:
        try:
            text = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        if "Claude" not in text and "CLAUDE" not in text:
            continue
        new_lines = [transform_line(line) for line in text.splitlines(keepends=True)]
        new = "".join(new_lines)
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed += 1
            print(path.relative_to(ROOT))
    print(f"changed {changed} files")


if __name__ == "__main__":
    main()
