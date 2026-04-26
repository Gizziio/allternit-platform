# Allternit Robotics Integration – Planning Notes (Unified)

> **Status:** Plan Mode (Exploratory – nothing locked in)  
> **Purpose:** Capture all robotics-related platforms discussed in this chat and map them into the Allternit unified framework for later integration decisions.

---

## 1. Guiding Principle

Allternit is **foundational and unifying**, not a replacement product.

External platforms are treated as:
- Capability providers
- Artifact generators
- Skill sources
- Specialized engines

Integration happens at **interfaces and schemas**, not by cloning entire products.

---

## 2. Core Allternit Robotics Layers (Reference)

1. **Perception Layer**
   - Sensors, vision, point clouds, CAD, environment capture
2. **Hardware / Morphology Layer**
   - Robot bodies, actuators, joints, kinematics (e.g., ca/rotors lives here)
3. **Skill Abstraction Layer**
   - Reusable behaviors (navigate, grasp, weld, inspect, etc.)
4. **Planning & Simulation Layer**
   - Motion planning, offline simulation, validation
5. **Execution & Runtime Control**
   - Real-time control, adaptive feedback loops
6. **Skill Discovery & Meta-Learning**
   - Learning new skills, generalization across robots
7. **Dynamic UI / Mini-App Capsules**
   - Mobile-first, web-native, composable workspaces
8. **Artifact Registry**
   - Hardware, software, data, models, skills (versioned, reusable)

---

## 3. Tnkr.ai – Robotics Studio / Project Discovery Capsule

### What Tnkr Is
- Collaborative robotics platform combining:
  - Hardware (BOM, assembly steps)
  - Software (repos, firmware)
  - Data (logs, demonstrations)
  - Models / policies
- Public **Explore** page works well on mobile web
- Strong project discovery and contribution UX

### How Tnkr Maps to Allternit

**Primary Role:**  
Robotics Studio + Project Discovery **Mini-App Capsule**

**Mappings:**
- Tnkr Project → Robot Artifact Graph
  - HardwareArtifact (BOM, parts, assembly DAG)
  - SoftwareArtifact (repos, firmware)
  - DatasetArtifact (telemetry, demos)
  - PolicyArtifact (models tied to hardware)

**Dynamic UI:**
- Embedded Explore page (PWA/WebView)
- “Save to Workspace” wrapper
- Generated workspace panels:
  - Assembly
  - Code
  - Data
  - Models
  - Agent assistance

**Key Insight:**
Tnkr upgrades ca/rotors from a static component into a **living, reproducible robot build pipeline**.

---

## 4. Augmentus – Perception → Planning → Simulation → Execution

### What Augmentus Is
- AI-powered, no-code industrial robotics automation platform
- Focused on:
  - 3D scanning / CAD ingestion
  - Automated toolpath generation
  - Offline simulation
  - Adaptive, closed-loop execution
- OEM-agnostic (ABB, KUKA, UR, etc.)

### How Augmentus Maps

**Primary Role:**  
Specialized **Perception + Motion Planning + Simulation Engine**

**Mappings:**
- PerceptionArtifact
  - Point clouds
  - CAD meshes
  - Uncertainty metrics
- MotionPlanArtifact
  - Toolpaths
  - Constraints
  - Performance metrics
- SimulationRecord
  - Collision checks
  - Validation logs
- ExecutionProfile
  - Adaptive control rules
  - Runtime telemetry

**Integration Pattern:**
- Import Augmentus outputs as artifacts
- Dual-simulation validation (Augmentus + Allternit)
- Treat Augmentus as a task-specialized planner, not the core runtime

**Key Insight:**
Augmentus is a **task automation specialization**, while Allternit remains the general platform.

---

## 5. Skild AI – Skill Discovery & Meta-Learning

### What Skild AI Is
- Foundation model for robotics (“general-purpose robotic brain”)
- Omni-bodied: works across different robot morphologies
- Learns from simulation, internet video, and real-world data
- Provides adaptive, hierarchical control

### How Skild Maps

**Primary Role:**  
Skill Discovery + Meta-Learning Backend

**Mappings:**
- SkillArtifact
  - Semantic description
  - Applicability conditions
  - Execution API
- MetaLearningEngine
  - Cross-embodiment transfer
  - In-context adaptation
- SkillExecutor
  - Runtime skill invocation
  - Adaptation monitoring

**Key Insight:**
Skild is not a skill library – it is a **skill generator and generalizer**.

---

## 6. Synthiam (ARC) – Skill Store & Low-Code Composition

### What Synthiam Is
- Low-code / no-code robotics development platform
- Modular “Robot Skills” ecosystem
- Skill Store marketplace
- Exosphere cloud for remote control & logging
- Strong hobbyist / education adoption

### How Synthiam Maps

**Primary Role:**  
Skill Catalog + Low-Code Skill Composition Layer

**Mappings:**
- SkillArtifact
  - Imported from Synthiam Skill Store
- Low-Code Workflow Canvas
  - Block-based → canonical workflow AST
- Device Adapter Layer
  - Servo, sensor, controller abstraction
- Cloud Bridge
  - Telemetry
  - Remote operation
  - Data ingestion

**Key Insight:**
Synthiam contributes **human-friendly skill composition and discovery**, not meta-learning.

---

## 7. Comparative Positioning

| Platform   | Best At | Allternit Role |
|-----------|--------|-----------------|
| Tnkr.ai | Project discovery, hardware + model cohesion | Robotics Studio Capsule |
| Augmentus | Perception-driven planning & simulation | Planning / Simulation Engine |
| Skild AI | Generalized skill learning | Meta-Learning Backend |
| Synthiam | Low-code skills & community | Skill Store + Composer |
| Allternit | Unification & orchestration | Canonical platform |

---

## 8. Shared Canonical Artifact Schemas (Draft)

```yaml
RobotHardwareArtifact:
  parts
  joints
  actuators
  sensors

SkillArtifact:
  id
  description
  interfaces
  parameters
  executionBindings

MotionPlanArtifact:
  robotId
  toolpaths
  constraints
  metrics

SimulationRecord:
  environment
  motionPlan
  results

ExecutionProfile:
  feedbackRules
  telemetry
```

---

## 9. Integration Strategy (Plan Mode)

1. Start with **capsules and adapters**, not deep coupling
2. Normalize everything into **artifact schemas**
3. Keep platforms federated (no lock-in)
4. Let Allternit own:
   - Skill graph
   - Artifact registry
   - UI orchestration
   - Meta-layer logic

---

## 10. Open Questions (Intentionally Unresolved)

- Which platforms expose stable APIs vs exports?
- How much real-time execution should be delegated?
- How to merge learned skills (Skild) with engineered skills (Synthiam)?
- When to formalize industrial vs hobbyist tiers?

---

**End of Planning Capture**
