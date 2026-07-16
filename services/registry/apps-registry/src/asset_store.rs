//! S3-compatible object storage adapter for miniapp release assets.
//!
//! All uploads land in a **quarantine** bucket and are only copied to the
//! **published** bucket when the owning version is approved. Object keys are
//! content-addressed (`assets/<sha256>`) and uploads are presigned with an
//! enforced `x-amz-checksum-sha256`, so an object under a given key is
//! guaranteed to be that exact content — published assets are effectively
//! immutable and identical content deduplicates across miniapps.
//!
//! Configuration:
//! - `MINIAPP_ASSETS_QUARANTINE_BUCKET` / `MINIAPP_ASSETS_BUCKET` (required)
//! - `S3_REGION` (default `us-east-1`), credentials via the AWS default chain
//! - `S3_ENDPOINT` for S3-compatible backends (MinIO, R2; enables path-style)

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use aws_sdk_s3::Client;
use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::types::{ChecksumAlgorithm, ChecksumMode};
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use thiserror::Error;

const UPLOAD_EXPIRY: Duration = Duration::from_secs(15 * 60);
const DOWNLOAD_EXPIRY: Duration = Duration::from_secs(60 * 60);

#[derive(Clone)]
pub struct AssetStore {
    client: Client,
    quarantine_bucket: String,
    published_bucket: String,
}

#[derive(Debug, Error)]
pub enum AssetStoreError {
    #[error("invalid asset request: {0}")]
    Invalid(String),
    #[error("uploaded object not found in quarantine storage")]
    NotFound,
    #[error("uploaded object failed checksum/size verification")]
    VerificationFailed,
    #[error("storage backend error: {0}")]
    Storage(String),
}

/// Response to an upload intent: the client PUTs the bytes to `upload_url`
/// with exactly these headers.
#[derive(Debug)]
pub struct UploadGrant {
    pub storage_key: String,
    pub upload_url: String,
    pub headers: Vec<(String, String)>,
    pub expires_at: u64,
}

struct AssetPolicy {
    mimes: &'static [&'static str],
    max_size: i64,
}

fn policy_for(kind: &str) -> Option<AssetPolicy> {
    let policy = match kind {
        "icon" => AssetPolicy {
            mimes: &["image/png", "image/svg+xml", "image/webp"],
            max_size: 2 * 1024 * 1024,
        },
        "screenshot" => AssetPolicy {
            mimes: &["image/png", "image/webp", "image/jpeg"],
            max_size: 10 * 1024 * 1024,
        },
        "archive" => AssetPolicy {
            mimes: &["application/gzip", "application/zip", "application/x-tar"],
            max_size: 512 * 1024 * 1024,
        },
        "sbom" => AssetPolicy {
            mimes: &[
                "application/json",
                "application/vnd.cyclonedx+json",
                "text/plain",
            ],
            max_size: 20 * 1024 * 1024,
        },
        "scan_report" | "manifest" => AssetPolicy {
            mimes: &["application/json"],
            max_size: 20 * 1024 * 1024,
        },
        _ => return None,
    };
    Some(policy)
}

/// Validate a declared asset upload against the per-kind MIME and size policy.
pub fn validate_upload(
    kind: &str,
    sha256: &str,
    size: i64,
    mime: &str,
) -> Result<(), AssetStoreError> {
    let policy = policy_for(kind)
        .ok_or_else(|| AssetStoreError::Invalid(format!("unsupported asset kind: {kind}")))?;
    if sha256.len() != 64
        || !sha256.bytes().all(|b| b.is_ascii_hexdigit())
        || sha256.bytes().any(|b| b.is_ascii_uppercase())
    {
        return Err(AssetStoreError::Invalid(
            "sha256 must be 64 lowercase hex characters".into(),
        ));
    }
    if size <= 0 || size > policy.max_size {
        return Err(AssetStoreError::Invalid(format!(
            "size must be between 1 and {} bytes for kind {kind}",
            policy.max_size
        )));
    }
    if !policy.mimes.contains(&mime) {
        return Err(AssetStoreError::Invalid(format!(
            "mime {mime} is not allowed for kind {kind}"
        )));
    }
    Ok(())
}

/// Content-addressed object key shared by the quarantine and published buckets.
pub fn storage_key(sha256: &str) -> String {
    format!("assets/{sha256}")
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn decode_sha256(sha256: &str) -> Result<String, AssetStoreError> {
    let bytes = hex::decode(sha256)
        .map_err(|_| AssetStoreError::Invalid("sha256 must be hex-encoded".into()))?;
    Ok(BASE64.encode(bytes))
}

impl AssetStore {
    /// Build the store from environment configuration, or `None` when the
    /// bucket variables are unset (asset endpoints then answer 503).
    pub fn from_env(config: &aws_config::SdkConfig) -> Option<Self> {
        let quarantine_bucket = std::env::var("MINIAPP_ASSETS_QUARANTINE_BUCKET").ok()?;
        let published_bucket = std::env::var("MINIAPP_ASSETS_BUCKET").ok()?;
        let mut builder = aws_sdk_s3::config::Builder::from(config);
        if let Ok(endpoint) = std::env::var("S3_ENDPOINT") {
            // MinIO and other S3-compatible backends need path-style addressing.
            builder = builder.endpoint_url(endpoint).force_path_style(true);
        }
        Some(Self {
            client: Client::from_conf(builder.build()),
            quarantine_bucket,
            published_bucket,
        })
    }

    /// Presign a PUT into the quarantine bucket. The signed headers pin the
    /// content type, length, and SHA-256 checksum; S3 rejects the upload if
    /// the bytes do not match, which is what makes keys content-addressed.
    pub async fn presign_upload(
        &self,
        sha256: &str,
        size: i64,
        mime: &str,
    ) -> Result<UploadGrant, AssetStoreError> {
        let key = storage_key(sha256);
        let presigned = self
            .client
            .put_object()
            .bucket(&self.quarantine_bucket)
            .key(&key)
            .content_type(mime)
            .content_length(size)
            .checksum_algorithm(ChecksumAlgorithm::Sha256)
            .checksum_sha256(decode_sha256(sha256)?)
            .presigned(
                PresigningConfig::expires_in(UPLOAD_EXPIRY)
                    .map_err(|e| AssetStoreError::Storage(e.to_string()))?,
            )
            .await
            .map_err(|e| AssetStoreError::Storage(e.to_string()))?;
        let headers = presigned
            .headers()
            .map(|(name, value)| (name.to_string(), value.to_string()))
            .collect();
        Ok(UploadGrant {
            storage_key: key,
            upload_url: presigned.uri().to_string(),
            headers,
            expires_at: now_secs() + UPLOAD_EXPIRY.as_secs(),
        })
    }

    /// Verify a completed upload still matches the declared checksum and size
    /// before it is registered in the database.
    pub async fn verify_upload(
        &self,
        storage_key: &str,
        sha256: &str,
        size: i64,
    ) -> Result<(), AssetStoreError> {
        let head = self
            .client
            .head_object()
            .bucket(&self.quarantine_bucket)
            .key(storage_key)
            .checksum_mode(ChecksumMode::Enabled)
            .send()
            .await
            .map_err(|error| {
                let status = error
                    .raw_response()
                    .map(|response| response.status().as_u16());
                if status == Some(404) {
                    AssetStoreError::NotFound
                } else {
                    AssetStoreError::Storage(error.to_string())
                }
            })?;
        let expected = decode_sha256(sha256)?;
        if head.checksum_sha256() != Some(expected.as_str()) {
            return Err(AssetStoreError::VerificationFailed);
        }
        if head.content_length() != Some(size) {
            return Err(AssetStoreError::VerificationFailed);
        }
        Ok(())
    }

    /// Presign a GET. Quarantined objects are only reachable through here for
    /// reviewers and scanning workers; clients use the published bucket.
    pub async fn presign_download(
        &self,
        storage_key: &str,
        quarantined: bool,
    ) -> Result<(String, u64), AssetStoreError> {
        let bucket = if quarantined {
            &self.quarantine_bucket
        } else {
            &self.published_bucket
        };
        let presigned = self
            .client
            .get_object()
            .bucket(bucket)
            .key(storage_key)
            .presigned(
                PresigningConfig::expires_in(DOWNLOAD_EXPIRY)
                    .map_err(|e| AssetStoreError::Storage(e.to_string()))?,
            )
            .await
            .map_err(|e| AssetStoreError::Storage(e.to_string()))?;
        Ok((
            presigned.uri().to_string(),
            now_secs() + DOWNLOAD_EXPIRY.as_secs(),
        ))
    }

    /// Copy an object from quarantine to the published bucket. Idempotent:
    /// content-addressed keys mean the copy either creates the exact object or
    /// replaces it with identical bytes. The quarantined copy is retained for
    /// audit; bucket lifecycle rules can expire it later.
    pub async fn publish(&self, storage_key: &str) -> Result<(), AssetStoreError> {
        self.client
            .copy_object()
            .bucket(&self.published_bucket)
            .key(storage_key)
            .copy_source(format!("{}/{storage_key}", self.quarantine_bucket))
            .send()
            .await
            .map_err(|e| AssetStoreError::Storage(e.to_string()))?;
        Ok(())
    }
}
