# POLICY.md — Dynamic Policy Overrides

> Runtime-adjustable policy. Changes here take effect immediately without restart.

## Experiment Flags
- parallel_subagents: false
- streaming_context: true
- speculative_execution: false

## Tool Overrides
| Tool | Policy |
|------|--------|
| network.http_request | ask_per_domain |
| filesystem.delete | require_confirm |
| git.push | require_approval |

## Approval Thresholds
- destructive: 1_confirm
- network: 1_confirm
- write_external: 2_approvals
- financial: 2_approvals

## Auto-Promotion Rules
- trusted_path_writes: 10
- test_passes_before_merge: true
