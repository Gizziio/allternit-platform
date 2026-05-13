use axum::Router;
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::services::ServeDir;
use tracing::info;

use crate::AppState;

pub fn resolve_static_path() -> PathBuf {
    if let Ok(p) = std::env::var("ALLTERNIT_PLATFORM_STATIC") {
        return PathBuf::from(p);
    }
    if let Ok(exe) = std::env::current_exe() {
        let packaged = exe
            .parent()
            .and_then(|p| p.parent())
            .map(|p| p.join("platform"));
        if let Some(p) = packaged {
            if p.exists() {
                return p;
            }
        }
        let repo_root = exe.parent().and_then(|p| p.parent());
        if let Some(root) = repo_root {
            let ai_dist = root.join("surfaces/ai.allternit.com/dist");
            if ai_dist.exists() {
                return ai_dist;
            }
            let ai_out = root.join("surfaces/ai.allternit.com/out");
            if ai_out.exists() {
                return ai_out;
            }
            let legacy = root.join("surfaces/platform/out");
            if legacy.exists() {
                return legacy;
            }
        }
    }
    PathBuf::from("./resources/platform")
}

pub fn platform_router() -> Router<Arc<AppState>> {
    let static_path = resolve_static_path();
    if static_path.exists() {
        info!("Serving platform UI from: {}", static_path.display());
    } else {
        // Only warn if user explicitly configured a path; default fallback is expected
        // to be missing in development before the Next.js build step runs.
        let is_explicit = std::env::var("ALLTERNIT_PLATFORM_STATIC").is_ok();
        if is_explicit {
            tracing::warn!("Platform static files not found at '{}'", static_path.display());
        } else {
            tracing::info!("Platform static files not found at '{}' (skipping — run Next.js build to generate)", static_path.display());
        }
    }

    // Serve static files at the root path for offline mode.
    // Fallback to index.html for client-side routing (Next.js SPA behavior).
    let index_path = static_path.join("index.html");
    let serve_dir = ServeDir::new(&static_path)
        .append_index_html_on_directories(true);

    let _fallback = if index_path.exists() {
        ServeDir::new(&static_path)
            .append_index_html_on_directories(true)
    } else {
        ServeDir::new(&static_path)
            .append_index_html_on_directories(true)
    };

    Router::new().fallback_service(serve_dir)
}
