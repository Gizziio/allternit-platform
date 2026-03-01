# Fresh Context Isolation Rules

When a node has `execution_mode: fresh`, the gate must provide a clean context window.

## Must include
- PromptCreated raw text
- All PromptDeltaAppended deltas linked to this dag/node (and optionally ancestor chain)
- DAG slice:
  - node itself
  - ancestor chain to root
  - blocked_by dependency predecessors
  - optionally related_to neighbors if explicitly whitelisted
- Receipts from dependency predecessors (hard deps)

## Must exclude by default
- sibling nodes not in dependency chain
- unrelated mail threads
- unrelated receipts
- unrelated DAGs/projects

## Practical implementation
- Build a ContextPack artifact (JSON) that enumerates allowed references.
- Stored at `.a2r/work/dags/<dag_id>/wih/context/<wih_id>.context.json`.
- Capsules mount only the ContextPack + referenced files.

ContextPack (v1) includes:
- prompt timeline (raw text + deltas)
- dag_slice (nodes/edges/relations for node + ancestors + deps)
- dependency_nodes list
- receipt refs for dependency predecessors
- context_pack_path is recorded on WIHCreated for discoverability
- related_to nodes are included only when relation has `context_share: true`
