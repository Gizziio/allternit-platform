# Attestation — session fix/pair-url-default (pairing verification URL)

- Date: 2026-09-10
- Agent family: kimi (orchestrator-implemented)
- Branch: `fix/pair-url-default` → PR #239
- Queue: P3 follow-up bug (platform)

## What was done

`runtime_pairing.rs` built the device-approval link as
`$ALLTERNIT_PLATFORM_URL/pair?code=…` with default
`https://platform.allternit.com` — but the approval page that handles
`?code=` lives at **ai.allternit.com/pair**. No deploy config sets the env
var, so the wrong default is what production serves: CLI users following the
printed approval link landed on a page that cannot approve their code.

One-line fix: default → `https://ai.allternit.com`. Env override unchanged.

## Verification

- `cargo check -p allternit-cloud-api` clean (6 pre-existing warnings
  untouched).
- Live `https://ai.allternit.com/pair?code=…` approval flow proven during P3
  pairing (runtime `rt_af9d675b04b2` approved through that page).
- Deploy note: cloud-api must be redeployed for this to reach production;
  until then, existing pairings are unaffected (they used the same wrong link
  and still worked when users manually went to ai.allternit.com/pair).

## Honest deferrals

- Not redeployed by this session (deploys are human-approved per harness
  rules).
