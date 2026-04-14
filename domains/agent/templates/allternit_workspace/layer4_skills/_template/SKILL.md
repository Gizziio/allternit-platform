# SKILL.md — {skill_name}

## Intent
One sentence describing what this procedure accomplishes.

## When to Use
- Condition 1
- Condition 2

## When NOT to Use
- Quick fix that can be done inline
- No existing code to work with
- Not in the skills list

## Inputs
| Name | Type | Description |
|------|------|-------------|
| target_paths | paths | Files/directories to modify |
| goal | string | Desired end state |

## Outputs
| Name | Type | Description |
|------|------|-------------|
| report | markdown | Path to `outputs/{skill}/{timestamp}/report.md` |
| changed_files | list | Files that were modified |

## Procedure
1. **Identify scope** — Confirm which files need changes
2. **Gather baseline** — Run tests, record current state
3. **Make smallest safe change** — One logical change at a time
4. **Verify** — Run tests, check for regressions
5. **Record receipts** — Log what was done and why

## Verification
- `cargo test` (for Rust projects)
- `npm test` (for Node projects)
- Manual verification steps

## Rollback
How to undo this change if something goes wrong.

## Safety & Escalation
- Escalate to user if: [conditions]
- Never do: [forbidden actions]
- If stuck for >3 steps: Ask for help

## Metadata
- version: 1.0.0
- author: {agent_name}
- created: {date}
- parent: reference to parent skill (if any)
