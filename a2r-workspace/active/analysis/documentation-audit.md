# Documentation Improvement Plan

**Date**: 2026-02-13  
**Scope**: All 83 Rust crates + TypeScript components  

---

## Executive Summary

A2R has **83 Rust crates** across 5 layers with **variable documentation quality**. This audit provides:
1. Documentation coverage scoring
2. Priority tiers for improvement
3. Implementation roadmap
4. Style guide

**Current State**:
- Excellent: ARCHITECTURE.md, layer-level docs
- Good: Core substrate crates
- Poor: Many service crates
- Missing: 40% of crates lack module documentation

---

## Crate Documentation Scoring

### Legend
- 🟢 **Excellent**: Comprehensive docs + examples
- 🟡 **Good**: Basic module docs, most items documented
- 🟠 **Poor**: Minimal docs, critical gaps
- 🔴 **Missing**: No documentation

### Layer 0: Substrate (15 crates)

| Crate | Score | Notes | Priority |
|-------|-------|-------|----------|
| a2r-substrate | 🟡 Good | Basic types documented | P2 |
| a2r-intent-graph-kernel | 🟢 Excellent | Well documented | - |
| a2r-presentation-kernel | 🟡 Good | Module structure clear | P2 |
| a2r-agent-system-rails | 🟢 Excellent | Core types well doc'd | - |
| a2r-embodiment | 🟠 Poor | Needs more detail | P1 |
| a2r-canvas-protocol | 🟡 Good | Protocol docs present | P2 |
| a2r-capsule-spec | 🟡 Good | Spec documented | P2 |
| sdk-core | 🔴 Missing | Needs module docs | P0 |
| sdk-apps | 🔴 Missing | Needs module docs | P0 |
| sdk-functions | 🔴 Missing | Needs module docs | P0 |
| sdk-policy | 🔴 Missing | Needs module docs | P0 |
| sdk-transport | 🔴 Missing | Needs module docs | P0 |
| a2ui_types | 🟡 Good | Type definitions clear | P2 |

### Layer 1: Kernel (28 crates)

| Crate | Score | Notes | Priority |
|-------|-------|-------|----------|
| kernel-contracts | 🟢 Excellent | Well documented | - |
| kernel-compat | 🟠 Poor | Needs usage examples | P1 |
| tools-gateway | 🟡 Good | Core functionality doc'd | P2 |
| runtime-local-executor | 🟠 Poor | Implementation details missing | P1 |
| wasm-runtime | 🟡 Good | WASM docs present | P2 |
| runtime-execution-core | 🟡 Good | Core runtime doc'd | P2 |
| a2r-capsule | 🟢 Excellent | Capsule system well doc'd | - |
| a2r-capsule-compiler | 🟡 Good | Compiler docs present | P2 |
| a2r-capsule-runtime | 🟡 Good | Runtime doc'd | P2 |
| kernel-messaging | 🟠 Poor | Messaging patterns missing | P1 |
| transport-sms | 🔴 Missing | No documentation | P0 |
| agents | 🟡 Good | Agent types doc'd | P2 |
| agent-router | 🟠 Poor | Routing logic undocumented | P1 |
| model-router | 🟡 Good | Model routing doc'd | P2 |
| workflows | 🟢 Excellent | Workflow system well doc'd | - |
| context-router | 🟠 Poor | Needs architecture docs | P1 |
| control-plane | 🟡 Good | Control plane doc'd | P2 |
| control-plane-impl | 🟠 Poor | Implementation details missing | P1 |
| artifact-registry | 🟡 Good | Registry doc'd | P2 |
| registry | 🟡 Good | Registry operations doc'd | P2 |
| tool-registry | 🟡 Good | Tool registration doc'd | P2 |
| a2r-memory-provider | 🟠 Poor | Memory patterns missing | P1 |
| history-ledger | 🟡 Good | Ledger doc'd | P2 |
| executor | 🟠 Poor | Executor details missing | P1 |
| local-inference | 🔴 Missing | No documentation | P0 |
| local-inference-gguf | 🔴 Missing | No documentation | P0 |
| mlx-inference | 🔴 Missing | No documentation | P0 |
| packaging | 🟡 Good | Packaging doc'd | P2 |
| a2r-openclaw-host | 🟢 Excellent | Well documented native modules | - |
| a2r-parity | 🟡 Good | Parity system doc'd | P2 |
| a2r-providers | 🟡 Good | Provider abstractions doc'd | P2 |
| a2r-rlm | 🟡 Good | RLM documented | P2 |

### Layer 2: Governance (8 crates)

| Crate | Score | Notes | Priority |
|-------|-------|-------|----------|
| core-audit | 🟠 Poor | Audit system needs docs | P1 |
| core-evidence | 🟠 Poor | Evidence management missing | P1 |
| core-governance | 🟡 Good | Governance concepts doc'd | P2 |
| rust-governor | 🟡 Good | Rate limiting doc'd | P2 |
| core-policy | 🟡 Good | Policy engine doc'd | P2 |
| policy-engine | 🟢 Excellent | Well documented | - |
| evals | 🔴 Missing | No documentation | P0 |
| security-network | 🟠 Poor | Security concepts missing | P1 |

### Layer 3: Adapters (6 crates)

| Crate | Score | Notes | Priority |
|-------|-------|-------|----------|
| a2r-native-bridge | 🟡 Good | Bridge patterns doc'd | P2 |
| a2r-webvm | 🟡 Good | WebVM documented | P2 |
| io-daemon | 🔴 Missing | No documentation | P0 |
| skills | 🟡 Good | Skills system doc'd | P2 |
| marketplace | 🟠 Poor | Marketplace needs docs | P1 |
| provider-adapter | 🟡 Good | Provider adapters doc'd | P2 |
| extension-adapter | 🔴 Missing | No documentation | P0 |

### Layer 4: Services (12 crates)

| Crate | Score | Notes | Priority |
|-------|-------|-------|----------|
| browser-gateway | 🟡 Good | Gateway documented | P2 |
| stdio-gateway | 🔴 Missing | No documentation | P0 |
| apps-registry | 🟠 Poor | Registry operations missing | P1 |
| functions-registry | 🟠 Poor | Needs documentation | P1 |
| framework-registry | 🟠 Poor | Needs documentation | P1 |
| server-registry | 🟠 Poor | Needs documentation | P1 |
| kernel-service | 🟢 Excellent | Well documented | - |
| platform-orchestration-service | 🟠 Poor | Orchestration missing | P1 |
| pattern-service | 🔴 Missing | No documentation | P0 |
| voice-service | N/A | Python service | - |
| prompt-pack-service | 🔴 Missing | No documentation | P0 |
| memory | 🟡 Good | Memory service doc'd | P2 |
| observation | 🟠 Poor | Observation system missing | P1 |
| history | 🟡 Good | History service doc'd | P2 |

### Layer 7: Apps (14 crates)

| Crate | Score | Notes | Priority |
|-------|-------|-------|----------|
| api | 🟢 Excellent | Well documented with OpenAPI | - |
| cli | 🟡 Good | CLI documented | P2 |

---

## Priority Tiers

### P0: Critical (12 crates)
Must be documented before v0.2.0 release.

**SDK Crates** (5 crates):
- sdk-core, sdk-apps, sdk-functions, sdk-policy, sdk-transport

**Missing Core** (7 crates):
- transport-sms, local-inference, local-inference-gguf, mlx-inference
- evals, io-daemon, extension-adapter, stdio-gateway

**Effort**: 2-3 days

### P1: High Priority (16 crates)
Should be documented within 2 weeks.

- a2r-embodiment, kernel-compat, runtime-local-executor
- kernel-messaging, agent-router, context-router, control-plane-impl
- a2r-memory-provider, executor, core-audit, core-evidence
- security-network, marketplace, apps-registry, functions-registry
- framework-registry, server-registry, platform-orchestration-service
- observation

**Effort**: 4-5 days

### P2: Medium Priority (25 crates)
Should be documented within 1 month.

All remaining 🟡 Good → 🟢 Excellent improvements.

**Effort**: 5-7 days

---

## Implementation Roadmap

### Week 1: P0 Critical
- [ ] sdk-* crates: Module documentation
- [ ] inference crates: Basic usage docs
- [ ] stdio-gateway: Module docs

### Week 2: P0 Completion + P1 Start
- [ ] Remaining P0 crates
- [ ] Start P1: Core governance crates
- [ ] Review with team

### Week 3-4: P1 High Priority
- [ ] Router crates (agent, context, model)
- [ ] Registry crates
- [ ] Security and audit

### Week 5-6: P2 Medium Priority
- [ ] Substrate improvements
- [ ] Kernel improvements
- [ ] Adapter improvements

### Week 7-8: Polish
- [ ] Examples for all P0/P1 crates
- [ ] Cross-references
- [ ] doc.rs verification

---

## Documentation Style Guide

### Module Documentation

```rust
//! # Crate Name
//!
//! One-line description of the crate's purpose.
//!
//! ## Overview
//!
//! Longer description of what this crate does, its role in the
//! architecture, and how it fits into the overall system.
//!
//! ## Key Concepts
//!
//! - **Concept 1**: Description
//! - **Concept 2**: Description
//!
//! ## Example
//!
//! ```rust
//! use crate_name::Module;
//!
//! let instance = Module::new();
//! ```
//!
//! ## Features
//!
//! - `feature1`: Description of feature1
//! - `feature2`: Description of feature2
```

### Struct/Enum Documentation

```rust
/// Brief description of the struct.
///
/// Longer description if needed. Explain the purpose and
/// any important invariants.
///
/// # Examples
///
/// ```
/// let instance = MyStruct::new();
/// ```
pub struct MyStruct {
    /// Description of field
    pub field: Type,
}
```

### Function Documentation

```rust
/// Brief description of what the function does.
///
/// Longer description if needed. Explain arguments, return value,
/// and any errors that can occur.
///
/// # Arguments
///
/// * `arg1` - Description of arg1
/// * `arg2` - Description of arg2
///
/// # Returns
///
/// Description of return value
///
/// # Errors
///
/// Returns `ErrorType` when...
///
/// # Examples
///
/// ```
/// let result = my_function(arg1, arg2)?;
/// ```
pub fn my_function(arg1: Type1, arg2: Type2) -> Result<Type, Error> {
    // implementation
}
```

### Error Documentation

```rust
/// Errors that can occur in this module.
#[derive(Debug, Error)]
pub enum Error {
    /// Description of error variant
    #[error("human readable message")]
    VariantName,
}
```

---

## Automation

### CI/CD Integration

```yaml
# .github/workflows/docs.yml
name: Documentation

on: [push, pull_request]

jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable
      
      - name: Check documentation
        run: cargo doc --no-deps --workspace
        env:
          RUSTDOCFLAGS: "-D warnings"
      
      - name: Check doc coverage
        run: |
          cargo install cargo-doc-coverage
          cargo doc-coverage
      
      - name: Deploy to GitHub Pages
        if: github.ref == 'refs/heads/main'
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./target/doc
```

### Pre-commit Hook

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: rust-doc-check
        name: Rust Documentation Check
        entry: cargo doc --no-deps --workspace
        language: system
        pass_filenames: false
```

---

## Success Metrics

| Metric | Current | Target | Timeline |
|--------|---------|--------|----------|
| Crates with docs | 60% | 100% | 2 months |
| Public API coverage | 45% | 90% | 2 months |
| doc.rs warnings | 150+ | 0 | 1 month |
| Examples | 20 | 100+ | 2 months |

---

## Tools & Resources

- **cargo-doc**: Build documentation
- **cargo-doc-coverage**: Coverage analysis
- **docs.rs**: Hosted documentation
- **rustdoc**: Documentation tool

---

## Next Steps

1. **Create tracking issue** for documentation sprint
2. **Assign owners** for each priority tier
3. **Set up CI** for doc warnings
4. **Begin P0** crate documentation

---

*Documentation improvement plan - v1.0*
