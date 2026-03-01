# A2RCHITECH_CONFLICTS_AND_OPEN_QUESTIONS

## Conflict 1: OSS UI baseline — fork vs rebuild
- Conflict statement: Whether to fork an existing OSS UI (e.g., Open WebUI) as the baseline or rebuild UI in-house.
- Source A evidence (avoid fork): `/Users/macbook/Desktop/a2r-sessions/a2r_session_2026-01-26_shellui_brain_runtime_ui_e2e.md` L10-L12 "Conclusion: avoid forking for core product... implement capabilities in A2rchitech’s own Brain Session contract."
- Source B evidence (fork baseline): `/Users/macbook/Desktop/a2r-sessions/A2R_Session_Summary_2026-01-26_browser_os_cli_capsules.md` L250-L254 "Open WebUI (fast “OS shell” baseline) — fork + convert to modes."
- Why it matters: Determines technical debt, licensing risk, UI architecture surface area, and time-to-MVP.
- Proposed resolution path: Decide whether speed-to-market or long-term platform control is the primary constraint; lock a policy (fork-only for reference vs fork-as-base) and document in a law/spec doc.

## Conflict 2: GUI-first vs kernel-first/CLI-first positioning
- Conflict statement: Whether the system should be primarily GUI-first or kernel-first/CLI-first in architecture emphasis and scaling logic.
- Source A evidence (GUI-first emphasis): `/Users/macbook/Desktop/a2r-sessions/A2R Session-Brain CLI-ShellUI.md` L634 "A GUI-first coding swarm controller."
- Source B evidence (kernel-first emphasis): `/Users/macbook/Desktop/a2r-sessions/A2R Session-Brain CLI-ShellUI.md` L664-L672 "Kernel → Brain runtime → PTY subprocess → Event bus → UI projections... Kernel-first beats GUI-first for scale."
- Why it matters: Governs UI vs kernel roadmap sequencing, contract boundaries, and scaling decisions.
- Proposed resolution path: Choose a primary architectural locus (kernel-first with GUI projection, or GUI-first with kernel support) and align acceptance tests for both CLI orchestration and UI state.

## Conflict 3: Beads vs Claude Tasks for coordination memory
- Conflict statement: Whether Claude Tasks should replace Beads, complement Beads, or remain separate.
- Source A evidence (open question framing): `/Users/macbook/Desktop/a2r-sessions/A2R Session-Claude-Tasks-Vs-Beads.md` L18-L25 "Determine whether Claude Tasks meaningfully replace Beads, whether they complement it..."
- Source B evidence (Beads as repo-native cognition layer): `/Users/macbook/Desktop/a2r-sessions/A2R Session-Claude-Tasks-Vs-Beads.md` L71-L97 "Beads is... repo-native persistent cognition layer for agents... externalized agent memory."
- Why it matters: Determines persistence architecture for task graphs, agent memory interoperability, and coordination substrate.
- Proposed resolution path: Explicitly decide if Tasks is a UI-local DAG and Beads is canonical repo memory (layered design) or if Beads is to be deprecated; document in orchestration/memory specs.

## Conflict 4: Fork vs selective transplant for PAI Kernel adoption
- Conflict statement: Whether to fork Miessler’s repo as an upstream reference or selectively transplant components into a native A2rchitech kernel.
- Source A evidence (fork option): `/Users/macbook/Desktop/a2r-sessions/Framing/A2rchitech_PAI_Kernel_Spec_and_PAIMM_Mapping.md` L243-L255 "Fork option (fastest)... fork repo as a2rchitech/pai-kernel-reference..."
- Source B evidence (selective transplant): `/Users/macbook/Desktop/a2r-sessions/Framing/A2rchitech_PAI_Kernel_Spec_and_PAIMM_Mapping.md` L259-L265 "Selective transplant (cleaner long-term)... implement PAI Kernel natively..."
- Why it matters: Influences repo structure, long-term maintainability, and integration risk with existing A2rchitech kernel.
- Proposed resolution path: Align on the recommendation (start with fork, then replace) or formally reject the fork path; commit to a policy for upstream tracking and deprecation timeline.

