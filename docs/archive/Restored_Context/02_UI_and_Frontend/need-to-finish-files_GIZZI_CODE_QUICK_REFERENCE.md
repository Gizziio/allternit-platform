# Gizzi-Code Audit - Quick Reference Card

## 🎯 The Problem

**Gizzi-Code = 560MB monolith** mixing TUI, runtime, AI providers, database, and protocols.

**Result:** Hard to maintain, can't replace UI, can't run headless, violates Allternit architecture.

---

## ✅ The Solution

**Split into 2 packages:**

```
@allternit/gizzi-code (50MB)  → TUI ONLY
@allternit/runtime (500MB)    → Everything else
```

---

## 📊 Before vs After

| Aspect | Before | After |
|--------|--------|-------|
| **Package** | 1 monolith | 2 focused packages |
| **Size** | 560MB | 50MB + 500MB |
| **Dependencies** | 80+ mixed | 15 (TUI) + 65 (runtime) |
| **UI Replaceable** | ❌ No | ✅ Yes |
| **Headless Mode** | ❌ No | ✅ Yes |
| **Allternit Compliant** | ⚠️ Partial | ✅ Full |
| **Testable** | ❌ Hard | ✅ Easy |

---

## 🗺️ Migration Map

```
Week 1-2   → Foundation (Allternit boot sequence)
Week 3-4   → Decoupling (extract runtime)
Week 5-6   → Allternit Layers (implement all 5)
Week 7-8   → Kernel Sync (Rust FFI)
Week 9-10  → Optimization (lazy loading, tree shaking)
```

---

## 📁 Allternit File Structure (Create This)

```
workspace/
├── AGENTS.md          # Constitution
├── IDENTITY.md        # Who you are
├── SOUL.md            # Style profile
├── USER.md            # User prefs
├── TOOLS.md           # Environment
├── SYSTEM.md          # Constraints
├── POLICY.md          # Dynamic overrides
├── MEMORY.md          # Curated memory
├── skills/            # Skill definitions
└── .allternit/              # Machine state
    ├── manifest.json
    ├── state/
    ├── contracts/
    └── context/
```

---

## 🔴 Stop Doing This

```typescript
// ❌ Don't import AI providers in TUI
import { createOpenAI } from "@ai-sdk/openai"
import { createAnthropic } from "@ai-sdk/anthropic"

// ❌ Don't mix runtime with UI
src/cli/ui/components/Chat.tsx
  → calls Drizzle ORM directly
  → calls Hono server directly
```

---

## ✅ Start Doing This

```typescript
// ✅ Import from runtime package
import { SkillRegistry } from "@allternit/runtime/skills"
import { ProviderRouter } from "@allternit/runtime/providers"

// ✅ TUI is thin wrapper
src/cli/commands/skills.ts
  → calls @allternit/runtime
  → displays results with OpenTUI
```

---

## 📦 Dependency Rules

### TUI Can Have:
- ✅ UI libraries (@opentui, solid-js, @clack)
- ✅ CLI tools (yargs, clipboardy)
- ✅ Basic utils (zod, remeda)

### Runtime Has:
- ✅ AI providers (all 23 of them)
- ✅ Database (Drizzle)
- ✅ Web server (Hono)
- ✅ Protocols (MCP, ACP)
- ✅ Cloud SDKs (AWS, Azure)

### TUI Must NOT Have:
- ❌ @ai-sdk/* packages
- ❌ drizzle-orm
- ❌ hono
- ❌ @aws-sdk/*
- ❌ @azure/*

---

## 🎯 Success Metrics

- [ ] TUI size < 50MB
- [ ] Boot time < 2s
- [ ] Dependencies < 20 (TUI)
- [ ] Test coverage > 80%
- [ ] Allternit 21-phase boot works
- [ ] Can run runtime without TUI
- [ ] Can replace TUI without breaking runtime

---

## 📚 Full Documents

1. **GIZZI_CODE_AUDIT_SUMMARY.md** ← Start here
2. **GIZZI_CODE_AUDIT_AND_ALLTERNIT_DECOUPLING_STRATEGY.md** ← Full analysis
3. **GIZZI_CODE_ARCHITECTURE_DIAGRAMS.md** ← Visual diagrams
4. **GIZZI_CODE_IMPLEMENTATION_GUIDE.md** ← Code examples

---

## 🚀 Next Step

**Run this command to start:**

```bash
# Create Allternit structure
cd /path/to/gizzi-code
mkdir -p .allternit/{state,contracts,context,memory}
mkdir -p memory skills

# Create Allternit files
touch AGENTS.md IDENTITY.md SOUL.md USER.md
touch TOOLS.md SYSTEM.md POLICY.md MEMORY.md

# Now implement 21-phase boot sequence
```

---

**One-liner:** Split gizzi-code into TUI (interface) + Runtime (orchestration) to align with Allternit architecture.

**Generated:** March 6, 2026
