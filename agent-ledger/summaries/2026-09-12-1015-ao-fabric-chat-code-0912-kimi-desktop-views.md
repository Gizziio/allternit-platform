# 2026-09-12 — Fabric Transport: desktop chat/cowork/code views mounted

- **Session:** ao (Kimi Code), worktree `fabric-chat-code-0912`
- **PR:** #410 (`24a00b336`, merged)
- **Deployed:** fabrictransport.allternit.com PWA SW **v40** (wrangler pages deploy from the worktree at merged main, commit-hash `24a00b336`)

## What was done

Eoj asked that chat mode and code mode on Fabric Transport show **the same view as the desktop app**, and that selecting a cowork session in chat mode changes the view.

- **`FabricChatModeCanvas`** (new): chat-mode canvas = `ChatViewWrapper` — the exact desktop chat surface (greeting, composer, model picker, thread; it carries its own ChatId/DataStream/MessageTree/PromptInput/ChatInput/ChatModels/ModelSelection providers, so no fabric-session provider changes were needed). Selecting a cowork session flips the canvas to `CoworkRoot` (the desktop cowork surface, also self-provided). `allternit:open-view` events (viewType `cowork` / `chat` / `home`) drive the same switch, mirroring `FabricBotModeCanvas`.
- **`FabricCoworkRailSection`** (new): Cowork section at the top of the fabric chat rail — lists cowork sessions from `CoworkSessionStore` (same store the desktop shell rail uses), "New cowork session" clears the active session so CoworkRoot shows its launchpad. Fabric node chat sessions stay in the rail under a "Node sessions" header and still open the fabric session detail (node backend unchanged).
- **`FabricCodeModeCanvas`** (new): code-mode canvas = `CodeRoot` — the desktop code surface (launcher, composer, thread/canvas workspace). The Termius-style terminal survives as a floating **Code ↔ Terminal** toggle: bound to the selected fabric code session, or multi-session tabs (`fabric-terminals:<runtimeId>`) when none is selected. Removed the fabric code home card and 3-pane code UI from #402 (superseded).
- SW cache v39 → v40 (`check-sw-cache-bump` gate).

## Verification

- `pnpm --filter @allternit/ai typecheck` ✅ (also after rebase — main moved twice during the session)
- `vitest run src/components/dispatch` — 12 passed ✅
- Vite fabric-session build + `prepare-fabric-session-pwa.mjs` ✅ (SW v40, `brand/` + `functions/` intact)
- Live post-deploy: SW = v40, `/api/web-proxy?url=example.com` = 200, `/brand/matrix/matrix-logo.svg` = 200

## Honest deferrals

- The mounted desktop views run against the **platform (cloud) stores** on the PWA — the same architectural trade already accepted for bot mode. If a view needs node-routed execution later, that is a runner-seam project (like the ACI `setFabricAciRunner` pattern), not a view swap.
- Could not exercise the mounted chat/cowork/code views headlessly (Clerk auth). Each canvas is wrapped in the repo ErrorBoundary pattern (`componentName` FabricChat / FabricCowork / FabricCode), so a provider gap fails contained; if Eoj sees a boundary fallback on the phone, the name identifies the canvas.
- Desktop app binary not rebuilt (nothing here is bundled by the desktop app).
