# Plan — session/csp-egress-0912 (issue #396)

1. [x] Read issue #396, ArtifactRenderer.tsx, DESIGN.md §11, artifact-templates.ts from origin/main
2. [ ] Design CSP: strict `default-src 'none'` base + per-renderer-type exceptions (mermaid/markdown/svg/aio-target); document each exception
3. [ ] Inject CSP `<meta>` into every generated srcdoc; ensure no renderer path allows external network fetches; keep exports client-side
4. [ ] Tests: assert CSP meta present + denies connect-src/external origins; run `pnpm vitest run src/components/artifact` + full artifact vitest set
5. [ ] Verify: `pnpm typecheck` (0 errors) in surfaces/ai.allternit.com; `node scripts/release-preflight.mjs` (35/0)
6. [ ] Update DESIGN.md §11 with the CSP policy
7. [ ] Commit, push, PR, merge (--merge); close issue #396 with PR reference
8. [ ] Ledger branch session/ledger-csp-egress-0912: summary + LEDGER.md line, PR + merge
9. [ ] Desktop rebuild: copy sidecars, npm run dist background, bundle-verify `default-src 'none'` grep, preserve 8-file set, retire previous latest
10. [ ] Cleanup: worktree remove, delete session + ledger branches (local+remote), final sweep
