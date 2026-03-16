# Work Layer

## Purpose
This layer handles the DAG-centric view of work, where every plan becomes a DAG task or subtask tethered to a canonical `dag_id`. It keeps WIH as the envelope for execution and prevents drift by linking prompts, policy data, and derived views to the graph.

## Key directories & files
- `src/dag/` (if present) or `src/domain/dag.rs` – defines DAG nodes, relationships, and the node/sibling metadata (parent_id, blocked_by, related_to).
- `src/bin/a2r-rails.rs` – entry point; command parsing for `a2r rails plan`, `a2r rails dag`, and `a2r rails wih`.
- `.a2r/work/dags/<dag_id>/` – derived view snapshots generated after each structural mutation (node create/edit, dependency change).

## Commands
| Command | Role | Notes |
| --- | --- | --- |
| `a2r rails plan create <description>` | Translates intent to nodes | emits `PromptCreated` + `DagNodeCreated`; anchors prompt ↔ DAG links. |
| `a2r rails dag node add` | Adds task/subtask | attaches parent/blocking relations and records `MutationProvenance`. |
| `a2r rails wih pickup <wih_id>` | Claims a WIH | writes `WIHPickedUp`, enforces `Gate` requirements. |
| `a2r rails wih close <wih_id>` | Initiates close | writes `WIHClosedSigned`, which is the trigger for the autonomous pipeline. |
| `a2r rails work status` | Observes DAG/WIH | shows the derived WIH view and the Ralph loop state from `.a2r/work`. |

## Invariants
- `dag_id` is the canonical `work_id`; there are no separate ticket IDs. Every WIH/run/transport thread references that `dag_id`.
- Subtasks can be `blocked_by` (hard dependency) or `related_to` (context-sharing) but always trace back to the root DAG node.
- Prompt deltas and graph mutations are append-only events, and each mutation references a prompt/delta or explicit agent decision (enforced by the gate). EOF