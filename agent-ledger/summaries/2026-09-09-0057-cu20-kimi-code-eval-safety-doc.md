# Session cu20 — Published eval/safety system card (packaging gap 4)

- **Date:** 2026-09-09
- **Agent:** kimi-code (orchestrated swarm task C)
- **PR:** #185 → merge 83de96076
- **Branch:** session/cu20-eval-doc

## What was done

Closed packaging Gap 4 (publish measured eval/safety numbers) with `docs/public/aci/safety.md`, modeled on OpenAI's Operator System Card + Anthropic RSP-style assessment, Allternit-branded ("Allternit Computer Use", never "CUA"). Every number verified live this session before citation:

- Measured conformance (reproduced 2026-09-09): mock 8/8, playwright 8/8, crawler 5/5, hybrid 3/3, routing 6/6 via `conformance.measured --network`; browser.cdp 8/8 run directly against headless Chrome on CDP :9222 (Chrome killed + confirmed gone via lsof after). Traceable to `adapter_grades.json` / `suites.py`.
- Rust safety: `cargo test -p allternit-api aci_` → 40 passed, 0 failed.
- Doc covers: measurement method (in-repo conformance suites vs vendor-run benchmarks, called out honestly), safety architecture (SHA-256 hash-bound single-use 120s-TTL receipted grants, reversible/risky/irreversible taxonomy, host allowlist/circuit-breaker/handoff, heuristic + VLM monitor, AES-256-GCM vault w/ sandbox_env-only injection + RFC 6238 TOTP, cost observability), known limits with explicit "pending measurement" entries, reproduce-it-yourself section with exact commands.
- Linked from `docs/public/aci/index.md`.

## Honest deferrals

- No `llms.txt` exists under `docs/public/` (verified via `find`) — nothing to link there.
- No changelog entry: `docs/public/aci/changelog.md` is scoped to tool-contract versions only.
- Pre-existing discrepancy, not fixed: `guide.md` says grant TTL default 300s; `aci_approvals.rs` code says 120s — the new doc cites the code value (120s).
- browser-use and pyautogui desktop adapters remain honestly "pending measurement" with exact rerun commands.
