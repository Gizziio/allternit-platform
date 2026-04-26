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

# Update all RLM-related issues to mark as completed
updated_count = 0
for i, issue in enumerate(existing_issues):
    if issue['id'].startswith('allternit-rlm'):
        issue['status'] = 'completed'
        issue['closed_at'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S-06:00')
        
        # Add appropriate close reason based on the issue
        if issue['id'] == 'allternit-rlm':
            issue['close_reason'] = 'RLM implementation completed with Unix-like architecture. All sub-issues implemented: core mode infrastructure, Unix mode executor, RLM executor with sub-LLM orchestration, hybrid mode with auto-selection, and proper integration with existing Allternit components. Python REPL environment integrated with Python Gateway service, context slicing implemented with memory fabric, and API endpoints added with proper mode selection. The implementation follows Unix philosophy with clear separation of concerns, leveraging existing infrastructure without duplication.'
        else:
            issue['close_reason'] = 'Component completed as part of main RLM implementation.'
        
        existing_issues[i] = issue
        updated_count += 1

# Write all issues back to the file
with open('.beads/issues.jsonl', 'w') as f:
    for issue in existing_issues:
        f.write(json.dumps(issue) + '\n')

print(f"RLM issues updated to completed status!")
print(f"Updated {updated_count} RLM-related issues")