# Vendored: allternitos-cloud-contracts

This crate is **vendored** from the private `Gizziio/AllternitOS` monorepo so
that this repository (and CI) can build without a second checkout.

- **Source:** `fabric/os/cloud-contracts` in https://github.com/Gizziio/AllternitOS
- **Upstream rev:** `1a7be05` (2026-09-03)
- **Why vendored:** the previous root `Cargo.toml` path dep
  (`../../AllternitOS/fabric/os/cloud-contracts`) escaped the repo, which
  broke `cargo metadata`/`cargo build` in CI
  (`deploy-cloud-api-contabo.yml`, 5 consecutive failures). A `git =` dep was
  rejected because the AllternitOS repo is private and CI has no credentials
  for it.

## Updating

When the canonical contracts change upstream, copy the crate contents here
again and bump the "Upstream rev" above. Authority remains AllternitOS —
this copy must not be edited independently.
