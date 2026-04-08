//! Static file serving for the Allternit Platform UI.
//!
//! The Next.js platform is built with `output: 'export'` and `basePath: '/platform'`
//! which produces a static `out/` directory. In production the desktop build pipeline
//! copies that directory to `resources/platform/` alongside the binary.
//!
//! Route: GET /platform/* → serve from static dir
//! Route: GET /          → 301 → /platform/

use axum::{
    response::Redirect,
    routing::get,
    Router,
};
use std::path::PathBuf;
use tower_http::services::ServeDir;
use tracing::info;

/// Returns the path to the Next.js static export directory.
///
/// Resolution order:
///   1. `ALLTERNIT_PLATFORM_STATIC` env var
///   2. `<binary dir>/resources/platform`  (packaged app)
///   3. `<binary dir>/../../../surfaces/platform/out`  (dev monorepo layout)
fn resolve_static_path() -> PathBuf {
    if let Ok(p) = std::env::var("ALLTERNIT_PLATFORM_STATIC") {
        return PathBuf::from(p);
    }

    // Packaged app: binary is in resources/bin/, static is in resources/platform/
    if let Ok(exe) = std::env::current_exe() {
        let packaged = exe
            .parent()                   // bin/
            .and_then(|p| p.parent())   // resources/
            .map(|p| p.join("platform"));

        if let Some(p) = packaged {
            if p.exists() {
                return p;
            }
        }

        // Dev monorepo: binary in target/debug|release, static in surfaces/platform/out
        let dev = exe
            .parent()                           // debug | release
            .and_then(|p| p.parent())           // target/
            .and_then(|p| p.parent())           // repo root
            .map(|p| p.join("surfaces/platform/out"));

        if let Some(p) = dev {
            if p.exists() {
                return p;
            }
        }
    }

    // Fallback — will log a warning at startup
    PathBuf::from("./resources/platform")
}

pub fn platform_router() -> Router {
    let static_path = resolve_static_path();

    if static_path.exists() {
        info!("Serving platform UI from: {}", static_path.display());
    } else {
        tracing::warn!(
            "Platform static files not found at '{}'. \
             Run the desktop build pipeline (scripts/build-desktop.sh) first. \
             Set ALLTERNIT_PLATFORM_STATIC to override the path.",
            static_path.display()
        );
    }

    let serve_dir = ServeDir::new(static_path)
        .not_found_service(ServeDir::new(resolve_static_path())); // SPA fallback

    Router::new()
        // Root redirect → platform
        .route("/", get(|| async { Redirect::permanent("/platform") }))
        // Serve static assets under /platform
        .nest_service("/platform", serve_dir)
}
