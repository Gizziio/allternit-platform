# Repo Law: Version Naming and Event Emission Boundaries

## Law ID: RL-001

**Effective:** 2026-02-23  
**Scope:** All gateway code under `4-services/a2r-gateway/`

---

## Rule 1: No Version Folder Naming

**Statement:**
> Versions live in spec/constants, not directory names.

**Prohibited:**
- ❌ `gateway/v0/`
- ❌ `gateway/v1/`
- ❌ `bindings/ui_v0/`
- ❌ `bindings/ui_v1/`
- ❌ Any folder containing `v` followed by a number as a version identifier

**Required:**
- ✅ Role-based folder names: `runtime/`, `bindings/`, `adapters/`, `transports/`
- ✅ Version identifiers in constants: `UI_CONTRACT_ID = 'ui-contract-legacy@2026-02'`
- ✅ Version documentation in `/spec/contracts/`

**Rationale:**
Folder naming with versions creates semantic debt and confusion between protocol contracts and gateway versions. Role-based naming is stable; versions evolve in constants.

---

## Rule 2: Event Emission Boundaries

**Statement:**
> Canonical event emission originates from kernel adapter only.

**Prohibited:**
- ❌ `eventBus.publish()` in `transports/*`
- ❌ `eventBus.publish()` in `bindings/*`
- ❌ `eventBus.emit()` outside `runtime/` and `adapters/kernel/`
- ❌ Synthetic event construction in transport layer

**Required:**
- ✅ All canonical events emitted from `adapters/kernel/*`
- ✅ `runtime/` may emit system events (health, internal)
- ✅ `bindings/*` only translates envelope format
- ✅ `transports/*` only mounts routes and handles HTTP concerns

**Enforcement:**
```bash
# Run before every PR
npm run lint:determinism
```

**Rationale:**
Determinism requires single source of truth for event emission. Transport layers must not act as execution engines.

---

## Rule 3: Contract Freezing

**Statement:**
> Legacy UI contracts are frozen as spec artifacts.

**Required:**
- ✅ Every contract binding has a corresponding spec document
- ✅ Spec document includes: contract ID, event types, wire format
- ✅ Tests reference contract ID constant

**Example:**
```
bindings/ui_contract_legacy/  →  /spec/contracts/ui-contract-legacy.md
```

---

## Enforcement

### Pre-commit Hook

```bash
#!/bin/bash
# .husky/pre-commit

npm run lint:determinism || exit 1

# Check for version folder naming
if find 4-services/a2r-gateway -type d -name '*v[0-9]*' | grep -q .; then
  echo "❌ Version folder naming detected. Use role-based names."
  exit 1
fi
```

### CI Check

```yaml
# .github/workflows/gateway-lint.yml
name: Gateway Laws
on: [push, pull_request]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint:determinism
      - run: node scripts/check-version-folders.js
```

---

## Violations

| Violation | Severity | Action |
|-----------|----------|--------|
| Version folder naming | High | PR blocked, rename required |
| eventBus.publish() in transport | Critical | PR blocked, refactor required |
| Missing spec for contract | Medium | PR blocked, doc required |

---

## Exceptions

Exceptions require:
1. Written justification in PR description
2. Approval from maintainer
3. Sunset date for temporary violations

---

**Maintainer:** A2R Platform Team  
**Review Cycle:** Quarterly
