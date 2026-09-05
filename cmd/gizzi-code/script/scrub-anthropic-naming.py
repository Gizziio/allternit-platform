#!/usr/bin/env python3
"""Product-owned Anthropic identifier/host scrub. Does not touch leftover-detect IDs,
third-party npm package names, Claude first-party model IDs, or OAuth contract hosts.
"""
from __future__ import annotations

import json
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SCOPES = ["src", "test", "script", "packages", "docs", "github"]
EXTS = {
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".json",
    ".md",
    ".txt",
    ".yml",
    ".yaml",
}
SKIP_DIR_NAMES = {"node_modules", "dist", "vendored", ".git", "archive"}
SKIP_SUBPATHS = (
    "/script/purge-claude-naming.ts",
    "/script/purge-claude-strings.py",
    "/script/rename-internal-claude-ids.py",
    "/script/scrub-anthropic-naming.py",
    "/test/tool/fixtures/models-api.json",
    "/src/vendor/anthropic-stubs/",
    "/src/cli/ui/ink-app/constants/oauth.ts",
    "/src/constants/oauth.ts",
    "/docs/archive/",
)

# Longest first. Do not include AnthropicBedrock/Vertex/Foundry (npm exports).
IDENTIFIER_RENAMES: list[tuple[str, str]] = [
    ("getAnthropicApiKeyWithSource", "getAllternitApiKeyWithSource"),
    ("hasAnthropicApiKeyAuth", "hasAllternitApiKeyAuth"),
    ("isFirstPartyAnthropicBaseUrl", "isFirstPartyAllternitBaseUrl"),
    ("isAnthropicAuthEnabled", "isAllternitAuthEnabled"),
    ("getAnthropicEnvMetadata", "getAllternitEnvMetadata"),
    ("getAnthropicApiKey", "getAllternitApiKey"),
    ("getAnthropicClient", "getAllternitClient"),
    ("PROMPT_ANTHROPIC_WITHOUT_TODO", "PROMPT_DEFAULT_WITHOUT_TODO"),
    ("PROMPT_ANTHROPIC", "PROMPT_DEFAULT"),
    ("com.anthropic.gizzi-url-handler", "com.allternit.gizzi-url-handler"),
    ("x-claude-remote-container-id", "x-allternit-remote-container-id"),
    ("declare namespace Anthropic", "declare namespace Allternit"),
    ("Anthropic.Beta.Messages", "Allternit.Beta.Messages"),
    ("Anthropic.MessageParam", "Allternit.MessageParam"),
    ("Anthropic.TextBlockParam", "Allternit.TextBlockParam"),
    ("Anthropic.ImageBlockParam", "Allternit.ImageBlockParam"),
    ("Anthropic.ContentBlockParam", "Allternit.ContentBlockParam"),
    ("Anthropic.ToolChoice", "Allternit.ToolChoice"),
    ("Anthropic.Tool", "Allternit.Tool"),
    ("namespace-style type references like Anthropic.", "namespace-style type references like Allternit."),
]

# First-party product hosts we control. OAuth files are skipped above.
HOST_RENAMES: list[tuple[str, str]] = [
    ("api-staging.anthropic.com", "api-staging.allternit.com"),
    ("mcp-proxy-staging.anthropic.com", "api-staging.allternit.com/mcp-proxy"),
    ("mcp-proxy.anthropic.com", "api.allternit.com/mcp-proxy"),
    ("docs.anthropic.com", "docs.gizziio.com"),
    ("console.anthropic.com", "platform.allternit.com"),
    ("www.anthropic.com", "www.allternit.com"),
    ("api.anthropic.com", "api.allternit.com"),
    ("noreply@anthropic.com", "noreply@allternit.com"),
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


def transform(text: str) -> str:
    for old, new in IDENTIFIER_RENAMES:
        text = text.replace(old, new)
    for old, new in HOST_RENAMES:
        text = text.replace(old, new)
    return text


def strip_bedrock_anthropic_ids(obj):
    if isinstance(obj, dict):
        return {
            k: strip_bedrock_anthropic_ids(v)
            for k, v in obj.items()
            if "anthropic.claude" not in k
        }
    if isinstance(obj, list):
        return [strip_bedrock_anthropic_ids(v) for v in obj]
    return obj


def main() -> None:
    changed = 0
    for path in walk():
        try:
            before = path.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        after = transform(before)
        if after != before:
            path.write_text(after, encoding="utf-8")
            changed += 1
            print(path.relative_to(ROOT))
    print(f"changed {changed} files")

    fixture = ROOT / "test/tool/fixtures/models-api.json"
    if fixture.exists():
        data = json.loads(fixture.read_text(encoding="utf-8"))
        stripped = strip_bedrock_anthropic_ids(data)
        fixture.write_text(json.dumps(stripped, indent=2) + "\n", encoding="utf-8")
        print("stripped anthropic.claude keys from test/tool/fixtures/models-api.json")


if __name__ == "__main__":
    main()
