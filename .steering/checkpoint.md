# Checkpoint — csp-egress-0912

**Goal:** Fix issue #396 — inject strict CSP into artifact iframe srcdocs, close egress hole, tests, DESIGN.md §11 update, desktop rebuild.

**Just did:** Implemented `sandbox-csp.ts` (`ARTIFACT_CSP` + `injectSandboxCsp`), wired into HTMLRenderer srcdoc pipeline (CSP before storage shim). Extended ArtifactRenderer tests (9 tests). Updated DESIGN.md §11 (CSP now in 11.1 enforced; removed the 11.2 "No CSP" advisory). Verified: vitest artifact 9/9, src/lib/design 73/73, typecheck 0 errors, release-preflight 35/0.

**Next:** Commit + push, PR, merge, close issue #396, ledger branch, desktop rebuild, cleanup.

**Open questions:** None. No per-renderer CSP exceptions needed — templates are fully self-contained; documented in §11.1. LibraryItemDialog has its own srcdoc iframe using only the storage shim (same class of gap) — out of scope for #396, noted in PR.
