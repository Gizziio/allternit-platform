//! Background download task.

use crate::cache::store::ModelStore;
use crate::cache::model::CachedModel;
use crate::download::huggingface::{self, entry_size, file_url};
use std::path::PathBuf;
use tokio::fs;
use tokio::io::AsyncWriteExt;
use tracing::{debug, error, info, warn};

/// Start a download in the background.
///
/// The caller is expected to have already inserted a `CachedModel` record
/// into the store with status `Pending`. This function transitions it to
/// `Downloading`, streams every target file, and finally marks it `Ready`
/// or `Failed`.
pub fn spawn_download_task(
    store: ModelStore,
    model_id: String,
    repo_id: String,
    revision: String,
    models_dir: PathBuf,
) {
    tokio::spawn(async move {
        if let Err(err) = run_download(&store, &model_id, &repo_id, &revision, &models_dir).await {
            error!(%model_id, %err, "download task failed");
            store.set_failed(&model_id, err.to_string()).await;
        }
    });
}

#[derive(Debug, thiserror::Error)]
enum DownloadError {
    #[error("Hugging Face error: {0}")]
    Hf(#[from] huggingface::HuggingFaceError),
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("http error: {0}")]
    Http(#[from] reqwest::Error),
}

async fn run_download(
    store: &ModelStore,
    model_id: &str,
    repo_id: &str,
    revision: &str,
    models_dir: &PathBuf,
) -> Result<(), DownloadError> {
    info!(%model_id, %repo_id, %revision, "starting model download");

    store.set_downloading(model_id).await;

    // Verify repo and list files.
    huggingface::verify_repo(repo_id).await?;
    let files = huggingface::list_target_files(repo_id, revision).await?;

    if files.is_empty() {
        warn!(%repo_id, "no target files found");
    }

    let total_bytes: u64 = files.iter().map(entry_size).sum();
    store.update_progress(model_id, 0, total_bytes).await;

    let client = reqwest::Client::new();
    let mut downloaded_bytes: u64 = 0;

    for entry in &files {
        let filename = &entry.path;
        let file_total = entry_size(entry);

        let target = huggingface::safe_model_file(models_dir, repo_id, filename)?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).await?;
        }

        let part_path = target.with_extension(
            format!("{}.part", target.extension().unwrap_or_default().to_string_lossy())
        );

        let existing = match fs::metadata(&part_path).await {
            Ok(meta) => meta.len(),
            Err(_) => 0,
        };

        // If the .part file already exists and is complete, finish early.
        if existing > 0 && file_total > 0 && existing == file_total {
            debug!(%filename, "part file already complete");
            fs::rename(&part_path, &target).await?;
            downloaded_bytes += file_total;
            store.update_progress(model_id, downloaded_bytes, total_bytes).await;
            continue;
        }

        let url = file_url(repo_id, revision, filename);
        let mut request = client.get(&url);

        // Resume incomplete downloads when the partial file is smaller than expected.
        if existing > 0 && (file_total == 0 || existing < file_total) {
            debug!(%filename, start = existing, "resuming partial download");
            request = request.header("Range", format!("bytes={}-", existing));
        }

        let mut response = request.send().await?;
        response.error_for_status_ref()?;

        // Open the partial file for appending (or create).
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&part_path)
            .await?;

        // If we started from scratch but the server ignored Range, reset the file.
        if existing > 0 && response.status() == 200 {
            file.set_len(0).await?;
        }

        let mut chunk_count = 0u64;
        while let Some(chunk) = response.chunk().await? {
            file.write_all(&chunk).await?;
            chunk_count += chunk.len() as u64;
            downloaded_bytes += chunk.len() as u64;

            // Throttle store updates to every ~1 MiB or on the last chunk.
            if chunk_count >= 1024 * 1024 || downloaded_bytes >= total_bytes {
                store.update_progress(model_id, downloaded_bytes.min(total_bytes), total_bytes).await;
                chunk_count = 0;
            }
        }

        file.flush().await?;
        drop(file);

        // Atomically promote the partial file to the final filename.
        fs::rename(&part_path, &target).await?;
        info!(%filename, "download complete");
    }

    // Final accounting: clamp to total and mark ready.
    store.update_progress(model_id, total_bytes, total_bytes).await;
    store.set_ready(model_id).await;
    info!(%model_id, "model download ready");

    Ok(())
}

/// Public helper to create the initial `CachedModel` record for a download.
pub fn build_cached_model(
    repo_id: &str,
    revision: &str,
    quantization: Option<String>,
    models_dir: &PathBuf,
) -> CachedModel {
    let id = ModelStore::model_id(repo_id, revision, quantization.as_deref());
    let path = models_dir.join(ModelStore::normalize_repo_id(repo_id));
    CachedModel::new(id.clone(), repo_id, revision, quantization, path)
}
