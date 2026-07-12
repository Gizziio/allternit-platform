use std::path::PathBuf;
use tower_http::services::{ServeDir, ServeFile};
use tracing::info;

/// Resolve the project/package root from the current executable path.
///
/// - Packaged desktop app: `.../Contents/MacOS/allternit-api` → `.../Contents`
/// - Repo dev build: `.../allternit/target/debug/allternit-api` → `.../allternit`
fn resolve_project_root() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let mut cur = exe.parent()?;

    // Packaged macOS desktop layout: Contents/MacOS/<binary>
    if cur.file_name()?.to_str()? == "MacOS" {
        return cur.parent().map(|p| p.to_path_buf());
    }

    // Repo build: walk up until we find the workspace Cargo.toml.
    loop {
        if cur.join("Cargo.toml").exists() {
            return Some(cur.to_path_buf());
        }
        match cur.parent() {
            Some(p) => cur = p,
            None => break,
        }
    }

    None
}

pub fn resolve_static_path() -> PathBuf {
    if let Ok(p) = std::env::var("ALLTERNIT_PLATFORM_STATIC") {
        return PathBuf::from(p);
    }
    if let Some(root) = resolve_project_root() {
        // Packaged layout: <root>/platform (macOS: Contents/platform)
        let packaged = root.join("platform");
        if packaged.exists() {
            return packaged;
        }
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
    PathBuf::from("./resources/platform")
}

/// Build a static-file service for the platform UI.
///
/// Returns `None` when no static export is available (e.g. development before the
/// Vite build has run). When available, the service is mounted at `/` so the UI
/// works offline with its original root-relative asset paths. Missing paths fall
/// back to `index.html` for Vite / React Router SPA behavior.
pub fn platform_service() -> Option<ServeDir<ServeFile>> {
    let static_path = resolve_static_path();
    let index_path = static_path.join("index.html");

    if !index_path.exists() {
        // Only warn if user explicitly configured a path; default fallback is expected
        // to be missing in development before the Vite build step runs.
        let is_explicit = std::env::var("ALLTERNIT_PLATFORM_STATIC").is_ok();
        if is_explicit {
            tracing::warn!(
                "Platform static files not found at '{}'",
                static_path.display()
            );
        } else {
            tracing::info!(
                "Platform static files not found at '{}' (skipping — run Vite build to generate)",
                static_path.display()
            );
        }
        return None;
    }

    info!("Serving platform UI from: {}", static_path.display());

    Some(
        ServeDir::new(&static_path)
            .append_index_html_on_directories(true)
            .fallback(ServeFile::new(&index_path)),
    )
}
