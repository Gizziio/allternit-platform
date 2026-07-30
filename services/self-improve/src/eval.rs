//! Staged evaluation gate: traits and types only.
//!
//! No real evaluator lives here, no LLM/provider calls, no network. Concrete
//! implementations of [`ValidityCheck`] and [`Evaluator`] are provided
//! downstream and plugged into [`StagedGate`]; this module only defines the
//! boundary and the gate logic that sits between them.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// Errors returned by evaluation traits and the staged gate.
#[derive(Debug, thiserror::Error)]
pub enum EvalError {
    #[error("evaluator error: {0}")]
    Evaluator(String),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("serialization error: {0}")]
    Serde(#[from] serde_json::Error),
}

pub type Result<T> = std::result::Result<T, EvalError>;

/// One evaluation's scores, keyed by metric/task name, plus overall
/// validity. This is the `report.json` shape recorded back onto a
/// generation.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
pub struct EvalReport {
    pub scores: HashMap<String, f64>,
    pub valid: bool,
    /// Fraction of the eval suite this report covers: e.g. 0.1 for a staged
    /// subset run, 1.0 for a full run, 0.0 if validity failed before any
    /// evaluator ran.
    pub fraction: f64,
}

impl EvalReport {
    /// The gate condition for promoting a staged subset run to a full run:
    /// every recorded score is strictly positive (and there's at least one).
    pub fn all_positive(&self) -> bool {
        !self.scores.is_empty() && self.scores.values().all(|score| *score > 0.0)
    }

    pub fn mean_score(&self) -> Option<f64> {
        if self.scores.is_empty() {
            return None;
        }
        Some(self.scores.values().sum::<f64>() / self.scores.len() as f64)
    }

    pub fn write_to(&self, path: &Path) -> Result<()> {
        let json = serde_json::to_vec_pretty(self)?;
        std::fs::write(path, json)?;
        Ok(())
    }
}

/// A compile/typecheck gate, run before any evaluation is attempted. Real
/// implementations shell out to `cargo check`, `bun tsc`, etc. — this crate
/// only defines the boundary.
pub trait ValidityCheck: Send + Sync {
    fn check(&self, agent: &Path) -> Result<bool>;
}

/// A scored evaluation over (a fraction of) the eval suite. Real
/// implementations run the agent against tasks and score it, behind
/// whatever execution boundary the caller provides — see `src/lib.rs` for
/// how this is expected to eventually reach the platform's
/// `ExecutionDriver`. No LLM/provider calls happen in this crate.
pub trait Evaluator: Send + Sync {
    fn eval_subset(&self, agent: &Path, fraction: f64) -> Result<EvalReport>;
}

/// Orchestrates the staged gate: a validity check, then a cheap staged
/// subset eval, and only if every staged score is `> 0`, the full eval. Pure
/// orchestration over the two traits above — no IO of its own beyond what
/// they perform.
pub struct StagedGate<'a> {
    validity: &'a dyn ValidityCheck,
    evaluator: &'a dyn Evaluator,
    stage_fraction: f64,
}

// Manual impl, not #[derive(Debug)]: ValidityCheck/Evaluator don't require
// Debug as a supertrait, so `&dyn ValidityCheck`/`&dyn Evaluator` aren't
// Debug and a derive would fail to compile.
impl std::fmt::Debug for StagedGate<'_> {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StagedGate").field("stage_fraction", &self.stage_fraction).finish_non_exhaustive()
    }
}

impl<'a> StagedGate<'a> {
    pub fn new(validity: &'a dyn ValidityCheck, evaluator: &'a dyn Evaluator, stage_fraction: f64) -> Self {
        Self { validity, evaluator, stage_fraction }
    }

    /// Runs validity, then the staged subset, then (conditionally) the full
    /// eval. Always returns a report — an invalid or staged-failed
    /// generation is represented as `EvalReport { valid: false, .. }`, not
    /// an `Err`; `Err` is reserved for the checks/evaluator themselves
    /// failing to run.
    pub fn run(&self, agent: &Path) -> Result<EvalReport> {
        let valid = self.validity.check(agent)?;
        if !valid {
            return Ok(EvalReport { scores: HashMap::new(), valid: false, fraction: 0.0 });
        }

        let staged = self.evaluator.eval_subset(agent, self.stage_fraction)?;
        if !staged.all_positive() {
            return Ok(EvalReport { valid: false, ..staged });
        }

        let full = self.evaluator.eval_subset(agent, 1.0)?;
        Ok(EvalReport { valid: full.all_positive(), ..full })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap as StdHashMap;
    use std::sync::atomic::{AtomicU32, Ordering};

    struct MockValidity {
        result: bool,
    }
    impl ValidityCheck for MockValidity {
        fn check(&self, _agent: &Path) -> Result<bool> {
            Ok(self.result)
        }
    }

    /// Returns `staged_scores` for `fraction < 1.0` and `full_scores` for a
    /// full run, tracking how many times each was requested. Uses an atomic
    /// (not `Cell`) so the mock stays `Sync`, matching the `Evaluator: Send
    /// + Sync` bound.
    struct MockEvaluator {
        staged_scores: StdHashMap<String, f64>,
        full_scores: StdHashMap<String, f64>,
        calls: AtomicU32,
    }
    impl Evaluator for MockEvaluator {
        fn eval_subset(&self, _agent: &Path, fraction: f64) -> Result<EvalReport> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            let (scores, fraction) =
                if fraction >= 1.0 { (self.full_scores.clone(), 1.0) } else { (self.staged_scores.clone(), fraction) };
            Ok(EvalReport { scores, valid: true, fraction })
        }
    }

    #[test]
    fn invalid_agent_never_reaches_the_evaluator() {
        let validity = MockValidity { result: false };
        let evaluator = MockEvaluator { staged_scores: StdHashMap::new(), full_scores: StdHashMap::new(), calls: AtomicU32::new(0) };
        let gate = StagedGate::new(&validity, &evaluator, 0.1);

        let report = gate.run(Path::new("/agent")).unwrap();
        assert!(!report.valid);
        assert!(report.scores.is_empty());
        assert_eq!(evaluator.calls.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn failed_staged_scores_skip_the_full_eval() {
        let validity = MockValidity { result: true };
        let evaluator = MockEvaluator {
            staged_scores: StdHashMap::from([("task1".to_string(), -0.5)]),
            full_scores: StdHashMap::from([("task1".to_string(), 1.0)]),
            calls: AtomicU32::new(0),
        };
        let gate = StagedGate::new(&validity, &evaluator, 0.1);

        let report = gate.run(Path::new("/agent")).unwrap();
        assert!(!report.valid);
        assert_eq!(report.scores.get("task1"), Some(&-0.5));
        assert_eq!(evaluator.calls.load(Ordering::SeqCst), 1, "full eval must not run when staged scores aren't all positive");
    }

    #[test]
    fn passing_staged_scores_promote_to_a_full_eval() {
        let validity = MockValidity { result: true };
        let evaluator = MockEvaluator {
            staged_scores: StdHashMap::from([("task1".to_string(), 0.5)]),
            full_scores: StdHashMap::from([("task1".to_string(), 0.9), ("task2".to_string(), 0.8)]),
            calls: AtomicU32::new(0),
        };
        let gate = StagedGate::new(&validity, &evaluator, 0.1);

        let report = gate.run(Path::new("/agent")).unwrap();
        assert!(report.valid);
        assert_eq!(report.fraction, 1.0);
        assert_eq!(report.scores.len(), 2);
        assert_eq!(evaluator.calls.load(Ordering::SeqCst), 2, "staged then full");
    }

    #[test]
    fn a_full_eval_that_regresses_is_marked_invalid() {
        let validity = MockValidity { result: true };
        let evaluator = MockEvaluator {
            staged_scores: StdHashMap::from([("task1".to_string(), 0.5)]),
            full_scores: StdHashMap::from([("task1".to_string(), 0.9), ("task2".to_string(), -0.1)]),
            calls: AtomicU32::new(0),
        };
        let gate = StagedGate::new(&validity, &evaluator, 0.1);

        let report = gate.run(Path::new("/agent")).unwrap();
        assert!(!report.valid, "a non-positive score in the full run must still fail the gate");
    }

    #[test]
    fn report_round_trips_through_write_to() {
        let dir = tempfile::tempdir().unwrap();
        let report = EvalReport { scores: StdHashMap::from([("task1".to_string(), 1.0)]), valid: true, fraction: 1.0 };
        let path = dir.path().join("report.json");
        report.write_to(&path).unwrap();

        let read_back: EvalReport = serde_json::from_str(&std::fs::read_to_string(&path).unwrap()).unwrap();
        assert_eq!(read_back, report);
    }
}
