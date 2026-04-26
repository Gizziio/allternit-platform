# ROOT_LEFTOVERS.MD

Analysis of top-level directories that need to be classified into canonical layers or marked as root exceptions.

## Current Root Directories Status

### ✅ Already Classified (Canonical Layers)
- `infrastructure/` - Shared foundations (correctly placed)
- `domains/kernel/` - Execution engine (correctly placed)
- `domains/governance/` - Policy and governance (correctly placed)
- `services/` - Runtime boundary and vendor quarantine (correctly placed)
- `services/` - Long-running services (correctly placed)
- `5-ui/` - UI platform components (correctly placed)
- `6-apps/` - Application entrypoints (correctly placed)

### 🔄 In Process (Being Migrated)
- `crates/` → Will be distributed to appropriate layers (domains/kernel/, domains/governance/, services/, services/, infrastructure/)
- `packages/` → Will be distributed to appropriate layers (infrastructure/, domains/governance/, services/, 5-ui/, 6-apps/)
- `apps/` → Will be distributed to 6-apps/ (active) and 6-apps/_legacy/ (inactive)

### ⚠️ Root Exceptions (Allowed at Root)
These directories are legitimate root-level exceptions that should remain:
- `.git/` - SCM metadata (root exception)
- `.github/` - GitHub configuration (root exception)
- `docs/` - Cross-layer documentation (root exception)
- `spec/` - Source-of-truth specs (root exception)
- `scripts/` - Repo tooling (root exception)
- `tests/` - Cross-layer tests (root exception)
- `tools/` - Repo tools (root exception)
- `node_modules/` - Build artifacts (gitignored)
- `target/` - Rust build artifacts (gitignored)
- `dist/` - JS build artifacts (gitignored)
- `.allternit/` - Agent workspace (root exception)
- `.logs/` - Log files (root exception)
- `.references/` - External references (root exception)
- `.shared/` - Shared agent artifacts (root exception)

### 🗂️ Need Classification (Non-Canonical Directories)
- `agent/` → Should likely go to workspace/agent/ or remain as root exception
- `bin/` → Should go to 6-apps/bin/ (app entrypoints)
- `infra/` → Should remain as root exception (infrastructure definitions)
- `launchd/` → Should remain as root exception (system service configs)
- `patches/` → Should remain as root exception (patch files)
- `plan/` → Should remain as root exception (planning docs)
- `reference/` → Should go to services/vendor/references/ (vendor code) or docs/
- `security/` → Should go to domains/kernel/security/ or domains/governance/security/
- `workers/` → Should go to services/workers/ (long-running processes)
- `workspace/` → Should remain as root exception (workspace management)

### 🧹 Cleanup Items (Should be removed or relocated)
- `.venv*` directories → These are virtual environments that should not be in repo
- Various .md files → Should be reviewed for proper location

## Action Plan

### Immediate Actions
1. Move remaining `crates/`, `packages/`, `apps/` to appropriate canonical layers
2. Classify `agent/`, `bin/`, `reference/`, `security/`, `workers/` into appropriate layers
3. Verify root exceptions are legitimately needed at root

### Migration Path for Non-Classified Directories

#### agent/ → workspace/agent/ or keep as root exception
- If it's agent workspace tooling, keep as root exception
- If it's runtime code, move to appropriate layer

#### bin/ → 6-apps/bin/
- Binary executables are app entrypoints

#### reference/ → services/vendor/references/ or docs/
- If it's vendor code → services/vendor/
- If it's documentation → docs/

#### security/ → domains/kernel/security/ or domains/governance/security/
- If it's execution security → domains/kernel/
- If it's policy/governance → domains/governance/

#### workers/ → services/workers/
- Workers are long-running services

#### .venv* directories → Remove from repo
- Virtual environments should not be committed to repo

## Status
Most of the reorganization has already been completed. The canonical layers are in place and populated. The remaining directories are either root exceptions or need minor classification adjustments.