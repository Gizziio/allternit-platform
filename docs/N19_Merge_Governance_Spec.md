# A://RCHITECH — Merge Governance & Release Gates (N19)
## Governance Strategy Spec

### 1. Merge Requirements
Autonomous agents proposing changes to the A://RCHITECH fabric MUST satisfy the following gates before a PR can be merged.

- **Gate 1: Verification (N8)**
    - Run receipt must be attached to the PR.
    - All tests in the run MUST pass.
    - Proof of verification (VerifyArtifact) must be citeable.

- **Gate 2: Policy Compliance (N6)**
    - No "Critical" risk tier violations.
    - Any "High" risk tier changes require explicit Operator (N9) approval.

- **Gate 3: Budget Integrity (N11)**
    - Estimated cost of the change MUST be within the project's quarterly quota.

---

### 2. Release Gates
A release is defined as a signed Bundle (N4) of A2R components.

- **Pre-Release Checklist:**
    1.  **Integrity Check:** All component hashes match the build receipt.
    2.  **Compatibility Check:** Backwards compatibility verified against N14 spec.
    3.  **Security Scan:** No known vulnerabilities in the OCI/Nix base layers.

---

### 3. Automation (The Merge Bot)
The `a2r-merge-bot` (part of the Control Plane) monitors the repository and automates gate checks.

- **Workflow:**
    1.  Agent submits PR.
    2.  Merge Bot triggers a "Dry Run" in a sandbox (N4).
    3.  If Succeeded (N7) AND verified (N8), Bot adds `a2r-verified` label.
    4.  Human Operator performs final review for `a2r-ready` label.
    5.  Merge Bot executes final merge.
