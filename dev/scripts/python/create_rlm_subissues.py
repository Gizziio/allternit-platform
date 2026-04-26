#!/usr/bin/env python3

import json
import sys
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

# Define the new sub-issues based on the RLMextrafeatures.md implementation plan
new_sub_issues = [
    {
        "id": "allternit-rlm.1",
        "title": "Implement Core Mode Infrastructure with ExecutionMode Enum",
        "description": "Create the foundational mode infrastructure for RLM implementation based on the Unix-mode architecture:\n\n- Implement ExecutionMode Enum with STANDARD, RLM, UNIX, HYBRID variants\n- Create abstract ModeExecutor base class with execute() and is_deterministic() methods\n- Implement proper error handling and async support\n- Ensure integration with existing Allternit architecture\n\nThis provides the foundation for all other RLM mode implementations.",
        "status": "open",
        "priority": 2,
        "issue_type": "task",
        "created_at": "2026-01-03T19:40:00-06:00",
        "created_by": "macbook",
        "updated_at": "2026-01-03T19:40:00-06:00",
        "dependencies": [
            {
                "issue_id": "allternit-rlm.1",
                "depends_on_id": "allternit-rlm",
                "type": "parent-child",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            }
        ]
    },
    {
        "id": "allternit-rlm.2",
        "title": "Implement Unix Mode Executor with Stateless Architecture",
        "description": "Create the Unix Mode Executor following Unix philosophy principles:\n\n- Implement UnixAgentConfig with role, purpose, background, instruction, and session_id\n- Create stateless, pipe-friendly agent execution (stdin/stdout JSON interface)\n- Implement minimal context construction with no hidden state\n- Ensure deterministic behavior (same input JSON → same output JSON)\n- Support structured output with session tracking and token counting\n\nThis provides the most composable and CI/CD friendly execution mode.",
        "status": "open",
        "priority": 2,
        "issue_type": "task",
        "created_at": "2026-01-03T19:40:00-06:00",
        "created_by": "macbook",
        "updated_at": "2026-01-03T19:40:00-06:00",
        "dependencies": [
            {
                "issue_id": "allternit-rlm.2",
                "depends_on_id": "allternit-rlm",
                "type": "parent-child",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm.2",
                "depends_on_id": "allternit-rlm.1",
                "type": "blocks",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            }
        ]
    },
    {
        "id": "allternit-rlm.3",
        "title": "Implement RLM Executor with Sub-LLM Orchestration",
        "description": "Create the core RLM Executor with recursive language model capabilities:\n\n- Implement RLMConfig with root_model, sub_model, max_recursion settings\n- Create sandboxed REPL environment with namespace management\n- Implement llm_batch function for parallel sub-LLM invocation\n- Support non-deterministic recursive execution with context decomposition\n- Handle 'Context Anxiety' and 'Lost in the Middle' problems\n- Integrate with existing memory fabric for state persistence\n\nThis enables 10M+ token reasoning through recursive decomposition.",
        "status": "open",
        "priority": 2,
        "issue_type": "task",
        "created_at": "2026-01-03T19:40:00-06:00",
        "created_by": "macbook",
        "updated_at": "2026-01-03T19:40:00-06:00",
        "dependencies": [
            {
                "issue_id": "allternit-rlm.3",
                "depends_on_id": "allternit-rlm",
                "type": "parent-child",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm.3",
                "depends_on_id": "allternit-rlm.1",
                "type": "blocks",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            }
        ]
    },
    {
        "id": "allternit-rlm.4",
        "title": "Implement Hybrid Mode with Auto-Selection Logic",
        "description": "Create the Hybrid Mode Executor that automatically selects the best execution mode:\n\n- Implement context threshold detection (32K tokens default)\n- Create complexity pattern matching for task analysis\n- Implement auto-selection algorithm based on context size and task complexity\n- Support fallback to appropriate mode (STANDARD, RLM, or UNIX)\n- Ensure proper mode routing and execution delegation\n\nThis provides intelligent mode selection for optimal performance.",
        "status": "open",
        "priority": 2,
        "issue_type": "task",
        "created_at": "2026-01-03T19:40:00-06:00",
        "created_by": "macbook",
        "updated_at": "2026-01-03T19:40:00-06:00",
        "dependencies": [
            {
                "issue_id": "allternit-rlm.4",
                "depends_on_id": "allternit-rlm",
                "type": "parent-child",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm.4",
                "depends_on_id": "allternit-rlm.1",
                "type": "blocks",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm.4",
                "depends_on_id": "allternit-rlm.2",
                "type": "blocks",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm.4",
                "depends_on_id": "allternit-rlm.3",
                "type": "blocks",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            }
        ]
    },
    {
        "id": "allternit-rlm.5",
        "title": "Implement Git-like Session Management System",
        "description": "Create comprehensive session management with Git-like operations:\n\n- Implement SessionOperation enum (EDIT, DELETE, FORK, COMPRESS)\n- Create fork functionality to branch sessions from specific turns\n- Implement compress functionality to summarize and reduce context\n- Add session backup and save functionality\n- Support human-readable JSON session files\n- Implement token counting and automatic compression\n\nThis enables sophisticated context control and management.",
        "status": "open",
        "priority": 2,
        "issue_type": "task",
        "created_at": "2026-01-03T19:40:00-06:00",
        "created_by": "macbook",
        "updated_at": "2026-01-03T19:40:00-06:00",
        "dependencies": [
            {
                "issue_id": "allternit-rlm.5",
                "depends_on_id": "allternit-rlm",
                "type": "parent-child",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            }
        ]
    },
    {
        "id": "allternit-rlm.6",
        "title": "Implement CLI Interface with Mode Selection",
        "description": "Create comprehensive CLI interface for RLM functionality:\n\n- Add --mode option (standard, rlm, unix, hybrid)\n- Implement role-based execution with --role option\n- Add session management commands (--session, --deterministic)\n- Create takt command for structured context delivery (s-age/pipe compatible)\n- Implement proper error handling and user feedback\n- Add documentation and help text\n\nThis provides user-friendly access to all RLM modes and features.",
        "status": "open",
        "priority": 2,
        "issue_type": "task",
        "created_at": "2026-01-03T19:40:00-06:00",
        "created_by": "macbook",
        "updated_at": "2026-01-03T19:40:00-06:00",
        "dependencies": [
            {
                "issue_id": "allternit-rlm.6",
                "depends_on_id": "allternit-rlm",
                "type": "parent-child",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm.6",
                "depends_on_id": "allternit-rlm.1",
                "type": "blocks",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm.6",
                "depends_on_id": "allternit-rlm.2",
                "type": "blocks",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm.6",
                "depends_on_id": "allternit-rlm.3",
                "type": "blocks",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm.6",
                "depends_on_id": "allternit-rlm.4",
                "type": "blocks",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            },
            {
                "issue_id": "allternit-rlm.6",
                "depends_on_id": "allternit-rlm.5",
                "type": "blocks",
                "created_at": "2026-01-03T19:40:00-06:00",
                "created_by": "macbook"
            }
        ]
    }
]

# Add the new sub-issues to the existing issues
all_issues = existing_issues + new_sub_issues

# Write all issues back to the file
with open('.beads/issues.jsonl', 'w') as f:
    for issue in all_issues:
        f.write(json.dumps(issue) + '\n')

print("Sub-issues created successfully!")
print(f"Added {len(new_sub_issues)} new sub-issues:")
for issue in new_sub_issues:
    print(f"  - {issue['id']}: {issue['title']}")