# Prompt Pack Service - Handoff to DAK Agent

## Summary

I've created a specification for a **Prompt Pack Service** (port 3005) that provides deterministic, versioned prompts to the entire A2R platform. This service is designed to integrate deeply with your DAK work and Rails.

**Key Document**: `docs/prompt-pack-service-spec.md` - Full technical specification

---

## Why This Service is Important for DAK

### Current Problem (File-Based Approach)

In the original plan (`docs/agent-runner-dag-plan.md`), prompts were file-based in `agents/packs/`. This has limitations:

```
❌ File-based problems:
- No versioning across runs
- No audit trail of which prompts were used
- No content-addressed storage
- Hard to share between DAK and Rails
- No caching/reuse of rendered prompts
- Difficult to rollback or replay
```

### Solution: Prompt Pack Service

```
✅ Service-based benefits:
- Deterministic rendering (same inputs → same output)
- Immutable versions (published packs never change)
- Receipts for every render (Rails ledger integration)
- Content-addressed storage (hash-based lookup)
- Shared between DAK, Rails, and Agent Studio
- Cache-friendly for performance
- Supports A/B testing and gradual rollouts
```

---

## How DAK Uses the Service

### 1. Context Pack Assembly

Instead of loading prompts from files, DAK calls the service:

```typescript
// Before (file-based)
const systemPrompt = fs.readFileSync('agents/packs/core/system.builder.md');

// After (service-based)
const systemPrompt = await promptService.render({
  pack_id: 'dak.core',
  prompt_id: 'system.builder',
  version: '2.1.0',  // Exact version for determinism
  variables: { wih_id, dag_id, capabilities }
});
```

### 2. Determinism Guarantee

The service ensures your DAK is deterministic:

```typescript
// Same WIH + same prompt versions = identical execution
async function executeWih(wihId: string): Promise<void> {
  const wih = await rails.wihs.show(wihId);
  
  // Get exact versions from WIH metadata
  const promptVersions = wih.metadata.prompt_versions || {
    'dak.core': '2.1.0',
    'dak.tools': '1.5.0'
  };
  
  // Render with pinned versions
  const contextPack = await assembleContext(wih, promptVersions);
  
  // Execute - reproducible!
  await runWithContext(contextPack);
}
```

### 3. Receipts for Rails Ledger

Every render produces a receipt that Rails records:

```typescript
const result = await promptService.render({...});

// Receipt includes:
{
  receipt_id: "rpt-abc-123",
  pack_id: "dak.core",
  version: "2.1.0",
  content_hash: "sha256:def...",
  rendered_hash: "sha256:ghi...",
  rendered_at: "2026-02-07T22:00:00Z"
}

// Rails records this in ledger for audit trail
await rails.ledger.append({
  event_type: "PromptRendered",
  receipt_id: result.receipt_id
});
```

---

## Integration Points

### 1. DAK → Prompt Pack Service

```typescript
// 1-kernel/dak-runner/src/context/builder.ts

import { PromptPackClient } from '../adapters/prompt_pack';

export class ContextPackBuilder {
  private promptClient: PromptPackClient;
  
  constructor() {
    this.promptClient = new PromptPackClient({
      baseUrl: 'http://127.0.0.1:3005'
    });
  }
  
  async buildContextPack(wihId: string): Promise<ContextPack> {
    // Fetch deterministic prompts
    const [systemPrompt, toolPrompt] = await Promise.all([
      this.promptClient.render({
        pack_id: 'dak.core',
        prompt_id: 'system.builder',
        version: this.getRequiredVersion('dak.core'),
        variables: { wih_id: wihId }
      }),
      this.promptClient.render({
        pack_id: 'dak.tools',
        prompt_id: 'instructions',
        version: this.getRequiredVersion('dak.tools'),
        variables: { tools: this.getAvailableTools() }
      })
    ]);
    
    return {
      wih_id: wihId,
      prompts: {
        system: systemPrompt.rendered,
        tools: toolPrompt.rendered
      },
      prompt_receipts: [
        systemPrompt.receipt_id,
        toolPrompt.receipt_id
      ]
    };
  }
}
```

### 2. Rails → Prompt Pack Service

```rust
// a2r-agent-system-rails/src/prompt_client.rs

use serde::{Deserialize, Serialize};

pub struct PromptPackClient {
    base_url: String,
    http: reqwest::Client,
}

impl PromptPackClient {
    pub async fn verify_receipt(
        &self,
        receipt_id: &str
    ) -> Result<PromptReceipt, PromptError> {
        let url = format!("{}/v1/receipts/{}", self.base_url, receipt_id);
        let response = self.http.get(&url).send().await?;
        
        if response.status().is_success() {
            let receipt = response.json().await?;
            Ok(receipt)
        } else {
            Err(PromptError::ReceiptNotFound)
        }
    }
}
```

### 3. Gate Integration

```rust
// In Rails gate check
async fn check_prompts(wih_id: &str) -> GateDecision {
    let wih = get_wih(wih_id)?;
    
    // Verify all prompts are deterministic
    for receipt_id in &wih.prompt_receipts {
        let receipt = prompt_service.verify_receipt(receipt_id).await?;
        
        if !receipt.deterministic {
            return GateDecision::Block {
                reason: "Non-deterministic prompt"
            };
        }
    }
    
    GateDecision::Allow
}
```

---

## Your Implementation Tasks

Based on `docs/agent-runner-dag-plan.md`, here are the updated tasks:

### Phase 1 (Updated): Core Execution Kernel

**New Task: Prompt Pack Client**
- [ ] Create `1-kernel/dak-runner/src/adapters/prompt_pack.ts`
- [ ] Implement render() method
- [ ] Implement receipt verification
- [ ] Add to context builder

**Modified Task: ContextPack Builder**
- [ ] Update `context/builder.ts` to use Prompt Pack Service
- [ ] Add version pinning logic
- [ ] Store prompt_receipts in context pack

### Phase 2 (Updated): Planning & Workers

**Modified Task: WorkerManager**
- [ ] Pass prompt versions to spawned workers
- [ ] Ensure context inheritance includes prompt receipts

### Phase 4 (Updated): Prompt Packs

**New Task: Define DAK Packs**
- [ ] Create pack definitions for:
  - `dak.core` - System prompts
  - `dak.orch` - Orchestration prompts
  - `dak.tools` - Tool instructions
  - `dak.roles` - Role definitions
  - `dak.evidence` - Receipt/evidence prompts

**New Task: Policy Bundle Integration**
- [ ] Include prompt version hashes in policy bundle
- [ ] Verify bundle hash matches at runtime

---

## Coordination with Other Work

### My Work (Agent Studio)

I'm building the UI that will:
- Browse prompt packs (`GET /v1/packs`)
- View prompt versions and diffs
- Test render prompts with variables
- Monitor prompt usage metrics

### Your Work (DAK Kernel)

You should:
- **Consume** prompts from the service (don't implement it)
- **Verify** receipts before execution
- **Record** prompt usage in Rails ledger
- **Pin** exact versions for determinism

### Shared Responsibilities

1. **Pack Definitions**: We collaborate on defining what packs exist
2. **Variables Contract**: Agree on variable names and types
3. **Version Strategy**: Decide versioning scheme (semver)

---

## Migration Path (File → Service)

### Step 1: Dual Mode (File + Service)

```typescript
// Support both during transition
async function getPrompt(source: 'file' | 'service', id: string) {
  if (source === 'service') {
    return await promptService.render({...});
  } else {
    return fs.readFileSync(`agents/packs/${id}.md`);
  }
}
```

### Step 2: Service-Only

```typescript
// Eventually remove file-based
async function getPrompt(id: string) {
  return await promptService.render({...});
}
```

---

## Questions to Resolve

1. **Version Pinning Strategy**: 
   - Hardcode versions in DAK code?
   - Load from config file?
   - Rails provides versions per DAG?

2. **Fallback Behavior**:
   - What if Prompt Pack Service is down?
   - Cache locally? Fail fast?

3. **Pack Ownership**:
   - Who maintains `dak.*` packs? (You)
   - Who maintains `orch.*` packs? (Shared)
   - Who maintains `core.*` packs? (Platform team)

4. **Variable Schema**:
   - Standard variable names across packs
   - Type validation
   - Required vs optional

---

## Next Steps

### For You (DAK Agent)

1. Read `docs/prompt-pack-service-spec.md`
2. Decide if you want to:
   - **Option A**: Implement the Prompt Pack Service yourself (it's a separate service)
   - **Option B**: Have me implement it while you build DAK client
   - **Option C**: Start with file-based, migrate to service later

3. If Option B, I need from you:
   - Pack definitions (what prompts DAK needs)
   - Variable schemas (what variables each prompt expects)
   - Version requirements (semver ranges)

### For Me (Agent Studio)

1. Build Prompt Pack Service (if you choose Option B)
2. Create UI for browsing packs
3. Integrate with Agent Studio

---

## Contact / Questions

Add questions or decisions to this file as you work:

```
## Decisions Log

### 2026-02-07: Version Pinning
Decision: DAK will pin exact versions in code for determinism
Rationale: Prevents accidental changes between runs
```

---

**Remember**: The goal is **determinism**. Every prompt render must be reproducible, auditable, and recorded in the Rails ledger.
