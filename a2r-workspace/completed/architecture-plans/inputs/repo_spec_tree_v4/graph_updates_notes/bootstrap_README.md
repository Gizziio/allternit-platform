# A2R TaskGraph Bootstrap (graph-0001)

Generated: 2026-01-27

This directory seeds a runnable bootstrap graph for implementing Phase 0→3:

- law layer boot gates
- tasks engine parity (/install, /resume, blockedBy)
- enforcement (WIH validation, tool registry, path guards)
- memory layers + proposal + deterministic promotion + RLM policy surface

## Files

- `.a2r/graphs/graph-0001.json` — task graph
- `.a2r/wih/*.wih.json` — WIH/Beads front matter per node (redundant by design)

## Node policy

Each node:
- declares allowed tools
- declares write globs under `/.a2r/`
- declares memory packs and layers
- declares acceptance tests it must satisfy

Preset hashes are `TBD` until `/install` is implemented.
