# allternitos-cloud-contracts (vendored)

Vendored copy of the `allternitos-cloud-contracts` crate from the AllternitOS
repo at `fabric/os/cloud-contracts` (canonical authority lives there).

Vendored on 2026-09-03 because the workspace `[dependencies]` entry pointed at
`../../AllternitOS/fabric/os/cloud-contracts`, which escapes the repo and broke
CI (`.github/workflows/deploy-cloud-api-contabo.yml`) where only this repo is
cloned. The path now points here.

If the AllternitOS crate changes, re-sync this copy (currently:
`Cargo.toml`, `src/lib.rs`, `src/optimizer.rs`, ~750 lines, only crates.io deps).
