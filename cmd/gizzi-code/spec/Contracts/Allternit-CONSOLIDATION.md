# Allternit File Consolidation Summary

## Before (Flat Structure) → After (5-Layer)

### File Mapping

| Old Path | New Path | Layer | Notes |
|----------|----------|-------|-------|
| `.allternit/config.json` | `.allternit/manifest.json` | Meta | Updated schema |
| `.allternit/receipts/receipt.jsonl` | `.allternit/L1-COGNITIVE/memory/memory.jsonl` | L1 | Same format |
| `.allternit/state/state.json` | `.allternit/L1-COGNITIVE/brain/state.json` | L1 | Same format |
| `.allternit/handoff/latest.md` | `.allternit/L1-COGNITIVE/memory/handoff.md` | L1 | Same format |
| `.allternit/compact/*.md` | `.allternit/L1-COGNITIVE/brain/batons/*.md` | L1 | Same format |
| `.allternit/conventions.json` | `.allternit/L2-IDENTITY/CONVENTIONS.md` | L2 | Markdown conversion |
| `.allternit/usage/*.json` | `.allternit/L1-COGNITIVE/memory/usage/*.json` | L1 | Same format |
| `.allternit/checkpoints/*.json` | `.allternit/L1-COGNITIVE/memory/checkpoints/*.json` | L1 | Same format |

### Visual Comparison

**BEFORE (Flat - scattered):**
```
.allternit/
├── config.json
├── receipts/receipt.jsonl
├── state/state.json
├── handoff/latest.md
├── compact/*.md
├── usage/*.json
├── conventions.json
└── checkpoints/*.json
```

**AFTER (5-Layer - organized):**
```
.allternit/
├── manifest.json
│
├── L1-COGNITIVE/
│   ├── BRAIN.md
│   ├── brain/state.json
│   ├── brain/batons/*.md
│   └── memory/memory.jsonl
│
├── L2-IDENTITY/
│   ├── IDENTITY.md
│   ├── CONVENTIONS.md
│   └── POLICY.md
│
├── L3-GOVERNANCE/
│   ├── PLAYBOOK.md
│   └── TOOLS.md
│
├── L4-SKILLS/
│   └── INDEX.md
│
└── L5-BUSINESS/
    └── CLIENTS.md
```

## Summary

The 5-layer consolidation:
- **Reduces** scattered files → 5 organized layers
- **Adds** human-readable `.md` files at each layer  
- **Preserves** all machine-readable `.json` data
- **Aligns** with kernel infrastructure
- **Enables** deterministic cross-agent handoffs
