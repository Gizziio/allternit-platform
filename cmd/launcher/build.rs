use std::path::PathBuf;

fn main() {
    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let api_embed = manifest_dir.join("embed").join("allternit-api");
    let ui_embed = manifest_dir.join("embed").join("ui");

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

    println!("cargo:rerun-if-changed=embed/allternit-api");
    println!("cargo:rerun-if-changed=embed/ui");
}
