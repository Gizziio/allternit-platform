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

# Update the registry/capsule endpoints issue to mark as completed
for i, issue in enumerate(existing_issues):
    if issue['id'] == 'allternit-1gr.2':
        issue['status'] = 'completed'
        issue['close_reason'] = 'Registry and capsule endpoints fully implemented with comprehensive API coverage. All endpoints exposed: GET/POST for agents, skills, tools in registry; list/get/verify/execute for capsules. All endpoints properly wired with policy enforcement through existing middleware. Request/response serialization implemented with proper error handling. Unit tests and smoke tests cover happy paths. API documentation updated with proper OpenAPI specs. Integration with unified registry and capsule store completed.'
        issue['closed_at'] = datetime.now().strftime('%Y-%m-%dT%H:%M:%S-06:00')
        existing_issues[i] = issue
        break

# Write all issues back to the file
with open('.beads/issues.jsonl', 'w') as f:
    for issue in existing_issues:
        f.write(json.dumps(issue) + '\n')

print("Registry/capsule endpoints issue (allternit-1gr.2) updated to completed status!")