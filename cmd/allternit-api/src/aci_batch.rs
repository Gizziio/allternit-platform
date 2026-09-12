//! Batch grant gate — one hash-bound grant per ordered batch of whitelisted
//! browser actions (spec: `stagehand-batch-fork`, phase P1).
//!
//! Today every computer-use action carries its own grant: `aci_safety`
//! enforces `enforce_confirmation` per action before dispatch. This module
//! extends that machinery to *batches*: a canonical descriptor over
//! `{origin, session, pageUrl, ordered steps[]}` is hashed exactly like an
//! action payload (`aci_approvals::hash_action_payload`), a single
//! single-use expiring grant binds the whole batch, and one receipt records
//! the descriptor hash, grant id, per-step outcomes, and the
//! halt-at-first-failure position.
//!
//! Product boundaries (locked in the spec):
//! - Steps are constrained to the 11-action vocabulary the vendored runtime
//!   executes deterministically (`SupportedUnderstudyAction` in
//!   `allternit-browser-runtime/packages/extension/types/private/handlers.ts`).
//!   Anything outside the whitelist is rejected at descriptor validation —
//!   the model/runtime never sees it.
//! - Batching never bypasses the gate: an all-reversible batch auto-passes
//!   (same rule as per-action reversible skips); a caller requesting
//!   `mode: "batch"` gets one grant for the whole descriptor; the
//!   conservative default for anything not clearly reversible is per-step
//!   grants, decided by the same `ConfirmationClass` taxonomy as per-action
//!   enforcement.
//! - Audit-before-act: the batch receipt row is written (and persisted to
//!   the JSONL trail) BEFORE the sidecar dispatch begins.

use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use crate::{auth::AuthUser, AppState};

/// The 11-action vocabulary the vendored browser runtime executes
/// deterministically from a structured action (no model call). Keep in
/// lockstep with `SupportedUnderstudyAction` in the vendored extension.
pub const BATCH_ACTION_WHITELIST: &[&str] = &[
    "click",
    "fill",
    "type",
    "press",
    "scrollTo",
    "nextChunk",
    "prevChunk",
    "selectOptionFromDropdown",
    "hover",
    "doubleClick",
    "dragAndDrop",
];

/// Hard cap on batch length so a descriptor cannot smuggle an unbounded run
/// into one grant. The spec's batch-size-caps-by-risk-taxonomy knobs build on
/// this absolute bound.
pub const MAX_BATCH_STEPS: usize = 50;

pub fn whitelist_contains(method: &str) -> bool {
    BATCH_ACTION_WHITELIST.contains(&method)
}

/// One ordered batch step: a whitelisted method applied to an element ref
/// (CSS selector or XPath) with string arguments.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BatchStep {
    pub method: String,
    pub selector: String,
    #[serde(default)]
    pub arguments: Vec<String>,
}

/// The grantable unit: origin/session binding plus the ordered step list.
/// The SHA-256 of its canonical JSON is what a batch grant binds to — a
/// modified client cannot widen, reorder, or re-target a granted batch.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BatchDescriptor {
    pub origin: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub session: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub page_url: Option<String>,
    pub steps: Vec<BatchStep>,
}

impl BatchDescriptor {
    /// Canonical hashing payload. Field set must stay stable — adding a
    /// field changes every future hash (fine), removing or renaming one
    /// would silently widen previously granted batches (not fine).
    pub fn canonical_json(&self) -> Value {
        json!({
            "origin": self.origin,
            "session": self.session,
            "pageUrl": self.page_url,
            "steps": self.steps,
        })
    }

    /// SHA-256 over the canonical descriptor — the batch-grant binding.
    pub fn hash(&self) -> String {
        crate::aci_approvals::hash_action_payload(&self.canonical_json())
    }
}

/// Validate steps against the whitelist. Returns the reason on the first
/// violation.
pub fn validate_steps(steps: &[BatchStep]) -> Result<(), String> {
    if steps.is_empty() {
        return Err("batch descriptor must contain at least one step".to_string());
    }
    if steps.len() > MAX_BATCH_STEPS {
        return Err(format!(
            "batch descriptor has {} steps; the maximum is {}",
            steps.len(),
            MAX_BATCH_STEPS
        ));
    }
    for (i, step) in steps.iter().enumerate() {
        if !whitelist_contains(&step.method) {
            return Err(format!(
                "step {} uses method {:?} which is outside the whitelisted browser action vocabulary",
                i, step.method
            ));
        }
        if step.selector.trim().is_empty() {
            return Err(format!("step {} has an empty element selector", i));
        }
    }
    Ok(())
}

/// Classify one batch step with the same taxonomy as per-action enforcement.
/// Conservative: only clearly-transient actions count as reversible; every
/// mutating whitelisted action is risky.
pub fn classify_batch_step(step: &BatchStep) -> crate::aci_safety::ConfirmationClass {
    use crate::aci_safety::ConfirmationClass;
    match step.method.as_str() {
        "hover" | "scrollTo" | "nextChunk" | "prevChunk" => ConfirmationClass::Reversible,
        _ => ConfirmationClass::Risky,
    }
}

/// Caller-selected grant shape. Absent means "let the gate decide", and the
/// gate's conservative default for anything not clearly reversible is
/// [`BatchPlan::PerStep`].
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BatchGrantMode {
    OneGrant,
    PerStep,
}

impl BatchGrantMode {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "batch" | "one_grant" => Some(Self::OneGrant),
            "per_step" | "perStep" => Some(Self::PerStep),
            _ => None,
        }
    }
}

/// How the gate will enforce this batch.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BatchPlan {
    /// Every step is reversible: no grant, mirroring the per-action
    /// reversible skip in `enforce_confirmation`.
    Auto,
    /// One grant bound to the whole descriptor hash, enforced once before
    /// dispatch. Only reachable when the caller explicitly asks for it.
    OneGrant,
    /// Risky steps are each gated individually, in order. The conservative
    /// default whenever any step is not clearly reversible.
    PerStep { risky_indices: Vec<usize> },
}

/// Decide the enforcement plan for a descriptor. `requested` is the caller's
/// mode preference (`None` = conservative default).
pub fn plan_batch(
    descriptor: &BatchDescriptor,
    requested: Option<BatchGrantMode>,
) -> Result<BatchPlan, String> {
    validate_steps(&descriptor.steps)?;
    let all_reversible = descriptor
        .steps
        .iter()
        .all(|s| classify_batch_step(s) == crate::aci_safety::ConfirmationClass::Reversible);
    if all_reversible {
        return Ok(BatchPlan::Auto);
    }
    match requested {
        Some(BatchGrantMode::OneGrant) => Ok(BatchPlan::OneGrant),
        Some(BatchGrantMode::PerStep) | None => Ok(BatchPlan::PerStep {
            risky_indices: descriptor
                .steps
                .iter()
                .enumerate()
                .filter(|(_, s)| classify_batch_step(s).requires_confirmation())
                .map(|(i, _)| i)
                .collect(),
        }),
    }
}

/// Hash binding ONE step of a batch, for the per-step fallback path. The
/// batch descriptor hash plus the step index prevent a grant for step k from
/// authorizing any other step or batch.
pub fn hash_batch_step(descriptor_hash: &str, index: usize, step: &BatchStep) -> String {
    crate::aci_approvals::hash_action_payload(&json!({
        "route": "aci.batch.step",
        "batch": descriptor_hash,
        "step": index,
        "method": step.method,
        "selector": step.selector,
        "arguments": step.arguments,
    }))
}

/// Enforce the one-grant-per-batch path: identical semantics to
/// `enforce_confirmation` (single-use, expiring, hash-bound), just bound to
/// the batch descriptor hash instead of a single action payload. Returns the
/// presented grant id on success.
pub fn enforce_batch_grant(
    approval_store: &crate::permission_policy::ApprovalStore,
    user_id: &str,
    route: &str,
    descriptor: &BatchDescriptor,
    approval_id: Option<&str>,
) -> Result<Option<String>, crate::aci_safety::ConfirmationDenial> {
    enforce_batch_grant_with_mode(
        crate::aci_safety::HOST_POLICY.mode,
        approval_store,
        user_id,
        route,
        descriptor,
        approval_id,
    )
}

/// Mode-injectable core of [`enforce_batch_grant`] so tests are hermetic
/// regardless of `ALLTERNIT_ACI_SAFETY_MODE`.
pub fn enforce_batch_grant_with_mode(
    mode: crate::aci_safety::SafetyMode,
    approval_store: &crate::permission_policy::ApprovalStore,
    user_id: &str,
    route: &str,
    descriptor: &BatchDescriptor,
    approval_id: Option<&str>,
) -> Result<Option<String>, crate::aci_safety::ConfirmationDenial> {
    use crate::aci_safety::ConfirmationClass;
    let class = if descriptor
        .steps
        .iter()
        .all(|s| classify_batch_step(s) == ConfirmationClass::Reversible)
    {
        ConfirmationClass::Reversible
    } else {
        ConfirmationClass::Risky
    };
    crate::aci_safety::enforce_confirmation_with_mode(
        mode,
        approval_store,
        user_id,
        route,
        class,
        &descriptor.canonical_json(),
        approval_id,
    )?;
    Ok(approval_id.map(str::to_string))
}

/// Enforce the per-step fallback for one step: reversible steps pass, risky
/// steps redeem a grant bound to `hash_batch_step`.
pub fn enforce_batch_step_grant(
    approval_store: &crate::permission_policy::ApprovalStore,
    user_id: &str,
    route: &str,
    descriptor_hash: &str,
    index: usize,
    step: &BatchStep,
    approval_id: Option<&str>,
) -> Result<Option<String>, crate::aci_safety::ConfirmationDenial> {
    enforce_batch_step_grant_with_mode(
        crate::aci_safety::HOST_POLICY.mode,
        approval_store,
        user_id,
        route,
        descriptor_hash,
        index,
        step,
        approval_id,
    )
}

/// Mode-injectable core of [`enforce_batch_step_grant`].
pub fn enforce_batch_step_grant_with_mode(
    mode: crate::aci_safety::SafetyMode,
    approval_store: &crate::permission_policy::ApprovalStore,
    user_id: &str,
    route: &str,
    descriptor_hash: &str,
    index: usize,
    step: &BatchStep,
    approval_id: Option<&str>,
) -> Result<Option<String>, crate::aci_safety::ConfirmationDenial> {
    let class = classify_batch_step(step);
    let payload = json!({
        "route": "aci.batch.step",
        "batch": descriptor_hash,
        "step": index,
        "method": step.method,
        "selector": step.selector,
        "arguments": step.arguments,
    });
    crate::aci_safety::enforce_confirmation_with_mode(
        mode, approval_store, user_id, route, class, &payload, approval_id,
    )?;
    Ok(approval_id.map(str::to_string))
}

// ─── Batch receipts ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum BatchEnforcement {
    Auto,
    OneGrant,
    PerStep,
}

impl BatchEnforcement {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Auto => "auto",
            Self::OneGrant => "one_grant",
            Self::PerStep => "per_step",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BatchStepReceipt {
    pub index: usize,
    pub method: String,
    pub selector: String,
    /// `completed` | `failed` | `skipped` (not reached after a halt).
    pub status: String,
    pub outcome: Option<Value>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct BatchReceipt {
    pub receipt_id: String,
    pub batch_id: String,
    pub user_id: String,
    pub descriptor_hash: String,
    pub grant_id: Option<String>,
    pub enforcement: BatchEnforcement,
    /// `dispatched` (written before execution) | `completed` |
    /// `completed_halted` | `denied` (grant enforcement refused dispatch).
    pub status: String,
    pub steps: Vec<BatchStepReceipt>,
    pub halted_at: Option<usize>,
    pub created_at: String,
    pub completed_at: Option<String>,
}

/// Append-only audit trail entry for the JSONL persistence. Two record kinds:
/// `dispatched` (full receipt, steps still pending) and `completed` (outcome
/// overlay). Reload applies them in order so the mutable fields converge.
#[derive(Debug, Clone, Serialize, Deserialize)]
struct BatchReceiptRecord {
    kind: String,
    receipt: BatchReceipt,
}

/// In-memory authoritative batch receipts plus an optional JSONL audit
/// trail, same shape and discipline as `aci_approvals::ActionGrantStore`.
#[derive(Debug, Default)]
pub struct BatchReceiptStore {
    receipts: Mutex<Vec<BatchReceipt>>,
    path: Option<std::path::PathBuf>,
}

const MAX_RETAINED_BATCH_RECEIPTS: usize = 10_000;

impl BatchReceiptStore {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn new_persisted(path: std::path::PathBuf) -> Self {
        let store = Self {
            receipts: Mutex::new(Vec::new()),
            path: Some(path),
        };
        store.load();
        store
    }

    fn load(&self) {
        let Some(path) = &self.path else { return };
        let Ok(text) = std::fs::read_to_string(path) else {
            return;
        };
        let mut receipts = self.receipts.lock().expect("batch receipt lock");
        for line in text.lines() {
            let line = line.trim();
            if line.is_empty() {
                continue;
            }
            match serde_json::from_str::<BatchReceiptRecord>(line) {
                Ok(record) => match receipts.iter_mut().find(|r| r.receipt_id == record.receipt.receipt_id) {
                    Some(existing) => *existing = record.receipt,
                    None => receipts.push(record.receipt),
                },
                Err(e) => tracing::warn!("batch receipts reload: skipping unparseable line: {e}"),
            }
        }
        let overflow = receipts.len().saturating_sub(MAX_RETAINED_BATCH_RECEIPTS);
        if overflow > 0 {
            receipts.drain(0..overflow);
        }
    }

    fn persist(&self, kind: &str, receipt: &BatchReceipt) {
        let Some(path) = &self.path else { return };
        let Ok(line) = serde_json::to_string(&BatchReceiptRecord {
            kind: kind.to_string(),
            receipt: receipt.clone(),
        }) else {
            return;
        };
        if let Some(parent) = path.parent() {
            if std::fs::create_dir_all(parent).is_err() {
                return;
            }
        }
        use std::io::Write as _;
        match std::fs::OpenOptions::new().create(true).append(true).open(path) {
            Ok(mut file) => {
                if let Err(e) = writeln!(file, "{line}") {
                    tracing::warn!("batch receipts persist: write failed: {e}");
                }
            }
            Err(e) => tracing::warn!("batch receipts persist: open failed: {e}"),
        }
    }

    /// Audit-before-act: record the batch as dispatched BEFORE any step
    /// executes. This is the row the ordering guarantee hangs on.
    pub fn record_dispatched(&self, receipt: BatchReceipt) {
        self.persist("dispatched", &receipt);
        let mut receipts = self.receipts.lock().expect("batch receipt lock");
        if receipts.len() >= MAX_RETAINED_BATCH_RECEIPTS {
            let drop = receipts.len() - MAX_RETAINED_BATCH_RECEIPTS + 1;
            receipts.drain(0..drop);
        }
        receipts.push(receipt);
    }

    /// Overlay the execution outcome onto a dispatched receipt.
    pub fn record_completed(
        &self,
        receipt_id: &str,
        steps: Vec<BatchStepReceipt>,
        halted_at: Option<usize>,
        status: &str,
    ) -> Option<BatchReceipt> {
        let mut receipts = self.receipts.lock().expect("batch receipt lock");
        let receipt = receipts.iter_mut().find(|r| r.receipt_id == receipt_id)?;
        receipt.steps = steps;
        receipt.halted_at = halted_at;
        receipt.status = status.to_string();
        receipt.completed_at = Some(chrono::Utc::now().to_rfc3339());
        let updated = receipt.clone();
        drop(receipts);
        self.persist("completed", &updated);
        Some(updated)
    }

    pub fn get(&self, receipt_id: &str) -> Option<BatchReceipt> {
        self.receipts
            .lock()
            .expect("batch receipt lock")
            .iter()
            .find(|r| r.receipt_id == receipt_id)
            .cloned()
    }

    pub fn receipts(&self) -> Vec<BatchReceipt> {
        self.receipts.lock().expect("batch receipt lock").clone()
    }
}

/// Process-wide batch receipt store; the audit trail lives next to the
/// per-action receipts JSONL.
pub static BATCH_RECEIPTS: Lazy<BatchReceiptStore> = Lazy::new(|| {
    BatchReceiptStore::new_persisted(
        crate::aci_approvals::computer_use_dir()
            .join("receipts")
            .join("batch-receipts.jsonl"),
    )
});

// ─── Execution ──────────────────────────────────────────────────────────────

/// Outcome of executing one batch step through a browser runtime.
#[derive(Debug, Clone)]
pub struct StepOutcome {
    pub success: bool,
    pub detail: Option<Value>,
}

/// Per-step result of a batch execution, one per descriptor step in order.
#[derive(Debug, Clone)]
pub enum StepResult {
    /// The step ran and succeeded.
    Completed(Option<Value>),
    /// The step ran and failed; the batch halts here.
    Failed(Option<Value>),
    /// The step never ran because an earlier step halted the batch.
    Skipped,
}

impl From<StepOutcome> for StepResult {
    fn from(outcome: StepOutcome) -> Self {
        if outcome.success {
            StepResult::Completed(outcome.detail)
        } else {
            StepResult::Failed(outcome.detail)
        }
    }
}

/// Execute a batch and overlay the outcome onto the dispatched receipt.
/// `execute` runs the whole granted batch (for the vendored runtime this is
/// ONE transport call into the extension worker) and reports one result per
/// step, in order. Halt semantics are applied here, uniformly: the first
/// failed step (or executor error) halts the batch and every later step is
/// recorded `skipped` — the receipt always covers the full descriptor.
///
/// The dispatched receipt must already exist — this function is only called
/// after `record_dispatched` (audit-before-act).
pub fn run_batch_steps(
    receipt_store: &BatchReceiptStore,
    receipt_id: &str,
    steps: &[BatchStep],
    execute: impl FnOnce(&[BatchStep]) -> Vec<StepResult>,
) -> Option<BatchReceipt> {
    let results = execute(steps);
    let mut step_receipts: Vec<BatchStepReceipt> = Vec::with_capacity(steps.len());
    let mut halted_at: Option<usize> = None;

    for (index, step) in steps.iter().enumerate() {
        if halted_at.is_some() {
            step_receipts.push(BatchStepReceipt {
                index,
                method: step.method.clone(),
                selector: step.selector.clone(),
                status: "skipped".to_string(),
                outcome: None,
            });
            continue;
        }
        let (status, outcome) = match results.get(index) {
            Some(StepResult::Completed(detail)) => ("completed", detail.clone()),
            Some(StepResult::Failed(detail)) => ("failed", detail.clone()),
            // Executor reports this step never ran: halt here, record it
            // honestly as skipped, and the loop skips the tail.
            Some(StepResult::Skipped) => {
                step_receipts.push(BatchStepReceipt {
                    index,
                    method: step.method.clone(),
                    selector: step.selector.clone(),
                    status: "skipped".to_string(),
                    outcome: None,
                });
                halted_at = Some(index);
                continue;
            }
            None => (
                "failed",
                Some(json!({"error": "executor returned no outcome for this step"})),
            ),
        };
        let failed = status == "failed";
        step_receipts.push(BatchStepReceipt {
            index,
            method: step.method.clone(),
            selector: step.selector.clone(),
            status: status.to_string(),
            outcome,
        });
        if failed {
            halted_at = Some(index);
        }
    }

    let status = if halted_at.is_some() {
        "completed_halted"
    } else {
        "completed"
    };
    receipt_store.record_completed(receipt_id, step_receipts, halted_at, status)
}

// ─── Sidecar executor (vendored @allternit/browser-runtime) ────────────────

const SIDECAR_ENTRY: &str = "packages/sdk-ts/sidecar/allternit-browser-runtime-sidecar.mjs";

/// Locate the vendored runtime root: explicit env, then the standard
/// in-repo location relative to this crate's manifest.
fn resolve_runtime_dir() -> Result<std::path::PathBuf, String> {
    if let Ok(dir) = std::env::var("ALLTERNIT_BROWSER_RUNTIME_DIR") {
        if !dir.is_empty() && dir_path_has_sidecar(std::path::Path::new(&dir)) {
            return Ok(std::path::PathBuf::from(dir));
        }
    }
    // cmd/allternit-api → repo root → infrastructure/.../allternit-browser-runtime
    let manifest = std::path::Path::new(env!("CARGO_MANIFEST_DIR"));
    for ancestor in manifest.ancestors() {
        let candidate = ancestor.join("infrastructure/chrome-stream/agent-systems/allternit-browser-runtime");
        if dir_path_has_sidecar(&candidate) {
            return Ok(candidate);
        }
    }
    Err("allternit-browser-runtime sidecar not found; set ALLTERNIT_BROWSER_RUNTIME_DIR".to_string())
}

fn dir_path_has_sidecar(dir: &std::path::Path) -> bool {
    dir.join(SIDECAR_ENTRY).is_file()
}

/// Minimal NDJSON stdio client for the runtime sidecar, mirroring the
/// protocol in `allternit-browser-runtime-sidecar.mjs`.
struct SidecarClient {
    child: std::process::Child,
    stdin: std::process::ChildStdin,
    rx: std::sync::mpsc::Receiver<Value>,
    next_id: u64,
}

impl SidecarClient {
    fn spawn(runtime_dir: &std::path::Path) -> Result<Self, String> {
        let node = std::env::var("ALLTERNIT_BROWSER_RUNTIME_NODE")
            .ok()
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "node".to_string());
        let mut child = std::process::Command::new(node)
            .arg(runtime_dir.join(SIDECAR_ENTRY))
            .stdin(std::process::Stdio::piped())
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            .spawn()
            .map_err(|e| format!("failed to spawn browser runtime sidecar: {e}"))?;
        let stdin = child.stdin.take().ok_or("sidecar stdin unavailable")?;
        let stdout = child.stdout.take().ok_or("sidecar stdout unavailable")?;
        let (tx, rx) = std::sync::mpsc::channel::<Value>();
        std::thread::spawn(move || {
            use std::io::BufRead as _;
            let reader = std::io::BufReader::new(stdout);
            for line in reader.lines() {
                let Ok(line) = line else { break };
                let line = line.trim();
                if line.is_empty() {
                    continue;
                }
                if let Ok(value) = serde_json::from_str::<Value>(line) {
                    if tx.send(value).is_err() {
                        break;
                    }
                }
            }
        });
        Ok(Self {
            child,
            stdin,
            rx,
            next_id: 1,
        })
    }

    fn request(&mut self, method: &str, params: Value, timeout: Duration) -> Result<Value, String> {
        let id = self.next_id;
        self.next_id += 1;
        let line = serde_json::json!({ "id": id, "method": method, "params": params }).to_string();
        use std::io::Write as _;
        writeln!(self.stdin, "{line}").map_err(|e| format!("sidecar write failed: {e}"))?;
        let deadline = std::time::Instant::now() + timeout;
        loop {
            let now = std::time::Instant::now();
            if now >= deadline {
                return Err(format!("sidecar request {method} timed out after {timeout:?}"));
            }
            let remaining = deadline.saturating_duration_since(now);
            // Wait in slices so a mid-wait shutdown (channel disconnect) is
            // noticed promptly; a slice timeout is NOT a request timeout.
            let msg = match self.rx.recv_timeout(remaining.min(Duration::from_millis(250))) {
                Ok(msg) => msg,
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => continue,
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    return Err("sidecar closed the connection".to_string());
                }
            };
            if msg.get("id").and_then(Value::as_u64) != Some(id) {
                continue; // response to an earlier caller (single-flight per client)
            }
            if msg.get("ok").and_then(Value::as_bool) == Some(true) {
                return Ok(msg.get("result").cloned().unwrap_or(Value::Null));
            }
            return Err(msg
                .get("error")
                .and_then(Value::as_str)
                .unwrap_or("sidecar error")
                .to_string());
        }
    }
}

impl Drop for SidecarClient {
    fn drop(&mut self) {
        let _ = self.request("close", json!({}), Duration::from_secs(5));
        let _ = self.child.kill();
    }
}

/// A whole-batch executor: runs every granted step and reports one result
/// per step in descriptor order.
pub type BatchExecutor = Box<dyn FnOnce(&[BatchStep]) -> Vec<StepResult>>;

/// Execute a granted batch through the sidecar: init (mock model — the
/// whitelisted structured steps execute deterministically with no model
/// call), optional navigation to the descriptor's bound page, then ONE
/// `actBatch` transport call that runs every step in the extension worker,
/// halting at the first failure.
///
/// The returned executor replays the sidecar's per-step outcomes; steps after
/// the halt are reported `Skipped`.
pub fn sidecar_batch_executor(
    descriptor: &BatchDescriptor,
    headless: bool,
) -> Result<BatchExecutor, String> {
    let runtime_dir = resolve_runtime_dir()?;
    let mut client = SidecarClient::spawn(&runtime_dir)?;
    client.request(
        "init",
        json!({ "headless": headless, "model": { "mode": "mock" } }),
        Duration::from_secs(60),
    )
    .map_err(|e| format!("sidecar init failed: {e}"))?;

    if let Some(url) = &descriptor.page_url {
        client
            .request("navigate", json!({ "url": url }), Duration::from_secs(60))
            .map_err(|e| format!("sidecar navigate failed: {e}"))?;
    }

    // Ship the whole granted batch in one transport call; the in-worker
    // dispatch halts at the first failed step (same failure semantics as
    // `execute_batch` upstream).
    let steps_json: Value = serde_json::to_value(&descriptor.steps)
        .map_err(|e| format!("batch serialization failed: {e}"))?;
    let result = client
        .request(
            "actBatch",
            json!({ "steps": steps_json, "timeoutMs": 60_000u64 }),
            Duration::from_secs(120),
        )
        .map_err(|e| format!("sidecar actBatch failed: {e}"))?;

    // The sidecar reports one entry per executed step (`index`, `success`,
    // ...); the tail after a halt is absent. Replay into a full-length vec.
    let mut by_index: std::collections::HashMap<usize, Value> = std::collections::HashMap::new();
    if let Some(steps) = result.get("steps").and_then(Value::as_array) {
        for entry in steps {
            let index = entry.get("index").and_then(Value::as_u64).unwrap_or(0) as usize;
            by_index.insert(index, entry.clone());
        }
    }

    let step_count = descriptor.steps.len();
    Ok(Box::new(move |_steps: &[BatchStep]| {
        (0..step_count)
            .map(|index| match by_index.get(&index) {
                Some(entry) => {
                    let success = entry.get("success").and_then(Value::as_bool).unwrap_or(false);
                    let detail = Some(entry.clone());
                    if success {
                        StepResult::Completed(detail)
                    } else {
                        StepResult::Failed(detail)
                    }
                }
                // Steps the sidecar never reported are the tail after a halt.
                None => StepResult::Skipped,
            })
            .collect()
    }))
}

// ─── HTTP surface (P1 invocation route; P2's planning loop consumes this) ──

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AciBatchBody {
    /// Origin label for the descriptor (default `aci.batch`).
    #[serde(default)]
    pub origin: Option<String>,
    /// Optional session binding folded into the grant hash.
    #[serde(default)]
    pub session: Option<String>,
    /// Optional page the batch is approved against; part of the hash.
    #[serde(default)]
    pub page_url: Option<String>,
    /// Caller grant preference: "batch" (one grant) or "per_step". Absent =
    /// conservative default (per-step when anything is not clearly
    /// reversible).
    #[serde(default)]
    pub mode: Option<String>,
    pub steps: Vec<BatchStep>,
    /// Batch-grant id (mode "batch").
    #[serde(default)]
    pub approval_id: Option<String>,
    /// Per-step grant ids, aligned with `steps`; only risky indices are
    /// consulted (mode "per_step").
    #[serde(default)]
    pub step_approval_ids: Option<Vec<Option<String>>>,
    #[serde(default)]
    pub headless: Option<bool>,
}

/// Core gated-batch pipeline, executor injected. Shared by the route (real
/// sidecar) and tests (stub executor).
pub async fn run_gated_batch(
    state: &AppState,
    user_id: &str,
    body: &AciBatchBody,
    receipt_store: &BatchReceiptStore,
    make_executor: impl FnOnce(&BatchDescriptor) -> Result<BatchExecutor, String>,
) -> Response {
    let descriptor = BatchDescriptor {
        origin: body
            .origin
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "aci.batch".to_string()),
        session: body.session.clone().filter(|s| !s.trim().is_empty()),
        page_url: body.page_url.clone().filter(|s| !s.trim().is_empty()),
        steps: body.steps.clone(),
    };

    let requested_mode = match body.mode.as_deref() {
        Some(raw) => match BatchGrantMode::parse(raw) {
            Some(mode) => Some(mode),
            None => {
                return (
                    StatusCode::BAD_REQUEST,
                    Json(json!({"error": "invalid mode", "message": "mode must be \"batch\" or \"per_step\""})),
                )
                    .into_response();
            }
        },
        None => None,
    };

    let plan = match plan_batch(&descriptor, requested_mode) {
        Ok(plan) => plan,
        Err(reason) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "invalid batch descriptor", "message": reason})),
            )
                .into_response();
        }
    };

    let descriptor_hash = descriptor.hash();

    // Grant enforcement — before dispatch, exactly like per-action. A
    // refusal here never touches the browser.
    let (enforcement, grant_id): (BatchEnforcement, Option<String>) = match &plan {
        BatchPlan::Auto => (BatchEnforcement::Auto, None),
        BatchPlan::OneGrant => {
            match enforce_batch_grant(
                &state.approval_store,
                user_id,
                "aci.batch",
                &descriptor,
                body.approval_id.as_deref(),
            ) {
                Ok(grant) => (BatchEnforcement::OneGrant, grant),
                Err(denial) => return (denial.status, Json(denial.body)).into_response(),
            }
        }
        BatchPlan::PerStep { risky_indices } => {
            let step_approval_ids = body.step_approval_ids.clone().unwrap_or_default();
            let mut redeemed = None;
            for &index in risky_indices {
                let step = &descriptor.steps[index];
                let approval_id = step_approval_ids.get(index).cloned().flatten();
                match enforce_batch_step_grant(
                    &state.approval_store,
                    user_id,
                    "aci.batch",
                    &descriptor_hash,
                    index,
                    step,
                    approval_id.as_deref(),
                ) {
                    Ok(grant) => redeemed = grant.or(redeemed),
                    Err(denial) => {
                        // Audit the refused dispatch too: the descriptor and
                        // the step that blocked it are on the trail.
                        receipt_store.record_dispatched(BatchReceipt {
                            receipt_id: uuid::Uuid::new_v4().to_string(),
                            batch_id: descriptor_hash.clone(),
                            user_id: user_id.to_string(),
                            descriptor_hash: descriptor_hash.clone(),
                            grant_id: None,
                            enforcement: BatchEnforcement::PerStep,
                            status: "denied".to_string(),
                            steps: vec![BatchStepReceipt {
                                index,
                                method: step.method.clone(),
                                selector: step.selector.clone(),
                                status: "denied".to_string(),
                                outcome: Some(denial.body.clone()),
                            }],
                            halted_at: Some(index),
                            created_at: chrono::Utc::now().to_rfc3339(),
                            completed_at: Some(chrono::Utc::now().to_rfc3339()),
                        });
                        return (denial.status, Json(denial.body)).into_response();
                    }
                }
            }
            (BatchEnforcement::PerStep, redeemed)
        }
    };

    // Audit-before-act: the receipt row exists BEFORE the batch executes.
    let receipt_id = uuid::Uuid::new_v4().to_string();
    receipt_store.record_dispatched(BatchReceipt {
        receipt_id: receipt_id.clone(),
        batch_id: descriptor_hash.clone(),
        user_id: user_id.to_string(),
        descriptor_hash: descriptor_hash.clone(),
        grant_id: grant_id.clone(),
        enforcement,
        status: "dispatched".to_string(),
        steps: descriptor
            .steps
            .iter()
            .enumerate()
            .map(|(index, step)| BatchStepReceipt {
                index,
                method: step.method.clone(),
                selector: step.selector.clone(),
                status: "pending".to_string(),
                outcome: None,
            })
            .collect(),
        halted_at: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        completed_at: None,
    });

    let executor = match make_executor(&descriptor) {
        Ok(executor) => executor,
        Err(message) => {
            let receipt = receipt_store.record_completed(
                &receipt_id,
                descriptor
                    .steps
                    .iter()
                    .enumerate()
                    .map(|(index, step)| BatchStepReceipt {
                        index,
                        method: step.method.clone(),
                        selector: step.selector.clone(),
                        status: "failed".to_string(),
                        outcome: Some(json!({"error": message})),
                    })
                    .collect(),
                Some(0),
                "failed",
            );
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({
                    "error": "batch_executor_unavailable",
                    "message": message,
                    "receipt": receipt,
                })),
            )
                .into_response();
        }
    };

    let receipt = run_batch_steps(receipt_store, &receipt_id, &descriptor.steps, executor);

    (
        StatusCode::OK,
        Json(json!({
            "receipt_id": receipt_id,
            "descriptor_hash": descriptor_hash,
            "grant_id": grant_id,
            "enforcement": enforcement.as_str(),
            "receipt": receipt,
        })),
    )
        .into_response()
}

pub async fn aci_batch_execute(
    State(state): State<Arc<AppState>>,
    Extension(user): Extension<AuthUser>,
    Json(body): Json<AciBatchBody>,
) -> Response {
    run_gated_batch(&state, &user.user_id, &body, &BATCH_RECEIPTS, |descriptor| {
        sidecar_batch_executor(descriptor, body.headless.unwrap_or(true))
    })
    .await
}

pub async fn aci_batch_receipt(
    State(_state): State<Arc<AppState>>,
    Extension(_user): Extension<AuthUser>,
    Path(id): Path<String>,
) -> Response {
    match BATCH_RECEIPTS.get(&id) {
        Some(receipt) => (StatusCode::OK, Json(serde_json::to_value(receipt).unwrap_or_default()))
            .into_response(),
        None => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "batch_receipt_not_found"})),
        )
            .into_response(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn step(method: &str, selector: &str) -> BatchStep {
        BatchStep {
            method: method.to_string(),
            selector: selector.to_string(),
            arguments: Vec::new(),
        }
    }

    fn descriptor(steps: Vec<BatchStep>) -> BatchDescriptor {
        BatchDescriptor {
            origin: "aci.batch".to_string(),
            session: Some("session-1".to_string()),
            page_url: Some("http://127.0.0.1:8080/".to_string()),
            steps,
        }
    }

    fn reversible_steps() -> Vec<BatchStep> {
        vec![step("hover", "#a"), step("scrollTo", "#b")]
    }

    fn risky_steps() -> Vec<BatchStep> {
        vec![step("click", "#go"), step("fill", "#name")]
    }

    #[test]
    fn whitelist_accepts_exactly_the_runtime_vocabulary() {
        for method in [
            "click", "fill", "type", "press", "scrollTo", "nextChunk", "prevChunk",
            "selectOptionFromDropdown", "hover", "doubleClick", "dragAndDrop",
        ] {
            assert!(whitelist_contains(method), "{method} must be whitelisted");
        }
        assert!(!whitelist_contains("evaluate"));
        assert!(!whitelist_contains("exec"));
        assert!(!whitelist_contains("goto"));
        assert!(!whitelist_contains("Click"));
    }

    #[test]
    fn descriptor_validation_rejects_non_whitelist_steps() {
        let mut steps = reversible_steps();
        steps.push(step("evaluate", "anything"));
        let desc = descriptor(steps);
        let err = plan_batch(&desc, None).unwrap_err();
        assert!(err.contains("outside the whitelisted"), "{err}");

        assert!(plan_batch(&descriptor(vec![]), None).unwrap_err().contains("at least one"));
        assert!(
            plan_batch(&descriptor(vec![step("click", "  ")]), None)
                .unwrap_err()
                .contains("empty element selector")
        );
        let too_many: Vec<BatchStep> = (0..=MAX_BATCH_STEPS)
            .map(|i| step("hover", format!("#{i}").as_str()))
            .collect();
        assert!(
            plan_batch(&descriptor(too_many), None)
                .unwrap_err()
                .contains("the maximum is")
        );
    }

    #[test]
    fn classification_marks_only_transient_actions_reversible() {
        assert_eq!(
            classify_batch_step(&step("hover", "#a")),
            crate::aci_safety::ConfirmationClass::Reversible
        );
        assert_eq!(
            classify_batch_step(&step("scrollTo", "#a")),
            crate::aci_safety::ConfirmationClass::Reversible
        );
        for method in [
            "click", "fill", "type", "press", "selectOptionFromDropdown",
            "doubleClick", "dragAndDrop",
        ] {
            assert_eq!(
                classify_batch_step(&step(method, "#a")),
                crate::aci_safety::ConfirmationClass::Risky,
                "{method} must be risky"
            );
        }
        // nextChunk / prevChunk are the remaining reversible pair.
        for method in ["nextChunk", "prevChunk"] {
            assert_eq!(
                classify_batch_step(&step(method, "#a")),
                crate::aci_safety::ConfirmationClass::Reversible,
                "{method} must be reversible"
            );
        }
    }

    #[test]
    fn planning_auto_for_reversible_one_grant_on_request_per_step_by_default() {
        let rev = descriptor(reversible_steps());
        // Auto regardless of the caller's preference.
        assert_eq!(
            plan_batch(&rev, Some(BatchGrantMode::OneGrant)).unwrap(),
            BatchPlan::Auto
        );

        let risky = descriptor(risky_steps());
        // Explicit batch mode → one grant.
        assert_eq!(
            plan_batch(&risky, Some(BatchGrantMode::OneGrant)).unwrap(),
            BatchPlan::OneGrant
        );
        // Conservative default → per-step.
        assert_eq!(
            plan_batch(&risky, None).unwrap(),
            BatchPlan::PerStep {
                risky_indices: vec![0, 1]
            }
        );
        // Mixed batch: reversible steps drop out of the per-step list.
        let mixed = descriptor(vec![step("hover", "#a"), step("click", "#go")]);
        assert_eq!(
            plan_batch(&mixed, None).unwrap(),
            BatchPlan::PerStep { risky_indices: vec![1] }
        );
    }

    #[test]
    fn descriptor_hash_covers_every_field_and_step() {
        let base = descriptor(risky_steps());
        let hash = base.hash();

        // Key order / construction path does not matter.
        let same = BatchDescriptor {
            origin: "aci.batch".to_string(),
            steps: risky_steps(),
            page_url: Some("http://127.0.0.1:8080/".to_string()),
            session: Some("session-1".to_string()),
        };
        assert_eq!(hash, same.hash());

        // Any mutation — reordered steps, one argument, the page — widens
        // the descriptor and must change the hash.
        let mut reordered = base.clone();
        reordered.steps.swap(0, 1);
        assert_ne!(hash, reordered.hash());

        let mut arg_change = base.clone();
        arg_change.steps[0].arguments = vec!["x".to_string()];
        assert_ne!(hash, arg_change.hash());

        let mut page_change = base.clone();
        page_change.page_url = Some("http://evil.example/".to_string());
        assert_ne!(hash, page_change.hash());

        let mut session_change = base.clone();
        session_change.session = Some("session-2".to_string());
        assert_ne!(hash, session_change.hash());
    }

    #[test]
    fn step_hash_binds_index_batch_and_payload() {
        let desc = descriptor(risky_steps());
        let hash = desc.hash();
        let h0 = hash_batch_step(&hash, 0, &desc.steps[0]);
        assert_eq!(h0, hash_batch_step(&hash, 0, &desc.steps[0]));
        // A different step index or payload must hash differently.
        assert_ne!(h0, hash_batch_step(&hash, 1, &desc.steps[1]));
        let mut other = desc.steps[0].clone();
        other.selector = "#other".to_string();
        assert_ne!(h0, hash_batch_step(&hash, 0, &other));
        // A different batch must hash differently.
        let other_batch = descriptor(reversible_steps());
        assert_ne!(h0, hash_batch_step(&other_batch.hash(), 0, &desc.steps[0]));
    }

    // ── Grant enforcement over the in-memory stores ───────────────────────

    fn approval_store() -> crate::permission_policy::ApprovalStore {
        crate::permission_policy::ApprovalStore::new()
    }

    #[test]
    fn granted_batch_executes_and_consumes_grant() {
        let store = approval_store();
        let desc = descriptor(risky_steps());
        let hash = desc.hash();

        // No grant yet → confirmation_required with a pending grant bound to
        // the descriptor hash.
        let denial = enforce_batch_grant_with_mode(
            crate::aci_safety::SafetyMode::Enforce,
            &store,
            "user-1",
            "aci.batch",
            &desc,
            None,
        )
        .unwrap_err();
        assert_eq!(denial.status, StatusCode::FORBIDDEN);
        assert_eq!(denial.body["error"], "confirmation_required");
        assert_eq!(denial.body["action_hash"], hash);
        let approval_id = denial.body["approval_id"].as_str().unwrap().to_string();

        // Approve through the shared handoff flow, then redeem once.
        assert!(store.approve(&approval_id));
        assert!(crate::aci_approvals::GRANTS.approve(&approval_id));
        assert_eq!(
            enforce_batch_grant_with_mode(
                crate::aci_safety::SafetyMode::Enforce,
                &store,
                "user-1",
                "aci.batch",
                &desc,
                Some(&approval_id),
            )
            .unwrap(),
            Some(approval_id.clone())
        );
        // Single-use: the grant is consumed; presenting it again fails.
        let replay = enforce_batch_grant_with_mode(
            crate::aci_safety::SafetyMode::Enforce,
            &store,
            "user-1",
            "aci.batch",
            &desc,
            Some(&approval_id),
        )
        .unwrap_err();
        assert_eq!(replay.body["error"], "approval_denied");
        assert!(replay.body["reason"]
            .as_str()
            .unwrap()
            .contains("single-use"));
    }

    #[test]
    fn tampered_descriptor_is_rejected_by_hash_mismatch() {
        let store = approval_store();
        let desc = descriptor(risky_steps());
        let mode = crate::aci_safety::SafetyMode::Enforce;
        let approval_id = {
            let denial =
                enforce_batch_grant_with_mode(mode, &store, "user-1", "aci.batch", &desc, None)
                    .unwrap_err();
            denial.body["approval_id"].as_str().unwrap().to_string()
        };
        assert!(store.approve(&approval_id));
        assert!(crate::aci_approvals::GRANTS.approve(&approval_id));

        // Mutate ONE step argument — the exact batch the human approved is
        // no longer what the client presents.
        let mut tampered = desc.clone();
        tampered.steps[1].arguments = vec!["admin".to_string()];
        let denial = enforce_batch_grant_with_mode(
            mode,
            &store,
            "user-1",
            "aci.batch",
            &tampered,
            Some(&approval_id),
        )
        .unwrap_err();
        assert_eq!(denial.body["error"], "approval_denied");
        assert_eq!(
            denial.body["reason"],
            crate::aci_approvals::GrantDenial::HashMismatch.reason()
        );
        // The tampered attempt consumed nothing; the pristine descriptor can
        // still redeem the grant.
        assert!(enforce_batch_grant_with_mode(
            mode,
            &store,
            "user-1",
            "aci.batch",
            &desc,
            Some(&approval_id)
        )
        .is_ok());
    }

    #[test]
    fn expired_batch_grant_is_rejected() {
        let desc = descriptor(risky_steps());
        let hash = desc.hash();
        let store = approval_store();
        let approval_id = uuid::Uuid::new_v4().to_string();
        crate::aci_approvals::GRANTS.issue_with_id(&approval_id, "user-1", &hash, 60);
        crate::aci_approvals::GRANTS.approve(&approval_id);
        // Force expiry into the past (mirrors the aci_approvals TTL test —
        // redeem compares strictly greater than expires_at).
        let mut grant = crate::aci_approvals::GRANTS.get(&approval_id).unwrap();
        grant.expires_at = chrono::Utc::now().timestamp_millis() - 1;
        crate::aci_approvals::GRANTS
            .set_expires_for_test(&approval_id, grant.expires_at);
        let denial = enforce_batch_grant_with_mode(
            crate::aci_safety::SafetyMode::Enforce,
            &store,
            "user-1",
            "aci.batch",
            &desc,
            Some(&approval_id),
        )
        .unwrap_err();
        assert_eq!(denial.body["error"], "approval_denied");
        assert_eq!(
            denial.body["reason"],
            crate::aci_approvals::GrantDenial::Expired.reason()
        );
    }

    #[test]
    fn per_step_fallback_grants_bind_step_index() {
        let store = approval_store();
        let desc = descriptor(risky_steps());
        let hash = desc.hash();
        let mode = crate::aci_safety::SafetyMode::Enforce;

        // Step 0 needs a grant; absent → confirmation_required carrying the
        // step-scoped hash.
        let denial = enforce_batch_step_grant_with_mode(
            mode, &store, "user-1", "aci.batch", &hash, 0, &desc.steps[0], None,
        )
        .unwrap_err();
        let step0_hash = hash_batch_step(&hash, 0, &desc.steps[0]);
        assert_eq!(denial.body["action_hash"], step0_hash);
        let approval_id = denial.body["approval_id"].as_str().unwrap().to_string();

        assert!(store.approve(&approval_id));
        assert!(crate::aci_approvals::GRANTS.approve(&approval_id));
        // The step-0 grant does NOT authorize step 1.
        let wrong_step = enforce_batch_step_grant_with_mode(
            mode, &store, "user-1", "aci.batch", &hash, 1, &desc.steps[1], Some(&approval_id),
        )
        .unwrap_err();
        assert_eq!(wrong_step.body["error"], "approval_denied");

        // Reversible steps in per-step mode never ask for a grant.
        assert_eq!(
            enforce_batch_step_grant_with_mode(
                mode,
                &store,
                "user-1",
                "aci.batch",
                &hash,
                0,
                &step("hover", "#a"),
                None,
            )
            .unwrap(),
            None
        );
    }

    #[test]
    fn auto_plan_never_asks_for_a_grant() {
        let store = approval_store();
        let desc = descriptor(reversible_steps());
        assert_eq!(
            enforce_batch_grant_with_mode(
                crate::aci_safety::SafetyMode::Enforce,
                &store,
                "user-1",
                "aci.batch",
                &desc,
                None,
            )
            .unwrap(),
            None
        );
    }

    // ── Receipts and audit-before-act ordering ────────────────────────────

    #[test]
    fn receipt_records_descriptor_grant_outcomes_and_halt_position() {
        let store = BatchReceiptStore::new();
        let desc = descriptor(risky_steps());
        let receipt_id = "rcpt-1".to_string();
        store.record_dispatched(BatchReceipt {
            receipt_id: receipt_id.clone(),
            batch_id: desc.hash(),
            user_id: "user-1".to_string(),
            descriptor_hash: desc.hash(),
            grant_id: Some("grant-1".to_string()),
            enforcement: BatchEnforcement::OneGrant,
            status: "dispatched".to_string(),
            steps: vec![],
            halted_at: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            completed_at: None,
        });

        // Executor fails step 1 → halt there; step 2 never ran.
        let receipt = run_batch_steps(&store, &receipt_id, &desc.steps, |steps| {
            steps
                .iter()
                .map(|step| {
                    if step.method == "click" {
                        StepResult::Completed(Some(json!({"message": "clicked"})))
                    } else {
                        StepResult::Failed(Some(json!({"error": "element vanished"})))
                    }
                })
                .collect()
        })
        .unwrap();

        assert_eq!(receipt.status, "completed_halted");
        assert_eq!(receipt.halted_at, Some(1));
        assert_eq!(receipt.steps.len(), 2);
        assert_eq!(receipt.steps[0].status, "completed");
        assert_eq!(receipt.steps[1].status, "failed");
        assert_eq!(receipt.descriptor_hash, desc.hash());
        assert_eq!(receipt.grant_id.as_deref(), Some("grant-1"));
        assert!(receipt.completed_at.is_some());
    }

    #[test]
    fn audit_row_exists_before_dispatch_and_persists_across_restart() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("batch-receipts.jsonl");
        let store = BatchReceiptStore::new_persisted(path.clone());
        let desc = descriptor(reversible_steps());
        let receipt_id = "rcpt-order".to_string();
        store.record_dispatched(BatchReceipt {
            receipt_id: receipt_id.clone(),
            batch_id: desc.hash(),
            user_id: "user-1".to_string(),
            descriptor_hash: desc.hash(),
            grant_id: None,
            enforcement: BatchEnforcement::Auto,
            status: "dispatched".to_string(),
            steps: vec![],
            halted_at: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            completed_at: None,
        });

        // The executor observes the world mid-dispatch: the receipt row must
        // already be present (and already dispatched) while steps run.
        let during = store.get(&receipt_id).unwrap();
        assert_eq!(during.status, "dispatched");
        let receipt = run_batch_steps(&store, &receipt_id, &desc.steps, |steps| {
            assert_eq!(
                store.get(&receipt_id).unwrap().status,
                "dispatched",
                "receipt must exist before the executor runs"
            );
            steps
                .iter()
                .map(|_| StepResult::Completed(None))
                .collect()
        })
        .unwrap();
        assert_eq!(receipt.status, "completed");

        // Simulated restart: a fresh store over the same file reloads the
        // trail and sees the completed outcome.
        let store2 = BatchReceiptStore::new_persisted(path);
        let reloaded = store2.get(&receipt_id).unwrap();
        assert_eq!(reloaded.status, "completed");
        assert_eq!(reloaded.steps.len(), 2);
        assert!(reloaded.steps.iter().all(|s| s.status == "completed"));
    }

    #[test]
    fn batch_receipts_jsonl_records_dispatched_then_completed() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("batch-receipts.jsonl");
        let store = BatchReceiptStore::new_persisted(path.clone());
        let desc = descriptor(reversible_steps());
        store.record_dispatched(BatchReceipt {
            receipt_id: "rcpt-jsonl".to_string(),
            batch_id: desc.hash(),
            user_id: "user-1".to_string(),
            descriptor_hash: desc.hash(),
            grant_id: None,
            enforcement: BatchEnforcement::Auto,
            status: "dispatched".to_string(),
            steps: vec![],
            halted_at: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            completed_at: None,
        });
        run_batch_steps(&store, "rcpt-jsonl", &desc.steps, |steps| {
            steps
                .iter()
                .map(|_| StepResult::Completed(None))
                .collect()
        });

        let text = std::fs::read_to_string(&path).expect("batch receipts file written");
        let lines: Vec<Value> = text
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| serde_json::from_str(l).unwrap())
            .collect();
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0]["kind"], "dispatched");
        assert_eq!(lines[0]["receipt"]["status"], "dispatched");
        assert_eq!(lines[1]["kind"], "completed");
        assert_eq!(lines[1]["receipt"]["status"], "completed");
    }

    // ── HTTP surface with a stub executor (no sidecar) ────────────────────

    async fn post_batch(
        state: Arc<AppState>,
        user_id: &str,
        body: Value,
    ) -> (StatusCode, serde_json::Value) {
        use axum::body::Body;
        use http_body_util::BodyExt;
        use tower::ServiceExt;

        let user = AuthUser {
            user_id: user_id.to_string(),
            organization_id: None,
            tenant_id: None,
            email: None,
            name: None,
            avatar_url: None,
            organization_role: None,
            organization_slug: None,
        };
        let app = crate::aci_routes::aci_router().with_state(state);
        let response = app
            .oneshot(
                axum::http::Request::post("/aci/batch")
                    .extension(user)
                    .header("content-type", "application/json")
                    .body(Body::from(serde_json::to_string(&body).unwrap()))
                    .unwrap(),
            )
            .await
            .unwrap();
        let status = response.status();
        let bytes = response.into_body().collect().await.unwrap().to_bytes();
        let json = serde_json::from_slice(&bytes).unwrap_or_else(|_| serde_json::Value::Null);
        (status, json)
    }

    #[tokio::test]
    async fn http_granted_batch_executes_and_returns_receipt() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let body = json!({
            "origin": "test.batch",
            "session": "s-1",
            "pageUrl": "http://127.0.0.1:9/",
            "mode": "batch",
            "steps": [
                {"method": "click", "selector": "#a"},
                {"method": "hover", "selector": "#b"},
            ],
        });
        let descriptor = BatchDescriptor {
            origin: "test.batch".to_string(),
            session: Some("s-1".to_string()),
            page_url: Some("http://127.0.0.1:9/".to_string()),
            steps: vec![step("click", "#a"), step("hover", "#b")],
        };

        // First call: no grant → confirmation_required, descriptor hash exposed.
        let (status, denial) = post_batch(state.clone(), "user-1", body.clone()).await;
        assert_eq!(status, StatusCode::FORBIDDEN);
        assert_eq!(denial["error"], "confirmation_required");
        assert_eq!(denial["action_hash"], descriptor.hash());
        let approval_id = denial["approval_id"].as_str().unwrap().to_string();

        // Approve via the shared handoff endpoints, then execute with the grant.
        assert!(state.approval_store.approve(&approval_id));
        assert!(crate::aci_approvals::GRANTS.approve(&approval_id));
        let granted = json!({
            "origin": "test.batch",
            "session": "s-1",
            "pageUrl": "http://127.0.0.1:9/",
            "mode": "batch",
            "approvalId": approval_id,
            "steps": [
                {"method": "click", "selector": "#a"},
                {"method": "hover", "selector": "#b"},
            ],
        });
        // Executor is injected at this level — the route-level sidecar spawn
        // is covered by the live smoke; here we exercise the gate + receipt
        // pipeline through run_gated_batch directly.
        let parsed: AciBatchBody = serde_json::from_value(granted).unwrap();
        let receipts = BatchReceiptStore::new();
        let response = run_gated_batch(
            &state,
            "user-1",
            &parsed,
            &receipts,
            |_desc| -> Result<BatchExecutor, String> {
                Ok(Box::new(|steps: &[BatchStep]| {
                    steps
                        .iter()
                        .enumerate()
                        .map(|(i, _)| StepResult::Completed(Some(json!({"n": i + 1}))))
                        .collect()
                }) as BatchExecutor)
            },
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["descriptor_hash"], descriptor.hash());
        assert_eq!(json["grant_id"], approval_id);
        assert_eq!(json["enforcement"], "one_grant");
        let receipt = &json["receipt"];
        assert_eq!(receipt["status"], "completed");
        assert_eq!(receipt["steps"].as_array().unwrap().len(), 2);
        assert!(receipt["steps"]
            .as_array()
            .unwrap()
            .iter()
            .all(|s| s["status"] == "completed"));

        // Replay with the same grant → denied (single-use), even though the
        // executor would have succeeded.
        let response = run_gated_batch(
            &state,
            "user-1",
            &parsed,
            &receipts,
            |_desc| -> Result<BatchExecutor, String> {
                Ok(Box::new(|steps: &[BatchStep]| {
                    steps.iter().map(|_| StepResult::Completed(None)).collect()
                }) as BatchExecutor)
            },
        )
        .await;
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
    }

    #[tokio::test]
    async fn http_reversible_batch_auto_path_executes_without_grant() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let parsed: AciBatchBody = serde_json::from_value(json!({
            "steps": [
                {"method": "hover", "selector": "#a"},
                {"method": "scrollTo", "selector": "#b"},
            ],
        }))
        .unwrap();
        let receipts = BatchReceiptStore::new();
        let response = run_gated_batch(
            &state,
            "user-1",
            &parsed,
            &receipts,
            |_desc| -> Result<BatchExecutor, String> {
                Ok(Box::new(|steps: &[BatchStep]| {
                    steps.iter().map(|_| StepResult::Completed(None)).collect()
                }) as BatchExecutor)
            },
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["enforcement"], "auto");
        assert!(json["grant_id"].is_null());
        assert_eq!(json["receipt"]["status"], "completed");
    }

    #[tokio::test]
    async fn http_risky_batch_defaults_to_per_step_and_halts_on_missing_grant() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let parsed: AciBatchBody = serde_json::from_value(json!({
            "steps": [
                {"method": "hover", "selector": "#a"},
                {"method": "click", "selector": "#b"},
            ],
        }))
        .unwrap();
        let receipts = BatchReceiptStore::new();
        let response = run_gated_batch(
            &state,
            "user-1",
            &parsed,
            &receipts,
            |_desc| -> Result<BatchExecutor, String> {
                Ok(Box::new(|steps: &[BatchStep]| {
                    steps.iter().map(|_| StepResult::Completed(None)).collect()
                }) as BatchExecutor)
            },
        )
        .await;
        // Step 1 (click) requires its own grant; none presented.
        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["error"], "confirmation_required");

        // The refusal is on the audit trail as a denied receipt.
        let denied = receipts
            .receipts()
            .into_iter()
            .find(|r| r.status == "denied")
            .expect("denied batch receipt recorded");
        assert_eq!(denied.halted_at, Some(1));
        assert_eq!(denied.steps[0].index, 1);
        assert_eq!(denied.steps[0].status, "denied");
    }

    #[tokio::test]
    async fn http_per_step_batch_executes_with_step_grants() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let descriptor = BatchDescriptor {
            origin: "aci.batch".to_string(),
            session: None,
            page_url: None,
            steps: vec![step("hover", "#a"), step("click", "#go")],
        };
        let hash = descriptor.hash();

        // Obtain a grant for step 1 via the per-step enforcement path.
        let denial = enforce_batch_step_grant_with_mode(
            crate::aci_safety::SafetyMode::Enforce,
            &state.approval_store,
            "user-1",
            "aci.batch",
            &hash,
            1,
            &descriptor.steps[1],
            None,
        )
        .unwrap_err();
        let approval_id = denial.body["approval_id"].as_str().unwrap().to_string();
        assert!(state.approval_store.approve(&approval_id));
        assert!(crate::aci_approvals::GRANTS.approve(&approval_id));

        let parsed: AciBatchBody = serde_json::from_value(json!({
            "steps": [
                {"method": "hover", "selector": "#a"},
                {"method": "click", "selector": "#go"},
            ],
            "stepApprovalIds": [null, approval_id],
        }))
        .unwrap();
        let receipts = BatchReceiptStore::new();
        let response = run_gated_batch(
            &state,
            "user-1",
            &parsed,
            &receipts,
            |_desc| -> Result<BatchExecutor, String> {
                Ok(Box::new(|steps: &[BatchStep]| {
                    steps.iter().map(|_| StepResult::Completed(None)).collect()
                }) as BatchExecutor)
            },
        )
        .await;
        assert_eq!(response.status(), StatusCode::OK);
        let bytes = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();
        let json: Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["enforcement"], "per_step");
        assert_eq!(json["receipt"]["status"], "completed");
    }

    #[tokio::test]
    async fn http_invalid_descriptor_is_400() {
        let temp = tempfile::tempdir().unwrap().keep();
        let state = crate::test_helpers::app_state(&temp).await;
        let (status, json) = post_batch(
            state,
            "user-1",
            json!({"steps": [{"method": "evaluate", "selector": "x"}]}),
        )
        .await;
        assert_eq!(status, StatusCode::BAD_REQUEST);
        assert_eq!(json["error"], "invalid batch descriptor");
    }
}
