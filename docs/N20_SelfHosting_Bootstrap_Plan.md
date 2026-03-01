# A://RCHITECH — Self-Hosting & Bootstrap Plan (N20)
## Dogfooding Strategy

### 1. Phase 1: Local Bootstrap
- **Goal:** Run A://RCHITECH on a single machine using the Process Driver (N4).
- **Tooling:** `./bin/dev-up` script.
- **Verification:** All N1-N18 components functional in a single-tenant local environment.

---

### 2. Phase 2: Orchestrated Bootstrap
- **Goal:** Run A://RCHITECH inside Kata/Firecracker (N4) managed by another A2R instance.
- **Pattern:** "A2R-on-A2R".
- **Requirements:**
    - Stable MicroVM substrate.
    - Multi-tenant networking logic.

---

### 3. Phase 3: Global Fabric
- **Goal:** Decentralized hosting across multiple cloud providers (Hetzner, AWS, local).
- **Mechanism:** The Swarm Scheduler (N7) distributes execution units across registered A2R Nodes.
- **Identity:** Use OIDC/JWT for cross-node authentication (N6).

---

### 4. Implementation Steps
1.  **Standardize CLI:** Ensure `a2r` CLI can spawn a full stack from a single `a2r.yaml` config.
2.  **Containerize Control Plane:** Create signed OCI images for API, Registry, and Memory services.
3.  **State Replication:** Implement SQLite backup/sync for multi-node High Availability.
