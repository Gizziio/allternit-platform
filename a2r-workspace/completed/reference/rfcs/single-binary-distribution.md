# RFC: Single-Binary Distribution Strategy for A2R

**Status**: Draft  
**Date**: 2026-02-13  
**Author**: AI Code Assistant  
**Target**: A2R Platform v0.2.0  

---

## Summary

Design a self-contained single-binary distribution for A2R that matches Moltis's "one binary, no runtime" philosophy while accommodating A2R's enterprise architecture (80+ Rust crates, Python services, Web UI).

---

## Motivation

### Current State
- A2R requires multi-service deployment (Rust services + Python services)
- Complex installation and configuration
- Docker-centric deployment
- High barrier to entry for developers

### Goals
1. **Simplified Installation**: One command to install
2. **Self-Contained**: No external runtime dependencies
3. **Cross-Platform**: Linux, macOS, Windows
4. **Enterprise-Ready**: Signed binaries, update mechanism
5. **Developer-Friendly**: Local development without Docker

---

## Architecture

### Distribution Targets

| Target | Priority | Approach | Size Estimate |
|--------|----------|----------|---------------|
| Linux (x86_64) | P0 | Static binary + .deb/.rpm | 150-200MB |
| Linux (aarch64) | P0 | Static binary + .deb/.rpm | 150-200MB |
| macOS (x86_64) | P1 | Universal binary + .dmg | 180-220MB |
| macOS (aarch64) | P1 | Universal binary + .dmg | 180-220MB |
| Windows (x86_64) | P2 | Static binary + .msi | 200-250MB |

### Component Bundling Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    A2R Single Binary                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Rust Core (80+ crates linked)                 │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │   Kernel    │  │  Registry   │  │   Memory    │       │  │
│  │  │   Service   │  │   Service   │  │   Service   │       │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │    API      │  │   Gateway   │  │  Policy     │       │  │
│  │  │   Service   │  │   Service   │  │   Engine    │       │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Embedded Assets (rust-embed)                  │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │   Web UI    │  │   WASM      │  │   Config    │       │  │
│  │  │   (React)   │  │  Capsules   │  │  Templates  │       │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Python Services (PyOxidizer)                  │  │
│  │  ┌─────────────┐  ┌─────────────┐                        │  │
│  │  │   Voice     │  │  Operator   │                        │  │
│  │  │   Service   │  │   Service   │                        │  │
│  │  └─────────────┘  └─────────────┘                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 1: Core Binary (Week 1-2)
- [ ] Create unified `a2r` binary crate
- [ ] Implement service orchestration
- [ ] Add Web UI asset embedding
- [ ] Build pipeline setup

### Phase 2: Python Bundling (Week 3-4)
- [ ] Evaluate PyOxidizer vs embedding
- [ ] Bundle voice service
- [ ] Bundle operator service

### Phase 3: Packaging (Week 5-6)
- [ ] cargo-deb configuration
- [ ] cargo-generate-rpm configuration
- [ ] macOS universal binary

### Phase 4: Distribution (Week 7-8)
- [ ] Install script
- [ ] Homebrew tap
- [ ] Signed releases

---

## Size Estimate

| Component | Size |
|-----------|------|
| Rust core | 120MB |
| Web UI | 15MB |
| Python services | 100MB |
| **Total compressed** | **~88MB** |

---

*Full RFC in document*
