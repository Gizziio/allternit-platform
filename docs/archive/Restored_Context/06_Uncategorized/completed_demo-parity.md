# UI-TARS Demo Parity Checklist

## 1. Goal
Ensure the Allternit implementation matches the visual and temporal loop demonstrated in the UI-TARS project (ByteDance).

## 2. Parity Mapping

| UI-TARS Demo Feature | Allternit Implementation | Status |
|----------------------|---------------------------|--------|
| Visual Observation | `onObserve` in EvidenceRail captures screenshot via IO. | ✅ |
| Target Highlighting | `hoveredProposal` renders markers over Canvas. | ✅ |
| Action Proposal | `model.ui_tars.propose` skill returns coordinates. | ✅ |
| Execution Verification| Post-execution `gui.observe` capture. | ✅ |
| Iterative Loop | Proposals add to conversation history. | ✅ |
| Thinking Visualization| SynthesisScaffold shows formation logic. | ✅ |

## 3. Visual Grammar
- **Bounding Markers**: Proposals must show where they will click before the user approves.
- **Transitional States**: The transition from evidence to active canvas must feel like "birth" (scale + fade).
- **Truthful Trace**: Every model-driven click must be visible in the Operator Console.

## 4. Pending Enhancements
- [ ] Real bounding box rendering if model returns region.
- [ ] Multi-modal history integration (feeding previous screenshots back to model).
- [ ] Direct "Edit" capability for proposed coordinates in the UI.
