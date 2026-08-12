#!/usr/bin/env python3
"""Parse parity report files and mark covered handoff items as done."""
import re
from pathlib import Path
import yaml

HANDOFF = Path('/Users/joe/Desktop/allternit-parity-handoff.md')
REPORT_DIR = Path('/Users/joe/Desktop/allternit-parity-workspace/.parity-reports')

def parse_frontmatter(text):
    if text.startswith('---'):
        parts = text.split('---', 2)
        if len(parts) >= 3:
            try:
                return yaml.safe_load(parts[1])
            except Exception as e:
                print(f"YAML parse error: {e}")
    return {}

reports = list(REPORT_DIR.glob('*.md'))
items = []
for report in reports:
    if report.name == 'TASK_SPEC.md':
        continue
    data = parse_frontmatter(report.read_text())
    for item in data.get('items_covered', []) or []:
        items.append((item, report.name))

print(f"Found {len(reports)-1} reports with {len(items)} covered items.")

text = HANDOFF.read_text()
lines = text.splitlines(keepends=True)
updated = 0
already = 0
not_found = []

for item, source in items:
    # Escape regex special chars in item text
    pattern = re.escape(item)
    found = False
    for i, line in enumerate(lines):
        if re.match(r'\s*- \[ \]', line) and re.search(pattern, line):
            # Mark done, append source reference
            lines[i] = re.sub(r'^(\s*)-\s+\[\s*\]\s+', r'\1- [x] ', line).rstrip() + f" — DONE | Docs report: `{source}`.\n"
            updated += 1
            found = True
            break
    if not found:
        # Check if already done
        for line in lines:
            if re.match(r'\s*- \[x\]', line) and re.search(pattern, line):
                already += 1
                found = True
                break
    if not found:
        not_found.append(item[:120])

HANDOFF.write_text(''.join(lines))
print(f"Updated {updated} lines; {already} already done; {len(not_found)} not found.")
if not_found:
    print("Sample not found:")
    for s in not_found[:10]:
        print(f"  - {s}")
