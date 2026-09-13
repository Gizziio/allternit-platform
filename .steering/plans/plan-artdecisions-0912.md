# Plan — artdecisions-0912 (Artifacts API decisions doc, docs-only)

Session id: artdecisions-0912. Branch: session/artdecisions-0912. Worktree: allternit-session-artdecisions-0912.

## Todos

- [x] Fetch origin/main, create worktree + branch
- [x] Read docs/design/artifacts-api.md fully
- [ ] §6 publish tier → DECIDED (4 answers: shared Pages project w/ per-user routes; snapshot version; deployments immutable, unpublish removes route only; publish gated on sandbox policy in v1)
- [ ] §6 relay tier → DECIDED (2 answers: mint new local id on receive, origin id in provenance; no stricter received sandbox — standard policy + displayed provenance)
- [ ] §8 version retention → DECIDED (cap 50 versions/artifact, admin-configurable, prune oldest; update Phase 2 phasing note)
- [ ] Rewrite OPEN-questions lists recording the answers (dated 2026-09-12, decided by Eoj), not delete them
- [ ] Markdown consistency check (doc session, no typecheck)
- [ ] Commit, push, PR, merge (--merge)
- [ ] gh issue view 386; comment on 386 + 389 (Phase 3 unblocked, publish gate per §6); comment on 387/388 (retention decided, belongs in Phase 2)
- [ ] Ledger branch session/ledger-artdecisions-0912: summary + LEDGER.md line, PR + merge
- [ ] Cleanup: worktree remove, delete session + ledger branches local+remote, final sweep
