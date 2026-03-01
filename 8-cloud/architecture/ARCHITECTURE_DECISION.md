# A2R Architecture Decision: BYOD Control Plane Model

**Date:** 2026-02-23  
**Decision:** Pivot from "SSH-based deployment" to "Reverse-tunnel agent architecture"  
**Status:** APPROVED

---

## The Problem

We were building "yet another VPS deployment tool" with SSH-based management. This has fundamental issues:

1. **Competes directly with Codex Server Mode** - They already do SSH → VPS well
2. **Competes with Claude Code** - They already have native SSH in desktop app
3. **No ongoing value** - Once VPS is deployed, why keep using A2R?
4. **We carry compute liability** - If we host anything, we pay for it

---

## The Solution: Control Plane Architecture

**A2R becomes the "Android of agent infrastructure"**

```
┌─────────────────────────────────────────────────────────────────┐
│                     A2R CONTROL PLANE                           │
│                   (We host - Lightweight)                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │  Scheduler  │ │  DAG Engine │ │   Policy    │               │
│  │             │ │             │ │   Engine    │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐               │
│  │   Memory    │ │   Billing   │ │    Web UI   │               │
│  │   Layer     │ │             │ │             │               │
│  └─────────────┘ └─────────────┘ └─────────────┘               │
└─────────────────────────────────────────────────────────────────┘
                            ▲
                            │ WebSocket (outbound from VPS)
                            │ Reverse tunnel - secure
                            │
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT VPS                                 │
│                (They host - Their cost)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    A2R Node Agent                        │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │  │
│  │  │   WSS    │  │  Docker  │  │    Execution Kernel  │   │  │
│  │  │  Client  │──│ Runtime  │──│  ┌─────┐ ┌─────┐     │   │  │
│  │  │          │  │          │  │  │WIH  │ │Codex│ ... │   │  │
│  │  └──────────┘  └──────────┘  │  └─────┘ └─────┘     │   │  │
│  │                              └──────────────────────┘   │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why This Wins

### 1. Differentiation from Codex/Claude

| Feature | Codex Server | Claude SSH | A2R Control Plane |
|---------|-------------|------------|-------------------|
| **Connection** | User SSH in | Claude SSH in | VPS connects out |
| **Persistence** | Session only | Session only | Always-on |
| **Multi-agent** | ❌ | ❌ | ✅ Swarm |
| **Workflows** | ❌ | ❌ | ✅ DAG engine |
| **Policy** | ❌ | ❌ | ✅ Enforcement |
| **Memory** | ❌ | ❌ | ✅ Cross-agent |

### 2. Economic Advantage

**Old Model (Hosted):**
- We pay for compute
- We carry abuse liability
- We scale infrastructure
- Burn risk: HIGH

**New Model (BYOD):**
- Users pay for VPS
- Zero compute liability
- We scale orchestration only
- Burn risk: LOW

### 3. Enterprise Appeal

- **Data Sovereignty**: Runs on THEIR infrastructure
- **Compliance**: SOC2, HIPAA, GDPR - their problem
- **Security**: No inbound access, outbound tunnel only
- **Audit**: Full audit logs via control plane

---

## What A2R Actually Does

### 1. Easy VPS Buying
Users compare providers, buy VPS with 1-click:
```
Hetzner CX21 ($4.51/mo) → [Deploy] → VPS boots → Agent auto-installs
```

### 2. Persistent Orchestration
After deployment, A2R provides ongoing value:
- **Agent Swarm**: Multiple agents across multiple VPS
- **DAG Workflows**: Complex multi-step pipelines
- **Shared Memory**: Context across agents
- **Policy Enforcement**: Security boundaries
- **Cost Optimization**: Smart job placement

### 3. The "App Store" Model
```yaml
# User browses agent marketplace in A2R
agents:
  - name: Code Reviewer
    description: Reviews PRs using GPT-4
    triggers: [on_pr_open]
    
  - name: Test Runner
    description: Runs test suite in Docker
    triggers: [on_push]
    
  - name: Documentation
    description: Auto-generates docs
    triggers: [manual]

# User installs agent → A2R deploys to their VPS
# User doesn't SSH, doesn't configure - just clicks "Install"
```

---

## Technical Implementation

### Components

#### 1. Control Plane (Rust/Axum)
```rust
// Lightweight, handles thousands of nodes
pub struct ControlPlane {
    nodes: DashMap<NodeId, NodeState>,
    scheduler: Scheduler,      // Distribute jobs
    dag_engine: DAGEngine,     // Workflow orchestration
    policy: PolicyEngine,      // Security
    memory: MemoryLayer,       // Cross-agent context
}
```

#### 2. Node Agent (Rust)
```rust
// Runs on user VPS
pub struct NodeAgent {
    config: NodeConfig,
    tunnel: WebSocketClient,   // To control plane
    runtime: DockerRuntime,    // Sandbox
    executor: WIHExecutor,     // Job runner
}

// Install: curl -s https://a2r.io/install.sh | A2R_TOKEN=xxx bash
```

#### 3. Web UI (React)
- Node management dashboard
- Agent marketplace
- Workflow builder
- Logs & monitoring

---

## The Competition Question

**"Why not just use Codex server mode?"**

Codex gives you:
- ✅ Remote IDE
- ✅ File editing
- ✅ Terminal access

A2R gives you:
- ✅ All of the above (via embedded Codex)
- ✅ **Multi-agent orchestration** (Codex = 1 agent)
- ✅ **Persistent automation** (Codex = session only)
- ✅ **Workflow DAGs** (Codex = single tasks)
- ✅ **Policy enforcement** (Codex = unrestricted)
- ✅ **Team coordination** (Codex = single user)

**A2R doesn't replace Codex - it orchestrates it.**

```yaml
workflow:
  steps:
    - agent: code_reviewer  # Uses Codex
      action: review_pr
      
    - agent: test_runner    # Uses WIH
      action: run_tests
      condition: review.passed
      
    - agent: documenter     # Uses Claude
      action: update_docs
      condition: tests.passed
```

---

## Implementation Phases

### Phase 1: Node Agent MVP (Week 1-2)
- [ ] WebSocket client for reverse tunnel
- [ ] Docker runtime integration
- [ ] Basic job execution
- [ ] Registration protocol
- [ ] Install script

### Phase 2: Control Plane (Week 3-4)
- [ ] WebSocket server
- [ ] Node registry
- [ ] Job router
- [ ] Heartbeat monitoring

### Phase 3: Intelligence (Week 5-8)
- [ ] DAG engine
- [ ] Policy engine
- [ ] Memory layer
- [ ] Scheduler

### Phase 4: UX (Week 9-12)
- [ ] Web dashboard
- [ ] Agent marketplace
- [ ] Workflow builder
- [ ] Logs viewer

---

## What We Build Now

### Immediate Priority:

1. ✅ **Live Provider Data** (`provider_discovery.rs`)
   - Fetch real pricing from Hetzner API
   - Cache with TTL
   - Fallback to static for providers without APIs

2. ✅ **SSH Key Generation** (`ssh_keygen.rs`)
   - Proper ED25519/RSA generation
   - Uses system ssh-keygen (preferred)
   - Native Rust fallback
   - Encrypt at rest

3. 🔄 **Node Agent Scaffold** (`a2r-node/`)
   - WebSocket connection
   - Docker runtime
   - Basic job execution
   - Install script

4. 🔄 **Control Plane Updates**
   - WebSocket endpoint for nodes
   - Node registry
   - Job dispatcher

---

## Success Metrics

| Metric | Target |
|--------|--------|
| VPS deployments / week | 100 |
| Active nodes (30d) | 50 |
| Jobs executed / day | 1000 |
| User retention (30d) | 60% |
| Control plane uptime | 99.9% |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Users don't want to manage VPS | Make buying 1-click easy |
| Security concerns | Outbound tunnel only, no inbound |
| Node goes offline | Graceful degradation, retry logic |
| Docker not installed | Auto-install in install.sh |
| Competition from Codex/Claude | Focus on orchestration, not IDE |

---

## Decision

**APPROVE the BYOD Control Plane architecture.**

This is the correct direction because:
1. ✅ Differentiated from existing tools
2. ✅ Sustainable economics
3. ✅ Enterprise appeal
4. ✅ Scales infinitely
5. ✅ Aligns with original swarm vision

---

## Next Actions

1. ✅ Update frontend components (COMPLETE)
2. ✅ Add live provider discovery (COMPLETE)
3. ✅ Add proper SSH keygen (COMPLETE)
4. 🔄 Implement A2R Node Agent
5. 🔄 Update Control Plane for WebSocket
6. 🔄 Build agent marketplace UI

**Estimated MVP: 4 weeks**
