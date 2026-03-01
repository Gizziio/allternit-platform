# Legacy Spec Audit Plan

**Version:** 1.0.0  
**Status:** Draft  
**Related:** P4.15, LAW-CHG-003

---

## 1. Overview

This plan defines the systematic audit of legacy specifications to:
- Categorize implementable vs. obsolete specs
- Migrate valid specs to `/spec/`
- Archive deprecated content
- Create clear implementation roadmap

---

## 2. Audit Scope

### 2.1 Directories to Audit

```
/docs/_archive/legacy-specs/organized/
├── Architecture/LAW/          # → SYSTEM_LAW.md (done)
├── Architecture/UI/           # → TODO
├── Architecture/INTEGRATIONS/ # → TODO
├── Architecture/UNIFIED/      # → TODO
└── ...

/docs/_completed/specifications/spec/
├── HooksSystem_spec.md        # → Implement or archive
├── ContextRouting_spec.md     # → Implement or archive
├── CanvasProtocol_spec.md     # → Implement or archive
├── Capsules_spec.md           # → Implement or archive
└── SkillsSystem_spec.md       # → Implement or archive
```

### 2.2 Categorization Criteria

| Category | Criteria | Action |
|----------|----------|--------|
| **Implement** | Valid, aligned with current architecture | Migrate to `/spec/` |
| **Archive** | Obsolete, superseded | Move to `/docs/_archive/obsolete/` |
| **Merge** | Partially valid | Merge into existing spec |
| **Rewrite** | Valid concept, outdated details | Rewrite with current patterns |

---

## 3. Audit Process

### 3.1 Phase 1: Inventory (Week 1)

```bash
# Generate inventory
find docs/_archive -name "*.md" -type f > /tmp/legacy-spec-inventory.txt
find docs/_completed -name "*.md" -type f >> /tmp/legacy-spec-inventory.txt

# Categorize
for spec in $(cat /tmp/legacy-spec-inventory.txt); do
  categorize_spec "$spec"
done
```

### 3.2 Phase 2: Migration (Week 2-3)

```typescript
interface SpecMigration {
  source: string;
  target: string;
  category: 'implement' | 'archive' | 'merge' | 'rewrite';
  status: 'pending' | 'in_progress' | 'complete';
}

async function migrateSpec(migration: SpecMigration): Promise<void> {
  // 1. Read source
  const content = await readFile(migration.source);
  
  // 2. Transform if needed
  const transformed = await transformSpec(content, migration.category);
  
  // 3. Write to target
  await writeFile(migration.target, transformed);
  
  // 4. Update references
  await updateReferences(migration.source, migration.target);
  
  // 5. Archive source
  if (migration.category !== 'merge') {
    await archive(migration.source);
  }
}
```

### 3.3 Phase 3: Implementation Planning (Week 4)

For each migrated spec:
1. Create implementation task
2. Estimate effort
3. Add to backlog
4. Link to DAG tasks

---

## 4. Priority Specs

### 4.1 High Priority (Implement First)

| Spec | Location | Reason |
|------|----------|--------|
| CanvasProtocol | `/docs/_completed/specifications/spec/` | Core UI feature |
| Capsules | `/docs/_completed/specifications/spec/` | Core deployment unit |
| ContextRouting | `/docs/_completed/specifications/spec/` | Memory integration |

### 4.2 Medium Priority

| Spec | Location | Reason |
|------|----------|--------|
| HooksSystem | `/docs/_completed/specifications/spec/` | Already implemented |
| SkillsSystem | `/docs/_completed/specifications/spec/` | Agent capabilities |

### 4.3 Low Priority (Review First)

| Spec | Location | Action |
|------|----------|--------|
| Legacy UI specs | `/docs/_archive/legacy-specs/organized/Architecture/UI/` | Review for relevant patterns |
| Old integration specs | `/docs/_archive/legacy-specs/organized/Architecture/INTEGRATIONS/` | Archive most |

---

## 5. Output Artifacts

### 5.1 Spec Index

```markdown
# Legacy Spec Index

## Migrated to /spec/
- [ ] CanvasProtocol.md → /spec/presentation/CanvasProtocol.md
- [ ] Capsules.md → /spec/deployment/Capsules.md

## Archived
- [ ] OldUIPatterns.md → /docs/_archive/obsolete/
- [ ] DeprecatedIntegrations.md → /docs/_archive/obsolete/

## Merged
- [ ] HooksV1.md → merged into SYSTEM_LAW.md
```

### 5.2 Implementation Backlog

```markdown
# Spec-Derived Implementation Tasks

- [ ] Implement Canvas Protocol (from CanvasProtocol.md)
- [ ] Implement Capsule System v2 (from Capsules.md)
- [ ] Implement Context Router (from ContextRouting.md)
```

---

## 6. Success Criteria

- [ ] All legacy specs categorized
- [ ] Implementable specs in `/spec/`
- [ ] Obsolete specs archived
- [ ] Implementation roadmap created
- [ ] References updated

---

## 7. Related Documents

- [LAW-CHG-003](../../SYSTEM_LAW.md#law-chg-003) - Change Protocol
- [Living Files Doctrine](../governance/living-files-doctrine.md)
- [DAG Task Index](../DAG_TASKS_INDEX.md)
