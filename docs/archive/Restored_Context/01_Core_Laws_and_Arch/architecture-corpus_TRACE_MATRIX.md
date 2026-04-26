# Architecture Corpus Trace Matrix
**Mapping:** Corpus File -> Backlog Items / Features

This matrix tracks coverage of the architecture corpus by the execution backlog.

| Corpus File | Category | Covered By | Notes |
|---|---|---|---|
| `UI/Capsules.md` | UI | P0-A | Core capsule definition |
| `UI/CapsuleProtocol.md` | UI | P0-A | Protocol spec |
| `UI/CanvasProtocol.md` | UI | P0-B | Canvas/View spec |
| `UI/PresentationKernel.md` | UI | P0-B | UI logic kernel |
| `UI/MiniAppRuntime.md` | UI | P0-C | Frameworks |
| `UI/Journal.md` | UI | P0-D, P1-02 | Single Source of Truth |
| `UNIFIED/RUNTIME/Kernel.md` | UNIFIED | P0-D, P1-01 | Kernel contracts |
| `UNIFIED/SOT.md` | UNIFIED | ALL | System-wide invariants |
| `BACKLOG/Tool Registry.md` | BACKLOG | P1-03 | Tool gating |
| `UNIFIED/CONTEXT/Context.md` | UNIFIED | P2-01 | Context packing |
| `UNIFIED/IR/MarkdownIR.md` | UNIFIED | P2-02 | IR Normalization |
| `UI/Research_Synthesis_Discovery_UI.md` | UI | P2-03 | Distillation |
| `INTEGRATIONS/Linear.md` | INTEGRATIONS | P3-01 | Linear Adapter |
| `INTEGRATIONS/Glide.md` | INTEGRATIONS | P3-02 | Glide UX |
| `UNIFIED/ROBOTICS/Robotics.md` | UNIFIED | P4-01 | Robotics |

## Coverage Status
- **P0 Entry Point:** Fully mapped (Capsules, Canvas, Journal, Frameworks).
- **P1 Kernel:** Mapped (Registry, Persistence, Tools).
- **P2 Context:** Mapped.
- **P3 Integrations:** Mapped.
- **P4 Robotics:** Mapped.
