//! Hugging Face Hub download utilities.

use reqwest;
use serde::Deserialize;
use std::path::{Component, Path, PathBuf};
use thiserror::Error;
use tracing::{debug, error};

const HUGGINGFACE_API: &str = "https://huggingface.co/api/models";

/// Errors that can occur when interacting with Hugging Face.
#[derive(Debug, Error)]
pub enum HuggingFaceError {
    #[error("invalid repo id: {0}")]
    InvalidRepoId(String),
    #[error("repo not found: {0}")]
    NotFound(String),
    #[error("network error: {0}")]
    Network(#[from] reqwest::Error),
    #[error("api error: {0}")]
    Api(String),
}

/// A file entry returned by the Hugging Face tree API.
#[derive(Debug, Clone, Deserialize)]
pub struct TreeEntry {
    pub path: String,
    #[serde(rename = "type")]
    pub entry_type: String,
    pub size: Option<u64>,
    pub oid: Option<String>,
    #[serde(default)]
    pub lfs: Option<HfLfsInfo>,
}

/// LFS metadata for a file.
#[derive(Debug, Clone, Deserialize)]
pub struct HfLfsInfo {
    pub size: Option<u64>,
}

/// Validate that a repo id is safe to use.
///
/// Rejects empty ids, absolute paths, path traversal (`..`), and suspicious
/// characters that could break filesystem layout.
pub fn validate_repo_id(repo_id: &str) -> Result<&str, HuggingFaceError> {
    if repo_id.is_empty() {
        return Err(HuggingFaceError::InvalidRepoId(
            "repo_id must not be empty".into(),
        ));
    }

    if repo_id.starts_with('/') || repo_id.starts_with('\\') {
        return Err(HuggingFaceError::InvalidRepoId(
            "repo_id must not be an absolute path".into(),
        ));
    }

    if repo_id.contains("..") {
        return Err(HuggingFaceError::InvalidRepoId(
            "repo_id must not contain '..'".into(),
        ));
    }

    for part in repo_id.split('/') {
        if part.is_empty() || part == "." || part == ".." {
            return Err(HuggingFaceError::InvalidRepoId(format!(
                "repo_id contains invalid segment: {}",
                part
            )));
        }
    }

    Ok(repo_id)
}

/// Return `true` if `child` is contained within `base` after normalization.
pub fn is_inside_base(base: &Path, child: &Path) -> bool {
    let base = base.canonicalize().unwrap_or_else(|_| base.to_path_buf());
    let child = child.canonicalize().unwrap_or_else(|_| child.to_path_buf());
    child.starts_with(&base)
}

/// Ensure a resolved file path stays under the models directory.
pub fn safe_model_file(base: &Path, repo_id: &str, filename: &str) -> Result<PathBuf, HuggingFaceError> {
    let normalized = repo_id.replace('/', "--");
    let target = base.join(normalized).join(filename);

    // Reject any filename that tries to escape with `..`.
    for component in target.components() {
        if matches!(component, Component::ParentDir) {
            return Err(HuggingFaceError::InvalidRepoId(
                "filename contains path traversal".into(),
            ));
        }
    }

    if !is_inside_base(base, &target) {
        return Err(HuggingFaceError::InvalidRepoId(
            "resolved path escapes models_dir".into(),
        ));
    }

    Ok(target)
}

/// Return `true` if a file from the Hub should be downloaded for local inference.
pub fn should_download(path: &str) -> bool {
    let lower = path.to_lowercase();
    let name = std::path::Path::new(path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(path);

    // Always keep core config/tokenizer files.
    let keep_always = [
        "config.json",
        "tokenizer.json",
        "tokenizer_config.json",
        "generation_config.json",
        "preprocessor_config.json",
        "vocab.json",
        "merges.txt",
    ];
    if keep_always.contains(&name) {
        return true;
    }

    // Weight file extensions.
    let weight_exts = [
        ".safetensors", ".bin", ".gguf", ".mlx", ".pt", ".pth",
    ];
    if weight_exts.iter().any(|ext| lower.ends_with(ext)) {
        return true;
    }

    // Explicitly ignore common non-weight files, including `.json`/`.txt` that
    // are not in the keep-always list.
    let ignore_exts = [
        ".gitattributes",
        ".md",
        ".txt",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".svg",
        ".ico",
        ".yaml",
        ".yml",
        ".json",
    ];
    if ignore_exts.iter().any(|ext| lower.ends_with(ext)) {
        return false;
    }

    if lower.starts_with("readme") {
        return false;
    }

    // Default to keeping unknown files; they may be custom model components.
    true
}

/// Size to use for a tree entry.
pub fn entry_size(entry: &TreeEntry) -> u64 {
    entry
        .lfs
        .as_ref()
        .and_then(|l| l.size)
        .or(entry.size)
        .unwrap_or(0)
}

/// Verify that a repo exists on Hugging Face.
pub async fn verify_repo(repo_id: &str) -> Result<(), HuggingFaceError> {
    validate_repo_id(repo_id)?;

    let url = format!("{}/{}", HUGGINGFACE_API, repo_id);
    debug!(%url, "verifying Hugging Face repo");

    let client = reqwest::Client::new();
    let resp = client.get(&url).send().await?;

    match resp.status() {
        s if s.is_success() => Ok(()),
        s if s.as_u16() == 404 => Err(HuggingFaceError::NotFound(repo_id.into())),
        _ => {
            let text = resp.text().await.unwrap_or_default();
            error!(%text, "Hugging Face API returned error");
            Err(HuggingFaceError::Api(text))
        }
    }
}

/// List files we want to download from a repo revision.
pub async fn list_target_files(
    repo_id: &str,
    revision: &str,
) -> Result<Vec<TreeEntry>, HuggingFaceError> {
    validate_repo_id(repo_id)?;

    let url = format!(
        "{}/{}/tree/{}",
        HUGGINGFACE_API, repo_id, revision
    );
    debug!(%url, "listing Hugging Face repo tree");

    let client = reqwest::Client::new();
    let resp = client.get(&url).send().await?;

    if resp.status().as_u16() == 404 {
        return Err(HuggingFaceError::NotFound(format!(
            "{} revision {}",
            repo_id, revision
        )));
    }

    resp.error_for_status_ref().map_err(|e| {
        let status = resp.status();
        HuggingFaceError::Api(format!("{}: {}", status, e))
    })?;

    let entries: Vec<TreeEntry> = resp.json().await?;
    let filtered: Vec<TreeEntry> = entries
        .into_iter()
        .filter(|e| e.entry_type == "file" && should_download(&e.path))
        .collect();

    debug!(count = filtered.len(), "filtered target files");
    Ok(filtered)
}

/// Build the CDN URL for a single file.
pub fn file_url(repo_id: &str, revision: &str, path: &str) -> String {
    format!(
        "https://huggingface.co/{}/resolve/{}/{}",
        repo_id, revision, path
    )
}
