//! Store consolidation boundary (A:// P-T1).
//!
//! ## What this store is
//!
//! The tables modeled in [`super::cowork_models`] (`runs`, `jobs`, `events`,
//! `checkpoints`, `approvals`, `schedules`, `attachments`, `tasks`) are the
//! **product-local projection** for Allternit Cloud's own hosted-runtime and
//! agent-session features. They are written only by this service's
//! `run_service` / `jobs` routes / `scheduler_service` / `executor_service` /
//! `event_store` and read by this service's REST API.
//!
//! ## What this store is not
//!
//! These tables are **not** the canonical A:// cowork run/job/event state.
//! Canonical A:// state (fabric transport: principals, intents, leases,
//! approvals, connector sessions, attribution) lives in the
//! `allternit-cowork-runtime` SQLite store served by `allternit-api` at
//! `/api/v1/fabric/transport/*`. Nothing in this service writes there, and
//! nothing here may be treated by other components as A:// execution
//! authority.
//!
//! ## Honest status (P-T1, 2026-09-13)
//!
//! **Not removable in this pass.** These tables back live cloud-product
//! routes (hosted runtimes, agent sessions, schedules, costs) with passing
//! e2e/integration tests; physically merging them into the canonical store
//! would be the risky single-pass merge P-T1 explicitly defers. The boundary
//! established instead:
//!
//! 1. Single writer per store: only this service's services/routes write
//!    these Postgres tables; the A:// fabric-transport store is written only
//!    by `allternit-cowork-runtime`'s `sqlite_store`.
//! 2. No cross-writes: no code path in this service writes the canonical
//!    A:// tables, and no A:// path writes these tables.
//! 3. Read-only consumer rule: any future surface that needs A:// cowork
//!    state must read it from the fabric-transport API, never derive it
//!    from these projection rows.
//!
//! Removal of this projection (collapse onto the canonical store) is future
//! physical-merge work gated on the cloud product's route surface being
//! rehomed first.
