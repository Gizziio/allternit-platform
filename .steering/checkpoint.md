# Checkpoint — session/cu26-realmodel-rerun

Goal: verify F1 (observation-disconnect fix, PR #480) delivers batch turn savings
end-to-end with gpt-6-astra via the codex-CLI brain path; same 5 tasks as cu22.

Just did:
- Worktree allternit-cu26 from origin/main (branch session/cu26-realmodel-rerun)
- Adapted cu22 harness → tmp-cu26-realmodel/ (3 arms: per-step / batched+f1 /
  batched+pre-f1 via client-side observation strip; own ports 18081/9223/18113;
  cu22 shims dropped — F2/F3 landed product-side; codex CLI auth verified live)
- cargo build -p allternit-api running in background (pid 64793, task bash-joxbrnkn)

Next: start site :18081 + Chrome CDP :9223; a_smoke real-model check; run arms;
safety.md update; PR/merge/attestation/cleanup.

Open questions: none — cu22 evidence + cu24 attestation are the comparators.
