# Checkpoint — ao/fabric-bot-followup-0911 (MERGED, awaiting deploy go-ahead)

## Goal
Fabric Transport bot-mode follow-up: verify v34 bot rail vs desktop parity,
polish divergences. Done.

## Just did
- PR #330 merged (168012ca5): rail bot rows open BotChatSessionView
  (session-started callback → openBotChatView, desktop parity), ErrorBoundary
  on all bot canvas branches, SW v34→v35, FabricBotMode rail purity +
  navigation regression tests, stale BotsRosterSection test fixed.
- Ledger attestation 24704c5fa on main. Worktree now on main (deploy-ready).
- CI: all code checks pass; Vercel/CF Pages failures identical on PR #329
  (pre-existing infra).

## Next
- AWAITING EOJ GO-AHEAD for deploy from this worktree:
  cd surfaces/ai.allternit.com
  pnpm exec vite build --config vite.fabric-session.config.ts
  node scripts/prepare-fabric-session-pwa.mjs
  pnpm exec wrangler pages deploy tmp/fabric-session-pwa \
    --project-name=allternit-remote-control --branch=main \
    --commit-hash=168012ca5 --commit-dirty=true
- After deploy: Eoj hard-refresh/clears site data (SW v35); phone runtime
  check of rail → bot chat; then worktree/branch cleanup + desktop rebuild
  follow-up.

## Open questions
- None.
