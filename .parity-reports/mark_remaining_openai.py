#!/usr/bin/env python3
"""Mark remaining OpenAI categories done with the new combined parity docs."""
import re
from pathlib import Path

HANDOFF = Path('/Users/joe/Desktop/allternit-parity-handoff.md')

mapping = {
    'Auto-review': 'docs/public/parity/codex-cicd-and-security.md',
    'Code review': 'docs/public/parity/codex-cicd-and-security.md',
    'Review GitHub pull requests with Codex': 'docs/public/parity/codex-cicd-and-security.md',
    'Run Codex Security in CI': 'docs/public/parity/codex-cicd-and-security.md',
    'Security Review': 'docs/public/parity/codex-cicd-and-security.md',
    'Use the Codex Security workbench': 'docs/public/parity/codex-cicd-and-security.md',
    'Triage a backlog': 'docs/public/parity/codex-cicd-and-security.md',
    'Write vulnerability reports': 'docs/public/parity/codex-cicd-and-security.md',
    'Chronicle': 'docs/public/parity/chatgpt-work-integrations.md',
    'Get started with ChatGPT Work': 'docs/public/parity/chatgpt-work-integrations.md',
    'Use ChatGPT Work and Codex with Amazon Bedrock': 'docs/public/parity/chatgpt-work-integrations.md',
    'Use Codex in Linear': 'docs/public/parity/chatgpt-work-integrations.md',
    'Use Codex in Slack': 'docs/public/parity/chatgpt-work-integrations.md',
    'Manage app updates': 'docs/public/parity/chatgpt-work-integrations.md',
    'Personalize ChatGPT': 'docs/public/parity/chatgpt-work-integrations.md',
    'Troubleshooting': 'docs/public/parity/chatgpt-work-integrations.md',
    'Codex Micro': 'docs/public/parity/codex-surfaces-and-marketplace.md',
    'Codex IDE extension': 'docs/public/parity/codex-surfaces-and-marketplace.md',
    'Codex cloud': 'docs/public/parity/codex-surfaces-and-marketplace.md',
    'Codex GitHub Action': 'docs/public/parity/codex-surfaces-and-marketplace.md',
    'Deploy the Windows app': 'docs/public/parity/codex-surfaces-and-marketplace.md',
    'Windows sandbox': 'docs/public/parity/codex-surfaces-and-marketplace.md',
    'Plugin controls': 'docs/public/parity/codex-surfaces-and-marketplace.md',
    'Prisma AIRS': 'docs/public/parity/codex-surfaces-and-marketplace.md',
    'Import from another agent': 'docs/public/parity/codex-surfaces-and-marketplace.md',
    'Roles and workspace permissions': 'docs/public/parity/codex-surfaces-and-marketplace.md',
}

with HANDOFF.open() as f:
    lines = f.readlines()

in_openai = False
active_doc = None
header_re = re.compile(r'^####\s+(.*)$')
item_re = re.compile(r'^(\s*)-\s+\[\s*\]\s+(.*)$')
updated = 0

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
        active_doc = mapping.get(title)
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
print(f"Marked {updated} remaining OpenAI items done.")
