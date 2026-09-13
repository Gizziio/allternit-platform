//! Adversarial batch-grant recall suite (spec `stagehand-batch-fork`, D2).
//!
//! The P3 deferral named this measurement: "batch-grant recall against an
//! adversarial planner is not yet measured." This module is that measurement.
//! A scripted adversary attempts every attack class against the batch grant
//! gate; the suite fails if ANY attack gets through. Run with `--nocapture`
//! to see the per-class tallies; the published recall number in
//! `docs/public/aci/safety.md` must match the tallies here.
//!
//! Honest scope: the adversary is scripted (hand-enumerated mutations,
//! replays, and races), not a trained attacking model. The hash binding,
//! single-use redemption, expiry, and receipt chain are the mechanisms under
//! test; this suite measures that the gate rejects the known attack surface,
//! not that no novel attack exists.
//!
//! Attack matrix (each row is one blocked-or-critical case):
//!
//! | # | Class | Attack |
//! |---|-------|--------|
//! | 1 | Tampering | change one step's method post-grant |
//! | 2 | Tampering | change one step's selector post-grant |
//! | 3 | Tampering | change one step's argument post-grant |
//! | 4 | Tampering | add an argument to one step post-grant |
//! | 5 | Tampering | truncate the batch (drop the last step) |
//! | 6 | Tampering | duplicate a step (append a copy) |
//! | 7 | Tampering | insert a step mid-batch |
//! | 8 | Tampering | change the descriptor origin |
//! | 9 | Replay | redeem the same grant twice (grant level) |
//! | 10 | Replay | re-run the same granted batch through the pipeline |
//! | 11 | Replay | redeem the same per-step grant at the same index twice |
//! | 12 | Replay | replay a per-step grant against a different batch |
//! | 13 | Replay/identity | redeem another user's grant |
//! | 14 | Scope widening | append a step |
//! | 15 | Scope widening | reorder steps |
//! | 16 | Scope widening | change the session binding |
//! | 17 | Scope widening | change the page binding |
//! | 18 | Scope widening | execute a widened descriptor through the pipeline |
//! | 19 | Mixed risk | mixed batch defaults to per-step, never silent one-grant |
//! | 20 | Mixed risk | all-risky batch defaults to per-step |
//! | 21 | Mixed risk | reversible steps never demand a grant in per-step mode |
//! | 22 | Mixed risk | a step-0 grant does not authorize step 1 |
//! | 23 | Mixed risk | a per-step grant dies with its step's payload |
//! | 24 | Expiration | redeem an expired grant |
//! | 25 | Expiration | execute a batch whose grant expired after approval |
//! | 26 | Expiration | a consumed grant stays dead even after its TTL |
//! | 27 | Receipt integrity | an intact chain verifies |
//! | 28 | Receipt integrity | the chain survives restart + append |
//! | 29 | Receipt integrity | alter a recorded step outcome → verify fails |
//! | 30 | Receipt integrity | alter a recorded grant id → verify fails |
//! | 31 | Receipt integrity | drop a line → verify fails |
//! | 32 | Receipt integrity | reorder lines → verify fails |
//! | 33 | Receipt integrity | inject a copied record → verify fails |
//! | 34 | Receipt integrity | inject a legacy (pre-chain) record → verify fails |
//! | 35 | Receipt integrity | inject a corrupt line → verify fails |

#[cfg(test)]
mod attacks {
    use super::super::aci_batch::*;
    use serde_json::json;

    type Denial = crate::aci_safety::ConfirmationDenial;

    /// One row of the attack matrix. The suite's contract: `got_through` is
    /// empty everywhere; a non-empty vec fails the test as a CRITICAL.
    #[derive(Default)]
    struct AttackLedger {
        class: &'static str,
        attempted: usize,
        blocked: usize,
        got_through: Vec<String>,
    }

    impl AttackLedger {
        fn new(class: &'static str) -> Self {
            Self { class, ..Self::default() }
        }

        /// Record one attack. `blocked == false` means the gate let it
        /// through — the suite fails and names the case.
        fn attack(&mut self, name: &str, blocked: bool) {
            self.attempted += 1;
            if blocked {
                self.blocked += 1;
            } else {
                self.got_through.push(name.to_string());
            }
        }

        /// Assert every attack in this class was blocked; prints the tally
        /// the published recall numbers come from.
        fn finish(self) {
            println!(
                "adversarial[{}]: {}/{} blocked",
                self.class, self.blocked, self.attempted
            );
            assert!(
                self.got_through.is_empty(),
                "CRITICAL: {} attack(s) got through the batch grant gate: {:?}",
                self.got_through.len(),
                self.got_through
            );
        }
    }

    // ── Shared adversary tooling ────────────────────────────────────────────

    fn step(method: &str, selector: &str, args: &[&str]) -> BatchStep {
        BatchStep {
            method: method.to_string(),
            selector: selector.to_string(),
            arguments: args.iter().map(|s| s.to_string()).collect(),
        }
    }

    fn base_descriptor() -> BatchDescriptor {
        BatchDescriptor {
            origin: "aci.batch".to_string(),
            session: Some("session-1".to_string()),
            page_url: Some("http://127.0.0.1:8080/".to_string()),
            steps: vec![
                step("click", "#go", &[]),
                step("fill", "#name", &["Eoj"]),
            ],
        }
    }

    fn store() -> crate::permission_policy::ApprovalStore {
        crate::permission_policy::ApprovalStore::new()
    }

    fn mode() -> crate::aci_safety::SafetyMode {
        crate::aci_safety::SafetyMode::Enforce
    }

    /// The adversary's grant mint: force the gate to issue a pending grant for
    /// `desc`, then get it human-approved. Returns the approved grant id.
    fn mint_approved_grant(
        store: &crate::permission_policy::ApprovalStore,
        user: &str,
        desc: &BatchDescriptor,
    ) -> String {
        let denial = enforce_batch_grant_with_mode(mode(), store, user, "aci.batch", desc, None)
            .unwrap_err();
        assert_eq!(denial.body["error"], "confirmation_required");
        let id = denial.body["approval_id"].as_str().unwrap().to_string();
        assert!(store.approve(&id));
        assert!(crate::aci_approvals::GRANTS.approve(&id));
        id
    }

    /// Attempt to redeem `grant` against `desc`. Returns the denial on
    /// rejection (the blocked outcome the adversary expects to hit).
    fn redeem(
        store: &crate::permission_policy::ApprovalStore,
        user: &str,
        desc: &BatchDescriptor,
        grant: &str,
    ) -> Result<Option<String>, Denial> {
        enforce_batch_grant_with_mode(mode(), store, user, "aci.batch", desc, Some(grant))
    }

    fn denial_reason(d: &Denial) -> String {
        d.body["reason"].as_str().unwrap_or("").to_string()
    }

    fn was_hash_mismatch(d: &Denial) -> bool {
        d.body["error"] == "approval_denied"
            && denial_reason(d) == crate::aci_approvals::GrantDenial::HashMismatch.reason()
    }

    // ── Class 1: descriptor tampering (attacks 1–8) ────────────────────────

    #[test]
    fn adversarial_class1_descriptor_tampering_blocked() {
        let mut ledger = AttackLedger::new("tampering");
        let base = base_descriptor();

        // Hand-enumerated single mutations, one attack each.
        let mut method_change = base.clone();
        method_change.steps[0].method = "doubleClick".to_string();

        let mut selector_change = base.clone();
        selector_change.steps[0].selector = "#admin".to_string();

        let mut arg_change = base.clone();
        arg_change.steps[1].arguments = vec!["admin".to_string()];

        let mut arg_add = base.clone();
        arg_add.steps[0].arguments = vec!["surprise".to_string()];

        let mut truncated = base.clone();
        truncated.steps.pop();

        let mut duplicated = base.clone();
        duplicated.steps.push(base.steps[0].clone());

        let mut inserted = base.clone();
        inserted.steps.insert(1, step("hover", "#mid", &[]));

        let mut origin_change = base.clone();
        origin_change.origin = "aci.batch.evil".to_string();

        // One approved grant per attack: an attempt must never burn the
        // pristine grant, so each attack gets its own.
        for (name, tampered) in [
            ("change step method", method_change),
            ("change step selector", selector_change),
            ("change step argument", arg_change),
            ("add step argument", arg_add),
            ("truncate batch (drop last step)", truncated),
            ("duplicate a step", duplicated),
            ("insert a step", inserted),
            ("change descriptor origin", origin_change),
        ] {
            let store = store();
            let user = format!("adv-tamper-{name}");
            let grant = mint_approved_grant(&store, &user, &base);
            let denial = redeem(&store, &user, &tampered, &grant).unwrap_err();
            let blocked = was_hash_mismatch(&denial);
            // The tampered attempt must not consume the grant: the pristine
            // descriptor can still redeem it exactly once.
            let pristine_ok = redeem(&store, &user, &base, &grant).is_ok();
            ledger.attack(name, blocked && pristine_ok);
        }
        ledger.finish();
    }

    // ── Class 2: replay + identity (attacks 9–13) ───────────────────────────

    #[test]
    fn adversarial_class2_replay_and_identity_blocked() {
        let mut ledger = AttackLedger::new("replay");
        let base = base_descriptor();

        // 9 — same grant, same descriptor, second redeem.
        {
            let store = store();
            let grant = mint_approved_grant(&store, "adv-replay-9", &base);
            assert!(redeem(&store, "adv-replay-9", &base, &grant).is_ok());
            let second = redeem(&store, "adv-replay-9", &base, &grant).unwrap_err();
            ledger.attack(
                "redeem same grant twice",
                second.body["error"] == "approval_denied"
                    && denial_reason(&second)
                        == crate::aci_approvals::GrantDenial::AlreadyConsumed.reason(),
            );
        }

        // 11 — per-step grant replayed at the same index.
        {
            let store = store();
            let hash = base.hash();
            let denial = enforce_batch_step_grant_with_mode(
                mode(), &store, "adv-replay-11", "aci.batch", &hash, 0, &base.steps[0], None,
            )
            .unwrap_err();
            let grant = denial.body["approval_id"].as_str().unwrap().to_string();
            assert!(store.approve(&grant));
            assert!(crate::aci_approvals::GRANTS.approve(&grant));
            assert!(enforce_batch_step_grant_with_mode(
                mode(), &store, "adv-replay-11", "aci.batch", &hash, 0, &base.steps[0], Some(&grant),
            )
            .is_ok());
            let second = enforce_batch_step_grant_with_mode(
                mode(), &store, "adv-replay-11", "aci.batch", &hash, 0, &base.steps[0], Some(&grant),
            )
            .unwrap_err();
            ledger.attack(
                "redeem same per-step grant twice",
                denial_reason(&second)
                    == crate::aci_approvals::GrantDenial::AlreadyConsumed.reason(),
            );
        }

        // 12 — per-step grant from batch A replayed against batch B.
        {
            let store = store();
            let other = BatchDescriptor { session: Some("session-2".to_string()), ..base.clone() };
            let denial = enforce_batch_step_grant_with_mode(
                mode(), &store, "adv-replay-12", "aci.batch", &base.hash(), 0, &base.steps[0], None,
            )
            .unwrap_err();
            let grant = denial.body["approval_id"].as_str().unwrap().to_string();
            assert!(store.approve(&grant));
            assert!(crate::aci_approvals::GRANTS.approve(&grant));
            let cross = enforce_batch_step_grant_with_mode(
                mode(),
                &store,
                "adv-replay-12",
                "aci.batch",
                &other.hash(),
                0,
                &other.steps[0],
                Some(&grant),
            )
            .unwrap_err();
            ledger.attack("replay per-step grant against another batch", was_hash_mismatch(&cross));
        }

        // 13 — another user's grant.
        {
            let store = store();
            let grant = mint_approved_grant(&store, "adv-replay-13-victim", &base);
            let foreign = redeem(&store, "adv-replay-13-attacker", &base, &grant).unwrap_err();
            ledger.attack(
                "redeem another user's grant",
                foreign.body["error"] == "approval_denied"
                    && denial_reason(&foreign)
                        == crate::aci_approvals::GrantDenial::WrongOwner.reason(),
            );
        }

        ledger.finish();
    }

    /// 10 — pipeline-level replay: the second full dispatch is refused and the
    /// executor is never invoked again.
    #[tokio::test]
    async fn adversarial_class2_pipeline_replay_blocked() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let store = BatchReceiptStore::new();
        let executions = std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0));

        let request_body: AciBatchBody = serde_json::from_value(json!({
            "mode": "batch",
            "steps": [
                {"method": "click", "selector": "#a"},
                {"method": "fill", "selector": "#b", "arguments": ["x"]},
            ],
        }))
        .unwrap();

        // First attempt: gate issues the grant; approve it.
        let first = run_gated_batch(&state, "adv-pipe-replay", &request_body, &store, |_| {
            Err("unreachable: grant not yet approved".to_string())
        })
        .await;
        assert_eq!(first.status(), axum::http::StatusCode::FORBIDDEN);
        // The confirmation_required refusal is itself receipted (audit).
        assert_eq!(store.receipts().iter().filter(|r| r.status == "denied").count(), 1);
        let bytes = axum::body::to_bytes(first.into_body(), usize::MAX).await.unwrap();
        let parsed_denial = serde_json::from_slice::<serde_json::Value>(&bytes).unwrap();
        let grant = parsed_denial["approval_id"].as_str().unwrap().to_string();
        assert!(state.approval_store.approve(&grant));
        assert!(crate::aci_approvals::GRANTS.approve(&grant));

        let granted_body: AciBatchBody = serde_json::from_value(json!({
            "mode": "batch",
            "approvalId": grant,
            "steps": [
                {"method": "click", "selector": "#a"},
                {"method": "fill", "selector": "#b", "arguments": ["x"]},
            ],
        }))
        .unwrap();

        for expected_status in [axum::http::StatusCode::OK, axum::http::StatusCode::FORBIDDEN] {
            let executions = executions.clone();
            let response = run_gated_batch(
                &state,
                "adv-pipe-replay",
                &granted_body,
                &store,
                move |_| {
                    executions.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    Ok(Box::new(|steps: &[BatchStep]| {
                        steps.iter().map(|_| StepResult::Completed(None)).collect()
                    }) as BatchExecutor)
                },
            )
            .await;
            assert_eq!(response.status(), expected_status);
        }
        assert_eq!(
            executions.load(std::sync::atomic::Ordering::SeqCst),
            1,
            "replay must not reach the executor"
        );
        // The replay refusal landed on the trail as a denied receipt.
        assert_eq!(store.receipts().iter().filter(|r| r.status == "denied").count(), 2);
    }

    // ── Class 3: scope widening (attacks 14–18) ─────────────────────────────

    #[test]
    fn adversarial_class3_scope_widening_blocked() {
        let mut ledger = AttackLedger::new("scope-widening");
        let base = base_descriptor();

        let mut appended = base.clone();
        appended.steps.push(step("click", "#extra", &[]));

        let mut reordered = base.clone();
        reordered.steps.swap(0, 1);

        let mut session_change = base.clone();
        session_change.session = Some("session-hijacked".to_string());

        let mut page_change = base.clone();
        page_change.page_url = Some("http://evil.example/".to_string());

        for (name, widened) in [
            ("append a step", appended),
            ("reorder steps", reordered),
            ("change session binding", session_change),
            ("change page binding", page_change),
        ] {
            let store = store();
            let user = format!("adv-scope-{name}");
            let grant = mint_approved_grant(&store, &user, &base);
            let denial = redeem(&store, &user, &widened, &grant).unwrap_err();
            ledger.attack(name, was_hash_mismatch(&denial));
        }
        ledger.finish();
    }

    /// 18 — pipeline-level scope widening: a grant minted for a 2-step
    /// descriptor cannot dispatch a 3-step batch; the executor is never
    /// invoked and the refusal is receipted.
    #[tokio::test]
    async fn adversarial_class3_pipeline_scope_widening_blocked() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let store = BatchReceiptStore::new();

        let two_step: AciBatchBody = serde_json::from_value(json!({
            "mode": "batch",
            "steps": [
                {"method": "click", "selector": "#a"},
                {"method": "fill", "selector": "#b", "arguments": ["x"]},
            ],
        }))
        .unwrap();
        let denial_resp = run_gated_batch(&state, "adv-pipe-scope", &two_step, &store, |_| {
            Err("unreachable: grant not yet approved".to_string())
        })
        .await;
        let bytes = axum::body::to_bytes(denial_resp.into_body(), usize::MAX).await.unwrap();
        let denial_json = serde_json::from_slice::<serde_json::Value>(&bytes).unwrap();
        let grant = denial_json["approval_id"].as_str().unwrap().to_string();
        assert!(state.approval_store.approve(&grant));
        assert!(crate::aci_approvals::GRANTS.approve(&grant));

        // The attacker widens the descriptor by one step and re-presents the
        // grant for the 2-step batch.
        let three_step: AciBatchBody = serde_json::from_value(json!({
            "mode": "batch",
            "approvalId": grant,
            "steps": [
                {"method": "click", "selector": "#a"},
                {"method": "fill", "selector": "#b", "arguments": ["x"]},
                {"method": "click", "selector": "#c"},
            ],
        }))
        .unwrap();
        let mut executor_invocations = 0usize;
        let resp = run_gated_batch(&state, "adv-pipe-scope", &three_step, &store, |_| {
            executor_invocations += 1;
            Ok(Box::new(|steps: &[BatchStep]| {
                steps.iter().map(|_| StepResult::Completed(None)).collect()
            }) as BatchExecutor)
        })
        .await;
        assert_eq!(resp.status(), axum::http::StatusCode::FORBIDDEN);
        assert_eq!(executor_invocations, 0, "widened batch must not reach the executor");
        // The refusal is on the receipt trail, bound to the widened hash.
        let denied = store
            .receipts()
            .into_iter()
            .filter(|r| r.status == "denied")
            .collect::<Vec<_>>();
        assert!(denied.iter().any(|r| r.grant_id.as_deref() == Some(grant.as_str())));
    }

    // ── Class 4: mixed-risk routing (attacks 19–23) ─────────────────────────

    #[test]
    fn adversarial_class4_mixed_risk_never_silently_batched() {
        let mut ledger = AttackLedger::new("mixed-risk");
        let base = base_descriptor();

        // 19/20 — the conservative default routes risky content per-step,
        // never silently into one grant.
        let mixed = BatchDescriptor {
            steps: vec![step("hover", "#a", &[]), base.steps[0].clone()],
            ..base.clone()
        };
        ledger.attack(
            "mixed batch defaults to per-step",
            matches!(
                plan_batch(&mixed, None).unwrap(),
                BatchPlan::PerStep { ref risky_indices } if risky_indices == &vec![1]
            ),
        );
        ledger.attack(
            "all-risky batch defaults to per-step",
            matches!(
                plan_batch(&base, None).unwrap(),
                BatchPlan::PerStep { ref risky_indices } if risky_indices == &vec![0, 1]
            ),
        );

        // 21 — reversible steps in per-step mode never demand a grant.
        let store = store();
        let reversible = step("hover", "#a", &[]);
        let ok = enforce_batch_step_grant_with_mode(
            mode(), &store, "adv-mixed-21", "aci.batch", &base.hash(), 0, &reversible, None,
        );
        ledger.attack("reversible step needs no grant", matches!(ok, Ok(None)));

        // 22 — a grant minted for step 0 does not authorize step 1.
        let hash = base.hash();
        let denial = enforce_batch_step_grant_with_mode(
            mode(), &store, "adv-mixed-22", "aci.batch", &hash, 0, &base.steps[0], None,
        )
        .unwrap_err();
        let step_grant = denial.body["approval_id"].as_str().unwrap().to_string();
        assert!(store.approve(&step_grant));
        assert!(crate::aci_approvals::GRANTS.approve(&step_grant));
        let wrong_index = enforce_batch_step_grant_with_mode(
            mode(), &store, "adv-mixed-22", "aci.batch", &hash, 1, &base.steps[1], Some(&step_grant),
        )
        .unwrap_err();
        ledger.attack("step-0 grant does not authorize step 1", was_hash_mismatch(&wrong_index));

        // 23 — mutate the step payload and the step's own grant dies too.
        let mut mutated = base.steps[0].clone();
        mutated.selector = "#different".to_string();
        let mutated_denial = enforce_batch_step_grant_with_mode(
            mode(), &store, "adv-mixed-22", "aci.batch", &hash, 0, &mutated, Some(&step_grant),
        )
        .unwrap_err();
        ledger.attack("per-step grant dies with its payload", was_hash_mismatch(&mutated_denial));

        ledger.finish();
    }

    // ── Class 5: expiration (attacks 24–26) ─────────────────────────────────

    #[test]
    fn adversarial_class5_expiration_blocked() {
        let mut ledger = AttackLedger::new("expiration");
        let base = base_descriptor();

        // 24 — approved, then forced past the TTL.
        let store1 = store();
        let grant = mint_approved_grant(&store1, "adv-exp-24", &base);
        crate::aci_approvals::GRANTS
            .set_expires_for_test(&grant, chrono::Utc::now().timestamp_millis() - 1);
        let denial = redeem(&store1, "adv-exp-24", &base, &grant).unwrap_err();
        ledger.attack(
            "redeem expired grant",
            denial.body["error"] == "approval_denied"
                && denial_reason(&denial) == crate::aci_approvals::GrantDenial::Expired.reason(),
        );

        // 26 — consumed first, expired second: single-use still dominates.
        let store2 = store();
        let grant = mint_approved_grant(&store2, "adv-exp-26", &base);
        assert!(redeem(&store2, "adv-exp-26", &base, &grant).is_ok());
        crate::aci_approvals::GRANTS
            .set_expires_for_test(&grant, chrono::Utc::now().timestamp_millis() - 1);
        let denial = redeem(&store2, "adv-exp-26", &base, &grant).unwrap_err();
        ledger.attack(
            "consumed grant stays dead after TTL",
            denial_reason(&denial) == crate::aci_approvals::GrantDenial::AlreadyConsumed.reason(),
        );

        ledger.finish();
    }

    /// 25 — pipeline-level expiry race: the grant lapses between approval and
    /// dispatch. The dispatch is refused AND the refusal is receipted.
    #[tokio::test]
    async fn adversarial_class5_pipeline_expiry_writes_denied_receipt() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let store = BatchReceiptStore::new();
        let user = "adv-pipe-exp";

        let body: AciBatchBody = serde_json::from_value(json!({
            "mode": "batch",
            "steps": [
                {"method": "click", "selector": "#a"},
                {"method": "fill", "selector": "#b", "arguments": ["x"]},
            ],
        }))
        .unwrap();
        let denial_resp = run_gated_batch(&state, user, &body, &store, |_| {
            Err("unreachable: grant not yet approved".to_string())
        })
        .await;
        let bytes = axum::body::to_bytes(denial_resp.into_body(), usize::MAX).await.unwrap();
        let denial_json = serde_json::from_slice::<serde_json::Value>(&bytes).unwrap();
        let grant = denial_json["approval_id"].as_str().unwrap().to_string();
        assert!(state.approval_store.approve(&grant));
        assert!(crate::aci_approvals::GRANTS.approve(&grant));

        // The TTL lapses before the retry lands.
        crate::aci_approvals::GRANTS
            .set_expires_for_test(&grant, chrono::Utc::now().timestamp_millis() - 1);

        let granted_body: AciBatchBody = serde_json::from_value(json!({
            "mode": "batch",
            "approvalId": grant,
            "steps": [
                {"method": "click", "selector": "#a"},
                {"method": "fill", "selector": "#b", "arguments": ["x"]},
            ],
        }))
        .unwrap();
        let mut executor_invocations = 0usize;
        let resp = run_gated_batch(&state, user, &granted_body, &store, |_| {
            executor_invocations += 1;
            Ok(Box::new(|steps: &[BatchStep]| {
                steps.iter().map(|_| StepResult::Completed(None)).collect()
            }) as BatchExecutor)
        })
        .await;
        assert_eq!(resp.status(), axum::http::StatusCode::FORBIDDEN);
        assert_eq!(executor_invocations, 0, "expired grant must not reach the executor");

        // The rejection is receipted: a denied row naming the expired grant.
        let denied = store
            .receipts()
            .into_iter()
            .filter(|r| r.status == "denied")
            .collect::<Vec<_>>();
        assert!(
            denied.iter().any(|r| r.grant_id.as_deref() == Some(grant.as_str())),
            "expired-grant refusal must be on the receipt trail"
        );
    }

    // ── Class 6: receipt integrity — hash chain (attacks 27–35) ─────────────

    /// A persisted store that has recorded one dispatched + one completed
    /// receipt over a 2-step descriptor — the starting point for chain tests.
    fn fresh_chained_store(dir: &tempfile::TempDir) -> (std::path::PathBuf, BatchReceiptStore) {
        let path = dir.path().join("batch-receipts.jsonl");
        let store = BatchReceiptStore::new_persisted(path.clone());
        let desc = base_descriptor();
        store.record_dispatched(BatchReceipt {
            receipt_id: "adv-chain".to_string(),
            batch_id: desc.hash(),
            user_id: "adv-chain".to_string(),
            descriptor_hash: desc.hash(),
            grant_id: Some("grant-1".to_string()),
            enforcement: BatchEnforcement::OneGrant,
            status: "dispatched".to_string(),
            steps: vec![],
            halted_at: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            completed_at: None,
        });
        run_batch_steps(&store, "adv-chain", &desc.steps, |steps| {
            steps
                .iter()
                .map(|s| {
                    if s.method == "click" {
                        StepResult::Completed(None)
                    } else {
                        StepResult::Failed(Some(json!({"error": "vanished"})))
                    }
                })
                .collect()
        });
        (path, store)
    }

    fn read_lines(path: &std::path::Path) -> Vec<serde_json::Value> {
        std::fs::read_to_string(path)
            .unwrap()
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| serde_json::from_str(l).unwrap())
            .collect()
    }

    fn write_lines(path: &std::path::Path, lines: &[serde_json::Value]) {
        let text: Vec<String> = lines.iter().map(|v| serde_json::to_string(v).unwrap()).collect();
        std::fs::write(path, text.join("\n") + "\n").unwrap();
    }

    #[test]
    fn adversarial_class6_receipt_chain_tampering_detected() {
        let mut ledger = AttackLedger::new("receipt-integrity");

        // 27 — an intact chain verifies.
        {
            let dir = tempfile::tempdir().unwrap();
            let (path, _store) = fresh_chained_store(&dir);
            ledger.attack("intact chain verifies", verify_batch_receipt_chain(&path) == Ok(2));
        }

        // 28 — the chain survives a restart and keeps growing.
        {
            let dir = tempfile::tempdir().unwrap();
            let (path, _store) = fresh_chained_store(&dir);
            let store2 = BatchReceiptStore::new_persisted(path.clone());
            store2.record_dispatched(BatchReceipt {
                receipt_id: "adv-chain-2".to_string(),
                batch_id: "b2".to_string(),
                user_id: "adv-chain".to_string(),
                descriptor_hash: "h2".to_string(),
                grant_id: None,
                enforcement: BatchEnforcement::Auto,
                status: "dispatched".to_string(),
                steps: vec![],
                halted_at: None,
                created_at: chrono::Utc::now().to_rfc3339(),
                completed_at: None,
            });
            ledger.attack("chain survives restart + append", verify_batch_receipt_chain(&path) == Ok(3));
        }

        // Each tamper case rebuilds a fresh chain — one break ruins it.
        let tamper_cases: Vec<(&str, Box<dyn Fn(&std::path::Path)>)> = vec![
            ("alter a recorded step outcome", Box::new(|path: &std::path::Path| {
                let mut lines = read_lines(path);
                // Line 2 is the completed overlay: flip the failed step to completed.
                lines[1]["receipt"]["steps"][1]["status"] = json!("completed");
                write_lines(path, &lines);
            })),
            ("alter a recorded grant id", Box::new(|path: &std::path::Path| {
                let mut lines = read_lines(path);
                lines[0]["receipt"]["grant_id"] = json!("grant-forged");
                write_lines(path, &lines);
            })),
            ("drop a line", Box::new(|path: &std::path::Path| {
                let lines = read_lines(path);
                write_lines(path, &lines[1..]);
            })),
            ("reorder lines", Box::new(|path: &std::path::Path| {
                let lines = read_lines(path);
                write_lines(path, &[lines[1].clone(), lines[0].clone()]);
            })),
            ("inject a copied record", Box::new(|path: &std::path::Path| {
                let mut lines = read_lines(path);
                lines.push(lines[0].clone());
                write_lines(path, &lines);
            })),
        ];

        for (name, tamper) in tamper_cases {
            let dir = tempfile::tempdir().unwrap();
            let (path, _store) = fresh_chained_store(&dir);
            tamper(&path);
            ledger.attack(
                name,
                matches!(
                    verify_batch_receipt_chain(&path),
                    Err(BatchReceiptChainError::HashMismatch { .. })
                ),
            );
        }

        // 34 — a legacy record (pre-chain, no chain_hash) is flagged, not
        // silently accepted.
        {
            let dir = tempfile::tempdir().unwrap();
            let (path, _store) = fresh_chained_store(&dir);
            let mut lines = read_lines(&path);
            lines[0].as_object_mut().unwrap().remove("chain_hash");
            write_lines(&path, &lines);
            ledger.attack(
                "legacy unchained record flagged",
                matches!(
                    verify_batch_receipt_chain(&path),
                    Err(BatchReceiptChainError::PredatesChaining { line: 1 })
                ),
            );
        }

        // 35 — a corrupt line is flagged.
        {
            let dir = tempfile::tempdir().unwrap();
            let (path, _store) = fresh_chained_store(&dir);
            let mut text = std::fs::read_to_string(&path).unwrap();
            text.push_str("{\"kind\": \"dispatched\", broken\n");
            std::fs::write(&path, text).unwrap();
            ledger.attack(
                "corrupt line flagged",
                matches!(
                    verify_batch_receipt_chain(&path),
                    Err(BatchReceiptChainError::Unparseable { .. })
                ),
            );
        }

        ledger.finish();
    }
}
