Goal: S6 of folder reorg — collapse root reports/research/spec into docs/, move root tracker/handoff/design md files, fix all inbound links.
Just did: 49 git mv (reports 4, research 18, spec 4, root md 7); root reports//research/ empty, spec/ retains only Contracts/ (load-bearing); commrails README dead link repointed; ~20 link fixes across AGENTS.md, README.md, REPO_STRUCTURE.md, MASTER_INDEX, .steering plans, docs cross-links. Preflight 52/0.
Deliberate root exceptions (live code reads them from root): GIZZI.md, THIRD-PARTY-NOTICES.md, spec/Contracts/.
Next: commit, PR, merge, shared-checkout sync, ledger attestation covering S7+S6.
