//! Model download pipeline.

pub mod huggingface;
pub mod task;

pub use huggingface::{
    file_url, list_target_files, should_download, validate_repo_id, verify_repo, HuggingFaceError,
    TreeEntry,
};
pub use task::{build_cached_model, spawn_download_task};
