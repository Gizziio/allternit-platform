use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let embed_dir = manifest_dir.join("embed");
    let api_embed = embed_dir.join("allternit-api");
    let ui_embed = embed_dir.join("ui");

    // The embed pipeline (script/build-embed.sh) produces real artifacts for release builds.
    // For local `cargo check`/tests we create minimal placeholder files so the crate can
    // compile. The launcher will not function without real embed artifacts, but this keeps
    // the workspace build healthy and makes CI/release failures explicit when the pipeline
    // is skipped.
    if std::env::var_os("ALLTERNIT_LAUNCHER_REQUIRE_EMBED").is_some() {
        if !api_embed.exists() {
            panic!(
                "Embed artifact missing: {}\n\
                 Run the embed pipeline first:\n\
                   ./cmd/launcher/script/build-embed.sh\n\
                 See cmd/launcher/README.md for details.",
                api_embed.display()
            );
        }
        if !ui_embed.exists() {
            panic!(
                "Embed artifact missing: {}\n\
                 Run the embed pipeline first:\n\
                   ./cmd/launcher/script/build-embed.sh\n\
                 See cmd/launcher/README.md for details.",
                ui_embed.display()
            );
        }
    } else if !api_embed.exists() || !ui_embed.exists() {
        eprintln!(
            "allternit-platform-launcher: embed artifacts missing; creating placeholder files. \
             Set ALLTERNIT_LAUNCHER_REQUIRE_EMBED=1 to fail instead. \
             Run ./cmd/launcher/script/build-embed.sh to produce real release artifacts."
        );
        std::fs::create_dir_all(&embed_dir).ok();
        if !api_embed.exists() {
            std::fs::write(&api_embed, b"").expect("failed to create placeholder API embed");
        }
        if !ui_embed.exists() {
            std::fs::create_dir_all(&ui_embed).expect("failed to create placeholder UI embed dir");
            let index = ui_embed.join("index.html");
            if !index.exists() {
                std::fs::write(&index, b"<html><body>Placeholder UI</body></html>")
                    .expect("failed to create placeholder UI index");
            }
        }
    }

    println!("cargo:rerun-if-changed=embed/allternit-api");
    println!("cargo:rerun-if-changed=embed/ui");
}
