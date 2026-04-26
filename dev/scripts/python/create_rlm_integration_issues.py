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

# Define the new integration sub-issues
integration_issues = [
    {
        "id": "allternit-rlm-int.1",
        "title": "Integrate RLM as Router Layer with Existing Control Plane",
        "description": "Integrate RLM functionality as a routing layer within the existing control plane service instead of creating parallel execution paths:\n\n- Create RLMRouter that hooks into existing ProviderRouter\n- Implement context slicing logic that leverages existing embedding/vector capabilities\n- Connect to existing memory fabric for context management\n- Ensure proper error handling and async support\n- Maintain backward compatibility with existing functionality\n\nThis provides the foundation for all other RLM integration work.",
        "status": "open",
        "priority": 1,
        "issue_type": "task",
        "created_at": "2026-01-03T20:30:00-06:00",
        "created_by": "macbook",
        "updated_at": "2026-01-03T20:30:00-06:00",
        "dependencies": [
            {
                "issue_id": "allternit-rlm-int.1",
                "depends_on_id": "allternit-rlm",
                "type": "parent-child",
                "created_at": "2026-01-03T20:30:00-06:00",
                "created_by": "macbook"
            }
        ]
    },
    {
        "id": "allternit-rlm-int.2",
        "title": "Leverage Existing Python Gateway for RLM Python Execution",
        "description": "Replace the new Python sandbox implementation with integration to the existing Python Gateway service:\n\n- Use existing services/python-gateway for Python execution needs\n- Implement proper tool gateway integration for RLM-specific tools\n- Ensure security and policy enforcement through existing gateway\n- Maintain compatibility with existing Python tool ecosystem\n- Remove redundant Python sandbox code from RLM crate\n\nThis eliminates code duplication and leverages existing security infrastructure.",
        "status": "open",
        "priority": 1,
        "issue_type": "task",
        "created_at": "2026-01-03T20:30:00-06:00",
        "created_by": "macbook",
        "updated_at": "2026-01-03T20:30:00-06:00",
        "dependencies": [
            {
                "issue_id": "allternit-rlm-int.2",
                "depends_on_id": "allternit-rlm",
                "type": "parent-child",
                "created_at": "2026-01-03T20:30:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm-int.2",
                "depends_on_id": "allternit-rlm-int.1",
                "type": "blocks",
                "created_at": "2026-01-03T20:30:00-06:00",
                "created_by": "macbook"
            }
        ]
    },
    {
        "id": "allternit-rlm-int.3",
        "title": "Enhance Memory Fabric with RLM-Specific Context Management",
        "description": "Add RLM-specific methods to the existing memory fabric instead of creating new memory systems:\n\n- Add slice_context_for_rlm() method to existing MemoryFabric\n- Implement intelligent context slicing using existing embedding/vector capabilities\n- Add aggregate_rlm_results() method for result combination\n- Integrate with existing session management for RLM-specific tracking\n- Ensure proper error handling and async support\n\nThis leverages existing memory infrastructure instead of duplicating functionality.",
        "status": "open",
        "priority": 1,
        "issue_type": "task",
        "created_at": "2026-01-03T20:30:00-06:00",
        "created_by": "macbook",
        "updated_at": "2026-01-03T20:30:00-06:00",
        "dependencies": [
            {
                "issue_id": "allternit-rlm-int.3",
                "depends_on_id": "allternit-rlm",
                "type": "parent-child",
                "created_at": "2026-01-03T20:30:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm-int.3",
                "depends_on_id": "allternit-rlm-int.1",
                "type": "blocks",
                "created_at": "2026-01-03T20:30:00-06:00",
                "created_by": "macbook"
            }
        ]
    },
    {
        "id": "allternit-rlm-int.4",
        "title": "Add RLM Mode to Existing API Endpoints",
        "description": "Integrate RLM functionality into existing API endpoints via mode parameter instead of creating new routes:\n\n- Add mode parameter to existing /execute endpoint\n- Implement RLM-specific request handling in existing handlers\n- Maintain backward compatibility for standard mode\n- Add proper validation and error responses for RLM mode\n- Update API documentation and OpenAPI specs\n\nThis ensures RLM is part of existing API surface rather than creating parallel endpoints.",
        "status": "open",
        "priority": 2,
        "issue_type": "task",
        "created_at": "2026-01-03T20:30:00-06:00",
        "created_by": "macbook",
        "updated_at": "2026-01-03T20:30:00-06:00",
        "dependencies": [
            {
                "issue_id": "allternit-rlm-int.4",
                "depends_on_id": "allternit-rlm",
                "type": "parent-child",
                "created_at": "2026-01-03T20:30:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm-int.4",
                "depends_on_id": "allternit-rlm-int.1",
                "type": "blocks",
                "created_at": "2026-01-03T20:30:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm-int.4",
                "depends_on_id": "allternit-rlm-int.2",
                "type": "blocks",
                "created_at": "2026-01-03T20:30:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm-int.4",
                "depends_on_id": "allternit-rlm-int.3",
                "type": "blocks",
                "created_at": "2026-01-03T20:30:00-06:00",
                "created_by": "macbook"
            }
        ]
    },
    {
        "id": "allternit-rlm-int.5",
        "title": "Integrate RLM-Specific Policies with Existing Policy Engine",
        "description": "Add RLM-specific policy evaluation to the existing policy engine instead of creating new security systems:\n\n- Add RLMContextPolicy with max_context_size and max_recursion_depth\n- Implement evaluate_rlm_request() method in existing PolicyEngine\n- Add model access control for RLM-specific model usage\n- Ensure proper audit trail integration with existing systems\n- Maintain existing security controls for RLM operations\n\nThis leverages existing security infrastructure instead of duplicating functionality.",
        "status": "open",
        "priority": 2,
        "issue_type": "task",
        "created_at": "2026-01-03T20:30:00-06:00",
        "created_by": "macbook",
        "updated_at": "2026-01-03T20:30:00-06:00",
        "dependencies": [
            {
                "issue_id": "allternit-rlm-int.5",
                "depends_on_id": "allternit-rlm",
                "type": "parent-child",
                "created_at": "2026-01-03T20:30:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm-int.5",
                "depends_on_id": "allternit-rlm-int.1",
                "type": "blocks",
                "created_at": "2026-01-03T20:30:00-06:00",
                "created_by": "macbook"
            }
        ]
    },
    {
        "id": "allternit-rlm-int.6",
        "title": "Add RLM Mode to Existing CLI Commands",
        "description": "Integrate RLM functionality into existing CLI commands via mode parameter instead of creating new commands:\n\n- Add --mode option to existing execute command (standard, rlm, hybrid)\n- Implement RLM-specific command handling in existing CLI structure\n- Add RLM-specific configuration options\n- Update help text and documentation\n- Maintain backward compatibility for existing CLI usage\n\nThis ensures RLM is part of existing CLI surface rather than creating parallel commands.",
        "status": "open",
        "priority": 2,
        "issue_type": "task",
        "created_at": "2026-01-03T20:30:00-06:00",
        "created_by": "macbook",
        "updated_at": "2026-01-03T20:30:00-06:00",
        "dependencies": [
            {
                "issue_id": "allternit-rlm-int.6",
                "depends_on_id": "allternit-rlm",
                "type": "parent-child",
                "created_at": "2026-01-03T20:30:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm-int.6",
                "depends_on_id": "allternit-rlm-int.1",
                "type": "blocks",
                "created_at": "2026-01-03T20:30:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm-int.6",
                "depends_on_id": "allternit-rlm-int.4",
                "type": "blocks",
                "created_at": "2026-01-03T20:30:00-06:00",
                "created_by": "macbook"
            }
        ]
    }
]

# Add the new integration issues to the existing issues
all_issues = existing_issues + integration_issues

# Write all issues back to the file
with open('.beads/issues.jsonl', 'w') as f:
    for issue in all_issues:
        f.write(json.dumps(issue) + '\n')

print("Integration issues created successfully!")
print(f"Added {len(integration_issues)} new integration issues:")
for issue in integration_issues:
    print(f"  - {issue['id']}: {issue['title']}")