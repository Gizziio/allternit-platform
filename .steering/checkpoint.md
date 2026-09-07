# Steering checkpoint

Goal: Platform UI polish for Allternit Desktop — (1) chat session bg tan→white ✅, (2) cowork progress rail readability ✅, (3) code-mode model selection sync ✅ (all committed in f56bef1bd), (4) code-mode chrome + first-class computer ✅ (uncommitted, this checkpoint), (5) global multi-terminal workspace (tile grid + focus zoom, session-tagged) — next.

Just did: Phase 2. ACIComputerUseView gained an explicit idle empty state ("No live computer session" + engine-health-aware hint, theme tokens) so the pane never renders blank. CodeAciPane retitled "Computer" with paneMeta-consistent header; bot picker strip sets connectedBotId → shared bot desktop (Observe / Take over / Hand back / Provision) renders in-pane; Disconnect clears it explicitly (field is shared with ACIEngineBar, not single-owner, so no auto-clear on unmount). Dev-server terminal stays a secondary header toggle. CodeSessionLauncher buttons now icon+label pills (Canvas/Terminal/Diff/Computer/Actions) with active state on the canvas toggle. Typecheck: identical 15 pre-existing errors, zero new; 12/12 touched tests pass.

Next: Steering gate → commit Phase 2. Then Phase 3: terminal workspace store, global workspace surface (tile grid + focus zoom), native catalogue integration.

Open questions: (a) Main checkout drifted while this session worked — BotComputerViewport.tsx landed on main (7738f09e0) after this branch's base; this branch wires BotDesktopView instead (same pickup/hand-back capability at this base). At merge time, consider swapping to BotComputerViewport if it has become the canonical shared viewport. (b) AgentModeBackdrop fog above the opaque chat base — owner to judge warmth in review.
