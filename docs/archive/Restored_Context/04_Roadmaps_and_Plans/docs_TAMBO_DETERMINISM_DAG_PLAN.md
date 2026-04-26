# Allternit Tambo Determinism Implementation - DAG Task Plan

**Date:** 2026-02-23  
**Goal:** Implement proven determinism modes aligned with Tambo's architecture  
**Reference:** https://github.com/tambo-ai/tambo

---

## Executive Summary

The local `allternit-tambo-integration` must be enhanced with **5 determinism modes** to match Tambo's proven architecture:

1. **Schema-Validated Generation** - Zod-like schema validation
2. **Deterministic Component Selection** - Indexed, reproducible selection
3. **Reproducible Generation** - Seed-based reproducibility
4. **Streaming with Recovery** - Cancellation, retry, error handling
5. **State Persistence** - Persistent component state across sessions

---

## DAG Task Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: Foundation (P0)                                  │
│  (Core types and validation - blocks all other phases)                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│ TASK-TAMBO-001│           │ TASK-TAMBO-002│           │ TASK-TAMBO-003│
│ Schema        │           │ Component     │           │ Generation    │
│ Validator     │           │ Registry      │           │ Config        │
│               │           │ with Index    │           │               │
└───────┬───────┘           └───────┬───────┘           └───────┬───────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: Engine Enhancement (P1)                          │
│  (Add determinism methods to TamboEngine)                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│ TASK-TAMBO-004│           │ TASK-TAMBO-005│           │ TASK-TAMBO-006│
│ Validated     │           │ Reproducible  │           │ Streaming     │
│ Generation    │           │ Generation    │           │ Generation    │
└───────┬───────┘           └───────┬───────┘           └───────┬───────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: State Management (P2)                            │
│  (Persistence and recovery)                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │   TASK-TAMBO-007      │
                        │   State Persistence   │
                        └───────────┬───────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 4: API Integration (P3)                             │
│  (Expose determinism modes via HTTP routes)                                  │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐           ┌───────────────┐           ┌───────────────┐
│ TASK-TAMBO-008│           │ TASK-TAMBO-009│           │ TASK-TAMBO-010│
│ Validated     │           │ Reproducible  │           │ Streaming     │
│ Route         │           │ Route         │           │ Route (SSE)   │
└───────┬───────┘           └───────┬───────┘           └───────┬───────┘
        │                           │                           │
        └───────────────────────────┼───────────────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 5: Verification (P4)                                │
│  (Tests and verification)                                                    │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                        ┌───────────────────────┐
                        │   TASK-TAMBO-011      │
                        │   Determinism Tests   │
                        └───────────────────────┘
```

---

## Task Definitions

### TASK-TAMBO-001: Schema Validator

**Priority:** P0 (Blocks all)  
**Estimated Time:** 2 hours  
**File:** `domains/kernel/infrastructure/tambo-integration/src/schema_validator.rs` (NEW)

**Implementation:**
```rust
pub struct SchemaValidator {
    // Schema registry for validation
    schemas: HashMap<String, Schema>,
}

pub struct Schema {
    pub schema_id: String,
    pub schema_type: SchemaType,
    pub fields: Vec<FieldSchema>,
    pub required: Vec<String>,
}

impl SchemaValidator {
    pub fn validate_spec(&self, spec: &UISpec) -> Result<(), TamboError>;
    pub fn validate_output(&self, output: &GeneratedUI) -> Result<(), TamboError>;
}
```

**Acceptance Criteria:**
- [ ] `SchemaValidator` struct created
- [ ] `validate_spec()` method implemented
- [ ] `validate_output()` method implemented
- [ ] Unit tests for validation logic
- [ ] Integration with `TamboEngine`

---

### TASK-TAMBO-002: Component Registry with Index

**Priority:** P0 (Blocks all)  
**Estimated Time:** 3 hours  
**File:** `domains/kernel/infrastructure/tambo-integration/src/component_registry.rs` (NEW)

**Implementation:**
```rust
pub struct ComponentRegistry {
    components: HashMap<String, ComponentTemplate>,
    selection_index: ComponentIndex,  // Inverted index
}

pub struct ComponentIndex {
    // Maps keywords → component IDs (BTreeSet for determinism)
    index: HashMap<String, BTreeSet<String>>,
}

impl ComponentRegistry {
    pub fn select_components(&self, spec: &UISpec) -> Vec<&ComponentTemplate>;
    pub fn register_component(&mut self, template: ComponentTemplate);
}
```

**Acceptance Criteria:**
- [ ] `ComponentRegistry` struct created
- [ ] `ComponentIndex` with inverted index
- [ ] Deterministic selection (BTreeSet ordering)
- [ ] Keyword extraction from specs
- [ ] Unit tests for selection determinism

---

### TASK-TAMBO-003: Generation Config

**Priority:** P0 (Blocks Phase 2)  
**Estimated Time:** 1 hour  
**File:** `domains/kernel/infrastructure/tambo-integration/src/lib.rs` (MODIFY)

**Implementation:**
```rust
pub struct GenerationConfig {
    pub seed: Option<u64>,           // For reproducibility
    pub temperature: f32,            // 0.0 = deterministic
    pub validate: bool,              // Enable schema validation
    pub max_retries: u32,            // For streaming
    pub retry_delay_ms: u64,         // For streaming
}

impl Default for GenerationConfig {
    fn default() -> Self {
        Self {
            seed: None,
            temperature: 0.7,
            validate: false,
            max_retries: 3,
            retry_delay_ms: 1000,
        }
    }
}
```

**Acceptance Criteria:**
- [ ] `GenerationConfig` struct added
- [ ] Default implementation
- [ ] Builder pattern for easy construction
- [ ] Documentation

---

### TASK-TAMBO-004: Validated Generation

**Priority:** P1  
**Estimated Time:** 2 hours  
**File:** `domains/kernel/infrastructure/tambo-integration/src/lib.rs` (MODIFY)

**Implementation:**
```rust
impl TamboEngine {
    pub async fn generate_ui_validated(
        &self,
        spec: &UISpec,
        ui_type: UIType,
    ) -> Result<GeneratedUI, TamboError> {
        // 1. Validate spec
        self.schema_validator.validate_spec(spec)?;
        
        // 2. Generate
        let result = self.generate_ui(spec, ui_type).await?;
        
        // 3. Validate output
        self.schema_validator.validate_output(&result)?;
        
        Ok(result)
    }
}
```

**Acceptance Criteria:**
- [ ] `generate_ui_validated()` method added
- [ ] Schema validation before generation
- [ ] Schema validation after generation
- [ ] Error handling for validation failures
- [ ] Unit tests

---

### TASK-TAMBO-005: Reproducible Generation

**Priority:** P1  
**Estimated Time:** 2 hours  
**File:** `domains/kernel/infrastructure/tambo-integration/src/lib.rs` (MODIFY)

**Implementation:**
```rust
impl TamboEngine {
    pub async fn generate_ui_reproducible(
        &self,
        spec: &UISpec,
        ui_type: UIType,
        config: GenerationConfig,
    ) -> Result<GeneratedUI, TamboError> {
        // Set seed for reproducibility
        if let Some(seed) = config.seed {
            set_seed(seed);
        }
        
        let result = self.generate_ui_with_temp(spec, ui_type, config.temperature).await?;
        
        // Compute hash for verification
        let hash = self.compute_generation_hash(&result);
        
        Ok(GeneratedUI {
            generation_hash: Some(hash),
            ..result
        })
    }
    
    fn compute_generation_hash(&self, ui: &GeneratedUI) -> String;
}
```

**Acceptance Criteria:**
- [ ] `generate_ui_reproducible()` method added
- [ ] Seed-based random number generation
- [ ] Temperature control
- [ ] Hash computation for verification
- [ ] Unit tests for reproducibility

---

### TASK-TAMBO-006: Streaming Generation

**Priority:** P1  
**Estimated Time:** 3 hours  
**File:** `domains/kernel/infrastructure/tambo-integration/src/streaming.rs` (NEW)

**Implementation:**
```rust
pub enum StreamChunk {
    Data(String),
    Error(TamboError),
    Cancelled,
    Complete,
}

pub struct StreamConfig {
    pub max_retries: u32,
    pub retry_delay_ms: u64,
    pub cancellation_token: CancellationToken,
}

impl TamboEngine {
    pub async fn generate_ui_streaming(
        &self,
        spec: &UISpec,
        ui_type: UIType,
        config: StreamConfig,
    ) -> Result<mpsc::Receiver<StreamChunk>, TamboError>;
}
```

**Acceptance Criteria:**
- [ ] `StreamChunk` enum defined
- [ ] `StreamConfig` struct defined
- [ ] `generate_ui_streaming()` method implemented
- [ ] Retry logic with backoff
- [ ] Cancellation handling
- [ ] Unit tests

---

### TASK-TAMBO-007: State Persistence

**Priority:** P2  
**Estimated Time:** 2 hours  
**File:** `domains/kernel/infrastructure/tambo-integration/src/lib.rs` (MODIFY)

**Implementation:**
```rust
pub struct GenerationState {
    pub generation_id: String,
    pub spec_id: String,
    pub state: serde_json::Value,
    pub version: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl TamboEngine {
    pub async fn save_generation_state(
        &self,
        generation_id: &str,
        state: serde_json::Value,
    ) -> Result<(), TamboError>;
    
    pub async fn load_generation_state(
        &self,
        generation_id: &str,
    ) -> Result<Option<GenerationState>, TamboError>;
}
```

**Acceptance Criteria:**
- [ ] `GenerationState` struct added
- [ ] `save_generation_state()` method implemented
- [ ] `load_generation_state()` method implemented
- [ ] Version tracking
- [ ] Unit tests

---

### TASK-TAMBO-008: Validated Generation Route

**Priority:** P3  
**File:** `cmd/api/src/tambo_routes.rs` (MODIFY)

**Implementation:**
```rust
/// Generate UI with validation
/// POST /v1/tambo/generate/validated
async fn generate_ui_validated_handler(
    State(engine): State<Arc<TamboEngine>>,
    Json(payload): Json<GenerateUIRequest>,
) -> Result<Json<GenerateUIResponse>, StatusCode> {
    let result = engine.generate_ui_validated(&spec, ui_type).await?;
    Ok(Json(result.into()))
}
```

**Acceptance Criteria:**
- [ ] Route added to `tambo_router_from_engine`
- [ ] Handler implemented
- [ ] Error handling
- [ ] Integration test

---

### TASK-TAMBO-009: Reproducible Generation Route

**Priority:** P3  
**File:** `cmd/api/src/tambo_routes.rs` (MODIFY)

**Implementation:**
```rust
/// Generate UI with seed (reproducible)
/// POST /v1/tambo/generate/reproducible
async fn generate_ui_reproducible_handler(
    State(engine): State<Arc<TamboEngine>>,
    Json(payload): Json<GenerateReproducibleRequest>,
) -> Result<Json<GenerateUIResponse>, StatusCode>;
```

**Acceptance Criteria:**
- [ ] Route added
- [ ] Handler with seed/temperature params
- [ ] Hash returned in response
- [ ] Integration test

---

### TASK-TAMBO-010: Streaming Route (SSE)

**Priority:** P3  
**File:** `cmd/api/src/tambo_routes.rs` (MODIFY)

**Implementation:**
```rust
/// Generate UI with streaming
/// POST /v1/tambo/generate/stream
async fn generate_ui_streaming_handler(
    State(engine): State<Arc<TamboEngine>>,
    Json(payload): Json<GenerateUIRequest>,
) -> Result<Sse<impl Stream<Item = SseEvent>>, StatusCode>;
```

**Acceptance Criteria:**
- [ ] SSE route added
- [ ] Streaming handler implemented
- [ ] Retry logic exposed
- [ ] Cancellation endpoint
- [ ] Integration test

---

### TASK-TAMBO-011: Determinism Tests

**Priority:** P4  
**File:** `domains/kernel/infrastructure/tambo-integration/src/lib.rs` (MODIFY - tests)

**Implementation:**
```rust
#[cfg(test)]
mod determinism_tests {
    #[tokio::test]
    async fn test_reproducible_generation() {
        // Same seed should produce same output
        let result1 = engine.generate_ui_reproducible(spec, ui_type, config_with_seed_42).await?;
        let result2 = engine.generate_ui_reproducible(spec, ui_type, config_with_seed_42).await?;
        assert_eq!(result1.ui_code, result2.ui_code);
    }
    
    #[tokio::test]
    async fn test_deterministic_component_selection() {
        // Selection should be deterministic
        let selected1 = registry.select_components(spec);
        let selected2 = registry.select_components(spec);
        assert_eq!(selected1, selected2);
    }
    
    #[tokio::test]
    async fn test_schema_validation() {
        // Invalid spec should fail validation
        let result = engine.generate_ui_validated(invalid_spec, ui_type).await;
        assert!(result.is_err());
    }
}
```

**Acceptance Criteria:**
- [ ] Reproducibility test
- [ ] Component selection determinism test
- [ ] Schema validation test
- [ ] Streaming recovery test
- [ ] State persistence test
- [ ] All tests pass

---

## Execution Order

```
PHASE 1 (Foundation):
  TASK-TAMBO-001 → TASK-TAMBO-002 → TASK-TAMBO-003
  (Can run in parallel: 001, 002, 003)

PHASE 2 (Engine):
  TASK-TAMBO-004 → TASK-TAMBO-005 → TASK-TAMBO-006
  (Depends on: PHASE 1 complete)
  (Can run in parallel: 004, 005, 006)

PHASE 3 (State):
  TASK-TAMBO-007
  (Depends on: PHASE 2 complete)

PHASE 4 (API):
  TASK-TAMBO-008 → TASK-TAMBO-009 → TASK-TAMBO-010
  (Depends on: PHASE 2 complete)
  (Can run in parallel: 008, 009, 010)

PHASE 5 (Tests):
  TASK-TAMBO-011
  (Depends on: PHASE 4 complete)
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Reproducibility | Same seed → same output (100%) |
| Component Selection | Deterministic ordering (100%) |
| Schema Validation | Invalid specs rejected (100%) |
| Streaming Recovery | Retry on failure (configurable) |
| State Persistence | State survives restart (100%) |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Schema validation too strict | Medium | Medium | Configurable validation level |
| Seed management complexity | Low | Low | Use UUID-based seeds |
| Streaming performance | Medium | Medium | Configurable buffer sizes |
| State storage overhead | Low | Low | TTL on old states |

---

**Document Owner:** Systems Architect  
**Review Cycle:** After each phase completion
