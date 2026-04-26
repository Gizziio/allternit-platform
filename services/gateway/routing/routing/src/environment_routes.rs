//! Environment Specification Routes (N5)
//!
//! Provides REST API for:
//! - Resolving environment specs (devcontainer.json, Nix, Dockerfile, OCI)
//! - Converting to driver-compatible formats (rootfs, initramfs)
//! - Managing environment cache

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;

use crate::AppState;
use allternit_environment_spec::{EnvironmentSource, EnvironmentSpec, EnvironmentSpecLoader};

// ============================================================================
// Cache Tracking
// ============================================================================

/// Wrapper around EnvironmentSpecLoader that tracks cache hits/misses
pub struct EnvironmentSpecLoaderWithCache {
    /// Inner loader
    loader: EnvironmentSpecLoader,
    /// Cache of resolved source URIs
    cache: RwLock<HashSet<String>>,
    /// Cache hit counter
    hits: AtomicU64,
    /// Cache miss counter
    misses: AtomicU64,
}

impl EnvironmentSpecLoaderWithCache {
    /// Create a new loader with cache tracking
    pub fn new() -> Result<Self, allternit_environment_spec::EnvironmentSpecError> {
        Ok(Self {
            loader: EnvironmentSpecLoader::new()?,
            cache: RwLock::new(HashSet::new()),
            hits: AtomicU64::new(0),
            misses: AtomicU64::new(0),
        })
    }

    /// Load environment spec with cache tracking
    /// Returns (spec, was_cached)
    pub async fn load(
        &self,
        source: &str,
        force: bool,
    ) -> Result<(EnvironmentSpec, bool), allternit_environment_spec::EnvironmentSpecError> {
        let cache = self.cache.read().await;
        let is_cached = cache.contains(source);
        drop(cache);

        if is_cached && !force {
            // Cache hit - record and load
            self.hits.fetch_add(1, Ordering::Relaxed);
            let spec = self.loader.load(source).await?;
            Ok((spec, true))
        } else {
            // Cache miss - record, load, and add to cache
            self.misses.fetch_add(1, Ordering::Relaxed);
            let spec = self.loader.load(source).await?;

            // Add to cache if not forcing refresh
            if !force {
                let mut cache = self.cache.write().await;
                cache.insert(source.to_string());
            }

            Ok((spec, false))
        }
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        CacheStats {
            hits: self.hits.load(Ordering::Relaxed),
            misses: self.misses.load(Ordering::Relaxed),
        }
    }

    /// Get the inner loader for conversions
    pub fn inner(&self) -> &EnvironmentSpecLoader {
        &self.loader
    }

    /// Clear the cache
    pub async fn clear_cache(&self) {
        let mut cache = self.cache.write().await;
        cache.clear();
        self.hits.store(0, Ordering::Relaxed);
        self.misses.store(0, Ordering::Relaxed);
    }

    /// Get number of cached entries
    pub async fn entry_count(&self) -> usize {
        let cache = self.cache.read().await;
        cache.len()
    }
}

/// Cache statistics
#[derive(Debug, Clone, Copy, Serialize)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
}

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolveRequest {
    /// Source URI or path
    /// Examples:
    /// - ".devcontainer/devcontainer.json"
    /// - "github:user/repo" (Nix flake)
    /// - "ubuntu:22.04" (OCI image)
    /// - "Dockerfile"
    pub source: String,

    /// Force refresh (ignore cache)
    #[serde(default)]
    pub force: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolveResponse {
    /// Resolved environment specification
    pub spec: EnvironmentSpec,

    /// Source type detected
    pub source_type: String,

    /// Whether result was cached
    pub cached: bool,

    /// Resolution time in milliseconds
    pub resolve_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvertRequest {
    /// Source to convert
    pub source: String,

    /// Target format
    pub format: ConvertFormat,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ConvertFormat {
    /// ext4 rootfs for MicroVM
    Rootfs,
    /// initramfs for early boot
    Initramfs,
    /// OCI image tarball
    OciTar,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvertResponse {
    /// Path to converted artifact
    pub path: String,

    /// Size in bytes
    pub size_bytes: u64,

    /// Format
    pub format: String,

    /// Conversion time in milliseconds
    pub conversion_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvironmentTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub source_type: String,
    pub source: String,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheStatsResponse {
    /// Number of cached environments
    pub entries: usize,
    /// Total size in bytes
    pub total_size: u64,
    /// Maximum size in bytes
    pub max_size: u64,
    /// Cache utilization (0.0 - 1.0)
    pub utilization: f64,
    /// Cache hit count
    pub hits: u64,
    /// Cache miss count
    pub misses: u64,
}

// ============================================================================
// Routes
// ============================================================================

pub fn create_environment_routes() -> Router<Arc<AppState>> {
    Router::new()
        // Environment resolution
        .route("/api/v1/environment/resolve", post(resolve_environment))
        .route("/api/v1/environment/convert", post(convert_environment))
        // Templates
        .route("/api/v1/environment/templates", get(list_templates))
        .route("/api/v1/environment/templates/:id", get(get_template))
        // Cache management
        .route(
            "/api/v1/environment/cache",
            get(get_cache_stats).delete(clear_cache),
        )
        // Health check
        .route("/api/v1/environment/health", get(environment_health))
}

// ============================================================================
// Handlers
// ============================================================================

/// Resolve an environment specification
async fn resolve_environment(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ResolveRequest>,
) -> Result<Json<ResolveResponse>, StatusCode> {
    let start = std::time::Instant::now();

    // Use the shared environment spec loader from AppState with cache tracking
    let (spec, was_cached) = state
        .environment_loader
        .load(&request.source, request.force)
        .await
        .map_err(|e| {
            tracing::error!("Failed to resolve environment: {}", e);
            StatusCode::BAD_REQUEST
        })?;

    let elapsed = start.elapsed().as_millis() as u64;

    Ok(Json(ResolveResponse {
        source_type: spec.source.to_string(),
        spec,
        cached: was_cached,
        resolve_time_ms: elapsed,
    }))
}

/// Convert environment to target format
async fn convert_environment(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ConvertRequest>,
) -> Result<Json<ConvertResponse>, StatusCode> {
    let start = std::time::Instant::now();

    // Load the spec using the shared loader (force=false for conversion)
    let (spec, _was_cached) = state
        .environment_loader
        .load(&request.source, false)
        .await
        .map_err(|e| {
            tracing::error!("Failed to load spec for conversion: {}", e);
            StatusCode::BAD_REQUEST
        })?;

    // Convert to target format
    let (path, size_bytes, format_str) = match request.format {
        ConvertFormat::Rootfs => {
            let path = state
                .environment_loader
                .inner()
                .to_rootfs(&spec)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to build rootfs: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            let metadata = tokio::fs::metadata(&path)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            (
                path.to_string_lossy().to_string(),
                metadata.len(),
                "rootfs".to_string(),
            )
        }
        ConvertFormat::Initramfs => {
            let path = state
                .environment_loader
                .inner()
                .to_initramfs(&spec)
                .await
                .map_err(|e| {
                    tracing::error!("Failed to build initramfs: {}", e);
                    StatusCode::INTERNAL_SERVER_ERROR
                })?;

            let metadata = tokio::fs::metadata(&path)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            (
                path.to_string_lossy().to_string(),
                metadata.len(),
                "initramfs".to_string(),
            )
        }
        ConvertFormat::OciTar => {
            // OCI tarball is the cached image itself
            let cache_dir = dirs::cache_dir()
                .unwrap_or_else(|| std::env::temp_dir())
                .join("allternit")
                .join("oci-images")
                .join(sanitize_filename(&spec.image));

            let metadata = tokio::fs::metadata(&cache_dir)
                .await
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

            (
                cache_dir.to_string_lossy().to_string(),
                metadata.len(),
                "oci_tar".to_string(),
            )
        }
    };

    let elapsed = start.elapsed().as_millis() as u64;

    Ok(Json(ConvertResponse {
        path,
        size_bytes,
        format: format_str,
        conversion_time_ms: elapsed,
    }))
}

/// List predefined environment templates
async fn list_templates() -> Json<Vec<EnvironmentTemplate>> {
    Json(vec![
        EnvironmentTemplate {
            id: "rust".to_string(),
            name: "Rust Development".to_string(),
            description: "Official Rust dev container with cargo, rustfmt, clippy".to_string(),
            source_type: "devcontainer".to_string(),
            source: "mcr.microsoft.com/devcontainers/rust:1".to_string(),
            tags: vec![
                "rust".to_string(),
                "official".to_string(),
                "language".to_string(),
            ],
        },
        EnvironmentTemplate {
            id: "nodejs".to_string(),
            name: "Node.js Development".to_string(),
            description: "Node.js 20 with npm, yarn, pnpm".to_string(),
            source_type: "devcontainer".to_string(),
            source: "mcr.microsoft.com/devcontainers/javascript-node:20".to_string(),
            tags: vec![
                "nodejs".to_string(),
                "javascript".to_string(),
                "official".to_string(),
                "language".to_string(),
            ],
        },
        EnvironmentTemplate {
            id: "python".to_string(),
            name: "Python Development".to_string(),
            description: "Python 3.11 with pip, poetry, conda".to_string(),
            source_type: "devcontainer".to_string(),
            source: "mcr.microsoft.com/devcontainers/python:3.11".to_string(),
            tags: vec![
                "python".to_string(),
                "official".to_string(),
                "language".to_string(),
            ],
        },
        EnvironmentTemplate {
            id: "go".to_string(),
            name: "Go Development".to_string(),
            description: "Go 1.21 with gopls, delve".to_string(),
            source_type: "devcontainer".to_string(),
            source: "mcr.microsoft.com/devcontainers/go:1.21".to_string(),
            tags: vec![
                "go".to_string(),
                "golang".to_string(),
                "official".to_string(),
                "language".to_string(),
            ],
        },
        EnvironmentTemplate {
            id: "ubuntu".to_string(),
            name: "Ubuntu 22.04".to_string(),
            description: "Minimal Ubuntu environment".to_string(),
            source_type: "oci".to_string(),
            source: "ubuntu:22.04".to_string(),
            tags: vec![
                "ubuntu".to_string(),
                "linux".to_string(),
                "minimal".to_string(),
            ],
        },
        EnvironmentTemplate {
            id: "alpine".to_string(),
            name: "Alpine Linux".to_string(),
            description: "Minimal Alpine environment (5MB)".to_string(),
            source_type: "oci".to_string(),
            source: "alpine:latest".to_string(),
            tags: vec![
                "alpine".to_string(),
                "linux".to_string(),
                "minimal".to_string(),
                "small".to_string(),
            ],
        },
    ])
}

/// Get a specific template
async fn get_template(Path(id): Path<String>) -> Result<Json<EnvironmentTemplate>, StatusCode> {
    let templates = list_templates().await.0;

    templates
        .into_iter()
        .find(|t| t.id == id)
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

/// Get cache statistics
async fn get_cache_stats(State(state): State<Arc<AppState>>) -> Json<CacheStatsResponse> {
    // Get cache directory
    let cache_dir = dirs::cache_dir()
        .unwrap_or_else(|| std::env::temp_dir())
        .join("allternit")
        .join("environments");

    // Calculate stats
    let (entries, total_size) = if cache_dir.exists() {
        match calculate_dir_size(&cache_dir).await {
            Ok(size) => {
                let entries = std::fs::read_dir(&cache_dir)
                    .map(|d| d.count())
                    .unwrap_or(0);
                (entries, size)
            }
            Err(_) => (0, 0),
        }
    } else {
        (0, 0)
    };

    // Get cache hit/miss stats
    let stats = state.environment_loader.stats();
    let cached_entries = state.environment_loader.entry_count().await;

    let max_size = 10 * 1024 * 1024 * 1024; // 10GB default

    Json(CacheStatsResponse {
        entries: cached_entries,
        total_size,
        max_size,
        utilization: total_size as f64 / max_size as f64,
        hits: stats.hits,
        misses: stats.misses,
    })
}

/// Clear environment cache
async fn clear_cache(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    // Clear tracked cache entries
    state.environment_loader.clear_cache().await;

    // Also clear cache directory
    let cache_dir = dirs::cache_dir()
        .unwrap_or_else(|| std::env::temp_dir())
        .join("allternit")
        .join("environments");

    if cache_dir.exists() {
        tokio::fs::remove_dir_all(&cache_dir)
            .await
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    }

    Ok(Json(serde_json::json!({
        "status": "cache_cleared"
    })))
}

/// Environment service health check
async fn environment_health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "status": "healthy",
        "service": "environment-spec",
        "features": [
            "devcontainer",
            "nix",
            "dockerfile",
            "oci"
        ],
        "converters": [
            "rootfs",
            "initramfs"
        ],
        "timestamp": std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }))
}

// ============================================================================
// Helpers
// ============================================================================

/// Calculate directory size
async fn calculate_dir_size(path: &std::path::Path) -> Result<u64, std::io::Error> {
    let mut total = 0u64;

    for entry in walkdir::WalkDir::new(path) {
        let entry = entry?;
        if entry.file_type().is_file() {
            total += entry.metadata()?.len();
        }
    }

    Ok(total)
}

/// Sanitize filename
fn sanitize_filename(name: &str) -> String {
    name.replace('/', "_")
        .replace(':', "_")
        .replace('@', "_")
        .replace('.', "_")
}
