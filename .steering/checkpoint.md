# Steering checkpoint

Goal: Platform UI polish for Allternit Desktop — (1) chat session bg tan→white, (2) cowork progress rail readability, (3) code-mode model selection sync with app-wide brain, (4) code-mode chrome + first-class computer (bot cloud computer w/ observe/take-over/hand-back), (5) global multi-terminal workspace (tile grid + focus zoom, session-tagged). Plan approved by owner; worktree `allternit-session-ui-polish`, branch `session/ui-session-polish`.

Just did: Phase 1 implemented (uncommitted). ChatBackground embedded-session branch now paints an opaque `--view-chat-bg` base under the accent gradient (ChatBackground.tsx). CoworkRightRail hard-coded amber constants → theme tokens + rail surface now `--shell-menu-bg` glass (CoworkRoot.tsx). TodoWidget white-text literals → theme tokens. CodeCanvas now consumes `useModelSelection()` from its existing provider instead of dead local state; ModelSelectionProvider gains cross-instance live sync via `allternit:gizzi-brain-changed` + storage events (guarded, no clobber); new shared `useResolvedDefaultModelSelection()` used by both ChatViewWrapper and CodeThreadView. CodeCanvas test given a provider mock. Typecheck: 15 pre-existing errors unchanged from clean HEAD (zero new); 11/11 touched tests pass.

Next: Steering gate → commit Phase 1. Then Phase 2 (ACI idle state, CodeAciPane first-class computer, CodeSessionLauncher polish), then Phase 3 (terminal workspace store + surface + catalogue integration).

Open questions: AgentModeBackdrop fog still sits above the new opaque chat base — if owner finds it still too warm in review, reduce its opacity for the chat surface (prop exists).
