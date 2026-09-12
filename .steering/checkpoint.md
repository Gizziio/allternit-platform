# Steering checkpoint

- **Goal:** Fabric Transport chat/code modes mount the exact desktop views; cowork sessions selectable from the chat rail switch the canvas.
- **Just did:** New worktree `fabric-chat-code-0912` off origin/main (`d4f6d0761`). Added `FabricChatModeCanvas` (ChatViewWrapper default; CoworkRoot on cowork select; intercepts `allternit:open-view` cowork/chat/home) + `FabricCoworkRailSection` (cowork sessions from CoworkSessionStore, New/rows activate + flip canvas) + `FabricCodeModeCanvas` (desktop CodeRoot). FabricSessionPanel rewired: chat kind → desktop chat canvas (fabric node session detail still reachable from rail), code kind → CodeRoot with a floating Code↔Terminal toggle (terminal = selected session's terminal, or Termius multi-session when none selected). SW v39→v40. Typecheck ✅.
- **Next:** vitest dispatch + build + prepare, verify output, PR, merge, deploy, ledger, cleanup.
- **Open questions:** Desktop chat/code/cowork views run against the platform (cloud) stores on the PWA — same architectural trade as bots (accepted by Eoj). Fabric node chat sessions remain in the rail ("Node sessions" section).
