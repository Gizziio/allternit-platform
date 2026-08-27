//! Model download pipeline.

pub mod huggingface;
pub mod task;

pub use huggingface::{HuggingFaceError, TreeEntry, verify_repo, list_target_files, file_url, should_download, validate_repo_id};
pub use task::{spawn_download_task, build_cached_model};
