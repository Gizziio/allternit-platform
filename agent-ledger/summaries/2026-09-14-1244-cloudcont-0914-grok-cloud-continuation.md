# Attestation — session/cloudcont-0914: Cloud continuation (Cowork E6)

- **Date:** 2026-09-14
- **Agent:** grok
- **PR:** #521 — merged to main `66480c77af058acefcd50416c92b204da78c108c`
- **Phase:** Cloud continuation of in-flight A:// work when the laptop worker dies

## What was done

Jobs that opt in require `compute.cloud` and are claimable only by
`a://workspace/{ws}/principal/gizzi-cloud`, not the laptop `gizzi`
(`compute.local`).

- Preference `cloud_continuation` on `/cowork-preferences`; Al chat and
  routine fires pick up `compute: { policy: "cloud" }` when it is on.
- Handoff: `POST /fabric/transport/jobs/:id/continue-in-cloud`,
  `…/runs/:id/continue-in-cloud`, `…/continuation/handoff-all`.
  Drops the local lease, strips `compute.local`, records
  `continuation.handed_off`.
- Desktop `before-quit` calls handoff-all while the local API is still up.
- Ingest: `POST /fabric/transport/continuation/ingest` on an always-on
  data-plane. `gizzi-code fabric-worker --compute-mode cloud`.

## Verification

- `cargo test -p allternit-cowork-runtime --test compute_placement_tests` 8/8
  (laptop worker refused after handoff; cloud principal claims; terminal
  jobs refused)
- `cargo check -p allternit-api --lib` clean

## Honest deferrals

- Local granted folders do not upload. Cloud worker uses
  `ALLTERNIT_CLOUD_WORKSPACE` on the always-on host.
- Laptop-closed **schedules** still need an always-on API (paired VPS /
  provisioned data-plane). A sleeping desktop sidecar cannot tick routines.
- No live always-on worker was provisioned in this pass — operator starts
  `gizzi-code fabric-worker --compute-mode cloud` against that API.
