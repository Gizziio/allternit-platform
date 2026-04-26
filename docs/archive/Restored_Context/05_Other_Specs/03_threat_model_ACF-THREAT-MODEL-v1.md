# A://TERNIT — Autonomous Code Factory (ACF)
## Threat Model (ACF-THREAT v1)
Date: 2026-02-18

This threat model assumes adversarial behavior from:
- External contributors (untrusted PRs)
- Compromised agents (prompt injection, tool misuse)
- Malicious dependencies
- CI environment compromise
- Reviewer service compromise (false clean review)

Goal: ensure deterministic, auditable safety gates prevent unsafe merges.

---

## 1. Assets to Protect

1. **Repo integrity**: codebase correctness + maintainability
2. **Control-plane truth**: /SOT.md, /spec contracts, policy docs
3. **Merge authority**: MergeEligibilityReceipt correctness
4. **Evidence correctness**: UI/flow proof integrity
5. **Secrets**: tokens, keys, credentials (must never be exfiltrated)
6. **Supply chain**: dependencies, build artifacts, package registries

---

## 2. Trust Boundaries

### TB1 — External PR Input
- Diff, comments, issues, PR descriptions are untrusted.
- Must never be executed as commands.
- Must be treated as data only.

### TB2 — Agent Execution Environment
- Tools are high-leverage. Require role-scoped allowlists.
- Writes must be constrained by path + tier.

### TB3 — Review Agent Integration
- A reviewer can be compromised or buggy.
- Review must be *necessary but insufficient* for merge.
- Review state must be SHA-bound and receipt-backed.

### TB4 — CI Runner / Build System
- CI can be compromised.
- Receipts must include environment identity and command digests.
- Evidence integrity must be hash-verified.

---

## 3. Primary Attack Scenarios & Mitigations

### A1: Prompt injection via PR text / issue text
**Vector**: malicious instructions in PR description or code comments induce agent to run destructive tools.  
**Mitigations**
- Context pack builder marks PR text as **untrusted data**; exclude from system-level instructions.
- Tool policy requires explicit WIH scope; deny tool calls not referenced by WIH + policy.
- Disallow shell execution from untrusted strings; require fixed command templates.

### A2: Spec/Policy drift via stealth changes
**Vector**: modify `/spec/**` or `/agent/**` to weaken governance.  
**Mitigations**
- RiskPolicy classifies spec/control-plane paths as **critical**.
- Docs drift gate requires /SOT.md + spec delta + ADR update.
- Implementer role forbidden from editing `/spec/**`.

### A3: Stale “clean” review used to merge unsafe code
**Vector**: review ran on prior SHA; later commit adds vulnerability.  
**Mitigations**
- review-clean-head gate requires `headSha` match.
- Any synchronize requires rerun; Rails dedupes by SHA.
- MER embeds reviewRunId + headSha.

### A4: Reviewer compromise (false clean)
**Vector**: reviewer service returns success incorrectly.  
**Mitigations**
- Reviewer is not the only gate: acceptance + security + evidence required by tier.
- Require at least one non-LLM static gate on high/critical.
- Optional v2: anomaly detection for “too clean” reviewer output.

### A5: Remediation agent becomes exploit path
**Vector**: remediation agent loops, edits unrelated files, or relaxes tests.  
**Mitigations**
- Patch-only scope: allow writes only to files touched in findings.
- Lock spec/control-plane directories.
- MaxAttempts + escalation.
- Targeted validation commands fixed by tier policy.

### A6: Evidence forgery
**Vector**: attacker uploads fake screenshots/manifest for a different SHA.  
**Mitigations**
- Evidence schema requires headSha.
- Evidence storage path is `evidence/{headSha}/...`.
- Runner verifies artifact hashes match manifest.
- Freshness window enforced by policy.
- Optional v2: sign evidence with CI identity key.

### A7: Dependency substitution / supply-chain attack
**Vector**: malicious package update or lockfile manipulation.  
**Mitigations**
- Treat lockfile changes as high/critical.
- Require dependency audit gate for high/critical.
- Require SBOM generation + diff (v2).
- Pin registries and use allowlisted sources.

### A8: CI environment tampering
**Vector**: compromised CI yields forged passing outputs.  
**Mitigations**
- Gate receipts include command digests + toolchain versions.
- Require reproducible builds where feasible.
- Optional v2: run verification in two independent environments.

### A9: Secret exfiltration
**Vector**: agent reads secrets and leaks via logs or PR comments.  
**Mitigations**
- Tools that read secrets require Security role and explicit approval gate.
- Redaction layer in log emitter; block printing env vars.
- Zero-trust: secrets not mounted for untrusted PRs.

---

## 4. Security Controls Checklist (ACF v1)

### Must-have
- Role-scoped tool allowlists
- Path-based write locks by tier
- Head SHA discipline for review + evidence + receipts
- Preflight policy gate before expensive compute
- Immutable receipts; merge permitted only with valid MER

### Strongly recommended
- SAST + dependency audit for high/critical
- Evidence hash verification
- Deterministic remediation loop constraints

---

## 5. Residual Risks (Explicit)

- Compromised CI can forge local “pass” logs unless receipts are signed/attested.
- Reviewer compromise reduces detection; mitigated by independent static gates.
- Supply chain remains high-risk without SBOM + provenance attestation (v2).

---

## 6. v2 Security Upgrades (Roadmap)

- Receipt signing + provenance attestation (SLSA-style)
- SBOM generation + diff gate
- Two-runner quorum for critical merges
- Evidence signing + replay protection
- Anomaly detection for review behavior
