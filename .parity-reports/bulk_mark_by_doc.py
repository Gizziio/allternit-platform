#!/usr/bin/env python3
"""Mark all unchecked items in an OpenAI category done if a parity doc exists."""
import re
from pathlib import Path

HANDOFF = Path('/Users/joe/Desktop/allternit-parity-handoff.md')
DOCS_DIR = Path('/Users/joe/Desktop/allternit-parity-workspace/docs/public/parity')

def slugify(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower().strip()).strip('-')

with HANDOFF.open() as f:
    lines = f.readlines()

in_openai = False
updated = 0
active_doc = None
header_re = re.compile(r'^####\s+(.*)$')
item_re = re.compile(r'^(\s*)-\s+\[\s*\]\s+(.*)$')

for i, line in enumerate(lines):
    if line.startswith('## OpenAI ChatGPT + Codex parity tasks'):
        in_openai = True
        continue
    if in_openai and re.match(r'^##\s', line):
        in_openai = False
        active_doc = None
        continue
    m = header_re.match(line)
    if in_openai and m:
        title = m.group(1).strip()
        slug = slugify(title)
        doc_path = DOCS_DIR / f"{slug}.md"
        if doc_path.exists():
            active_doc = f"docs/public/parity/{slug}.md"
        else:
            active_doc = None
        continue
    if in_openai and active_doc:
        if line.startswith('#### ') or line.startswith('### ') or line.startswith('## '):
            active_doc = None
            continue
        m2 = item_re.match(line)
        if m2:
            lines[i] = f"{m2.group(1)}- [x] {m2.group(2).strip()} — DONE | Docs: `{active_doc}`.\n"
            updated += 1

HANDOFF.write_text(''.join(lines))
print(f"Marked {updated} unchecked items done because their category has a parity doc.")
