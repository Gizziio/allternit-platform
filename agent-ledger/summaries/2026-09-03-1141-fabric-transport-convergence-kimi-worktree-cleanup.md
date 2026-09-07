# Worktree cleanup — fabric-transport-convergence

**Date:** 2026-09-03
**Session branch:** `session/fabric-transport-convergence` (deleted, was `af2403577`)
**Final state:** Merged into `main` ✅

## What was done

Session work covered the fabric-transport convergence: HUD annotation overlay and
system theming (`af2403577`). All committed work was already merged into `main`
before cleanup.

## Preserved WIP

The worktree also held a large **uncommitted** refactor (123 files): removal of the
claude `replBridge` integration and remote-control push routes, replaced by a new
`runtime/fabric` module (executor, journal, lease-authority, peer-registry,
tailscale/tunnel transports), `fabric_routes.rs` in allternit-api, and a rename of
the remote-control PWA surface to `fabric-session`. This was **not** in `main`.

Preserved as: branch `wip/fabric-transport-bridge-removal`, commit `e310b5689`,
pushed to origin. Safe to recover from there if the bridge-removal direction is
still wanted.

## Outstanding work

- Decide whether the fabric-session rename / bridge removal should be finished and
  merged, or abandoned (main still carries the full claude bridge).
