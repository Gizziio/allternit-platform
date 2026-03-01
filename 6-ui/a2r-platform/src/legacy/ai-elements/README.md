# ⚠️ LEGACY AI ELEMENTS - DO NOT IMPORT ⚠️

**Status**: FROZEN / DEPRECATED

**Date**: 2026-02-07

## What is this?

This directory contains the **old/legacy** AI Elements installation. It is nearly empty and no longer maintained.

## Where is the current version?

**Active AI Elements**: `src/components/ai-elements/` (V2)

All 52 AI Elements components are now properly installed and maintained in the V2 location.

## Why is this frozen?

To prevent accidental imports and mixing of legacy and V2 component systems.

## Can I import from here?

**NO**. Any import from this directory is blocked by:
1. ESLint rules
2. Code review checks
3. CI/CD pipeline

## What should I use instead?

```typescript
// ❌ DON'T DO THIS
import { Message } from "@/legacy/ai-elements/message";

// ✅ DO THIS
import { Message } from "@/components/ai-elements/message";
// or
import { Message } from "@/components/ai-elements"; // barrel export
```

## When will this be deleted?

After all views are migrated to V2 and verified in production.

## Questions?

See: `AI_ELEMENTS_INVENTORY.md` in repo root
