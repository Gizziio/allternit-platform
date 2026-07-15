---
status: done
files_changed:
  - cmd/allternit-api/Cargo.toml
  - cmd/allternit-api/migrations/V19__gc_project_scoping.sql
  - cmd/allternit-api/src/agent_operations_routes.rs
  - surfaces/ai.allternit.com/src/views/settings/AgentOpsPanel.tsx
  - docs/GC_ENGINE_PHASE_1_NOTES.md
deviations:
  - "Used a nullable default_branch instead of forcing a branch name, so an unset value follows the remote repository's HEAD; configured branches are passed explicitly to shallow clone."
  - "The cached workspace uses synchronous std::process::Command because the existing GC route handlers and rusqlite connection are synchronous; the HTTP response remains synchronous as allowed by the spec."
remaining:
  - "A real project picker remains deferred; the frontend currently selects the first Cowork project returned by the authenticated API."
  - "Auto-fix execution remains deferred, so issuesFixed reflects the analyzer result and is currently normally zero."
---

# GC Engine Phase 1 Notes

The `allternit-gc-agents` crate compiled successfully before any implementation changes. Its resolved `tree-sitter` dependencies are compatible with the workspace lockfile, so no files under `domains/governance/garbage-collection/gc-agents/` needed modification.

Project scoping uses the existing `cowork_projects` table because it is already the authenticated project concept used by this API. Migration V19 adds nullable `git_remote` and `default_branch` columns. A missing `git_remote` produces a clear 422 response rather than guessing a server workdir. `default_branch` is nullable so the remote's HEAD remains the sensible default; when configured, it is supplied to `git clone --branch`.

`gc_policies` is recreated with `(project_id, id)` as its composite primary key and a foreign key to `cowork_projects`. The old global rows cannot be assigned to a tenant safely, so they are removed during the permitted table recreation. The authenticated GET and PUT policy routes lazily insert the six defaults for each owned project. `gc_runs` gains nullable `project_id` for compatibility with historical rows and an index on `(project_id, executed_at)`; all new runs persist a real project ID.

The execution path resolves an owned project, clones its repository shallowly into the application data directory at `allternit/gc-workspaces/<project_id>`, and reuses that checkout with `git pull --ff-only` on later runs. Clone and pull failures return genuine HTTP errors. The selected real analyzer runs against that checkout, its severities and issue fields are mapped to the existing camelCase response shape, and its actual counts, entropy reduction, metadata, and issues are persisted.

The frontend resolves the current Phase 1 project by calling `GET /api/v1/cowork/projects` and selecting the first returned project. The GC call site contains the requested `TODO` for a real project picker. Every queue, policy, cleanup, history, and single-agent request passes that ID consistently as `?projectId=`. If no project exists, GC actions report an error instead of sending an unscoped request.

The route names already match the crate identifiers exactly:

- `duplicate_detector` → `DuplicateDetector`
- `boundary_type_checker` → `BoundaryTypeChecker`
- `dependency_validator` → `DependencyValidator`
- `observability_checker` → `ObservabilityChecker`
- `documentation_sync` → `DocumentationSync`
- `test_coverage_checker` → `TestCoverageChecker`

Verification completed successfully:

- `cargo check -p allternit-gc-agents`
- `cargo check -p allternit-api`

Both commands passed. The only remaining warnings are pre-existing warnings outside the GC changes.
