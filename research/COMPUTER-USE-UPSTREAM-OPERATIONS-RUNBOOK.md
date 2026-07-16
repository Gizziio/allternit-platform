# Computer Use Upstream Operations Runbook

Run monthly and before every computer-use release.

1. Fetch the pinned `injaneity/pi-computer-use` and `trycua/cua` commits into a
   disposable checkout. Record new upstream commits, releases, advisories,
   licenses, dependency-license changes, telemetry changes, and schema changes
   in the source ledger. Never update a pin implicitly.
2. Re-run source and dependency license review. AGPL or network-service
   dependencies remain opt-in and process-isolated unless legal review changes
   the policy. Verify upstream telemetry remains disabled in Allternit-managed
   child processes.
3. Compare Cua Driver manifest/actions and Cua Sandbox interfaces against the
   canonical provider manifests. Reduce advertised capability immediately when
   a guarantee cannot be proven; capability additions require measured evidence.
4. Scan packaged Python, Node, Rust, VM-image, and container dependencies. Image
   digests are immutable and require a new clean scan attestation before use.
5. Run contract/conformance tests, state-scope/stale-write tests, policy and
   approval tests, provider-specific cells, and applicable Cua-Bench, OSWorld,
   ScreenSpot, Windows Arena, and Allternit safety cases in isolated environments.
6. Require at least three measured repetitions and a passing evidence gate per
   provider capability cell. Mock, demo, or manually edited grades cannot promote
   a route.
7. Stage signed daemon/provider artifacts. Verify provider discovery, native
   permissions, observation, a read-only shadow comparison, receipts, trajectory
   export, and daemon health. Roll back automatically if health or invariants fail.
8. Preserve the prior signed version and database backup through the deprecation
   window. Record owner, findings, decisions, gate evidence, and next review date.

Emergency response: disable the affected provider cell in capability discovery,
retain honest diagnostics, revoke exposed credentials, preserve evidence, and
ship a signed rollback. Never route to global input or host execution as a hidden
availability fallback.
