# Steering checkpoint

- **Goal:** Fabric Transport chat/code modes mount the exact desktop views; cowork sessions selectable from the chat rail switch the canvas.
- **Just did:** New worktree `fabric-chat-code-0912` off origin/main (`d4f6d0761`). Added `FabricChatModeCanvas` (ChatViewWrapper default; CoworkRoot on cowork select; intercepts `allternit:open-view` cowork/chat/home) + `FabricCoworkRailSection` (cowork sessions from CoworkSessionStore, New/rows activate + flip canvas) + `FabricCodeModeCanvas` (desktop CodeRoot). FabricSessionPanel rewired: chat kind → desktop chat canvas (fabric node session detail still reachable from rail), code kind → CodeRoot with a floating Code↔Terminal toggle (terminal = selected session's terminal, or Termius multi-session when none selected). SW v39→v40. Typecheck ✅.
- **Next:** vitest dispatch + build + prepare, verify output, PR, merge, deploy, ledger, cleanup.
- **Open questions:** Desktop chat/code/cowork views run against the platform (cloud) stores on the PWA — same architectural trade as bots (accepted by Eoj). Fabric node chat sessions remain in the rail ("Node sessions" section).

---

# Checkpoint — artphase1-0912

**Goal:** Land Artifacts API Phase 1 (gateway CRUD + design-session persistence) per docs/design/artifacts-api.md; version retention cap 50 at append time; PR merge, ledger, desktop rebuild, cleanup.

**Just did:** Merged origin/main (other sessions' ledger/design/CSP merges) — checkpoint conflict resolved theirs-first. Pre-existing test failures verified on pristine origin/main: 4 provision_harness agent_cloud tests (stale allternitos_control_plane binary rejects --fake-provider) + rails gate_data_plane_round_trip fail on main; claim_race is flaky (passes isolated). All 6 content-artifact route tests pass; design vitest 80/80; typecheck 0 errors; release-preflight 35/0.

**Next:** `cargo build --release -p allternit-api` → live curl smoke (ALLTERNIT_LOCAL_DEV_BYPASS=1, port 18013, temp data dir) → re-run route tests post-merge → PR + merge → issue 387 comment/close → ledger → desktop rebuild → cleanup.

**Open questions:** None.
