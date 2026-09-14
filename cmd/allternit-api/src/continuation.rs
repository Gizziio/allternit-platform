//! Laptop → always-on data-plane continuation (Cowork E6).
//!
//! Local retag (`compute.cloud`) is not enough: the local API shuts down
//! with the laptop. This module POSTs ingest bundles (intent envelope + a
//! bounded copy of granted folders) to `ALLTERNIT_CONTINUATION_API_URL`.
//! Fail closed when that URL or the shared token is missing.

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

use crate::config::AppConfig;

pub const CONTINUATION_TOKEN_HEADER: &str = "x-allternit-continuation-token";
const MAX_FILE_BYTES: u64 = 1_048_576;
const MAX_BUNDLE_BYTES: u64 = 20 * 1_048_576;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContinuationFile {
    pub path: String,
    pub content_base64: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContinuationBundle {
    pub envelope: serde_json::Value,
    #[serde(default)]
    pub files: Vec<ContinuationFile>,
}

pub fn verify_continuation_token(headers: &axum::http::HeaderMap, config: &AppConfig) -> bool {
    let expected = match config.continuation_token() {
        Some(t) => t,
        None => return false,
    };
    let provided = headers
        .get(CONTINUATION_TOKEN_HEADER)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    !provided.is_empty() && crate::auth::constant_time_eq(provided, &expected)
}

/// Walk granted folders; skip symlinks, skip files > 1 MiB, stop at 20 MiB.
pub fn pack_trusted_folders(folders: &[String]) -> Result<Vec<ContinuationFile>, String> {
    let mut out = Vec::new();
    let mut total: u64 = 0;
    for root in folders {
        let root = PathBuf::from(root);
        if !root.is_dir() {
            continue;
        }
        pack_dir(&root, &root, &mut out, &mut total)?;
    }
    Ok(out)
}

fn pack_dir(
    root: &Path,
    dir: &Path,
    out: &mut Vec<ContinuationFile>,
    total: &mut u64,
) -> Result<(), String> {
    let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let meta = match entry.metadata() {
            Ok(m) => m,
            Err(_) => continue,
        };
        if meta.file_type().is_symlink() {
            continue;
        }
        if meta.is_dir() {
            if path.file_name().and_then(|n| n.to_str()) == Some(".git") {
                continue;
            }
            pack_dir(root, &path, out, total)?;
            continue;
        }
        if !meta.is_file() {
            continue;
        }
        if meta.len() > MAX_FILE_BYTES {
            continue;
        }
        if *total + meta.len() > MAX_BUNDLE_BYTES {
            return Err("trusted folder bundle exceeds 20 MiB".to_string());
        }
        let bytes = std::fs::read(&path).map_err(|e| e.to_string())?;
        *total += bytes.len() as u64;
        let rel = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        let folder_name = root
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("folder");
        out.push(ContinuationFile {
            path: format!("{folder_name}/{rel}"),
            content_base64: base64_encode(&bytes),
        });
    }
    Ok(())
}

fn base64_encode(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

pub fn write_ingested_files(workspace: &Path, files: &[ContinuationFile]) -> Result<usize, String> {
    std::fs::create_dir_all(workspace).map_err(|e| e.to_string())?;
    let mut n = 0;
    for file in files {
        if file.path.contains("..") || Path::new(&file.path).is_absolute() {
            continue;
        }
        let dest = workspace.join(&file.path);
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let bytes = base64_decode(&file.content_base64)?;
        if bytes.len() as u64 > MAX_FILE_BYTES {
            continue;
        }
        std::fs::write(&dest, bytes).map_err(|e| e.to_string())?;
        n += 1;
    }
    Ok(n)
}

fn base64_decode(s: &str) -> Result<Vec<u8>, String> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(s)
        .map_err(|e| e.to_string())
}

/// POST each job envelope to the always-on API. Returns how many were accepted.
pub async fn forward_bundles(
    config: &AppConfig,
    target_url: &str,
    bundles: &[ContinuationBundle],
) -> Result<usize, String> {
    let token = config
        .continuation_token()
        .ok_or_else(|| "ALLTERNIT_CONTINUATION_TOKEN is not set".to_string())?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;
    let ingest = format!(
        "{}/api/v1/fabric/transport/continuation/ingest",
        target_url.trim_end_matches('/')
    );
    let mut ok = 0;
    for bundle in bundles {
        let res = client
            .post(&ingest)
            .header(CONTINUATION_TOKEN_HEADER, &token)
            .json(bundle)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !res.status().is_success() {
            let body = res.text().await.unwrap_or_default();
            return Err(format!("ingest failed: {body}"));
        }
        ok += 1;
    }
    Ok(ok)
}

pub fn resolve_target(config: &AppConfig, prefs_url: Option<&str>) -> Option<String> {
    config
        .continuation_api_url()
        .or_else(|| {
            prefs_url
                .map(|s| s.trim().trim_end_matches('/').to_string())
                .filter(|s| !s.is_empty())
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn pack_skips_symlinks_and_oversize() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path().join("grant");
        std::fs::create_dir(&root).unwrap();
        std::fs::write(root.join("ok.txt"), b"hello").unwrap();
        let mut big = std::fs::File::create(root.join("big.bin")).unwrap();
        big.write_all(&vec![0u8; (MAX_FILE_BYTES as usize) + 10])
            .unwrap();
        drop(big);
        let files = pack_trusted_folders(&[root.to_string_lossy().to_string()]).unwrap();
        assert_eq!(files.len(), 1);
        assert!(files[0].path.ends_with("ok.txt"));
    }

    #[test]
    fn write_ingested_refuses_dotdot() {
        let dir = tempfile::tempdir().unwrap();
        let n = write_ingested_files(
            dir.path(),
            &[ContinuationFile {
                path: "../escape.txt".into(),
                content_base64: base64_encode(b"nope"),
            }],
        )
        .unwrap();
        assert_eq!(n, 0);
        assert!(!dir.path().join("escape.txt").exists());
    }
}
