#!/usr/bin/env python3
"""Generate Codex prompt files for remaining OpenAI parity categories."""
import re
from pathlib import Path

HANDOFF = Path('/Users/joe/Desktop/allternit-parity-handoff.md')
OUT_DIR = Path('/Users/joe/Desktop/allternit-parity-workspace/.parity-reports/prompts')
OUT_DIR.mkdir(parents=True, exist_ok=True)

with HANDOFF.open() as f:
    lines = f.readlines()

# Find OpenAI categories and their line ranges
in_openai = False
cats = []
cur = None
cur_start = None
for i, line in enumerate(lines):
    if line.startswith('## OpenAI ChatGPT + Codex parity tasks'):
        in_openai = True
        continue
    if in_openai and re.match(r'^##\s', line):
        break
    if in_openai and line.startswith('#### '):
        if cur:
            cats.append((cur, cur_start, i))
        cur = line.strip()
        cur_start = i
if cur:
    cats.append((cur, cur_start, len(lines)))

# Filter to categories with unchecked items
remaining = []
for cat, start, end in cats:
    undone = [l for l in lines[start:end] if re.match(r'\s*- \[ \]', l)]
    if undone:
        remaining.append((cat, start+1, end, undone))


def slugify(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower().strip('# ')).strip('-')


def make_prompt(categories):
    blocks = []
    for cat_header, start, end, undone_lines in categories:
        title = cat_header.strip('# ')
        blocks.append(f"### Category: {title} (handoff lines {start}-{end})")
        for line in undone_lines:
            blocks.append(line.rstrip())
        blocks.append("")
    cat_list = ", ".join(f"{c[0].strip('# ')}" for c in categories)
    slugs = [slugify(c[0]) for c in categories]
    files = "\n".join(f"- docs/public/parity/{s}.md" for s in slugs)
    return f"""You are a technical documentation writer working in `/Users/joe/Desktop/allternit-parity-workspace` on branch `parity/swarm-sprint`.

Read the task spec at `.parity-reports/TASK_SPEC.md` for context.

Your assignment: create Allternit parity documentation for the following OpenAI ChatGPT/Codex handoff categories:

{cat_list}

The unchecked items for these categories are listed below. For each item, research whether Allternit has an equivalent capability by reading the codebase and existing docs (e.g., `cmd/allternit-api/src/`, `cmd/gizzi-code/`, `packages/@allternit/`, `sdk/allternit-sdk/`, `docs/public/`). Then create one docs page per category:

{files}

Each page should:
- Briefly explain the original ChatGPT/Codex concept.
- Map it to the equivalent Allternit feature, config, CLI command, API endpoint, tool, or workflow.
- Include concrete examples (TOML config, curl, CLI commands) where applicable.
- If a concept has no Allternit equivalent and is not applicable to the self-host/BYOC model, document it as "Not applicable / roadmap" and explain why.

Do NOT edit `/Users/joe/Desktop/allternit-parity-handoff.md`. Do NOT run `git commit` or other git mutations. Run `cargo check -p allternit-api` only if you change Rust code; docs-only changes do not need builds.

When finished, write a report file `.parity-reports/{'-'.join(slugs)}.md` with YAML frontmatter containing `status`, `files_changed`, `items_covered`, `items_missing`, and `notes`, followed by prose.

Here are the unchecked items to cover:

{chr(10).join(blocks)}
"""


# Group categories into prompt bundles
bundles = [
    [('codex-manual-part1', 2293, 2410)],
    [('codex-manual-part2', 2411, 2528)],
    [('codex-manual-part3', 2529, 2646)],
    [('codex-manual-part4', 2647, 2765)],
    ['Codex App Server'],
    ['Developer commands'],
    ["What's new"],
    ['Codex Security plugin changelog'],
    ['Codex Security cloud FAQ', 'Codex Security CLI FAQ', 'Codex Security CLI reference', 'Codex Security TypeScript SDK', 'Codex Security CLI quickstart', 'Codex Security plugin quickstart'],
    ['Non-interactive mode', 'Commands', 'Custom Prompts', 'Administration', 'ChatGPT usage limits and spend controls'],
    ['ChatGPT desktop app', 'ChatGPT desktop app for Windows', 'Browser', 'Chrome extension', 'ChatGPT Voice', 'Appshots', 'WSL', 'Integrated terminal'],
    ['Codex Micro', 'Codex IDE extension', 'Codex cloud', 'Codex GitHub Action'],
    ['Code review', 'Review GitHub pull requests with Codex', 'Review code changes for security', 'Run Codex Security in CI', 'Run a Codex Security scan', 'Run a deep security scan', 'Run bulk security scans', 'Propose security hardening', 'Improving the threat model', 'Fix and verify security findings', 'Export and track security findings', 'Cyber Safety', 'Write vulnerability reports'],
    ['Use ChatGPT Work and Codex with Amazon Bedrock', 'Use Codex in Linear', 'Use Codex in Slack', 'Use the Codex Security workbench', 'Subagents', 'Triage a backlog', 'Troubleshooting', 'Record & Replay', 'Sample Configuration', 'Rules', 'Notifications', 'Plugin controls', 'Prisma AIRS', 'Import from another agent', 'Roles and workspace permissions', 'Personalize ChatGPT', 'Manage app updates', 'Chronicle', 'Get started with ChatGPT Work', 'Local environments'],
]

# Map name string to category tuple
name_to_cat = {c[0].strip('# '): c for c in remaining}

for idx, bundle_names in enumerate(bundles, 1):
    categories = []
    for item in bundle_names:
        if isinstance(item, tuple):
            # explicit line range for codex-manual parts
            label, s, e = item
            undone = [l for l in lines[s-1:e] if re.match(r'\s*- \[ \]', l)]
            if undone:
                categories.append((f"#### {label}", s, e, undone))
        else:
            cat = name_to_cat.get(item)
            if cat:
                categories.append(cat)
            else:
                print(f"  skipping {item} (no remaining unchecked items)")
    prompt = make_prompt(categories)
    slug = '-'.join(slugify(c[0]) for c in categories)[:80]
    path = OUT_DIR / f"bundle-{idx}-{slug}.txt"
    path.write_text(prompt)
    print(path)
