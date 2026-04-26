# CLI Command Taxonomy — `a2`

## Namespace: `a2`

### Daemon Management
- `a2 up`: Start the brain daemon.
- `a2 down`: Stop the brain daemon.
- `a2 status`: Check daemon health and active capsules.
- `a2 logs [-f]`: Stream daemon logs.
- `a2 doctor`: Diagnostic tool for system integrity.

### Evidence Management
- `a2 ev add <target>`: Add evidence (URL, file path).
- `a2 ev ls`: List all evidence in the active workspace.
- `a2 ev show <id>`: Show evidence content and metadata.
- `a2 ev rm <id>`: Remove evidence.

### Capsule Operations
- `a2 cap new --goal "..." [--evidence id1,id2]`: Spawn a new capsule.
- `a2 cap ls`: List active and archived capsules.
- `a2 cap show <id>`: Output the full CapsuleSpec (JSON).
- `a2 cap open <id>`: Deep link into the Unified UI.
- `a2 cap compile <id>`: Force re-compilation of the spec.
- `a2 cap patch <id> --json '...'`: Apply a manual patch to the spec.
- `a2 cap export <id> --format <md|json|pdf>`: Export results.

### Journal Interaction
- `a2 j tail`: Live stream of journal events.
- `a2 j ls [--run <id>]`: List events for a specific execution run.
- `a2 j explain <id>`: Human-readable summary of an event.
- `a2 j replay <id>`: Debug replay of an execution sequence.

### Tool Execution
- `a2 tools ls`: List all registered system tools.
- `a2 run <tool_id> --json '...'`: Direct tool invocation.
- `a2 act <action_id> --cap <id>`: Trigger an action defined in a capsule.
