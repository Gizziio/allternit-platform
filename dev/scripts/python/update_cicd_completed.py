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

# Update the CI/CD pipeline issue to mark as completed
for i, issue in enumerate(existing_issues):
    if issue['id'] == 'allternit-1gr.10':
        issue['status'] = 'completed'
        issue['close_reason'] = 'CI/CD pipeline fully implemented with comprehensive workflow covering linting (fmt, clippy), testing (unit, integration, e2e), building (cross-platform for Linux/Windows/Mac), and container builds. Release workflow documented in RELEASE_WORKFLOW.md with proper versioning strategy, pre-release checklist, and rollback procedures. Container build jobs added for API, CLI, and Python Gateway services with optimized Dockerfiles for production deployment.'
        issue['closed_at'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S-06:00')
        existing_issues[i] = issue
        break

# Write all issues back to the file
with open('.beads/issues.jsonl', 'w') as f:
    for issue in existing_issues:
        f.write(json.dumps(issue) + '\n')

print("CI/CD pipeline issue (allternit-1gr.10) updated to completed status!")