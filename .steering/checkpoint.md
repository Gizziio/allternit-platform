# Steering checkpoint

**Goal:** WebMCP-shaped tool layer over gmail/github/notion plugin golden paths + semantic tool-call logging + timeline playback viewer.

**Just did:** Milestone 3 — recording timeline viewer. New `AciRecordingTimelineView` + parser (`recording-timeline.ts`) under surfaces/ai.allternit.com/src/views/aci/, wired as view type `aci-recordings` (nav.types/nav.policy/ViewRegistry/ShellApp browser-mode set + entry button in AciMiniAppsView). Data via existing gateway recordings API (list + raw `/recordings/{id}/file` JSONL) with local-file picker fallback; no new backend. 12 new parser tests green, all 43 aci tests pass, surface typecheck running. Note: worktree surface node_modules symlinked from main checkout (pnpm install off-limits for this session).

**Next:** Parent review; then session wrap (commit/PR happen outside this subagent per instructions).

**Open questions:** None.
