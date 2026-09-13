# Plan — session/fedesign-0911 (Session G)

Mapping doc: `/Users/joe/allternit-design-competitive-mapping.md` (LOCKED) §2 row 5 / §4.
Goal: vendor Anthropic's verified `frontend-design` skill (github.com/anthropics/skills) as the
base of the studio steering layer, ADAPTED to Allternit brand law. Steering only — NOT a
bundled creation skill (the catalog is for creation workflows).

## Todos

- [x] Create worktree allternit-session-fedesign-0911 on session/fedesign-0911 from origin/main; pnpm install
- [x] Fetch upstream `skills/frontend-design/SKILL.md` (Apache-2.0, attribution header kept)
- [x] Vendor adapted reference at `surfaces/ai.allternit.com/skills/references/frontend-design.md`
- [x] Fold adapted core rules into `src/lib/design/studio-system-prompt.ts` as a bounded
      "Design taste" block (plan-tokens-first, slop bans, contrast ≥4.5:1, SVG-not-emoji,
      amber/ivory/graphite tokens, deny-list restated vs html-linter P0s, Inter-fallback intent)
- [x] Add `studio-system-prompt.test.ts` asserting the composed prompt carries the adapted rules
- [ ] Verify: `pnpm typecheck` 0 errors; `pnpm vitest run src/lib/design src/shell` green
- [ ] `node scripts/release-preflight.mjs` from repo root → 35/0
- [ ] Commit + push; `gh pr create` (real summary + verification); `gh pr merge --merge`
- [ ] Ledger: branch session/ledger-fedesign-0911 from origin/main, write
      `agent-ledger/summaries/2026-09-11-HHMM-fedesign-0911-kimi-frontend-design-skill.md`,
      append LEDGER.md bullet (end of file; conflict → keep both, theirs first), PR, merge
- [ ] Desktop rebuild: copy resources/bin from shared checkout, `CSC_IDENTITY_AUTO_DISCOVERY=false npm run dist` (background, await notification)
- [ ] Bundle grep for a unique string from the prompt change in the mac-arm64 app assets
- [ ] Preserve new DMGs to shared checkout release/; delete only the immediately-previous build set
- [ ] Cleanup: worktree remove --force; delete session/fedesign-0911 + session/ledger-fedesign-0911 branches local AND remote
