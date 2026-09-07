#!/usr/bin/env python3
"""Rename remaining internal Claude identifiers. Path semantics unchanged."""
from __future__ import annotations

import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCOPES = ["src", "test", "script", "packages"]
EXTS = {".ts", ".tsx"}
SKIP_DIR_NAMES = {"node_modules", "dist", "vendored", ".git"}
SKIP_SUBPATHS = (
    "/types/generated/events_mono/claude_code/",
    "/script/purge-claude-naming.ts",
    "/script/purge-claude-strings.py",
    "/script/rename-internal-claude-ids.py",
)

# Longest first.
RENAMES: list[tuple[str, str]] = [
    ("getAdditionalDirectoriesForClaudeMd", "getAdditionalDirectoriesForGizziMd"),
    ("useClaudeCodeHintRecommendation", "useGizziHintRecommendation"),
    ("extractClaudeCodeHints", "extractGizziHints"),
    ("setCachedClaudeMdContent", "setCachedGizziMdContent"),
    ("getCachedClaudeMdContent", "getCachedGizziMdContent"),
    ("getManagedClaudeRulesDir", "getManagedGizziRulesDir"),
    ("getUserClaudeRulesDir", "getUserGizziRulesDir"),
    ("buildClaudeMdMessage", "buildGizziMdMessage"),
    ("shouldDisableClaudeMd", "shouldDisableGizziMd"),
    ("ClaudeCodeHintType", "GizziHintType"),
    ("ClaudeCodeHint", "GizziHint"),
    ("getClaudeMds", "getGizziMds"),
    ("claudeCodeHints", "gizziHints"),
    ("claudeCodeGuideAgent", "gizziGuideAgent"),
    ("claudeCodeHints.js", "gizziHints.js"),
    ("useClaudeCodeHintRecommendation.tsx", "useGizziHintRecommendation.tsx"),
]

IMPORT_PATH_RENAMES: list[tuple[str, str]] = [
    ("claudeCodeGuideAgent.js", "gizziGuideAgent.js"),
    ("claudeCodeGuideAgent", "gizziGuideAgent"),
    ("utils/claudeCodeHints", "utils/gizziHints"),
    ("shared/utils/claudeCodeHints", "shared/utils/gizziHints"),
    ("hooks/useClaudeCodeHintRecommendation", "hooks/useGizziHintRecommendation"),
]


def skip(path: Path) -> bool:
    posix = path.as_posix()
    return any(s in posix for s in SKIP_SUBPATHS)


def walk() -> list[Path]:
    out: list[Path] = []
    for scope in SCOPES:
        base = ROOT / scope
        if not base.exists():
            continue
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in SKIP_DIR_NAMES]
            for fn in filenames:
                p = Path(dirpath) / fn
                if p.suffix not in EXTS:
                    continue
                if skip(p):
                    continue
                out.append(p)
    return out


def transform(path: Path, text: str) -> str:
    rel = path.relative_to(ROOT).as_posix()
    ink_app_env = "cli/ui/ink-app/" in rel and "utils/envUtils" not in rel
    # ink-app files that import the ink-app envUtils alias currently resolve
    # getClaudeConfigHomeDir → ~/.gizzi. Switch those to the Gizzi name.
    # Everyone else uses shared envUtils, where it is the ~/.claude locator.
    uses_ink_alias = ink_app_env and (
        "from '../../utils/envUtils" in text
        or "from '../utils/envUtils" in text
        or "from '../../utils/envUtils.js" in text
        or "from '../utils/envUtils.js" in text
        or 'from "../utils/envUtils"' in text
        or "from '../utils/envUtils'" in text
        or "from '../../utils/envUtils'" in text
    )
    if uses_ink_alias:
        text = text.replace("getClaudeConfigHomeDir", "getGizziConfigHomeDir")
    else:
        text = text.replace("getClaudeConfigHomeDir", "getLegacyClaudeHomeDir")

    for old, new in IMPORT_PATH_RENAMES:
        text = text.replace(old, new)
    for old, new in RENAMES:
        text = text.replace(old, new)
    return text


def main() -> None:
    changed = 0
    for path in walk():
        try:
            before = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        after = transform(path, before)
        if after != before:
            path.write_text(after, encoding="utf-8")
            changed += 1
            print(path.relative_to(ROOT))
    print(f"changed {changed} files")


if __name__ == "__main__":
    main()
