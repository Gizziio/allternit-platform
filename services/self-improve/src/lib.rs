//! # allternit-self-improve
//!
//! Scaffolding for an evolutionary self-improvement loop in the
//! "agents-as-diffs" lineage (pattern: Meta's facebookresearch/hyperagents).
//! A meta-agent rewrites a task-agent's code; every generation is stored as
//! a diff from its parent; a protected evaluation surface can never appear
//! in a produced diff; a staged evaluation gate runs a cheap subset before
//! paying for a full evaluation.
//!
//! This crate is scaffolding, not a finished product: a clean, tested
//! foundation the platform can build a real self-improvement loop on top
//! of, not a wired-up one.
//!
//! ## Modules
//!
//! - [`lineage`]: the agents-as-diffs archive — [`lineage::Generation`]
//!   records, the append-only `archive.jsonl` index, parent-selection
//!   strategies ([`lineage::ParentSelection`]), and pure patch-chain
//!   reconstruction ([`lineage::LineageArchive::patch_chain`]).
//! - [`working_copy`]: working-copy lifecycle — scratch-copy a target repo
//!   ([`working_copy::WorkingCopy::create`]), apply an ordered patch chain
//!   with `git apply`, and produce a diff back out with protected paths
//!   force-reset and stripped — impossible by construction: filtered *and*
//!   re-verified, see [`working_copy::filter_patch_by_paths`].
//! - [`eval`]: the staged evaluation gate — traits only
//!   ([`eval::Evaluator`], [`eval::ValidityCheck`]), plus the
//!   [`eval::StagedGate`] orchestration and the [`eval::EvalReport`] shape
//!   recorded back onto a generation.
//!
//! ## What is intentionally NOT implemented here
//!
//! - **Container/VM execution of a generation's code.** Running an agent —
//!   against the eval suite or otherwise — happens entirely behind
//!   [`eval::Evaluator`] and [`eval::ValidityCheck`]. This crate has no
//!   opinion on *how* that happens, and doesn't spawn a container, VM, or
//!   sandbox itself. The only subprocesses it invokes are local `git apply`
//!   and `git diff` in [`working_copy`].
//! - **Any meta-agent, prompt, or model call.** There is no LLM or provider
//!   dependency anywhere in this crate. The "meta-agent rewrites the
//!   task-agent" step is entirely external to it and simply produces the
//!   patch files that [`lineage::LineageArchive::record`] stores.
//! - **A wired-up, scheduled, or persistent self-improvement loop.** This
//!   crate provides the primitives — lineage, working copy, gate — that a
//!   loop driving real generations with a real meta-agent and real
//!   evaluators would be built from. That loop is a later, separate piece
//!   of integration work.
//!
//! ## Later integration: the platform's `ExecutionDriver`
//!
//! When a real [`eval::Evaluator`] is implemented, it will need to actually
//! run the working copy's agent code somewhere isolated. The platform
//! already has that isolation boundary: `allternit_driver_interface::ExecutionDriver`
//! (`platform/contracts/driver-interface`), and
//! `cmd/allternit-api/src/agent_execution/mod.rs`'s `AgentRuntime` /
//! `JobSpec` dispatch pattern that already sits on top of it for running
//! agent jobs. The expected shape of that integration: a concrete
//! `Evaluator` dispatches a `JobSpec` (e.g. "run the eval suite against
//! `working_copy.path()`") through an `ExecutionDriver`, so a generation's
//! code is sandboxed the same way the rest of the platform's agent runs
//! already are, rather than this crate spawning processes or containers
//! itself. Nothing in this crate depends on that integration existing yet —
//! it's a note for whoever wires a real evaluator in, not a dependency.

pub mod eval;
pub mod lineage;
pub mod working_copy;
