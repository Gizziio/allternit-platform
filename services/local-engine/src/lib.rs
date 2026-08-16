//! # Allternit Local Engine
//!
//! Downloads models from Hugging Face and manages local inference runtimes.
//!
//! ## Modules
//!
//! - `cache`: metadata storage for downloaded models.
//! - `download`: Hugging Face verification, file filtering, and background
//!   download tasks.
//! - `runtime`: process manager that launches backends such as llama.cpp and
//!   polls their health endpoints.
//! - `routes`: axum HTTP handlers for `/models/download` and `/status`.

pub mod cache;
pub mod download;
pub mod runtime;
pub mod routes;

use std::path::PathBuf;

// Re-export the most commonly used types.
pub use cache::{CachedModel, ModelSource, ModelStatus, ModelStore};
pub use download::{
    build_cached_model, spawn_download_task, HuggingFaceError, TreeEntry,
};
pub use runtime::{
    ProcessManager, RuntimeInfo, RuntimeManagerError, RuntimeRecipe, RuntimeStatus,
};

/// Shared application state used by all HTTP routes.
#[derive(Clone)]
pub struct AppState {
    pub store: ModelStore,
    pub manager: ProcessManager,
    pub models_dir: PathBuf,
}
