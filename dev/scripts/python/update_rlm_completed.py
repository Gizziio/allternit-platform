#!/usr/bin/env python3

import json
from datetime import datetime

# Read the current issues.jsonl file
with open('.beads/issues.jsonl', 'r') as f:
    lines = f.readlines()

# Parse all existing issues
existing_issues = []
for line in lines:
    if line.strip():
        issue = json.loads(line.strip())
        existing_issues.append(issue)

# Update the main RLM issue to mark as completed
for i, issue in enumerate(existing_issues):
    if issue['id'] == 'a2rchitech-rlm':
        issue['status'] = 'completed'
        issue['close_reason'] = 'RLM implementation completed with Unix-like architecture. All sub-issues implemented: core mode infrastructure, Unix mode executor, RLM executor with sub-LLM orchestration, hybrid mode with auto-selection, and proper integration with existing A2rchitech components. Python REPL environment created with proper sandboxing, helper model orchestration implemented, and memory fabric integration completed.'
        issue['closed_at'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S-06:00')
        existing_issues[i] = issue
        break

# Update sub-issues to mark them as completed too
for i, issue in enumerate(existing_issues):
    if issue['id'].startswith('a2rchitech-rlm.'):
        issue['status'] = 'completed'
        issue['close_reason'] = 'Component completed as part of main RLM implementation.'
        issue['closed_at'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S-06:00')
        existing_issues[i] = issue

# Write all issues back to the file
with open('.beads/issues.jsonl', 'w') as f:
    for issue in existing_issues:
        f.write(json.dumps(issue) + '\n')

print("RLM issues updated to completed status!")
print(f"Updated {len([i for i in existing_issues if i['id'].startswith('a2rchitech-rlm')])} issues")